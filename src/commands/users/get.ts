import Command from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { toError } from "fp-ts/lib/Either";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import fetch from "node-fetch";

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
          cli.action.stop(chalk.green(`Response: ${result}`));
        }
      )
      .run();
  }

  private get = (email: string): TaskEither<Error, string> => {
    return tryCatch(
      () =>
        fetch(`${getRequiredStringEnv("BASE_URL_ADMIN")}/users/${email}`, {
          headers: {
            "Ocp-Apim-Subscription-Key": getRequiredStringEnv("OCP_APIM")
          }
        }).then(res => res.text()),
      toError
    );
  };
}
