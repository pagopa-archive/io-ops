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
import { Service } from "../../generated/Service";
import { flagsToService } from "../../utils/service-utils";

export class ServiceUpdate extends Command {
  public static description = "Update a service";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    "$ io-ops api-service:update  --department_name=department_test --organization_fiscal_code=12345670016  --organization_name=organization_name --service_id=test-api-service --service_name=test_api-service"
  ];

  public static flags = {
    authorized_cidrs: flags.string({
      default: "",
      description:
        "Allowed source IPs or CIDRs for this service. String separated by , of single IP or a range of IPs and can be empty"
    }),
    authorized_recipients: flags.string({
      default: "",
      description:
        "If non empty, the service will be able to send messages only to these fiscal codes. Fiscal code format"
    }),
    department_name: flags.string({
      description: "Name of the department of the organization",
      required: true
    }),
    organization_fiscal_code: flags.string({
      description: "Name of the organization",
      required: true
    }),
    organization_name: flags.string({
      description: "Name of the organization",
      required: true
    }),
    service_id: flags.string({
      description: "Id of the service",
      required: true
    }),
    service_name: flags.string({
      description: "Name of the service",
      required: true
    }),
    require_secure_channels: flags.boolean({
      description: "Require secure channel?",
      default: false
    }),
    version: flags.integer({
      description: "Version of the service"
    }),
    is_visible: flags.boolean({
      description: "Is the service visible?",
      default: false
    }),
    "service_metadata.description": flags.string({
      description: "Description of the sevice",
      required: false
    }),
    "service_metadata.web_url": flags.string({
      description: "Url of the service",
      required: false
    }),
    "service_metadata.app_ios": flags.string({
      description: "App ios url",
      required: false
    }),
    "service_metadata.app_android": flags.string({
      description: "App android url",
      required: false
    }),
    "service_metadata.tos_url": flags.string({
      description: "Term of Service url",
      required: false
    }),
    "service_metadata.privacy_url": flags.string({
      description: "Privacy url",
      required: false
    }),
    "service_metadata.address": flags.string({
      description: "Address of the institution",
      required: false
    }),
    "service_metadata.phone": flags.string({
      description: "Phone number",
      required: false
    }),
    "service_metadata.email": flags.string({
      description: "Email of the institution",
      required: false
    }),
    "service_metadata.pec": flags.string({
      description: "Pec of the institution",
      required: false
    }),
    "service_metadata.scope": flags.string({
      description: "Scope of the service can be NATIONAL or LOCAL",
      required: false,
      options: ["NATIONAL", "LOCAL"]
    })
  };

  public async run(): Promise<void> {
    // tslint:disable-next-line: no-shadowed-variable
    const { flags } = this.parse(ServiceUpdate);

    cli.action.start(
      chalk.blue.bold(`Updating a service`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );

    const errorOrService: Either<Errors, Service> = flagsToService(flags);

    // I don't like much this nesting of fold
    // suggestions?
    errorOrService.fold(
      error =>
        cli.action.stop(
          chalk.red(`Error : ${errorsToReadableMessages(error)}`)
        ),
      service =>
        this.put(service)
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

  private put = (service: Service): TaskEither<Error, string> => {
    return tryCatch(
      () =>
        fetch(
          `${getRequiredStringEnv("BASE_URL_ADMIN")}/services/${
            service.service_id
          }`,
          {
            body: JSON.stringify(service),
            headers: {
              "Ocp-Apim-Subscription-Key": getRequiredStringEnv("OCP_APIM")
            },
            method: "put"
          }
        ).then(res => res.text()),
      reason => new Error(String(reason))
    );
  };
}
