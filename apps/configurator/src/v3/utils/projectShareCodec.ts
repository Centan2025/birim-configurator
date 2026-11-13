import type { DesignProject } from "@birim/core";
import { generateQrCodeSvg } from "../../lib/qr-svg";

const SHARE_HASH_PREFIX = "birim_share=";

function toUrlSafeBase64(utf8Str: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    const bytes = new TextEncoder().encode(utf8Str);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return window
      .btoa(bin)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  return Buffer.from(utf8Str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromUrlSafeBase64(b64Url: string): string {
  const padded = b64Url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64Url.length + 3) % 4);
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const bin = window.atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(padded, "base64").toString("utf-8");
}

export function encodeProjectSharePayload(project: DesignProject): string {
  const compactCopy: DesignProject = JSON.parse(JSON.stringify(project));
  return toUrlSafeBase64(JSON.stringify(compactCopy));
}

export function buildShareableProjectUrl(project: DesignProject, baseHref?: string): string {
  const payload = encodeProjectSharePayload(project);
  const originBase =
    baseHref ||
    (typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : "https://configurator.birim.com/");
  return `${originBase}#${SHARE_HASH_PREFIX}${payload}`;
}

export function decodeProjectFromShareHash(hashOrUrl: string): DesignProject | null {
  if (!hashOrUrl) return null;
  const idx = hashOrUrl.indexOf(SHARE_HASH_PREFIX);
  if (idx === -1) return null;
  const rawToken = hashOrUrl
    .slice(idx + SHARE_HASH_PREFIX.length)
    .split("&")[0]
    .trim();
  if (!rawToken) return null;
  try {
    const json = fromUrlSafeBase64(rawToken);
    const parsed = JSON.parse(json) as DesignProject;
    if (parsed && Array.isArray(parsed.modules) && parsed.modules.length > 0) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildProjectShareQrSvg(project: DesignProject): {
  shareUrl: string;
  qrSvg: string;
} {
  const shareUrl = buildShareableProjectUrl(project);
  // Keep QR payload concise if project has many modules so mobile cameras scan in <0.3s
  const qrTarget =
    shareUrl.length <= 950
      ? shareUrl
      : `${
          typeof window !== "undefined"
            ? `${window.location.origin}${window.location.pathname}`
            : "https://configurator.birim.com/"
        }?proj=${encodeURIComponent(project.id)}&title=${encodeURIComponent(project.title || "Birim")}`;
  return {
    shareUrl,
    qrSvg: generateQrCodeSvg(qrTarget, 156),
  };
}
