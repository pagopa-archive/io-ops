import Command, { flags } from "@oclif/command";
import * as Parser from "@oclif/parser";
import chalk from "chalk";
import cli from "cli-ux";
import { Task } from "fp-ts/lib/Task";
import { fromEither, fromPredicate, TaskEither } from "fp-ts/lib/TaskEither";
// tslint:disable-next-line: no-submodule-imports
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { ApiClient } from "../../clients/admin";
import { SubscriptionKeys } from "../../generated/admin/SubscriptionKeys";
import { SubscriptionKeyTypeEnum } from "../../generated/admin/SubscriptionKeyType";
import { SubscriptionKeyTypePayload } from "../../generated/admin/SubscriptionKeyTypePayload";
import { errorsToError } from "../../utils/conversions";

export class KeyRegenerate extends Command {
  public static description = "Regenerate keys associated to service";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops api-service:keys-regenerate  SERVICEID --key_type=PRIMARY_KEY`
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
    key_type: flags.string({
      description: "JSON string rapresentation of a service",
      required: true,
      options: ["PRIMARY_KEY", "SECONDARY_KEY"]
    })
  };

  public async run(): Promise<void> {
    // can get args as an object
    const { args, flags: commandLineFlags } = this.parse(KeyRegenerate);
    // tslint:disable-next-line: no-console
    cli.action.start(
      chalk.blue.bold(`Getting keys for service ${args.serviceId}`),
      chalk.blueBright.bold("Running"),
      {
        stdout: true
      }
    );

    return this.put(args.serviceId, commandLineFlags.key_type)
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

  private put = (
    serviceId: string,
    keyType: string
  ): TaskEither<Error, SubscriptionKeys> =>
    new TaskEither(
      new Task(() =>
        this.getApiClient().regenerateSubscriptionKeys({
          service_id: serviceId,
          subscriptionKeyTypePayload: SubscriptionKeyTypePayload.encode({
            key_type: keyType as SubscriptionKeyTypeEnum
          })
        })
      )
    )
      .mapLeft(errorsToError)
      .chain(
        fromPredicate(
          response => response.status === 200,
          () => Error("Could not regenerate the subscription keys")
        )
      )
      .chain(response =>
        fromEither(SubscriptionKeys.decode(response.value)).mapLeft(
          errorsToError
        )
      );
}
