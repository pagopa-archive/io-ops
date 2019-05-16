import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import cli from "cli-ux";

import { getCosmosEndpoint, getCosmosConnection } from "../../utils/azure";

export default class ProfilesList extends Command {
  static description = "Lists all profiles";

  static flags = {
    ...cli.table.flags()
  };

  async run() {
    const { args, flags } = this.parse(ProfilesList);

    try {
      cli.action.start("Retrieving cosmosdb credentials");
      const { endpoint, key } = await getCosmosConnection(
        "agid-rg-test",
        "agid-cosmosdb-test"
      );
      cli.action.stop();

      cli.action.start("Querying profiles...");
      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = await client.database("agid-documentdb-test");
      const container = database.container("profiles");
      const response = await container.items.query(
        "SELECT c.fiscalCode, c._ts FROM c WHERE c.version = 0",
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

      cli.table(
        result,
        {
          fiscalCode: {
            minWidth: 16,
            header: "fiscalCode"
          },
          createdAt: {
            header: "createdAt",
            get: (row: any) =>
              row._ts && new Date(row._ts * 1000).toISOString(),
            extended: true
          }
        },
        {
          printLine: this.log,
          ...flags // parsed flags
        }
      );
    } catch (e) {
      this.error(e);
    }
  }
}
