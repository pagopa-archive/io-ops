import { Either } from "fp-ts/lib/Either";
import { Errors } from "io-ts";
import { Service } from "../generated/Service";

// Given a flat flags object example:
// {"service_name" : "test", "service_metadata.description" : "desc", ....}
// it creates the correct json object as {"service_name" : "test", "service_metadata" : {"decription" : "desc", ...}, ...}
// and decode into a Service type
// tslint:disable-next-line: no-any
export const flagsToService = (flags: any): Either<Errors, Service> =>
  Service.decode(
    Object.keys(flags)
      .map(value => {
        if (value === "authorized_cidrs" || value === "authorized_recipients") {
          return [value, flags[value] === "" ? [] : flags[value].split(",")];
        }
        if (value.startsWith("service_metadata")) {
          const key = value.split(".")[1];
          return ["service_metadata", { [key]: flags[value] }];
        } else {
          return [value, flags[value]];
        }
      })
      .reduce((acc, obj) => {
        if (obj[0] === "service_metadata") {
          return { ...acc, ...{ [obj[0]]: { ...acc[obj[0]], ...obj[1] } } };
        } else {
          return { ...acc, ...{ [obj[0]]: obj[1] } };
        }
        // tslint:disable-next-line: no-any
      }, {} as any)
  );
