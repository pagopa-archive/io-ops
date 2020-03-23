import Command from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { ServiceCollection } from "../../generated/admin/ServiceCollection";
import { errorsToError } from "../../utils/conversions";

export class ServiceGet extends Command {
  public static description = "Get all services";

  // tslint:disable-next-line: readonly-array
  public static examples = ["$ io-ops api-service:get-all"];

  public async run(): Promise<void> {
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Getting all services`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );
    return this.get()
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

  private get = (): TaskEither<Error, ServiceCollection> =>
    new TaskEither(new Task(() => this.getApiClient().getServices({})))
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error("Could not read the services")
        )
      )
      .chain(response =>
        fromEither(ServiceCollection.decode(response.value)).mapLeft(
          errorsToError
        )
      );
}
