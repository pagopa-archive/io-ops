import { expect, test } from "@oclif/test";
import { hasCosmosConnection } from "../../../src/utils/azure";

describe("list all profiles", () => {
  /**
   * if host has the az client installed and valid cosmos credentials we test command first output line matches
   * the header row (fiscalCode column name). Otherwise the test will be skipped
   */

  before(async function(): Promise<void> {
    const isCosmosConnectionAvailable = await hasCosmosConnection(
      "agid-rg-test",
      "agid-cosmosdb-test"
    );
    if (!isCosmosConnectionAvailable) {
      // tslint:disable-next-line: no-invalid-this
      this.skip();
    }
  });
  test
    .stdout()
    .command(["profiles:list"])
    .it("runs profiles command to list all users", ctx => {
      expect(ctx.stdout).match(/^fiscalCode/);
    });
});
