import { GraphRbacManagementClient } from "@azure/graph";
import Command from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { toError } from "fp-ts/lib/Either";
import { fromNullable } from "fp-ts/lib/Option";
import { fromLeft, tryCatch } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { getGraphRbacManagementClient } from "../../utils/azure";

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

    const servicePrincipalCreds = {
      clientId: getRequiredStringEnv("SERVICE_PRINCIPAL_CLIENT_ID"),
      secret: getRequiredStringEnv("SERVICE_PRINCIPAL_SECRET"),
      tenantId: getRequiredStringEnv("SERVICE_PRINCIPAL_TENANT_ID")
    };

    return getGraphRbacManagementClient(servicePrincipalCreds)
      .chain(client =>
        this.getUserFromList(client, args.email).chain(user =>
          fromNullable(user.userPrincipalName).foldL(
            () =>
              fromLeft(
                new Error("Cannot read User Principal Name from given email")
              ),
            userPrincipalName =>
              this.updateUserTokenName(
                client,
                userPrincipalName,
                getRequiredStringEnv("ADB2C_TOKEN_ATTRIBUTE_NAME"),
                args.tokenNameValue
              )
          )
        )
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

  private getUserFromList = (
    client: GraphRbacManagementClient,
    email: string
  ) =>
    tryCatch(
      () =>
        client.users.list({
          filter: `signInNames/any(x:x/value eq '${email}')`
        }),
      toError
    ).map(userList => userList[0]);

  private updateUserTokenName = (
    client: GraphRbacManagementClient,
    userPrincipalName: string,
    adb2cTokenAttributeName: string,
    tokenValue: string
  ) =>
    tryCatch(
      () =>
        client.users.update(userPrincipalName, {
          [adb2cTokenAttributeName]: tokenValue
        }),
      toError
    ).map(response => response._response.status);
}
