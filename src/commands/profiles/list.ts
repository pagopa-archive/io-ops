import * as cosmos from "@azure/cosmos";
import { Command } from "@oclif/core";
import cli from "cli-ux";

import { getCosmosConnection, pickAzureConfig } from "../../utils/azure";

export default class ProfilesList extends Command {
  public static description = "Lists all profiles";

  public static flags = {
    ...cli.table.flags,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ProfilesList);

    try {
      const config = await pickAzureConfig();
      cli.action.start("Retrieving cosmosdb credentials");
      const { endpoint, key } = await getCosmosConnection(
        config.resourceGroup,
        config.cosmosName
      );
      cli.action.stop();

      cli.action.start("Querying profiles...");
      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = client.database("agid-documentdb-test");
      const container = database.container("profiles");
      const response = container.items.query(
        "SELECT c.fiscalCode, c._ts FROM c WHERE c.version = 0",
        {
          enableCrossPartitionQuery: true,
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
