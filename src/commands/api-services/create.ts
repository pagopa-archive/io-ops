import Command, { flags } from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import { Either } from "fp-ts/lib/Either";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import { ApiClient } from "../../clients/api";
import { Service as AdminService } from "../../generated/Service";
import { errorsToError } from "../../utils/conversions";

export class ServiceCreate extends Command {
  public static description = "Create a service";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops api-service:create  --json='{ "authorized_cidrs": [], "authorized_recipients": [], "department_name": "department_test", "organization_fiscal_code": "12345670013", "organization_name": "organization_name", "service_id": "test-api-123", "service_name": "test_name", "is_visible": false, "max_allowed_payment_amount": 0, "require_secure_channels": false }'`
  ];

  public static flags = {
    json: flags.string({
      description: "JSON string rapresentation of a service",
      required: true,
      parse: input => JSON.parse(input)
    })
  };

  public async run(): Promise<void> {
    const { flags: commandLineFlags } = this.parse(ServiceCreate);

    cli.action.start(
      chalk.blue.bold(`Creating a service`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );

    const errorOrService: Either<Error, AdminService> = AdminService.decode(
      JSON.parse(commandLineFlags.json)
    ).mapLeft(errors => Error(errorsToReadableMessages(errors).join(" /")));

    return fromEither(errorOrService)
      .chain(this.post)
      .fold(
        error => {
          cli.action.stop(chalk.red(`Error : ${error}`));
        },
        result => {
          cli.action.stop(chalk.green(`Response: ${JSON.stringify(result)}`));
        }
      )
      .run();
  }

  private getApiClient = () =>
    ApiClient(
      getRequiredStringEnv("BASE_URL_ADMIN"),
      getRequiredStringEnv("OCP_APIM")
    );

  private post = (service: AdminService): TaskEither<Error, AdminService> =>
    new TaskEither(
      new Task(() => this.getApiClient().createService({ service }))
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
