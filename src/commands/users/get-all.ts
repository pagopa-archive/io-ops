import Command, { flags } from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { toError } from "fp-ts/lib/Either";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import fetch from "node-fetch";

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
          cli.action.stop(chalk.green(`Response: ${result}`));
        }
      )
      .run();
  }

  private get = (cursor?: number): TaskEither<Error, string> => {
    const queryParam = cursor ? `?cursor=${cursor}` : "";
    return tryCatch(
      () =>
        fetch(`${getRequiredStringEnv("BASE_URL_ADMIN")}/users${queryParam}`, {
          headers: {
            "Ocp-Apim-Subscription-Key": getRequiredStringEnv("OCP_APIM")
          }
        }).then(res => res.text()),
      toError
    );
  };
}
