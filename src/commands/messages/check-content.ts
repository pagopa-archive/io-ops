import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import * as storage from "azure-storage";
import cli from "cli-ux";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import {
  config,
  getCosmosEndpoint,
  getCosmosReadonlyKey,
  getStorageConnection
} from "../../utils/azure";

export default class MessagesCheckContent extends Command {
  public static description = "Checks validity of messages";

  // tslint:disable-next-line:readonly-array
  public static args = [
    {
      name: "fiscalCode",
      required: true
    }
  ];

  public static flags = {
    ...cli.table.flags()
  };

  public run = async () => {
    const { args, flags: parsedFlags } = this.parse(MessagesCheckContent);

    const fiscalCodeOrErrors = FiscalCode.decode(args.fiscalCode);

    if (fiscalCodeOrErrors.isLeft()) {
      this.error("Invalid fiscalCode");
      return;
    }

    const fiscalCode = fiscalCodeOrErrors.value;

    try {
      cli.action.start("Retrieving credentials");
      const [endpoint, key, storageConnection] = await Promise.all([
        getCosmosEndpoint(config.resourceGroup, config.cosmosName),
        getCosmosReadonlyKey(config.resourceGroup, config.cosmosName),
        getStorageConnection(config.storageName)
      ]);
      cli.action.stop();

      const blobService = storage.createBlobService(storageConnection);

      const doesBlobExist = (id: string) =>
        new Promise<storage.BlobService.BlobResult>((resolve, reject) =>
          blobService.doesBlobExist(
            config.storageMessagesContainer,
            id,
            (err, blobResult) => (err ? reject(err) : resolve(blobResult))
          )
        );
      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = await client.database(config.cosmosDatabaseName);
      const container = database.container(config.cosmosMessagesContainer);

      cli.action.start("Querying messages...");
      const response = await container.items.query(
        {
          parameters: [{ name: "@fiscalCode", value: fiscalCode }],
          query:
            "SELECT c.id, c.createdAt, c.isPending FROM c WHERE c.fiscalCode = @fiscalCode"
        },
        {
          enableCrossPartitionQuery: true
        }
      );
      const result = (await response.toArray()).result;
      cli.action.stop();

      if (result === undefined) {
        this.error("No result");
        return;
      }

      const messages: ReadonlyArray<{
        id: string;
        createdAt: string;
        isPending?: boolean;
      }> = result;

      cli.action.start("Validating message content...");
      const validated = await Promise.all(
        messages.map(async message => ({
          ...message,
          hasContent:
            (await doesBlobExist(`${message.id}.json`)).exists === true
        }))
      );
      cli.action.stop();
      cli.table(
        validated,
        {
          fiscalCode: {
            get: () => fiscalCode,
            header: "fiscalCode"
          },
          id: {
            header: "id"
          },
          // tslint:disable-next-line:object-literal-sort-keys
          hasContent: {
            header: "hasContent"
          },
          isPending: {
            header: "isPending"
          }
        },
        {
          printLine: this.log,
          ...parsedFlags // parsed flags
        }
      );
    } catch (e) {
      this.error(e);
    }
  };
}
