import { describe, expect, it } from "vitest";
import { formatLicenseReport, readGlbJson, readVrmLicense, verdicts } from "../src/tools/vrm-license.js";

/** Minimal GLB: 12-byte header plus one JSON chunk padded with spaces, as the spec requires. */
function glb(json: unknown): Uint8Array {
  let text = JSON.stringify(json);
  while (text.length % 4 !== 0) {
    text += " ";
  }
  const body = new TextEncoder().encode(text);
  const bytes = new Uint8Array(20 + body.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.length, true);
  view.setUint32(12, body.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(body, 20);
  return bytes;
}

describe("readVrmLicense", () => {
  it("reads VRM 1.0 meta", () => {
    // Arrange
    const file = glb({
      extensions: {
        VRMC_vrm: {
          meta: {
            name: "Xenovia",
            authors: ["fan"],
            avatarPermission: "everyone",
            commercialUsage: "personalNonProfit",
            modification: "prohibited",
            allowRedistribution: false,
            creditNotation: "required",
            licenseUrl: "https://vrm.dev/licenses/1.0/",
          },
        },
      },
    });

    // Act
    const license = readVrmLicense(readGlbJson(file));

    // Assert
    expect(license).toMatchObject({
      format: "VRM 1.0",
      title: "Xenovia",
      avatarUse: "everyone",
      modification: "prohibited",
      redistribution: false,
      creditRequired: true,
    });
    expect(verdicts(license)).toEqual({ companion: "boleh", vrchat: "tidak boleh" });
  });

  it("reads VRM 0.x meta and decodes the CC license name", () => {
    // Arrange
    const file = glb({
      extensions: {
        VRM: { meta: { title: "Asuna", author: "fan", allowedUserName: "Everyone", licenseName: "CC_BY_NC" } },
      },
    });

    // Act
    const license = readVrmLicense(readGlbJson(file));

    // Assert
    expect(license).toMatchObject({
      format: "VRM 0.x",
      modification: "allowed-with-redistribution",
      redistribution: true,
      creditRequired: true,
    });
    expect(verdicts(license)).toEqual({ companion: "boleh", vrchat: "cek dulu" });
  });

  it("refuses author-only models for both uses", () => {
    // Arrange
    const file = glb({ extensions: { VRMC_vrm: { meta: { avatarPermission: "onlyAuthor" } } } });

    // Act
    const result = verdicts(readVrmLicense(readGlbJson(file)));

    // Assert
    expect(result).toEqual({ companion: "tidak boleh", vrchat: "tidak boleh" });
  });

  it("rejects plain glTF without VRM metadata", () => {
    expect(() => readVrmLicense(readGlbJson(glb({ asset: { version: "2.0" } })))).toThrow(/tanpa metadata VRM/);
  });

  it("rejects files that are not GLB", () => {
    expect(() => readGlbJson(new TextEncoder().encode("{ not a glb file at all }"))).toThrow(/Bukan file GLB/);
  });
});

describe("formatLicenseReport", () => {
  it("translates fields and always ends with the caveat", () => {
    // Arrange
    const license = readVrmLicense(
      readGlbJson(glb({ extensions: { VRMC_vrm: { meta: { name: "X", commercialUsage: "corporation" } } } })),
    );

    // Act
    const report = formatLicenseReport(license);

    // Assert
    expect(report).toContain("Komersial   : boleh juga dipakai perusahaan");
    expect(report).toContain("Dipakai oleh: tidak dicantumkan");
    expect(report).toContain("Companion (pribadi)      : CEK DULU");
    expect(report).toContain("jangan di-upload public");
  });
});
