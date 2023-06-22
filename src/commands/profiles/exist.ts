import * as cosmos from "@azure/cosmos";
import { Command, Flags } from "@oclif/core";
import cli from "cli-ux";
import * as parse from "csv-parse";
import * as csvStringify from "csv-stringify";
import * as fs from "fs";
import * as transform from "stream-transform";
import { getCosmosConnection, pickAzureConfig } from "../../utils/azure";

export default class ProfilesExist extends Command {
  public static description =
    "Returns the input CSV with a new column that is true if a profile for that fiscal code exists.";

  public static flags = {
    input: Flags.string({
      char: "i",
      description:
        "Input file (CSV, with the CF as first column) - defaults to stdin",
    }),
    parallel: Flags.integer({
      char: "p",
      default: 1,
      description: "Number of parallel workers to run",
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ProfilesExist);

    const inputStream = flags.input
      ? fs.createReadStream(flags.input)
      : process.stdin;

    const parser = parse.parse({
      trim: true,
      skip_empty_lines: true,
    });

    try {
      const config = await pickAzureConfig();
      cli.action.start("Retrieving cosmosdb credentials");
      const { endpoint, key } = await getCosmosConnection(
        config.resourceGroup,
        config.cosmosName
      );
      cli.action.stop();

      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = client.database(config.cosmosDatabaseName);
      const container = database.container(config.cosmosProfilesContainer);

      const hasProfile = async (fiscalCode: string): Promise<boolean> => {
        const response = container.items.query({
          parameters: [{ name: "@fiscalCode", value: fiscalCode }],
          query: `SELECT VALUE COUNT(1) FROM c WHERE c.fiscalCode = @fiscalCode AND c.version = 0`,
        });
        const { result: item } = await response.current();
        return item === 1;
      };

      const castBoolean = (value: boolean, _: csvStringify.CastingContext) =>
        value ? "true" : "false";
      // return the output (csv string) if no error occurred
      const transformer = csvStringify.stringify(
        { cast: { boolean: castBoolean } },
        (error, output) => {
          if (error) {
            return `some error occured while parsing this line ${error.message}`;
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
      const checker = transform.transform(
        {
          parallel: flags.parallel,
        },
        (record, cb) =>
          (async () => {
            const fiscalCode = record[0] as string;
            const formattedRecord: ReadonlyArray<string> = [
              fiscalCode.toUpperCase(),
              ...record.slice(1),
            ];
            const exists = await hasProfile(fiscalCode.trim().toUpperCase());
            return [...formattedRecord, exists];
          })()
            .then((_) => cb(null, _))
            .catch(() => cb(null, undefined))
      );
      // if the stream is the stdin, ask to input a fiscal code
      if (flags.input === undefined) {
        cli.log("Provide a fiscal code:");
      }

      inputStream
        .pipe(parser)
        .pipe(checker)
        .pipe(transformer)
        .pipe(process.stdout);
      // tslint:disable-next-line: no-inferred-empty-object-type
      await new Promise((res, _) => parser.on("end", res));
    } catch (e) {
      this.error(String(e));
    }
  }
}
