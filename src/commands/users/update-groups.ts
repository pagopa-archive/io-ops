import { Command, Flags, Args } from "@oclif/core";

import chalk from "chalk";
import cli from "cli-ux";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { GroupCollection } from "../../generated/GroupCollection";
import { errorsToError } from "../../utils/conversions";
import { flow, pipe } from "fp-ts/lib/function";

export class UserGroupUpdate extends Command {
  public static description =
    "Update the list of groups (permissions) associated to the User identified by the provided email";

  // tslint:disable-next-line: readonly-array
  public static args = {
    email: Args.string({
      description: "email",
      name: "email",
      required: true,
    }),
  };

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops users:update-groups  --groups=ApiInfoRead,ApiLimitedMessageWrite,ApiMessageRead`,
  ];

  public static flags = {
    groups: Flags.string({
      description: "A comma separeted list of groups",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    // tslint:disable-next-line: no-shadowed-variable
    const { args, flags } = await this.parse(UserGroupUpdate);

    cli.action.start(
      chalk.blue.bold(
        `Updating a list of groups (permission) for user: ${args.email}`
      ),
      chalk.blueBright.bold("Running"),
      {
        stdout: true,
      }
    );

    const groupsPermission = flags.groups.split(",");

    return pipe(
      this.put(args.email, groupsPermission),
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
