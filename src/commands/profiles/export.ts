import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import AdmZip = require("adm-zip");
import * as storage from "azure-storage";
import { BlobService, ServiceResponse } from "azure-storage";
import { cli } from "cli-ux";
import { fromNullable } from "fp-ts/lib/Option";

import * as A from "fp-ts/lib/Array";
import * as TE from "fp-ts/lib/TaskEither";
import * as fs from "fs";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { join } from "path";
import {
  getCosmosConnection,
  getStorageConnection,
  pickAzureConfig
} from "../../utils/azure";

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
    // if no output folder is provider, export data file will be saved in place
    const outputFolder = parsedFlags.output || __dirname;
    // check if the provided output folder exists
    if (!fs.existsSync(outputFolder)) {
      this.error(`this output folder "${outputFolder}" doesn't exist`);
    }

    const fiscalCode = fiscalCodeOrErrors.value as string;
    // ask to pick desidered azure configuration
    const azureConfig = await pickAzureConfig();

    // retrieve azure credentials
    cli.action.start("Retrieving cosmosdb credentials");
    const { endpoint, key } = await getCosmosConnection(
      azureConfig.resourceGroup,
      azureConfig.cosmosName
    );

    const storageConnection = await getStorageConnection(
      azureConfig.storageName
    );
    cli.action.stop();

    // init cosmos client
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

    // execute all operations sequentially
    const tasks = await A.array
      .sequence(TE.taskEitherSeq)(
        operations.map(op =>
          this.getItems(
            database,
            op.container,
            op.query,
            op.whereValue,
            op.enableCrossPartitionQuery
          )
        )
      )
      .run();

    // log operations result and transform each dataset to IOperationResult
    const items: ReadonlyArray<IOperationResult> = tasks
      .map(r => {
        const results = r.map(m => fromNullable(m.result).getOrElse([]));
        return results.map((res, idx) => {
          cli.log(`retrieved ${res.length} ${operations[idx].name} items!`);
          return { name: operations[idx].name, items: res };
        });
      })
      .getOrElse([]);

    // dumpData contains all data to be dumped in a zip file
    // tslint:disable-next-line: readonly-array
    const dumpData = [...items];
    // get message section
    const messagesItems = items.find(
      i => i.name === messages && i.items.length > 0
    );

    // if there are messages, retrieve all related messages status and messages content
    if (messagesItems) {
      const pipeline = messagesItems.items.map(
        (m: {
          id: string;
          // tslint:disable-next-line: no-any
        }): TE.TaskEither<string, cosmos.Response<ReadonlyArray<any>>> =>
          this.getItems(
            database,
            azureConfig.cosmosMessageStatusContainer,
            selectFromMessageId,
            m.id
          )
      );
      cli.action.start("Retrieving user messages status...");
      // for each message retrieve its relative message status
      const resultMessagesStatus = await A.array
        .sequence(TE.taskEitherSeq)(pipeline)
        .run();
      resultMessagesStatus.fold(
        (error: string) => {
          cli.action.stop(
            `some error occurred while loading message-status: ${error}`
          );
        },
        ms => {
          const results = ms.map(m => fromNullable(m.result).getOrElse([]));
          // remove empty array and select the only element (message status : message = 1 : 1)
          const filtered = results.filter(m => m.length > 0).map(i => i[0]);
          dumpData.push({ name: "messages-status", items: filtered });
          cli.action.stop(`${filtered.length} messages status found!`);
        }
      );

      cli.action.start("Retrieving user messages blob...");
      // for each message retrieve its relative message content
      const blobs = await A.array
        .sequence(TE.taskEitherSeq)(
          messagesItems.items.map((m: { id: string }) =>
            this.getBlob(
              storageConnection,
              azureConfig.storageMessagesContainer,
              `${m.id}.json`
            )
          )
        )
        .run();
      blobs.fold(
        error => {
          cli.action.stop(
            `some error occurred while loading message-content: ${error}`
          );
        },
        contents => {
          if (contents.length > 0) {
            dumpData.push({
              name: "messages-content",
              items: contents
            });
          }
          cli.action.stop(`${contents.length} messages blob found!`);
        }
      );
    }

    // check if no data has been collected
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
  private getItems = (
    database: cosmos.Database,
    containerName: string,
    query: string,
    whereValue: string,
    enableCrossPartitionQuery: boolean = false
    // tslint:disable-next-line: no-any
  ): TE.TaskEither<string, cosmos.Response<ReadonlyArray<any>>> => {
    const container = database.container(containerName);
    const response = container.items.query(
      {
        query,
        parameters: [{ name: fiscalCodeParamName, value: whereValue }]
      },
      { enableCrossPartitionQuery }
    );
    return TE.tryCatch(() => response.toArray(), reason => String(reason));
  };

  /**
   * retrieve a blob from azure storage
   * @param storageConnection
   * @param storageMessagesContainer
   * @param blobName
   */
  private getBlob(
    storageConnection: string,
    storageMessagesContainer: string,
    blobName: string
    // tslint:disable-next-line: no-any
  ): TE.TaskEither<string, any> {
    const retrieveBlob = new Promise(
      (res: (value: string) => void, rej: (err: Error) => void) => {
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
      }
    );
    return TE.tryCatch(() => retrieveBlob, error => error as string);
  }
}
