import Command from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { toError } from "fp-ts/lib/Either";
import {
  fromEither,
  fromLeft,
  taskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { errorsToError } from "../../utils/conversions";

export class UserTokenNameUpdate extends Command {
  public static description =
    "Update the Token Name attribute associated to the User identified by the provided email";

  // tslint:disable-next-line: readonly-array
  public static args: Parser.args.IArg[] = [
    {
      description: "email",
      name: "email",
      required: true
    },
    {
      description: "tokenNameValue",
      name: "tokenNameValue",
      required: true
    }
  ];

  // tslint:disable-next-line: readonly-array
  public static examples = [`$ io-ops users:update-token-name`];

  public static flags = {};

  public async run(): Promise<void> {
    // tslint:disable-next-line: no-shadowed-variable
    const { args } = this.parse(UserTokenNameUpdate);

    cli.action.start(
      chalk.blue.bold(
        `Updating a token name for: ${args.email} setting it to ${args.tokenNameValue}`
      ),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );

    return tryCatch(
      () =>
        this.getApiClient().updateUser({
          email: args.email,
          userUpdatePayload: {
            token_name: args.tokenNameValue
          }
        }),
      toError
    )
      .chain(_ => fromEither(_).mapLeft(errorsToError))
      .chain(response =>
        response.status === 200
          ? taskEither.of(response.value)
          : fromLeft(new Error(response.value))
      )
      .fold(
        error => {
          cli.action.stop(chalk.red(`Error : ${error}`));
        },
        () => {
          cli.action.stop(chalk.green(`Token Name Updated`));
        }
      )
      .run();
  }

  private getApiClient = () =>
    ApiClient(
      getRequiredStringEnv("BASE_URL_ADMIN"),
      getRequiredStringEnv("OCP_APIM")
    );
}
