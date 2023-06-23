import { Command, Args } from "@oclif/core";
import chalk from "chalk";
import cli from "cli-ux";
import * as fs from "fs";
import * as cosmos from "@azure/cosmos";
import * as parse from "csv-parse";
import * as E from "fp-ts/lib/Either";
import * as IO from "fp-ts/lib/IOEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";
import * as t from "io-ts";
import * as AR from "fp-ts/lib/Array";
import { flow, pipe } from "fp-ts/lib/function";
import { getApimClient } from "../../utils/apim";
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import { ApiManagementClient } from "@azure/arm-apimanagement";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { errorsToError } from "../../utils/conversions";
import {
  asyncIteratorToArray,
  flattenAsyncIterator,
  mapAsyncIterable,
} from "@pagopa/io-functions-commons/dist/src/utils/async";
import { Service } from "../../generated/Service";

export class ListDelete extends Command {
  public static description = "Migrate metadata or logos from github";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    "$ io-ops subscriptions:list-delete -inputListPath=/tmp/input.csv",
  ];

  // tslint:disable-next-line: readonly-array
  public static args = {
    deleteFilePath: Args.string({
      name: "deleteFilePath",
      required: true,
      description: "CSV Input file containing subscription list",
    }),
    ownerEmail: Args.string({
      name: "ownerEmail",
      required: false,
      description: "Email of the subscriptions owner",
    }),
  };

  // Run the command
  public async run(): Promise<void> {
    const { args } = await this.parse(ListDelete);
    const cosmosConnectionString = getRequiredStringEnv(
      "COSMOS_CONNECTION_STRING"
    );
    cli.log(cosmosConnectionString);
    cli.log("Creating cosmos client");
    const client = new cosmos.CosmosClient(cosmosConnectionString);
    const database = client.database(getRequiredStringEnv("COSMOSDB_NAME"));
    const container = database.container(
      getRequiredStringEnv("COSMOSDB_SERVICES_CONTAINER_NAME")
    );

    cli.log("Done");

    const apimClient = getApimClient(
      {
        clientId: getRequiredStringEnv("APIM_CLIENT_ID"),
        secret: getRequiredStringEnv("APIM_CLIENT_SECRET"),
        tenantId: getRequiredStringEnv("APIM_TENANT_ID"),
      },
      getRequiredStringEnv("APIM_SUBSCRIPTION_ID")
    );

    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Deleting subscriptions`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true,
      }
    );

    return pipe(
      cli.log(
        chalk.blue.bold(
          `Parsing subscriptonList from path ${args.deleteFilePath}`
        )
      ),
      () => this.parseCsvSubscriptions(args.deleteFilePath),
      TE.chain((subscriptionList) =>
        pipe(
          cli.log(
            chalk.blue.bold(`Parsed subscriptonList: ${subscriptionList}`)
          ),
          () =>
            subscriptionList.map((subscriptionId) =>
              pipe(
                cli.log(
                  chalk.blue.bold(`Deleting subscriptionId ${subscriptionId}`)
                ),
                () => this.deleteSubscription(apimClient, subscriptionId),
                TE.chain(() =>
                  this.deleteAllServiceVersion(container, subscriptionId)
                ),
                TE.map(() => cli.log(chalk.blue.bold(`Completed!`))),
                TE.chain(() =>
                  pipe(
                    TE.fromTask(T.delay(2000)(T.of(void 0))),
                    TE.mapLeft(() =>
                      Error("Error while waiting for another delete")
                    )
                  )
                )
              )
            ),
          AR.sequence(TE.ApplicativeSeq)
        )
      ),
      TE.bimap(
        (error) => {
          cli.action.stop(chalk.red(`Error : ${error}`));
        },
        (result) => {
          cli.action.stop(chalk.green(`Completed Successfully!`));
        }
      ),
      TE.toUnion
    )();
  }

  public deleteSubscription(
    apimClient: ApiManagementClient,
    subscriptionId: string
  ): TE.TaskEither<Error, true> {
    return pipe(
      TE.tryCatch(
        () =>
          apimClient.subscription.delete(
            getRequiredStringEnv("APIM_RESOURCE_GROUP"),
            getRequiredStringEnv("APIM_NAME"),
            subscriptionId,
            "*"
          ),
        E.toError
      ),
      TE.map(() => true)
    );
  }

  public deleteAllServiceVersion(
    serviceContainer: cosmos.Container,
    serviceId: string
  ): TE.TaskEither<Error, true> {
    return pipe(
      serviceContainer.items
        .query({
          parameters: [{ name: "@serviceId", value: serviceId }],
          query: `SELECT * FROM c WHERE c.serviceId = @serviceId`,
        })
        .getAsyncIterator(),
      (serviceIterator) =>
        TE.tryCatch(
          () =>
            asyncIteratorToArray(
              flattenAsyncIterator(
                mapAsyncIterable(
                  serviceIterator,
                  (feedResponse) => feedResponse.resources
                )[Symbol.asyncIterator]()
              )
            ),
          E.toError
        ),
      TE.map((services) =>
        services.map((s) => ({ id: s.id, serviceId: s.serviceId }))
      ),
      TE.chain((mappedServices) =>
        pipe(
          mappedServices.map((service) =>
            TE.tryCatch(
              () =>
                serviceContainer.item(service.id, service.serviceId).delete(),
              E.toError
            )
          ),
          AR.sequence(TE.ApplicativeSeq)
        )
      ),
      TE.map(() => true)
    );
  }

  public parseCsvSubscriptions(
    csvFilePath: string
  ): TE.TaskEither<Error, NonEmptyString[]> {
    const parser = parse.parse({
      trim: true,
      skip_empty_lines: true,
      fromLine: 2,
    });
    const results: unknown[] = [];
    return pipe(
      IO.tryCatch(
        () =>
          fs
            .createReadStream(csvFilePath)
            .pipe(parser)
            .on("data", (data: any[]) => results.push(data[0])),
        (e) => Error(`Error while reading subscriptions csv|${String(e)}`)
      )(),
      TE.fromEither,
      TE.chain((parser) =>
        TE.tryCatch(
          () => new Promise((res, _) => parser.on("end", res)),
          E.toError
        )
      ),
      TE.chain(() =>
        pipe(
          results,
          t.array(NonEmptyString).decode,
          E.mapLeft(
            flow(errorsToError, (e) =>
              Error(`Cannot decode csv subscription list|${e}`)
            )
          ),
          TE.fromEither
        )
      )
    );
  }
}
