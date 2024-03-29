import * as cosmos from "@azure/cosmos";
import { Command } from "@oclif/core";
import chalk from "chalk";
import cli from "cli-ux";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as csvStringify from "csv-stringify";
import * as t from "io-ts";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import * as request from "request";
import { ServicePublic } from "../../definitions/ServicePublic";
import { ServiceMetadata } from "../../generated/ServiceMetadata";
import { pickAzureConfig } from "../../utils/azure";
import { sequential } from "../../utils/promise";
import { serviceContentRepoUrl } from "../../utils/service";
import { loadImageInfo } from "./details";
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import {
  asyncIteratorToArray,
  flattenAsyncIterator,
  mapAsyncIterable,
} from "@pagopa/io-functions-commons/dist/src/utils/async";

interface IGroupOptions {
  [key: string]: (a: ServicePublic, b: ServicePublic) => number;
}

interface ICheck {
  serviceLogoUrl?: string;
  organizationLogoUrl?: string;
  metadataUrl?: string;
}

// predicates to sort the services
const groupByPredicates: IGroupOptions = {
  OrganizationName: (a: ServicePublic, b: ServicePublic) =>
    a.organizationName.localeCompare(b.organizationName),
  ServiceName: (a: ServicePublic, b: ServicePublic) =>
    a.serviceName.localeCompare(b.serviceName),
  Visibility: (a: ServicePublic, b: ServicePublic) => {
    if (a.isVisible && b.isVisible) {
      if (a.isVisible === b.isVisible) {
        return 0;
      }
      if (a.isVisible && !b.isVisible) {
        return -1;
      }
      return 1;
    } else if (a.isVisible) {
      return -1;
    } else if (b.isVisible) {
      return 1;
    }
    return 0;
  },
};

/**
 * retrive service metadata from the given service ID
 * if the response is !== 200 will be returned undefined
 */
const loadServiceMetadata = (
  uri: string
): Promise<t.Validation<ServiceMetadata> | undefined> => {
  const options = {
    uri,
    json: true,
  };
  return new Promise((res, _) => {
    request(options, (__, response, body) => {
      if (response.statusCode === 200) {
        const value = ServiceMetadata.decode(body);
        res(value);
        return;
      }
      res(undefined);
    });
  });
};

export default class ServicesList extends Command {
  public static description = "List all services in csv format";

