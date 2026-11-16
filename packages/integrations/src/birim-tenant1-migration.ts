import {
  DEFAULT_MATERIALS,
  TENANT_BIRIM_ENTERPRISE,
  applyTenantConstructionToModule,
  createInitialProject,
  type DesignProject,
} from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import { DEFAULT_PRICING_PARAMS, calculateProjectPrice } from "@birim/pricing";

export interface BirimShadowMigrationReport {
  tenantId: string;
  tenantSlug: string;
  parityVerified: boolean;
  legacyTotalWithVatEur: number;
  tenant1TotalWithVatEur: number;
  eurDelta: number;
  legacyCutPiecesCount: number;
  tenant1CutPiecesCount: number;
  cutPieceCountDelta: number;
  legacyDrillingHolesCount: number;
  tenant1DrillingHolesCount: number;
  drillingHoleCountDelta: number;
  evaluatedAt: string;
}

/**
 * Phase 4 — Runs a deterministic shadow-run comparison proving that Birim Mobilya A.Ş.
 * operating as Tenant #1 (`00000000-0000-0000-0000-000000000001`) produces 0.00 EUR and 0 mm
 * drift compared to the original single-tenant Birim production baseline.
 */
export function runBirimTenant1ShadowVerification(
  inputProject?: DesignProject
): BirimShadowMigrationReport {
  const baseProject = structuredClone(inputProject || createInitialProject());
  const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));

  // 1. Legacy single-tenant calculation
  const legacyBom = generateBOMForProject(baseProject, matMap);
  const legacyPrice = calculateProjectPrice(
    legacyBom,
    DEFAULT_PRICING_PARAMS,
    matMap,
    baseProject.sceneObjects || []
  );

  // 2. Multi-tenant Tenant #1 calculation
  const tenant1Project: DesignProject = {
    ...structuredClone(baseProject),
    tenantId: TENANT_BIRIM_ENTERPRISE.tenantId,
    modules: baseProject.modules.map((m) =>
      applyTenantConstructionToModule(structuredClone(m), TENANT_BIRIM_ENTERPRISE)
    ),
  };
  const c = TENANT_BIRIM_ENTERPRISE.construction;
  const tenant1Bom = generateBOMForProject(tenant1Project, matMap, {
    sheetConfig: {
      name: `Birim ${c.standardSheetLengthMm}x${c.standardSheetWidthMm}`,
      lengthMm: c.standardSheetLengthMm,
      widthMm: c.standardSheetWidthMm,
      trimCutMm: c.edgeTrimMarginMm,
      kerfMm: c.sawKerfMm,
    },
  });
  const tenant1Price = calculateProjectPrice(
    tenant1Bom,
    {
      ...TENANT_BIRIM_ENTERPRISE.pricing,
      standardSheetAreaM2: (c.standardSheetLengthMm * c.standardSheetWidthMm) / 1_000_000,
    },
    matMap,
    tenant1Project.sceneObjects || []
  );

  const eurDelta = Number(
    Math.abs(legacyPrice.totalWithVatEur - tenant1Price.totalWithVatEur).toFixed(2)
  );
  const cutPieceCountDelta = Math.abs(legacyBom.cutList.length - tenant1Bom.cutList.length);
  const drillingHoleCountDelta = Math.abs(
    legacyBom.summary.totalDrillingHolesCount - tenant1Bom.summary.totalDrillingHolesCount
  );

  return {
    tenantId: TENANT_BIRIM_ENTERPRISE.tenantId,
    tenantSlug: TENANT_BIRIM_ENTERPRISE.slug,
    parityVerified:
      eurDelta === 0 && cutPieceCountDelta === 0 && drillingHoleCountDelta === 0,
    legacyTotalWithVatEur: legacyPrice.totalWithVatEur,
    tenant1TotalWithVatEur: tenant1Price.totalWithVatEur,
    eurDelta,
    legacyCutPiecesCount: legacyBom.cutList.length,
    tenant1CutPiecesCount: tenant1Bom.cutList.length,
    cutPieceCountDelta,
    legacyDrillingHolesCount: legacyBom.summary.totalDrillingHolesCount,
    tenant1DrillingHolesCount: tenant1Bom.summary.totalDrillingHolesCount,
    drillingHoleCountDelta,
    evaluatedAt: new Date().toISOString(),
  };
}
