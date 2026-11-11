import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { VerifiedQuoteRecord } from "./quote-codec";

const MEMORY_QUOTES = new Map<string, VerifiedQuoteRecord>();

function getStoreFilePath(): string {
  const customDir = process.env.BIRIM_QUOTES_DATA_DIR || process.cwd();
  return path.join(customDir, ".birim-quotes-store.json");
}

function getSigningSecret(): string {
  return (
    process.env.BIRIM_QUOTE_SIGNING_SECRET ||
    "birim-dev-hmac-secret-change-in-production-v46"
  );
}

function loadDiskQuotesOnce(): void {
  if (MEMORY_QUOTES.size > 0) return;
  try {
    const file = getStoreFilePath();
    if (!fs.existsSync(file)) return;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as VerifiedQuoteRecord[];
    if (Array.isArray(parsed)) {
      for (const rec of parsed) {
        if (rec && typeof rec.code === "string") {
          MEMORY_QUOTES.set(rec.code.toUpperCase(), rec);
        }
      }
    }
  } catch {
    // Non-fatal in read-only serverless containers; MEMORY_QUOTES remains active
  }
}

function persistDiskQuotes(): void {
  try {
    const file = getStoreFilePath();
    const list = Array.from(MEMORY_QUOTES.values()).slice(-500);
    fs.writeFileSync(file, JSON.stringify(list, null, 2), "utf8");
  } catch {
    // Ignore EROFS in read-only edge/serverless deployments
  }
}

export function generateShortQuoteCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(6);
  let token = "";
  for (let i = 0; i < 6; i++) {
    token += alphabet[bytes[i] % alphabet.length];
  }
  return `BRM-${token}`;
}

export function computeQuoteHmac(payload: Omit<VerifiedQuoteRecord, "hmacSignature">): string {
  const canonical = [
    payload.code,
    payload.projectId,
    payload.version,
    payload.createdAt,
    payload.expiresAt,
    payload.discountPercent.toFixed(2),
    payload.serverVerifiedSubtotalEur.toFixed(2),
    payload.serverVerifiedTotalWithVatEur.toFixed(2),
    payload.serverVerifiedDiscountedTotalEur.toFixed(2),
    payload.cutPiecesCount,
  ].join("|");
  return crypto.createHmac("sha256", getSigningSecret()).update(canonical, "utf8").digest("hex");
}

export function verifyQuoteHmac(record: VerifiedQuoteRecord): boolean {
  const { hmacSignature, ...rest } = record;
  const expected = computeQuoteHmac(rest);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmacSignature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

export function saveVerifiedQuote(
  unsignedRecord: Omit<VerifiedQuoteRecord, "hmacSignature">
): VerifiedQuoteRecord {
  loadDiskQuotesOnce();
  const hmacSignature = computeQuoteHmac(unsignedRecord);
  const signed: VerifiedQuoteRecord = {
    ...unsignedRecord,
    hmacSignature,
  };
  MEMORY_QUOTES.set(signed.code.toUpperCase(), signed);
  persistDiskQuotes();
  return signed;
}

export function getVerifiedQuoteByCode(code: string): VerifiedQuoteRecord | null {
  loadDiskQuotesOnce();
  const rec = MEMORY_QUOTES.get(String(code || "").trim().toUpperCase());
  if (!rec) return null;
  if (!verifyQuoteHmac(rec)) return null;
  return rec;
}