  // tslint:disable-next-line: cognitive-complexity
  public async run(): Promise<void> {
    try {
      const config = await pickAzureConfig();
      cli.action.start(chalk.cyanBright("Retrieving cosmosdb credentials"));
      cli.action.stop();
      const cosmosConnectionString = getRequiredStringEnv(
        "COSMOS_CONNECTION_STRING"
      );
      const client = new cosmos.CosmosClient(cosmosConnectionString);
      const database = client.database(config.cosmosDatabaseName);
      const container = database.container(config.cosmosServicesContainer);

      // retrieve all visible services
      const responseIterator = container.items
        .query({
          query: `SELECT * FROM c`,
        })
        .getAsyncIterator();

      const itemsList = await asyncIteratorToArray(
        flattenAsyncIterator(
          mapAsyncIterable(
            responseIterator,
            (feedResponse) => feedResponse.resources
          )[Symbol.asyncIterator]()
        )
      );

      if (itemsList === undefined || itemsList.length === 0) {
        cli.log("no services found");
        this.exit();
        return;
      }

      const services = itemsList.reduce(
        (acc: ReadonlyArray<ServicePublic>, current) => {
          const maybeService = ServicePublic.decode(current);
          if (E.isRight(maybeService)) {
            // we want to keep only services with max version
            const versionIndex = acc.findIndex(
              (s) => s.serviceId === maybeService.right.serviceId
            );
            // if we have already collected the same service (same id) with a less version
            // we remove it from the collection in place of the new one
            if (
              versionIndex >= 0 &&
              acc[versionIndex].version < maybeService.right.version
            ) {
              return [
                ...acc.filter(
                  (s) => s.serviceId !== maybeService.right.serviceId
                ),
                maybeService.right,
              ];
            }

            return [...acc, maybeService.right];
          } else {
            // if the decoding fails we raise an exception with an Error
            // describing what is happened
            throw new Error(readableReport(maybeService.left));
          }
        },
        []
      );
      cli.action.start(chalk.cyanBright("Retrieving services metadata..."));
      const result = await sequential<ServicePublic, ICheck>(
        services,
        async (s) => {
          const serviceMetadatUrl = `${serviceContentRepoUrl}services/${s.serviceId
            .toLowerCase()
            .trim()}.json`;
          const hasMetadata = await loadServiceMetadata(serviceMetadatUrl);
          const ofc = s.organizationFiscalCode.replace(/^0+/, "").trim();
          const organizationLogoUrl = `${serviceContentRepoUrl}logos/organizations/${ofc}.png`;
          const maybeOrganizationLogo = await loadImageInfo(
            organizationLogoUrl
          );
          const serviceLogoUrl = `${serviceContentRepoUrl}logos/services/${s.serviceId
            .toLowerCase()
            .trim()}.png`;
          const maybeServiceLogo = await loadImageInfo(serviceLogoUrl);
          return {
            metadataUrl:
              hasMetadata === undefined
                ? "n/a"
                : E.isRight(hasMetadata)
                ? serviceMetadatUrl
                : `metadata malformed ${serviceMetadatUrl}`,
            organizationLogoUrl: O.isSome(maybeOrganizationLogo)
              ? organizationLogoUrl
              : undefined,
            serviceLogoUrl: O.isSome(maybeServiceLogo)
              ? serviceLogoUrl
              : undefined,
          };
        }
      );
      cli.action.stop();

      const servicesCheck = services.map((s: ServicePublic, index: number) => {
        return { ...s, ...result[index] };
      });

      const predicatesName = Object.keys(groupByPredicates);
      const groupOptions = predicatesName
        .map((go: string, index: number) => `${index + 1} - ${go}`)
        .join("\n");
      // ask to the user which sorting prefer
      // tslint:disable-next-line: no-let
      let groupOptionIndex = 0;
      groupOptionIndex = await cli.prompt(
        `Group results by\n${groupOptions}\n`,
        { default: "0" }
      );
      // if the input is not a valid value, fallback to the default (0)
      if (
        isNaN(groupOptionIndex) ||
        (groupOptionIndex < 0 && groupOptionIndex >= predicatesName.length)
      ) {
        groupOptionIndex = 0;
      } else {
        groupOptionIndex -= 1;
      }
      const sortPredicate = groupByPredicates[predicatesName[groupOptionIndex]];
      const servicesSorted = [...servicesCheck].sort(sortPredicate);
      // tslint:disable-next-line: readonly-array
      const csvColumns: csvStringify.ColumnOption[] = [
        {
          key: "organizationName",
          header: "organization name",
        },
        {
          key: "organizationFiscalCode",
          header: "organization fiscalcode",
        },
        {
          key: "serviceName",
          header: "service name",
        },
        {
          key: "isVisible",
          header: "visible",
        },
        {
          key: "serviceId",
          header: "service id",
        },
        {
          key: "version",
          header: "service version",
        },
        {
          key: "metadataUrl",
          header: "service metadata",
        },
        {
          key: "serviceLogoUrl",
          header: "service logo",
        },
        {
          key: "organizationLogoUrl",
          header: "organization logo",
        },
      ];
      const castBoolean = (value: boolean, _: csvStringify.CastingContext) =>
        value ? "true" : "false";

      csvStringify.stringify(
        servicesSorted,
        { cast: { boolean: castBoolean }, header: true, columns: csvColumns },

        (err, row) => {
          if (err) {
            cli.error(err);
            return;
          }
          cli.log(row);
        }
      );
    } catch (e) {
      this.error(String(e));
    }

    return Promise.resolve();
  }
}
