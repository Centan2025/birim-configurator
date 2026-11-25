"use client";
import { useMemo, useCallback, useRef } from "react";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { DEFAULT_MATERIALS, registerRuntimeMaterial, createDefaultWardrobeModule, type MaterialDefinition, type ModuleInstance, type DesignProject, validateProject, computeCornerFillerAutoFix, type PanelCutoutConfig, type BayConfig } from "@birim/core";
import { V4_MODULE_TEMPLATES, getV4TemplateById } from "@birim/catalog";
import { calculateBlumEngineeringSummary, generateBlumBxfXml, parseBlumBxfXml, exportAllPanelsDXF, exportNestingSheetsDXF, exportIndustrialCamZipArchive, exportOptiCutCutListCsv, exportHardwareBomCsv, generateNestingDiagramSvg, generateThermalPartLabelsHtml, buildBirimErpNestingBundle, type BirimErpNestingBuildOptions, type BirimErpNestingExportBundle } from "@birim/manufacturing";
import { getEffectiveSpaceObstacles, getEffectiveSpaceWalls, getModuleOrientedFootprint } from "../../engine/kitchenSpatialEngine";
import { getMemoizedContinuousKitchenLayers, commitAdapterState } from "../adapterMathAndCache";
import type { useAdapterStoreAndCoreBindings } from "./useAdapterStoreAndCoreBindings";
import type { useAdapterLayoutAndWizardActions } from "./useAdapterLayoutAndWizardActions";

