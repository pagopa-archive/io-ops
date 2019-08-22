import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import * as t from "io-ts";
import {
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";
import {
  config,
  getCosmosEndpoint,
  getCosmosReadonlyKey
} from "../../utils/azure";

export const ServicePublic = t.strict({
  serviceId: NonEmptyString,
  serviceName: NonEmptyString,
  organizationName: NonEmptyString,
  departmentName: NonEmptyString,
  organizationFiscalCode: OrganizationFiscalCode,
  version: t.Integer
});

type ServicePublic = t.TypeOf<typeof ServicePublic>;

export default class ServicesDetail extends Command {
  public static description =
    "Retrieve service info and metadata from a given service ID";

  public static flags = {
    serviceId: flags.string({
      char: "i",
      description: "The service ID"
    })
  };

  public async run(): Promise<void> {
    const { flags: parsedFlags } = this.parse(ServicesDetail);
    const maybeServiceId = NonEmptyString.decode(parsedFlags.serviceId);

    if (maybeServiceId.isLeft()) {
      cli.error("service ID cannot be empty");
      this.exit();
      return;
    }
    const serviceId = maybeServiceId.value;
    try {
      cli.action.start("Retrieving cosmosdb credentials");
      const [endpoint, key] = await Promise.all([
        getCosmosEndpoint(config.resourceGroup, config.cosmosName),
        getCosmosReadonlyKey(config.resourceGroup, config.cosmosName)
      ]);
      cli.action.stop();

      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = client.database(config.cosmosDatabaseName);
      const container = database.container(config.cosmosServicesContainer);

      const getServices = async (
        sId: NonEmptyString
      ): Promise<ReadonlyArray<ServicePublic>> => {
        const response = container.items.query({
          parameters: [{ name: "@serviceId", value: sId }],
          query: `SELECT * FROM c WHERE c.serviceId = @serviceId`
        });
        const { result: itemsList } = await response.toArray();
        if (itemsList === undefined) {
          return [];
        }
        return itemsList.reduce((acc, current) => {
          const maybeService = ServicePublic.decode(current);
          if (maybeService.isRight()) {
            return [...acc, maybeService.value];
          }
          return acc;
        }, []);
      };

      const r = await getServices(serviceId);
      r.forEach(_ => cli.log(JSON.stringify(_, null, 2)));
    } catch (e) {
      this.error(e);
    }

    return Promise.resolve();
  }
}
