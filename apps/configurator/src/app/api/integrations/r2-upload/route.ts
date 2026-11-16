import { resolveSharedBirimPortalEnv } from "../../../../lib/birim-portal-env";
import {
  ALLOWED_EXTENSIONS,
  KNOWN_PRODUCTION_R2_BUCKETS,
  MAX_UPLOAD_BYTES,
  buildIsolatedConfiguratorR2Key,
  buildR2SigV4PutHeaders,
} from "../../../../lib/r2-upload-helpers";
import {
  TenantSecurityError,
  recordTenantAuditEvent,
  resolveTenantRequestContext,
} from "../../../../lib/tenant-auth-guard";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const runtime = "nodejs";

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
  let tenantCtx;
  try {
    tenantCtx = resolveTenantRequestContext(request, {
      organizationId:
        request.headers.get("x-birim-org-id") || request.headers.get("x-modul-tenant-id"),
    });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return jsonResponse({ ok: false, code: err.code, message: err.message }, err.httpStatus);
    }
    throw err;
  }
  const resolved = resolveSharedBirimPortalEnv({ tenantId: tenantCtx.tenantId });
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
  const orgId = tenantCtx.tenantId;
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
      {
        ok: false,
        code: "INVALID_FILE_SIZE",
        message: "Dosya boyutu 0 ile 50 MB arasında olmalıdır.",
      },
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
    body: new Uint8Array(bodyBuffer),
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

  recordTenantAuditEvent({
    tenantId: tenantCtx.tenantId,
    actorUserId: tenantCtx.userId,
    actorRole: tenantCtx.role,
    action: "R2_ASSET_UPLOADED",
    targetType: "r2_object",
    targetId: objectKey,
    metadata: { byteLength: bodyBuffer.byteLength },
  });
  return jsonResponse(
    {
      ok: true,
      tenantId: tenantCtx.tenantId,
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
