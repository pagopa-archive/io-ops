import Command, { flags } from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import { Either } from "fp-ts/lib/Either";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/api";
import { UserCreated } from "../../generated/UserCreated";
import { UserPayload } from "../../generated/UserPayload";
import { errorsToError } from "../../utils/conversions";

export class UserCreate extends Command {
  public static description =
    "Create a new user with a random password in the Active Directory Azure B2C, then create a corresponding user on the API management resource.";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops api-service:create  --json='{ "email": "foobar@example.com","first_name": "string","last_name": "string"}'`
  ];

  public static flags = {
    json: flags.string({
      description: "JSON string rapresentation of a user",
      required: true,
      parse: input => JSON.parse(input)
    })
  };

  public async run(): Promise<void> {
    const { flags: commandLineFlags } = this.parse(UserCreate);

    cli.action.start(
      chalk.blue.bold(`Creating a service`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );

    const errorOrUser: Either<Error, UserPayload> = UserPayload.decode(
      JSON.parse(commandLineFlags.json)
    ).mapLeft(errorsToError);

    return fromEither(errorOrUser)
      .chain(this.post)
      .fold(
        error => cli.action.stop(chalk.red(`Error : ${error}`)),
        user =>
          cli.action.stop(chalk.green(`Response: ${JSON.stringify(user)}`))
      )
      .run();
  }

  private getApiClient = () =>
    ApiClient(
      getRequiredStringEnv("BASE_URL_ADMIN"),
      getRequiredStringEnv("OCP_APIM")
    );

  private post = (user: UserPayload): TaskEither<Error, UserCreated> =>
    new TaskEither(
      new Task(() => this.getApiClient().createUser({ userPayload: user }))
    )
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 201,
          () => Error("Could not create user")
        )
      )
      .chain(response =>
        fromEither(UserCreated.decode(response.value)).mapLeft(errorsToError)
      );
}
