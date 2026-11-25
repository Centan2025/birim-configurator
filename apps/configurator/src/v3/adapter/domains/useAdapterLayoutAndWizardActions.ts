"use client";
import { solveAngledWallSnapForModule, originToModulePosition } from "../../engine/angledWallSnapEngine";
import { applyPostResizeModuleSync } from "../../engine/cabinetResizeAndStackEngine";
import { useMemo, useCallback, useRef } from "react";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { DEFAULT_MATERIALS, alignModuleShelvesToSystem32, createDefaultWardrobeModule, type MaterialDefinition, type ModuleInstance, type ArchitecturalElement, validateProject, calculateFourSpaceDimensions, evaluateUnifiedEngineeringModel, applyApprovedRemediationProposal, type RemediationProposal, type RegionErgonomicProfileId, calculateModulePlacement } from "@birim/core";
import { generateBOMForProject } from "@birim/manufacturing";
import { calculateProjectPrice } from "@birim/pricing";
import { generateModuleGeometry } from "@birim/geometry";
import { getEffectiveSpaceObstacles, getEffectiveSpaceWalls } from "../../engine/kitchenSpatialEngine";
import { getMemoizedUnifiedEngineering, getMemoizedProjectCompatibility, getMemoizedSpatialValidation, commitAdapterState, EMPTY_VALIDATION_ISSUES, EMPTY_FOUR_SPACE, LITE_COMPATIBILITY_REPORT } from "../adapterMathAndCache";
import type { useAdapterStoreAndCoreBindings } from "./useAdapterStoreAndCoreBindings";
import { useAdapterTemplateDoorAndWizardActions } from "./useAdapterTemplateDoorAndWizardActions";

