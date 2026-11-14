import * as fs from "fs";
import * as path from "path";

export interface ResolvedBirimPortalSharedEnv {
  r2Endpoint: string;
  r2BucketName: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2PublicDomain: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  r2Configured: boolean;
  r2Source: "configurator_env" | "birim_portal_shared_env" | "unconfigured";
  portalEnvFilePath: string | null;
}

function parseDotEnvContent(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = raw.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eqIdx = normalized.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = normalized.slice(0, eqIdx).trim();
    let val = normalized.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    } else {
      const hashCommentIdx = val.indexOf(" #");
      if (hashCommentIdx >= 0) {
        val = val.slice(0, hashCommentIdx).trim();
      }
    }
    out[key] = val;
  }
  return out;
}

/**
 * `birim-portal/lib/r2.ts` ile birebir aynı alan adı temizliğini uygular
 * (`publicDomain?.replace("JzdXBhYmFz", "")`).
 */
export function sanitizeBirimR2PublicDomain(rawDomain: string | undefined | null): string {
  return (rawDomain || "").replace("JzdXBhYmFz", "").trim().replace(/\/+$/, "");
}

function discoverSiblingBirimPortalEnvFile(explicitPath?: string): {
  filePath: string | null;
  parsed: Record<string, string>;
} {
  if (process.env.BIRIM_DISABLE_PORTAL_ENV_FALLBACK === "true") {
    return { filePath: null, parsed: {} };
  }
  if (process.env.NODE_ENV === "production" && !explicitPath && !process.env.BIRIM_PORTAL_ENV_PATH) {
    return { filePath: null, parsed: {} };
  }

  const cwd = process.cwd();
  const candidates = [
    explicitPath,
    process.env.BIRIM_PORTAL_ENV_PATH,
    "F:/birim-portal/.env.local",
    "F:/birim-portal/.env.staging.local",
    "F:\\birim-portal\\.env.local",
    "F:\\birim-portal\\.env.staging.local",
    "C:/birim-portal/.env.local",
    path.resolve(cwd, "../birim-portal/.env.local"),
    path.resolve(cwd, "../../birim-portal/.env.local"),
    path.resolve(cwd, "../../../birim-portal/.env.local"),
  ].filter((p): p is string => Boolean(p && p.trim()));

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        const raw = fs.readFileSync(candidate, "utf8");
        return { filePath: candidate, parsed: parseDotEnvContent(raw) };
      }
    } catch {
      // Okunamayan aday yolu atla
    }
  }
  return { filePath: null, parsed: {} };
}

/**
 * `birim-configurator` sunucu rotalarının (`r2-upload`, `store-quote`, `erp-nesting`)
 * `birim-portal` ile aynı Cloudflare R2 (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`,
 * `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `NEXT_PUBLIC_R2_DOMAIN`) ve Supabase
 * kimlik bilgilerini sıfır kopyala-yapıştır ile ortak kullanmasını sağlar.
 */
export function resolveSharedBirimPortalEnv(options?: {
  portalEnvPath?: string;
  hydrateProcessEnv?: boolean;
}): ResolvedBirimPortalSharedEnv {
  const directR2Complete = Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
  );
  const directSupabaseComplete = Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const portalFallback =
    !directR2Complete || !directSupabaseComplete || options?.portalEnvPath
      ? discoverSiblingBirimPortalEnvFile(options?.portalEnvPath)
      : { filePath: null, parsed: {} as Record<string, string> };

  const p = portalFallback.parsed;

  const r2Endpoint = (process.env.R2_ENDPOINT || p.R2_ENDPOINT || "").trim();
  const r2BucketName = (process.env.R2_BUCKET_NAME || p.R2_BUCKET_NAME || "").trim();
  const r2AccessKeyId = (process.env.R2_ACCESS_KEY_ID || p.R2_ACCESS_KEY_ID || "").trim();
  const r2SecretAccessKey = (
    process.env.R2_SECRET_ACCESS_KEY ||
    p.R2_SECRET_ACCESS_KEY ||
    ""
  ).trim();
  const r2PublicDomain = sanitizeBirimR2PublicDomain(
    process.env.NEXT_PUBLIC_R2_DOMAIN ||
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
      p.NEXT_PUBLIC_R2_DOMAIN ||
      p.NEXT_PUBLIC_R2_PUBLIC_URL ||
      ""
  );

  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    p.SUPABASE_URL ||
    p.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim();
  const supabaseAnonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    p.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  const supabaseServiceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    p.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();

  if (options?.hydrateProcessEnv && portalFallback.filePath) {
    if (!process.env.SUPABASE_URL && supabaseUrl) process.env.SUPABASE_URL = supabaseUrl;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL && supabaseUrl) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && supabaseAnonKey) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseAnonKey;
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY && supabaseServiceRoleKey) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = supabaseServiceRoleKey;
    }
  }

  const r2Configured = Boolean(
    r2Endpoint && r2BucketName && r2AccessKeyId && r2SecretAccessKey
  );
  const r2Source: ResolvedBirimPortalSharedEnv["r2Source"] = !r2Configured
    ? "unconfigured"
    : directR2Complete
    ? "configurator_env"
    : "birim_portal_shared_env";

  return {
    r2Endpoint,
    r2BucketName,
    r2AccessKeyId,
    r2SecretAccessKey,
    r2PublicDomain,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    r2Configured,
    r2Source,
    portalEnvFilePath: portalFallback.filePath,
  };
}
