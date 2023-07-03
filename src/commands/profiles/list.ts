import * as cosmos from "@azure/cosmos";
import { Command } from "@oclif/core";
import cli from "cli-ux";
import * as RA from "fp-ts/ReadonlyArray";
import { getCosmosConnection, pickAzureConfig } from "../../utils/azure";
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import {
  asyncIteratorToArray,
  flattenAsyncIterator,
  mapAsyncIterable,
} from "@pagopa/io-functions-commons/dist/src/utils/async";

export default class ProfilesList extends Command {
  public static description = "Lists all profiles";

  public static flags = {
    ...cli.table.flags,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ProfilesList);

    try {
      cli.action.stop();

      cli.action.start("Querying profiles...");
      const cosmosConnectionString = getRequiredStringEnv(
        "COSMOS_CONNECTION_STRING"
      );
      const client = new cosmos.CosmosClient(cosmosConnectionString);
      const database = client.database("agid-documentdb-test");
      const container = database.container("profiles");
      const responseIterator = container.items
        .query("SELECT c.fiscalCode, c._ts FROM c WHERE c.version = 0")
        .getAsyncIterator();

      const result = await asyncIteratorToArray(
        flattenAsyncIterator(
          mapAsyncIterable(
            responseIterator,
            (feedResponse) => feedResponse.resources
          )[Symbol.asyncIterator]()
        )
      );

      cli.action.stop();
      if (result === undefined) {
        this.error("No result");
        return;
      }

      cli.table(
        RA.toArray(result),
        {
          fiscalCode: {
            minWidth: 16,
            header: "fiscalCode",
          },
          createdAt: {
            header: "createdAt",
            // tslint:disable-next-line: no-any
            get: (row: any) =>
              row._ts && new Date(row._ts * 1000).toISOString(),
            extended: true,
          },
        },
        {
          printLine: this.log,
          ...flags, // parsed flags
        }
      );
    } catch (e) {
      this.error(String(e));
    }
  }
}
