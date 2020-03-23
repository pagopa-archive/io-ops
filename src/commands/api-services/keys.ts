import Command from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { SubscriptionKeys } from "../../generated/admin/SubscriptionKeys";
import { errorsToError } from "../../utils/conversions";

export class Keys extends Command {
  public static description = "Get subscription keys associated to service";

  // tslint:disable-next-line: readonly-array
  public static examples = [`$ io-ops api-service:keys SERVICEID`];

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
    const { args } = this.parse(Keys);
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Getting keys for service ${args.serviceId}`),
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

  private get = (serviceId: string): TaskEither<Error, SubscriptionKeys> =>
    new TaskEither(
      new Task(() =>
        this.getApiClient().getSubscriptionKeys({ service_id: serviceId })
      )
    )
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error("Could not read the service")
        )
      )
      .chain(response =>
        fromEither(SubscriptionKeys.decode(response.value)).mapLeft(
          errorsToError
        )
      );
}
