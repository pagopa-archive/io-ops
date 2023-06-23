import { Command, Flags, Args } from "@oclif/core";

import chalk from "chalk";
import cli from "cli-ux";
import * as IO from "fp-ts/lib/IOEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as fs from "fs";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { ApiClient } from "../../clients/admin";
import { errorsToError } from "../../utils/conversions";
import { flow, pipe } from "fp-ts/lib/function";

export class ServiceLogo extends Command {
  public static description = "Update service data with base64 of the logo";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    "$ io-ops api-service:logo SERVICEID --logo ~/PATH/logo.png",
  ];

  // tslint:disable-next-line: readonly-array
  public static args = {
    serviceId: Args.string({
      description: "id of the service",
      name: "serviceId",
      required: true,
    }),
  };

  public static flags = {
    logo: Flags.string({
      description: "Path of logo image to be uploaded",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ServiceLogo);

    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Updating logo to service with id: ${args.serviceId}`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true,
      }
    );

    pipe(
      this.logoToBase64(flags.logo)(),
      TE.fromEither,
      TE.mapLeft((err) => cli.action.stop(chalk.red(`${err}`))),
      TE.chain((base64) =>
        pipe(
          this.put(args.serviceId, base64 as NonEmptyString),
          TE.bimap(
            (error) => cli.action.stop(chalk.red(`Error : ${error}`)),
            () => cli.action.stop(chalk.green("Response: Logo created"))
          )
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

  private put = (serviceId: string, base64Logo: NonEmptyString) =>
    pipe(
      TE.tryCatch(
        () =>
          this.getApiClient().uploadServiceLogo({
            body: { logo: base64Logo },
            service_id: serviceId,
          }),
        E.toError
      ),
      TE.chain(flow(E.mapLeft(errorsToError), TE.fromEither)),
      TE.chain(
        TE.fromPredicate(
          (response) => response.status === 201,
          () => Error(`Could not update logo for: ${serviceId}`)
        )
      )
    );

  // given a path on your PC it will transform the file in a
  // base64 string
  private logoToBase64 = (path: string): IO.IOEither<Error, string> =>
    IO.tryCatch(
      () => fs.readFileSync(path, { encoding: "base64" }),
      (reason) => new Error(String(reason))
    );
}
