import * as cosmos from "@azure/cosmos";
import { Command, flags } from "@oclif/command";
import cli from "cli-ux";
import { none, Option, some } from "fp-ts/lib/Option";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import { getCosmosConnection } from "../../utils/azure";

type Containers =
  | "profiles"
  | "messages"
  | "message-status"
  | "notifications"
  | "notification-status"
  | "sender-services";

type DeleteOpInner = { containerName: string };
/**
 * define a delete operation
 * a delete operation should have or not related delete operations
 * a related operation is when we have to retrieve items starting from a given set
 * .e.g: the delete operation "messages" has the related delete operation "message-status"
 * because items from "message-status" can be retrieved starting from "message" items
 */
type DeleteOp = {
  containerName: Containers;
  relatedOps: ReadonlyArray<DeleteOpInner>;
  query: string;
  queryParameters: cosmos.SqlParameter[];
  queryOptions?: cosmos.FeedOptions;
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

    // define all delete operations
    const deleteOps: ReadonlyArray<DeleteOp> = [
      {
        containerName: "profiles",
        query: selectFromFiscalCode,
        queryParameters: paramsFromFiscalCode,
        relatedOps: []
      },
      {
        containerName: "messages",
        query: selectFromFiscalCode,
        queryParameters: paramsFromFiscalCode,
        relatedOps: [
          {
            containerName: "message-status"
          }
        ]
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
        ]
      },
      {
        containerName: "sender-services",
        query: selectFromRecipientFiscalCode,
        queryParameters: paramsFromRecipientFiscalCode,
        relatedOps: []
      }
    ];

    // define the delete operation set from given inputs
    // if all flag is enabled all above defined option will be procecess
    // otherwhise only that operations specified in given flags
    const deleteOpsToProcess = flags.all
      ? deleteOps
      : deleteOps.filter(x => {
          switch (x.containerName) {
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
      cli.error("please specify at least 1 container");
    }
    // retrive local azure credianial
    cli.action.start("Retrieving cosmosdb credentials");
    const { endpoint, key } = await getCosmosConnection(
      "agid-rg-test",
      "agid-cosmosdb-test"
    );
    cli.action.stop();

    const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
    const database = client.database("agid-documentdb-test");

    // tslint:disable-next-line: no-let
    let countDeleteItems = 0;
    const deleteOperations = (ops: ReadonlyArray<DeleteOp>) => {
      return ops.reduce((p, file) => {
        return p.then(async () => {
          const deleteResult = await this.processDeleteOpt(database, file);
          if (deleteResult.isSome()) {
            countDeleteItems += deleteResult.value;
          }
        });
      }, Promise.resolve()); // initial
    };
    await deleteOperations(deleteOpsToProcess);
    if (countDeleteItems > 0) {
      cli.log(`${countDeleteItems} items successfully deleted`);
    }
  }

  /**
   * delete the given items from the given container
   * @param items the cosmos Items to delete
   * @param container the continer where items are placed
   */
  private async deleteItems(
    items: ReadonlyArray<cosmos.Item> | undefined,
    container: cosmos.Container
  ): Promise<number> {
    // tslint:disable-next-line: no-let
    let deletedItems = 0;
    if (items === undefined) {
      return deletedItems;
    }
    cli.action.start(`Deleting ${items.length} items from ${container.id}`);
    for (const item of items) {
      deletedItems++;
      // DELETE here -> await container.item(item.id).delete();
    }
    cli.action.stop();
    return deletedItems;
  }

  /**
   * for each item in relatedItems take the item contained in deleteOp container and delete them,
   * return the number of delete items
   * @param database the cosmos database where the container is placed
   * @param relatedItems the items to retrive from container specified in deleteOp
   * @param deleteOp the delete operation
   */
  private async processInnerDeleteOpt(
    database: cosmos.Database,
    relatedItems: ReadonlyArray<cosmos.Item>,
    deleteOp: DeleteOpInner
  ): Promise<number> {
    const innerContainer = database.container(deleteOp.containerName);
    const innerItems = relatedItems.map(m => innerContainer.item(m.id));
    if (innerItems.length > 0) {
      const confirmInner = await cli.confirm(
        `${innerItems.length} items found in "${
          deleteOp.containerName
        }" container! Are you sure you want to proceed to delete?`
      );
      if (confirmInner) {
        return await this.deleteItems(innerItems, innerContainer);
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
    deleteOp: DeleteOp
  ): Promise<Option<number>> {
    try {
      cli.action.start(
        `Selecting items from "${deleteOp.containerName}" container...`
      );
      const container = database.container(deleteOp.containerName);
      const response = container.items.query(
        {
          parameters: deleteOp.queryParameters,
          query: deleteOp.query
        },
        deleteOp.queryOptions
      );
      const { result: itemsList } = await response.toArray();
      if (itemsList === undefined) {
        cli.action.stop(`No items found in ${deleteOp.containerName}...`);
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
      const deleteItems = await this.deleteItems(itemsList, container);
      // tslint:disable-next-line: no-let
      let deleteInnerItems = 0;
      // check if there are some related operations to process
      if (deleteOp.relatedOps.length > 0) {
        const deleteOperations = (ops: ReadonlyArray<DeleteOpInner>) => {
          return ops.reduce((p, currentOp) => {
            return p.then(async () => {
              deleteInnerItems = await this.processInnerDeleteOpt(
                database,
                itemsList,
                currentOp
              );
            });
          }, Promise.resolve()); // initial
        };
        await deleteOperations(deleteOp.relatedOps);
      }
      return some(deleteItems + deleteInnerItems);
    } catch (error) {
      this.error(error.body);
      return none;
    }
  }
}