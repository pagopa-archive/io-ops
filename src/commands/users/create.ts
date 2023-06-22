import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import cli from "cli-ux";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { UserCreated } from "../../generated/UserCreated";
import { UserPayload } from "../../generated/UserPayload";
import { errorsToError } from "../../utils/conversions";
import { flow, pipe } from "fp-ts/lib/function";

export class UserCreate extends Command {
  public static description =
    "Create a new user with a random password in the Active Directory Azure B2C, then create a corresponding user on the API management resource.";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops api-service:create  --json='{ "email": "foobar@example.com","first_name": "string","last_name": "string"}'`,
  ];

  public static flags = {
    payload: Flags.string({
      description: "JSON string rapresentation of a user",
      required: true,
      parse: (input) => JSON.parse(input),
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(UserCreate);

    cli.action.start(
      chalk.blue.bold(`Creating a service`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true,
      }
    );

    return pipe(
      flags.json,
      UserPayload.decode,
      E.mapLeft(errorsToError),
      TE.fromEither,
      TE.chain(this.post),
      TE.bimap(
        (error) => cli.action.stop(chalk.red(`Error : ${error}`)),
        (user) =>
          cli.action.stop(chalk.green(`Response: ${JSON.stringify(user)}`))
      ),
      TE.toUnion
    )();
  }

  private getApiClient = () =>
    ApiClient(
      getRequiredStringEnv("BASE_URL_ADMIN"),
      getRequiredStringEnv("OCP_APIM")
    );

  private post = (user: UserPayload): TE.TaskEither<Error, UserCreated> =>
    pipe(
      TE.tryCatch(
        () => this.getApiClient().createUser({ body: user }),
        E.toError
      ),
      TE.chain(flow(E.mapLeft(errorsToError), TE.fromEither)),
      TE.chain(
        TE.fromPredicate(
          (response) => response.status === 200,
          () => Error("Could not create user")
        )
      ),
      TE.map((response) => response.value),
      TE.chain(
        flow(UserCreated.decode, E.mapLeft(errorsToError), TE.fromEither)
      )
    );
}
