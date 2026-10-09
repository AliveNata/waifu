/**
 * Reads the license block that VRM files carry in their glTF JSON, for both
 * VRM 1.0 (VRMC_vrm.meta) and VRM 0.x (VRM.meta). The block is declared by the
 * model's creator, so it is a first check, not legal advice.
 */

export type AvatarUse = "everyone" | "licensed-only" | "author-only" | "unknown";
export type Modification = "allowed" | "allowed-with-redistribution" | "prohibited" | "unknown";

export interface VrmLicense {
  format: "VRM 1.0" | "VRM 0.x";
  title: string | null;
  authors: string[];
  avatarUse: AvatarUse;
  commercial: string | null;
  modification: Modification;
  redistribution: boolean | null;
  creditRequired: boolean | null;
  licenseName: string | null;
  licenseUrl: string | null;
  otherLicenseUrl: string | null;
}

const glbMagic = 0x46546c67;
const jsonChunkType = 0x4e4f534a;

export function readGlbJson(bytes: Uint8Array): unknown {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== glbMagic) {
    throw new Error("Bukan file GLB/VRM (header glTF tidak ditemukan).");
  }
  const chunkLength = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);
  if (chunkType !== jsonChunkType || 20 + chunkLength > bytes.byteLength) {
    throw new Error("Chunk JSON pertama di file GLB rusak atau tidak ada.");
  }
  const text = new TextDecoder().decode(bytes.subarray(20, 20 + chunkLength));
  return JSON.parse(text) as unknown;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function flag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function fromVrm1(meta: Record<string, unknown>): VrmLicense {
  const avatarUse: Record<string, AvatarUse> = {
    everyone: "everyone",
    onlySeparatelyLicensedPerson: "licensed-only",
    onlyAuthor: "author-only",
  };
  const modification: Record<string, Modification> = {
    allowModification: "allowed",
    allowModificationRedistribution: "allowed-with-redistribution",
    prohibited: "prohibited",
  };
  const credit = text(meta.creditNotation);
  return {
    format: "VRM 1.0",
    title: text(meta.name),
    authors: Array.isArray(meta.authors)
      ? meta.authors.filter((author): author is string => typeof author === "string")
      : [],
    avatarUse: avatarUse[text(meta.avatarPermission) ?? ""] ?? "unknown",
    commercial: text(meta.commercialUsage),
    modification: modification[text(meta.modification) ?? ""] ?? "unknown",
    redistribution: flag(meta.allowRedistribution),
    creditRequired: credit === null ? null : credit === "required",
    licenseName: null,
    licenseUrl: text(meta.licenseUrl),
    otherLicenseUrl: text(meta.otherLicenseUrl),
  };
}

function fromVrm0(meta: Record<string, unknown>): VrmLicense {
  const avatarUse: Record<string, AvatarUse> = {
    Everyone: "everyone",
    ExplicitlyLicensedPerson: "licensed-only",
    OnlyAuthor: "author-only",
  };
  const licenseName = text(meta.licenseName);
  // VRM 0.x encodes modification and redistribution in a Creative Commons style license name.
  let modification: Modification = "unknown";
  let redistribution: boolean | null = null;
  let creditRequired: boolean | null = null;
  if (licenseName === "Redistribution_Prohibited") {
    redistribution = false;
  } else if (licenseName !== null && licenseName !== "Other") {
    redistribution = true;
    modification = licenseName.includes("ND") ? "prohibited" : "allowed-with-redistribution";
    creditRequired = licenseName !== "CC0";
  }
  return {
    format: "VRM 0.x",
    title: text(meta.title),
    authors: text(meta.author) === null ? [] : [text(meta.author) as string],
    avatarUse: avatarUse[text(meta.allowedUserName) ?? ""] ?? "unknown",
    commercial: text(meta.commercialUssageName),
    modification,
    redistribution,
    creditRequired,
    licenseName,
    licenseUrl: text(meta.otherPermissionUrl),
    otherLicenseUrl: text(meta.otherLicenseUrl),
  };
}