export function useAdapterLayoutAndWizardActions(ctx: Pick<ReturnType<typeof useAdapterStoreAndCoreBindings>, "project" | "activeModuleIndex" | "activeBayIndex" | "isLite" | "baseValidationIssues" | "setSelectedComponentId" | "setActiveModuleIndex" | "setActiveBayIndex" | "loadLKitchenBase" | "loadUKitchenBase" | "loadLinearKitchenBase">) {
  const { project, activeModuleIndex, activeBayIndex, isLite, baseValidationIssues, setSelectedComponentId, setActiveModuleIndex, setActiveBayIndex, loadLKitchenBase, loadUKitchenBase, loadLinearKitchenBase } = ctx;
const emptyFallbackModule = useMemo(
    () => createDefaultWardrobeModule("empty_scene_placeholder"),
    []
  );
  const activeModule: ModuleInstance =
    project.modules[activeModuleIndex] || project.modules[0] || emptyFallbackModule;
  const safeBayIndex = Math.min(
    activeBayIndex,
    Math.max(0, (activeModule?.bays.length || 1) - 1)
  );
  const activeBay = activeModule?.bays[safeBayIndex] || activeModule?.bays[0];

  const bodyMaterial: MaterialDefinition =
    DEFAULT_MATERIALS.find((m) => m.id === activeModule?.carcass.bodyMaterialId) ||
    DEFAULT_MATERIALS[0];
  const doorMaterial: MaterialDefinition =
    DEFAULT_MATERIALS.find((m) => m.id === activeModule?.carcass.doorMaterialId) ||
    DEFAULT_MATERIALS[2];

  // V4 4-space dimensions & universal compatibility evaluation
  const fourSpaceDimensions = useMemo(
    () => (isLite ? EMPTY_FOUR_SPACE : calculateFourSpaceDimensions(activeModule)),
    [isLite, activeModule]
  );
  const batchStartProject = useConfiguratorStore((s) => s.batchStartProject);
  const isDraggingActive = batchStartProject !== null;

  // Structural signature for space so module drags never invalidate spaceWalls / spaceObstacles references
  const spaceSignature = useMemo(() => {
    const wKey = (project.space?.walls || [])
      .map((w) => `${w.id}:${w.length}:${w.height}:${w.thickness}:${w.position.x}:${w.position.y}:${w.position.z}:${w.rotationY}:${w.wallType || ""}`)
      .join("|");
    const eKey = (project.space?.elements || [])
      .map((e) => `${e.id}:${e.type}:${e.position.x}:${e.position.y}:${e.position.z}:${e.dimensions.width}:${e.dimensions.height}:${e.dimensions.depth}:${e.rotationY || 0}:${e.doorSwing || ""}`)
      .join("|");
    return `${project.space?.ceilingHeight || 2600}__${wKey}__${eKey}`;
  }, [project.space]);

  const v4CompatibilityReport = useMemo(
    () =>
      isLite || isDraggingActive
        ? LITE_COMPATIBILITY_REPORT
        : getMemoizedProjectCompatibility(project),
    [isLite, isDraggingActive, project]
  );

  const lastSettledEngineeringRef = useRef<ReturnType<typeof evaluateUnifiedEngineeringModel> | null>(
    null
  );
  const unifiedEngineeringReport = useMemo(() => {
    if (isLite) {
      return (
        lastSettledEngineeringRef.current || {
          findings: EMPTY_VALIDATION_ISSUES as any,
          blockingSafetyAndEngineeringErrors: EMPTY_VALIDATION_ISSUES as any,
          verificationRequiredFindings: EMPTY_VALIDATION_ISSUES as any,
          ergonomicAdvisories: EMPTY_VALIDATION_ISSUES as any,
          canExportToCncAndSaw: true,
          canApproveFinalErpRelease: true,
        }
      ) as ReturnType<typeof evaluateUnifiedEngineeringModel>;
    }
    if (isDraggingActive && lastSettledEngineeringRef.current) {
      return lastSettledEngineeringRef.current;
    }
    const fresh = getMemoizedUnifiedEngineering(project);
    lastSettledEngineeringRef.current = fresh;
    return fresh;
  }, [isLite, isDraggingActive, project]);

  const ergonomicProfileId: RegionErgonomicProfileId =
    project.ergonomicProfileId || "TR_RESIDENTIAL";

  const setErgonomicProfileId = useCallback(
    (profileId: RegionErgonomicProfileId) => {
      commitAdapterState({
        project: {
          ...project,
          ergonomicProfileId: profileId,
        },
      });
    },
    [project]
  );

  const resizeModuleParametricRef = useRef<
    ((modIdx: number, w: number, x?: number) => unknown) | null
  >(null);

  const applyApprovedEngineeringFix = useCallback(
    (proposal: RemediationProposal) => {
      const curProj = useConfiguratorStore.getState().project;
      if (proposal.patchKind === "resize_before_obstacle") {
        const modIdx = curProj.modules.findIndex((m) => m.id === proposal.targetModuleId);
        const reqW = Number(proposal.patchPayload?.width);
        const reqX =
          typeof proposal.patchPayload?.positionX === "number"
            ? Number(proposal.patchPayload.positionX)
            : undefined;
        if (modIdx >= 0 && Number.isFinite(reqW)) {
          resizeModuleParametricRef.current?.(modIdx, reqW, reqX);
          return;
        }
      }
      const nextProj = applyApprovedRemediationProposal(curProj, proposal);
      commitAdapterState({ project: nextProj });
    },
    []
  );

  // Spatial obstacles & walls memoized by spaceSignature so cabinet drags never rebuild 3D room architecture
  const spaceObstacles = useMemo(
    () => getEffectiveSpaceObstacles(project),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spaceSignature]
  );
  const spaceWalls = useMemo(
    () => getEffectiveSpaceWalls(project),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spaceSignature]
  );
  const spatialIssues = useMemo(
    () => (isLite || isDraggingActive ? EMPTY_VALIDATION_ISSUES : getMemoizedSpatialValidation(project)),
    [isLite, isDraggingActive, project]
  );

  const validationIssues = useMemo(() => {
    if (isLite) return EMPTY_VALIDATION_ISSUES;
    const seen = new Set<string>();
    const combined = [
      ...baseValidationIssues,
      ...spatialIssues,
      ...v4CompatibilityReport.issues,
      ...unifiedEngineeringReport.findings,
    ];
    return combined.filter((item) => {
      const k = `${item.code}_${item.targetId || ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [
    isLite,
    baseValidationIssues,
    spatialIssues,
    v4CompatibilityReport.issues,
    unifiedEngineeringReport.findings,
  ]);

  /**
   * Fast component selection handler
   */
  const handleComponentSelect = useCallback(
    (compId: string | null, explicitModuleIndex?: number) => {
      setSelectedComponentId(compId);
      if (!compId) return;

      const curProj = useConfiguratorStore.getState().project;
      const curModIdx = useConfiguratorStore.getState().activeModuleIndex;

      if (
        typeof explicitModuleIndex === "number" &&
        explicitModuleIndex >= 0 &&
        explicitModuleIndex < curProj.modules.length
      ) {
        if (explicitModuleIndex !== curModIdx) {
          setActiveModuleIndex(explicitModuleIndex);
        }
        const targetMod = curProj.modules[explicitModuleIndex];
        if (targetMod) {
          const breakdown = generateModuleGeometry(targetMod);
          const foundComp = breakdown.components.find((c) => c.id === compId);
          if (foundComp && typeof foundComp.bayIndex === "number") {
            setActiveBayIndex(foundComp.bayIndex);
          }
        }
        return;
      }

      // Match by longest module.id prefix first so "mod_10" never falsely matches "mod_1"
      const indexedMods = curProj.modules
        .map((mod, mIdx) => ({ mod, mIdx }))
        .sort((a, b) => b.mod.id.length - a.mod.id.length);

      for (const { mod, mIdx } of indexedMods) {
        if (compId === mod.id || compId.startsWith(`${mod.id}_`)) {
          if (mIdx !== curModIdx) {
            setActiveModuleIndex(mIdx);
          }
          const breakdown = generateModuleGeometry(mod);
          const foundComp = breakdown.components.find((c) => c.id === compId);
          if (foundComp && typeof foundComp.bayIndex === "number") {
            setActiveBayIndex(foundComp.bayIndex);
          }
          return;
        }
      }

      for (let mIdx = 0; mIdx < curProj.modules.length; mIdx++) {
        const mod = curProj.modules[mIdx];
        const breakdown = generateModuleGeometry(mod);
        const foundComp = breakdown.components.find((c) => c.id === compId);
        if (foundComp) {
          if (mIdx !== curModIdx) {
            setActiveModuleIndex(mIdx);
          }
          if (typeof foundComp.bayIndex === "number") {
            setActiveBayIndex(foundComp.bayIndex);
          }
          break;
        }
      }
    },
    [setSelectedComponentId, setActiveModuleIndex, setActiveBayIndex]
  );

  /**
   * Rotate active module by 90 degrees (for L / U corner return cabinets)
   */
  const snapModuleToAngledWall = useCallback((targetModIdx?: number, forceWallId?: string) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const idx = typeof targetModIdx === "number" ? targetModIdx : state.activeModuleIndex;
    const mod = curProj.modules[idx];
    if (!mod) return null;
    const walls = getEffectiveSpaceWalls(curProj);
    const angledWalls = walls.filter((w) => ((w.rotationY || 0) % 90 + 90) % 90 !== 0);
    const candidateWalls = !forceWallId && angledWalls.length > 0 ? angledWalls : walls;
    const sol = solveAngledWallSnapForModule({
      mod,
      modIdx: idx,
      candidatePosX: mod.position.x,
      candidatePosZ: mod.position.z,
      walls: candidateWalls,
      allModules: curProj.modules,
      maxPerpSnapDistMm: 99999,
      forceWallId,
    });
    if (!sol) return null;
    const nextMods = curProj.modules.map((m, i) =>
      i === idx
        ? {
            ...m,
            position: { ...m.position, x: sol.snappedPositionX, z: sol.snappedPositionZ },
            rotation: { x: 0, y: sol.moduleRotationYDeg, z: 0 },
          }
        : m
    );
    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      activeModuleIndex: idx,
      project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
    });
    return sol;
  }, []);

  const addKitchenIslandUnit = useCallback(
    (spec: {
      widthMm: number;
      depthMm: number;
      heightMm: number;
      aisleClearanceMm: number;
      barOverhangMm: number;
      waterfallLeft: boolean;
      waterfallRight: boolean;
      countertopMaterialId: string;
    }) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const baseMods = curProj.modules.filter((m) => m.category !== "complementary" && m.category !== "kitchen_island");
      const frontRowDepth = baseMods.length > 0 ? Math.max(...baseMods.map((m) => m.position.z + m.dimensions.depth)) : 600;
      const centerRowX =
        baseMods.length > 0
          ? Math.round(
              (Math.min(...baseMods.map((m) => m.position.x)) +
                Math.max(...baseMods.map((m) => m.position.x + m.dimensions.width)) -
                spec.widthMm) *
                0.5
            )
          : 600;
      const bayCnt = Math.max(2, Math.min(5, Math.round(spec.widthMm / 600)));
      const approxBayW = (spec.widthMm - (bayCnt + 1) * 18) / bayCnt;
      const useDoubleDoor = approxBayW > 600;
      const refMod = baseMods[0] || createDefaultWardrobeModule("isl_seed");
      const islId = `mod_island_${Date.now().toString().slice(-5)}`;
      const islandMod: ModuleInstance = {
        ...structuredClone(refMod),
        id: islId,
        name: `Şelale Tezgâhlı Ada Mutfak (${Math.round(spec.widthMm / 10)}×${Math.round(spec.depthMm / 10)} cm)`,
        category: "kitchen_island",
        moduleFamilyId: "fam_kitchen_base",
        position: {
          x: Math.max(100, centerRowX),
          y: 0,
          z: frontRowDepth + Math.max(850, spec.aisleClearanceMm),
        },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: {
          width: spec.widthMm,
          height: spec.heightMm,
          depth: spec.depthMm,
        },
        carcass: {
          ...structuredClone(refMod.carcass),
          floorAnchored: true,
          plinthHeight: 100,
          topConstruction: "stretcher_90mm",
          carcassJoineryTopology: "kitchen_stretchers",
          hasWaterfallLeft: spec.waterfallLeft,
          hasWaterfallRight: spec.waterfallRight,
          islandBackCladding: true,
          islandOverhangRearMm: spec.barOverhangMm,
          countertopMaterialId: spec.countertopMaterialId,
        },
        islandCountertopConfig: {
          barOverhangMm: spec.barOverhangMm,
          waterfallLeft: spec.waterfallLeft,
          waterfallRight: spec.waterfallRight,
          countertopMaterialId: spec.countertopMaterialId,
        },
        bays: Array.from({ length: bayCnt }, (_, bIdx) => ({
          index: bIdx,
          shelves: bIdx === 0 ? [] : [{ id: `${islId}_sh_${bIdx}`, bayIndex: bIdx, elevationY: 340, isAdjustable: true }],
          drawers:
            bIdx === 0
              ? [
                  { id: `${islId}_drw_${bIdx}_0`, bayIndex: bIdx, elevationY: 0, height: 280, slideType: "soft_close" as const },
                  { id: `${islId}_drw_${bIdx}_1`, bayIndex: bIdx, elevationY: 284, height: 280, slideType: "soft_close" as const },
                ]
              : [],
          hangingRails: [],
          specialFittings: [],
          door: {
            id: `${islId}_door_${bIdx}`,
            bayIndex: bIdx,
            type: bIdx === 0 ? "open" : useDoubleDoor ? "double" : "single_left",
            doorSystemId: bIdx === 0 ? "open" : useDoubleDoor ? "hinged_double" : "hinged_single",
            softClose: true,
            handleCategory: "gola_profile",
          },
        })),
      };
      const nextMods = [...curProj.modules, islandMod];
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        activeModuleIndex: nextMods.length - 1,
        project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
      });
    },
    []
  );

  const addOrUpdateAttachedTable = useCallback(
    (spec: {
      anchorModuleIndex: number;
      attachSide: "right_end" | "left_end" | "front_center_t" | "front_right_corner";
      angleDeg: number;
      lengthMm: number;
      widthMm: number;
      tableHeightMm: number;
      legStyle: "waterfall_slab" | "metal_u_frame" | "pedestal_column";
      topMaterialId: string;
    }) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const anchor = curProj.modules[spec.anchorModuleIndex] || curProj.modules[state.activeModuleIndex] || curProj.modules[0];
      if (!anchor) return;

      const anchorPlace = calculateModulePlacement(anchor);
      const aRotRad = anchorPlace.rotationYRad;
      const cosA = Math.cos(aRotRad);
      const sinA = Math.sin(aRotRad);
      const toWorld = (lx: number, lz: number) => ({
        x: anchorPlace.origin.x + lx * cosA + lz * sinA,
        z: anchorPlace.origin.z - lx * sinA + lz * cosA,
      });

      let pivotLocal = { x: anchor.dimensions.width - 40, z: anchor.dimensions.depth * 0.5 };
      // Compute outward plan heading (0° = +X right, +90° = +Z forward into room, 180° = -X left)
      let localPlanHeadingDeg = spec.angleDeg;
      if (spec.attachSide === "left_end") {
        pivotLocal = { x: 40, z: anchor.dimensions.depth * 0.5 };
        localPlanHeadingDeg = 180 - spec.angleDeg;
      } else if (spec.attachSide === "front_center_t") {
        pivotLocal = { x: anchor.dimensions.width * 0.5, z: anchor.dimensions.depth - 40 };
        localPlanHeadingDeg =
          spec.angleDeg === 90 || spec.angleDeg === 0 ? 90 : 90 - spec.angleDeg;
      } else if (spec.attachSide === "front_right_corner") {
        pivotLocal = { x: anchor.dimensions.width - 60, z: anchor.dimensions.depth - 60 };
        localPlanHeadingDeg = spec.angleDeg;
      }

      const pivotWorld = toWorld(pivotLocal.x, pivotLocal.z);
      // In Three.js Y-up (`x_w = cos(rotY), z_w = -sin(rotY)`), `rotY = -planHeadingDeg`
      const totalModRotDeg = ((((anchor.rotation?.y || 0) - localPlanHeadingDeg) % 360) + 360) % 360;
      const betaRad = (totalModRotDeg * Math.PI) / 180;
      const originX = pivotWorld.x - (spec.widthMm * 0.5) * Math.sin(betaRad);
      const originZ = pivotWorld.z - (spec.widthMm * 0.5) * Math.cos(betaRad);
      const tblPos = originToModulePosition(
        spec.lengthMm,
        spec.widthMm,
        totalModRotDeg,
        originX,
        originZ
      );

      const existingTableId = `comp_table_${anchor.id}`;
      const refCarcass = structuredClone(anchor.carcass);
      const tableMod: ModuleInstance = {
        id: existingTableId,
        name: `Açılı Masa (${spec.angleDeg}° • ${Math.round(spec.lengthMm / 10)}×${Math.round(spec.widthMm / 10)} cm)`,
        category: "complementary",
        complementaryRole: "attached_table",
        position: { x: tblPos.x, y: 0, z: tblPos.z },
        rotation: { x: 0, y: totalModRotDeg, z: 0 },
        dimensions: {
          width: spec.lengthMm,
          height: spec.tableHeightMm,
          depth: spec.widthMm,
        },
        bays: [],
        carcass: {
          ...refCarcass,
          countertopMaterialId: spec.topMaterialId,
          doorMaterialId: spec.topMaterialId,
          bodyMaterialId: spec.topMaterialId,
        },
        attachedTableConfig: {
          anchorModuleId: anchor.id,
          angleDeg: spec.angleDeg,
          legStyle: spec.legStyle,
          topThicknessMm: 40,
        },
      };

      const filtered = curProj.modules.filter((m) => m.id !== existingTableId);
      const nextMods = [...filtered, tableMod];
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        activeModuleIndex: nextMods.length - 1,
        project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
      });
    },
    []
  );

  const rotateActiveModule90 = useCallback((deltaDeg = 90) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const idx = state.activeModuleIndex;
    const mod = curProj.modules[idx];
    if (!mod) return;

    const delta = typeof deltaDeg === "number" ? deltaDeg : 90;
    const curRotY = mod.rotation?.y || 0;
    const nextRotY = (((curRotY + delta) % 360) + 360) % 360;
    // Preserve world center when rotating freestanding / table / island modules so they rotate in place cleanly!
    const curPlace = calculateModulePlacement(mod);
    const curRad = curPlace.rotationYRad;
    const worldCenterX =
      curPlace.origin.x +
      (mod.dimensions.width * 0.5) * Math.cos(curRad) +
      (mod.dimensions.depth * 0.5) * Math.sin(curRad);
    const worldCenterZ =
      curPlace.origin.z -
      (mod.dimensions.width * 0.5) * Math.sin(curRad) +
      (mod.dimensions.depth * 0.5) * Math.cos(curRad);
    const nextRad = (nextRotY * Math.PI) / 180;
    const nextOriginX =
      worldCenterX -
      (mod.dimensions.width * 0.5) * Math.cos(nextRad) -
      (mod.dimensions.depth * 0.5) * Math.sin(nextRad);
    const nextOriginZ =
      worldCenterZ +
      (mod.dimensions.width * 0.5) * Math.sin(nextRad) -
      (mod.dimensions.depth * 0.5) * Math.cos(nextRad);
    const centeredPos = originToModulePosition(
      mod.dimensions.width,
      mod.dimensions.depth,
      nextRotY,
      nextOriginX,
      nextOriginZ
    );
    const isFreeOrTable =
      mod.complementaryRole === "attached_table" ||
      mod.category === "kitchen_island" ||
      Boolean(mod.carcass.hullShape && mod.carcass.hullShape !== "rectangular");

    const nextMods = curProj.modules.map((m, i) =>
      i === idx
        ? {
            ...m,
            position: isFreeOrTable
              ? { ...m.position, x: centeredPos.x, z: centeredPos.z }
              : m.position,
            rotation: { x: 0, y: nextRotY, z: 0 },
            attachedTableConfig: m.attachedTableConfig
              ? {
                  ...m.attachedTableConfig,
                  angleDeg: ((((360 - nextRotY) % 360) + 360) % 360),
                }
              : m.attachedTableConfig,
          }
        : m
    );
    commitAdapterState({
      history: [...state.history.slice(-50), curProj],
      future: [],
      project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
    });
  }, []);

  /**
   * Move a specific module to an exact X, Z position in the room (with optional snap)
   */
  const setModulePosition = useCallback(
    (modIdx: number, x: number, z: number, snapMm = 50, y?: number) => {
      const snappedX = snapMm > 0 ? Math.round(x / snapMm) * snapMm : Math.round(x);
      const snappedZ = snapMm > 0 ? Math.round(z / snapMm) * snapMm : Math.round(z);
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const target = curProj.modules[modIdx];
      if (!target) return;

      const attachedPrefix = `comp_att_${target.id}__`;
      const leftAttWidth = curProj.modules
        .filter(
          (m) =>
            m.id === `${attachedPrefix}panel_left` || m.id === `${attachedPrefix}filler_left`
        )
        .reduce((maxW, m) => Math.max(maxW, m.dimensions.width), 0);
      const clampedX = Math.max(leftAttWidth, snappedX);
      const clampedZ = Math.max(0, snappedZ);
      const clampedY =
        typeof y === "number"
          ? Math.max(0, snapMm > 0 ? Math.round(y / snapMm) * snapMm : Math.round(y))
          : target.position.y;
      const dx = clampedX - target.position.x;
      const dz = clampedZ - target.position.z;
      const dy = clampedY - target.position.y;
      if (dx === 0 && dz === 0 && dy === 0) return;
      const nextMods = curProj.modules.map((m, idx) => {
        if (idx === modIdx) {
          return { ...m, position: { ...m.position, x: clampedX, y: clampedY, z: clampedZ } };
        }
        if (m.category === "complementary" && m.id.startsWith(attachedPrefix)) {
          return {
            ...m,
            position: {
              ...m.position,
              x: Math.max(0, m.position.x + dx),
              y: Math.max(0, m.position.y + dy),
              z: Math.max(0, m.position.z + dz),
            },
          };
        }
        return m;
      });
      commitAdapterState({
        activeModuleIndex: modIdx,
        selectedModuleIds: nextMods[modIdx] ? [nextMods[modIdx].id] : [],
        project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
      });
    },
    []
  );

  /**
   * Swaps a module with its immediate left or right neighbor in the same row,
   * recalculating their X coordinates so they exchange places cleanly with zero overlap.
   */
  
  /**
   * Parametrically resizes a module from its edge handles in 2D Plan or 2D Elevation,
   * stretching internal shelves/rails/drawers AND automatically adapting bay count (Ara Dikme)
   * and door count (1 -> 2 -> 3 -> 4 -> 5 -> 6 Kapak) according to EN 1116 / Blum structural limits!
   */
  const resizeModuleParametric = useCallback(
    (
      modIdx: number,
      newWidthMm: number,
      newPositionX?: number,
      newDepthMm?: number,
      newHeightMm?: number,
      newPositionZ?: number,
      newPositionY?: number,
      preserveExactMm?: boolean
    ): { bayCount: number; totalLeafCount: number; shelfCount: number } | null => {
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const target = curProj.modules[modIdx];
      if (!target) return null;

      const oldH = target.dimensions.height;
      const oldD = target.dimensions.depth;
      const hull = target.carcass.hullShape || "rectangular";
      const isTableOrIsland =
        hull === "capsule_table" ||
        target.category === "kitchen_island" ||
        target.complementaryRole === "attached_table";
      const isCapsuleOrTambour =
        hull === "capsule_stadium" ||
        hull === "rounded_corners" ||
        target.bays.some((b) => b.door?.type === "tambour" || b.door?.doorSystemId === "tambour_roller");
      const snapFn = (v: number) => (preserveExactMm ? Math.round(v) : Math.round(v / 10) * 10);
      const minW = hull === "capsule_table" ? 900 : isCapsuleOrTambour ? 600 : 250;
      const maxW = 3600;
      const minD = hull === "capsule_table" ? 650 : isCapsuleOrTambour ? 320 : 200;
      const maxD = isTableOrIsland ? 1450 : 1000;
      const minH = 260;
      const maxH = 2900;

      const clampedW = Math.max(minW, Math.min(maxW, snapFn(newWidthMm)));
      const clampedD =
        typeof newDepthMm === "number"
          ? Math.max(minD, Math.min(maxD, snapFn(newDepthMm)))
          : target.dimensions.depth;
      const clampedH =
        typeof newHeightMm === "number"
          ? Math.max(minH, Math.min(maxH, snapFn(newHeightMm)))
          : target.dimensions.height;
      const leftAttW = curProj.modules
        .filter(
          (m) =>
            m.id === `comp_att_${target.id}__panel_left` ||
            m.id === `comp_att_${target.id}__filler_left`
        )
        .reduce((maxW, m) => Math.max(maxW, m.dimensions.width), 0);
      const clampedX =
        typeof newPositionX === "number"
          ? Math.max(leftAttW, Math.round(newPositionX / 10) * 10)
          : Math.max(leftAttW, target.position.x);
      const clampedZ =
        typeof newPositionZ === "number"
          ? Math.max(0, Math.round(newPositionZ / 10) * 10)
          : target.position.z;
      const clampedY =
        typeof newPositionY === "number"
          ? Math.max(0, Math.round(newPositionY / 10) * 10)
          : target.position.y;

      if (
        target.dimensions.width === clampedW &&
        target.dimensions.depth === clampedD &&
        target.dimensions.height === clampedH &&
        target.position.x === clampedX &&
        target.position.z === clampedZ &&
        target.position.y === clampedY
      ) {
        return null;
      }

      const nextMod: ModuleInstance = JSON.parse(JSON.stringify(target));
      nextMod.dimensions.width = clampedW;
      nextMod.dimensions.depth = clampedD;
      nextMod.dimensions.height = clampedH;
      nextMod.position.x = clampedX;
      nextMod.position.z = clampedZ;
      nextMod.position.y = clampedY;

      // Parametric Height Adaptation: scale/redistribute shelves, rails, and sub-dividers when height (H) changes
      if (clampedH !== oldH && nextMod.category !== "complementary") {
        const T_p = nextMod.carcass.panelThickness || 18;
        const plinth = nextMod.carcass.plinthHeight || 0;
        const oldNetH = Math.max(160, oldH - plinth - 2 * T_p);
        const newNetH = Math.max(160, clampedH - plinth - 2 * T_p);
        const hRatio = newNetH / oldNetH;

        nextMod.bays.forEach((b, bIdx) => {
          // Full-stack external drawers (e.g. kitchen island / base drawer units): scale drawer heights proportionally to fill newNetH
          const extDrawers = (b.drawers || []).filter((d) => !d.isInternal && !d.isHidden);
          const isFullDrawerStack =
            extDrawers.length > 0 &&
            (b.door?.type === "open" || Boolean(nextMod.isOpenFront)) &&
            (!b.shelves || b.shelves.length === 0) &&
            (!b.hangingRails || b.hangingRails.length === 0);
          if (isFullDrawerStack) {
            const sorted = [...extDrawers].sort((a, c) => a.elevationY - c.elevationY);
            const oldStackTop = Math.max(...sorted.map((d) => d.elevationY + d.height));
            if (oldStackTop >= oldNetH * 0.65) {
              const gapMm = 4;
              const usableForDrawers = Math.max(sorted.length * 100, newNetH - gapMm * (sorted.length - 1) - 8);
              const oldTotalH = Math.max(1, sorted.reduce((acc, d) => acc + d.height, 0));
              let curElev = 0;
              sorted.forEach((d, dIdx) => {
                const nextH =
                  dIdx === sorted.length - 1
                    ? Math.max(100, Math.round(usableForDrawers - curElev + gapMm * dIdx))
                    : Math.max(100, Math.round((usableForDrawers * (d.height / oldTotalH)) / 2) * 2);
                d.elevationY = curElev;
                d.height = nextH;
                curElev += nextH + gapMm;
              });
            }
          }
          const maxDrawerTop =
            b.drawers.length > 0
              ? Math.max(...b.drawers.map((d) => d.elevationY + d.height)) + T_p
              : 0;
          const usableShelfZoneH = Math.max(120, newNetH - maxDrawerTop);

          // If bay has hanging rails, keep top rail near top of cabinet and scale lower rails
          if (b.hangingRails && b.hangingRails.length > 0) {
            b.hangingRails.forEach((r, rIdx) => {
              if (rIdx === b.hangingRails.length - 1) {
                r.elevationY = Math.max(300, Math.min(newNetH - 60, newNetH - 90));
              } else {
                r.elevationY = Math.max(
                  250,
                  Math.min(newNetH - 120, Math.round((r.elevationY * hRatio) / 10) * 10)
                );
              }
            });
          }

          // Parametric Shelf Count & Equal Distribution when no hanging rail occupies the bay
          if ((!b.hangingRails || b.hangingRails.length === 0) && b.shelves.length > 0) {
            const targetShelfCount = Math.max(
              1,
              Math.min(7, Math.floor(usableShelfZoneH / 360))
            );
            while (b.shelves.length < targetShelfCount) {
              const sIdx = b.shelves.length;
              b.shelves.push({
                id: `${nextMod.id}_shelf_${bIdx}_${sIdx}_${Date.now()}`,
                bayIndex: bIdx,
                elevationY: Math.round(maxDrawerTop + usableShelfZoneH * 0.5),
                thickness: T_p,
                isAdjustable: true,
              });
            }
            if (b.shelves.length > targetShelfCount && targetShelfCount >= 1) {
              b.shelves = b.shelves.slice(0, targetShelfCount);
            }
            const cnt = b.shelves.length;
            const stepY = usableShelfZoneH / (cnt + 1);
            b.shelves.forEach((s, sIdx) => {
              s.elevationY = Math.max(
                60,
                Math.min(
                  newNetH - 60,
                  Math.round((maxDrawerTop + stepY * (sIdx + 1)) / 10) * 10
                )
              );
            });
          } else if (b.shelves.length > 0) {
            const bayDrawers = b.drawers || [];
            b.shelves.forEach((s) => {
              const shT = s.thickness ?? nextMod.carcass.panelThickness ?? 18;
              let nextY: number;
              if (maxDrawerTop > 0 && Math.abs(s.elevationY - maxDrawerTop) <= 32) {
                nextY = Math.min(newNetH - 60, Math.round(maxDrawerTop));
              } else {
                nextY = Math.max(
                  60,
                  Math.min(newNetH - 60, Math.round((s.elevationY * hRatio) / 10) * 10)
                );
              }
              for (const dr of bayDrawers) {
                const drBot = dr.elevationY || 0;
                const drTop = drBot + Math.max(80, dr.height || 180);
                if (nextY + shT > drBot + 10 && nextY < drTop - 2) {
                  nextY = Math.min(newNetH - 60, Math.round(drTop));
                }
              }
              s.elevationY = nextY;
            });
          }

          // Scale subDividers proportionally to newNetH
          if (b.subDividers && b.subDividers.length > 0) {
            b.subDividers.forEach((sd) => {
              sd.elevationY = Math.max(
                0,
                Math.min(newNetH - 80, Math.round((sd.elevationY * hRatio) / 10) * 10)
              );
              sd.height = Math.max(
                80,
                Math.min(newNetH - sd.elevationY, Math.round((sd.height * hRatio) / 10) * 10)
              );
            });
          }
        });
        alignModuleShelvesToSystem32(nextMod);
      }

      // Synchronize cornerRadiusMm cleanly when depth or width changes on capsule / rounded / table modules
      if (nextMod.carcass.hullShape === "capsule_stadium") {
        nextMod.carcass.cornerRadiusMm = Math.min(Math.floor(clampedW / 2) - 40, Math.round(clampedD / 2));
      } else if (nextMod.carcass.hullShape === "rounded_corners") {
        const curR = nextMod.carcass.cornerRadiusMm || 110;
        nextMod.carcass.cornerRadiusMm = Math.max(
          65,
          Math.min(Math.max(65, Math.floor(clampedD / 2) - 20), Math.floor(clampedW / 2) - 40, curR)
        );
      } else if (nextMod.carcass.hullShape === "capsule_table") {
        const wasFullStadium = Math.abs((nextMod.carcass.cornerRadiusMm || oldD / 2) - oldD / 2) <= 15;
        nextMod.carcass.cornerRadiusMm = wasFullStadium
          ? Math.round(clampedD / 2)
          : Math.max(80, Math.min(Math.round(clampedD / 2), nextMod.carcass.cornerRadiusMm || Math.round(clampedD / 2)));
      }

      const isSpecializedCapsuleOrTv =
        nextMod.carcass.hullShape === "capsule_stadium" ||
        nextMod.carcass.hullShape === "rounded_corners" ||
        nextMod.carcass.hullShape === "capsule_table" ||
        Boolean(nextMod.templateId?.includes("tv_")) ||
        nextMod.bays.some((b) => b.door?.type === "tambour" || b.door?.doorSystemId === "tambour_roller");

      if (nextMod.carcass.hullShape === "capsule_table") {
        nextMod.bays = nextMod.bays.slice(0, 1);
        if (nextMod.bays[0]) {
          nextMod.bays[0].index = 0;
          nextMod.bays[0].customWidth = undefined;
          nextMod.bays[0].door.type = "open";
          nextMod.bays[0].door.doorSystemId = "open";
        }
      } else if (
        nextMod.carcass.hullShape === "capsule_stadium" ||
        nextMod.carcass.hullShape === "rounded_corners"
      ) {
        // Preserve Tambour & Open Media Bay topology! Scale bay count smoothly only for uniform tambour cabinets
        const hasOpenCenterMediaBay =
          nextMod.bays.length >= 3 &&
          nextMod.bays[0]?.door?.type !== "open" &&
          nextMod.bays[1]?.door?.type === "open" &&
          nextMod.bays[nextMod.bays.length - 1]?.door?.type !== "open";
        if (!hasOpenCenterMediaBay && !nextMod.isOpenFront) {
          const rEff = nextMod.carcass.cornerRadiusMm || Math.round(clampedD / 2);
          const straightW = Math.max(160, clampedW - 2 * rEff);
          const desiredBays = straightW > 1850 ? 3 : straightW > 980 ? 2 : 1;
          while (nextMod.bays.length < desiredBays) {
            const newIdx = nextMod.bays.length;
            const cloned = JSON.parse(JSON.stringify(nextMod.bays[0]));
            cloned.index = newIdx;
            cloned.customWidth = undefined;
            cloned.door.id = `${nextMod.id}_door_${newIdx}`;
            cloned.door.bayIndex = newIdx;
            cloned.door.type = "tambour";
            cloned.door.doorSystemId = "tambour_roller";
            cloned.shelves = (cloned.shelves || []).map((s: any, si: number) => ({
              ...s,
              id: `${nextMod.id}_cap_sh_${newIdx}_${si}`,
              bayIndex: newIdx,
            }));
            cloned.drawers = [];
            nextMod.bays.push(cloned);
          }
          if (nextMod.bays.length > desiredBays) {
            nextMod.bays = nextMod.bays.slice(0, desiredBays);
          }
        }
        nextMod.bays.forEach((b, idx) => {
          b.index = idx;
          if (!hasOpenCenterMediaBay) b.customWidth = undefined;
        });
      } else if (nextMod.category !== "complementary" && !isSpecializedCapsuleOrTv) {
        const T = nextMod.carcass.panelThickness || 18;
        const firstBay = nextMod.bays[0];
        const isPureDrawerStack =
          nextMod.bays.every((b) => (b.door.type === "open" || b.door.doorSystemId === "open") && b.drawers.length > 0);
        const isOpenWalkIn =
          Boolean(nextMod.isOpenFront) ||
          nextMod.bays.every((b) => b.door.type === "open" && b.drawers.length === 0);
        const isSliding = nextMod.bays.some(
          (b) =>
            b.door.type === "sliding" ||
            b.door.doorSystemId === "sliding_top_hung" ||
            b.door.doorSystemId === "sliding_bottom_rolling"
        );
        const isLift = nextMod.bays.some((b) => b.door.doorSystemId?.startsWith("lift_"));

        let targetBayCount = nextMod.bays.length;
        let bayDoorPlan: ("single_left" | "single_right" | "double" | "sliding" | "open")[] = [];

        if (isSliding) {
          targetBayCount = clampedW > 2000 ? 3 : 2;
          bayDoorPlan = Array.from({ length: targetBayCount }, () => "sliding");
        } else if (isPureDrawerStack || isOpenWalkIn || isLift) {
          targetBayCount = clampedW > 2700 ? 4 : clampedW > 1800 ? 3 : clampedW > 1000 ? 2 : 1;
          bayDoorPlan = Array.from({ length: targetBayCount }, () =>
            isPureDrawerStack || isOpenWalkIn ? "open" : (firstBay?.door.type as any) || "single_left"
          );
        } else {
          // Hinged Wardrobe / Kitchen Cabinet Structural Door & Divider Progression:
          // <= 600mm: 1 Bay, 1 Single Door
          // 610..1150mm: 1 Bay, 1 Double Door (2 leaves)
          // 1160..1650mm: 2 Bays (1 Ara Dikme), 3 Doors (Left: Single 1/3, Right: Double 2/3)
          // 1660..2250mm: 2 Bays (1 Ara Dikme), 4 Doors (Left: Double, Right: Double)
          // 2260..2750mm: 3 Bays (2 Ara Dikme), 5 Doors (Double + Single + Double)
          // > 2750mm: 3 Bays (2 Ara Dikme), 6 Doors (Double + Double + Double)
          if (clampedW <= 600) {
            targetBayCount = 1;
            const curDType = firstBay?.door?.type;
            bayDoorPlan = [
              curDType === "double" && clampedW >= 500
                ? "double"
                : curDType === "single_right"
                ? "single_right"
                : "single_left",
            ];
          } else if (clampedW <= 1150) {
            targetBayCount = 1;
            bayDoorPlan = ["double"];
          } else if (clampedW <= 1650) {
            targetBayCount = 2;
            bayDoorPlan = ["single_left", "double"];
          } else if (clampedW <= 2250) {
            targetBayCount = 2;
            bayDoorPlan = ["double", "double"];
          } else if (clampedW <= 2750) {
            targetBayCount = 3;
            bayDoorPlan = ["double", "single_left", "double"];
          } else {
            targetBayCount = 3;
            bayDoorPlan = ["double", "double", "double"];
          }
        }

        // Add or remove bays to match targetBayCount while preserving/cloning shelves & rails
        while (nextMod.bays.length < targetBayCount) {
          const newIdx = nextMod.bays.length;
          const srcBay = nextMod.bays[nextMod.bays.length - 1] || nextMod.bays[0];
          const clonedBay = JSON.parse(JSON.stringify(srcBay));
          clonedBay.index = newIdx;
          clonedBay.customWidth = undefined;
          clonedBay.door.id = `${nextMod.id}_door_${newIdx}`;
          clonedBay.door.bayIndex = newIdx;
          clonedBay.shelves = (clonedBay.shelves || []).map((s: any, si: number) => ({
            ...s,
            id: `${nextMod.id}_shelf_${newIdx}_${si}`,
            bayIndex: newIdx,
          }));
          clonedBay.hangingRails = (clonedBay.hangingRails || []).map((r: any, ri: number) => ({
            ...r,
            id: `${nextMod.id}_rail_${newIdx}_${ri}`,
            bayIndex: newIdx,
          }));
          clonedBay.drawers = (clonedBay.drawers || []).map((d: any, di: number) => ({
            ...d,
            id: `${nextMod.id}_drw_${newIdx}_${di}`,
            bayIndex: newIdx,
          }));
          clonedBay.specialFittings = [];
          nextMod.bays.push(clonedBay);
        }
        if (nextMod.bays.length > targetBayCount) {
          nextMod.bays = nextMod.bays.slice(0, targetBayCount);
        }

        // Apply door types & proportional bay widths (e.g. 1/3 + 2/3 for 3-door wardrobe!)
        const availInnerW = Math.max(100, clampedW - (targetBayCount + 1) * T);
        nextMod.bays.forEach((b, bIdx) => {
          b.index = bIdx;
          const plannedDoor = bayDoorPlan[bIdx];
          if (plannedDoor && !isLift && !isPureDrawerStack && !isOpenWalkIn) {
            b.door.type = plannedDoor;
            b.door.doorSystemId =
              plannedDoor === "double"
                ? "hinged_double"
                : plannedDoor === "sliding"
                ? "sliding_top_hung"
                : plannedDoor === "open"
                ? "open"
                : "hinged_single";
          }
          // Set proportional customWidth when mixing single (1 leaf) and double (2 leaves) bays
          if (!isSliding && !isPureDrawerStack && !isOpenWalkIn && !isLift) {
            const totalLeaves = bayDoorPlan.reduce(
              (sum, dt) => sum + (dt === "double" ? 2 : 1),
              0
            );
            const myLeaves = plannedDoor === "double" ? 2 : 1;
            if (bIdx < targetBayCount - 1 && totalLeaves > targetBayCount) {
              b.customWidth = Math.round((availInnerW * myLeaves) / totalLeaves);
            } else {
              b.customWidth = undefined;
            }
          } else {
            b.customWidth = undefined;
          }
        });
        alignModuleShelvesToSystem32(nextMod);
      }

      const attachedPrefix = `comp_att_${target.id}__`;
      const nextMods = curProj.modules.map((m, i) => {
        if (i === modIdx) return nextMod;
        if (m.category === "complementary" && m.id.startsWith(attachedPrefix)) {
          const suffix = m.id.slice(attachedPrefix.length);
          const upd = { ...m, position: { ...m.position }, dimensions: { ...m.dimensions } };
          if (suffix.startsWith("panel_left")) {
            upd.position.x = Math.max(0, clampedX - upd.dimensions.width);
            upd.position.y = clampedY;
            upd.position.z = clampedZ;
            upd.dimensions.height = clampedH;
            upd.dimensions.depth = clampedD + 20;
          } else if (suffix.startsWith("panel_right")) {
            upd.position.x = clampedX + clampedW;
            upd.position.y = clampedY;
            upd.position.z = clampedZ;
            upd.dimensions.height = clampedH;
            upd.dimensions.depth = clampedD + 20;
          } else if (suffix.startsWith("crown_top")) {
            upd.position.x = clampedX;
            upd.position.y = clampedY + clampedH;
            upd.position.z = clampedZ;
            upd.dimensions.width = clampedW;
          } else if (suffix.startsWith("worktop")) {
            upd.position.x = clampedX;
            upd.position.y = clampedY + clampedH;
            upd.position.z = clampedZ;
            upd.dimensions.width = clampedW;
            upd.dimensions.depth = clampedD + 20;
          } else if (suffix.startsWith("backsplash")) {
            upd.position.x = clampedX;
            upd.position.y = clampedY + clampedH + 38;
            upd.position.z = clampedZ;
            upd.dimensions.width = clampedW;
          } else if (suffix.startsWith("plinth_front")) {
            upd.position.x = clampedX;
            upd.position.y = clampedY;
            upd.position.z = clampedZ + Math.max(0, clampedD - 32);
            upd.dimensions.width = clampedW;
          } else if (suffix.startsWith("waterfall_right")) {
            upd.position.x = clampedX + clampedW;
            upd.position.y = clampedY;
            upd.position.z = clampedZ;
            upd.dimensions.height = clampedH + 38;
            upd.dimensions.depth = clampedD + 20;
          } else if (suffix.startsWith("filler_left")) {
            upd.position.x = Math.max(0, clampedX - upd.dimensions.width);
            upd.position.y = clampedY;
            upd.position.z = clampedZ;
            upd.dimensions.height = clampedH;
          }
          return upd;
        }
        return m;
      });
      const synced = applyPostResizeModuleSync(
        nextMods,
        curProj.sceneObjects || [],
        modIdx,
        target,
        curProj.space?.ceilingHeight || 2700,
        {
          syncStackedColumns: true,
          reflowAdjacentRow: true,
          wallWidthLimitMm: curProj.space?.walls?.[0]?.length,
        }
      );
      commitAdapterState({
        activeModuleIndex: modIdx,
        project: {
          ...curProj,
          modules: synced.modules,
          sceneObjects: synced.sceneObjects,
          updatedAt: new Date().toISOString(),
        },
      });

      const totalLeafCount = nextMod.bays.reduce(
        (s, b) => s + (b.door.type === "double" ? 2 : b.door.type === "open" ? 0 : 1),
        0
      );
      return { bayCount: nextMod.bays.length, totalLeafCount, shelfCount: nextMod.bays[0]?.shelves.length || 0 };
    },
    []
  );

  resizeModuleParametricRef.current = resizeModuleParametric;

  const swapModuleWithNeighbor = useCallback(
    (modIdx: number, direction: "left" | "right"): { swappedWithName: string } | null => {
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const target = curProj.modules[modIdx];
      if (!target) return null;

      const isWallCab =
        target.category === "kitchen_wall" || target.moduleFamilyId === "fam_kitchen_wall";
      const sameRowIndices = curProj.modules
        .map((m, idx) => ({ m, idx }))
        .filter(({ m }) => {
          if (m.category === "complementary") return false;
          const mIsWall = m.category === "kitchen_wall" || m.moduleFamilyId === "fam_kitchen_wall";
          return mIsWall === isWallCab && (m.rotation?.y || 0) === (target.rotation?.y || 0);
        })
        .sort((a, b) => a.m.position.x - b.m.position.x || a.idx - b.idx);

      const posInRow = sameRowIndices.findIndex((item) => item.idx === modIdx);
      if (posInRow < 0) return null;
      const neighborPos = direction === "left" ? posInRow - 1 : posInRow + 1;
      if (neighborPos < 0 || neighborPos >= sameRowIndices.length) return null;

      const neighborEntry = sameRowIndices[neighborPos];
      const a = target;
      const b = neighborEntry.m;

      const minX = Math.min(a.position.x, b.position.x);
      const nextMods = JSON.parse(JSON.stringify(curProj.modules)) as ModuleInstance[];

      if (direction === "left") {
        // target moves to minX, neighbor moves right of target
        nextMods[modIdx].position.x = minX;
        nextMods[neighborEntry.idx].position.x = minX + a.dimensions.width;
      } else {
        // neighbor moves to minX, target moves right of neighbor
        nextMods[neighborEntry.idx].position.x = minX;
        nextMods[modIdx].position.x = minX + b.dimensions.width;
      }

      // Also swap their array order so tab numbers (1, 2, 3...) match left-to-right visual order
      const tempMod = nextMods[modIdx];
      nextMods[modIdx] = nextMods[neighborEntry.idx];
      nextMods[neighborEntry.idx] = tempMod;

      commitAdapterState({
        history: [...curState.history.slice(-50), curProj],
        future: [],
        activeModuleIndex: neighborEntry.idx,
        project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
      });

      return { swappedWithName: b.name };
    },
    []
  );

  /**
   * Called on mouseUp after dragging a module: if the dragged module was dropped overlapping
   * another module in the same row, automatically swaps their positions & resolves the overlap!
   */
  const finishModuleDragWithSmartSwap = useCallback(
    (_modIdx: number, _startModX: number): string | null => {
      // Never auto-shift or teleport untouched modules on drag end in 2D Plan!
      // Users can freely position modules anywhere in X/Z without other cabinets jumping.
      return null;
    },
    []
  );


  /**
   * Enhanced L-Kitchen loader with proper 90° rotated corner return arm & architectural fixtures
   */
  const loadLKitchen = useCallback(() => {
    loadLKitchenBase();
    const curProj = useConfiguratorStore.getState().project;
    const enhancedModules = curProj.modules.map((m) => {
      if (m.id === "l_arm") {
        return {
          ...m,
          isCorner: false,
          position: { x: 0, y: 0, z: 900 },
          rotation: { x: 0, y: 90, z: 0 },
        };
      }
      return m;
    });
    commitAdapterState({
      project: {
        ...curProj,
        modules: enhancedModules,
        space: {
          ...curProj.space,
          elements: getEffectiveSpaceObstacles(curProj),
        },
      },
    });
  }, [loadLKitchenBase]);

  /**
   * Enhanced U-Kitchen loader with 90° rotated left and right return arms
   */
  const loadUKitchen = useCallback(() => {
    loadUKitchenBase();
    const curProj = useConfiguratorStore.getState().project;
    const enhancedModules = curProj.modules.map((m) => {
      if (m.id === "u_arm_left") {
        return {
          ...m,
          isCorner: false,
          position: { x: 0, y: 0, z: 900 },
          rotation: { x: 0, y: 90, z: 0 },
        };
      }
      if (m.id === "u_arm_right") {
        return {
          ...m,
          isCorner: false,
          position: { x: 2220, y: 0, z: 900 },
          rotation: { x: 0, y: 270, z: 0 },
        };
      }
      return m;
    });
    commitAdapterState({
      project: {
        ...curProj,
        modules: enhancedModules,
        space: {
          ...curProj.space,
          walls: getEffectiveSpaceWalls(curProj),
          elements: getEffectiveSpaceObstacles(curProj),
        },
      },
    });
  }, [loadUKitchenBase]);

  /**
   * Enhanced Linear Kitchen loader with architectural fixtures (Window, Plumbing, Column)
   */
  const loadLinearKitchen = useCallback(() => {
    loadLinearKitchenBase();
    const curProj = useConfiguratorStore.getState().project;
    commitAdapterState({
      project: {
        ...curProj,
        space: {
          ...curProj.space,
          elements: getEffectiveSpaceObstacles(curProj),
        },
      },
    });
  }, [loadLinearKitchenBase]);

  /**
   * Add or update an architectural obstacle (Window, Column, Plumbing) in the room
   */
  const updateObstaclePosition = useCallback((obsId: string, newX: number, newZ?: number, newY?: number) => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const currentElements: ArchitecturalElement[] =
      curProj.space.elements.length > 0
        ? curProj.space.elements
        : getEffectiveSpaceObstacles(curProj);
    const updatedElements = currentElements.map((el) =>
      el.id === obsId
        ? {
            ...el,
            position: {
              ...el.position,
              x: Math.max(0, Math.round(newX)),
              y: typeof newY === "number" ? Math.max(0, Math.round(newY)) : el.position.y,
              z: typeof newZ === "number" ? Math.max(0, Math.round(newZ)) : el.position.z,
            },
          }
        : el
    );
    commitAdapterState({
      history: state.batchStartProject ? state.history : [...state.history.slice(-50), curProj],
      future: state.batchStartProject ? state.future : [],
      project: {
        ...curProj,
        space: { ...curProj.space, elements: updatedElements },
        updatedAt: new Date().toISOString(),
      },
    });
  }, []);

  /**
   * Commit a modified ModuleInstance and recompute BOM, pricing & validation
   */
  const commitActiveModuleUpdate = useCallback(
    (updater: (mod: ModuleInstance) => ModuleInstance, pushHistory = true) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const modIdx = state.activeModuleIndex;
      const targetMod = curProj.modules[modIdx] || curProj.modules[0];
      if (!targetMod) return;

      const updatedMod = updater({
        ...targetMod,
        dimensions: { ...targetMod.dimensions },
        position: { ...targetMod.position },
        rotation: targetMod.rotation ? { ...targetMod.rotation } : { x: 0, y: 0, z: 0 },
        componentMaterialOverrides: targetMod.componentMaterialOverrides
          ? { ...targetMod.componentMaterialOverrides }
          : undefined,
        componentGrainOverrides: targetMod.componentGrainOverrides
          ? { ...targetMod.componentGrainOverrides }
          : undefined,
        carcass: {
          ...targetMod.carcass,
          customCadPolygon: targetMod.carcass.customCadPolygon
            ? targetMod.carcass.customCadPolygon.map((pt) => ({ ...pt }))
            : undefined,
        },
        bays: targetMod.bays.map((b) => ({
          ...b,
          door: {
            ...b.door,
            customCadPolygon: b.door.customCadPolygon
              ? b.door.customCadPolygon.map((pt) => ({ ...pt }))
              : undefined,
          },
          shelves: b.shelves.map((s) => ({ ...s })),
          drawers: b.drawers.map((d) => ({ ...d })),
          hangingRails: b.hangingRails.map((r) => ({ ...r })),
          specialFittings: b.specialFittings ? b.specialFittings.map((f) => ({ ...f })) : [],
          subDividers: b.subDividers ? b.subDividers.map((sd) => ({ ...sd })) : [],
        })),
      });

      const nextModules = curProj.modules.map((m, idx) =>
        idx === modIdx ? updatedMod : m
      );
      const nextProj = {
        ...curProj,
        status: "draft" as const,
        version: (curProj.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        modules: nextModules,
      };
      if (!pushHistory) {
        // Fast path during live 3D/2D dragging: update geometry at 60 FPS without blocking on CNC nesting/BOM.
        // When an explicit history transaction is active (`batchStartProject !== null`), skip the 180ms timer
        // completely so pausing the cursor mid-drag NEVER triggers a synchronous BOM/pricing/validation hitch;
        // `commitHistoryTransaction()` on pointerup performs the full recompute once.
        commitAdapterState({
          project: nextProj,
        });
        if (typeof window !== "undefined") {
          const w = window as unknown as {
            __birimLiveDragBomTimer?: ReturnType<typeof setTimeout>;
          };
          if (w.__birimLiveDragBomTimer) {
            clearTimeout(w.__birimLiveDragBomTimer);
            w.__birimLiveDragBomTimer = undefined;
          }
          if (useConfiguratorStore.getState().batchStartProject === null) {
            w.__birimLiveDragBomTimer = setTimeout(() => {
              const latestState = useConfiguratorStore.getState();
              if (latestState.batchStartProject !== null) return;
              const latestProj = latestState.project;
              const dBom = generateBOMForProject(latestProj, undefined, { skipSyncNesting: true });
              commitAdapterState({
                validationIssues: validateProject(latestProj),
                bom: dBom,
                pricing: calculateProjectPrice(dBom, undefined, undefined, latestProj.sceneObjects || []),
              });
            }, 220);
          }
        }
        return;
      }

      if (typeof window !== "undefined") {
        const w = window as unknown as {
          __birimLiveDragBomTimer?: ReturnType<typeof setTimeout>;
        };
        if (w.__birimLiveDragBomTimer) clearTimeout(w.__birimLiveDragBomTimer);
      }

      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: nextProj,
      });
    },
    []
  );

  const templateDoorAndWizardActions = useAdapterTemplateDoorAndWizardActions({ commitActiveModuleUpdate });
  return {
    activeModule,
    safeBayIndex,
    activeBay,
    bodyMaterial,
    doorMaterial,
    fourSpaceDimensions,
    isDraggingActive,
    v4CompatibilityReport,
    unifiedEngineeringReport,
    ergonomicProfileId,
    setErgonomicProfileId,
    applyApprovedEngineeringFix,
    spaceObstacles,
    spaceWalls,
    validationIssues,
    handleComponentSelect,
    snapModuleToAngledWall,
    addKitchenIslandUnit,
    addOrUpdateAttachedTable,
    rotateActiveModule90,
    setModulePosition,
    resizeModuleParametric,
    swapModuleWithNeighbor,
    finishModuleDragWithSmartSwap,
    loadLKitchen,
    loadUKitchen,
    loadLinearKitchen,
    updateObstaclePosition,
    commitActiveModuleUpdate,
    ...templateDoorAndWizardActions,
  };
}
