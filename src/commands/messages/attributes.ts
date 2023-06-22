import * as cosmos from "@azure/cosmos";
import { Command, Flags } from "@oclif/core";
import cli from "cli-ux";
import * as parse from "csv-parse";
import * as fs from "fs";
import * as transform from "stream-transform";

import {
  getCosmosEndpoint,
  getCosmosWriteKey,
  pickAzureConfig,
} from "../../utils/azure";
import { parseMessagePath } from "../../utils/parser";

export default class MessagesAttributes extends Command {
  public static description = "Update message attributes";

  public static flags = {
    input: Flags.string({
      char: "i",
      description: "Input file (CSV, with path as first column)",
      required: true,
    }),
    parallel: Flags.integer({
      char: "p",
      default: 1,
      description: "Number of parallel workers to run",
    }),
    isPending: Flags.string({
      description: "Set 'isPending' flag",
      options: ["true", "false", "undefined"],
    }),
  };

  public run = async () => {
    const { flags } = await this.parse(MessagesAttributes);

    if (flags.isPending === undefined) {
      this.error("At least one attribute must be changed");
      this.exit();
    }

    // tslint:disable-next-line: no-inferred-empty-object-type
    const messageDelta = [
      {
        key: "isPending",
        value:
          flags.isPending === "true"
            ? true
            : flags.isPending === "false"
            ? false
            : undefined,
        enabled: flags.isPending !== undefined,
      },
    ].reduce(
      (acc, value) =>
        value.enabled
          ? {
              ...acc,
              [value.key]: value.value,
            }
          : acc,
      {}
    );

    this.warn(
      `The following attributes will be changed: ${JSON.stringify(
        messageDelta
      )}`
    );

    const confirm = await cli.prompt("Are you sure you want to do this?", {
      required: true,
      prompt: "Type 'YES' to confirm: ",
    });

    if (confirm !== "YES") {
      this.exit(0);
    }

    const inputStream = fs.createReadStream(flags.input);

    const parser = parse.parse({
      trim: true,
      skip_empty_lines: true,
    });

    try {
      const config = await pickAzureConfig();
      cli.action.start("Retrieving credentials");
      const [endpoint, key] = await Promise.all([
        getCosmosEndpoint(config.resourceGroup, config.cosmosName),
        getCosmosWriteKey(config.resourceGroup, config.cosmosName),
      ]);
      cli.action.stop();

      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = client.database(config.cosmosDatabaseName);
      const container = database.container(config.cosmosMessagesContainer);

      const updateMessage = async (fiscalCode: string, messageId: string) => {
        const messageItem = container.item(messageId, fiscalCode);

        const messageJson = (await messageItem.read()).body;
        const updatedMessage = {
          ...messageJson,
          ...messageDelta,
        };
        return await messageItem.replace(updatedMessage);
      };

      const transformer = transform.transform(
        {
          parallel: flags.parallel,
        },
        (record, cb) =>
          (async () => {
            const { path, fiscalCode, messageId } = parseMessagePath(record[0]);
            try {
              await updateMessage(fiscalCode, messageId);
              return `${path}\n`;
            } catch (e) {
              this.warn(`${path}: ${e}`);
            }
          })()
            .then((_) => cb(null, _))
            .catch(() => cb(null, undefined)) // skip invalid lines
      );

      process.stdout.write("path,hasContent\n");
      inputStream.pipe(parser).pipe(transformer).pipe(process.stdout);
      // tslint:disable-next-line: no-inferred-empty-object-type
      await new Promise((res, _) => parser.on("end", res));
    } catch (e) {
      this.error(String(e));
    }
  };
}
