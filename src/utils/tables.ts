import {
  odata,
  TableClient,
  TableEntityQueryOptions,
  TableEntityResult,
  TableServiceClient,
} from "@azure/data-tables";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as RA from "fp-ts/lib/ReadonlyArray";
import { constVoid, pipe } from "fp-ts/lib/function";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { asyncIteratorToArray } from "@pagopa/io-functions-commons/dist/src/utils/async";

export const existsTable = (
  tableClient: TableServiceClient,
  tableName: string
): TE.TaskEither<Error, boolean> =>
  pipe(
    tableClient
      .listTables({
        queryOptions: { filter: odata`TableName eq ${tableName}` },
      })
      [Symbol.asyncIterator](),
    (iterator) => TE.tryCatch(() => asyncIteratorToArray(iterator), E.toError),
    TE.map(RA.head),
    TE.map(O.isSome)
  );

export const createTable = (
  tableClient: TableServiceClient,
  tableName: string
): TE.TaskEither<Error, true> =>
  pipe(
    TE.tryCatch(() => tableClient.createTable(tableName), E.toError),
    TE.map(() => true as const)
  );

export const deleteTable = (
  tableClient: TableServiceClient,
  tableName: string
): TE.TaskEither<Error, true> =>
  pipe(
    TE.tryCatch(() => tableClient.deleteTable(tableName), E.toError),
    TE.map(() => true as const)
  );

export const createEntity = <T>(
  tableClient: TableClient,
  partitionKey: string,
  rowKey: string,
  payload: T
): TE.TaskEither<Error, void> =>
  pipe(
    TE.tryCatch(
      () => tableClient.createEntity({ partitionKey, rowKey, ...payload }),
      E.toError
    ),
    TE.map(constVoid)
  );

export const upsertEntity = <T>(
  tableClient: TableClient,
  partitionKey: string,
  rowKey: string,
  payload: T
): TE.TaskEither<Error, void> =>
  pipe(
    TE.tryCatch(
      () =>
        tableClient.upsertEntity(
          { partitionKey, rowKey, ...payload },
          "Replace"
        ),
      E.toError
    ),
    TE.map(constVoid)
  );

export const queryEntities = (
  tableClient: TableClient,
  queryOptions: TableEntityQueryOptions
): TE.TaskEither<
  Error,
  ReadonlyArray<TableEntityResult<Record<string, unknown>>>
> =>
  pipe(
    tableClient
      .listEntities({
        queryOptions,
      })
      [Symbol.asyncIterator](),
    (resultsIterator) =>
      TE.tryCatch(() => asyncIteratorToArray(resultsIterator), E.toError)
  );
