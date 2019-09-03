import * as t from "io-ts";
import {
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";

const serviceAttributes = {
  serviceId: NonEmptyString,
  serviceName: NonEmptyString,
  organizationName: NonEmptyString,
  departmentName: NonEmptyString,
  organizationFiscalCode: OrganizationFiscalCode,
  version: t.Integer,
  isVisible: t.boolean
};

export const ServicePublic = t.strict(serviceAttributes);
export const ServicePublicFull = t.interface(serviceAttributes);

export type ServicePublic = t.TypeOf<typeof ServicePublic>;
export type ServicePublicFull = t.TypeOf<typeof ServicePublicFull>;
