import Command, { flags } from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import { Either, toError } from "fp-ts/lib/Either";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { Errors } from "io-ts";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import fetch from "node-fetch";
import { User } from "../../generated/User";

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

    const errorOrService: Either<Errors, User> = User.decode(
      JSON.parse(commandLineFlags.json)
    );

    // may be can be a better way without nesting
    // suggestions?
    errorOrService.fold(
      error =>
        cli.action.stop(
          chalk.red(`Error : ${errorsToReadableMessages(error)}`)
        ),
      service =>
        this.post(service)
          .fold(
            error => {
              cli.action.stop(chalk.red(`Error : ${error}`));
            },
            result => {
              cli.action.stop(chalk.green(`Response: ${result}`));
            }
          )
          .run()
    );
  }

  private post = (user: User): TaskEither<Error, string> =>
    tryCatch(
      () =>
        fetch(`${getRequiredStringEnv("BASE_URL_ADMIN")}/users`, {
          body: JSON.stringify(user),
          headers: {
            "Ocp-Apim-Subscription-Key": getRequiredStringEnv("OCP_APIM")
          },
          method: "post"
        }).then(res => res.text()),
      toError
    );
}
