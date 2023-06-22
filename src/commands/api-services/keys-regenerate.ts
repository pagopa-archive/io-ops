import { Command, Flags, Args } from "@oclif/core";
import chalk from "chalk";
import cli from "cli-ux";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { SubscriptionKeys } from "../../generated/SubscriptionKeys";
import { SubscriptionKeyTypeEnum } from "../../generated/SubscriptionKeyType";
import { SubscriptionKeyTypePayload } from "../../generated/SubscriptionKeyTypePayload";
import { errorsToError } from "../../utils/conversions";
import { flow, pipe } from "fp-ts/lib/function";

export class KeyRegenerate extends Command {
  public static description = "Regenerate keys associated to service";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops api-service:keys-regenerate  SERVICEID --key_type=PRIMARY_KEY`,
  ];

  public static args = {
    serviceId: Args.string({
      description: "id of the service",
      name: "serviceId",
      required: true,
    }),
  };

  public static flags = {
    key_type: Flags.string({
      description: "JSON string rapresentation of a service",
      required: true,
      options: ["PRIMARY_KEY", "SECONDARY_KEY"],
    }),
  };

  public async run(): Promise<void> {
    // can get args as an object
    const { args, flags } = await this.parse(KeyRegenerate);
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Getting keys for service ${args.serviceId}`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true,
      }
    );

    return pipe(
      this.put(args.serviceId, flags.key_type),
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

  private put = (
    serviceId: string,
    keyType: string
  ): TE.TaskEither<Error, SubscriptionKeys> =>
    pipe(
      TE.tryCatch(
        () =>
          this.getApiClient().RegenerateSubscriptionKeys({
            service_id: serviceId,
            body: SubscriptionKeyTypePayload.encode({
              key_type: keyType as SubscriptionKeyTypeEnum,
            }),
          }),
        E.toError
      ),
      TE.chain(flow(E.mapLeft(errorsToError), TE.fromEither)),
      TE.chain(
        TE.fromPredicate(
          (response) => response.status === 200,
          () => Error("Could not regenerate the subscription keys")
        )
      ),
      TE.map((response) => response.value),
      TE.chain(
        flow(SubscriptionKeys.decode, E.mapLeft(errorsToError), TE.fromEither)
      )
    );
}