export function useAdapterSpatialBlumAndExports(ctx: Pick<ReturnType<typeof useAdapterStoreAndCoreBindings>, "activeModuleIndex" | "project" | "isLite" | "bom"> & Pick<ReturnType<typeof useAdapterLayoutAndWizardActions>, "isDraggingActive" | "setModulePosition" | "activeModule" | "commitActiveModuleUpdate">) {
  const { isDraggingActive, activeModuleIndex, project, setModulePosition, isLite, activeModule, commitActiveModuleUpdate, bom } = ctx;
/**
   * Screen 7 (FAZ 3, 5, 8, 11 & 12): Axis-aware spatial clearance & room metrics calculator.
   * Never subtracts rotated/off-axis modules from the wrong wall!
   */
  const computeWallAndModuleClearances = useCallback(
    (explicitModIdx?: number) => {
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const targetIdx =
        typeof explicitModIdx === "number" ? explicitModIdx : curState.activeModuleIndex;
      const walls = getEffectiveSpaceWalls(curProj);
      const mainWall = walls[0] || {
        id: "wall_main",
        name: "Ana Duvar",
        length: 3600,
        height: curProj.space.ceilingHeight || 2700,
        thickness: 200,
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        wallType: "standard" as const,
        elements: [],
      };
      const sideWalls = walls.filter((w) => w.rotationY === 90 || w.rotationY === 270);
      const roomDepthMm =
        sideWalls.length > 0
          ? Math.max(...sideWalls.map((w) => w.length))
          : 2700;
      const roomWidthMm = mainWall.length || 3600;
      const roomHeightMm = curProj.space.ceilingHeight || mainWall.height || 2700;
      const roomAreaM2 = Number(((roomWidthMm * roomDepthMm) / 1_000_000).toFixed(2));

      const allFootprints = curProj.modules.map((m, idx) =>
        getModuleOrientedFootprint(m, idx)
      );
      const targetMod = curProj.modules[targetIdx] || curProj.modules[0];
      const targetFp =
        allFootprints[targetIdx] ||
        allFootprints[0] || {
          moduleId: "empty",
          moduleIndex: 0,
          name: "Modül Yok",
          category: "wardrobe" as const,
          x: 0,
          z: 0,
          planWidth: 0,
          planDepth: 0,
          yBottom: 0,
          yTop: 2200,
          rotationY: 0,
          rawWidth: 0,
          rawHeight: 2200,
          rawDepth: 600,
          isCorner: false,
          isOpenFront: false,
          cornerType: "none" as const,
          wingDepthMm: 600,
        };

      const rotY = (((targetFp.rotationY || 0) % 360) + 360) % 360;
      const isSideAxis = rotY === 90 || rotY === 270;

      if (!isSideAxis) {
        // Horizontal wall (X-axis)
        const horizWalls = walls.filter((w) => w.rotationY === 0 || w.rotationY === 180);
        const hostWall =
          horizWalls.sort(
            (a, b) => Math.abs(a.position.z - targetFp.z) - Math.abs(b.position.z - targetFp.z)
          )[0] || mainWall;

        const wallStart = hostWall.position.x;
        const wallEnd = hostWall.position.x + hostWall.length;

        // Check if any structural column on the same wall restricts the right or left usable bound
        const obstacles = getEffectiveSpaceObstacles(curProj);
        let effectiveLeftBound = wallStart;
        let effectiveRightBound = wallEnd;
        obstacles.forEach((obs) => {
          if (obs.type === "column" || obs.type === "protrusion") {
            const zDist = Math.abs(obs.position.z - hostWall.position.z);
            if (zDist <= 350) {
              const ox1 = obs.position.x;
              const ox2 = obs.position.x + obs.dimensions.width;
              if (ox2 <= targetFp.x + 5 && ox2 > effectiveLeftBound) {
                effectiveLeftBound = ox2;
              }
              if (ox1 >= targetFp.x + targetFp.planWidth - 5 && ox1 < effectiveRightBound) {
                effectiveRightBound = ox1;
              }
            }
          }
        });

        const leftClearanceMm = Math.max(0, Math.round(targetFp.x - wallStart));
        const rightClearanceMm = Math.max(
          0,
          Math.round(wallEnd - (targetFp.x + targetFp.planWidth))
        );
        const rightClearanceToObstacleMm = Math.max(
          0,
          Math.round(effectiveRightBound - (targetFp.x + targetFp.planWidth))
        );
        const backWallDistanceMm = Math.max(0, Math.round(targetFp.z - hostWall.position.z));

        const sameWallFootprints = allFootprints.filter(
          (f) =>
            f.category !== "complementary" &&
            (f.rotationY === 0 || f.rotationY === 180) &&
            Math.abs(f.z - targetFp.z) <= 120
        );
        const totalModuleLengthOnWallMm = sameWallFootprints.reduce(
          (sum, f) => sum + f.planWidth,
          0
        );
        const remainingWallClearanceMm = Math.max(
          0,
          Math.round(hostWall.length - totalModuleLengthOnWallMm)
        );

        const alignmentMode: "left" | "center" | "right" | "custom" =
          leftClearanceMm <= 5
            ? "left"
            : rightClearanceMm <= 5
            ? "right"
            : Math.abs(leftClearanceMm - rightClearanceMm) <= 20
            ? "center"
            : "custom";

        return {
          hostWallId: hostWall.id,
          hostWallName: hostWall.name || "Ana Duvar",
          hostWallNetLengthMm: hostWall.length,
          hostWallThicknessMm: hostWall.thickness || 200,
          hostWallHeightMm: hostWall.height || roomHeightMm,
          hostWallType: hostWall.wallType || "standard",
          axis: "X" as const,
          isRotatedSideWall: false,
          moduleSpanMm: targetFp.planWidth,
          moduleDepthMm: targetFp.planDepth,
          moduleHeightMm: targetFp.rawHeight,
          leftClearanceMm,
          rightClearanceMm,
          rightClearanceToObstacleMm,
          backWallDistanceMm,
          totalModuleLengthOnWallMm,
          remainingWallClearanceMm,
          alignmentMode,
          roomWidthMm,
          roomDepthMm,
          roomHeightMm,
          roomAreaM2,
          plinthHeightMm: targetMod?.carcass?.plinthHeight ?? 60,
        };
      } else {
        // Rotated 90° / 270° module on a vertical Side Wall (Z-axis)
        const isRightSide = targetFp.x > roomWidthMm * 0.5;
        const matchedSideWall =
          sideWalls.sort(
            (a, b) => Math.abs(a.position.x - targetFp.x) - Math.abs(b.position.x - targetFp.x)
          )[0] || {
            id: isRightSide ? "wall_side_right" : "wall_side_left",
            name: isRightSide ? "Sağ Yan Duvar" : "Sol Yan Duvar",
            length: roomDepthMm,
            height: roomHeightMm,
            thickness: mainWall.thickness || 200,
            position: { x: isRightSide ? roomWidthMm : 0, y: 0, z: 0 },
            rotationY: 90,
            wallType: "standard" as const,
            elements: [],
          };

        const wallStartZ = matchedSideWall.position.z;
        const wallEndZ = matchedSideWall.position.z + matchedSideWall.length;
        const leftClearanceMm = Math.max(0, Math.round(targetFp.z - wallStartZ));
        const rightClearanceMm = Math.max(
          0,
          Math.round(wallEndZ - (targetFp.z + targetFp.planDepth))
        );
        const backWallDistanceMm = isRightSide
          ? Math.max(0, Math.round(roomWidthMm - (targetFp.x + targetFp.planWidth)))
          : Math.max(0, Math.round(targetFp.x - matchedSideWall.position.x));

        const sameSideFootprints = allFootprints.filter(
          (f) =>
            f.category !== "complementary" &&
            (f.rotationY === 90 || f.rotationY === 270) &&
            Math.abs(f.x - targetFp.x) <= 650
        );
        const totalModuleLengthOnWallMm = sameSideFootprints.reduce(
          (sum, f) => sum + f.planDepth,
          0
        );
        const remainingWallClearanceMm = Math.max(
          0,
          Math.round(matchedSideWall.length - totalModuleLengthOnWallMm)
        );

        const alignmentMode: "left" | "center" | "right" | "custom" =
          leftClearanceMm <= 5
            ? "left"
            : rightClearanceMm <= 5
            ? "right"
            : Math.abs(leftClearanceMm - rightClearanceMm) <= 20
            ? "center"
            : "custom";

        return {
          hostWallId: matchedSideWall.id,
          hostWallName: matchedSideWall.name || (isRightSide ? "Sağ Yan Duvar" : "Sol Yan Duvar"),
          hostWallNetLengthMm: matchedSideWall.length,
          hostWallThicknessMm: matchedSideWall.thickness || 200,
          hostWallHeightMm: matchedSideWall.height || roomHeightMm,
          hostWallType: matchedSideWall.wallType || "standard",
          axis: "Z" as const,
          isRotatedSideWall: true,
          moduleSpanMm: targetFp.planDepth,
          moduleDepthMm: targetFp.planWidth,
          moduleHeightMm: targetFp.rawHeight,
          leftClearanceMm,
          rightClearanceMm,
          rightClearanceToObstacleMm: rightClearanceMm,
          backWallDistanceMm,
          totalModuleLengthOnWallMm,
          remainingWallClearanceMm,
          alignmentMode,
          roomWidthMm,
          roomDepthMm,
          roomHeightMm,
          roomAreaM2,
          plinthHeightMm: targetMod?.carcass?.plinthHeight ?? 60,
        };
      }
    },
    []
  );

  const lastSpatialMetricsRef = useRef<ReturnType<typeof computeWallAndModuleClearances> | null>(null);
  const activeSpatialMetrics = useMemo(() => {
    if (isDraggingActive && lastSpatialMetricsRef.current) {
      return lastSpatialMetricsRef.current;
    }
    const computed = computeWallAndModuleClearances(activeModuleIndex);
    lastSpatialMetricsRef.current = computed;
    return computed;
  }, [isDraggingActive, computeWallAndModuleClearances, activeModuleIndex, project]);

  /**
   * Screen 7 (FAZ 2, 4 & 8): Align active module along its host wall
   * ("left" | "center" | "right" | "flush_back" | "custom_left" | "custom_right")
   */
  const alignActiveModuleOnWall = useCallback(
    (
      alignment: "left" | "center" | "right" | "flush_back" | "custom_left" | "custom_right",
      customGapMm = 0
    ) => {
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const modIdx = curState.activeModuleIndex;
      const target = curProj.modules[modIdx];
      if (!target) return;

      const metrics = computeWallAndModuleClearances(modIdx);
      const fp = getModuleOrientedFootprint(target, modIdx);
      const safeGap = Math.max(0, Math.round(customGapMm));

      let nextX = target.position.x;
      let nextZ = target.position.z;

      if (!metrics.isRotatedSideWall) {
        const wallLen = metrics.hostWallNetLengthMm;
        if (alignment === "left") {
          nextX = 0;
        } else if (alignment === "center") {
          nextX = Math.max(0, Math.round((wallLen - fp.planWidth) / 2));
        } else if (alignment === "right") {
          nextX = Math.max(0, Math.round(wallLen - fp.planWidth));
        } else if (alignment === "flush_back") {
          nextZ = 0;
        } else if (alignment === "custom_left") {
          nextX = Math.max(0, Math.min(wallLen - fp.planWidth, safeGap));
        } else if (alignment === "custom_right") {
          nextX = Math.max(0, wallLen - fp.planWidth - safeGap);
        }
      } else {
        const wallLenZ = metrics.hostWallNetLengthMm;
        if (alignment === "left") {
          nextZ = 0;
        } else if (alignment === "center") {
          nextZ = Math.max(0, Math.round((wallLenZ - fp.planDepth) / 2));
        } else if (alignment === "right") {
          nextZ = Math.max(0, Math.round(wallLenZ - fp.planDepth));
        } else if (alignment === "flush_back") {
          nextX = fp.x > metrics.roomWidthMm * 0.5 ? Math.max(0, metrics.roomWidthMm - fp.planWidth) : 0;
        } else if (alignment === "custom_left") {
          nextZ = Math.max(0, Math.min(wallLenZ - fp.planDepth, safeGap));
        } else if (alignment === "custom_right") {
          nextZ = Math.max(0, wallLenZ - fp.planDepth - safeGap);
        }
      }

      setModulePosition(modIdx, nextX, nextZ, 1);
    },
    [computeWallAndModuleClearances, setModulePosition]
  );

  /**
   * Screen 7 (FAZ 4): Distribute modules along the main wall with an explicit gap (mm) or equal spacing
   */
  const distributeModulesWithGap = useCallback((gapMm?: number) => {
    const curState = useConfiguratorStore.getState();
    const curProj = curState.project;
    const wallLen = curProj.space.walls[0]?.length || 3600;
    const nextMods = JSON.parse(JSON.stringify(curProj.modules)) as ModuleInstance[];
    const mainRowIndices = nextMods
      .map((m, i) => ({ m, i }))
      .filter(
        ({ m }) =>
          m.category !== "complementary" &&
          m.category !== "kitchen_wall" &&
          (m.rotation?.y || 0) === 0
      )
      .sort((a, b) => a.m.position.x - b.m.position.x);

    if (mainRowIndices.length === 0) return;

    if (typeof gapMm === "number" && gapMm >= 0) {
      let curX = 0;
      mainRowIndices.forEach(({ i }) => {
        nextMods[i].position.x = curX;
        curX += nextMods[i].dimensions.width + Math.round(gapMm);
      });
    } else {
      const totalModW = mainRowIndices.reduce(
        (sum, { m }) => sum + m.dimensions.width,
        0
      );
      const freeSpace = Math.max(0, wallLen - totalModW);
      const stepGap =
        mainRowIndices.length > 1
          ? Math.round(freeSpace / (mainRowIndices.length + 1))
          : Math.round(freeSpace / 2);
      let curX = stepGap;
      mainRowIndices.forEach(({ i }) => {
        nextMods[i].position.x = curX;
        curX += nextMods[i].dimensions.width + stepGap;
      });
    }

    commitAdapterState({
      history: [...curState.history.slice(-50), curProj],
      future: [],
      project: { ...curProj, modules: nextMods, updatedAt: new Date().toISOString() },
    });
  }, []);

  /**
   * Screen 7 (FAZ 3): Apply Ready Room Shape Presets ("rectangular" | "l_shape" | "u_shape")
   * while preserving existing furniture modules and updating 2D + 3D room walls.
   */
  const applyRoomShapePreset = useCallback(
    (
      shape: "rectangular" | "l_shape" | "u_shape",
      options?: {
        mainLengthMm?: number;
        sideLengthMm?: number;
        ceilingHeightMm?: number;
        thicknessMm?: number;
        wallType?: import("@birim/core").WallDefinition["wallType"];
      }
    ) => {
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const existingMain = curProj.space.walls[0];
      const mainLen = options?.mainLengthMm || existingMain?.length || 3600;
      const sideLen = options?.sideLengthMm || 2700;
      const ceilH = options?.ceilingHeightMm || curProj.space.ceilingHeight || 2700;
      const thick = options?.thicknessMm || existingMain?.thickness || 200;
      const wType = options?.wallType || existingMain?.wallType || "standard";

      let nextWalls: import("@birim/core").WallDefinition[] = [];
      if (shape === "rectangular") {
        nextWalls = [
          {
            id: "wall_main",
            name: "Ana Duvar",
            length: mainLen,
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_side_left",
            name: "Sol Yan Duvar",
            length: sideLen,
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 90,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_side_right",
            name: "Sağ Yan Duvar",
            length: sideLen,
            height: ceilH,
            thickness: thick,
            position: { x: mainLen, y: 0, z: 0 },
            rotationY: 90,
            wallType: wType,
            elements: [],
          },
        ];
      } else if (shape === "l_shape") {
        nextWalls = [
          {
            id: "wall_main",
            name: "Ana Duvar",
            length: mainLen,
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_side_left",
            name: "Sol Yan Duvar (L Kolu)",
            length: sideLen,
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 90,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_l_inner_step",
            name: "L İç Dönüş Duvarı",
            length: Math.round(mainLen * 0.5),
            height: ceilH,
            thickness: thick,
            position: { x: Math.round(mainLen * 0.5), y: 0, z: Math.round(sideLen * 0.55) },
            rotationY: 0,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_side_right",
            name: "Sağ Kısa Duvar",
            length: Math.round(sideLen * 0.55),
            height: ceilH,
            thickness: thick,
            position: { x: mainLen, y: 0, z: 0 },
            rotationY: 90,
            wallType: wType,
            elements: [],
          },
        ];
      } else {
        // u_shape
        nextWalls = [
          {
            id: "wall_main",
            name: "Ana Duvar",
            length: mainLen,
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_side_left",
            name: "Sol Dönüş Duvarı",
            length: sideLen,
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 90,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_side_right",
            name: "Sağ Dönüş Duvarı",
            length: sideLen,
            height: ceilH,
            thickness: thick,
            position: { x: mainLen, y: 0, z: 0 },
            rotationY: 90,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_u_front_left",
            name: "Ön Sol Kapanış",
            length: Math.round(mainLen * 0.3),
            height: ceilH,
            thickness: thick,
            position: { x: 0, y: 0, z: sideLen },
            rotationY: 0,
            wallType: wType,
            elements: [],
          },
          {
            id: "wall_u_front_right",
            name: "Ön Sağ Kapanış",
            length: Math.round(mainLen * 0.3),
            height: ceilH,
            thickness: thick,
            position: { x: Math.round(mainLen * 0.7), y: 0, z: sideLen },
            rotationY: 0,
            wallType: wType,
            elements: [],
          },
        ];
      }

      const nextProj: import("@birim/core").DesignProject = {
        ...curProj,
        space: {
          ...curProj.space,
          ceilingHeight: ceilH,
          walls: nextWalls,
        },
        updatedAt: new Date().toISOString(),
      };

      commitAdapterState({
        history: [...curState.history.slice(-50), curProj],
        future: [],
        project: nextProj,
        validationIssues: validateProject(nextProj),
      });
    },
    []
  );

  /**
   * Screen 7 (FAZ 3): Update wall settings (thickness, height, wallType) across room walls
   */
  const setAllWallsSettings = useCallback(
    (patch: {
      thickness?: number;
      height?: number;
      wallType?: import("@birim/core").WallDefinition["wallType"];
      targetWallId?: string;
    }) => {
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const baseWalls =
        curProj.space.walls.length > 0
          ? curProj.space.walls
          : getEffectiveSpaceWalls(curProj);
      const nextCeilH =
        typeof patch.height === "number"
          ? Math.max(1800, Math.min(6000, Math.round(patch.height)))
          : curProj.space.ceilingHeight || 2700;

      const nextWalls = baseWalls.map((w) => {
        if (patch.targetWallId && w.id !== patch.targetWallId) {
          return typeof patch.height === "number" ? { ...w, height: nextCeilH } : w;
        }
        return {
          ...w,
          thickness:
            typeof patch.thickness === "number"
              ? Math.max(50, Math.min(600, Math.round(patch.thickness)))
              : w.thickness,
          height: nextCeilH,
          wallType: patch.wallType ?? w.wallType ?? "standard",
        };
      });

      const nextProj: import("@birim/core").DesignProject = {
        ...curProj,
        space: {
          ...curProj.space,
          ceilingHeight: nextCeilH,
          walls: nextWalls,
        },
        updatedAt: new Date().toISOString(),
      };

      commitAdapterState({
        history: [...curState.history.slice(-50), curProj],
        future: [],
        project: nextProj,
        validationIssues: validateProject(nextProj),
      });
    },
    []
  );


  /**
   * Blum Cabinet Configurator (E-SERVICES) live engineering summary for activeModule
   */
  const activeBlumEngineering = useMemo(
    () => (!isLite && activeModule ? calculateBlumEngineeringSummary(activeModule) : null),
    [isLite, activeModule]
  );

  /**
   * Generates a Blum Exchange Format (.bxf / XML) string for the current project & BOM
   */
  const exportBlumBxfString = useCallback((): string => {
    const curState = useConfiguratorStore.getState();
    return generateBlumBxfXml(curState.project, curState.bom);
  }, []);

  /**
   * Imports a Blum .bxf / XML file and creates/updates the module in the project
   */
  const importBlumBxfFile = useCallback(
    (xmlText: string, appendToProject = false): { ok: boolean; name?: string; error?: string } => {
      const parsed = parseBlumBxfXml(xmlText);
      if (!parsed) {
        return { ok: false, error: "Geçersiz veya okunamayan Blum BXF / XML dosyası." };
      }
      const curState = useConfiguratorStore.getState();
      const curProj = curState.project;
      const newMod = parsed.createdModule;
      if (appendToProject && curProj.modules.length > 0) {
        const maxRight = Math.max(
          0,
          ...curProj.modules
            .filter((m) => m.category !== "complementary" && (m.rotation?.y || 0) === 0)
            .map((m) => m.position.x + m.dimensions.width)
        );
        newMod.position = { x: maxRight, y: 0, z: 0 };
      }
      const nextModules = appendToProject
        ? [...curProj.modules, newMod]
        : curProj.modules.map((m, idx) => (idx === curState.activeModuleIndex ? newMod : m));
      const nextProj = {
        ...curProj,
        version: (curProj.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        modules: nextModules,
      };
      commitAdapterState({
        history: [...curState.history.slice(-50), curProj],
        future: [],
        project: nextProj,
        activeModuleIndex: appendToProject ? nextModules.length - 1 : curState.activeModuleIndex,
        selectedModuleIds: [newMod.id],
      });
      return { ok: true, name: parsed.name };
    },
    []
  );

  /**
   * 1-Click Blum Cabinet Applications (SPACE TOWER, AVENTOS HF top, LEGRABOX pure, 155° Zero-Protrusion)
   */
  const applyBlumQuickWizardPreset = useCallback(
    (
      presetId:
        | "blum_space_tower"
        | "blum_aventos_wall"
        | "blum_legrabox_base"
        | "blum_155_wardrobe"
    ) => {
      commitActiveModuleUpdate((mod) => {
        const bIdx = Math.min(
          useConfiguratorStore.getState().activeBayIndex,
          Math.max(0, mod.bays.length - 1)
        );
        const bay = mod.bays[bIdx] || mod.bays[0];
        if (!bay) return mod;

        if (presetId === "blum_space_tower") {
          // SPACE TOWER: 155° Zero-Protrusion CLIP top BLUMOTION (71B7550) + 4 Internal LEGRABOX drawers
          mod.carcass.hingeDrillingTemplateId = "tpl_drill_blum_155_zero";
          mod.carcass.drawerDrillingSetId = "blum_legrabox";
          bay.door = {
            ...bay.door,
            doorSystemId: bay.door.type === "double" ? "hinged_double" : "hinged_single",
            hardwareProductId: "hw_blum_71b7550",
            openingTechnology: "soft_close",
            softClose: true,
          };
          const optNl = Math.min(
            600,
            Math.max(270, Math.floor((mod.dimensions.depth - 28) / 50) * 50)
          );
          bay.drawers = [0, 1, 2, 3].map((dIdx) => ({
            id: `${mod.id}_spacetower_${bIdx}_${dIdx}_${Date.now()}`,
            bayIndex: bIdx,
            elevationY: dIdx * 280,
            height: 180,
            slideType: "soft_close" as const,
            isInternal: true,
            hardwareProductId: "hw_blum_legrabox_m40",
            nominalLengthMm: optNl,
          }));
        } else if (presetId === "blum_aventos_wall") {
          // AVENTOS HF top Bi-Fold Lift System (for wall/upper cabinets)
          if (mod.dimensions.height > 1040) {
            mod.dimensions.height = 780;
            mod.dimensions.depth = 350;
            mod.carcass.plinthHeight = 0;
          }
          bay.door = {
            ...bay.door,
            type: "lift_bi_fold",
            doorSystemId: "lift_bi_fold",
            hardwareProductId: "hw_blum_aventos_hf_25",
            openingTechnology: "soft_close",
            softClose: true,
          };
        } else if (presetId === "blum_legrabox_base") {
          // LEGRABOX pure 3-drawer stack
          mod.carcass.drawerDrillingSetId = "blum_legrabox";
          const optNl = Math.min(
            600,
            Math.max(270, Math.floor((mod.dimensions.depth - 28) / 50) * 50)
          );
          bay.drawers = [
            {
              id: `${mod.id}_lgb_${bIdx}_0_${Date.now()}`,
              bayIndex: bIdx,
              elevationY: 0,
              height: 240,
              slideType: "soft_close",
              isInternal: false,
              hardwareProductId: "hw_blum_legrabox_m40",
              nominalLengthMm: optNl,
            },
            {
              id: `${mod.id}_lgb_${bIdx}_1_${Date.now()}`,
              bayIndex: bIdx,
              elevationY: 258,
              height: 180,
              slideType: "soft_close",
              isInternal: false,
              hardwareProductId: "hw_blum_legrabox_m40",
              nominalLengthMm: optNl,
            },
            {
              id: `${mod.id}_lgb_${bIdx}_2_${Date.now()}`,
              bayIndex: bIdx,
              elevationY: 456,
              height: 140,
              slideType: "soft_close",
              isInternal: false,
              hardwareProductId: "hw_blum_legrabox_m40",
              nominalLengthMm: optNl,
            },
          ];
        } else if (presetId === "blum_155_wardrobe") {
          // CLIP top BLUMOTION 155° + TANDEMBOX antaro + Hanging Rail
          mod.carcass.hingeDrillingTemplateId = "tpl_drill_blum_155_zero";
          mod.carcass.drawerDrillingSetId = "blum_tandembox";
          bay.door = {
            ...bay.door,
            hardwareProductId: "hw_blum_71b7550",
            openingTechnology: "soft_close",
            softClose: true,
          };
        }
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );


  /**
   * Generates a complete AutoCAD DXF string of all cutlist panels + CNC holes
   */
  const exportAllPanelsDxfString = useCallback((): string => {
    const curState = useConfiguratorStore.getState();
    return exportAllPanelsDXF(curState.bom);
  }, []);

  /**
   * Generates a 2800x2070mm 2D sheet nesting layout DXF string
   */
  const exportNestingDxfString = useCallback((): string => {
    const curState = useConfiguratorStore.getState();
    return exportNestingSheetsDXF(curState.bom);
  }, []);

  /**
   * V5.5: Generates a 100% Birim Portal ERP compatible Nesting Bundle
   * (nesting_projects + nesting_sheets + nesting_parts + nesting_placements + Selco CSV + CNC G-Code)
   */
  const exportErpNestingBundle = useCallback(
    (options?: BirimErpNestingBuildOptions): BirimErpNestingExportBundle => {
      const curState = useConfiguratorStore.getState();
      const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
      return buildBirimErpNestingBundle(curState.project, curState.bom, matMap, options);
    },
    []
  );

  const exportErpNestingJsonString = useCallback(
    (options?: BirimErpNestingBuildOptions): string => {
      return JSON.stringify(exportErpNestingBundle(options), null, 2);
    },
    [exportErpNestingBundle]
  );

  const exportErpSelcoCsvString = useCallback(
    (options?: BirimErpNestingBuildOptions): string => {
      return exportErpNestingBundle(options).combined_selco_csv;
    },
    [exportErpNestingBundle]
  );

  const exportErpGCodeString = useCallback(
    (options?: BirimErpNestingBuildOptions): string => {
      return exportErpNestingBundle(options).combined_cnc_gcode;
    },
    [exportErpNestingBundle]
  );
  /**
   * V4.6: Updates parametric CNC utility cutouts (sockets, grommets, plumbing, baseboard notches) on active module
   */
  const setModuleUtilityCutouts = useCallback(
    (nextCutouts: PanelCutoutConfig[]) => {
      commitActiveModuleUpdate((mod) => {
        mod.utilityCutouts = nextCutouts.map((c) => ({ ...c }));
        return mod;
      }, true);
    },
    [commitActiveModuleUpdate]
  );

  /**
   * V4.6: Resolves 90-degree corner door/drawer sweep collisions by shifting colliding runs >= 50mm
   * and inserting parametric corner filler strips (`tpl_cm_04_wall_filler`).
   */
  const autoResolveCornerCollisions = useCallback(() => {
    const state = useConfiguratorStore.getState();
    const curProj = state.project;
    const { adjustedModules, resolvedCount, insertedFillerSpecs } = computeCornerFillerAutoFix(
      curProj.modules,
      50
    );
    if (resolvedCount === 0) return 0;

    const fillerTpl = getV4TemplateById("tpl_cm_04_wall_filler");
    const fillerMods = insertedFillerSpecs.map((spec, idx) => {
      const fMod = fillerTpl
        ? fillerTpl.createInstance(`mod_corner_filler_${Date.now()}_${idx}`)
        : createDefaultWardrobeModule(`mod_corner_filler_${Date.now()}_${idx}`);
      fMod.name = `Köşe Kör Çıta (${spec.widthMm} mm)`;
      fMod.category = "complementary";
      fMod.complementaryRole = "wall_filler";
      fMod.isOpenFront = true;
      fMod.position = { ...spec.position };
      fMod.rotation = { x: 0, y: spec.rotationY, z: 0 };
      fMod.dimensions = {
        width: spec.widthMm,
        height: spec.heightMm,
        depth: spec.depthMm,
      };
      return fMod;
    });

    commitAdapterState({
      project: {
        ...curProj,
        modules: [...adjustedModules, ...fillerMods],
      },
    });
    return resolvedCount;
  }, []);

  /**
   * Atomically creates or replaces the active cabinet with given dimensions, bay count, door style,
   * interior focus, and materials in a SINGLE history commit with zero setTimeout race conditions.
   */
  const applyQuickCabinetAtomic = useCallback(
    (spec: {
      templateId?: string;
      width: number;
      height: number;
      depth: number;
      bays: number;
      doorType: "hinged" | "sliding" | "open";
      interior: "balanced" | "hanging" | "shelves" | "drawers";
      bodyMaterialId?: string;
      doorMaterialId?: string;
      replaceAll?: boolean;
    }) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const tpl = getV4TemplateById(spec.templateId || "tpl_wd_02_two_door") || V4_MODULE_TEMPLATES[0];
      const baseMod = tpl ? tpl.createInstance(`mod_${Date.now()}`) : createDefaultWardrobeModule(`mod_${Date.now()}`);

      const T = baseMod.carcass.panelThickness || 18;
      const safeW = Math.max(300, Math.min(3600, Math.round(spec.width)));
      const safeH = Math.max(400, Math.min(2800, Math.round(spec.height)));
      const safeD = Math.max(250, Math.min(900, Math.round(spec.depth)));
      const maxSafeBays = Math.max(1, Math.floor((safeW - T) / (120 + T)));
      const safeBays = Math.max(1, Math.min(maxSafeBays, Math.round(spec.bays)));
      const plinthH = baseMod.carcass.plinthHeight ?? 80;
      const netH = Math.max(320, safeH - plinthH - 2 * T);

      const bodyMat = spec.bodyMaterialId || baseMod.carcass.bodyMaterialId || "mat_melamine_white";
      const doorMat = spec.doorMaterialId || baseMod.carcass.doorMaterialId || "mat_veneer_oak";

      baseMod.dimensions = { width: safeW, height: safeH, depth: safeD };
      baseMod.isOpenFront = spec.doorType === "open";
      baseMod.carcass = {
        ...baseMod.carcass,
        bodyMaterialId: bodyMat,
        doorMaterialId: doorMat,
      };

      const topShelfY = Math.max(256, Math.min(netH - 160, Math.round((netH - 340) / 32) * 32));
      const nextBays: ModuleInstance["bays"] = [];

      for (let bIdx = 0; bIdx < safeBays; bIdx++) {
        const doorKind =
          spec.doorType === "open"
            ? ("open" as const)
            : spec.doorType === "sliding"
            ? ("sliding" as const)
            : safeBays === 1 && safeW >= 750
            ? ("double" as const)
            : bIdx % 2 === 0
            ? ("single_left" as const)
            : ("single_right" as const);
        const doorSys =
          spec.doorType === "open"
            ? ("open" as const)
            : spec.doorType === "sliding"
            ? ("sliding_top_hung" as const)
            : doorKind === "double"
            ? ("hinged_double" as const)
            : ("hinged_single" as const);

        const shelves: ModuleInstance["bays"][number]["shelves"] = [];
        const drawers: ModuleInstance["bays"][number]["drawers"] = [];
        const hangingRails: ModuleInstance["bays"][number]["hangingRails"] = [];

        const modeForBay =
          spec.interior === "balanced"
            ? bIdx === 0
              ? "hanging"
              : bIdx === safeBays - 1 && safeBays >= 2
              ? "drawers"
              : "shelves"
            : spec.interior;

        if (modeForBay === "hanging") {
          shelves.push({
            id: `${baseMod.id}_b${bIdx}_sh_top`,
            bayIndex: bIdx,
            elevationY: topShelfY,
            isAdjustable: false,
          });
          hangingRails.push({
            id: `${baseMod.id}_b${bIdx}_rail_main`,
            bayIndex: bIdx,
            elevationY: Math.max(320, topShelfY - 64),
          });
        } else if (modeForBay === "shelves") {
          const count = Math.max(2, Math.min(5, Math.floor(netH / 380)));
          const step = Math.max(160, Math.floor(netH / (count + 1) / 32) * 32);
          for (let s = 1; s <= count; s++) {
            shelves.push({
              id: `${baseMod.id}_b${bIdx}_sh_${s}`,
              bayIndex: bIdx,
              elevationY: Math.min(netH - 96, s * step),
              isAdjustable: s !== Math.ceil(count / 2),
            });
          }
        } else {
          const drwCount = netH >= 900 ? 3 : 2;
          const drwH = 192;
          for (let d = 0; d < drwCount; d++) {
            drawers.push({
              id: `${baseMod.id}_b${bIdx}_drw_${d}`,
              bayIndex: bIdx,
              elevationY: d * (drwH + 3),
              height: drwH,
              slideType: "soft_close",
              hardwareProductId: "hw_blum_legrabox_m40",
              frontMaterialId: doorMat,
            });
          }
          const coverY = drwCount * (drwH + 3) + 16;
          if (coverY < netH - 160) {
            shelves.push({
              id: `${baseMod.id}_b${bIdx}_sh_cov`,
              bayIndex: bIdx,
              elevationY: coverY,
              isAdjustable: false,
            });
          }
          if (topShelfY > coverY + 280) {
            shelves.push({
              id: `${baseMod.id}_b${bIdx}_sh_top`,
              bayIndex: bIdx,
              elevationY: topShelfY,
              isAdjustable: true,
            });
            hangingRails.push({
              id: `${baseMod.id}_b${bIdx}_rail_up`,
              bayIndex: bIdx,
              elevationY: Math.max(coverY + 180, topShelfY - 64),
            });
          }
        }

        nextBays.push({
          index: bIdx,
          shelves,
          drawers,
          hangingRails,
          specialFittings: [],
          subDividers: [],
          door: {
            id: `${baseMod.id}_door_${bIdx}`,
            bayIndex: bIdx,
            type: doorKind,
            doorSystemId: doorSys,
            openingTechnology: "soft_close",
            softClose: true,
            handleCategory: "bar_handle",
            doorMaterialId: doorMat,
          },
        });
      }
      baseMod.bays = nextBays;

      let nextModules: ModuleInstance[];
      let nextActiveIdx = 0;
      if (spec.replaceAll || curProj.modules.length === 0) {
        baseMod.position = { x: 0, y: 0, z: 0 };
        nextModules = [baseMod];
        nextActiveIdx = 0;
      } else {
        const curIdx = Math.min(state.activeModuleIndex, curProj.modules.length - 1);
        const prevMod = curProj.modules[curIdx];
        baseMod.position = prevMod ? { ...prevMod.position } : { x: 0, y: 0, z: 0 };
        baseMod.rotation = prevMod?.rotation ? { ...prevMod.rotation } : { x: 0, y: 0, z: 0 };
        nextModules = curProj.modules.map((m, idx) => (idx === curIdx ? baseMod : m));
        nextActiveIdx = curIdx;
      }

      commitAdapterState({
        project: {
          ...curProj,
          modules: nextModules,
        },
        activeModuleIndex: nextActiveIdx,
        activeBayIndex: 0,
        selectedComponentId: null,
        selectedModuleIds: [baseMod.id],
      });
    },
    []
  );


  const continuousKitchenLayers = useMemo(
    () => (isLite || isDraggingActive ? [] : getMemoizedContinuousKitchenLayers(project)),
    [isLite, isDraggingActive, project]
  );

  const exportCamZipBytes = useCallback(
    () => exportIndustrialCamZipArchive(project, bom),
    [project, bom]
  );
  const exportOptiCutCsvString = useCallback(() => {
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    return exportOptiCutCutListCsv(bom, matMap);
  }, [bom]);
  const exportHardwareBomCsvString = useCallback(
    () => exportHardwareBomCsv(bom),
    [bom]
  );
  const exportNestingSvgString = useCallback(
    () => generateNestingDiagramSvg(bom),
    [bom]
  );
  const exportThermalLabelsHtmlString = useCallback(() => {
    return generateThermalPartLabelsHtml(project, bom);
  }, [project, bom]);


  const addCustomMaterialToProject = useCallback(
    (matInput: {
      name: string;
      decorCode?: string;
      category: import("@birim/core").MaterialDefinition["category"];
      colorHex: string;
      roughness: number;
      costPerM2: number;
      textureUrl?: string;
      hasGrain?: boolean;
    }) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const newMat: import("@birim/core").MaterialDefinition = {
        id: `mat_custom_${Date.now()}`,
        name: matInput.name.trim() || "Özel Tasarım Yüzey",
        brand: "Birim Özel Koleksiyon",
        decorCode: matInput.decorCode?.trim() || "BRM-OZEL",
        category: matInput.category,
        thickness: 18,
        densityKgPerM3: 740,
        colorHex: matInput.colorHex || "#d6d1c7",
        roughness: matInput.roughness,
        metalness: matInput.category === "metal" ? 0.88 : 0.04,
        textureUrl: matInput.textureUrl,
        costPerM2: Math.max(5, Number(matInput.costPerM2) || 65),
        edgeBandCostPerM: 3.5,
        hasGrain: Boolean(matInput.hasGrain || matInput.textureUrl || matInput.category === "wood"),
      };
      registerRuntimeMaterial(newMat);
      try {
        if (typeof window !== "undefined") {
          const prev = JSON.parse(localStorage.getItem("birim_custom_materials_v5") || "[]");
          const nextArr = [newMat, ...(Array.isArray(prev) ? prev : [])].slice(0, 40);
          localStorage.setItem("birim_custom_materials_v5", JSON.stringify(nextArr));
        }
      } catch {
        // Ignore quota errors
      }
      const nextCustomMats = [newMat, ...(curProj.customMaterials || [])];
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        project: {
          ...curProj,
          customMaterials: nextCustomMats,
          updatedAt: new Date().toISOString(),
        },
      });
      return newMat;
    },
    []
  );

  const addCustomCapsuleModule = useCallback(
    (spec: {
      kind: "capsule_bar" | "capsule_tv_unit" | "rounded_tambour" | "capsule_table";
      name?: string;
      widthMm: number;
      heightMm: number;
      depthMm: number;
      cornerRadiusMm?: number;
      tambourSlatPitchMm?: number;
      bodyMaterialId?: string;
      topMaterialId?: string;
    }) => {
      const state = useConfiguratorStore.getState();
      const curProj = state.project;
      const id = `mod_cap_${Date.now()}`;
      const w = Math.max(700, Math.min(3600, Math.round(spec.widthMm)));
      const d = Math.max(340, Math.min(1300, Math.round(spec.depthMm)));
      const h = Math.max(360, Math.min(2400, Math.round(spec.heightMm)));
      const isTable = spec.kind === "capsule_table";
      const isRounded = spec.kind === "rounded_tambour";
      const isTvUnit = spec.kind === "capsule_tv_unit";
      const r = isRounded
        ? Math.max(65, Math.min(Math.floor(d / 2) - 20, Math.round(spec.cornerRadiusMm ?? 110)))
        : Math.max(65, Math.min(Math.floor(d / 2), Math.round(spec.cornerRadiusMm ?? d / 2)));

      const maxRightX = curProj.modules.reduce(
        (acc, m) => Math.max(acc, m.position.x + m.dimensions.width),
        0
      );

      const legH = isTable ? 0 : isTvUnit ? 160 : isRounded ? 150 : 180;
      const innerEstH = Math.max(160, h - legH - 56);
      const bodyMat = spec.bodyMaterialId || (isRounded ? "mat_veneer_oak" : "mat_veneer_walnut");

      const bays: import("@birim/core").BayConfig[] = isTable
        ? [
            {
              index: 0,
              door: {
                id: `door_${id}_0`,
                bayIndex: 0,
                type: "open",
                doorSystemId: "open",
                crossSectionProfile: "bevel_45",
                softClose: false,
              },
              shelves: [],
              hangingRails: [],
              drawers: [],
              specialFittings: [],
            },
          ]
        : isTvUnit
        ? [
            {
              index: 0,
              door: {
                id: `door_${id}_0`,
                bayIndex: 0,
                type: "tambour",
                doorSystemId: "tambour_roller",
                crossSectionProfile: "fluted_ribbed",
                softClose: true,
                handleCategory: "milled_wood_grip",
              },
              shelves: [{ id: `sh_${id}_0_0`, bayIndex: 0, elevationY: Math.round(innerEstH * 0.48), isAdjustable: true }],
              hangingRails: [],
              drawers: [],
              specialFittings: [],
            },
            {
              index: 1,
              door: {
                id: `door_${id}_1`,
                bayIndex: 1,
                type: "open",
                doorSystemId: "open",
                softClose: true,
              },
              shelves: [
                {
                  id: `sh_${id}_1_0`,
                  bayIndex: 1,
                  elevationY: Math.min(innerEstH - 60, Math.max(120, Math.round(innerEstH * 0.52))),
                  isAdjustable: false,
                  isFixed: true,
                },
              ],
              hangingRails: [],
              drawers: [
                {
                  id: `drw_${id}_1_0`,
                  bayIndex: 1,
                  elevationY: 0,
                  height: Math.min(200, Math.max(110, Math.round(innerEstH * 0.48))),
                  slideType: "push_to_open_soft_close",
                  hardwareProductId: "hw_blum_legrabox_m40",
                },
              ],
              specialFittings: [],
            },
            {
              index: 2,
              door: {
                id: `door_${id}_2`,
                bayIndex: 2,
                type: "tambour",
                doorSystemId: "tambour_roller",
                crossSectionProfile: "fluted_ribbed",
                softClose: true,
                handleCategory: "milled_wood_grip",
              },
              shelves: [{ id: `sh_${id}_2_0`, bayIndex: 2, elevationY: Math.round(innerEstH * 0.48), isAdjustable: true }],
              hangingRails: [],
              drawers: [],
              specialFittings: [],
            },
          ]
        : [
            {
              index: 0,
              door: {
                id: `door_${id}_0`,
                bayIndex: 0,
                type: "tambour",
                doorSystemId: "tambour_roller",
                crossSectionProfile: "fluted_ribbed",
                softClose: true,
                handleCategory: "milled_wood_grip",
              },
              shelves:
                innerEstH >= 480
                  ? [
                      { id: `sh_${id}_0_0`, bayIndex: 0, elevationY: Math.round(innerEstH * 0.36), isAdjustable: true },
                      { id: `sh_${id}_0_1`, bayIndex: 0, elevationY: Math.round(innerEstH * 0.68), isAdjustable: true, isGlass: !isRounded },
                    ]
                  : [{ id: `sh_${id}_0_0`, bayIndex: 0, elevationY: Math.round(innerEstH * 0.48), isAdjustable: true }],
              hangingRails: [],
              drawers: [],
              specialFittings: [],
            },
          ];

      const newMod: import("@birim/core").ModuleInstance = {
        id,
        name:
          spec.name?.trim() ||
          (isTable
            ? "Birim Kapsül Tasarım Masa"
            : isTvUnit
            ? "Birim Kapsül Tambur TV Ünitesi"
            : isRounded
            ? "Birim R-Köşeli Tambur Konsol"
            : "Birim Kapsül Tamburlu Bar Dolabı"),
        category: isTable ? "kitchen_island" : "wardrobe",
        moduleFamilyId: isTable ? "fam_kitchen_base" : "fam_wardrobe",
        templateId: isTable
          ? "v5_capsule_dining_table_220"
          : isTvUnit
          ? "v5_capsule_tambour_tv_unit_220"
          : isRounded
          ? "v5_rounded_tambour_tv_console_200"
          : "v5_capsule_bar_cabinet_120",
        position: isTable
          ? { x: Math.max(200, Math.round(maxRightX * 0.25)), y: 0, z: 1250 }
          : { x: maxRightX > 0 ? maxRightX + 60 : 0, y: 0, z: 20 },
        dimensions: { width: w, height: h, depth: d },
        isOpenFront: isTable,
        utilityCutouts: isTvUnit
          ? [
              {
                id: `cutout_tv_cable_${id}`,
                targetPanel: "back",
                kind: "cable_grommet",
                shape: "rect",
                centerXMm: Math.round((w - 2 * r) / 2),
                centerYMm: Math.round(innerEstH * 0.65),
                widthMm: 180,
                heightMm: 65,
                label: "Orta Medya & HDMI Kablo Geçiş Menfezi",
              },
            ]
          : undefined,
        carcass: {
          panelThickness: 18,
          backPanelThickness: 8,
          backPanelType: isTable ? "none" : "grooved",
          hullShape: isTable ? "capsule_table" : isRounded ? "rounded_corners" : "capsule_stadium",
          cornerRadiusMm: r,
          tambourSlatPitchMm: spec.tambourSlatPitchMm || 22,
          tambourDirection: "horizontal",
          hasCountertopTray: !isTable && Boolean(spec.topMaterialId),
          plinthHeight: legH,
          doorPerimeterGap: 2,
          edgeBandThickness: isTable ? 2 : 1,
          bodyMaterialId: bodyMat,
          doorMaterialId: bodyMat,
          countertopMaterialId:
            spec.topMaterialId || (isTable ? bodyMat : isRounded ? undefined : "mat_quartz_calacatta"),
          plinthMaterialId: isRounded ? "mat_handle_matte_black" : "mat_metal_brass",
          crossSectionProfile: isTable ? "bevel_45" : "fluted_ribbed",
          jointType: isTable ? "miter_45" : "minifix_dowel",
          ledLightingEnabled: !isTable && !isRounded,
          ledColorTempK: 2700,
          ledPlacementMode: "shelf_underside",
        },
        bays,
      };

      const nextModules = [...curProj.modules, newMod];
      commitAdapterState({
        history: [...state.history.slice(-50), curProj],
        future: [],
        activeModuleIndex: nextModules.length - 1,
        project: {
          ...curProj,
          modules: nextModules,
          updatedAt: new Date().toISOString(),
        },
      });
      return newMod;
    },
    []
  );

  return {
    computeWallAndModuleClearances,
    activeSpatialMetrics,
    alignActiveModuleOnWall,
    distributeModulesWithGap,
    applyRoomShapePreset,
    setAllWallsSettings,
    activeBlumEngineering,
    exportBlumBxfString,
    importBlumBxfFile,
    applyBlumQuickWizardPreset,
    exportAllPanelsDxfString,
    exportNestingDxfString,
    exportErpNestingBundle,
    exportErpNestingJsonString,
    exportErpSelcoCsvString,
    exportErpGCodeString,
    setModuleUtilityCutouts,
    autoResolveCornerCollisions,
    applyQuickCabinetAtomic,
    continuousKitchenLayers,
    exportCamZipBytes,
    exportOptiCutCsvString,
    exportHardwareBomCsvString,
    exportNestingSvgString,
    exportThermalLabelsHtmlString,
    addCustomMaterialToProject,
    addCustomCapsuleModule,
  };
}
