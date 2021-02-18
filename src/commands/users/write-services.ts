import * as dotenv from "dotenv";
import Command from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
import { ApiClient } from "../../clients/admin";
import { EmailAddress } from "../../generated/EmailAddress";
import { UserInfo } from "../../generated/UserInfo";
import { GroupCollection } from "../../generated/GroupCollection";
import { errorsToError } from "../../utils/conversions";

dotenv.config();

const BASE_URL_ADMIN = process.env.BASE_URL_ADMIN || "";
const OCP_APIM = process.env.OCP_APIM || "";

enum Action {
  enable = "enable",
  disable = "disable"
}

export class WriteServices extends Command {
  public static description =
    "Update the list of groups (permissions) associated to the User identified by the provided email";

  // tslint:disable-next-line: readonly-array
  public static args: Parser.args.IArg[] = [
    {
      description: "email",
      name: "email",
      required: true
    },
    {
      description: "action",
      name: "action",
      required: true
    }
  ];

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops users:write-services example@example.it enable`
  ];

  public async run(): Promise<void> {
    // tslint:disable-next-line: no-shadowed-variable
    const { args } = this.parse(WriteServices);

    const mayBeAction: Action | undefined = (<any>Action)[args.action];
    if (mayBeAction === undefined) {
      this.error(`Error : action arg must be enable or disable`);
    }

    cli.action.start(
      chalk.blue.bold(
        `Updating a list of groups (permission) for user: ${args.email}`
      ),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );

    return this.get(args.email)
      .fold(
        error => {
          cli.action.stop(chalk.red(`Error : ${error}`));
        },
        result => {
          if (result.groups != undefined) {
            let groupsPermission = result.groups
              .map(x => x.display_name)
              .filter(x => x != "ApiServiceRead")
              .filter(x => x != "ApiServiceWrite") as string[];
            if (args.action == "enable") {
              //enable
              groupsPermission = groupsPermission.concat(
                "ApiServiceRead",
                "ApiServiceWrite"
              );
            }

            this.put(args.email, groupsPermission)
              .fold(
                error => {
                  cli.action.stop(chalk.red(`Error : ${error}`));
                },
                result => {
                  cli.action.stop(chalk.green(`Response: ${args.action}`));
                }
              )
              .run();
          }
        }
      )
      .run();
  }

  private getApiClient = () => ApiClient(BASE_URL_ADMIN, OCP_APIM);

  private get = (email: EmailAddress): TaskEither<Error, UserInfo> =>
    new TaskEither(new Task(() => this.getApiClient().getUser({ email })))
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error(`Could not read user ${email}`)
        )
      )
      .chain(response =>
        fromEither(UserInfo.decode(response.value)).mapLeft(errorsToError)
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
