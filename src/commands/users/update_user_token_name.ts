import { Command, Args } from "@oclif/core";
import chalk from "chalk";
import cli from "cli-ux";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { errorsToError } from "../../utils/conversions";
import { flow, pipe } from "fp-ts/lib/function";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

export class UserTokenNameUpdate extends Command {
  public static description =
    "Update the Token Name attribute associated to the User identified by the provided email";

  // tslint:disable-next-line: readonly-array
  public static args = {
    email: Args.string({
      description: "email",
      name: "email",
      required: true,
    }),
    tokenNameValue: Args.string({
      description: "tokenNameValue",
      name: "tokenNameValue",
      required: true,
    }),
  };

  // tslint:disable-next-line: readonly-array
  public static examples = [`$ io-ops users:update-token-name`];

  public static flags = {};

  public async run(): Promise<void> {
    // tslint:disable-next-line: no-shadowed-variable
    const { args } = await this.parse(UserTokenNameUpdate);

    cli.action.start(
      chalk.blue.bold(
        `Updating a token name for: ${args.email} setting it to ${args.tokenNameValue}`
      ),
      chalk.blueBright.bold("Running"),
      {
        stdout: true,
      }
    );

    return pipe(
      args.tokenNameValue,
      NonEmptyString.decode,
      E.mapLeft(errorsToError),
      TE.fromEither,
      TE.chain((tokenNameValue) =>
        TE.tryCatch(
          () =>
            this.getApiClient().updateUser({
              email: args.email,
              body: {
                token_name: tokenNameValue,
              },
            }),
          E.toError
        )
      ),
      TE.chain(flow(E.mapLeft(errorsToError), TE.fromEither)),
      TE.chain(
        TE.fromPredicate(
          (response) => response.status === 200,
          () =>
            Error(`Could not update user token name with email ${args.email}`)
        )
      ),
      TE.bimap(
        (error) => {
          cli.action.stop(chalk.red(`Error : ${error}`));
        },
        () => {
          cli.action.stop(chalk.green(`Token Name Updated`));
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
}
