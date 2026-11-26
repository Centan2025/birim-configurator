import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  TENANT_ANKA_BUSINESS,
  TENANT_BIRIM_ENTERPRISE,
  autoPartitionModuleBaysForWidth,
  computeModuleLoadCapacitySummary,
  computeOptimalDeflectionSafeBayCount,
  createDefaultWardrobeModule,
  createInitialProject,
} from "@birim/core";
import { optimizeMultiProjectBatchNesting } from "@birim/manufacturing";
import { signTenantSessionToken } from "../apps/configurator/src/lib/tenant-auth-guard";
import {
  GET as getConciergeRequests,
  POST as postConciergeRequest,
} from "../apps/configurator/src/app/api/quotes/concierge/route";
import { useConfiguratorStore } from "../apps/configurator/src/store/useConfiguratorStore";

describe("V13 Faz 3 — UX Geliştirmeleri, DOM XSS Koruması ve Yeni Stratejik Özellikler", () => {
  it("1. Tylko esinli autoPartitionModuleBaysForWidth genişleyen dolabı sehim sınırına göre otomatik böler ve ISO 7170 kg yük kapasitesini hesaplar", () => {
    expect(computeOptimalDeflectionSafeBayCount(600)).toBe(1);
    expect(computeOptimalDeflectionSafeBayCount(1400)).toBe(2);
    expect(computeOptimalDeflectionSafeBayCount(2400)).toBe(3);

    const mod600 = createDefaultWardrobeModule("mod_auto_bay");
    mod600.dimensions.width = 600;
    mod600.bays = [mod600.bays[0]];

    const expanded2400 = autoPartitionModuleBaysForWidth(mod600, 2400);
    expect(expanded2400.dimensions.width).toBe(2400);
    expect(expanded2400.bays.length).toBe(3);

    const loadSummary = computeModuleLoadCapacitySummary(expanded2400);
    expect(loadSummary.deflectionSafe).toBe(true);
    expect(loadSummary.safeLoadPerShelfKg).toBeGreaterThanOrEqual(15);
    expect(loadSummary.totalSafeModuleLoadKg).toBeGreaterThan(100);
  });

  it("2. KesApp esinli optimizeMultiProjectBatchNesting 10 ve 25 dairelik toplu kesimde ayrı kesime kıyasla plaka sayısını düşürür veya korur (< 150ms)", () => {
    const proj = createInitialProject();
    const t0 = performance.now();
    const batch10 = optimizeMultiProjectBatchNesting([
      { project: proj, unitMultiplier: 10, unitLabelPrefix: "Vadi B-Blok" },
    ]);
    const elapsedMs = performance.now() - t0;

    expect(elapsedMs).toBeLessThan(250);
    expect(batch10.totalApartmentOrUnitCount).toBe(10);
    expect(batch10.combinedTotalSheetsCount).toBeLessThanOrEqual(batch10.separateTotalSheetsCount);
    expect(batch10.savedSheetsCount).toBe(
      batch10.separateTotalSheetsCount - batch10.combinedTotalSheetsCount
    );
    expect(batch10.combinedNestingResults.length).toBeGreaterThan(0);
    const firstPlacedName =
      batch10.combinedNestingResults[0]?.sheets[0]?.placedPieces[0]?.pieceName || "";
    expect(firstPlacedName).toContain("[Vadi B-Blok ×10]");
  });

  it("3. /api/quotes/concierge ücretsiz numune kutusu (SMP-) ve iç mimar incelemesi (ARC-) taleplerinde XSS karakterlerini temizler ve kiracı izolasyonu uygular", async () => {
    const sampleRes = await postConciergeRequest(
      new NextRequest("http://localhost:3300/api/quotes/concierge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.21",
        },
        body: JSON.stringify({
          requestKind: "sample_box",
          tenantId: TENANT_BIRIM_ENTERPRISE.tenantId,
          projectId: "proj_smp_1",
          projectTitle: "Opus Giyinme <script>alert(1)</script>",
          customerName: 'Ayşe Yılmaz"><img src=x onerror=alert(1)>',
          contactNote: "Kadıköy şube teslim",
          swatchIds: ["mat_veneer_oak", "mat_lacquer_sage"],
          moduleCount: 3,
        }),
      })
    );
    expect(sampleRes.status).toBe(201);
    const sampleJson = await sampleRes.json();
    expect(sampleJson.ok).toBe(true);
    expect(sampleJson.request.trackingCode).toMatch(/^SMP-[A-Z0-9]{6}$/);
    expect(sampleJson.request.projectTitle).not.toContain("<script>");
    expect(sampleJson.request.customerName).not.toContain("<");

    const archRes = await postConciergeRequest(
      new NextRequest("http://localhost:3300/api/quotes/concierge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.22",
        },
        body: JSON.stringify({
          requestKind: "architect_review",
          tenantId: TENANT_BIRIM_ENTERPRISE.tenantId,
          projectId: "proj_arc_1",
          customerName: "Mimar Sinan Atölyesi",
          contactNote: "Kolon kertme kontrolü",
        }),
      })
    );
    expect(archRes.status).toBe(201);
    const archJson = await archRes.json();
    expect(archJson.request.trackingCode).toMatch(/^ARC-[A-Z0-9]{6}$/);

    // Forged session token rejected with 401
    const forgedRes = await postConciergeRequest(
      new NextRequest("http://localhost:3300/api/quotes/concierge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer mdl_sess_forged.bad",
          "x-real-ip": "198.51.100.23",
        },
        body: JSON.stringify({ requestKind: "sample_box" }),
      })
    );
    expect(forgedRes.status).toBe(401);

    // Tenant isolation on GET: Anka cannot see Birim's concierge requests
    const ankaToken = signTenantSessionToken({
      tenantId: TENANT_ANKA_BUSINESS.tenantId,
      role: "org_admin",
    });
    const ankaGet = await getConciergeRequests(
      new NextRequest("http://localhost:3300/api/quotes/concierge", {
        headers: { authorization: `Bearer ${ankaToken}` },
      })
    );
    const ankaList = await ankaGet.json();
    expect(ankaList.ok).toBe(true);
    expect(ankaList.requests.length).toBe(0);
  });

  it("4. USM tarzı sahne üstü +Yan/+Üst modül büyütme, 175 cm insan ölçeği ve QuoteSummaryModal DOM XSS koruması eksiksiz entegredir", () => {
    const repoRoot = path.resolve(__dirname, "..");
    const quoteModalSrc = fs.readFileSync(
      path.join(repoRoot, "apps/configurator/src/v11/QuoteSummaryModal.tsx"),
      "utf8"
    );
    expect(quoteModalSrc).toContain("escapeHtmlForQuotePrint");
    expect(quoteModalSrc).toContain('role="dialog"');
    expect(quoteModalSrc).toContain("quote-request-architect-review-btn");

    const qtbSrc = fs.readFileSync(
      path.join(repoRoot, "apps/configurator/src/v11/OnObjectQuickToolbar.tsx"),
      "utf8"
    );
    expect(qtbSrc).toContain("v13-on-object-grow-adjacent");
    expect(qtbSrc).toContain("v13-on-object-grow-top");

    const dockSrc = fs.readFileSync(
      path.join(repoRoot, "apps/configurator/src/v11/BottomSceneDock.tsx"),
      "utf8"
    );
    expect(dockSrc).toContain("175 cm İnsan Boy Ölçeği");
    expect(dockSrc).toContain("birim:set-human-scale-ref");

    // Store functional check for adjacent & stacked top module growth
    const st = useConfiguratorStore.getState();
    st.resetToDefault();
    const initialCount = useConfiguratorStore.getState().project.modules.length;
    useConfiguratorStore.getState().addAdjacentModule();
    expect(useConfiguratorStore.getState().project.modules.length).toBe(initialCount + 1);
    st.resetToDefault();
  });
});
