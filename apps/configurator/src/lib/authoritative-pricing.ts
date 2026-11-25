import {
  DEFAULT_MATERIALS,
  type DesignProject,
  type MaterialDefinition,
  type SceneObjectInstance,
  type TenantWorkspaceProfile,
} from "@birim/core";
import { V5_SCENE_OBJECT_CATALOG } from "@birim/catalog";
import { listTenantCustomMaterials } from "./tenant-catalog-importer";

const OFFICIAL_MATERIALS_BY_ID = new Map<string, MaterialDefinition>(
  DEFAULT_MATERIALS.map((m) => [m.id, structuredClone(m)])
);

const OFFICIAL_SCENE_CATALOG_BY_ID = new Map(
  V5_SCENE_OBJECT_CATALOG.map((item) => [item.catalogId, item])
);

const MIN_FALLBACK_MATERIAL_COST_EUR = 18;
const MIN_FALLBACK_EDGE_COST_EUR = 1.2;

/**
 * Builds a tamper-proof server-authoritative MaterialDefinition map:
 * 1. Official `DEFAULT_MATERIALS` can NEVER be overridden by client payload `customMaterials`.
 * 2. Tenant-imported custom materials (`listTenantCustomMaterials(tenantId)`) take authority
 *    for tenant-specific SKUs.
 * 3. Unregistered client `customMaterials` keep only visual properties while enforcing
 *    conservative factory floor pricing so a client cannot zero-out material costs.
 */
export function buildAuthoritativeMaterialsMap(
  tenantId: string,
  clientCustomMaterials?: MaterialDefinition[]
): Map<string, MaterialDefinition> {
  const tenantMaterials = listTenantCustomMaterials(tenantId);
  const tenantById = new Map<string, MaterialDefinition>(
    tenantMaterials.map((m) => [m.id, m])
  );

  const map = new Map<string, MaterialDefinition>(OFFICIAL_MATERIALS_BY_ID);

  for (const tm of tenantMaterials) {
    if (!OFFICIAL_MATERIALS_BY_ID.has(tm.id)) {
      map.set(tm.id, tm);
    }
  }

  for (const cm of clientCustomMaterials || []) {
    if (!cm || !cm.id) continue;
    // Never allow client payload to override official or tenant-catalog material prices
    if (OFFICIAL_MATERIALS_BY_ID.has(cm.id) || tenantById.has(cm.id)) {
      continue;
    }
    const safeCost = Number.isFinite(cm.costPerM2)
      ? Math.max(MIN_FALLBACK_MATERIAL_COST_EUR, cm.costPerM2)
      : MIN_FALLBACK_MATERIAL_COST_EUR;
    const safeEdgeCost = Number.isFinite(cm.edgeBandCostPerM)
      ? Math.max(MIN_FALLBACK_EDGE_COST_EUR, cm.edgeBandCostPerM)
      : MIN_FALLBACK_EDGE_COST_EUR;
    map.set(cm.id, {
      ...cm,
      costPerM2: safeCost,
      edgeBandCostPerM: safeEdgeCost,
    });
  }

  return map;
}

/**
 * Reconciles client-submitted `sceneObjects` against `V5_SCENE_OBJECT_CATALOG` so
 * quoted commercial appliances/furniture cannot have their `unitPriceEur` or
 * `commercialRole` downgraded client-side.
 */
export function buildAuthoritativeSceneObjects(
  rawSceneObjects?: SceneObjectInstance[]
): SceneObjectInstance[] {
  if (!Array.isArray(rawSceneObjects) || rawSceneObjects.length === 0) return [];
  return rawSceneObjects.map((obj) => {
    const official = obj.catalogId ? OFFICIAL_SCENE_CATALOG_BY_ID.get(obj.catalogId) : undefined;
    if (official) {
      return {
        ...obj,
        commercialRole: official.commercialRole,
        unitPriceEur: official.unitPriceEur,
        quantity: Math.max(1, Math.round(Number(obj.quantity) || 1)),
      };
    }
    return {
      ...obj,
      unitPriceEur: Number.isFinite(obj.unitPriceEur) ? Math.max(0, obj.unitPriceEur) : 0,
      quantity: Math.max(1, Math.round(Number(obj.quantity) || 1)),
    };
  });
}

export function clampAuthoritativeDiscountPercent(
  requestedDiscountPercent: unknown,
  tenantProfile?: TenantWorkspaceProfile
): number {
  const maxAllowed = tenantProfile?.pricing.maxSalesRepDiscountPercent ?? 25;
  const num = Number(requestedDiscountPercent);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(maxAllowed, num));
}

export function sanitizeProjectForServerPricing(
  project: DesignProject,
  tenantId: string
): {
  materialsMap: Map<string, MaterialDefinition>;
  sceneObjects: SceneObjectInstance[];
} {
  return {
    materialsMap: buildAuthoritativeMaterialsMap(tenantId, project.customMaterials),
    sceneObjects: buildAuthoritativeSceneObjects(project.sceneObjects),
  };
}
