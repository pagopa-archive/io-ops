import Command, { flags } from "@oclif/command";
import chalk from "chalk";
import cli from "cli-ux";
import { Either } from "fp-ts/lib/Either";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { Errors } from "io-ts";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import fetch from "node-fetch";
import { Service as AdminService } from "../../generated/Service";

export class ServiceCreate extends Command {
  public static description = "Create a service";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops api-service:create  --json='{ "authorized_cidrs": [], "authorized_recipients": [], "department_name": "department_test", "organization_fiscal_code": "12345670013", "organization_name": "organization_name", "service_id": "test-api-123", "service_name": "test_name", "is_visible": false, "max_allowed_payment_amount": 0, "require_secure_channels": false }'`
  ];

  public static flags = {
    json: flags.string({
      description: "JSON string rapresentation of a service",
      required: true
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

    const errorOrService: Either<Errors, AdminService> = AdminService.decode(
      JSON.parse(commandLineFlags.json)
    );

    // may be can be a better way without nesting
    // suggestions?
    errorOrService.fold(
      error =>
        cli.action.stop(
          chalk.red(`Error : ${errorsToReadableMessages(error)}`)
        ),
      service =>
        this.post(service)
          .fold(
            error => {
              cli.action.stop(chalk.red(`Error : ${error}`));
            },
            result => {
              cli.action.stop(chalk.green(`Response: ${result}`));
            }
          )
          .run()
    );
  }

  private post = (service: AdminService): TaskEither<Error, string> =>
    tryCatch(
      () =>
        fetch(`${getRequiredStringEnv("BASE_URL_ADMIN")}/services`, {
          body: JSON.stringify(service),
          headers: {
            "Ocp-Apim-Subscription-Key": getRequiredStringEnv("OCP_APIM")
          },
          method: "post"
        }).then(res => res.text()),
      reason => new Error(String(reason))
    );
}
