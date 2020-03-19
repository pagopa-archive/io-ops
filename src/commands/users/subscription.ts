import Command, { flags } from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { ApiClient } from "../../clients/api";
import { Subscription } from "../../generated/Subscription";
import { errorsToError } from "../../utils/conversions";

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
    `$ io-ops users:subscription  example@example.com SUBSCRIPTIONID --product_name=PRODUCTNAME`
  ];

  public static flags = {
    product_name: flags.string({
      description: "The name of the product",
      required: true
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

    return fromEither(
      NonEmptyString.decode(commandLineFlags.product_name).mapLeft(errors => {
        const error = errorsToError(errors);
        cli.action.stop(chalk.red(`Error : ${error}`));
        return error;
      })
    )
      .chain(productName =>
        this.put(args.email, args.subscriptionId, productName)
      )
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

  private put = (
    email: string,
    subscriptionId: string,
    productName: NonEmptyString
  ): TaskEither<Error, Subscription> =>
    new TaskEither(
      new Task(() =>
        this.getApiClient().createSubscription({
          email,
          subscription_id: subscriptionId,
          productNamePayload: { product_name: productName }
        })
      )
    )
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error(`Could not create the subscription ${subscriptionId}`)
        )
      )
      .chain(response =>
        fromEither(Subscription.decode(response.value)).mapLeft(errorsToError)
      );
}
