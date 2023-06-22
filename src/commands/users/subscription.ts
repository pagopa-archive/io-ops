import { Command, Flags, Args } from "@oclif/core";
import chalk from "chalk";
import cli from "cli-ux";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { ApiClient } from "../../clients/admin";
import { Subscription } from "../../generated/Subscription";
import { errorsToError } from "../../utils/conversions";
import { flow, pipe } from "fp-ts/lib/function";

export class UserSubscriptionCreate extends Command {
  public static description =
    "Create a Subscription identified by the provided subscription id for the User identified by the provided email";

  // tslint:disable-next-line: readonly-array
  public static args = {
    email: Args.string({
      description: "email",
      name: "email",
      required: true,
    }),
    subscriptionId: Args.string({
      description: "The id of the Subscription",
      name: "subscriptionId",
      required: true,
    }),
  };

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops users:subscription  example@example.com SUBSCRIPTIONID --product_name=PRODUCTNAME`,
  ];

  public static flags = {
    product_name: Flags.string({
      description: "The name of the product",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    // tslint:disable-next-line: no-shadowed-variable
    const { args, flags } = await this.parse(UserSubscriptionCreate);

    cli.action.start(
      chalk.blue.bold(`Creating subscription for user: ${args.email}]`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true,
      }
    );

    return pipe(
      flags.product_name,
      NonEmptyString.decode,
      E.mapLeft((errors) => {
        const error = errorsToError(errors);
        cli.action.stop(chalk.red(`Error : ${error}`));
        return error;
      }),
      TE.fromEither,
      TE.chain((productName) =>
        this.put(args.email, args.subscriptionId, productName)
      ),
      TE.bimap(
        (error) => {
          cli.action.stop(chalk.red(`Error : ${error}`));
        },
        (result) => {
          cli.action.stop(chalk.green(`Response: ${JSON.stringify(result)}`));
        }
      ),
      TE.toUnion
    )();
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
  ): TE.TaskEither<Error, Subscription> =>
    pipe(
      TE.tryCatch(
        () =>
          this.getApiClient().createSubscription({
            email,
            subscription_id: subscriptionId,
            body: { product_name: productName },
          }),
        E.toError
      ),
      TE.chain(flow(E.mapLeft(errorsToError), TE.fromEither)),
      TE.chain(
        TE.fromPredicate(
          (response) => response.status === 200,
          () => Error(`Could not create the subscription ${subscriptionId}`)
        )
      ),
      TE.map((response) => response.value),
      TE.chain(
        flow(Subscription.decode, E.mapLeft(errorsToError), TE.fromEither)
      )
    );
}
