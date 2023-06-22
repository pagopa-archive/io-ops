import { Command, Args } from "@oclif/core";
import chalk from "chalk";
import cli from "cli-ux";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { EmailAddress } from "../../generated/EmailAddress";
import { UserInfo } from "../../generated/UserInfo";
import { errorsToError } from "../../utils/conversions";
import { flow, pipe } from "fp-ts/lib/function";

export class UserGet extends Command {
  public static description =
    "Gets the user information, that is the complete list of subscription and the complete list of groups for the User identified by the provided email";

  // tslint:disable-next-line: readonly-array
  public static examples = ["$ io-ops users:get example@example.it"];

  // tslint:disable-next-line: readonly-array
  public static args = {
    email: Args.string({
      description: "email",
      name: "email",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(UserGet);
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Getting user by ${args.email}`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true,
      }
    );
    return pipe(
      args.email,
      EmailAddress.decode,
      E.mapLeft(errorsToError),
      TE.fromEither,
      TE.chain((email) => this.get(email)),
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

  private get = (email: EmailAddress): TE.TaskEither<Error, UserInfo> =>
    pipe(
      TE.tryCatch(() => this.getApiClient().getUser({ email }), E.toError),
      TE.chain(flow(E.mapLeft(errorsToError), TE.fromEither)),
      TE.chain(
        TE.fromPredicate(
          (response) => response.status === 200,
          () => Error(`Could not read user ${email}`)
        )
      ),
      TE.map((response) => response.value),
      TE.chain(flow(UserInfo.decode, E.mapLeft(errorsToError), TE.fromEither))
    );
}
