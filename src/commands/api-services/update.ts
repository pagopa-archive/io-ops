import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import cli from "cli-ux";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { Service } from "../../generated/Service";
import { errorsToError } from "../../utils/conversions";
import { flow, pipe } from "fp-ts/lib/function";

export class ServiceUpdate extends Command {
  public static description = "Update a service";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops api-service:update  --json='{ "authorized_cidrs": [], "authorized_recipients": [], "department_name": "department_test", "organization_fiscal_code": "12345670013", "organization_name": "organization_name", "service_id": "test-api-123", "service_name": "test_name", "is_visible": false, "max_allowed_payment_amount": 0, "require_secure_channels": false }'`,
  ];

  public static flags = {
    payload: Flags.string({
      description: "JSON string rapresentation of a service",
      required: true,
      parse: (input) => JSON.parse(input),
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ServiceUpdate);

    cli.action.start(
      chalk.blue.bold(`Updating a service`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true,
      }
    );

    return pipe(
      flags.payload,
      Service.decode,
      E.mapLeft(errorsToError),
      TE.fromEither,
      TE.chain(this.put),
      TE.bimap(
        (error) => cli.action.stop(chalk.red(`Error: ${error}`)),
        (service) =>
          cli.action.stop(
            chalk.green(`Response: ${JSON.stringify(JSON.stringify(service))}`)
          )
      ),
      TE.toUnion
    )();
  }

  private getApiClient = () =>
    ApiClient(
      getRequiredStringEnv("BASE_URL_ADMIN"),
      getRequiredStringEnv("OCP_APIM")
    );

  private put = (service: Service): TE.TaskEither<Error, Service> =>
    pipe(
      TE.tryCatch(
        () =>
          this.getApiClient().updateService({
            body: service,
            service_id: service.service_id,
          }),
        E.toError
      ),
      TE.chain(flow(E.mapLeft(errorsToError), TE.fromEither)),
      TE.chain(
        TE.fromPredicate(
          (response) => response.status === 200,
          () => Error(`Could not update service ${service.service_id}`)
        )
      ),
      TE.map((response) => response.value),
      TE.chain(flow(Service.decode, E.mapLeft(errorsToError), TE.fromEither))
    );
}
