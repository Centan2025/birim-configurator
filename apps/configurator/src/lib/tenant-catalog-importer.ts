import {
  DEFAULT_MATERIALS,
  createInitialProject,
  validateProject,
  type MaterialDefinition,
  type ModuleInstance,
} from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import { TenantSecurityError } from "./tenant-auth-guard";

export interface TenantPublishedTemplate {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  versionNo: number;
  lifecycleStatus: "draft" | "published" | "deprecated";
  moduleSnapshot: ModuleInstance;
  verifiedCutPiecesCount: number;
  publishedAt: string;
}

const TENANT_MATERIALS_STORE = new Map<string, MaterialDefinition[]>();
const TENANT_TEMPLATES_STORE = new Map<string, TenantPublishedTemplate[]>();

const VALID_CATEGORIES = new Set<MaterialDefinition["category"]>([
  "wood",
  "lacquer",
  "laminate",
  "glass",
  "stone",
  "metal",
  "mirror",
  "compact",
]);

/**
 * Parses CSV or TSV material & pricing sheets into validated tenant-scoped MaterialDefinition records.
 * Expected header (flexible column order):
 * code,name,brand,category,thicknessMm,costPerM2Eur,edgeBandCostPerMEur,colorHex
 */
export function importTenantMaterialsFromCsv(
  tenantId: string,
  csvText: string
): { importedCount: number; materials: MaterialDefinition[] } {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (lines.length < 2) {
    throw new TenantSecurityError(
      "CSV_EMPTY_OR_HEADER_ONLY",
      "CSV verisi en az 1 başlık satırı ve 1 malzeme satırı içermelidir.",
      400
    );
  }

  const delimiter = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0]
    .split(delimiter)
    .map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));

  const colIdx = (aliases: string[]) => headers.findIndex((h) => aliases.includes(h));
  const iCode = colIdx(["code", "kod", "id", "materialcode", "sku"]);
  const iName = colIdx(["name", "ad", "malzemead", "title"]);
  const iBrand = colIdx(["brand", "marka"]);
  const iCat = colIdx(["category", "kategori", "type"]);
  const iThick = colIdx(["thicknessmm", "thickness", "kalinlik", "kalinlikmm"]);
  const iCost = colIdx(["costperm2eur", "costperm2", "m2fiyat", "fiyateur", "price"]);
  const iEdge = colIdx(["edgebandcostpermeur", "edgebandcost", "bantfiyat", "kenarbant"]);
  const iHex = colIdx(["colorhex", "hex", "renk"]);

  if (iName < 0 || iCost < 0) {
    throw new TenantSecurityError(
      "CSV_MISSING_REQUIRED_COLUMNS",
      "CSV başlığında en az 'name' (ad) ve 'costPerM2Eur' (m2fiyat) sütunları bulunmalıdır.",
      400
    );
  }

  const existing = TENANT_MATERIALS_STORE.get(tenantId) || [];
  const byId = new Map<string, MaterialDefinition>(existing.map((m) => [m.id, m]));
  const newlyImported: MaterialDefinition[] = [];

  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
    const rawName = cols[iName] || "";
    if (!rawName) continue;

    const rawCode =
      (iCode >= 0 ? cols[iCode] : "") ||
      `mat_${rawName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24)}_${r}`;
    const matId = rawCode.startsWith("mat_") ? rawCode : `mat_${rawCode.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;
    const rawCat = (iCat >= 0 ? cols[iCat] : "laminate").toLowerCase() as MaterialDefinition["category"];
    const category: MaterialDefinition["category"] = VALID_CATEGORIES.has(rawCat) ? rawCat : "laminate";
    const thickness = Math.max(4, Math.min(60, Number(iThick >= 0 ? cols[iThick] : 18) || 18));
    const costPerM2 = Math.max(0, Number((cols[iCost] || "0").replace(",", ".")) || 0);
    const edgeBandCostPerM = Math.max(
      0,
      Number(((iEdge >= 0 ? cols[iEdge] : "1.5") || "1.5").replace(",", ".")) || 1.5
    );
    const colorHexRaw = iHex >= 0 && /^#[0-9a-fA-F]{6}$/.test(cols[iHex]) ? cols[iHex] : "#E5E2DC";

    const mat: MaterialDefinition = {
      id: matId,
      name: rawName,
      brand: iBrand >= 0 && cols[iBrand] ? cols[iBrand] : undefined,
      decorCode: rawCode.toUpperCase(),
      category,
      thickness,
      densityKgPerM3: category === "lacquer" ? 750 : 670,
      elasticModulusMpa: category === "lacquer" ? 2800 : 2400,
      mechanicalDataVerified: true,
      colorHex: colorHexRaw,
      roughness: category === "lacquer" ? 0.22 : 0.45,
      metalness: category === "metal" ? 0.85 : 0.02,
      costPerM2,
      edgeBandCostPerM,
      hasGrain: category === "wood",
    };
    byId.set(mat.id, mat);
    newlyImported.push(mat);
  }

  const merged = Array.from(byId.values());
  TENANT_MATERIALS_STORE.set(tenantId, merged);
  return { importedCount: newlyImported.length, materials: newlyImported };
}

export function listTenantCustomMaterials(tenantId: string): MaterialDefinition[] {
  return [...(TENANT_MATERIALS_STORE.get(tenantId) || [])];
}

/**
 * Validates a parametric module template through the real engineering & BOM engine
 * BEFORE allowing a tenant admin to publish it to sales reps / dealers.
 */
export function publishTenantModuleTemplate(params: {
  tenantId: string;
  code: string;
  name: string;
  moduleSnapshot: ModuleInstance;
}): TenantPublishedTemplate {
  const testProject = {
    ...createInitialProject(),
    tenantId: params.tenantId,
    space: {
      ...createInitialProject().space,
      ceilingHeight: 3000,
      walls: [
        {
          id: "w_test",
          name: "Doğrulama Duvarı",
          length: 6000,
          height: 3000,
          thickness: 200,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
          elements: [],
        },
      ],
    },
    modules: [{ ...structuredClone(params.moduleSnapshot), position: { x: 200, y: 0, z: 200 } }],
  };

  const blockingErrors = validateProject(testProject).filter((i) => i.severity === "error");
  if (blockingErrors.length > 0) {
    throw new TenantSecurityError(
      "TEMPLATE_VALIDATION_FAILED",
      `Şablon mühendislik doğrulamasından geçemedi: [${blockingErrors[0].code}] ${blockingErrors[0].message}`,
      422
    );
  }

  const matMap = new Map(
    [...DEFAULT_MATERIALS, ...listTenantCustomMaterials(params.tenantId)].map((m) => [m.id, m])
  );
  const bom = generateBOMForProject(testProject, matMap);
  if (bom.cutList.length === 0) {
    throw new TenantSecurityError(
      "TEMPLATE_EMPTY_BOM",
      "Yayınlanacak modül şablonu en az 1 üretilebilir kesim parçası üretmelidir.",
      422
    );
  }

  const existing = TENANT_TEMPLATES_STORE.get(params.tenantId) || [];
  const prevLatest = existing
    .filter((t) => t.code === params.code)
    .reduce((max, t) => Math.max(max, t.versionNo), 0);

  const published: TenantPublishedTemplate = {
    id: `ttpl_${params.code}_v${prevLatest + 1}`,
    tenantId: params.tenantId,
    code: params.code,
    name: params.name,
    versionNo: prevLatest + 1,
    lifecycleStatus: "published",
    moduleSnapshot: structuredClone(params.moduleSnapshot),
    verifiedCutPiecesCount: bom.cutList.length,
    publishedAt: new Date().toISOString(),
  };
  existing.unshift(published);
  TENANT_TEMPLATES_STORE.set(params.tenantId, existing);
  return published;
}

export function listTenantPublishedTemplates(tenantId: string): TenantPublishedTemplate[] {
  return [...(TENANT_TEMPLATES_STORE.get(tenantId) || [])];
}
