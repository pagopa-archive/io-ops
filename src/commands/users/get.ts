import Command from "@oclif/command";
import * as Parser from "@oclif/parser";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import chalk from "chalk";
import cli from "cli-ux";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
import { ApiClient } from "../../clients/admin";
import { EmailAddress } from "../../generated/EmailAddress";
import { UserInfo } from "../../generated/UserInfo";
import { errorsToError } from "../../utils/conversions";

export class UserGet extends Command {
  public static description =
    "Gets the user information, that is the complete list of subscription and the complete list of groups for the User identified by the provided email";

  // tslint:disable-next-line: readonly-array
  public static examples = ["$ io-ops users:get example@example.it"];

  // tslint:disable-next-line: readonly-array
  public static args: Parser.args.IArg[] = [
    {
      description: "email",
      name: "email",
      required: true
    }
  ];

  public async run(): Promise<void> {
    const { args } = this.parse(UserGet);
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Getting user by ${args.email}`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );
    return this.get(args.email)
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

  private get = (email: EmailAddress): TaskEither<Error, UserInfo> =>
    new TaskEither(new Task(() => this.getApiClient().getUser({ email })))
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error(`Could not read user ${email}`)
        )
      )
      .chain(response =>
        fromEither(UserInfo.decode(response.value)).mapLeft(errorsToError)
      );
}
