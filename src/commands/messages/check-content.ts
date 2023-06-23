import { Command, Flags } from "@oclif/core";
import * as storage from "azure-storage";
import cli from "cli-ux";
import * as parse from "csv-parse";
import * as fs from "fs";
import * as transform from "stream-transform";

import { getStorageConnection, pickAzureConfig } from "../../utils/azure";
import { parseMessagePath } from "../../utils/parser";

export default class MessagesCheckContent extends Command {
  public static description = "Checks validity of messages";

  public static flags = {
    input: Flags.string({
      char: "i",
      description:
        "Input file (CSV, with path as first column) - defaults to stdin",
    }),
    parallel: Flags.integer({
      char: "p",
      default: 1,
      description: "Number of parallel workers to run",
    }),
  };

  public run = async () => {
    const { flags } = await this.parse(MessagesCheckContent);

    const inputStream = flags.input
      ? fs.createReadStream(flags.input)
      : process.stdin;

    const parser = parse.parse({
      trim: true,
      skip_empty_lines: true,
    });

    try {
      cli.action.start("Retrieving credentials");
      const config = await pickAzureConfig();
      const storageConnection = await getStorageConnection(config.storageName);
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
      const transformer = transform.transform(
        {
          parallel: flags.parallel,
        },
        (record, cb) =>
          (async () => {
            const { path, messageId } = parseMessagePath(record[0]);

            const hasContent = (await doesBlobExist(`${messageId}.json`))
              .exists;

            return `${path},${hasContent === true}\n`;
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
