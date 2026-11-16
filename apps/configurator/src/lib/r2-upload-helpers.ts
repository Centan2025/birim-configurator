import * as crypto from "crypto";

export const KNOWN_PRODUCTION_R2_BUCKETS = new Set(["birim-teklif", "birim-web"]);
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB (3D GLB + CAM ZIP paketleri için)
export const ALLOWED_EXTENSIONS = new Set([
  "glb",
  "gltf",
  "ktx2",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "dxf",
  "pdf",
  "json",
  "zip",
  "zpl",
  "html",
  "svg",
  "csv",
  "nc",
  "mpr",
  "cix",
  "xcs",
  "bxf",
]);

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function encodeRfc3986Path(objectKey: string): string {
  return objectKey
    .split("/")
    .map((seg) =>
      encodeURIComponent(seg).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
      )
    )
    .join("/");
}

/**
 * Ortak `birim-portal` R2 bucket'ı içinde (`birim-web-staging`, `birim-teklif`, `birim-web`)
 * `media/`, `products/`, `quotations/`, `sales-cards/` klasörleriyle asla çakışmaması için
 * tüm anahtarları `${orgId}/configurator/<alt-klasor>/...` izole öneki altına kilitler.
 */
export function buildIsolatedConfiguratorR2Key(params: {
  organizationId: string;
  subFolder?: string | null;
  fileName: string;
  timestampMs?: number;
}): string {
  const cleanOrg =
    (params.organizationId || "00000000-0000-0000-0000-000000000001").replace(
      /[^a-zA-Z0-9_-]/g,
      ""
    ) || "00000000-0000-0000-0000-000000000001";

  const rawSub = (params.subFolder || "assets")
    .replace(/\.\./g, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/^configurator[-/]?/i, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "-")
    .replace(/\/+$/, "");

  const subSegment = rawSub || "assets";
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ts = params.timestampMs ?? Date.now();
  return `${cleanOrg}/configurator/${subSegment}/${ts}-${safeName}`;
}

export function buildR2SigV4PutHeaders(params: {
  endpointUrl: string;
  bucketName: string;
  objectKey: string;
  accessKeyId: string;
  secretAccessKey: string;
  contentType: string;
  bodyBuffer: Buffer;
  now?: Date;
}): { url: string; headers: Record<string, string> } {
  const endpoint = new URL(params.endpointUrl);
  const host = endpoint.host;
  const now = params.now || new Date();
  const isoBasic = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = isoBasic.slice(0, 8);
  const region = "auto";
  const service = "s3";

  const canonicalUri = `/${encodeURIComponent(params.bucketName)}/${encodeRfc3986Path(
    params.objectKey.replace(/^\/+/, "")
  )}`;
  const payloadHash = sha256Hex(params.bodyBuffer);

  const canonicalHeaders =
    `content-type:${params.contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${isoBasic}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    isoBasic,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${params.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${params.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `${endpoint.origin}${canonicalUri}`,
    headers: {
      "Content-Type": params.contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": isoBasic,
      Authorization: authorization,
    },
  };
}
