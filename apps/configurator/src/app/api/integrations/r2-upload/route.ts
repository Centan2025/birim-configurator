import * as crypto from "crypto";
import { resolveSharedBirimPortalEnv } from "../../../../lib/birim-portal-env";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const runtime = "nodejs";

const KNOWN_PRODUCTION_R2_BUCKETS = new Set(["birim-teklif", "birim-web"]);
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB (3D GLB + CAM ZIP paketleri için)
const ALLOWED_EXTENSIONS = new Set([
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

export async function GET() {
  const resolved = resolveSharedBirimPortalEnv();
  const isProdBucket = KNOWN_PRODUCTION_R2_BUCKETS.has(resolved.r2BucketName);
  const allowProdR2 =
    process.env.BIRIM_ALLOW_PRODUCTION_R2_MUTATION === "true" ||
    process.env.BIRIM_SHARE_PORTAL_R2 === "true" ||
    process.env.NODE_ENV === "production";

  return jsonResponse({
    ok: true,
    configured: resolved.r2Configured,
    mode: resolved.r2Configured ? "cloudflare_r2_s3v4" : "indexeddb_offline_only",
    source: resolved.r2Source,
    sharedWithBirimPortal: resolved.r2Source === "birim_portal_shared_env",
    bucketName: resolved.r2BucketName || null,
    publicDomain: resolved.r2PublicDomain || null,
    isolatedPrefixPattern: "<organizationId>/configurator/<alt-klasor>/<timestamp>-<dosya>",
    prodBucketLockActive: isProdBucket && !allowProdR2,
  });
}

export async function POST(request: Request) {
  const resolved = resolveSharedBirimPortalEnv();
  const endpoint = resolved.r2Endpoint;
  const bucket = resolved.r2BucketName;
  const accessKeyId = resolved.r2AccessKeyId;
  const secretAccessKey = resolved.r2SecretAccessKey;
  const publicDomain = resolved.r2PublicDomain;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return jsonResponse(
      {
        ok: false,
        code: "R2_NOT_CONFIGURED",
        message:
          "Cloudflare R2 ortam değişkenleri tanımlı değil (ne apps/configurator/.env.local ne de F:\\birim-portal\\.env.local bulundu); varlıklar tarayıcı IndexedDB önbelleğinde saklanıyor.",
      },
      503
    );
  }

  const sharePortalHeader = request.headers.get("x-birim-share-portal-r2") === "true";
  const allowProdR2 =
    process.env.BIRIM_ALLOW_PRODUCTION_R2_MUTATION === "true" ||
    process.env.BIRIM_SHARE_PORTAL_R2 === "true" ||
    process.env.NODE_ENV === "production" ||
    sharePortalHeader;

  if (KNOWN_PRODUCTION_R2_BUCKETS.has(bucket) && !allowProdR2) {
    return jsonResponse(
      {
        ok: false,
        code: "PROD_R2_BUCKET_LOCK",
        message: `[FAIL-CLOSED R2 GUARD] Canlı üretim R2 bucket ('${bucket}') üzerine izinsiz yazma engellendi. Ortak Birim-Portal R2 paylaşımı için BIRIM_SHARE_PORTAL_R2=true tanımlayın veya modaldan ortak R2 paylaşımını onaylayın.`,
      },
      403
    );
  }

  const rawFileName = request.headers.get("x-birim-filename") || "model.glb";
  const rawFolder = request.headers.get("x-birim-folder") || "assets";
  const orgId =
    request.headers.get("x-birim-org-id") ||
    process.env.BIRIM_DEFAULT_ORG_ID ||
    "00000000-0000-0000-0000-000000000001";
  const contentType = request.headers.get("content-type") || "application/octet-stream";

  const safeName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = (safeName.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return jsonResponse(
      { ok: false, code: "INVALID_EXTENSION", message: `İzin verilmeyen dosya uzantısı: .${ext}` },
      400
    );
  }

  const arrayBuf = await request.arrayBuffer();
  const bodyBuffer = Buffer.from(arrayBuf);
  if (bodyBuffer.byteLength === 0 || bodyBuffer.byteLength > MAX_UPLOAD_BYTES) {
    return jsonResponse(
      { ok: false, code: "INVALID_FILE_SIZE", message: "Dosya boyutu 0 ile 50 MB arasında olmalıdır." },
      400
    );
  }

  const objectKey = buildIsolatedConfiguratorR2Key({
    organizationId: orgId,
    subFolder: rawFolder,
    fileName: safeName,
  });

  const signed = buildR2SigV4PutHeaders({
    endpointUrl: endpoint,
    bucketName: bucket,
    objectKey,
    accessKeyId,
    secretAccessKey,
    contentType,
    bodyBuffer,
  });

  const putRes = await fetch(signed.url, {
    method: "PUT",
    headers: signed.headers,
    body: bodyBuffer,
  });

  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => "");
    return jsonResponse(
      {
        ok: false,
        code: "R2_UPSTREAM_ERROR",
        message: `Cloudflare R2 yükleme hatası (HTTP ${putRes.status}): ${errText.slice(0, 200)}`,
      },
      502
    );
  }

  const resolvedUrl = publicDomain ? `${publicDomain}/${objectKey}` : signed.url;

  return jsonResponse(
    {
      ok: true,
      bucketName: bucket,
      source: resolved.r2Source,
      key: objectKey,
      url: resolvedUrl,
      size: bodyBuffer.byteLength,
      contentType,
    },
    201
  );
}
