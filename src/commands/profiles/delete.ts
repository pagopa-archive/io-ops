import * as cosmos from "@azure/cosmos";
import { Command, Flags, Args } from "@oclif/core";
import * as storage from "azure-storage";
import cli from "cli-ux";
import * as O from "fp-ts/lib/Option";
import * as E from "fp-ts/lib/Either";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import {
  getCosmosWriteConnection,
  getStorageConnection,
  IAzureConfig,
  pickAzureConfig,
} from "../../utils/azure";
import { sequential, sequentialSum } from "../../utils/promise";
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import {
  asyncIteratorToArray,
  flattenAsyncIterator,
  mapAsyncIterable,
} from "@pagopa/io-functions-commons/dist/src/utils/async";

interface IContainer {
  query: string;
  containerName: string;
  // tslint:disable-next-line: no-any
  partitionKeySelector: (item: any) => string;
  queryParamName: string;
  queryOptions?: cosmos.FeedOptions;
}
/**
 * define a delete operation
 * A primary delete operation may generate secondary delete operations required to keep
 * the consistency of the data model.
 * a related operation is when we have to retrieve items starting from a given set
 * .e.g: the delete operation "messages" has the related delete operation "message-status"
 * because items from "message-status" can be retrieved starting from "message" items
 */
type DeleteOp = {
  relatedOps: ReadonlyArray<IContainer>;
  queryParamValue: string;
  deleteBlobs: boolean;
} & IContainer;

export default class ProfileDelete extends Command {
  public static description = "Delete a profile";

  public static flags = {
    all: Flags.boolean({
      char: "a",
      description: "delete items in all containers",
      required: false,
      default: false,
    }),
    profile: Flags.boolean({
      char: "p",
      description: "delete items in profile container",
      required: false,
      default: false,
    }),
    message: Flags.boolean({
      char: "m",
      description: "delete items in message container",
      required: false,
      default: false,
    }),
    notification: Flags.boolean({
      char: "n",
      description: "delete items in notification container",
      required: false,
      default: false,
    }),
    service: Flags.boolean({
      char: "s",
      description: "delete items in service container",
      required: false,
      default: false,
    }),
  };

