import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import {
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";
import {
  config,
  getCosmosEndpoint,
  getCosmosReadonlyKey
} from "../../utils/azure";

const serviceAttributes = {
  serviceId: NonEmptyString,
  serviceName: NonEmptyString,
  organizationName: NonEmptyString,
  departmentName: NonEmptyString,
  organizationFiscalCode: OrganizationFiscalCode,
  version: t.Integer
};

export const ServicePublic = t.strict(serviceAttributes);
export const ServicePublicFull = t.interface(serviceAttributes);

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

      // make a query to cosmos db to retrieve all services having
      // a specific service id
      const getServices = async <T>(
        sId: NonEmptyString,
        // tslint:disable-next-line: no-any
        codec: t.Type<any, T, unknown>
      ): Promise<ReadonlyArray<T>> => {
        const response = container.items.query({
          parameters: [{ name: "@serviceId", value: sId }],
          query: `SELECT * FROM c WHERE c.serviceId = @serviceId`
        });
        const { result: itemsList } = await response.toArray();
        if (itemsList === undefined) {
          return [];
        }
        return itemsList.reduce((acc, current) => {
          const maybeService = codec.decode(current);
          if (maybeService.isRight()) {
            return [...acc, maybeService.value];
          }
          // if the decoding fails we raise an exception with an Error
          // describing what is happened
          throw new Error(readableReport(maybeService.value));
        }, []);
      };

      // ask to the user if we will print strict or extended service info
      const extendedInfo =
        (await cli.prompt(
          "Do you want to print extended service information as well? (y/n)"
        )) === "y";
      // depending from user's choice we pass the appropriate coded to decode
      // the payload coming from cosmos db
      const services = await getServices(
        serviceId,
        extendedInfo ? ServicePublicFull : ServicePublic
      );
      // it no items found, print a message and exit
      if (services.length === 0) {
        cli.log(
          `${chalk.redBright("NO items found with service ID")} ${chalk.bgWhite(
            chalk.black(serviceId)
          )}`
        );
        this.exit();
      }
      cli.log(
        chalk.green(
          `found ${services.length} items` +
            ` with service ID ${chalk.bgWhite(chalk.black(serviceId))}`
        )
      );
      const serviceVersion = services.reduce(
        (acc, curr) => {
          return {
            min: Math.min(curr.version, acc.min),
            max: Math.max(curr.version, acc.min)
          };
        },
        { min: 0, max: 0 }
      );
      cli.log(
        `${chalk.blueBright("service version")} MAX: ${chalk.bold(
          serviceVersion.max.toString()
        )} MIN: ${chalk.bold(serviceVersion.min.toString())}`
      );
    } catch (e) {
      this.error(e);
    }

    return Promise.resolve();
  }
}
