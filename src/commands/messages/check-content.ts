import { Command, flags } from "@oclif/command";
import * as storage from "azure-storage";
import cli from "cli-ux";
import * as parse from "csv-parse";
import * as fs from "fs";
import * as transform from "stream-transform";

import {
  config,
  getCosmosEndpoint,
  getCosmosReadonlyKey,
  getStorageConnection
} from "../../utils/azure";
import { parseMessagePath } from "../../utils/parser";

export default class MessagesCheckContent extends Command {
  public static description = "Checks validity of messages";

  // tslint:disable-next-line:readonly-array
  public static args = [];

  public static flags = {
    input: flags.string({
      char: "i",
      description:
        "Input file (CSV, with path as first column) - defaults to stdin"
    }),
    parallel: flags.integer({
      char: "p",
      default: 1,
      description: "Number of parallel workers to run"
    })
  };

  public run = async () => {
    const { args, flags: parsedFlags } = this.parse(MessagesCheckContent);

    const inputStream = parsedFlags.input
      ? fs.createReadStream(parsedFlags.input)
      : process.stdin;

    const parser = parse({
      trim: true,
      skip_empty_lines: true
    });

    try {
      cli.action.start("Retrieving credentials");
      const [endpoint, key, storageConnection] = await Promise.all([
        getCosmosEndpoint(config.resourceGroup, config.cosmosName),
        getCosmosReadonlyKey(config.resourceGroup, config.cosmosName),
        getStorageConnection(config.storageName)
      ]);
      cli.action.stop();

      const blobService = storage.createBlobService(storageConnection);

      const doesBlobExist = (id: string) =>
        new Promise<storage.BlobService.BlobResult>((resolve, reject) =>
          blobService.doesBlobExist(
            config.storageMessagesContainer,
            id,
            (err, blobResult) => (err ? reject(err) : resolve(blobResult))
          )
        );
      // const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      // const database = await client.database(config.cosmosDatabaseName);
      // const container = database.container(config.cosmosMessagesContainer);

      const transformer = transform(
        {
          parallel: parsedFlags.parallel
        },
        (record, cb) =>
          (async () => {
            const { path, messageId } = parseMessagePath(record[0]);

            const hasContent = (await doesBlobExist(`${messageId}.json`))
              .exists;

            return `${path},${hasContent === true}\n`;
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
