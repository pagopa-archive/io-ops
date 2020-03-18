import Command, { flags } from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/api";
import { UserCollection } from "../../generated/UserCollection";
import { errorsToError } from "../../utils/conversions";

export class UsersGet extends Command {
  public static description =
    "Get users max 100 per call use cursor for iterating";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    "$ io-ops users:get-all",
    "$ io-ops users:get-all --cursor=100"
  ];

  public static flags = {
    cursor: flags.integer({
      description: "Items to skip",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags: commandLineFlags } = this.parse(UsersGet);
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Getting users`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );
    return this.get(commandLineFlags.cursor)
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

  private get = (cursor?: number): TaskEither<Error, UserCollection> =>
    new TaskEither(new Task(() => this.getApiClient().getUsers({ cursor })))
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error("Could read users")
        )
      )
      .chain(response =>
        fromEither(UserCollection.decode(response.value)).mapLeft(errorsToError)
      );
}
