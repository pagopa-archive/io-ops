import * as cosmos from "@azure/cosmos";
import { Command } from "@oclif/command";
import cli from "cli-ux";

import { getCosmosConnection, pickAzureConfig } from "../../utils/azure";

export default class UserDataProcessingRequestsList extends Command {
  public static description = "Lists all user data processing request";

  public static flags = {
    ...cli.table.flags()
  };

  public async run(): Promise<void> {
    const { flags } = this.parse(UserDataProcessingRequestsList);

    try {
      const config = await pickAzureConfig();
      cli.action.start("Retrieving cosmosdb credentials");
      const { endpoint, key } = await getCosmosConnection(
        config.resourceGroup,
        config.cosmosName
      );
      cli.action.stop();

      cli.action.start("Querying user requests...");
      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = client.database(config.cosmosDatabaseName);
      const container = database.container(
        config.cosmosUserDataProcessingContainer
      );
      const response = container.items.query(
        "SELECT c.fiscalCode, c.choice, c.updatedAt FROM c",
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

      const profileContainer = database.container(
        config.cosmosProfilesContainer
      );

      const ret = await Promise.all(
        result.map(async r => {
          const record = profileContainer.items.query(
            `SELECT c.email, c.isEmailValidated FROM c WHERE c.fiscalCode = "${r.fiscalCode}"`,
            {
              enableCrossPartitionQuery: true
            }
          );
          const profile = (await record.toArray()).result;
          return { ...r, ...(profile ? profile[0] : {}) };
        })
      );

      cli.table(
        ret,
        {
          fiscalCode: {
            minWidth: 16,
            header: "fiscalCode"
          },
          choice: {
            header: "choice"
          },
          isEmailValidated: {
            header: "isEmailValidated"
          },
          email: {
            header: "email"
          },
          updatedAt: {
            header: "updatedAt"
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
