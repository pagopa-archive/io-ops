import Command, { flags } from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { GroupCollection } from "../../generated/GroupCollection";
import { errorsToError } from "../../utils/conversions";

export class UserGroupUpdate extends Command {
  public static description =
    "Update the list of groups (permissions) associated to the User identified by the provided email";

  // tslint:disable-next-line: readonly-array
  public static args: Parser.args.IArg[] = [
    {
      description: "email",
      name: "email",
      required: true
    }
  ];

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops users:update-groups  --groups=ApiInfoRead,ApiLimitedMessageWrite,ApiMessageRead`
  ];

  public static flags = {
    groups: flags.string({
      description: "A comma separeted list of groups",
      required: true
    })
  };

  public async run(): Promise<void> {
    // tslint:disable-next-line: no-shadowed-variable
    const { args, flags: commandLineFlags } = this.parse(UserGroupUpdate);

    cli.action.start(
      chalk.blue.bold(
        `Updating a list of groups (permission) for user: ${args.email}`
      ),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );

    const groupsPermission = commandLineFlags.groups.split(",");

    return this.put(args.email, groupsPermission)
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
    groupsPermission: readonly string[]
  ): TaskEither<Error, GroupCollection> =>
    new TaskEither(
      new Task(() =>
        this.getApiClient().updateGroups({
          email,
          userGroupsPayload: { groups: groupsPermission }
        })
      )
    )
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error("Could not update groups")
        )
      )
      .chain(response =>
        fromEither(GroupCollection.decode(response.value)).mapLeft(
          errorsToError
        )
      );
}
