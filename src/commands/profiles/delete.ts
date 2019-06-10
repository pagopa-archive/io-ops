import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import * as storage from "azure-storage";
import cli from "cli-ux";
import { none, Option, some } from "fp-ts/lib/Option";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import {
  config,
  getCosmosConnection,
  getStorageConnection
} from "../../utils/azure";
import { sequentialSum } from "../../utils/promise";

type Containers =
  | "profiles"
  | "messages"
  | "message-status"
  | "notifications"
  | "notification-status"
  | "sender-services";

type DeleteOpRelated = { containerName: string };
/**
 * define a delete operation
 * a delete operation should have or not related delete operations
 * a related operation is when we have to retrieve items starting from a given set
 * .e.g: the delete operation "messages" has the related delete operation "message-status"
 * because items from "message-status" can be retrieved starting from "message" items
 */
type DeleteOp = {
  containerName: Containers;
  relatedOps: ReadonlyArray<DeleteOpRelated>;
  query: string;
  queryParameters: cosmos.SqlParameter[];
  queryOptions?: cosmos.FeedOptions;
  deleteBlobs: boolean;
};

export default class ProfileDelete extends Command {
  static description = "Delete a profile";

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

  async run() {
    const { args, flags } = this.parse(ProfileDelete);
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
      getCosmosConnection("agid-rg-test", "agid-cosmosdb-test"),
      getStorageConnection(config.storageName)
    ]);
    cli.action.stop();

    // define all delete operations
    const deleteOps: ReadonlyArray<DeleteOp> = [
      {
        containerName: "profiles",
        query: selectFromFiscalCode,
        queryParameters: paramsFromFiscalCode,
        relatedOps: [],
        deleteBlobs: false
      },
      {
        containerName: "messages",
        query: selectFromFiscalCode,
        queryParameters: paramsFromFiscalCode,
        relatedOps: [
          {
            containerName: "message-status"
          }
        ],
        deleteBlobs: true
      },
      {
        containerName: "notifications",
        query: selectFromFiscalCode,
        queryParameters: paramsFromFiscalCode,
        queryOptions: { enableCrossPartitionQuery: true },
        relatedOps: [
          {
            containerName: "notification-status"
          }
        ],
        deleteBlobs: false
      },
      {
        containerName: "sender-services",
        query: selectFromRecipientFiscalCode,
        queryParameters: paramsFromRecipientFiscalCode,
        relatedOps: [],
        deleteBlobs: false
      }
    ];

    // define the delete operation set from given inputs
    // if all flag is enabled all above defined options will be procecess
    // otherwhise only operations specified in the given flags
    const deleteOpsToProcess = flags.all
      ? deleteOps
      : deleteOps.filter(_ => {
          switch (_.containerName) {
            case "messages":
            case "message-status":
              return flags.message;
            case "notifications":
            case "notification-status":
              return flags.notification;
            case "profiles":
              return flags.profile;
            case "sender-services":
              return flags.service;
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
    container: cosmos.Container
  ): Promise<number> {
    cli.action.start(`Deleting ${items.length} items from ${container.id}`);
    const deletedItems = await sequentialSum(items, currentOp =>
      container
        .item(currentOp.id)
        .delete()
        .then(_ => 1)
        .catch(e => {
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
    deleteOp: DeleteOpRelated
  ): Promise<number> {
    // get the container of the related delete operation
    const relatedContainer = database.container(deleteOp.containerName);
    // retrieve items from the container giving the message id
    const items = relatedItems.map(m => relatedContainer.item(m.id));
    // check if there are items to delete
    if (items.length > 0) {
      const confirmInner = await cli.confirm(
        `${items.length} items found in "${
          deleteOp.containerName
        }" container! Are you sure you want to proceed to delete?`
      );
      if (confirmInner) {
        return await this.deleteItems(items, relatedContainer);
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
        parameters: deleteOp.queryParameters,
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
      const deleteItems = await this.deleteItems(itemsList, container);

      // tslint:disable-next-line: no-let
      let deleteInnerItems = 0;
      // check if there are some related operations to process
      if (deleteOp.relatedOps.length > 0) {
        // apply processInnerDeleteOpt to each deleteOp.relatedOps items
        deleteInnerItems = await sequentialSum(deleteOp.relatedOps, item =>
          this.processInnerDeleteOpt(database, itemsList, item)
        );
      }
      // check if we have to delete blobs too
      if (deleteOp.deleteBlobs) {
        const confirmBlobDeletion = await cli.confirm(
          `Are you sure to delete items in message-content storage?`
        );
        if (confirmBlobDeletion) {
          const deletedBlobItems = await this.processDeleteBlobOpt(
            storageConnection,
            itemsList
          );
          cli.log(
            deletedBlobItems > 0
              ? `${deletedBlobItems} blob items successfully deleted`
              : `no blob items are been deleted`
          );
          deleteInnerItems += deletedBlobItems;
        }
      }
      return some(deleteItems + deleteInnerItems);
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
      const blobExist = await doesBlobExist(blobId);
      if (blobExist.exists) {
        return (await deleteBlob(blobId)).isSuccessful ? 1 : 0;
      }
      return 0;
    });
  }
}
