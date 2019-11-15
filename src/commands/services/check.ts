import * as cosmos from "@azure/cosmos";
import { Command } from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { ServicePublic } from "../../definitions/ServicePublic";
import {
  getCosmosEndpoint,
  getCosmosReadonlyKey,
  pickAzureConfig
} from "../../utils/azure";

interface IGroupOptions {
  [key: string]: (a: ServicePublic, b: ServicePublic) => number;
}

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
  }
};

export default class ServicesCheck extends Command {
  // tslint:disable-next-line: cognitive-complexity
  public async run(): Promise<void> {
    try {
      const config = await pickAzureConfig();
      cli.action.start(chalk.cyanBright("Retrieving cosmosdb credentials"));
      const [endpoint, key] = await Promise.all([
        getCosmosEndpoint(config.resourceGroup, config.cosmosName),
        getCosmosReadonlyKey(config.resourceGroup, config.cosmosName)
      ]);
      cli.action.stop();

      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = client.database(config.cosmosDatabaseName);
      const container = database.container(config.cosmosServicesContainer);

      // retrieve all visible services
      const response = container.items.query(
        {
          query: `SELECT * FROM c`
        },
        { enableCrossPartitionQuery: true }
      );
      const { result: itemsList } = await response.toArray();
      if (itemsList === undefined || itemsList.length === 0) {
        cli.log("no services found");
        this.exit();
        return;
      }
      const services = itemsList.reduce(
        (acc: ReadonlyArray<ServicePublic>, current) => {
          const maybeService = ServicePublic.decode(current);
          if (maybeService.isRight()) {
            // we want to keep only services with max version
            const versionIndex = acc.findIndex(
              s => s.serviceId === maybeService.value.serviceId
            );
            // if we have already collected the same service (same id) with a less version
            // we remove it from the collection in place of the new one

            if (
              versionIndex >= 0 &&
              acc[versionIndex].version < maybeService.value.version
            ) {
              return [
                ...acc.filter(
                  s => s.serviceId !== maybeService.value.serviceId
                ),
                maybeService.value
              ];
            }

            return [...acc, maybeService.value];
          } else {
            // if the decoding fails we raise an exception with an Error
            // describing what is happened
            throw new Error(readableReport(maybeService.value));
          }
        },
        []
      );

      const columns = {
        orgName: {
          header: "Organization Name",
          // tslint:disable-next-line: no-any
          get: (row: any) =>
            `${row.organizationName} [${row.organizationFiscalCode}]`
        },
        name: {
          header: "Service Name",
          // tslint:disable-next-line: no-any
          get: (row: any) =>
            `${row.serviceName} [${row.version} - ${row.serviceId}]`
        },
        isVisible: {
          header: "is Visible",
          // tslint:disable-next-line: no-any
          get: (row: any) => (row.isVisible ? "✅" : "❌")
        }
      };
      const predicatesName = Object.keys(groupByPredicates);
      const groupOptions = predicatesName
        .map((go: string, index: number) => `${index + 1} - ${go}`)
        .join("\n");
      // tslint:disable-next-line: no-let
      let groupOptionIndex = 0;
      groupOptionIndex = await cli.prompt(
        `Group results by\n${groupOptions}\n`,
        { default: "0" }
      );
      if (
        isNaN(groupOptionIndex) ||
        (groupOptionIndex < 0 && groupOptionIndex >= predicatesName.length)
      ) {
        groupOptionIndex = 0;
      } else {
        groupOptionIndex -= 1;
      }
      const sortPredicate = groupByPredicates[predicatesName[groupOptionIndex]];
      const servicesSortedByOrganizationName = [...services].sort(
        sortPredicate
      );
      cli.table(servicesSortedByOrganizationName, columns);
    } catch (e) {
      cli.log(e.body);
      this.error(e);
    }

    return Promise.resolve();
  }
}
