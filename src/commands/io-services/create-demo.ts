import Command, { flags } from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import { sequenceT } from "fp-ts/lib/Apply";
import { either } from "fp-ts/lib/Either";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import * as t from "io-ts";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { ulid } from "ulid";
import { ApiClient as AdminApiClient } from "../../clients/admin";
import { DepartmentName } from "../../generated/admin/DepartmentName";
import { EmailAddress } from "../../generated/admin/EmailAddress";
import { GroupCollection } from "../../generated/admin/GroupCollection";
import { OrganizationFiscalCode } from "../../generated/admin/OrganizationFiscalCode";
import { OrganizationName } from "../../generated/admin/OrganizationName";
import { Service as AdminService } from "../../generated/admin/Service";
import { ServiceName } from "../../generated/admin/ServiceName";
import { Subscription } from "../../generated/admin/Subscription";
import { UserCreated } from "../../generated/admin/UserCreated";
import { UserPayload } from "../../generated/admin/UserPayload";
import { errorsToError } from "../../utils/conversions";

const ServiceData = t.interface({
  service_name: ServiceName,
  department_name: DepartmentName,
  organization_name: OrganizationName,
  organization_fiscal_code: OrganizationFiscalCode
});

const sandboxFiscalCode = "BCDFGH00A11Z999X" as FiscalCode;

export class CreateDemo extends Command {
  public static description =
    "Creates a demo account associated with a specified service";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops io-services:create-demo --product_name=name-of-product --service='{ "service_name": "service name", "department_name": "Ufficio Anagrafe", "organization_name": "Comune di Vattelappesca", "organization_fiscal_code": "00000000000"}' --user='{ "email": "mario.rossi@example.com","first_name": "mario","last_name": "rossi" }'`
  ];

  public static flags = {
    product_name: flags.string({
      description: "The name of product with which the user will be associated",
      required: true
    }),
    service: flags.string({
      description: "JSON string containing the service data",
      parse: input => JSON.parse(input),
      required: true
    }),
    user: flags.string({
      description: "JSON string containing the user data",
      parse: input => JSON.parse(input),
      required: true
    })
  };

  public async run(): Promise<void> {
    const { flags: commandLineFlags } = this.parse(CreateDemo);

    cli.action.start(
      chalk.blue.bold(
        "Creating a demo account associated with the specified service"
      ),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );

    return fromEither(
      sequenceT(either)(
        NonEmptyString.decode(commandLineFlags.product_name),
        ServiceData.decode(commandLineFlags.service),
        UserPayload.decode(commandLineFlags.user)
      )
        .mapLeft(errorsToError)
        .map(validatedParams => ({
          productName: validatedParams[0],
          service: validatedParams[1],
          user: validatedParams[2]
        }))
    )
      .chain(params =>
        this.createUser(params.user).map(user => ({
          productName: params.productName,
          service: params.service,
          user
        }))
      )
      .chain(taskResults =>
        this.updateUserGroups(taskResults.user.email, [
          "ApiInfoRead",
          "ApiLimitedMessageWrite",
          "ApiLimitedProfileRead",
          "ApiMessageRead"
        ]).map(() => taskResults)
      )
      .chain(taskResults => {
        // tslint:disable-next-line:no-useless-cast
        const subscriptionId = ulid() as NonEmptyString;
        return this.createSubscription(
          taskResults.user.email,
          subscriptionId,
          taskResults.productName
        ).map(() => ({
          ...taskResults,
          subscriptionId
        }));
      })
      .chain(taskResults =>
        this.createService({
          ...taskResults.service,
          authorized_cidrs: [],
          authorized_recipients: [],
          service_id: taskResults.subscriptionId
        })
      )
      .fold(
        error => {
          cli.action.stop(chalk.red(`Error : ${error}`));
        },
        service => {
          cli.action.stop(
            chalk.green(`Success: created service ${service.service_id}`)
          );
        }
      )
      .run();
  }

  private getAdminApiClient = () =>
    AdminApiClient(
      getRequiredStringEnv("BASE_URL_ADMIN"),
      getRequiredStringEnv("OCP_APIM")
    );

  private createUser = (user: UserPayload): TaskEither<Error, UserCreated> =>
    new TaskEither(
      new Task(() => this.getAdminApiClient().createUser({ userPayload: user }))
    )
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error("Could not create user")
        )
      )
      .chain(response =>
        fromEither(UserCreated.decode(response.value)).mapLeft(errorsToError)
      );

  private updateUserGroups = (
    email: EmailAddress,
    userGroups: ReadonlyArray<string>
  ): TaskEither<Error, GroupCollection> =>
    new TaskEither(
      new Task(() =>
        this.getAdminApiClient().updateGroups({
          email,
          userGroupsPayload: {
            groups: userGroups
          }
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

  private createSubscription = (
    email: string,
    subscriptionId: string,
    productName: NonEmptyString
  ): TaskEither<Error, Subscription> =>
    new TaskEither(
      new Task(() =>
        this.getAdminApiClient().createSubscription({
          email,
          subscription_id: subscriptionId,
          productNamePayload: { product_name: productName }
        })
      )
    )
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error(`Could not create the subscription ${subscriptionId}`)
        )
      )
      .chain(response =>
        fromEither(Subscription.decode(response.value)).mapLeft(errorsToError)
      );

  private createService = (
    service: AdminService
  ): TaskEither<Error, AdminService> =>
    new TaskEither(
      new Task(() => this.getAdminApiClient().createService({ service }))
    )
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error(`Could not create the service ${service.service_id}`)
        )
      )
      .chain(response =>
        fromEither(AdminService.decode(response.value)).mapLeft(errorsToError)
      );
}
