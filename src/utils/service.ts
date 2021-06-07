import * as cosmos from "@azure/cosmos";
// tslint:disable-next-line: no-submodule-imports
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import { none, Option, some } from "fp-ts/lib/Option";
import { DateTime } from "luxon";
import { getCosmosConnection, pickAzureConfig } from "./azure";

export const serviceContentRepoUrl =
  "https://raw.githubusercontent.com/teamdigitale/io-services-metadata/master/";

export async function getServices(
  date: Option<DateTime>,
  azureConfig?: string
): Promise<Option<ReadonlyArray<RetrievedService>>> {
  const config = await pickAzureConfig(azureConfig);
  const { endpoint, key } = await getCosmosConnection(
    config.resourceGroup,
    config.cosmosName
  );

  const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
  const database = client.database(config.cosmosDatabaseName);
  const container = database.container(config.cosmosServicesContainer);
  const response = container.items.query(
    // query services by timestamp
    `SELECT * FROM c ${date
      // tslint:disable-next-line: no-nested-template-literals
      .map(_ => `WHERE c._ts < ${_.toMillis() / 1000 - 1}`)
      .getOrElse("")}`,
    {
      enableCrossPartitionQuery: true
    }
  );
  const result: ReadonlyArray<RetrievedService> | undefined = (
    await response.toArray()
  ).result;

  if (result === undefined) {
    return none;
  }

  return some(
    Object.values(
      result.reduce((prev, curr) => {
        const isNewer =
          !prev[curr.serviceId] || curr.version > prev[curr.serviceId].version;
        return {
          ...prev,
          ...(isNewer ? { [curr.serviceId]: curr } : {})
        };
      }, {} as Record<string, RetrievedService>)
    )
  );
}
