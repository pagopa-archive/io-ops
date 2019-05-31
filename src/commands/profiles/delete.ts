import * as cosmos from "@azure/cosmos";
import { Command } from "@oclif/command";
import cli from "cli-ux";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import { getCosmosConnection } from "../../utils/azure";

export default class ProfileDelete extends Command {
  static description = "Delete a profile";

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

    try {
      cli.action.start("Retrieving cosmosdb credentials");
      const { endpoint, key } = await getCosmosConnection(
        "agid-rg-test",
        "agid-cosmosdb-test"
      );
      cli.action.stop();

      const client = new cosmos.CosmosClient({ endpoint, auth: { key } });
      const database = client.database("agid-documentdb-test");
      const containerProfile = database.container("profiles");
      const containerMessages = database.container("messages");
      const containerMessagesStatus = database.container("message-status");
      const containerNotifications = database.container("notifications");
      const containerServiceSender = database.container("sender-services");
      const containerNotificationStatus = database.container(
        "notification-status"
      );

      cli.action.start("Querying profiles...");
      // first we check if the required profile exists
      const response = containerProfile.items.query({
        parameters: [{ name: "@fiscalCode", value: fiscalCode }],
        query: "SELECT VALUE COUNT(1) FROM c WHERE c.fiscalCode = @fiscalCode"
      });
      const result = (await response.toArray()).result;
      cli.action.stop();

      // profile doesn't exist
      if (result === undefined || result[0] === 0) {
        this.error(`No profile found with fiscal code ${fiscalCode}`);
        return;
      }
      cli.log("A valid profile found!");
      // last chance to abort
      await cli.anykey();

      const selectFromFiscalCode =
        "SELECT * FROM c WHERE c.fiscalCode = @fiscalCode";
      const paramsFromFiscalCode: cosmos.SqlParameter[] = [
        { name: "@fiscalCode", value: fiscalCode }
      ];

      // delete items from profile container
      const responseProfile = containerProfile.items.query({
        parameters: paramsFromFiscalCode,
        query: selectFromFiscalCode
      });
      const { result: itemProfileList } = await responseProfile.toArray();
      await this.deleteItems(itemProfileList, containerProfile);

      // delete items from messages container
      const responseMessages = containerMessages.items.query({
        parameters: paramsFromFiscalCode,
        query: selectFromFiscalCode
      });
      const { result: itemMessagesList } = await responseMessages.toArray();
      await this.deleteItems(itemMessagesList, containerMessages);

      // if there are messages we need to clean also: notifications and notification-status
      if (itemMessagesList !== undefined) {
        const getItemsFromId = (container: cosmos.Container, items: any[]) =>
          items.map(m => container.item(m.id));

        // delete items from messages container
        const itemMessagesStatusList = getItemsFromId(
          containerMessagesStatus,
          itemMessagesList
        );
        await this.deleteItems(itemMessagesStatusList, containerMessagesStatus);

        // delete items from notification-status container
        const itemNotificationStatusList = getItemsFromId(
          containerNotificationStatus,
          itemMessagesList
        );
        await this.deleteItems(
          itemNotificationStatusList,
          containerNotificationStatus
        );

        // delete items from notification container
        const responseNotification = containerNotifications.items.query(
          {
            parameters: paramsFromFiscalCode,
            query: selectFromFiscalCode
          },
          { enableCrossPartitionQuery: true }
        );
        const {
          result: itemNotificationList
        } = await responseNotification.toArray();
        await this.deleteItems(itemNotificationList, containerNotifications);
      }

      // delete items from service-sender container
      const responseServiceSenders = containerServiceSender.items.query({
        parameters: [{ name: "@recipientFiscalCode", value: fiscalCode }],
        query:
          "SELECT * FROM c WHERE c.recipientFiscalCode = @recipientFiscalCode"
      });
      const {
        result: itemServiceSendersList
      } = await responseServiceSenders.toArray();
      await this.deleteItems(itemServiceSendersList, containerServiceSender);

      // TODO remove blob items in notification store
    } catch (e) {
      this.error(e.body);
    }
  }

  private async deleteItems(
    items: ReadonlyArray<cosmos.Item> | undefined,
    container: cosmos.Container
  ): Promise<void> {
    if (items === undefined) {
      return;
    }
    cli.action.start(`Deleting ${items.length} items from ${container.id}`);
    for (const item of items) {
      // DELETE here -> await container.item(item.id).delete(item);
    }
    cli.action.stop();
  }
}
