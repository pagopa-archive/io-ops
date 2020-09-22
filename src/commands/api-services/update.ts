import Command, { flags } from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import { Either } from "fp-ts/lib/Either";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { Service } from "../../generated/admin/Service";
import { errorsToError } from "../../utils/conversions";

export class ServiceUpdate extends Command {
  public static description = "Update a service";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops api-service:update  --json='{ "authorized_cidrs": [], "authorized_recipients": [], "department_name": "department_test", "organization_fiscal_code": "12345670013", "organization_name": "organization_name", "service_id": "test-api-123", "service_name": "test_name", "is_visible": false, "max_allowed_payment_amount": 0, "require_secure_channels": false }'`
  ];

  public static flags = {
    json: flags.string({
      description: "JSON string rapresentation of a service",
      required: true,
      parse: input => JSON.parse(input)
    })
  };

  public async run(): Promise<void> {
    // tslint:disable-next-line: no-shadowed-variable
    const { flags: commandLineFlags } = this.parse(ServiceUpdate);

    cli.action.start(
      chalk.blue.bold(`Updating a service`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );

    const errorOrService: Either<Error, Service> = Service.decode(
      commandLineFlags.json
    ).mapLeft(errorsToError);

    return fromEither(errorOrService)
      .chain(this.put)
      .fold(
        error => cli.action.stop(chalk.red(`Error: ${error}`)),
        service =>
          cli.action.stop(
            chalk.green(`Response: ${JSON.stringify(JSON.stringify(service))}`)
          )
      )
      .run();
  }

  private getApiClient = () =>
    ApiClient(
      getRequiredStringEnv("BASE_URL_ADMIN"),
      getRequiredStringEnv("OCP_APIM")
    );

  private put = (service: Service): TaskEither<Error, Service> => {
    return new TaskEither(
      new Task(() =>
        this.getApiClient().updateService({
          service,
          service_id: service.service_id
        })
      )
    )
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error(`Could not update service ${service.service_id}`)
        )
      )
      .chain(response =>
        fromEither(Service.decode(response.value)).mapLeft(errorsToError)
      );
  };
}
