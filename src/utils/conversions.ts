import { Errors } from "io-ts";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";

export function errorsToError(errors: Errors): Error {
  return new Error(errorsToReadableMessages(errors).join(" / "));
}
