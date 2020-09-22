import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import { none, Option, some } from "fp-ts/lib/Option";
import * as imageSize from "image-size";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import * as request from "request";

import {
  ServicePublic,
  ServicePublicFull
} from "../../definitions/ServicePublic";
import { ServiceMetadata } from "../../generated/ServiceMetadata";
import {
  getCosmosEndpoint,
  getCosmosReadonlyKey,
  pickAzureConfig
} from "../../utils/azure";
import { serviceContentRepoUrl } from "../../utils/service";

// tslint:disable-next-line: interface-name
interface ImageInfo {
  type: string;
  width: number;
  height: number;
  uri: string;
  sizeInByte: number;
}

/**
 * retrive service metadata from the given service ID
 */
export function loadServiceMetadata(
  serviceId: string
): Promise<t.Validation<ServiceMetadata>> {
  const options = {
    uri: `${serviceContentRepoUrl}services/${serviceId
      .toLowerCase()
      .trim()}.json`,
    json: true
  };
  return new Promise((res, _) => {
    request(options, (__, ___, body) => {
      const value = ServiceMetadata.decode(body);
      res(value);
    });
  });
}

/**
 * retrive logo from the given logouri. If it exists return image info, none otherwise
 */
export const loadImageInfo = (imageUri: string): Promise<Option<ImageInfo>> => {
  const options = {
    uri: imageUri,
    encoding: null
  };
  return new Promise((res, _) => {
    request(options, (__, req, body) => {
      if (req && req.statusCode === 200) {
        try {
          const imageInfo = imageSize(body);
          res(
            some({
              ...imageInfo,
              uri: options.uri,
              sizeInByte: body.length
            })
          );
        } catch {
          res(none);
        }
      } else {
        res(none);
      }
    });
  });
};

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

    // check if the given ID is valid
    if (maybeServiceId.isLeft()) {
      cli.error(chalk.red("service ID cannot be empty"));
      this.exit();
      return;
    }
    const config = await pickAzureConfig();
    const serviceId = maybeServiceId.value;
    try {
      cli.action.start(chalk.cyanBright("Retrieving cosmosdb credentials"));
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
          "Do you want to print extended service information? (y/n)"
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
            ` with service ID ${chalk.bgWhite(chalk.black(serviceId))}\n`
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
        `${chalk.blueBright("service version")}\nMAX: ${chalk.bold(
          serviceVersion.max.toString()
        )} MIN: ${chalk.bold(serviceVersion.min.toString())}\n`
      );

      // print service items informations
      cli.log(chalk.blueBright(`${services.length} services items`));
      services.forEach(s => cli.log(JSON.stringify(s, null, 2)));
      cli.log("\n");

      // retrieve services metadata
      cli.action.start(chalk.cyanBright("getting service metadata...."));
      const servicesMetadata = await loadServiceMetadata(serviceId);
      cli.action.stop();
      servicesMetadata.fold(
        error => {
          cli.log(
            `${chalk.red(
              "services metadata not found or cannot be decoded:"
            )} ${chalk.bold(readableReport(error))}`
          );
        },
        metadata => {
          const content = `services metadata\n
          ${chalk.white(JSON.stringify(metadata, null, 2))}`;
          cli.log(`${chalk.blueBright(content)}`);
        }
      );

      // check about visibility: it would be good to have
      // only a service visible
      const visibleServices = services.filter(s => s.isVisible);
      if (visibleServices.length === 0) {
        cli.log(chalk.redBright("None of these services is visible!"));
      } else {
        if (visibleServices.length > 1) {
          cli.log(
            chalk.redBright(
              `There are ${
                visibleServices.length
              } services visible: version [${visibleServices
                .map(s => s.version)
                .join()}]`
            )
          );
        } else {
          cli.log(
            `The service with version ${visibleServices[0].version} is the visible one!`
          );
        }
      }

      // to access organizationFiscalCode and serviceId fields we pick
      // the service with max version in list
      const lastService = services.find(s => s.version === serviceVersion.max);
      if (lastService !== undefined) {
        cli.action.start(
          chalk.cyanBright("getting service and organization logo....")
        );
        // retrieve services organization logo
        const ofc = lastService.organizationFiscalCode
          .replace(/^0+/, "")
          .trim();
        const maybeOrganizationLogo = await loadImageInfo(
          `${serviceContentRepoUrl}logos/organizations/${ofc}.png`
        );

        const logOrganizationLogo = maybeOrganizationLogo.fold(
          chalk.red("❌ organization logo not found!"),
          imageInfo =>
            chalk.white(
              `✅ organization logo found, here the details\n ${JSON.stringify(
                imageInfo,
                null,
                2
              )}`
            )
        );

        const maybeServiceLogo = await loadImageInfo(
          `${serviceContentRepoUrl}logos/services/${lastService.serviceId
            .toLowerCase()
            .trim()}.png`
        );

        const logServiceLogo = maybeServiceLogo.fold(
          chalk.red("❌ service logo not found!"),
          imageInfo =>
            chalk.white(
              `✅ service logo found, here the details\n ${JSON.stringify(
                imageInfo,
                null,
                2
              )}`
            )
        );

        cli.action.stop();
        cli.log(logOrganizationLogo);
        cli.log(logServiceLogo);
      }
    } catch (e) {
      this.error(e);
    }

    return Promise.resolve();
  }
}
