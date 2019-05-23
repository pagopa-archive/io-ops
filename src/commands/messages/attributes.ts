import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import * as parse from "csv-parse";
import * as fs from "fs";
import * as t from "io-ts";
import * as transform from "stream-transform";

import {
  config,
  getCosmosEndpoint,
  getCosmosReadonlyKey,
  getCosmosWriteKey
} from "../../utils/azure";
import { parseMessagePath } from "../../utils/parser";

export default class MessagesAttributes extends Command {
  public static description = "Update message attributes";

  public static flags = {
    input: flags.string({
      char: "i",
      description: "Input file (CSV, with path as first column)",
      required: true
    }),
    parallel: flags.integer({
      char: "p",
      default: 1,
      description: "Number of parallel workers to run"
    }),
    isPending: flags.enum({
      description: "Set 'isPending' flag",
      options: ["true", "false", "undefined"]
    })
  };

  public run = async () => {
    const { args, flags: parsedFlags } = this.parse(MessagesAttributes);

    if (parsedFlags.isPending === undefined) {
      this.error("At least one attribute must be changed");
      this.exit();
    }

    const messageDelta = [
      {
        key: "isPending",
        value:
          parsedFlags.isPending === "true"
            ? true
            : parsedFlags.isPending === "false"
            ? false
            : undefined,
        enabled: parsedFlags.isPending !== undefined
      }
    ].reduce(
      (acc, value) =>
        value.enabled
          ? {
              ...acc,
              [value.key]: value.value
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
      prompt: "Type 'YES' to confirm: "
    });

    if (confirm !== "YES") {
      this.exit(0);
    }

    const inputStream = fs.createReadStream(parsedFlags.input);

    const parser = parse({
      trim: true,
      skip_empty_lines: true
    });

    try {
      cli.action.start("Retrieving credentials");
      const [endpoint, key] = await Promise.all([
        getCosmosEndpoint(config.resourceGroup, config.cosmosName),
        getCosmosWriteKey(config.resourceGroup, config.cosmosName)
      ]);
      cli.action.stop();

      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = await client.database(config.cosmosDatabaseName);
      const container = database.container(config.cosmosMessagesContainer);

      const updateMessage = async (fiscalCode: string, messageId: string) => {
        const messageItem = container.item(messageId, fiscalCode);

        const messageJson = (await messageItem.read()).body;
        const updatedMessage = {
          ...messageJson,
          ...messageDelta
        };
        return await messageItem.replace(updatedMessage);
      };

      const transformer = transform(
        {
          parallel: parsedFlags.parallel
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
            .then(_ => cb(null, _))
            .catch(() => cb(null, undefined)) // skip invalid lines
      );

      process.stdout.write("path,hasContent\n");
      inputStream
        .pipe(parser)
        .pipe(transformer)
        .pipe(process.stdout);

      await new Promise((res, rej) => parser.on("end", res));
    } catch (e) {
      this.error(e);
    }
  };
}
