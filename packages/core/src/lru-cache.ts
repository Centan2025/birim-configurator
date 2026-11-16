import type { DesignProject, ModuleInstance } from "./types";

/**
 * Memory-safe, O(1) Bounded Least-Recently-Used (LRU) Cache.
 * Prevents unbounded Map heap growth across interactive 3D/2D drags,
 * BOM recalculations, geometry builds, and sheet nesting optimizations.
 */
export class BoundedLruCache<K, V> {
  private readonly maxEntries: number;
  private readonly store = new Map<K, V>();
  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 256) {
    this.maxEntries = Math.max(8, maxEntries);
  }

  get(key: K): V | undefined {
    const val = this.store.get(key);
    if (val === undefined && !this.store.has(key)) {
      this.misses += 1;
      return undefined;
    }
    // Promote to MRU position in O(1)
    this.store.delete(key);
    this.store.set(key, val as V);
    this.hits += 1;
    return val;
  }

  set(key: K, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, value);
  }

  has(key: K): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  get size(): number {
    return this.store.size;
  }

  getStats(): { size: number; maxEntries: number; hits: number; misses: number; hitRatePct: number } {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRatePct: total > 0 ? Number(((this.hits / total) * 100).toFixed(2)) : 0,
    };
  }
}

/**
 * Fast, deterministic structural fingerprint for a `ModuleInstance`.
 * Captures all geometry-, BOM-, drilling-, and validation-affecting fields
 * without serializing parent project metadata or unrelated modules.
 */
