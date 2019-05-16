import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import * as storage from "azure-storage";
import cli from "cli-ux";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import {
  getCosmosConnection,
  getCosmosEndpoint,
  getStorageConnection
} from "../../utils/azure";

export default class MessagesCheck extends Command {
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
    const { args, flags: parsedFlags } = this.parse(MessagesCheck);

    const fiscalCodeOrErrors = FiscalCode.decode(args.fiscalCode);

    if (fiscalCodeOrErrors.isLeft()) {
      this.error("Invalid fiscalCode");
      return;
    }

    const fiscalCode = fiscalCodeOrErrors.value;

    try {
      cli.action.start("Retrieving credentials");
      const { endpoint, key } = await getCosmosConnection(
        "agid-rg-test",
        "agid-cosmosdb-test"
      );
      const storageConnection = await getStorageConnection("agidstoragetest");
      cli.action.stop();

      const blobService = storage.createBlobService(storageConnection);

      const doesBlobExist = (id: string) =>
        new Promise<storage.BlobService.BlobResult>((resolve, reject) =>
          blobService.doesBlobExist("message-content", id, (err, blobResult) =>
            err ? reject(err) : resolve(blobResult)
          )
        );

      cli.action.start("Querying messages...");
      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = await client.database("agid-documentdb-test");
      const container = database.container("messages");
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
          hasContent: {
            header: "hasContent"
          },
          id: {
            header: "id"
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
