import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  DEFAULT_MATERIALS,
  createInitialProject,
  evaluateUnifiedEngineeringModel,
} from "@birim/core";
import {
  V4_MODULE_TEMPLATES,
  V5_SPECIALIZED_MODULE_TEMPLATES,
  V5_COMPOSITE_ASSEMBLIES,
} from "@birim/catalog";
import { generateModuleGeometry } from "@birim/geometry";
import {
  V11_CATALOG_GROUPS,
  classifyTemplateGroup,
  filterMaterialsByGroup,
  formatFindingForTier,
} from "../apps/configurator/src/v11/v11Constants";

describe("V11.2 Clean-Sheet Studio UI, Industrial Catalog & Section MiniMap Verification", () => {
  const rootDir = path.resolve(__dirname, "..");

  it("wires /, /v3, /v3/studio, /v3/plan, and /v3/showroom to BirimStudioWorkspace and rewrites /favicon.ico", () => {
    const routes = [
      "apps/configurator/src/app/page.tsx",
      "apps/configurator/src/app/v3/page.tsx",
      "apps/configurator/src/app/v3/studio/page.tsx",
      "apps/configurator/src/app/v3/plan/page.tsx",
      "apps/configurator/src/app/v3/showroom/page.tsx",
    ];
    for (const rel of routes) {
      const content = fs.readFileSync(path.join(rootDir, rel), "utf8");
      expect(content).toContain("BirimStudioWorkspace");
    }
    const nextCfg = fs.readFileSync(
      path.join(rootDir, "apps/configurator/next.config.mjs"),
      "utf8"
    );
    expect(nextCfg).toContain('source: "/favicon.ico"');
    expect(nextCfg).toContain('destination: "/icon.svg"');
  });

  it("docks collapsed RightParametricInspector vertically at top-1/2 and includes SectionPlaneMiniMap", () => {
    const inspector = fs.readFileSync(
      path.join(rootDir, "apps/configurator/src/v11/RightParametricInspector.tsx"),
      "utf8"
    );
    expect(inspector).toContain("top-1/2 -translate-y-1/2");
    expect(inspector).not.toContain("top-[82px]");

    const miniMap = path.join(rootDir, "apps/configurator/src/v11/SectionPlaneMiniMap.tsx");
    expect(fs.existsSync(miniMap)).toBe(true);
  });

  it("classifies TV bench, capsule dining table, kitchen, and wardrobe templates cleanly", () => {
    expect(V11_CATALOG_GROUPS).toHaveLength(4);
    const allTpls = [...V5_SPECIALIZED_MODULE_TEMPLATES, ...V4_MODULE_TEMPLATES];
    const groups = { wardrobe: 0, kitchen: 0, living: 0 };
    for (const tpl of allTpls) {
      if (tpl.complementaryRole || tpl.templateId === "tpl_sc_10_custom_geometry") continue;
      groups[classifyTemplateGroup(tpl)]++;
    }
    expect(groups.wardrobe).toBeGreaterThan(0);
    expect(groups.kitchen).toBeGreaterThan(0);
    expect(groups.living).toBeGreaterThan(0);
  });

  it("ensures every ready module template and composite set passes industrial engineering & 3D clash rules", () => {
    for (const tpl of [...V4_MODULE_TEMPLATES, ...V5_SPECIALIZED_MODULE_TEMPLATES]) {
      if (tpl.requiresFactoryValidation) continue;
      const proj = createInitialProject();
      const mod = tpl.createInstance("audit_" + tpl.templateId);
      proj.modules = [mod];
      proj.space.walls[0].length = Math.max(3600, mod.dimensions.width + 400);
      proj.space.walls[0].height = Math.max(2700, mod.dimensions.height + 200);
      const rep = evaluateUnifiedEngineeringModel(proj);
      const hardErrors = rep.findings.filter((f) => f.severity === "error");
      expect(hardErrors).toHaveLength(0);

      const geom = generateModuleGeometry(mod, { doorOpenAngleDeg: 0, drawerOpenMm: 0 });
      const doors = geom.components.filter((c) => c.role === "door_left" || c.role === "door_right");
      const drwFronts = geom.components.filter((c) => c.role === "drawer_front");
      for (const df of drwFronts) {
        for (const dr of doors) {
          const ox =
            df.position.x < dr.position.x + dr.dimensions.width - 2 &&
            df.position.x + df.dimensions.width > dr.position.x + 2;
          const oy =
            df.position.y < dr.position.y + dr.dimensions.height - 2 &&
            df.position.y + df.dimensions.height > dr.position.y + 2;
          const oz = df.position.z + df.dimensions.depth > dr.position.z - 2;
          expect(ox && oy && oz).toBe(false);
        }
      }
    }

    for (const comp of V5_COMPOSITE_ASSEMBLIES) {
      const proj = createInitialProject();
      const built = comp.buildItems(100);
      proj.modules = built.modules || [];
      proj.sceneObjects = built.sceneObjects || [];
      proj.space.walls[0].length = 4800;
      const rep = evaluateUnifiedEngineeringModel(proj);
      const hardErrors = rep.findings.filter((f) => f.severity === "error");
      expect(hardErrors).toHaveLength(0);
    }
  });

  it("strips DIN/EN jargon in simple tier while keeping technical codes in factory tier", () => {
    expect(filterMaterialsByGroup(DEFAULT_MATERIALS, "all").length).toBe(
      DEFAULT_MATERIALS.length
    );
    const sampleFinding = {
      code: "SHELF_SPAN_WARNING",
      severity: "warning" as const,
      message: "DIN 68874 standardına göre sehim uyarısı.",
    };
    expect(formatFindingForTier(sampleFinding as any, "simple").detail).not.toContain("DIN");
    expect(formatFindingForTier(sampleFinding as any, "factory").detail).toContain("DIN 68874");
  });
});