export function computeModuleStructuralSignature(mod: ModuleInstance): string {
  const c = mod.carcass;
  const d = mod.dimensions;
  const p = mod.position;
  const r = mod.rotation;

  let baysSig = "";
  for (let i = 0; i < mod.bays.length; i++) {
    const b = mod.bays[i];
    const dr = b.door;
    let shelvesSig = "";
    for (let s = 0; s < (b.shelves?.length || 0); s++) {
      const sh = b.shelves[s];
      shelvesSig += `${sh.id}:${sh.elevationY}:${sh.isAdjustable ? 1 : 0}:${sh.isFixed ? 1 : 0}:${sh.fixedConnectorType || ""}:${sh.thickness || 0}:${sh.frontSetbackMm || 0}:${sh.pinHoleGroup || ""}:${sh.isGlass ? 1 : 0}:${sh.isHidden ? 1 : 0};`;
    }
    let drawersSig = "";
    for (let k = 0; k < (b.drawers?.length || 0); k++) {
      const dw = b.drawers[k];
      drawersSig += `${dw.id}:${dw.elevationY}:${dw.height}:${dw.slideType}:${dw.boxSystemType || ""}:${dw.boxSideProfileCode || ""}:${dw.isInternal ? 1 : 0}:${dw.hasSiphonCutout ? 1 : 0}:${dw.siphonCutoutWidthMm || 0}:${dw.siphonCutoutDepthMm || 0}:${dw.hasCooktopHeatShield ? 1 : 0}:${dw.grainGroupId || ""}:${dw.frontMaterialId || ""}:${dw.hardwareProductId || ""}:${dw.nominalLengthMm || 0}:${dw.isHidden ? 1 : 0};`;
    }
    let railsSig = "";
    for (let h = 0; h < (b.hangingRails?.length || 0); h++) {
      const hr = b.hangingRails[h];
      railsSig += `${hr.id}:${hr.elevationY}:${hr.profileType || ""}:${hr.hasIntegratedLed ? 1 : 0}:${hr.isLiftMechanism ? 1 : 0}:${hr.isHidden ? 1 : 0};`;
    }
    let fitSig = "";
    for (let f = 0; f < (b.specialFittings?.length || 0); f++) {
      const sf = b.specialFittings[f];
      fitSig += `${sf.id}:${sf.type}:${sf.elevationY}:${sf.height}:${sf.width || 0}:${sf.depth || 0}:${sf.swingDirection || ""}:${sf.hardwareProductId || ""}:${sf.isHidden ? 1 : 0};`;
    }
    let subSig = "";
    for (let u = 0; u < (b.subDividers?.length || 0); u++) {
      const sd = b.subDividers![u];
      subSig += `${sd.id}:${sd.offsetX}:${sd.elevationY}:${sd.height}:${sd.thickness || 0}:${sd.isHidden ? 1 : 0};`;
    }
    const doorSig = dr
      ? `${dr.id}:${dr.type}:${dr.doorSystemId || ""}:${dr.slidingMountingType || ""}:${dr.overlayType || ""}:${dr.openingTechnology || ""}:${dr.handleCategory || ""}:${dr.handleProfileId || ""}:${dr.hardwareProductId || ""}:${dr.doorThicknessMm || 0}:${dr.doorMaterialId || ""}:${dr.grainGroupId || ""}:${dr.bottomOverhangMm || 0}:${dr.doorBottomGapMm || 0}:${dr.doorTopGapMm || 0}:${dr.handleType || ""}:${dr.softClose ? 1 : 0}:${dr.hingeCount || 0}:${dr.hingeBottomOffsetMm || 0}:${dr.hingeTopOffsetMm || 0}:${dr.isGlassFramed ? 1 : 0}:${dr.crossSectionProfile || ""}:${dr.customCadProfileName || ""}:${dr.handleOrientation || ""}:${dr.handleOffsetY || 0}:${dr.handleEdgeInsetX || 0}:${dr.handleLengthMm || 0}:${dr.handleMaterialId || ""}:${dr.doorEdgeBandThicknessMm || 0}:${dr.doorFrameConstruction || ""}:${dr.frontFillerLeftMm || 0}:${dr.frontFillerRightMm || 0}:${dr.frontFillerPosition || ""}:${dr.customCadPolygon?.length ? JSON.stringify(dr.customCadPolygon) : ""}`
      : "nodoor";

    baysSig += `[${b.index}:${b.widthRatio ?? ""}:${b.customWidth ?? ""}|D(${doorSig})|S(${shelvesSig})|DR(${drawersSig})|HR(${railsSig})|SF(${fitSig})|SD(${subSig})]`;
  }

  const overridesSig = mod.componentMaterialOverrides
    ? Object.entries(mod.componentMaterialOverrides)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join(",")
    : "";
  const grainOverridesSig = mod.componentGrainOverrides
    ? Object.entries(mod.componentGrainOverrides)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join(",")
    : "";
  const cutoutsSig = mod.utilityCutouts?.length ? JSON.stringify(mod.utilityCutouts) : "";
  const cellSig = mod.rootCell ? JSON.stringify(mod.rootCell) : "";
  const slopeSig = c.slopedCeiling
    ? `${c.slopedCeiling.mode}:${c.slopedCeiling.kneeHeightMm}:${c.slopedCeiling.slopeAngleDeg}:${c.slopedCeiling.topFlatSpanMm || 0}`
    : "";
  const baseNotchSig = c.baseboardNotch?.enabled
    ? `${c.baseboardNotch.depthMm}x${c.baseboardNotch.heightMm}`
    : "";
  const crownSig = c.crownMolding?.enabled
    ? `${c.crownMolding.style}:${c.crownMolding.heightMm}:${c.crownMolding.projectionMm}:${c.crownMolding.materialId || ""}`
    : "";
  const cadPolySig = c.customCadPolygon?.length ? JSON.stringify(c.customCadPolygon) : "";
  const modCeilSig = c.ceilingConfig ? JSON.stringify(c.ceilingConfig) : "";

  return (
    `${mod.id}|${mod.name}|${mod.category}|${mod.moduleFamilyId || ""}|${mod.templateId || ""}|` +
    `${mod.complementaryRole || ""}|${mod.isOpenFront ? 1 : 0}|${mod.isCorner ? 1 : 0}|${mod.cornerAngleDeg || 0}|` +
    `${mod.isFixedWidth ? 1 : 0}|${mod.isFreestandingDishwasher ? 1 : 0}|${mod.surfaceFinishOverride || ""}|${mod.edgeBandMaterialId || ""}|` +
    `DIM:${d.width}x${d.height}x${d.depth}|POS:${p.x},${p.y},${p.z}|ROT:${r?.x || 0},${r?.y || 0},${r?.z || 0}|` +
    `CAR:${c.panelThickness}:${c.topPanelThicknessMm || 0}:${c.backPanelThickness}:${c.backPanelType}:${c.backOffsetMm ?? ""}:` +
    `${c.preMillingMm || 0}:${c.allowJumboSheet3660 ? 1 : 0}:${c.carcassJoineryTopology || ""}:${c.connectorSystem || ""}:` +
    `${c.kitchenTopStretcherMode || ""}:${c.appliedEndPanelLeft || ""}:${c.appliedEndPanelRight || ""}:` +
    `${c.exposedLeftSideUseDoorMaterial ? 1 : 0}:${c.exposedRightSideUseDoorMaterial ? 1 : 0}:` +
    `${c.scribeAllowanceLeftMm || 0}:${c.scribeAllowanceRightMm || 0}:` +
    `${c.plinthHeight}:${c.plinthConstruction || ""}:${c.plinthSetbackMm ?? ""}:${c.doorPerimeterGap}:${c.centerRevealGapMm ?? ""}:` +
    `${c.edgeBandThickness}:${c.bodyMaterialId}:${c.doorMaterialId}:${c.countertopMaterialId || ""}:${c.plinthMaterialId || ""}:` +
    `${c.hasAdjustableLegs ? 1 : 0}:${c.crossSectionProfile || ""}:${c.hullShape || ""}:${c.cornerRadiusMm || 0}:${c.tambourSlatPitchMm || 0}:` +
    `${c.jointType}:${c.doorThickness || 0}:${c.overlayDistance ?? ""}:${c.system32FrontSetback ?? ""}:` +
    `${c.multiHoleMode || ""}:${c.multiHoleRowCount || 0}:${c.multiHoleFrontSetbackMm ?? ""}:${c.multiHoleEdgeMarginMm ?? ""}:${c.multiHoleDividerThroughBore ? 1 : 0}:` +
    `${c.grainContinuityMode || ""}:${c.constructionProfileId || ""}:${c.hingeDrillingTemplateId || ""}:${c.drawerDrillingSetId || ""}:` +
    `${c.hasPlinthDrawer ? 1 : 0}:${c.hasWaterfallLeft ? 1 : 0}:${c.hasWaterfallRight ? 1 : 0}:${c.countertopJointMode || ""}:` +
    `${c.hasCountertopUpstand ? 1 : 0}:${c.hasUnderSinkAluminumTray ? 1 : 0}:${c.islandBackCladding ? 1 : 0}:${c.islandOverhangRearMm || 0}:` +
    `${c.internalDrawerHingeSolution || ""}:${c.wallSuspensionType || ""}:${c.wallAnchored ? 1 : 0}:${c.floorAnchored ? 1 : 0}:${c.useDepthBasedConnectors ? 1 : 0}:` +
    `${c.ledLightingEnabled ? 1 : 0}:${c.ledColorTempK || 0}:${c.ledSensorType || ""}:${c.ledPlacementMode || ""}:${c.ledFrontSetbackMm ?? ""}:${c.ledChannelWidthMm ?? ""}:${c.ledChannelDepthMm ?? ""}|` +
    `SLP:${slopeSig}|BN:${baseNotchSig}|CR:${crownSig}|CP:${cadPolySig}|MC:${modCeilSig}|ISL:${mod.islandCountertopConfig ? JSON.stringify(mod.islandCountertopConfig) : ""}|` +
    `TBL:${mod.attachedTableConfig ? JSON.stringify(mod.attachedTableConfig) : ""}|` +
    `OVR:${overridesSig}|GRN:${grainOverridesSig}|CUT:${cutoutsSig}|CELL:${cellSig}|BAYS:${baysSig}`
  );
}

