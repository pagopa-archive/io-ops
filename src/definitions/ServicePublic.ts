import * as t from "io-ts";
import {
  NonEmptyString,
  OrganizationFiscalCode,
} from "@pagopa/ts-commons/lib/strings";

const serviceAttributesRequired = t.interface({
  serviceId: NonEmptyString,
  serviceName: NonEmptyString,
  organizationName: NonEmptyString,
  departmentName: NonEmptyString,
  organizationFiscalCode: OrganizationFiscalCode,
  version: t.Integer,
});

const serviceAttributesOptional = t.partial({
  isVisible: t.boolean,
});

export const ServicePublic = t.exact(
  t.intersection([serviceAttributesRequired, serviceAttributesOptional])
);
export const ServicePublicFull = t.intersection([
  serviceAttributesRequired,
  serviceAttributesOptional,
]);

export type ServicePublic = t.TypeOf<typeof ServicePublic>;
export type ServicePublicFull = t.TypeOf<typeof ServicePublicFull>;
