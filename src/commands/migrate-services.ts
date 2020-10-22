import Command from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import { array } from "fp-ts/lib/Array";
import { toError } from "fp-ts/lib/Either";
import { Task } from "fp-ts/lib/Task";
import {
  fromEither,
  fromPredicate,
  TaskEither,
  taskEither,
  taskEitherSeq,
  taskify,
  tryCatch
} from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";

import { BlobService, createBlobService } from "azure-storage";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { safeLoad } from "js-yaml";
import fetch from "node-fetch";
import { ApiClient } from "../clients/admin";
import { FallbackLogo } from "../definitions/logos";
import { Service } from "../generated/Service";
import { errorsToError } from "../utils/conversions";

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
          () => {
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
          () => {
            cli.action.stop(chalk.green(`Logos Updated`));
          }
        )
        .run();
    }
  }

  private getApiClient = () =>
    ApiClient(
      getRequiredStringEnv("BASE_URL_ADMIN"),
      getRequiredStringEnv("OCP_APIM")
    );

  private getBlobService = () =>
    createBlobService(getRequiredStringEnv("AssetsStorageConnection"));

  // Update service
  private update = (service: Service): TaskEither<Error, Service> => {
    return new TaskEither(
      new Task(() =>
        this.getApiClient().updateService({
          service,
          service_id: service.service_id
        })
      )
    )
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error(`Could not update service ${service.service_id}`)
        )
      )
      .chain(response =>
        fromEither(Service.decode(response.value)).mapLeft(errorsToError)
      );
  };

  // Get service data
  private service = (serviceId: string): TaskEither<Error, Service> => {
    return new TaskEither(
      new Task(() => this.getApiClient().getService({ service_id: serviceId }))
    )
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error(`Could not read service ${serviceId}`)
        )
      )
      .chain(response =>
        // The usage of `.map(response => response.value);` raised a TS error
        // because response.value can be undefined
        fromEither(Service.decode(response.value)).mapLeft(errorsToError)
      );
  };

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
          .catch(() => {
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
      ).map(logo =>
        FallbackLogo.encode({
          logo,
          type: "service"
        })
      ),
      this.serviceLogo(
        "https://raw.githubusercontent.com/pagopa/io-services-metadata/master/logos/organizations",
        orgId
      ).map(logo =>
        FallbackLogo.encode({
          logo,
          type: "org"
        })
      )
    ]);

  // Update logo and associate to service
  private putLogo = (serviceId: string, base64Logo: NonEmptyString) => {
    return new TaskEither(
      new Task(() =>
        this.getApiClient().uploadServiceLogo({
          logo: { logo: base64Logo },
          service_id: serviceId
        })
      )
    )
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 201,
          () => {
            cli.log(chalk.red(`Could not update logo for: ${serviceId}`));
            return Error(`Could not update logo for: ${serviceId}`);
          }
        )
      )
      .map(() =>
        cli.log(chalk.green(`Updated logo for service: ${serviceId}`))
      );
  };

  // Update logo and associate to service
  private putOrganizationLogo = (
    blobService: BlobService,
    containerName: string,
    organizationCode: string,
    base64Logo: Buffer
  ): TaskEither<Error, void> =>
    taskify<Error, BlobService.BlobResult>(cb =>
      blobService.createBlockBlobFromText(
        containerName,
        organizationCode,
        base64Logo,
        cb
      )
    )().map(() =>
      cli.log(
        chalk.green(`Updated logo for organizationCode: ${organizationCode}`)
      )
    );

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
          .map(serviceObj => {
            return {
              ...serviceObj,
              ...{ service_metadata: metadata }
            };
          })
          .chain(serviceObj => {
            cli.log(chalk.green(`Updated metadata: ${serviceObj.service_id}`));
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
          .map(serviceObj =>
            // remove leading zeros from organization fiscal code
            serviceObj.organization_fiscal_code.replace(/^0+/, "")
          )
          .chain(organizationCode =>
            this.fallBackOrganizationLogo(key, organizationCode).map(result => {
              return {
                serviceId: key,
                organization: organizationCode,
                results: result.reduce<ReadonlyArray<FallbackLogo>>(
                  (prevs, fallbackLogo) =>
                    NonEmptyString.is(fallbackLogo.logo)
                      ? [...prevs, fallbackLogo]
                      : prevs,
                  []
                )
              };
            })
          )
          .chain(res =>
            array.sequence(taskEitherSeq)(
              res.results.map(result => {
                if (NonEmptyString.is(result.logo)) {
                  return result.type === "service"
                    ? this.putLogo(res.serviceId, result.logo)
                    : this.putOrganizationLogo(
                        this.getBlobService(),
                        "services",
                        `${res.organization}.png`,
                        Buffer.from(result.logo, "base64")
                      );
                }
                return taskEither.of<Error, void>(
                  // tslint:disable-next-line: no-use-of-empty-return-value
                  cli.log(
                    chalk.green(
                      `Nothing to do on logos for service: ${res.serviceId}`
                    )
                  )
                );
              })
            )
          );
      });
      return array.sequence(taskEither)(services);
    });
}
