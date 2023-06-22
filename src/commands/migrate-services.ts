import { Command, Args } from "@oclif/core";
import chalk from "chalk";
import cli from "cli-ux";
import * as AR from "fp-ts/lib/Array";
import * as A from "fp-ts/lib/Applicative";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";

import { BlobService, createBlobService } from "azure-storage";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { safeLoad } from "js-yaml";
import fetch from "node-fetch";
import { ApiClient } from "../clients/admin";
import { FallbackLogo } from "../definitions/logos";
import { Service } from "../generated/Service";
import { errorsToError } from "../utils/conversions";
import { flow, pipe } from "fp-ts/lib/function";

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
    "$ io-ops migrate logo",
  ];

  // tslint:disable-next-line: readonly-array
  public static args = {
    metadata: Args.string({
      name: "metadata",
      required: true,
      description: "Migrate metadata or logo from github",
      options: ["metadata", "logo"],
    }),
  };

  public static ocpHeader = "Ocp-Apim-Subscription-Key";

  // Run the command
  public async run(): Promise<void> {
    const { args } = await this.parse(Migrate);
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Migrating data from github`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true,
      }
    );

    if (args.metadata === "metadata") {
      // Migrate metadata
      return pipe(
        this.migrateMetadata(),
        TE.bimap(
          (error) => {
            cli.action.stop(chalk.red(`Error : ${error}`));
          },
          () => {
            cli.action.stop(chalk.green(`Services Updated`));
          }
        ),
        TE.toUnion
      )();
    } else {
      // Migrate logo
      return pipe(
        this.migrateLogo(),
        TE.bimap(
          (error) => {
            cli.action.stop(chalk.red(`Error : ${error}`));
          },
          () => {
            cli.action.stop(chalk.green(`Logos Updated`));
          }
        ),
        TE.toUnion
      )();
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
  private update = (service: Service): TE.TaskEither<Error, Service> =>
    pipe(
      TE.tryCatch(
        () =>
          this.getApiClient().updateService({
            body: service,
            service_id: service.service_id,
          }),
        E.toError
      ),
      TE.chain(flow(E.mapLeft(errorsToError), TE.fromEither)),
      TE.chain(
        TE.fromPredicate(
          (response) => response.status === 200,
          () => Error(`Could not update service ${service.service_id}`)
        )
      ),
      TE.map((response) => response.value),
      TE.chain(flow(Service.decode, E.mapLeft(errorsToError), TE.fromEither))
    );

  // Get service data
  private service = (serviceId: string): TE.TaskEither<Error, Service> =>
    pipe(
      TE.tryCatch(
        () => this.getApiClient().getService({ service_id: serviceId }),
        E.toError
      ),
      TE.chain(flow(E.mapLeft(errorsToError), TE.fromEither)),
      TE.chain(
        TE.fromPredicate(
          (response) => response.status === 200,
          () => Error(`Could not read service ${serviceId}`)
        )
      ),
      TE.map((response) => response.value),
      TE.chain(flow(Service.decode, E.mapLeft(errorsToError), TE.fromEither))
    );

  // Conver yaml to object
  private readServiceYaml = (yamlString: string) => safeLoad(yamlString);

  // Get all services metadata from github
  private githubServicesData = () =>
    TE.tryCatch(
      () =>
        fetch(
          `https://raw.githubusercontent.com/pagopa/io-services-metadata/master/services.yml`
        ).then((res) => res.text()),
      E.toError
    );

  // Download png form url and convert to base64
  private serviceLogo = (url: string, Id: string) =>
    TE.tryCatch(
      () =>
        fetch(`${url}/${Id}.png`)
          .then((res) => {
            if (res.ok) {
              return res.buffer();
            } else {
              throw new Error("404");
            }
          })
          .then((buf) => {
            return buf.toString("base64");
          })
          .catch(() => {
            return "";
          }),
      E.toError
    );

  // Download logo for service and fallback to organization if
  // service logo not exists
  private fallBackOrganizationLogo = (id: string, orgId: string) =>
    AR.sequence(TE.ApplicativeSeq)([
      pipe(
        this.serviceLogo(
          "https://raw.githubusercontent.com/pagopa/io-services-metadata/master/logos/services",
          id
        ),
        TE.map((logo) =>
          FallbackLogo.encode({
            logo,
            type: "service",
          })
        )
      ),
      pipe(
        this.serviceLogo(
          "https://raw.githubusercontent.com/pagopa/io-services-metadata/master/logos/organizations",
          orgId
        ),
        TE.map((logo) =>
          FallbackLogo.encode({
            logo,
            type: "org",
          })
        )
      ),
    ]);

  // Update logo and associate to service
  private putLogo = (serviceId: string, base64Logo: NonEmptyString) =>
    pipe(
      TE.tryCatch(
        () =>
          this.getApiClient().uploadServiceLogo({
            body: { logo: base64Logo },
            service_id: serviceId,
          }),
        E.toError
      ),
      TE.chain(flow(E.mapLeft(errorsToError), TE.fromEither)),
      TE.chain(
        TE.fromPredicate(
          (response) => response.status === 201,
          () => {
            cli.log(chalk.red(`Could not update logo for: ${serviceId}`));
            return Error(`Could not update logo for: ${serviceId}`);
          }
        )
      ),
      TE.map(() =>
        cli.log(chalk.green(`Updated logo for service: ${serviceId}`))
      )
    );

  // Update logo and associate to service
  private putOrganizationLogo = (
    blobService: BlobService,
    containerName: string,
    organizationCode: string,
    base64Logo: Buffer
  ): TE.TaskEither<Error, void> =>
    pipe(
      TE.taskify<Error, BlobService.BlobResult>((cb) =>
        blobService.createBlockBlobFromText(
          containerName,
          organizationCode,
          base64Logo,
          cb
        )
      )(),
      TE.map(() =>
        cli.log(
          chalk.green(`Updated logo for organizationCode: ${organizationCode}`)
        )
      )
    );

  private migrateMetadata = () =>
    // Getting the services metadata from github
    pipe(
      this.githubServicesData(),
      TE.chain((servicesMetadataString) => {
        // Read the yaml https://raw.githubusercontent.com/pagopa/io-services-metadata/master/services.yml
        // where keys of yaml are service id
        const servicesMetadata = this.readServiceYaml(servicesMetadataString);
        // Iterate over services by id
        const services = Object.keys(servicesMetadata).map((key) => {
          // get metadata obj
          const metadata = servicesMetadata[key];
          // Update service with metadata by calling the API
          return pipe(
            this.service(key),
            TE.map((serviceObj) => {
              return {
                ...serviceObj,
                ...{ service_metadata: metadata },
              };
            }),
            TE.chain((serviceObj) => {
              cli.log(
                chalk.green(`Updated metadata: ${serviceObj.service_id}`)
              );
              return this.update(serviceObj);
            })
          );
        });
        return AR.sequence(TE.ApplicativeSeq)(services);
      })
    );

  private migrateLogo = () =>
    // Getting the services metadata from github
    pipe(
      this.githubServicesData(),
      TE.chain((servicesMetadataString) => {
        // Read the yaml https://raw.githubusercontent.com/pagopa/io-services-metadata/master/services.yml
        // where keys of yaml are service id
        const servicesMetadata = this.readServiceYaml(servicesMetadataString);
        // Iterate over services by id
        const services = Object.keys(servicesMetadata).map((key) => {
          // get metadata obj
          return pipe(
            this.service(key),
            TE.map((serviceObj) =>
              // remove leading zeros from organization fiscal code
              serviceObj.organization_fiscal_code.replace(/^0+/, "")
            ),
            TE.chain((organizationCode) =>
              pipe(
                this.fallBackOrganizationLogo(key, organizationCode),
                TE.map((result) => {
                  return {
                    serviceId: key,
                    organization: organizationCode,
                    results: result.reduce<ReadonlyArray<FallbackLogo>>(
                      (prevs, fallbackLogo) =>
                        NonEmptyString.is(fallbackLogo.logo)
                          ? [...prevs, fallbackLogo]
                          : prevs,
                      []
                    ),
                  };
                })
              )
            ),
            TE.chain((res) =>
              AR.sequence(TE.ApplicativeSeq)(
                res.results.map((result) => {
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
                  return TE.of<Error, void>(
                    // tslint:disable-next-line: no-use-of-empty-return-value
                    cli.log(
                      chalk.green(
                        `Nothing to do on logos for service: ${res.serviceId}`
                      )
                    )
                  );
                })
              )
            )
          );
        });
        return AR.sequence(TE.ApplicativePar)(services);
      })
    );
}