  // tslint:disable-next-line:readonly-array
  public static args = {
    fiscalCode: Args.string({
      name: "fiscalCode",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ProfileDelete);
    const fiscalCodeOrErrors = FiscalCode.decode(args.fiscalCode);
    if (E.isLeft(fiscalCodeOrErrors)) {
      this.error("the provided fiscal code is not valid");
      return;
    }
    const fiscalCode = fiscalCodeOrErrors.right;
    const fiscalCodeParamName = "@fiscalCode";
    const messageIdParamName = "@messageId";
    const notificationIdParamName = "@messageId";
    // define used queries
    const selectFromFiscalCode = `SELECT * FROM c WHERE c.fiscalCode = ${fiscalCodeParamName}`;
    const azureConfig = await pickAzureConfig();
    // retrieve azure credentials
    cli.action.start("Retrieving cosmosdb credentials");
    const [connection, storageConnection] = await Promise.all([
      getCosmosWriteConnection(
        azureConfig.resourceGroup,
        azureConfig.cosmosName
      ),
      getStorageConnection(azureConfig.storageName),
    ]);
    cli.action.stop();

    // define all delete operations
    const deleteOps: ReadonlyArray<DeleteOp> = [
      {
        containerName: azureConfig.cosmosProfilesContainer,
        partitionKeySelector: (i) => i.fiscalCode,
        query: selectFromFiscalCode,
        queryParamName: fiscalCodeParamName,
        queryParamValue: fiscalCode,
        relatedOps: [],
        deleteBlobs: false,
      },
      {
        containerName: azureConfig.cosmosMessagesContainer,
        partitionKeySelector: (i) => i.fiscalCode,
        query: selectFromFiscalCode,
        queryParamName: fiscalCodeParamName,
        queryParamValue: fiscalCode,
        relatedOps: [
          {
            containerName: azureConfig.cosmosMessageStatusContainer,
            partitionKeySelector: (i) => i.messageId,
            query: `SELECT * from c where c.messageId = ${messageIdParamName}`,
            queryParamName: messageIdParamName,
          },
        ],
        deleteBlobs: true,
      },
      {
        containerName: azureConfig.cosmosNotificationContainer,
        partitionKeySelector: (i) => i.messageId,
        query: selectFromFiscalCode,
        queryParamName: fiscalCodeParamName,
        queryParamValue: fiscalCode,
        queryOptions: {},
        relatedOps: [
          {
            containerName: azureConfig.cosmosNotificationStatusContainer,
            partitionKeySelector: (i) => i.notificationId,
            query: `SELECT * from c where c.notificationId = ${notificationIdParamName}`,
            queryParamName: notificationIdParamName,
          },
        ],
        deleteBlobs: false,
      },
    ];

    // define the delete operation set from given inputs
    // if all flag is enabled all above defined options will be procecess
    // otherwhise only operations specified in the given flags
    const deleteOpsToProcess = flags.all
      ? deleteOps
      : deleteOps.filter((_) => {
          switch (_.containerName) {
            case "messages":
            case "message-status":
              return flags.message;
            case "notifications":
            case "notification-status":
              return flags.notification;
            case "profiles":
              return flags.profile;
          }
        });

    if (deleteOpsToProcess.length === 0) {
      cli.error("please specify at least one container");
    }

    // init cosmos client
    const cosmosConnectionString = getRequiredStringEnv(
      "COSMOS_CONNECTION_STRING"
    );
    const client = new cosmos.CosmosClient(cosmosConnectionString);

    const database = client.database(azureConfig.cosmosDatabaseName);

    // apply processDeleteOpt to each delete operation
    const deletedItemsCount = await sequentialSum(
      deleteOpsToProcess,
      (item) => {
        const deleteCount = this.processDeleteOpt(
          azureConfig,
          database,
          storageConnection,
          item
        ).then(O.getOrElse(() => 0));
        // add line separator
        cli.log("");
        return deleteCount;
      }
    );

    cli.log(
      deletedItemsCount > 0
        ? `${deletedItemsCount} items successfully deleted`
        : `no items have been deleted`
    );
  }

  /**
   * delete the given items from the given container
   * @param items the cosmos items to delete
   * @param container the continer where items are placed
   * @param partitionKeySelector the partion key function
   */
  private async deleteItems(
    items: ReadonlyArray<cosmos.Item>,
    container: cosmos.Container,
    // tslint:disable-next-line: no-any
    partitionKeySelector: (item: any) => string
  ): Promise<number> {
    cli.action.start(`Deleting ${items.length} items from ${container.id}`);
    const deletedItems = await sequentialSum(items, async (currentOp) =>
      container
        .item(currentOp.id, partitionKeySelector(currentOp))
        .delete()
        .then((_) => 1)
        .catch((e) => {
          cli.log(e);
          return 0;
        })
    );
    cli.action.stop();
    return deletedItems;
  }

  /**
   * for each item in relatedItems take the item contained in deleteOp container and delete them,
   * return the number of delete items
   * e.g.: messages delete operation: it deletes items from "messages" container.
   * It also has a related delete operation: this operation has its own container "messages-status".
   * This function iterates over "messages" items (relatedItems) and retrieves the related ones (giving message id)
   * from "message-status" container. Then, it deletes them
   * @param database the cosmos database where the container is placed
   * @param relatedItems the items to retrieve from container specified in deleteOp
   * @param deleteOp the delete operation
   */
  private async processInnerDeleteOpt(
    database: cosmos.Database,
    relatedItems: ReadonlyArray<cosmos.Item>,
    deleteOp: IContainer
  ): Promise<number> {
    // get the container of the related delete operation
    const relatedContainer = database.container(deleteOp.containerName);
    const queryResults = await sequential(relatedItems, async (i) => {
      const response = relatedContainer.items.query({
        parameters: [{ name: deleteOp.queryParamName, value: i.id }],
        query: deleteOp.query,
      });
      const item = (await response.fetchNext()).resources[0];
      return item || undefined;
    });
    // remove from queyResults all items that are undefined (query result was empty)
    const innerItems = queryResults.reduce((acc, curr) => {
      if (curr !== undefined) {
        return [...acc, curr];
      }
      return acc;
    }, []);
    // inner items must be delete without user confirmation
    // this because related items have been already deleted
    return innerItems.length > 0
      ? await this.deleteItems(
          innerItems,
          relatedContainer,
          deleteOp.partitionKeySelector
        )
      : 0;
  }

  /**
   * process the given delete operation, retrieve items from delete operation container and delete them
   * @param database the cosmos database where deleteOp.container is placed
   * @param deleteOp the delete operation to process
   */
  private async processDeleteOpt(
    azureConfig: IAzureConfig,
    database: cosmos.Database,
    storageConnection: string,
    deleteOp: DeleteOp
  ): Promise<O.Option<number>> {
    cli.action.start(
      `Selecting items from "${deleteOp.containerName}" container...`
    );
    // get the container of the delete operation
    const container = database.container(deleteOp.containerName);
    // query the container
    const responseIterator = container.items
      .query(
        {
          parameters: [
            { name: deleteOp.queryParamName, value: deleteOp.queryParamValue },
          ],
          query: deleteOp.query,
        },
        deleteOp.queryOptions
      )
      .getAsyncIterator();

    const itemsList = await asyncIteratorToArray(
      flattenAsyncIterator(
        mapAsyncIterable(
          responseIterator,
          (feedResponse) => feedResponse.resources
        )[Symbol.asyncIterator]()
      )
    );

    if (itemsList === undefined || itemsList.length === 0) {
      cli.action.stop(
        `No items found in "${deleteOp.containerName}" container`
      );
      return O.none;
    }
    cli.action.stop();
    const confirm = await cli.confirm(
      `${itemsList.length} items found in "${deleteOp.containerName}" container! Are you sure you want to proceed to delete?`
    );
    if (!confirm) {
      return O.none;
    }
    // user confirms to proceed to delete
    try {
      const deleteItemsCount = await this.deleteItems(
        itemsList,
        container,
        deleteOp.partitionKeySelector
      );

      // apply processInnerDeleteOpt to each deleteOp.relatedOps items
      const deleteInnerItems = () =>
        sequentialSum(deleteOp.relatedOps, (item) =>
          this.processInnerDeleteOpt(database, itemsList, item)
        );
      const deleteInnerItemsCount =
        deleteOp.relatedOps.length > 0 ? await deleteInnerItems() : 0;

      // check if we have to delete blobs too, if yes ask if user wants to delete
      const confirmDeleteMessageContent =
        deleteOp.deleteBlobs &&
        (await cli.confirm(
          `Are you sure to delete items in message-content storage?`
        ));
      const deleteMessageContentCount = confirmDeleteMessageContent
        ? await this.processDeleteBlobOpt(
            storageConnection,
            azureConfig.storageMessagesContainer,
            itemsList
          )
        : 0;
      return O.some(
        deleteInnerItemsCount + deleteItemsCount + deleteMessageContentCount
      );
    } catch (error) {
      this.error(String(error));
      return O.none;
    }
  }

  private async processDeleteBlobOpt(
    storageConnection: string,
    storageMessagesContainer: string,
    items: ReadonlyArray<cosmos.Item>
  ): Promise<number> {
    // get the blob service
    const blobService = storage.createBlobService(storageConnection);
    // a function to check if a blob item exists
    const doesBlobExist = (id: string) =>
      new Promise<storage.BlobService.BlobResult>((resolve, reject) =>
        blobService.doesBlobExist(
          storageMessagesContainer,
          id,
          (err, blobResult) => (err ? reject(err) : resolve(blobResult))
        )
      );
    // a function to mark a blob item for deletion (The blob is later deleted during cosmos garbage collection)
    const deleteBlob = (id: string) =>
      new Promise<storage.ServiceResponse>((resolve, reject) =>
        blobService.deleteBlob(storageMessagesContainer, id, (err, response) =>
          err ? reject(err) : resolve(response)
        )
      );
    // iterate over items and for each item (giving item id) check if
    // the corresponding blob exists. If yes, delete it
    const deletedBlobItems = await sequentialSum(items, async (item) => {
      const blobId = `${item.id}.json`;
      const blobExistResponse = await doesBlobExist(blobId);
      return blobExistResponse.exists && (await deleteBlob(blobId)).isSuccessful
        ? 1
        : 0;
    });
    cli.log(
      deletedBlobItems > 0
        ? `${deletedBlobItems} blob items successfully deleted`
        : `no blob items have been deleted`
    );
    return deletedBlobItems;
  }
}
