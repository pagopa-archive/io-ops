import { Command, flags } from "@oclif/command";
import { BlobServiceClient } from "@azure/storage-blob";
import * as fs from "fs";
import cli from "cli-ux";
import { pickAzureConfig, getStorageConnection } from "../../utils/azure";

export default class GetRedeemedBonuses extends Command {
  public static description = "Download redeemed bonuses";

  public static args = [];

  public static flags = {
    outputDir: flags.string({
      char: "o",
      default: "tmp",
      description: "Output directory",
      required: true
    }),
    containerFolder: flags.string({
      char: "c",
      description: "Container folder",
      required: true
    })
  };

  public async run(): Promise<void> {
    const { flags: parsedFlags } = this.parse(GetRedeemedBonuses);

    try {
      const config = await pickAzureConfig();

      const storageConnection = await getStorageConnection(config.storageName);

      const blobServiceClient = BlobServiceClient.fromConnectionString(
        storageConnection
      );

      const containerClient = blobServiceClient.getContainerClient(
        config.storageBonusRedeemedContainer
      );

      if (
        !fs.existsSync(
          parsedFlags.outputDir + "/" + parsedFlags.containerFolder
        )
      ) {
        fs.mkdirSync(
          parsedFlags.outputDir + "/" + parsedFlags.containerFolder,
          {
            recursive: true
          }
        );
      }

      this.log("\nListing blobs...");
      cli.action.start("Downloading blobs...");
      // List the blob(s) in the container.
      for await (const blob of containerClient.listBlobsFlat({
        prefix: parsedFlags.containerFolder
      })) {
        this.log("\t", blob.name);
        const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
        const response = await blockBlobClient.downloadToFile(
          parsedFlags.outputDir + "/" + blob.name
        );
      }
      cli.action.stop();
    } catch (e) {
      this.error(e);
    }
  }
}
