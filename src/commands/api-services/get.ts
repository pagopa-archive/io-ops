import Command from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { toError } from "fp-ts/lib/Either";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import fetch from "node-fetch";

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
          cli.action.stop(chalk.green(`Response: ${result}`));
        }
      )
      .run();
  }

  private get = (serviceId: string): TaskEither<Error, string> => {
    return tryCatch(
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
  };
}
