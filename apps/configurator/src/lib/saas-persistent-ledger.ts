import fs from "fs";
import os from "os";
import path from "path";

export interface PersistentSaasLedgerState {
  auditLogsByTenant: Record<string, unknown[]>;
  subscriptionsByTenant: Record<string, unknown>;
  usageCounters: Record<string, number>;
  usageIdempotencyKeys: string[];
  outboxByTenant: Record<string, unknown[]>;
}

const DEFAULT_LEDGER: PersistentSaasLedgerState = {
  auditLogsByTenant: {},
  subscriptionsByTenant: {},
  usageCounters: {},
  usageIdempotencyKeys: [],
  outboxByTenant: {},
};

let cachedLedger: PersistentSaasLedgerState | null = null;

export function getSaasLedgerFilePath(): string {
  const dir = process.env.MODUL_SAAS_DATA_DIR || os.tmpdir();
  return path.join(dir, ".modul-saas-persistent-ledger.json");
}

export function readSaasPersistentLedger(): PersistentSaasLedgerState {
  if (cachedLedger) return cachedLedger;
  try {
    const file = getSaasLedgerFilePath();
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<PersistentSaasLedgerState>;
      cachedLedger = {
        auditLogsByTenant: parsed.auditLogsByTenant || {},
        subscriptionsByTenant: parsed.subscriptionsByTenant || {},
        usageCounters: parsed.usageCounters || {},
        usageIdempotencyKeys: Array.isArray(parsed.usageIdempotencyKeys)
          ? parsed.usageIdempotencyKeys
          : [],
        outboxByTenant: parsed.outboxByTenant || {},
      };
      return cachedLedger;
    }
  } catch {
    // Non-fatal on read-only serverless container
  }
  cachedLedger = structuredClone(DEFAULT_LEDGER);
  return cachedLedger;
}

export function flushSaasPersistentLedger(): void {
  if (!cachedLedger) return;
  try {
    const file = getSaasLedgerFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cachedLedger, null, 2), "utf8");
  } catch {
    // Non-fatal on read-only serverless container
  }
}

export function isLiveSaasPostgrestEnabled(): boolean {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return false;
  if (url.includes("qchmdyiakmrfyvphbbok") && process.env.MODUL_ALLOW_LIVE_SAAS_POSTGREST !== "true") {
    return false;
  }
  return true;
}

export async function syncRowToSaasPostgrest(
  tableName:
    | "modul_audit_logs"
    | "modul_usage_events"
    | "modul_subscriptions"
    | "modul_integration_events",
  tenantId: string,
  rowPayload: Record<string, unknown>
): Promise<boolean> {
  if (!isLiveSaasPostgrestEnabled()) return false;
  const baseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  try {
    const res = await fetch(`${baseUrl}/rest/v1/${tableName}`, {
      method: "POST",
      headers: {
        apikey: key,
        ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
        "x-modul-tenant-id": tenantId,
      },
      body: JSON.stringify(rowPayload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
