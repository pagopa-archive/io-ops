import * as cosmos from "@azure/cosmos";
import { Command, Args } from "@oclif/core";
import cli from "cli-ux";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as RA from "fp-ts/lib/ReadonlyArray";

import { pickAzureConfig } from "../../utils/azure";
import {
  asyncIteratorToArray,
  flattenAsyncIterator,
  mapAsyncIterable,
} from "@pagopa/io-functions-commons/dist/src/utils/async";
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";

export default class MessagesList extends Command {
  public static description = "List messages for a fiscalCode";

  // tslint:disable-next-line:readonly-array
  public static args = {
    fiscalCode: Args.string({
      name: "fiscalCode",
      required: true,
    }),
  };

  public static flags = {
    ...cli.table.flags,
  };

  public run = async () => {
    const { args, flags } = await this.parse(MessagesList);

    const fiscalCodeOrErrors = FiscalCode.decode(args.fiscalCode);

    if (E.isLeft(fiscalCodeOrErrors)) {
      this.error("Invalid fiscalCode");
      return;
    }

    const fiscalCode = fiscalCodeOrErrors.right;

    try {
      cli.action.start("Retrieving credentials");
      const config = await pickAzureConfig();
      cli.action.stop();

      const cosmosConnectionString = getRequiredStringEnv(
        "COSMOS_CONNECTION_STRING"
      );
      const client = new cosmos.CosmosClient(cosmosConnectionString);
      const database = client.database(config.cosmosDatabaseName);
      const container = database.container(config.cosmosMessagesContainer);

      cli.action.start("Querying messages...");
      const responseIterator = container.items
        .query({
          parameters: [{ name: "@fiscalCode", value: fiscalCode }],
          query:
            "SELECT c.id, c.createdAt, c.isPending FROM c WHERE c.fiscalCode = @fiscalCode",
        })
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
          path: {
            // tslint:disable-next-line:no-any
            get: (row: any) => `${fiscalCode}/${row.id}`,
            header: "path",
          },
          isPending: {
            extended: true,
            header: "isPending",
          },
        },
        {
          printLine: this.log,
          ...flags,
        }
      );
    } catch (e) {
      this.error(String(e));
    }
  };
}
