import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import * as storage from "azure-storage";
import cli from "cli-ux";
import { none, Option, some } from "fp-ts/lib/Option";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import {
  config,
  getCosmosWriteConnection,
  getStorageConnection
} from "../../utils/azure";
import { sequentialSum, sequential } from "../../utils/promise";

type Containers =
  | "profiles"
  | "messages"
  | "message-status"
  | "notifications"
  | "notification-status"
  | "sender-services";

type Container = {
  query: string;
  containerName: Containers;
  partitionKeySelector: (item: any) => string;
  queryParamName: string;
  queryParamValue: string;
  queryOptions?: cosmos.FeedOptions;
};
/**
 * define a delete operation
 * a delete operation should have or not related delete operations
 * a related operation is when we have to retrieve items starting from a given set
 * .e.g: the delete operation "messages" has the related delete operation "message-status"
 * because items from "message-status" can be retrieved starting from "message" items
 */
type DeleteOp = {
  relatedOps: ReadonlyArray<Container>;
  deleteBlobs: boolean;
} & Container;

export default class ProfileDelete extends Command {
  public static description = "Delete a profile";

  public static flags = {
    all: flags.boolean({
      char: "a",
      description: "delete items from all containers",
      required: false,
      default: false
    }),
    profile: flags.boolean({
      char: "p",
      description: "delete items from profile container",
      required: false,
      default: false
    }),
    message: flags.boolean({
      char: "m",
      description: "delete items from message container",
      required: false,
      default: false
    }),
    notification: flags.boolean({
      char: "n",
      description: "delete items from notification container",
      required: false,
      default: false
    }),
    service: flags.boolean({
      char: "s",
      description: "delete items from service container",
      required: false,
      default: false
    })
  };

  // tslint:disable-next-line:readonly-array
  public static args = [
    {
      name: "fiscalCode",
      required: true
    }
  ];

