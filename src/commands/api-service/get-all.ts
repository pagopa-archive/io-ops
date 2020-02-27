import Command from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import fetch from "node-fetch";

export class ServiceGet extends Command {
  public static description = "Get all services";

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
          cli.action.stop(chalk.green(`Response: ${result}`));
        }
      )
      .run();
  }

  private get = (): TaskEither<Error, string> => {
    return tryCatch(
      () =>
        fetch(`${getRequiredStringEnv("BASE_URL_ADMIN")}/services`, {
          headers: {
            "Ocp-Apim-Subscription-Key": getRequiredStringEnv("OCP_APIM")
          }
        }).then(res => res.text()),
      reason => new Error(String(reason))
    );
  };
}
