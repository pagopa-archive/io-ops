import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { createDeleteSql, deleteOnPostgresql } from "../list-delete";
import { Pool, QueryResult } from "pg";
import { isRight } from "fp-ts/lib/Either";

const fakeSubscriptionId = "AA11BB22CC33DD44" as NonEmptyString;
const fakeSchema = "SCHEMATEST";
const fakeTable = "TABLETEST";

const mockQueryResult = {
  command: "DELETE",
  rowCount: 1,
} as QueryResult;
const mockPool = {
  query: jest.fn().mockImplementation(() => Promise.resolve(mockQueryResult)),
} as any as Pool;
describe("PostgreSQL delete suite test", () => {
  it("should create a valid SQL delete statement", () => {
    const res = createDeleteSql(fakeSubscriptionId);
    const expectedSqlStatement = `delete from "${fakeSchema}"."${fakeTable}" where "id" = '${fakeSubscriptionId}'`;
    expect(res).toBe(expectedSqlStatement);
  });

  it("should delete a subscription on PostgreSQL", async () => {
    const res = await deleteOnPostgresql(mockPool)(fakeSubscriptionId)();
    expect(isRight(res)).toBe(true);
    if (isRight(res)) {
      expect(res.right).toBe(true);
    } else {
      throw new Error("Expected some value, received other");
    }
  });
});
