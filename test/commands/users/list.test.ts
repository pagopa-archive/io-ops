import { expect, test } from "@oclif/test";
import { hasCosmosConnection } from "../../../src/utils/azure";

describe("list all profiles", () => {
  const isCosmosConnectionAvailable = hasCosmosConnection(
    "agid-rg-test",
    "agid-cosmosdb-test"
  );
  /**
   * if host has the az client installed and valid cosmos credentials we test command first output line matches
   * the header row (fiscalCode column name). Otherwise the test expects for an error with 2 as exit status
   */
  if (isCosmosConnectionAvailable) {
    test
      .stdout()
      .command(["profiles:list"])
      .it("runs profiles command to list all users", ctx => {
        expect(ctx.stdout).match(/^fiscalCode/);
      });
  } else {
    test
      .stdout()
      .command(["profiles:list"])
      .exit(2)
      .it(
        "check the command goes in error (no cosmos credential available or az client not installed)"
      );
  }
});
