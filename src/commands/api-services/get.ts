import Command from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { Service } from "../../generated/admin/Service";
import { errorsToError } from "../../utils/conversions";

export class ServiceGet extends Command {
  public static description = "Get the service by serviceId";

  // tslint:disable-next-line: readonly-array
  public static examples = [`$ io-ops api-service:get  SERVICEID`];

  // tslint:disable-next-line: readonly-array
  public static args: Parser.args.IArg[] = [
    {
      description: "id of the service",
      name: "serviceId",
      required: true
    }
  ];

  public async run(): Promise<void> {
    // can get args as an object
    const { args } = this.parse(ServiceGet);
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Getting info for service ${args.serviceId}`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );
    return this.get(args.serviceId)
      .fold(
        error => {
          cli.action.stop(chalk.red(`Error : ${error}`));
        },
        result => {
          cli.action.stop(chalk.green(`Response: ${JSON.stringify(result)}`));
        }
      )
      .run();
  }

  private getApiClient = () =>
    ApiClient(
      getRequiredStringEnv("BASE_URL_ADMIN"),
      getRequiredStringEnv("OCP_APIM")
    );

  private get = (serviceId: string): TaskEither<Error, Service> => {
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
        fromEither(Service.decode(response.value)).mapLeft(errorsToError)
      );
  };
}
