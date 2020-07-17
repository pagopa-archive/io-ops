import * as cosmos from "@azure/cosmos";
import { Command } from "@oclif/command";
import cli from "cli-ux";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import { getCosmosConnection, pickAzureConfig } from "../../utils/azure";

export default class UserBonusesList extends Command {
  public static description = "Lists all user bonuses";

  // tslint:disable-next-line:readonly-array
  public static args = [
    {
      name: "fiscalCode",
      required: false
    }
  ];

  public static flags = {
    ...cli.table.flags()
  };

  public async run(): Promise<void> {
    const { args, flags: parsedFlags } = this.parse(UserBonusesList);

    let fiscalCode: string = "";

    if (args.fiscalCode) {
      const fiscalCodeOrErrors = FiscalCode.decode(args.fiscalCode);
      if (fiscalCodeOrErrors.isLeft()) {
        this.error("Invalid fiscalCode");
        return;
      }
      fiscalCode = fiscalCodeOrErrors.value;
    }

    try {
      const config = await pickAzureConfig();
      cli.action.start("Retrieving cosmosdb credentials");
      const { endpoint, key } = await getCosmosConnection(
        config.resourceGroup,
        config.cosmosName
      );
      cli.action.stop();

      cli.action.start("Querying user bonuses...");
      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = client.database(config.cosmosDatabaseName);
      const container = database.container(config.cosmosUserBonusesContainer);

      let querySpec = {
        parameters: [{ name: "@fiscalCode", value: fiscalCode }],
        query:
          "SELECT c.fiscalCode, c.isApplicant FROM c WHERE c.fiscalCode = @fiscalCode"
      };

      if (fiscalCode == "") {
        querySpec = {
          parameters: [],
          query: "SELECT c.fiscalCode, c.isApplicant FROM c"
        };
      }

      const response = container.items.query(querySpec, {
        enableCrossPartitionQuery: true
      });
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
          isApplicant: {
            header: "isApplicant"
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
  }
}
