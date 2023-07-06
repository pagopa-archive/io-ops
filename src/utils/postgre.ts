import { identity, pipe } from "fp-ts/lib/function";
import { DatabaseError, Pool, QueryResult } from "pg";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { getRequiredStringEnv } from "@pagopa/io-functions-commons/dist/src/utils/env";
import { NumberFromString } from "@pagopa/ts-commons/lib/numbers";
import { cli } from "cli-ux";
import chalk from "chalk";
import * as O from "fp-ts/lib/Option";

// eslint-disable-next-line functional/no-let
let singletonPool: Pool;

const getSingletonPool = (): Pool => {
  return pipe(
    O.fromNullable(singletonPool),
    O.getOrElse(
      () =>
        new Pool({
          database: getRequiredStringEnv("POSTGRE_DB_NAME"),
          host: getRequiredStringEnv("POSTGRE_DB_HOST"),
          idleTimeoutMillis: pipe(
            parseInt(getRequiredStringEnv("POSTGRE_DB_IDLE_TIMEOUT")),
            NumberFromString.decode,
            E.fold(() => 3000, identity)
          ),
          max: 20,
          password: getRequiredStringEnv("POSTGRE_DB_PASSWORD"),
          port: pipe(
            getRequiredStringEnv("POSTGRE_DB_PORT"),
            NumberFromString.decode,
            E.fold(() => 5432, identity)
          ),
          ssl: true,
          user: getRequiredStringEnv("POSTGRE_DB_USER"),
        })
    )
  );
};

export const queryDataTable = (
  pool: Pool,
  query: string
): TE.TaskEither<DatabaseError, QueryResult> => {
  return pipe(
    TE.tryCatch(
      () => pool.query(query),
      (error) => error as DatabaseError
    ),
    TE.mapLeft((e) => {
      cli.log(chalk.red.bold(`SQL error ${e}`));
      return e;
    })
  );
};

export default getSingletonPool;
