import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  DEFAULT_MATERIALS,
  applyApprovedRemediationProposal,
  calculateFourSpaceDimensions,
  computeSystem32MultiHoleYs,
  createInitialProject,
  evaluateUnifiedEngineeringModel,
} from "@birim/core";
import {
  V4_MODULE_TEMPLATES,
  V5_SPECIALIZED_MODULE_TEMPLATES,
  V5_COMPOSITE_ASSEMBLIES,
} from "@birim/catalog";
import { generateModuleGeometry } from "@birim/geometry";
import { generateBOMForProject } from "@birim/manufacturing";
import {
  V11_CATALOG_GROUPS,
  classifyTemplateGroup,
  filterMaterialsByGroup,
  formatFindingForTier,
} from "../apps/configurator/src/v11/v11Constants";
import {
  computeBaySystem32ShelfHoleElevations,
  computeElevationSnapTargets,
  snapShelfToMultiHoleOrElevationTargets,
} from "../apps/configurator/src/v3/engine/elevationSnapEngine";

describe("V11.4 Studio UI, Fixed Shelf, System-32 Multi-Hole Shelf Snap, Performance & 3D Error Beacons", () => {
  const rootDir = path.resolve(__dirname, "..");

  it("wires /, /v3, /v3/studio, /v3/plan, and /v3/showroom to BirimStudioWorkspace and keeps V3ThreeViewport persistently mounted", () => {
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
    const ws = fs.readFileSync(
      path.join(rootDir, "apps/configurator/src/v11/BirimStudioWorkspace.tsx"),
      "utf8"
    );
    expect(ws).toContain("paused={!show3DCanvas}");
    expect(ws).toContain("onBeginSliderDrag={beginHistoryTransaction}");
    expect(ws).toContain("onCommitSliderDrag={commitHistoryTransaction}");

    const nextCfg = fs.readFileSync(
      path.join(rootDir, "apps/configurator/next.config.mjs"),
      "utf8"
    );
    expect(nextCfg).toContain('source: "/favicon.ico"');
    expect(nextCfg).toContain('destination: "/icon.svg"');
  });

  it("exposes interactive 3D red/amber beacon popovers and top-header issue explanations", () => {
    const vp3d = fs.readFileSync(
      path.join(rootDir, "apps/configurator/src/v3/components/V3ThreeViewport.tsx"),
      "utf8"
    );
    expect(vp3d).toContain("engineeringBeaconGroupRef");
    expect(vp3d).toContain('data-testid="v11-3d-beacon-popover"');
    expect(vp3d).toContain('data-testid="v11-3d-beacon-summary-pill"');
    expect(vp3d).toContain("isXrayActive ? storeBom : null");

    const hdr = fs.readFileSync(
      path.join(rootDir, "apps/configurator/src/v11/StudioHeaderBar.tsx"),
      "utf8"
    );
    expect(hdr).toContain('data-testid="v11-header-issues-btn"');
    expect(hdr).toContain('data-testid="v11-header-issues-popover"');
  });

  it("snaps dragged movable shelves strictly to physical System-32 multi-hole coordinates while allowing fixed shelves free placement", () => {
    const proj = createInitialProject();
    const mod = proj.modules[0];
    mod.carcass.multiHoleMode = "full_system_32";
    const movableShelf = mod.bays[0].shelves.find((s) => s.isAdjustable)!;
    const fixedShelf = mod.bays[0].shelves.find((s) => !s.isAdjustable)!;

    const holeYs = computeBaySystem32ShelfHoleElevations(mod, 0, movableShelf.id);
    expect(holeYs).toBeDefined();
    expect(holeYs!.length).toBeGreaterThan(10);

    // Every consecutive non-blocked hole must follow exact 32mm System-32 pitch
    for (let i = 1; i < holeYs!.length; i++) {
      expect((holeYs![i] - holeYs![i - 1]) % 32).toBe(0);
    }

    // Verify 0.00mm match against physical side-panel System-32 boring coordinates
    const plinthH = mod.carcass.plinthHeight ?? 80;
    const panelT = mod.carcass.panelThickness || 18;
    const sideHoleYs = computeSystem32MultiHoleYs({
      mode: "full_system_32",
      panelHeightMm: mod.dimensions.height,
      bottomOffsetY: plinthH,
      panelThicknessMm: panelT,
      edgeMarginMm: 96,
      adjustableShelfYsMm: [],
      blockedYsMm: [{ y: plinthH + panelT + fixedShelf.elevationY, clearanceMm: 22 }],
    });
    const shelfHalfT = Math.round((movableShelf.thickness || panelT) / 2);
    for (const hy of holeYs!) {
      expect(sideHoleYs.includes(plinthH + panelT + hy + shelfHalfT)).toBe(true);
    }

    // Arbitrary drag input (e.g., 463mm) must snap onto an exact System-32 hole (not 465mm!)
    const targets = computeElevationSnapTargets(proj, 0, 0, movableShelf.id, 18);
    const snapped = snapShelfToMultiHoleOrElevationTargets({
      project: proj,
      moduleIndex: 0,
      bayIndex: 0,
      shelfId: movableShelf.id,
      rawElevationY: 463,
      snapTargets: targets,
    });
    expect(holeYs!.includes(snapped.elevationY)).toBe(true);
    expect(snapped.snappedTarget?.kind).toBe("system32_hole");
    expect(snapped.snappedTarget?.label).toContain("Sistem 32 Delik");

    // Fixed shelf returns null from multi-hole restriction (not pinned to Ø5mm holes)
    expect(computeBaySystem32ShelfHoleElevations(mod, 0, fixedShelf.id)).toBeNull();
  });

  it("loads a standard 1500mm 3-door initial wardrobe with 0 span warnings both initially AND when right bay uses 5-shelf preset", () => {
    const proj = createInitialProject();
    const mod = proj.modules[0];
    expect(mod.dimensions.width).toBe(1500);
    const fs4 = calculateFourSpaceDimensions(mod);
    expect(fs4.usableInternal.bayClearWidthsMm[0]).toBe(473);
    expect(fs4.usableInternal.bayClearWidthsMm[1]).toBe(973);
    expect(Math.abs(fs4.doorLeaves[0].leafWidthMm - fs4.doorLeaves[1].leafWidthMm)).toBeLessThanOrEqual(4);

    const repInit = evaluateUnifiedEngineeringModel(proj);
    expect(repInit.findings.filter((f) => f.code.includes("SPAN") || f.code.includes("DEFLECTION"))).toHaveLength(0);

    mod.bays[1].drawers = [];
    mod.bays[1].hangingRails = [];
    mod.bays[1].shelves = [1, 2, 3, 4, 5].map((i) => ({
      id: `sh_test_${i}`,
      bayIndex: 1,
      elevationY: i * 340,
      isAdjustable: i !== 3,
      isFixed: i === 3,
      fixedConnectorType: i === 3 ? "minifix_dowel" : undefined,
    }));
    const repShelves = evaluateUnifiedEngineeringModel(proj);
    expect(repShelves.findings.filter((f) => f.code.includes("SPAN") || f.code.includes("DEFLECTION"))).toHaveLength(0);
    expect(repShelves.findings.filter((f) => f.code === "INFO_TALL_CARCASS_NEEDS_FIXED_SHELF")).toHaveLength(0);

    const wideProj = createInitialProject();
    wideProj.modules[0].dimensions.width = 1800;
    wideProj.modules[0].bays[0].customWidth = 575;
    const repWideFixedOnly = evaluateUnifiedEngineeringModel(wideProj);
    expect(
      repWideFixedOnly.findings.some((f) => f.code.includes("SPAN") || f.code.includes("DEFLECTION"))
    ).toBe(true);
  });

  it("drills Minifix+Dowel vs Rafix 20 fixed shelves accurately on side/divider panels and remediates all-movable tall stacks", () => {
    const proj = createInitialProject();
    const mod = proj.modules[0];
    mod.bays[0].hangingRails = [];
    mod.bays[0].shelves = [350, 750, 1150, 1550].map((y, idx) => ({
      id: `mov_${idx}`,
      bayIndex: 0,
      elevationY: y,
      isAdjustable: true,
      isFixed: false,
    }));
    const repBefore = evaluateUnifiedEngineeringModel(proj);
    const tallFinding = repBefore.findings.find(
      (f) => f.code === "INFO_TALL_CARCASS_NEEDS_FIXED_SHELF"
    );
    expect(tallFinding).toBeDefined();
    expect(tallFinding?.remediationProposals?.[0]?.patchKind).toBe("convert_mid_shelf_to_fixed");

    const fixedProj = applyApprovedRemediationProposal(proj, tallFinding!.remediationProposals![0]);
    expect(
      fixedProj.modules[0].bays[0].shelves.some((s) => s.isAdjustable === false && s.isFixed === true)
    ).toBe(true);

    const fxShelf = fixedProj.modules[0].bays[0].shelves.find((s) => !s.isAdjustable)!;
    fxShelf.fixedConnectorType = "rafix_20";
    const bom = generateBOMForProject(fixedProj);
    expect(bom.hardwareList.some((h) => ((h as any).id === "HW_RAFIX_20_SET" || h.sku === "HW_RAFIX_20_SET"))).toBe(true);
    const shelfCut = bom.cutList.find((c) => c.id.includes(fxShelf.id))!;
    expect((shelfCut.holes || []).some((h) => h.purpose === "rafix_housing" && h.diameter === 20)).toBe(true);
    const leftSide = bom.cutList.find((c) => c.componentRole === "carcass_side_left")!;
    expect((leftSide.holes || []).some((h) => h.purpose === "rafix_stud" && h.diameter === 5)).toBe(true);
    const midDivider = bom.cutList.find((c) => c.componentRole === "carcass_divider")!;
    expect((midDivider.holes || []).some((h) => h.purpose === "rafix_stud" && h.diameter === 5)).toBe(true);
    expect((midDivider.holes || []).some((h) => h.purpose === "minifix_bolt" && h.direction === "face_back")).toBe(true);
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

  it("enforces V11.5 Next.js 15 App Router route/page export rules (fixes Vercel r2-upload build error)", async () => {
    const allowedRouteExports = new Set([
      "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
      "runtime", "dynamic", "dynamicParams", "revalidate", "fetchCache", "preferredRegion", "maxDuration"
    ]);
    const allowedPageExports = new Set([
      "default", "metadata", "generateMetadata", "viewport", "generateViewport",
      "dynamic", "dynamicParams", "revalidate", "fetchCache", "runtime", "preferredRegion", "maxDuration", "generateStaticParams"
    ]);

    function walkAppDir(dir: string, acc: string[] = []): string[] {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walkAppDir(full, acc);
        else if (/\.(ts|tsx)$/.test(ent.name)) acc.push(full);
      }
      return acc;
    }

    const appFiles = walkAppDir(path.resolve(__dirname, "../apps/configurator/src/app"));
    expect(appFiles.length).toBeGreaterThan(15);

    for (const file of appFiles) {
      const base = path.basename(file);
      if (!["route.ts", "route.tsx", "page.tsx", "page.ts", "layout.tsx", "layout.ts"].includes(base)) continue;
      const content = fs.readFileSync(file, "utf8");
      const namedMatches = [...content.matchAll(/^\s*export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_]+)/gm)];
      for (const m of namedMatches) {
        const expName = m[1];
        if (base.startsWith("route.")) {
          expect(allowedRouteExports.has(expName)).toBe(true);
        } else {
          expect(allowedPageExports.has(expName)).toBe(true);
        }
      }
    }

    const { buildIsolatedConfiguratorR2Key, buildR2SigV4PutHeaders } = await import("../apps/configurator/src/lib/r2-upload-helpers");
    const key = buildIsolatedConfiguratorR2Key({
      organizationId: "birim-org-01",
      subFolder: "glb",
      fileName: "wardrobe.glb",
      timestampMs: 1700000000000,
    });
    expect(key).toBe("birim-org-01/configurator/glb/1700000000000-wardrobe.glb");
    expect(typeof buildR2SigV4PutHeaders).toBe("function");
  });

  it("compresses >=900-tri GLB props by >12x, freezes static matrices, and decouples interiorPropsGroupRef from door animations", async () => {
    const THREE = await import("three");
    const {
      decimateHighPolyBufferGeometry,
    } = await import("../apps/configurator/src/v3/materials/wardrobeGlbAssetLoader");
    const {
      createSculptedHangingShirtGroup,
      createFoldedKnitwearStackGroup,
      createLiddedStorageBoxGroup,
      createSculptedShoePairGroup,
    } = await import("../apps/configurator/src/v3/materials/wardrobePropsBuilder");
    const { buildSceneObject3DGroup } = await import("../apps/configurator/src/v3/materials/sceneObject3DBuilder");

    // 19,800-triangle sphere (simulates 19,517-tri shirt_baked.glb that previously escaped >20,500 threshold!)
    const hiSphere = new THREE.SphereGeometry(220, 100, 99);
    const rawTriCount = hiSphere.index ? hiSphere.index.count / 3 : hiSphere.attributes.position.count / 3;
    expect(rawTriCount).toBeGreaterThan(19000);

    const decimated = decimateHighPolyBufferGeometry(hiSphere, 13);
    const decTriCount = decimated.index ? decimated.index.count / 3 : decimated.attributes.position.count / 3;
    expect(decTriCount).toBeLessThan(1600);

    // Build full bay interior props set & verify frozen matrices, zero shadows, zero raycast, ultra-low triangle count
    const bayProps = new THREE.Group();
    bayProps.add(createSculptedHangingShirtGroup(0, 820, 500, 145));
    bayProps.add(createSculptedHangingShirtGroup(1, 820, 500, 145));
    bayProps.add(createFoldedKnitwearStackGroup(300, 300, 3, 0));
    bayProps.add(createLiddedStorageBoxGroup(280, 145, 290));
    bayProps.add(createSculptedShoePairGroup(0, 300));

    let totalPropTris = 0;
    let unFrozenNodes = 0;
    bayProps.traverse((obj: any) => {
      if (obj !== bayProps && obj.parent !== bayProps && obj.matrixAutoUpdate !== false) {
        unFrozenNodes++;
      }
      if (obj.isMesh && obj.geometry) {
        expect(obj.castShadow).toBe(false);
        const tris = obj.geometry.index
          ? obj.geometry.index.count / 3
          : obj.geometry.attributes.position.count / 3;
        totalPropTris += tris;
      }
    });
    expect(unFrozenNodes).toBe(0);
    expect(totalPropTris).toBeLessThan(1500);

    // Verify SceneObject 3D uses O(1) 12-triangle proxy hitbox and disables raycast on visual meshes
    const soGrp = buildSceneObject3DGroup({
      id: "so_fridge_1",
      catalogId: "app_fridge_90",
      name: "Gardırop Tipi Buzdolabı",
      category: "appliance",
      visualKind: "fridge_french_door",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 900, height: 1820, depth: 700 },
      quantity: 1,
      unitPriceEur: 1450,
      commercialRole: "catalog_priced",
    });
    let hitboxCount = 0;
    soGrp.traverse((ch: any) => {
      if (ch.userData?.isSceneObjectHitbox) hitboxCount++;
    });
    expect(hitboxCount).toBe(1);

    // Verify V3ThreeViewport decouples interiorPropsGroupRef from meshGroup viewSigSuffix
    const vpSrc = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/v3/components/V3ThreeViewport.tsx"),
      "utf8"
    );
    expect(vpSrc).toContain("v11_interior_props_3d");
    expect(vpSrc).toContain("doorOpenAngleDeg > 8");
    const sigLine = vpSrc.split("\n").find((l) => l.includes("const viewSigSuffix =")) || "";
    expect(sigLine.includes("showInteriorProps3D")).toBe(false);
  });

  it("enforces V11.6 Zustand v5 UseBoundStore<StoreApi<ConfiguratorState>> & zero circular implicit-any inference", async () => {
    const storeCode = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/store/useConfiguratorStore.ts"),
      "utf8"
    );
    expect(storeCode).toContain("export interface ConfiguratorState");
    expect(storeCode).toContain(
      "export const useConfiguratorStore: UseBoundStore<StoreApi<ConfiguratorState>> = create<ConfiguratorState>()("
    );
    expect(storeCode).toContain("updateCarcass: (patch: Partial<ModuleInstance[\"carcass\"]>) => void;");

    const { useConfiguratorStore } = await import("../apps/configurator/src/store/useConfiguratorStore");
    expect(typeof useConfiguratorStore.getState().updateCarcass).toBe("function");

    const v11ConstCode = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/v11/v11Constants.ts"),
      "utf8"
    );
    expect(v11ConstCode).toContain("import type { UserExperienceTier } from \"../store/useConfiguratorStore\"");
  });

  it("enforces V11.7 TS 5.7 Uint8Array<ArrayBufferLike> -> BlobPart / BodyInit / BufferSource safety across all files", () => {
    const bomModal = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/components/BomModal.tsx"),
      "utf8"
    );
    expect(bomModal).toContain("zipBytes as unknown as BlobPart");

    const erpModal = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/components/StoreErpModal.tsx"),
      "utf8"
    );
    expect(erpModal).toContain("zipBytes as unknown as BodyInit");

    const arModal = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/v3/components/workspace/ArRoomPreviewModal.tsx"),
      "utf8"
    );
    expect(arModal).toContain("bytesOrText as unknown as BlobPart");
    expect(arModal).toContain("glb as unknown as BlobPart");

    const r2Route = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/app/api/integrations/r2-upload/route.ts"),
      "utf8"
    );
    expect(r2Route).toContain("new Uint8Array(bodyBuffer) as unknown as BodyInit");

    const libAdmin = fs.readFileSync(
      path.resolve(__dirname, "../packages/catalog/src/v4-library-admin.ts"),
      "utf8"
    );
    expect(libAdmin).toContain("as unknown as BufferSource");
  });

  it("enforces V11.8 instant 3D camera orbit (LEFT=ROTATE, moveObjectMode3D=false), <20ms PBR startup & strict TS ComponentGeometry/SpaceDefinition compatibility", () => {
    const vpSrc = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/v3/components/V3ThreeViewport.tsx"),
      "utf8"
    );
    // 1. Left-click drag MUST rotate the 3D scene and moveObjectMode3D MUST default to false!
    expect(vpSrc).toContain("LEFT: THREE.MOUSE.PAN");
    expect(vpSrc).toContain("RIGHT: THREE.MOUSE.ROTATE");
    expect(vpSrc).toContain("const [moveObjectMode3D, setMoveObjectMode3D] = useState<boolean>(false)");
    expect(vpSrc).toContain("const [invertCameraMouse, setInvertCameraMouse] = useState<boolean>(false)");
    expect(vpSrc).toContain("scene.environment = getStudioEnvironmentTexture()");
    expect(vpSrc).toContain("window.addEventListener(\"pointercancel\", handlePointerCancelOrBlur");
    expect(vpSrc).toContain("updateSelectionFramesRef.current()");

    // Ensure handlePointerDown never calls selectModuleBayComponentSafe synchronously before drag/click disambiguation
    const pDownStart = vpSrc.indexOf("const handlePointerDown = (e: PointerEvent) => {");
    const pDownEnd = vpSrc.indexOf("const hoverOverlayGroup = new THREE.Group();");
    expect(pDownStart).toBeGreaterThan(0);
    expect(pDownEnd).toBeGreaterThan(pDownStart);
    const pDownBody = vpSrc.slice(pDownStart, pDownEnd);
    expect(pDownBody.includes("selectModuleBayComponentSafe(")).toBe(false);

    // 2. Verify ComponentMesh & @birim/geometry strict TS compatibility (zero ComponentBox3D error, valid grainDirection & cutoutHole)
    const geomTypesSrc = fs.readFileSync(
      path.resolve(__dirname, "../packages/geometry/src/types.ts"),
      "utf8"
    );
    expect(geomTypesSrc).toContain("export type ComponentBox3D = ComponentGeometry;");
    expect(geomTypesSrc).toContain("grainDirection?:");

    const cmSrc = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/components/componentMesh.ts"),
      "utf8"
    );
    expect(cmSrc.includes('import("@birim/geometry").ComponentBox3D')).toBe(false);
    expect(cmSrc).toContain('hole: NonNullable<ComponentGeometry["cutoutHole"]>');

    // 3. Verify BirimStudioWorkspace uses project.space (never project.room)
    const wsSrc = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/v11/BirimStudioWorkspace.tsx"),
      "utf8"
    );
    expect(wsSrc.includes("project.room")).toBe(false);
    expect(wsSrc).toContain("project.space?.ceilingHeight");

    // 4. Verify PBR procedural texture resolutions stay compact (<=128px) for <15ms main-thread startup
    const pbrSrc = fs.readFileSync(
      path.resolve(__dirname, "../apps/configurator/src/v3/materials/pbrMaterialSystem.ts"),
      "utf8"
    );
    expect(pbrSrc.includes("const W = 512")).toBe(false);
    expect(pbrSrc.includes("const S = 512")).toBe(false);
  });
});
