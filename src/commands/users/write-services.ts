import * as dotenv from "dotenv";
import { Command, Args } from "@oclif/core";
import chalk from "chalk";
import cli from "cli-ux";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as B from "fp-ts/lib/boolean";
import { ApiClient } from "../../clients/admin";
import { EmailAddress } from "../../generated/EmailAddress";
import { UserInfo } from "../../generated/UserInfo";
import { GroupCollection } from "../../generated/GroupCollection";
import { errorsToError } from "../../utils/conversions";
import { flow, pipe } from "fp-ts/lib/function";

dotenv.config();

const BASE_URL_ADMIN = process.env.BASE_URL_ADMIN || "";
const OCP_APIM = process.env.OCP_APIM || "";

enum Action {
  enable = "enable",
  disable = "disable",
}

export class WriteServices extends Command {
  public static description =
    "Update the list of groups (permissions) associated to the User identified by the provided email";

  // tslint:disable-next-line: readonly-array
  public static args = {
    email: Args.string({
      description: "email",
      name: "email",
      required: true,
    }),
    action: Args.string({
      description: "action",
      name: "action",
      required: true,
    }),
  };

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops users:write-services example@example.it enable`,
  ];

  public async run(): Promise<void> {
    // tslint:disable-next-line: no-shadowed-variable
    const { args } = await this.parse(WriteServices);

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
        stdout: true,
      }
    );

    return pipe(
      args.email,
      EmailAddress.decode,
      E.mapLeft(errorsToError),
      TE.fromEither,
      TE.chain((email) => this.get(email)),
      TE.chain((result) =>
        pipe(
          result.groups,
          O.fromNullable,
          O.map(
            (groups) =>
              groups
                .map((x) => x.display_name)
                .filter((x) => x != "ApiMessageWrite")
                .filter((x) => x != "ApiLimitedMessageWrite") as string[]
          ),
          O.map((groupsPermission) =>
            pipe(
              args.action !== "enable",
              B.fold(
                () => groupsPermission.concat("ApiMessageWrite"),
                () => groupsPermission.concat("ApiLimitedMessageWrite")
              )
            )
          ),
          TE.fromOption(() => Error(`No User Groups found!`))
        )
      ),
      TE.chain((groupsPermission) => this.put(args.email, groupsPermission)),
      TE.bimap(
        (error) => {
          cli.action.stop(chalk.red(`Error : ${error}`));
        },
        () => {
          cli.action.stop(chalk.green(`Response: ${args.action}`));
        }
      ),
      TE.toUnion
    )();
  }

  private getApiClient = () => ApiClient(BASE_URL_ADMIN, OCP_APIM);

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

  private put = (
    email: string,
    groupsPermission: readonly string[]
  ): TE.TaskEither<Error, GroupCollection> =>
    pipe(
      TE.tryCatch(
        () =>
          this.getApiClient().updateGroups({
            email,
            body: { groups: groupsPermission },
          }),
        E.toError
      ),
      TE.chain(flow(E.mapLeft(errorsToError), TE.fromEither)),
      TE.chain(
        TE.fromPredicate(
          (response) => response.status === 200,
          () => Error("Could not update groups")
        )
      ),
      TE.map((response) => response.value),
      TE.chain(
        flow(GroupCollection.decode, E.mapLeft(errorsToError), TE.fromEither)
      )
    );
}
