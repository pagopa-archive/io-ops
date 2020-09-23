import { Command, flags } from "@oclif/command";
import { BlobServiceClient } from "@azure/storage-blob";
import { pickAzureConfig, getStorageConnection } from "../../utils/azure";
import fetch from "node-fetch";
import cli from "cli-ux";

interface OutputResult {
  redeemedRequest: string;
  statusCode: string;
}

export default class RedeemBonuses extends Command {
  public static description = "Reprocess redeemed bonuses in the specified day";

  public static args = [];

  public static flags = {
    day: flags.string({
      char: "d",
      description: "day",
      required: true
    }),
    apiUrl: flags.string({
      char: "u",
      default: "https://api-gad.io.italia.it/api/bonus-vacanze/v1/redeemed",
      description: "bonus vacanze api url"
    }),
    apiKey: flags.string({
      char: "k",
      description: "bonus vacanze api key",
      required: true
    })
  };

  public async run(): Promise<void> {
    const { flags: parsedFlags } = this.parse(RedeemBonuses);

    try {
      // get access to resources
      const config = await pickAzureConfig();
      const storageConnection = await getStorageConnection(config.storageName);
      const blobServiceClient = BlobServiceClient.fromConnectionString(
        storageConnection
      );
      const containerClient = blobServiceClient.getContainerClient(
        config.storageBonusRedeemedContainer
      );

      cli.action.start("Reprocessing redeemed requests...");

      // array where we save reprocessed redeemed requests and response status codes
      let outputResults = Array<OutputResult>();

      // get and reprocess redeemed requests
      for await (const blob of containerClient.listBlobsFlat({
        prefix: parsedFlags.day
      })) {
        console.log("\t", blob.name);

        // inizialize outputResult
        let outputResult = {
          redeemedRequest: blob.name,
          statusCode: "0"
        };

        const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
        const downloadBlockBlobResponse = await blockBlobClient.download(0);

        if (downloadBlockBlobResponse.readableStreamBody != undefined) {
          // get redeemed request content
          const rawDataRequest = await this.streamToString(
            downloadBlockBlobResponse.readableStreamBody
          );

          // do redeem request
          const rawDataResponse = await fetch(parsedFlags.apiUrl, {
            method: "POST",
            headers: {
              "Ocp-Apim-Subscription-Key": parsedFlags.apiKey,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(rawDataRequest)
          });

          // save response status code
          outputResult.statusCode = rawDataResponse.status.toString();

          // pause 10 seconds to avoid to flood the backend server and 429 statusCode response
          await this.delay(10 * 1000);
        }

        // push reprocessed request in results array
        outputResults.push(outputResult);
      }

      cli.action.stop();

      cli.table(
        outputResults,
        {
          redeemedRequest: {
            header: "redeemedRequest"
          },
          statusCode: {
            header: "statusCode"
          }
        },
        {
          printLine: this.log,
          ...parsedFlags
        }
      );
    } catch (e) {
      this.error(e);
    }
  }

  // A helper function used to add a pause in the flow
  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // A helper function used to read a Node.js readable stream into a string
  private async streamToString(readableStream: NodeJS.ReadableStream) {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      readableStream.on("data", data => {
        chunks.push(data.toString());
      });
      readableStream.on("end", () => {
        resolve(chunks.join(""));
      });
      readableStream.on("error", reject);
    });
  }
}
