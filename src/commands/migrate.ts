import Command from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import { array } from "fp-ts/lib/Array";
import { toError } from "fp-ts/lib/Either";
import { TaskEither, taskEither, tryCatch } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { safeLoad } from "js-yaml";
import fetch from "node-fetch";
import { Service } from "../generated/Service";

export class Migrate extends Command {
  public static description = "Migrate data from github";

  public async run(): Promise<void> {
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Migrate data from github`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );
    return this.migrate()
      .fold(
        error => {
          cli.action.stop(chalk.red(`Error : ${error}`));
        },
        result => {
          cli.action.stop(chalk.green(`Services Updated`));
        }
      )
      .run();
  }
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
              "Ocp-Apim-Subscription-Key": getRequiredStringEnv("OCP_APIM")
            },
            method: "put"
          }
        ).then(res => res.text()),
      toError
    );
  };

  private service = (serviceId: string): TaskEither<Error, string> =>
    tryCatch(
      () =>
        fetch(
          `${getRequiredStringEnv("BASE_URL_ADMIN")}/services/${serviceId}`,
          {
            headers: {
              "Ocp-Apim-Subscription-Key": getRequiredStringEnv("OCP_APIM")
            }
          }
        ).then(res => res.text()),
      toError
    );

  private migrate = () =>
    this.githubServicesData().chain(servicesMetadataString => {
      const servicesMetadata = this.readServiceYaml(servicesMetadataString);
      const services = Object.keys(servicesMetadata).map(key => {
        const metadata = servicesMetadata[key];
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
              cli.log(chalk.green(`Updated ${serviceObj.service_id}`));
            } else {
              cli.log(chalk.red(`Not found ${key}`));
            }
            return this.update(serviceObj);
          });
      });
      return array.sequence(taskEither)(services);
    });

  private readServiceYaml = (yamlString: string) => safeLoad(yamlString);

  private githubServicesData = () =>
    tryCatch(
      () =>
        fetch(
          `https://raw.githubusercontent.com/pagopa/io-services-metadata/master/services.yml`
        ).then(res => res.text()),
      toError
    );
}