  public async run(): Promise<void> {
    const { args, flags: parsedFlags } = this.parse(ProfileDelete);
    const fiscalCodeOrErrors = FiscalCode.decode(args.fiscalCode);
    if (fiscalCodeOrErrors.isLeft()) {
      this.error("provide a valid fiscal code");
      return;
    }
    const fiscalCode = fiscalCodeOrErrors.value;

    // define used queries
    const selectFromFiscalCode =
      "SELECT * FROM c WHERE c.fiscalCode = @fiscalCode";
    const paramsFromFiscalCode: cosmos.SqlParameter[] = [
      { name: "@fiscalCode", value: fiscalCode }
    ];

    const selectFromRecipientFiscalCode =
      "SELECT * FROM c WHERE c.recipientFiscalCode = @recipientFiscalCode";
    const paramsFromRecipientFiscalCode: cosmos.SqlParameter[] = [
      { name: "@recipientFiscalCode", value: fiscalCode }
    ];

    // retrieve azure credentials
    cli.action.start("Retrieving cosmosdb credentials");
    const [connection, storageConnection] = await Promise.all([
      getCosmosWriteConnection("agid-rg-test", "agid-cosmosdb-test"),
      getStorageConnection(config.storageName)
    ]);
    cli.action.stop();

    const fiscalCodePartitionKey = "/fiscalCode";
    const messageIdPartitionKey = "/messageId";
    // define all delete operations
    const deleteOps: ReadonlyArray<DeleteOp> = [
      {
        containerName: "profiles",
        partitionKeySelector: i => i.fiscalCode,
        query: selectFromFiscalCode,
        queryParamName: "@fiscalCode",
        queryParamValue: fiscalCode,
        relatedOps: [],
        deleteBlobs: false
      },
      {
        containerName: "messages",
        partitionKeySelector: i => i.fiscalCode,
        query: selectFromFiscalCode,
        queryParamName: "@fiscalCode",
        queryParamValue: fiscalCode,
        relatedOps: [
          {
            containerName: "message-status",
            partitionKeySelector: i => i.messageId,
            query: "SELECT * from c where c.messageId = @messageId",
            queryParamName: "@messageId",
            queryParamValue: ""
          }
        ],
        deleteBlobs: true
      },
      {
        containerName: "notifications",
        partitionKeySelector: i => i.messageId,
        query: selectFromFiscalCode,
        queryParamName: "@fiscalCode",
        queryParamValue: fiscalCode,
        queryOptions: { enableCrossPartitionQuery: true },
        relatedOps: [
          {
            containerName: "notification-status",
            partitionKeySelector: i => i.notificationId,
            query: "SELECT * from c where c.notificationId = @notificationId",
            queryParamName: "@notificationId",
            queryParamValue: ""
          }
        ],
        deleteBlobs: false
      },
      {
        containerName: "sender-services",
        partitionKeySelector: i => i.recipientFiscalCode,
        query: selectFromRecipientFiscalCode,
        queryParamName: "@recipientFiscalCode",
        queryParamValue: fiscalCode,
        relatedOps: [],
        deleteBlobs: false
      }
    ];

    // define the delete operation set from given inputs
    // if all flag is enabled all above defined options will be procecess
    // otherwhise only operations specified in the given flags
    const deleteOpsToProcess = parsedFlags.all
      ? deleteOps
      : deleteOps.filter(_ => {
          switch (_.containerName) {
            case "messages":
            case "message-status":
              return parsedFlags.message;
            case "notifications":
            case "notification-status":
              return parsedFlags.notification;
            case "profiles":
              return parsedFlags.profile;
            case "sender-services":
              return parsedFlags.service;
          }
        });

    if (deleteOpsToProcess.length === 0) {
      cli.error("please specify at least one container");
    }

    // init cosmos client
    const client = new cosmos.CosmosClient({
      endpoint: connection.endpoint,
      auth: { key: connection.key }
    });

    const database = client.database("agid-documentdb-test");

    // apply processDeleteOpt to each delete operation
    const deletedItemsCount = await sequentialSum(deleteOpsToProcess, item =>
      this.processDeleteOpt(database, storageConnection, item).then(_ =>
        _.getOrElse(0)
      )
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
   */
  private async deleteItems(
    items: ReadonlyArray<cosmos.Item>,
    container: cosmos.Container,
    partitionKey: (item: any) => string
  ): Promise<number> {
    cli.action.start(`Deleting ${items.length} items from ${container.id}`);
    const deletedItems = await sequentialSum(items, async currentOp => {
      const result = container
        .item(currentOp.id, partitionKey(currentOp))
        .delete()
        .then(_ => 1)
        .catch(e => {
          cli.log(e);
          return 0;
        });
      await cli.anykey();
      return result;
    });
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
    deleteOp: Container
  ): Promise<number> {
    // get the container of the related delete operation
    const relatedContainer = database.container(deleteOp.containerName);
    const queryResults = await sequential(relatedItems, async i => {
      const response = relatedContainer.items.query({
        parameters: [{ name: deleteOp.queryParamName, value: i.id }],
        query: deleteOp.query
      });
      const { result: itemsList } = await response.toArray();
      return itemsList !== undefined && itemsList.length > 0
        ? itemsList[0]
        : undefined;
    });
    const innerItems = queryResults.reduce((acc, curr) => {
      if (curr !== undefined) {
        return [...acc, curr];
      }
      return acc;
    }, []);
    // check if there are items to delete
    if (innerItems.length > 0) {
      const confirmInner = await cli.confirm(
        `${innerItems.length} items found in "${
          deleteOp.containerName
        }" container! Are you sure you want to proceed to delete?`
      );
      if (confirmInner) {
        return await this.deleteItems(
          innerItems,
          relatedContainer,
          deleteOp.partitionKeySelector
        );
      }
    }
    return 0;
  }

  /**
   * process the given delete operation, retrieve items from delete operation container and delete them
   * @param database the cosmos database where deleteOp.container is placed
   * @param deleteOp the delete operation to process
   */
  private async processDeleteOpt(
    database: cosmos.Database,
    storageConnection: string,
    deleteOp: DeleteOp
  ): Promise<Option<number>> {
    cli.action.start(
      `Selecting items from "${deleteOp.containerName}" container...`
    );
    // get the container of the delete operation
    const container = database.container(deleteOp.containerName);
    // query the container
    const response = container.items.query(
      {
        parameters: [
          { name: deleteOp.queryParamName, value: deleteOp.queryParamValue }
        ],
        query: deleteOp.query
      },
      deleteOp.queryOptions
    );
    const { result: itemsList } = await response.toArray();
    if (itemsList === undefined || itemsList.length === 0) {
      cli.action.stop(`No items found in ${deleteOp.containerName}`);
      return none;
    }
    cli.action.stop();
    const confirm = await cli.confirm(
      `${itemsList.length} items found in "${
        deleteOp.containerName
      }" container! Are you sure you want to proceed to delete?`
    );
    if (!confirm) {
      return none;
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
        sequentialSum(deleteOp.relatedOps, item =>
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
        ? await this.processDeleteBlobOpt(storageConnection, itemsList)
        : 0;
      return some(
        deleteInnerItemsCount + deleteItemsCount + deleteMessageContentCount
      );
    } catch (error) {
      this.error(error.body);
      return none;
    }
  }

  private async processDeleteBlobOpt(
    storageConnection: string,
    items: ReadonlyArray<cosmos.Item>
  ): Promise<number> {
    // get the blob service
    const blobService = storage.createBlobService(storageConnection);
    // a function to check if a blob item exists
    const doesBlobExist = (id: string) =>
      new Promise<storage.BlobService.BlobResult>((resolve, reject) =>
        blobService.doesBlobExist(
          config.storageMessagesContainer,
          id,
          (err, blobResult) => (err ? reject(err) : resolve(blobResult))
        )
      );
    // a function to mark a blob item for deletion (The blob is later deleted during cosmos garbage collection)
    const deleteBlob = (id: string) =>
      new Promise<storage.ServiceResponse>((resolve, reject) =>
        blobService.deleteBlob(
          config.storageMessagesContainer,
          id,
          (err, response) => (err ? reject(err) : resolve(response))
        )
      );
    // iterate over items and for each item (giving item id) check if
    // the corresponding blob exists. If yes, delete it
    return await sequentialSum(items, async item => {
      const blobId = `${item.id}.json`;
      const blobExistResponse = await doesBlobExist(blobId);
      const deleteResult = (await deleteBlob(blobId)).isSuccessful;
      await cli.anykey();
      return blobExistResponse.exists && deleteResult ? 1 : 0;
    });
  }
}
