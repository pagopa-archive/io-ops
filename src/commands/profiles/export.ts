import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import AdmZip = require("adm-zip");
import * as storage from "azure-storage";
import { BlobService, ServiceResponse } from "azure-storage";
import { cli } from "cli-ux";
import { fromNullable } from "fp-ts/lib/Option";
import * as fs from "fs";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { join } from "path";
import {
  getCosmosConnection,
  getStorageConnection,
  pickAzureConfig
} from "../../utils/azure";
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
  items: ReadonlyArray<cosmos.Item>;
}

export default class ProfileExport extends Command {
  public static description = "Dump a profile data into a zip archive";

  public static flags = {
    output: flags.string({
      char: "o",
      description: "output folder",
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
    // check if fiscal code has a valid shape
    if (fiscalCodeOrErrors.isLeft()) {
      this.error(`the provided "${args.fiscalCode}" fiscal code is not valid`);
    }
    // if no output folder is provider, report will be saved in place
    const outputFolder = parsedFlags.output || __dirname;
    // check if the provided output folder exists
    if (!fs.existsSync(outputFolder)) {
      this.error(`this output folder "${outputFolder}" doesn't exist`);
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

    const storageConnection = await getStorageConnection(
      azureConfig.storageName
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

    // define all operations to perform to retrieve all user's data
    const operations: ReadonlyArray<IOperation> = [
      // profiles
      {
        name: profiles,
        container: azureConfig.cosmosProfilesContainer,
        query: selectFromFiscalCode,
        whereValue: fiscalCode,
        enableCrossPartitionQuery: false
      },
      // messages
      {
        name: messages,
        container: azureConfig.cosmosMessagesContainer,
        query: selectFromFiscalCode,
        whereValue: fiscalCode,
        enableCrossPartitionQuery: false
      },
      // notifications
      {
        name: notifications,
        container: azureConfig.cosmosNotificationContainer,
        query: selectFromFiscalCode,
        whereValue: fiscalCode,
        enableCrossPartitionQuery: true
      },
      // sender services
      {
        name: senderServices,
        container: azureConfig.cosmosSenderServicesContainer,
        query: selectFromRecipientFiscalCode,
        whereValue: fiscalCode,
        enableCrossPartitionQuery: false
      }
    ];

    // execute sequentially all operations
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

    // dumpData contains all data to be dumped in a zip file
    // tslint:disable-next-line: readonly-array
    const dumpData = [...items];

    // get message section
    const messagesItems = items.find(
      i => i.name === messages && i.items.length > 0
    );

    // if there are message, retrieve all related messages status and messages blob
    if (messagesItems) {
      cli.action.start("Retrieving user messages status...");
      const resultMessagesStatus = await sequential(
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
      // remove empty array and select the only element (message status : message = 1 : 1)
      const messagesStatus = resultMessagesStatus
        .filter(ms => ms.length > 0)
        .map(i => i[0]);
      dumpData.push({ name: "messages-status", items: messagesStatus });
      cli.action.stop(`${messagesStatus.length} messages status found!`);

      cli.action.start("Retrieving user messages blob...");
      const resultMessagesBlob = await sequential(
        messagesItems.items.map((m: { id: string }) => m.id),
        async (messageId: string) => {
          return await this.getBlobs(
            storageConnection,
            azureConfig.storageMessagesContainer,
            `${messageId}.json`
          );
        }
      );
      if (resultMessagesBlob.length > 0) {
        dumpData.push({ name: "messages-content", items: resultMessagesBlob });
      }

      cli.action.stop(`${resultMessagesBlob.length} messages blob found!`);
    }

    // check if there are no date collected
    if (dumpData.find(d => d.items.length > 0) === undefined) {
      cli.log("no data has been exported");
      this.exit();
    }
    const zipFile = new AdmZip();
    dumpData
      .filter(d => d.items.length > 0)
      .forEach(d => {
        const data = JSON.stringify(d.items, null, 4);
        zipFile.addFile(`${d.name}.json`, Buffer.from(data));
      });
    const zipFileFullName = join(outputFolder, `${fiscalCode}.zip`);
    zipFile.writeZip(zipFileFullName);
    cli.log(`all data has been exported ${zipFileFullName}`);
  }

  /**
   * retrieve data from cosmos db
   * @param database the db instance
   * @param containerName the name of the container
   * @param query the query to performe
   * @param whereValue the value of where condition
   * @param enableCrossPartitionQuery the query option
   */
  private async getItems(
    database: cosmos.Database,
    containerName: string,
    query: string,
    whereValue: string,
    enableCrossPartitionQuery: boolean = false
  ): Promise<ReadonlyArray<cosmos.Item>> {
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

  /**
   * retrieve a blob from azure storage
   * @param storageConnection
   * @param storageMessagesContainer
   * @param blobName
   */
  private async getBlobs(
    storageConnection: string,
    storageMessagesContainer: string,
    blobName: string
    // tslint:disable-next-line: no-any
  ): Promise<any> {
    return new Promise((res, rej) => {
      // get the blob service
      const blobService = storage.createBlobService(storageConnection);
      blobService.getBlobToText(
        storageMessagesContainer,
        blobName,
        (
          error: Error,
          text: string,
          _: BlobService.BlobResult,
          __: ServiceResponse
        ) => {
          if (error !== null) {
            rej(error);
          }
          res(JSON.parse(text));
        }
      );
    });
  }
}
