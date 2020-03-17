import Command from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import { array } from "fp-ts/lib/Array";
import { flatten } from "fp-ts/lib/Chain";
import { toError } from "fp-ts/lib/Either";
import {
  fromEither,
  TaskEither,
  taskEither,
  taskEitherSeq,
  tryCatch
} from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import { safeLoad } from "js-yaml";
import fetch from "node-fetch";
import { Service } from "../generated/Service";
import { ServiceMetadata } from "../generated/ServiceMetadata";

// This command is used to migrate services metadata or logos from github
// @see https://github.com/pagopa/io-services-metadata to cosmosDB. For metadata
// it iterates on https://github.com/pagopa/io-services-metadata/blob/master/services.yml
// for all metadata services and will update the service identified by ID. Moreover,
// the command can also save the logo saved in the same repo into a CDN using the
// related API. In this case it will fallback if the service has no logo it will fallback
// with organization logo looking for into the same github repository.
export class Migrate extends Command {
  public static description = "Migrate metadata or logos from github";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    "$ io-ops migrate metadata",
    "$ io-ops migrate logo"
  ];

  // tslint:disable-next-line: readonly-array
  public static args = [
    {
      name: "metadata",
      required: true,
      description: "Migrate metadata or logo from github",
      options: ["metadata", "logo"]
    }
  ];

  public static ocpHeader = "Ocp-Apim-Subscription-Key";

  // Run the command
  public async run(): Promise<void> {
    const { args } = this.parse(Migrate);
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Migrating data from github`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );

    if (args.metadata === "metadata") {
      // Migrate metadata
      return this.migrateMetadata()
        .fold(
          error => {
            cli.action.stop(chalk.red(`Error : ${error}`));
          },
          result => {
            cli.action.stop(chalk.green(`Services Updated`));
          }
        )
        .run();
    } else {
      // Migrate logo
      return this.migrateLogo()
        .fold(
          error => {
            cli.action.stop(chalk.red(`Error : ${error}`));
          },
          result => {
            cli.action.stop(chalk.green(`Logos Updated`));
          }
        )
        .run();
    }
  }

  // Update service
  private update = (service: Service): TaskEither<Error, string> => {
    return tryCatch(
      () =>
        fetch(
          `${getRequiredStringEnv("BASE_URL_ADMIN")}/services/${
            service.service_id
          }`,
          {
            body: JSON.stringify(service),
            headers: {
              [Migrate.ocpHeader]: getRequiredStringEnv("OCP_APIM")
            },
            method: "put"
          }
        ).then(res => res.text()),
      toError
    );
  };

  // Get service data
  private service = (serviceId: string): TaskEither<Error, string> =>
    tryCatch(
      () =>
        fetch(
          `${getRequiredStringEnv("BASE_URL_ADMIN")}/services/${serviceId}`,
          {
            headers: {
              [Migrate.ocpHeader]: getRequiredStringEnv("OCP_APIM")
            }
          }
        ).then(res => res.text()),
      toError
    );

  // Conver yaml to object
  private readServiceYaml = (yamlString: string) => safeLoad(yamlString);

  // Get all services metadata from github
  private githubServicesData = () =>
    tryCatch(
      () =>
        fetch(
          `https://raw.githubusercontent.com/pagopa/io-services-metadata/master/services.yml`
        ).then(res => res.text()),
      toError
    );

  // Download png form url and convert to base64
  private serviceLogo = (url: string, Id: string) =>
    tryCatch(
      () =>
        fetch(`${url}/${Id}.png`)
          .then(res => {
            if (res.ok) {
              return res.buffer();
            } else {
              throw new Error("404");
            }
          })
          .then(buf => {
            return buf.toString("base64");
          })
          .catch(error => {
            return "";
          }),
      toError
    );

  // Download logo for service and fallback to organization if
  // service logo not exists
  private fallBackOrganizationLogo = (id: string, orgId: string) =>
    array.sequence(taskEitherSeq)([
      this.serviceLogo(
        "https://raw.githubusercontent.com/pagopa/io-services-metadata/master/logos/services",
        id
      ),
      this.serviceLogo(
        "https://raw.githubusercontent.com/pagopa/io-services-metadata/master/logos/organizations",
        orgId
      )
    ]);

  // Update logo and associate to service
  private putLogo = (serviceId: string, base64Logo: string) => {
    return tryCatch(
      () =>
        fetch(
          `${getRequiredStringEnv(
            "BASE_URL_ADMIN"
          )}/services/${serviceId}/logo`,
          {
            body: JSON.stringify({ logo: base64Logo }),
            headers: {
              [Migrate.ocpHeader]: getRequiredStringEnv("OCP_APIM")
            },
            method: "put"
          }
        ).then(resp =>
          resp.text().then(result => {
            if (resp.ok) {
              return cli.log(
                chalk.green(`Updated logo for service: ${serviceId}`)
              );
            } else {
              return cli.log(chalk.red(`No logo found for: ${serviceId}`));
            }
          })
        ),
      toError
    );
  };

  private migrateMetadata = () =>
    // Getting the services metadata from github
    this.githubServicesData().chain(servicesMetadataString => {
      // Read the yaml https://raw.githubusercontent.com/pagopa/io-services-metadata/master/services.yml
      // where keys of yaml are service id
      const servicesMetadata = this.readServiceYaml(servicesMetadataString);
      // Iterate over services by id
      const services = Object.keys(servicesMetadata).map(key => {
        // get metadata obj
        const metadata = servicesMetadata[key];
        // Update service with metadata by calling the API
        return this.service(key)
          .map(serviceString => {
            const serviceObj = JSON.parse(serviceString);
            return {
              ...serviceObj,
              ...{ service_metadata: metadata }
            };
          })
          .chain(serviceObj => {
            if (serviceObj.service_id) {
              cli.log(
                chalk.green(`Updated metadata: ${serviceObj.service_id}`)
              );
            } else {
              cli.log(chalk.red(`Not found ${key}`));
            }
            return this.update(serviceObj);
          });
      });
      return array.sequence(taskEither)(services);
    });

  private migrateLogo = () =>
    // Getting the services metadata from github
    this.githubServicesData().chain(servicesMetadataString => {
      // Read the yaml https://raw.githubusercontent.com/pagopa/io-services-metadata/master/services.yml
      // where keys of yaml are service id
      const servicesMetadata = this.readServiceYaml(servicesMetadataString);
      // Iterate over services by id
      const services = Object.keys(servicesMetadata).map(key => {
        // get metadata obj
        return this.service(key)
          .map(serviceString => {
            const serviceObj = JSON.parse(serviceString);
            // remove 00 from organization fiscal code
            return serviceObj.organization_fiscal_code &&
              serviceObj.organization_fiscal_code.startsWith("00")
              ? serviceObj.organization_fiscal_code.slice(2)
              : serviceObj.organization_fiscal_code;
          })
          .chain(organizationCode =>
            this.fallBackOrganizationLogo(key, organizationCode).map(result => {
              return {
                serviceId: key,
                organization: organizationCode,
                results: result.filter(Boolean)
              };
            })
          )
          .chain(res => this.putLogo(res.serviceId, res.results[0]));
      });
      return array.sequence(taskEither)(services);
    });
}
