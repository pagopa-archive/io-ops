import Command, { flags } from "@oclif/command";
import * as Parser from "@oclif/parser";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import chalk from "chalk";
import cli from "cli-ux";
import { IOEither, tryCatch2v as IOtryCatch2v } from "fp-ts/lib/IOEither";
import { Task } from "fp-ts/lib/Task";
import { fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
import * as fs from "fs";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { ApiClient } from "../../clients/admin";
import { errorsToError } from "../../utils/conversions";

export class ServiceLogo extends Command {
  public static description = "Update service data with base64 of the logo";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    "$ io-ops api-service:logo SERVICEID --logo ~/PATH/logo.png"
  ];

  // tslint:disable-next-line: readonly-array
  public static args: Parser.args.IArg[] = [
    {
      description: "id of the service",
      name: "serviceId",
      required: true
    }
  ];

  public static flags = {
    logo: flags.string({
      description: "Path of logo image to be uploaded",
      required: true
    })
  };

  public async run(): Promise<void> {
    const { args } = this.parse(ServiceLogo);

    const { flags: commandLineFlags } = this.parse(ServiceLogo);
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Updating logo to service with id: ${args.serviceId}`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );

    this.logoToBase64(commandLineFlags.logo)
      .mapLeft(err => cli.action.stop(chalk.red(`${err}`)))
      .map(base64 =>
        this.put(args.serviceId, base64 as NonEmptyString)
          .fold(
            error => cli.action.stop(chalk.red(`Error : ${error}`)),
            () => cli.action.stop(chalk.green("Response: Logo created"))
          )
          .run()
      )
      .run();
  }

  private getApiClient = () =>
    ApiClient(
      getRequiredStringEnv("BASE_URL_ADMIN"),
      getRequiredStringEnv("OCP_APIM")
    );

  private put = (serviceId: string, base64Logo: NonEmptyString) =>
    new TaskEither(
      new Task(() =>
        this.getApiClient().uploadServiceLogo({
          logo: { logo: base64Logo },
          service_id: serviceId
        })
      )
    )
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 201,
          () => Error(`Could not update logo for: ${serviceId}`)
        )
      );

  // given a path on your PC it will transform the file in a
  // base64 string
  private logoToBase64 = (path: string): IOEither<Error, string> =>
    IOtryCatch2v(
      () => fs.readFileSync(path, { encoding: "base64" }),
      reason => new Error(String(reason))
    );
}
