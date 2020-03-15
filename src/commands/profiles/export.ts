import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import AdmZip = require("adm-zip");
import { cli } from "cli-ux";
import { fromNullable } from "fp-ts/lib/Option";
import * as fs from "fs";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { getCosmosConnection, pickAzureConfig } from "../../utils/azure";
import { sequential } from "../../utils/promise";

const fiscalCodeParamName = "@fiscalCode";
const messageIdParamName = "@messageId";

// define an operation to execute on azure to retrieve profile data
interface IOperation {
  name: string;
  container: string;
  query: string;
  whereValue: string;
  enableCrossPartitionQuery: boolean;
}

// define the result of an Operation
interface IOperationResult {
  name: string;
  // tslint:disable-next-line: no-any
  items: ReadonlyArray<any>;
}

export default class ProfileExport extends Command {
  public static description = "Dump a profile data into a zip file";

  public static flags = {
    all: flags.string({
      char: "o",
      description: "output file",
      required: false,
      default: "." // current folder
    })
  };

  // tslint:disable-next-line:readonly-array
  public static args = [
    {
      name: "fiscalCode",
      required: true,
      default: "N/A"
    }
  ];

  public async run(): Promise<void> {
    const { args, flags: parsedFlags } = this.parse(ProfileExport);
    const fiscalCodeOrErrors = FiscalCode.decode(args.fiscalCode);
    if (fiscalCodeOrErrors.isLeft()) {
      this.error(`the provided "${args.fiscalCode}" fiscal code is not valid`);
    }
    const fiscalCode = fiscalCodeOrErrors.value;
    // ask to pick desidered azure configuration
    const azureConfig = await pickAzureConfig();
    // retrieve azure credentials
    cli.action.start("Retrieving cosmosdb credentials");

    // init cosmos client
    cli.action.start("Retrieving cosmosdb credentials");
    const { endpoint, key } = await getCosmosConnection(
      azureConfig.resourceGroup,
      azureConfig.cosmosName
    );
    cli.action.stop();
    const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
    const database = client.database(azureConfig.cosmosDatabaseName);

    const selectFromFiscalCode = `SELECT * FROM c WHERE c.fiscalCode = ${fiscalCodeParamName}`;
    const selectFromMessageId = `SELECT * FROM c WHERE c.messageId = ${messageIdParamName}`;
    const selectFromRecipientFiscalCode = `SELECT * FROM c WHERE c.recipientFiscalCode = ${fiscalCodeParamName}`;

    cli.action.start("Retrieving user profiles...");

    const profiles = "profiles";
    const messages = "messages";
    const notifications = "notifications";
    const senderServices = "senderServices";

    const operations: ReadonlyArray<IOperation> = [
      {
        name: profiles,
        container: azureConfig.cosmosProfilesContainer,
        query: selectFromFiscalCode,
        whereValue: fiscalCode,
        enableCrossPartitionQuery: false
      },
      {
        name: messages,
        container: azureConfig.cosmosMessagesContainer,
        query: selectFromFiscalCode,
        whereValue: fiscalCode,
        enableCrossPartitionQuery: false
      },
      {
        name: notifications,
        container: azureConfig.cosmosNotificationContainer,
        query: selectFromFiscalCode,
        whereValue: fiscalCode,
        enableCrossPartitionQuery: true
      },
      {
        name: senderServices,
        container: azureConfig.cosmosSenderServicesContainer,
        query: selectFromRecipientFiscalCode,
        whereValue: fiscalCode,
        enableCrossPartitionQuery: false
      }
    ];

    const items: ReadonlyArray<IOperationResult> = await sequential(
      operations,
      async (op: IOperation) => {
        cli.action.start(`Retrieving ${op.name}...`);
        const retrievedItems = await this.getItems(
          database,
          op.container,
          op.query,
          op.whereValue,
          op.enableCrossPartitionQuery
        );
        cli.action.stop(`${retrievedItems.length} ${op.name} found!`);
        return { name: op.name, items: retrievedItems };
      }
    );

    // dumpData contains all date to be dumped in a zip file
    // tslint:disable-next-line: readonly-array
    const dumpData = [...items];
    const messagesItems = items.find(
      i => i.name === messages && i.items.length > 0
    );

    // if there are message, retrieve all related messages status
    if (messagesItems) {
      cli.action.start("Retrieving user messages status...");
      const result = await sequential(
        messagesItems.items.map((m: { id: string }) => m.id),
        async (messageId: string) => {
          return await this.getItems(
            database,
            azureConfig.cosmosMessageStatusContainer,
            selectFromMessageId,
            messageId
          );
        }
      );
      const messagesStatus = result.filter(ms => ms.length > 0);
      dumpData.push({ name: "messages Status", items: messagesStatus });
      cli.action.stop(`${messagesStatus.length} messages status found!`);
    }
    const zipFile = new AdmZip();
    dumpData.forEach(d => {
      const data = JSON.stringify(d.items, null, 4);
      zipFile.addFile(`${d.name}.json`, Buffer.from(data));
    });
    zipFile.writeZip(`${fiscalCode}.zip`);
    cli.log("FINISH");
  }

  private async getItems(
    database: cosmos.Database,
    containerName: string,
    query: string,
    whereValue: string,
    enableCrossPartitionQuery: boolean = false
    // tslint:disable-next-line: no-any
  ): Promise<any> {
    try {
      // get the container of the related delete operation
      const container = database.container(containerName);
      const response = container.items.query(
        {
          query,
          parameters: [{ name: fiscalCodeParamName, value: whereValue }]
        },
        { enableCrossPartitionQuery }
      );
      const result = (await response.toArray()).result;
      return fromNullable(result).getOrElse([]);
    } catch (error) {
      cli.error(error.message);
    }
  }
}
