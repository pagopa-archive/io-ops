import { Command, flags } from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import * as dotenv from "dotenv";
import { fromNullable, isNone, isSome } from "fp-ts/lib/Option";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
import { DateTime } from "luxon";
import { ApiClient } from "../../clients/admin";
import { EmailAddress } from "../../generated/EmailAddress";
import { UserCollection } from "../../generated/UserCollection";
import { UserInfo } from "../../generated/UserInfo";
import { errorsToError } from "../../utils/conversions";
import { getServices } from "../../utils/service";

dotenv.config();

const BASE_URL_ADMIN = process.env.BASE_URL_ADMIN || "";
const OCP_APIM = process.env.OCP_APIM || "";

export default class ServicesList extends Command {
  public static description = "Lists all services";

  public static flags = {
    ...cli.table.flags(),
    day: flags.string({
      description:
        "filter services from specified day (Europe/Rome timezone, required format yyyy-MM-dd, ie 2020-05-25)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags: parsedFlags } = this.parse(ServicesList);

    const day = fromNullable(parsedFlags.day).map(_ =>
      DateTime.fromFormat(`${_} Europe/Rome`, "yyyy-MM-dd z")
    );

    if (isSome(day) && !day.value.isValid) {
      this.error("day is not valid");
      return;
    }

    try {
      cli.action.start("Querying services...");
      const services = await getServices(day);
      cli.action.stop();
      if (isNone(services)) {
        this.error("No result");
        return;
      }

      // get all visible services
      const visible = services.value.filter(x => x.isVisible === true);

      // all apim users (without subscriptions and groups)
      let users = new Array();
      // getUsers api returns max 100 users for call, so we need to call api until next result is empty
      let cursor = 0;

      // latest lenght is greater then max users (1 user -> n subscriptions)
      // loop end when next result is empty
      for (let i = 0; i < services.value.length; i++) {
        cli.action.start(`Querying users... cursor: ${cursor}`);
        const curr = (await this.getUsers(cursor)
          .fold(
            error => {
              cli.action.stop(chalk.red(`Error : ${error}`));
            },
            result => {
              return result;
            }
          )
          .run()) as any;

        // build users array
        curr.items.forEach((element: any) => {
          users.push(element);
        });

        cursor = cursor + 100;
        cli.action.stop();
        if (curr.next === undefined) {
          // exit loop when next element is empty
          break;
        }
      }

      // final report array
      // tslint:disable-next-line: no-let
      let report = new Array();

      // for each user get subscriptions and groups
      // tslint:disable-next-line: no-let
      for (let i = 0; i < users.length; i++) {
        cli.action.start(`Querying user... user: ${i}`);
        const curr = (await this.getUser(users[i].email)
          .fold(
            error => {
              cli.action.stop(chalk.red(`Error : ${error}`));
            },
            result => {
              return result;
            }
          )
          .run()) as any;

        if (curr !== undefined) {
          const isInvioMassivo =
            curr.groups.filter(
              (x: { display_name: string }) =>
                x.display_name === "ApiMessageWrite"
            ).length === 1 &&
            curr.groups.filter(
              (x: { display_name: string }) =>
                x.display_name === "ApiLimitedMessageWrite"
            ).length === 0;

          const isSubFeed =
            curr.groups.filter(
              (x: { display_name: string }) =>
                x.display_name === "ApiSubscriptionsFeedRead"
            ).length === 1;

          const isOnboardingMassivo =
            curr.groups.filter(
              (x: { display_name: string }) =>
                x.display_name === "ApiServiceRead"
            ).length === 1 &&
            curr.groups.filter(
              (x: { display_name: string }) =>
                x.display_name === "ApiServiceWrite"
            ).length === 1;

          const isAdmin =
            curr.groups.filter(
              (x: { display_name: string }) => x.display_name === "ApiAdmin"
            ).length === 1;

          const createdService = isOnboardingMassivo
            ? users[i].email
            : "PagoPA";

          // for each subscription add visible service info, if serviceId matches with subscriptions.id
          // tslint:disable-next-line: prefer-for-of
          for (let k = 0; k < curr.subscriptions.length; k++) {
            const service = visible.filter(
              x => x.serviceId === curr.subscriptions[k].id
            );
            if (service.length > 0) {
              report.push({
                ...service[0],
                userEmail: users[i].email,
                userGroups: curr.groups,
                userIsInvioMassivo: isInvioMassivo,
                userIsSubFeed: isSubFeed,
                userIsOnboardingMassivo: isOnboardingMassivo,
                userIsAdmin: isAdmin,
                userCreatedService: createdService
              });
            }
          }
        }
        cli.action.stop();
      }

      // check final report length must be equal to visible services
      if (report.length !== visible.length) {
        cli.action.start(
          `Error: report.length=${report.length} !== visible.length=${visible.length}`
        );
        cli.action.stop();

        let servicesToCheck = new Array();
        for (let k = 0; k < visible.length; k++) {
          if (
            report.filter(x => x.serviceId === visible[k].serviceId).length ===
            0
          ) {
            servicesToCheck.push(visible[k].serviceId);
          }
        }

        cli.action.start(
          `Error: serviceIds to check: ${servicesToCheck.join()}`
        );
        cli.action.stop();
      }

      // map informations
      cli.table(
        report,
        {
          organizationFiscalCode: {
            header: "organizationFiscalCode"
          },
          organizationName: {
            header: "organizationName",
            get: row =>
              row.organizationName === undefined
                ? "undefined"
                : row.organizationName.split('"').join("")
          },
          serviceId: {
            header: "serviceId"
          },
          serviceName: {
            header: "serviceName",
            get: row =>
              row.serviceName === undefined
                ? "undefined"
                : row.serviceName.split('"').join("")
          },
          isVisible: {
            header: "isVisible"
          },
          timestamp: {
            header: "timestamp",
            get: row =>
              DateTime.fromSeconds(row._ts, { zone: "Europe/Rome" }).toFormat(
                "yyyy-MM-dd HH:mm:ss"
              )
          },
          maxAllowedPaymentAmount: {
            header: "maxAllowedPaymentAmount"
          },
          authorizedCIDRs: {
            header: "authorizedCIDRs",
            get: row => (row.authorizedCIDRs as readonly string[]).length
          },
          scope: {
            header: "scope",
            get: row => row.serviceMetadata && row.serviceMetadata.scope
          },
          privacyUrl: {
            header: "privacyUrl",
            get: row =>
              row.serviceMetadata &&
              row.serviceMetadata.privacyUrl === undefined
                ? "undefined"
                : row.serviceMetadata.privacyUrl.split('"').join("")
          },
          description: {
            header: "description",
            get: row =>
              row.serviceMetadata &&
              row.serviceMetadata.description === undefined
                ? "undefined"
                : row.serviceMetadata.description.split('"').join("")
          },
          phone: {
            header: "phone",
            get: row => row.serviceMetadata && row.serviceMetadata.phone
          },
          email: {
            header: "email",
            get: row => row.serviceMetadata && row.serviceMetadata.email
          },
          pec: {
            header: "pec",
            get: row => row.serviceMetadata && row.serviceMetadata.pec
          },
          supportUrl: {
            header: "supportUrl",
            get: row =>
              row.serviceMetadata &&
              row.serviceMetadata.supportUrl === undefined
                ? "undefined"
                : row.serviceMetadata.supportUrl.split('"').join("")
          },
          userEmail: {
            header: "userEmail"
          },
          userGroups: {
            header: "userGroups",
            get: row =>
              row.userGroups &&
              row.userGroups
                .map((x: { display_name: any }) => x.display_name)
                .join()
          },
          userIsInvioMassivo: {
            header: "userIsInvioMassivo"
          },
          userIsSubFeed: {
            header: "userIsSubFeed"
          },
          userIsOnboardingMassivo: {
            header: "userIsOnboardingMassivo"
          },
          userIsAdmin: {
            header: "userIsAdmin"
          },
          userCreatedService: {
            header: "userCreatedService"
          }
        },
        {
          printLine: this.log,
          ...parsedFlags // parsed flags
        }
      );
    } catch (e) {
      this.error(e);
    }
  }

  private getApiClient = () => ApiClient(BASE_URL_ADMIN, OCP_APIM);

  private getUsers = (cursor: number = 0): TaskEither<Error, UserCollection> =>
    new TaskEither(new Task(() => this.getApiClient().getUsers({ cursor })))
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error("Could read users")
        )
      )
      .chain(response =>
        fromEither(UserCollection.decode(response.value)).mapLeft(errorsToError)
      );

  private getUser = (email: EmailAddress): TaskEither<Error, UserInfo> =>
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
}