/**
 * Computes a fast, deterministic project-level structural signature by combining
 * module structural signatures with space and custom-material metadata.
 */
export function computeProjectStructuralSignature(project: DesignProject): string {
  let modsSig = "";
  for (let i = 0; i < project.modules.length; i++) {
    modsSig += computeModuleStructuralSignature(project.modules[i]) + "\n";
  }
  const space = project.space;
  const wallsSig = space?.walls
    ? space.walls
        .map((w) => {
          const wExt = w as typeof w & {
            angleDeg?: number;
            startPoint?: { x: number; z: number };
            endPoint?: { x: number; z: number };
          };
          return `${w.id}:${w.length}x${w.height}:${wExt.angleDeg ?? ""}:${wExt.startPoint?.x ?? ""},${wExt.startPoint?.z ?? ""}->${wExt.endPoint?.x ?? ""},${wExt.endPoint?.z ?? ""}`;
        })
        .join("|")
    : "";
  const elSig = space?.elements
    ? space.elements
        .map(
          (e) =>
            `${e.id}:${e.type}:${e.position.x},${e.position.y},${e.position.z}:${e.dimensions.width}x${e.dimensions.height}x${e.dimensions.depth}`
        )
        .join("|")
    : "";
  const ceilSig = (space as { ceilingConfig?: unknown })?.ceilingConfig ? JSON.stringify((space as { ceilingConfig?: unknown }).ceilingConfig) : "";
  const spaceSlopeSig = space?.slopedCeiling
    ? `${space.slopedCeiling.mode}:${space.slopedCeiling.kneeHeightMm}:${space.slopedCeiling.slopeAngleDeg}:${space.slopedCeiling.topFlatSpanMm || 0}`
    : "";
  const customMatSig = project.customMaterials?.length
    ? project.customMaterials.map((m) => `${m.id}:${m.category}:${m.thickness}:${m.costPerM2}`).join("|")
    : "";
  const sceneObjSig = project.sceneObjects?.length
    ? project.sceneObjects
        .map((so) => `${so.id}:${so.catalogId}:${so.position.x},${so.position.y},${so.position.z}:${so.cutoutTrigger?.kind || ""}`)
        .join("|")
    : "";

  return `T:${project.tenantId || "birim"}|E:${project.ergonomicProfileId || ""}|ST:${space?.type || ""}|WS:${space?.wallSubstrateType || ""}|SS:${spaceSlopeSig}|C:${space?.ceilingHeight || 0}|W:${wallsSig}|EL:${elSig}|CL:${ceilSig}|CM:${customMatSig}|SO:${sceneObjSig}|M:${modsSig}`;
}
