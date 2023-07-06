import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { createDeleteSql } from "../list-delete";

describe("List Delete Test", () => {
  it("should create a valid SQL delete statement", () => {
    const res = createDeleteSql("123" as NonEmptyString);
    expect(res).toBe(
      `delete from \"SCHEMATEST\".\"TABLETEST\" where \"id\" = '123'`
    );
  });
});
