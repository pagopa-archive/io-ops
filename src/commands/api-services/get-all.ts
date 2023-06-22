import { Command } from "@oclif/core";
import chalk from "chalk";
import cli from "cli-ux";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { ServiceCollection } from "../../generated/ServiceCollection";
import { errorsToError } from "../../utils/conversions";
import { flow, pipe } from "fp-ts/lib/function";

export class ServiceGet extends Command {
  public static description = "Get all services";

  // tslint:disable-next-line: readonly-array
  public static examples = ["$ io-ops api-service:get-all"];

  public async run(): Promise<void> {
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Getting all services`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true,
      }
    );

    return pipe(
      this.get(),
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

  private get = (): TE.TaskEither<Error, ServiceCollection> =>
    pipe(
      TE.tryCatch(() => this.getApiClient().getServices({}), E.toError),
      TE.chain(flow(E.mapLeft(errorsToError), TE.fromEither)),
      TE.chain(
        TE.fromPredicate(
          (response) => response.status === 200,
          () => Error("Could not read the services")
        )
      ),
      TE.map((response) => response.value),
      TE.chain(
        flow(ServiceCollection.decode, E.mapLeft(errorsToError), TE.fromEither)
      )
    );
}
