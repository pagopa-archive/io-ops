import Command, { flags } from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { toError } from "fp-ts/lib/Either";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import fetch from "node-fetch";

export class KeyRegenerate extends Command {
  public static description = "Regenerate keys associated to service";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops api-service:keys-regenerate  SERVICEID --key_type=PRIMARY_KEY`
  ];

  // tslint:disable-next-line: readonly-array
  public static args: Parser.args.IArg[] = [
    {
      description: "id of the service",
      name: "serviceId",
      required: true
    }
  ];

  public static flags = {
    key_type: flags.string({
      description: "JSON string rapresentation of a service",
      required: true,
      options: ["PRIMARY_KEY", "SECONDARY_KEY"]
    })
  };

  public async run(): Promise<void> {
    // can get args as an object
    const { args, flags: commandLineFlags } = this.parse(KeyRegenerate);
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Getting keys for service ${args.serviceId}`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );
    return this.put(args.serviceId, commandLineFlags.key_type)
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

  private put = (
    serviceId: string,
    keyType: string
  ): TaskEither<Error, string> => {
    return tryCatch(
      () =>
        fetch(
          `${getRequiredStringEnv(
            "BASE_URL_ADMIN"
          )}/services/${serviceId}/keys`,
          {
            body: JSON.stringify({ key_type: keyType }),
            headers: {
              "Ocp-Apim-Subscription-Key": getRequiredStringEnv("OCP_APIM")
            },
            method: "put"
          }
        ).then(res => res.text()),
      toError
    );
  };
}
