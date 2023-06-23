import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import cli from "cli-ux";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { UserCollection } from "../../generated/UserCollection";
import { errorsToError } from "../../utils/conversions";
import { flow, pipe } from "fp-ts/lib/function";

export class UsersGet extends Command {
  public static description =
    "Get users max 100 per call use cursor for iterating";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    "$ io-ops users:get-all",
    "$ io-ops users:get-all --cursor=100",
  ];

  public static flags = {
    cursor: Flags.integer({
      description: "Items to skip",
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(UsersGet);
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Getting users`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true,
      }
    );
    return pipe(
      this.get(flags.cursor),
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

  private get = (cursor: number = 0): TE.TaskEither<Error, UserCollection> =>
    pipe(
      TE.tryCatch(() => this.getApiClient().getUsers({ cursor }), E.toError),
      TE.chain(flow(E.mapLeft(errorsToError), TE.fromEither)),
      TE.chain(
        TE.fromPredicate(
          (response) => response.status === 200,
          () => Error("Could read users")
        )
      ),
      TE.map((res) => res.value),
      TE.chain(
        flow(UserCollection.decode, E.mapLeft(errorsToError), TE.fromEither)
      )
    );
}
