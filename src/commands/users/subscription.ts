import Command, { flags } from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { toError } from "fp-ts/lib/Either";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import fetch from "node-fetch";

export class UserSubscriptionCreate extends Command {
  public static description =
    "Create a Subscription identified by the provided subscription id for the User identified by the provided email";

  // tslint:disable-next-line: readonly-array
  public static args: Parser.args.IArg[] = [
    {
      description: "email",
      name: "email",
      required: true
    },
    {
      description: "The id of the Subscription",
      name: "subscriptionId",
      required: true
    }
  ];

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops users:subscription  example@example.com SUBSCRIPTIONID`,
    `$ io-ops users:subscription  example@example.com SUBSCRIPTIONID --product_name=PRODUCTNAME`
  ];

  public static flags = {
    product_name: flags.string({
      description: "The name of the product",
      required: false
    })
  };

  public async run(): Promise<void> {
    // tslint:disable-next-line: no-shadowed-variable
    const { args, flags: commandLineFlags } = this.parse(
      UserSubscriptionCreate
    );

    cli.action.start(
      chalk.blue.bold(`Creating subscription for user: ${args.email}]`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );

    return this.put(
      args.email,
      args.subscriptionId,
      commandLineFlags.product_name
    )
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
    email: string,
    subscriptionId: readonly string[],
    productName?: string
  ): TaskEither<Error, string> => {
    const product = productName ? { product_name: productName } : {};
    const options = {
      ...{
        headers: {
          "Ocp-Apim-Subscription-Key": getRequiredStringEnv("OCP_APIM")
        },
        method: "put"
      },
      ...product
    };

    return tryCatch(
      () =>
        fetch(
          `${getRequiredStringEnv(
            "BASE_URL_ADMIN"
          )}/users/${email}/subscriptions/${subscriptionId}`,
          options
        ).then(res => res.text()),
      toError
    );
  };
}
