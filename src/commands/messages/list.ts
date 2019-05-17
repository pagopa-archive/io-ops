import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import * as storage from "azure-storage";
import cli from "cli-ux";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import {
  config,
  getCosmosEndpoint,
  getCosmosReadonlyKey
} from "../../utils/azure";

export default class MessagesList extends Command {
  public static description = "List messages for a fiscalCode";

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
    const { args, flags: parsedFlags } = this.parse(MessagesList);

    const fiscalCodeOrErrors = FiscalCode.decode(args.fiscalCode);

    if (fiscalCodeOrErrors.isLeft()) {
      this.error("Invalid fiscalCode");
      return;
    }

    const fiscalCode = fiscalCodeOrErrors.value;

    try {
      cli.action.start("Retrieving credentials");
      const [endpoint, key] = await Promise.all([
        getCosmosEndpoint(config.resourceGroup, config.cosmosName),
        getCosmosReadonlyKey(config.resourceGroup, config.cosmosName)
      ]);
      cli.action.stop();

      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = await client.database(config.cosmosDatabaseName);
      const container = database.container(config.cosmosMessagesContainer);

      cli.action.start("Querying messages...");
      const response = await container.items.query({
        parameters: [{ name: "@fiscalCode", value: fiscalCode }],
        query:
          "SELECT c.id, c.createdAt, c.isPending FROM c WHERE c.fiscalCode = @fiscalCode"
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
            get: () => fiscalCode,
            header: "fiscalCode"
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
