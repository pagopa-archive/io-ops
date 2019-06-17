import * as t from "io-ts";

export const parseMessagePath = (
  value: unknown
): {
  path: string;
  fiscalCode: string;
  messageId: string;
} => {
  const path = t.string.decode(value).getOrElseL(() => {
    throw Error(`Record is not a string [${value}]`);
  });
  const parts = path.split("/");
  if (
    parts.length !== 2 ||
    !parts[0].match(/\w{16}/ || !parts[1].match(/\w{26}/))
  ) {
    throw Error(`Invalid path [${path}]`);
  }
  return {
    path,
    fiscalCode: parts[0],
    messageId: parts[1]
  };
};
