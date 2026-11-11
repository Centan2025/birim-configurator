import type { DesignProject } from "@birim/core";

export interface VerifiedQuoteRecord {
  code: string;
  projectId: string;
  projectTitle: string;
  version: number;
  createdAt: string;
  expiresAt: string;
  discountPercent: number;
  installments: number;
  serverVerifiedSubtotalEur: number;
  serverVerifiedTotalWithVatEur: number;
  serverVerifiedDiscountedTotalEur: number;
  serverVerifiedTotalWithVatTry: number;
  cutPiecesCount: number;
  totalSheetsCount: number;
  canApproveProduction: boolean;
  hmacSignature: string;
  projectSnapshot: DesignProject;
}

export function encodeSharePayloadBase64Url(payload: unknown): string {
  const json = JSON.stringify(payload);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeSharePayloadBase64Url<T = unknown>(token: string): T | null {
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((token.length + 3) % 4);
    if (typeof Buffer !== "undefined") {
      return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as T;
    }
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}
