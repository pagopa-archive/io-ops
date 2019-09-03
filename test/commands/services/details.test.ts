import { assert, expect } from "chai";
import { isNone, isSome } from "fp-ts/lib/Option";
import { loadImageInfo } from "../../../src/commands/services/details";
import { ServicePublic } from "../../../src/definitions/ServicePublic";

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

describe("Image info", () => {
  it("should recognize a remote resource that isn't an image", async () => {
    const notAnImage = await loadImageInfo("https://www.google.com");
    assert.isTrue(isNone(notAnImage));
  });

  it("should recognize a remote resource that is a valid image", async () => {
    const validImageInfo = await loadImageInfo(
      "https://raw.githubusercontent.com/teamdigitale/io-services-metadata/master/logos/services/id_service.png"
    );
    const imageInfo = {
      width: 1125,
      height: 2436,
      type: "png",
      uri:
        "https://raw.githubusercontent.com/teamdigitale/io-services-metadata/master/logos/services/id_service.png",
      sizeInByte: 64684
    };
    assert.isTrue(isSome(validImageInfo));
    if (isSome(validImageInfo)) {
      expect(validImageInfo.value).to.eql(imageInfo);
    }
  });
});
