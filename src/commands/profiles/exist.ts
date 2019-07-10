import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import * as parse from "csv-parse";
import * as csvStringify from "csv-stringify";
import * as fs from "fs";
import * as transform from "stream-transform";
import { getCosmosConnection } from "../../utils/azure";

export default class ProfilesExist extends Command {
  public static description =
    "Check if, for the given fiscal codes, there are relative profiles or not. It outputs the given csv with a new last column containing true if a profile exists";

  public static flags = {
    input: flags.string({
      char: "i",
      description: "Input file (CSV, with the CF as first column)",
      required: true
    }),
    parallel: flags.integer({
      char: "p",
      default: 1,
      description: "Number of parallel workers to run"
    })
  };

  public async run(): Promise<void> {
    const { flags: parsedFlags } = this.parse(ProfilesExist);

    const inputStream = fs.createReadStream(parsedFlags.input);

    const parser = parse({
      trim: true,
      skip_empty_lines: true
    });

    try {
      cli.action.start("Retrieving cosmosdb credentials");
      const { endpoint, key } = await getCosmosConnection(
        "agid-rg-test",
        "agid-cosmosdb-test"
      );
      cli.action.stop();

      cli.action.start("Querying profiles...");
      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = client.database("agid-documentdb-test");
      const container = database.container("profiles");

      // retrieve all fiscalCodes from database
      const response = container.items.query(
        "SELECT c.fiscalCode FROM c WHERE c.version = 0",
        {
          enableCrossPartitionQuery: true
        }
      );
      const result = (await response.toArray()).result;
      cli.action.stop();
      if (result === undefined) {
        this.error("No result");
        return;
      }
      // create a set of fiscalCodes
      const allProfilesCf = new Set<string>(result.map(r => r.fiscalCode));

      const castBoolean = (value: boolean, _: csvStringify.CastingContext) =>
        value ? "true" : "false";
      // return the output (csv string) if no error occurred
      const transformer = csvStringify(
        { cast: { boolean: castBoolean } },
        (error, output) => {
          if (error) {
            return `some error occured while parsing this line ${
              error.message
            }`;
          } else if (output === undefined) {
            return "row cannot be parsed";
          }
          return output;
        }
      );

      /**
       * it appends to record an entry with the result of check: true if
       * the fiscalCode is into the database. As side operation it
       * returns the fiscalCode in upperCase format
       */
      const checker = transform(
        {
          parallel: parsedFlags.parallel
        },
        (record, cb) =>
          (async () => {
            const fiscalCode = record[0] as string;
            const formattedRecord: ReadonlyArray<string> = [
              fiscalCode.toUpperCase(),
              ...record.slice(1)
            ];
            return [
              ...formattedRecord,
              allProfilesCf.has(fiscalCode.trim().toUpperCase())
            ];
          })()
            .then(_ => cb(null, _))
            .catch(() => cb(null, undefined))
      );

      inputStream
        .pipe(parser)
        .pipe(checker)
        .pipe(transformer)
        .pipe(process.stdout);
      // tslint:disable-next-line: no-inferred-empty-object-type
      await new Promise((res, _) => parser.on("end", res));
    } catch (e) {
      this.error(e);
    }
  }
}
