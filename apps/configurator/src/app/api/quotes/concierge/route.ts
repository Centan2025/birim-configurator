import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  TenantSecurityError,
  checkTenantRateLimit,
  recordTenantAuditEvent,
  resolveTenantRequestContext,
  resolveTrustedClientIp,
} from "../../../../lib/tenant-auth-guard";

export interface ConciergeRequestRecord {
  trackingCode: string;
  tenantId: string;
  requestKind: "sample_box" | "architect_review";
  projectId: string;
  projectTitle: string;
  customerName: string;
  contactNote: string;
  swatchIds: string[];
  moduleCount: number;
  createdAt: string;
}

const CONCIERGE_REQUESTS_BY_TENANT = new Map<string, ConciergeRequestRecord[]>();

function stripControlAndHtmlChars(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[<>"'`\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLen);
}

function generateConciergeTrackingCode(kind: "sample_box" | "architect_review"): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `${kind === "sample_box" ? "SMP" : "ARC"}-${suffix}`;
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = resolveTrustedClientIp(req);
    checkTenantRateLimit(`ip:${clientIp}`, "quotes_concierge_post", 20);

    const rawText = await req.text();
    if (rawText.length > 64_000) {
      return NextResponse.json(
        { ok: false, error: "İstek boyutu sınırı aşıldı." },
        { status: 413 }
      );
    }

    const body = JSON.parse(rawText) as {
      requestKind?: "sample_box" | "architect_review";
      tenantId?: string;
      projectId?: string;
      projectTitle?: string;
      customerName?: string;
      contactNote?: string;
      swatchIds?: unknown;
      moduleCount?: number;
    };

    const requestKind =
      body.requestKind === "architect_review" ? "architect_review" : "sample_box";

    let tenantId = "00000000-0000-0000-0000-000000000001";
    let actorUserId = `guest:${clientIp}`;
    let actorRole: import("@birim/core").SaasRoleId = "external_guest";

    try {
      const ctx = resolveTenantRequestContext(req, { tenantId: body.tenantId });
      tenantId = ctx.tenantId;
      actorUserId = ctx.userId;
      actorRole = ctx.role;
    } catch (err) {
      // Allow public guest sample/architect requests on customer quote screens unless forged token was supplied
      if (err instanceof TenantSecurityError && err.code === "INVALID_SESSION_TOKEN") {
        return NextResponse.json(
          { ok: false, code: err.code, error: err.message },
          { status: err.httpStatus }
        );
      }
    }

    const cleanSwatches = Array.isArray(body.swatchIds)
      ? body.swatchIds
          .filter((x): x is string => typeof x === "string")
          .map((s) => stripControlAndHtmlChars(s, 64))
          .filter(Boolean)
          .slice(0, 6)
      : [];

    const record: ConciergeRequestRecord = {
      trackingCode: generateConciergeTrackingCode(requestKind),
      tenantId,
      requestKind,
      projectId: stripControlAndHtmlChars(body.projectId || "proj_guest", 80) || "proj_guest",
      projectTitle:
        stripControlAndHtmlChars(body.projectTitle || "Birim Tasarımı", 120) || "Birim Tasarımı",
      customerName: stripControlAndHtmlChars(body.customerName || "", 100),
      contactNote: stripControlAndHtmlChars(body.contactNote || "", 400),
      swatchIds: cleanSwatches,
      moduleCount: Math.max(1, Math.min(200, Number(body.moduleCount) || 1)),
      createdAt: new Date().toISOString(),
    };

    const existing = CONCIERGE_REQUESTS_BY_TENANT.get(tenantId) || [];
    CONCIERGE_REQUESTS_BY_TENANT.set(tenantId, [record, ...existing].slice(0, 200));

    recordTenantAuditEvent({
      tenantId,
      actorUserId,
      actorRole,
      action:
        requestKind === "sample_box"
          ? "CUSTOMER_SAMPLE_BOX_REQUESTED"
          : "CUSTOMER_ARCHITECT_REVIEW_REQUESTED",
      targetType: "concierge_request",
      targetId: record.trackingCode,
      metadata: {
        projectId: record.projectId,
        swatchIds: record.swatchIds,
        moduleCount: record.moduleCount,
      },
    });

    return NextResponse.json({ ok: true, request: record }, { status: 201 });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status: err.httpStatus }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Numune veya uzman inceleme talebi kaydedilemedi." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = resolveTenantRequestContext(req);
    const items = CONCIERGE_REQUESTS_BY_TENANT.get(ctx.tenantId) || [];
    return NextResponse.json({ ok: true, tenantId: ctx.tenantId, requests: items });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status: err.httpStatus }
      );
    }
    return NextResponse.json({ ok: false, error: "Talepler alınamadı." }, { status: 500 });
  }
}
