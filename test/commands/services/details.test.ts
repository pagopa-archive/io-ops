import { assert } from "chai";
import { ServicePublic } from "../../../src/commands/services/details";

const validService = {
  serviceId: "serviceId",
  serviceName: "service_name",
  organizationName: "organization_name",
  departmentName: "department_name",
  organizationFiscalCode: "00000000000",
  version: 1,
  isVisible: true
};

const invalidService = {
  serviceId: "serviceId",
  serviceName: "service_name",
  organizationName: "",
  departmentName: "department_name",
  organizationFiscalCode: "123",
  version: "1",
  isVisible: false
};

describe("Service", () => {
  describe("# Service decoding", () => {
    it("should recognize a valid service", () => {
      const maybeService = ServicePublic.decode(validService);
      assert.isTrue(maybeService.isRight());
    });

    it("should recognize an invalid service", () => {
      const maybeService = ServicePublic.decode(invalidService);
      assert.isTrue(maybeService.isLeft());
    });
  });
});