export function readVrmLicense(gltf: unknown): VrmLicense {
  const extensions = record(record(gltf)?.extensions);
  const vrm1Meta = record(record(extensions?.VRMC_vrm)?.meta);
  if (vrm1Meta !== null) {
    return fromVrm1(vrm1Meta);
  }
  const vrm0Meta = record(record(extensions?.VRM)?.meta);
  if (vrm0Meta !== null) {
    return fromVrm0(vrm0Meta);
  }
  throw new Error("File ini glTF biasa tanpa metadata VRM, jadi lisensinya tidak bisa dibaca.");
}

export type Verdict = "boleh" | "cek dulu" | "tidak boleh";

export interface Verdicts {
  /** Companion only scales bones at runtime, the file itself is never changed. */
  companion: Verdict;
  /** Converting for VRChat edits the model in Blender, which counts as modification. */
  vrchat: Verdict;
}

export function verdicts(license: VrmLicense): Verdicts {
  const companion: Verdict =
    license.avatarUse === "everyone" ? "boleh" : license.avatarUse === "author-only" ? "tidak boleh" : "cek dulu";
  // Never a plain "boleh" for VRChat: upload rules live on the model's store page, not in the file.
  const vrchat: Verdict =
    companion === "tidak boleh" || license.modification === "prohibited" ? "tidak boleh" : "cek dulu";
  return { companion, vrchat };
}

const avatarUseText: Record<AvatarUse, string> = {
  everyone: "semua orang",
  "licensed-only": "cuma orang yang dapat izin terpisah dari creator",
  "author-only": "cuma creator-nya sendiri",
  unknown: "tidak dicantumkan",
};

const modificationText: Record<Modification, string> = {
  allowed: "boleh dimodifikasi",
  "allowed-with-redistribution": "boleh dimodifikasi dan hasil modifikasinya boleh dibagikan",
  prohibited: "dilarang dimodifikasi",
  unknown: "tidak dicantumkan",
};

const commercialText: Record<string, string> = {
  personalNonProfit: "cuma pribadi, non-profit",
  personalProfit: "pribadi, boleh menghasilkan uang",
  corporation: "boleh juga dipakai perusahaan",
  Allow: "boleh",
  Disallow: "dilarang",
};

function yesNo(value: boolean | null, yes: string, no: string): string {
  return value === null ? "tidak dicantumkan" : value ? yes : no;
}

export function formatLicenseReport(license: VrmLicense): string {
  const result = verdicts(license);
  const lines = [
    `Model       : ${license.title ?? "(tanpa judul)"}`,
    `Creator     : ${license.authors.length === 0 ? "(tidak dicantumkan)" : license.authors.join(", ")}`,
    `Format      : ${license.format}`,
    `Dipakai oleh: ${avatarUseText[license.avatarUse]}`,
    `Komersial   : ${license.commercial === null ? "tidak dicantumkan" : (commercialText[license.commercial] ?? license.commercial)}`,
    `Modifikasi  : ${modificationText[license.modification]}`,
    `Redistribusi: ${yesNo(license.redistribution, "boleh", "dilarang")}`,
    `Kredit      : ${yesNo(license.creditRequired, "wajib", "tidak wajib")}`,
  ];
  if (license.licenseName !== null) {
    lines.push(`Lisensi     : ${license.licenseName}`);
  }
  if (license.licenseUrl !== null) {
    lines.push(`URL lisensi : ${license.licenseUrl}`);
  }
  if (license.otherLicenseUrl !== null) {
    lines.push(`Lisensi lain: ${license.otherLicenseUrl}`);
  }
  lines.push(
    "",
    `Companion (pribadi)      : ${result.companion.toUpperCase()}`,
    `Convert + upload VRChat  : ${result.vrchat.toUpperCase()}`,
    "",
    "Catatan: metadata ini diisi sendiri oleh creator. Syarat di halaman VRoid Hub atau BOOTH",
    "model itu tetap yang berlaku. Creator fan model juga tidak bisa ngasih hak atas karakternya",
    "sendiri, jadi tetap pakai buat pribadi dan jangan di-upload public.",
  );
  return lines.join("\n");
}
