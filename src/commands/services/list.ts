import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import * as dotenv from "dotenv";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
import { DateTime } from "luxon";
import { ApiClient } from "../../clients/admin";
import { EmailAddress } from "../../generated/EmailAddress";
import { UserCollection } from "../../generated/UserCollection";
import { UserInfo } from "../../generated/UserInfo";
import { getCosmosConnection, pickAzureConfig } from "../../utils/azure";
import { errorsToError } from "../../utils/conversions";

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

    const day = DateTime.fromFormat(
      `${parsedFlags.day} Europe/Rome`,
      "yyyy-MM-dd z"
    );
    if (!day.isValid) {
      this.error("day is not valid");
      return;
    }

    try {
      const config = await pickAzureConfig();
      cli.action.start("Retrieving cosmosdb credentials");
      const { endpoint, key } = await getCosmosConnection(
        config.resourceGroup,
        config.cosmosName
      );
      cli.action.stop();

      cli.action.start("Querying services...");
      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = client.database(config.cosmosDatabaseName);
      const container = database.container(config.cosmosServicesContainer);
      const response = container.items.query(
        // query services by timestamp
        `SELECT * FROM c WHERE c._ts < ${day.toMillis() / 1000}`,
        {
          enableCrossPartitionQuery: true
        }
      );
      const result = (await response.toArray()).result;

      cli.action.stop();
      if (result === undefined) {
        this.error("No result");
        return;
      }

      const latest: any[] = Object.values(
        // tslint:disable-next-line: no-any
        result.reduce((prev, curr: any) => {
          const isNewer =
            !prev[curr.serviceId] ||
            curr.version > prev[curr.serviceId].version;
          return {
            ...prev,
            ...(isNewer ? { [curr.serviceId]: curr } : {})
          };
        }, {})
      );

      // get all visible services
      const visible = latest.filter(x => x.isVisible === true);

      // all apim users (without subscriptions and groups)
      let users = new Array();
      // getUsers api returns max 100 users for call, so we need to call api until next result is empty
      let cursor = 0;

      // latest lenght is greater then max users (1 user -> n subscriptions)
      // loop end when next result is empty
      for (let i = 0; i < latest.length; i++) {
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
      }

      // map informations
      cli.table(
        report,
        {
          organizationFiscalCode: {
            header: "organizationFiscalCode"
          },
          organizationName: {
            header: "organizationName"
          },
          serviceId: {
            header: "serviceId"
          },
          serviceName: {
            header: "serviceName"
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
          max_allowed_payment_amount: {
            header: "max_allowed_payment_amount"
          },
          authorizedCIDRs: {
            header: "authorizedCIDRs",
            get: row => (row.authorizedCIDRs as readonly string[]).length
          },
          scope: {
            header: "scope",
            get: row => row.serviceMetadata && row.serviceMetadata.scope
          },
          privacy_url: {
            header: "privacy_url",
            get: row => row.serviceMetadata && row.serviceMetadata.privacy_url
          },
          description: {
            header: "description",
            get: row => row.serviceMetadata && row.serviceMetadata.description
          },
          phone: {
            header: "phone",
            get: row => row.serviceMetadata && row.serviceMetadata.phone
          },
          mail: {
            header: "mail",
            get: row => row.serviceMetadata && row.serviceMetadata.mail
          },
          pec: {
            header: "pec",
            get: row => row.serviceMetadata && row.serviceMetadata.pec
          },
          support_url: {
            header: "support_url",
            get: row => row.serviceMetadata && row.serviceMetadata.support_url
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
