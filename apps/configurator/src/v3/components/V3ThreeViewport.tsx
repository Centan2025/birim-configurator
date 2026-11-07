"use client";

import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import * as THREE from "three";
import {
  createComponentMesh,
  publishSceneDiagnostics,
  createModuleGroup,
} from "../../components/componentMesh";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  useV3Adapter,
  generateModuleGeometry,
  DEFAULT_MATERIALS,
  getModuleOrientedFootprint,
  getActiveDraggedTemplateId,
  setActiveDraggedTemplateId,
  computeRowSnapPreview,
} from "../adapter/useV3Adapter";
import { calculateFourSpaceDimensions, calculateNetInnerHeight, calculateBayWidths } from "@birim/core";
import {
  computeElevationSnapTargets,
  resolveElevationSnap,
  findDraggableInteriorComponent,
  type ElevationSnapTarget,
} from "../engine/elevationSnapEngine";
import {
  getV3PbrMaterial,
  getStudioEnvironmentTexture,
  getStudioPmremEnvironment,
  getArchitecturalFloorTexture,
  type ArchitecturalFloorStyle,
} from "../materials/pbrMaterialSystem";
import { Plus, Layers, RotateCw, Columns, Ruler } from "lucide-react";


let cachedContactAoTex: THREE.CanvasTexture | null = null;
function getContactAoShadowTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (cachedContactAoTex) return cachedContactAoTex;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(128, 128, 14, 128, 128, 124);
  grad.addColorStop(0, "rgba(12, 10, 9, 0.68)");
  grad.addColorStop(0.42, "rgba(20, 18, 15, 0.38)");
  grad.addColorStop(0.75, "rgba(28, 25, 23, 0.14)");
  grad.addColorStop(1, "rgba(28, 25, 23, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cachedContactAoTex = tex;
  return tex;
}

const ghostLockedMat = new THREE.MeshBasicMaterial({
  color: 0x10b981,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});
const ghostFreeMat = new THREE.MeshBasicMaterial({
  color: 0x0ea5e9,
  transparent: true,
  opacity: 0.26,
  depthWrite: false,
});
const ghostLockedEdgeMat = new THREE.LineBasicMaterial({
  color: 0x047857,
  transparent: true,
  opacity: 0.95,
});
const ghostFreeEdgeMat = new THREE.LineBasicMaterial({
  color: 0x0369a1,
  transparent: true,
  opacity: 0.92,
});
const snapSlotActiveRodMat = new THREE.MeshBasicMaterial({
  color: 0x10b981,
  transparent: true,
  opacity: 0.95,
  depthTest: false,
});
const snapSlotIdleRodMat = new THREE.MeshBasicMaterial({
  color: 0xf59e0b,
  transparent: true,
  opacity: 0.78,
  depthTest: false,
});

const v3EdgeCache = new Map<string, THREE.LineBasicMaterial>();

const cadTechnicalMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});
const cadSelectedMat = new THREE.MeshBasicMaterial({
  color: 0xdbeafe,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});
const hoverHighlightEdgeMat = new THREE.LineBasicMaterial({
  color: 0x0284c7,
  linewidth: 2,
  opacity: 1,
  transparent: false,
});

function getCachedEdgeMaterial(
  isSelected: boolean,
  isActiveMod: boolean,
  isLightTheme: boolean,
  isPhotoreal = true
): THREE.LineBasicMaterial {
  const key = `sel:${isSelected ? 1 : 0}_act:${isActiveMod ? 1 : 0}_light:${isLightTheme ? 1 : 0}_pr:${isPhotoreal ? 1 : 0}`;
  let m = v3EdgeCache.get(key);
  if (!m) {
    m = new THREE.LineBasicMaterial({
      color: isSelected
        ? 0x2563eb
        : !isPhotoreal
        ? 0x0f172a
        : isActiveMod
        ? 0x0f172a
        : isLightTheme
        ? 0x334155
        : 0x94a3b8,
      linewidth: isPhotoreal ? 1 : 2,
      opacity: isSelected
        ? 1.0
        : !isPhotoreal
        ? 1.0
        : isActiveMod
        ? 0.68
        : 0.44,
      transparent: isPhotoreal && !isSelected,
    });
    v3EdgeCache.set(key, m);
  }
  return m;
}

/**
 * Collects ONLY solid clickable THREE.Mesh instances that belong to a cabinet component,
 * excluding LineSegments, AO shadow planes, and bounding boxes so 3D raycasting is 100% accurate.
 */
function collectSolidCabinetMeshes(
  rootGroup: THREE.Object3D,
  includeBayVolumes: boolean
): THREE.Mesh[] {
  const solidMeshes: THREE.Mesh[] = [];
  const bayMeshes: THREE.Mesh[] = [];
  rootGroup.traverse((obj) => {
    if (
      obj instanceof THREE.Mesh &&
      obj.visible &&
      obj.userData &&
      typeof obj.userData.componentId === "string"
    ) {
      if (obj.userData.role === "bay_compartment") {
        if (includeBayVolumes) bayMeshes.push(obj);
      } else {
        solidMeshes.push(obj);
      }
    }
  });
  return [...solidMeshes, ...bayMeshes];
}

interface DimensionAnchor {
  id: string;
  tag: string;
  valueText: string;
  borderColor: string;
  badgeBg: string;
  localMidpoint: THREE.Vector3;
}

function add3DRod(
  group: THREE.Group,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  mat: THREE.Material
) {
  const diff = new THREE.Vector3().subVectors(end, start);
  const len = diff.length();
  if (len < 1) return;
  const geom = new THREE.CylinderGeometry(radius, radius, len, 8);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.clone().normalize());
  mesh.renderOrder = 998;
  group.add(mesh);
}

function add3DArrowCone(
  group: THREE.Group,
  tip: THREE.Vector3,
  dirTowardTip: THREE.Vector3,
  mat: THREE.Material
) {
  const coneH = 34;
  const coneR = 12;
  const geom = new THREE.ConeGeometry(coneR, coneH, 10);
  const mesh = new THREE.Mesh(geom, mat);
  const norm = dirTowardTip.clone().normalize();
  mesh.position.copy(tip).addScaledVector(norm, -coneH * 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
  mesh.renderOrder = 999;
  group.add(mesh);
}

function addDimensionSegment(
  group: THREE.Group,
  anchors: DimensionAnchor[],
  id: string,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  extDir: THREE.Vector3,
  extLen: number,
  tag: string,
  valueText: string,
  colorHex: number,
  borderColor: string,
  badgeBg: string
) {
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.95,
    toneMapped: false,
  });

  const d1 = p1.clone().addScaledVector(extDir, extLen);
  const d2 = p2.clone().addScaledVector(extDir, extLen);
  const tickOver = 24;

  // Main thick dimension rod + arrowheads
  add3DRod(group, d1, d2, 4.5, mat);
  const segDir = new THREE.Vector3().subVectors(d2, d1);
  if (segDir.length() > 90) {
    add3DArrowCone(group, d1, segDir.clone().negate(), mat);
    add3DArrowCone(group, d2, segDir, mat);
  }

  // Extension rods
  add3DRod(
    group,
    p1.clone().addScaledVector(extDir, 12),
    d1.clone().addScaledVector(extDir, tickOver),
    3,
    mat
  );
  add3DRod(
    group,
    p2.clone().addScaledVector(extDir, 12),
    d2.clone().addScaledVector(extDir, tickOver),
    3,
    mat
  );

  const mid = d1.clone().add(d2).multiplyScalar(0.5).addScaledVector(extDir, 28);
  anchors.push({
    id,
    tag,
    valueText,
    borderColor,
    badgeBg,
    localMidpoint: mid,
  });
}

export interface V3ThreeViewportProps {
  theme?: "warm-light" | "showroom-neutral" | "dark";
  showGrid?: boolean;
  showInCanvasHud?: boolean;
  showDimensions?: boolean;
  onToggleDimensions?: () => void;
  onPerformanceSample?: (metrics: { lastRenderMs: number }) => void;
}

export const V3ThreeViewport: React.FC<V3ThreeViewportProps> = React.memo(
  ({
    theme = "warm-light",
    showGrid = true,
    showInCanvasHud = true,
    showDimensions,
    onToggleDimensions,
    onPerformanceSample,
  }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const {
      project,
      activeModule,
      activeModuleIndex,
      activeBay,
      activeBayIndex,
      doorOpenAngleDeg,
      setDoorOpenAngleDeg,
      toggleDoorOpen,
      drawerOpenMm,
      setDrawerOpenMm,
      explodedFactor,
      isOrthographic,
      cameraPreset,
      selectedComponentId,
      setSelectedComponentId,
      v4ModuleTemplates,
      hardwareCatalog,
      spaceObstacles,
      spaceWalls,
      setActiveModuleIndex,
      setActiveBayIndex,
      setDimensions,
      setPlinthHeight,
      setBayDoorType,
      setBayV4DoorConfig,
      copyDoorConfigToAllBays,
      setSelectedComponentMaterial,
      applyMaterialByTargetScope,
      resetModuleMaterialOverrides,
      setDoorCrossSectionProfile,
      setShelfElevation,
      setDrawerPlacement,
      setSpecialFittingPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
      setBayCount,
      addShelf,
      addDrawer,
      addHangingRail,
      addSpecialFitting,
      addSubDivider,
      applyBayInteriorPreset,
      removeBayAt,
      addAdjacentModule,
      rotateActiveModule90,
      flipActiveDoorDirection,
      setModulePosition,
      swapModuleWithNeighbor,
      finishModuleDragWithSmartSwap,
      updateObstaclePosition,
      beginHistoryTransaction,
      commitHistoryTransaction,
      addInteriorItemAtElevation,
      dropV4TemplateWithSnap,
    } = useV3Adapter();

    const [editingBadge, setEditingBadge] = useState<null | "W" | "H" | "D" | "SOKET">(null);
    const [badgeDraftValue, setBadgeDraftValue] = useState<string>("");
    const [doorsHiddenIn3D, setDoorsHiddenIn3D] = useState<boolean>(false);
    const [cutawayActiveBay, setCutawayActiveBay] = useState<boolean>(false);
    const bayPopoverDomRef = useRef<HTMLDivElement | null>(null);
    const activeBayWorldAnchorRef = useRef<THREE.Vector3 | null>(null);
    const doorPopoverDomRef = useRef<HTMLDivElement | null>(null);
    const activeDoorWorldAnchorRef = useRef<THREE.Vector3 | null>(null);
    const [doorMenuSubSection, setDoorMenuSubSection] = useState<
      null | "type" | "direction" | "handle" | "material"
    >(null);
    const [bayMenuSubSection, setBayMenuSubSection] = useState<
      null | "accessories" | "templates"
    >(null);
    const [clicked3DContext, setClicked3DContext] = useState<null | {
      kind: "door" | "bay";
      bayIndex: number;
      role: string;
      componentId?: string;
      label: string;
    }>(null);
    const [localShowDimensions, setLocalShowDimensions] = useState<boolean>(true);
    const [showRoomArchitecture3D, setShowRoomArchitecture3D] = useState<boolean>(true);
    const [lightingPreset, setLightingPreset] = useState<"daylight" | "showroom_warm" | "night_led">(
      "daylight"
    );
    const [floorStyle, setFloorStyle] = useState<ArchitecturalFloorStyle>("oak_parquet");
    const [activeCamPill, setActiveCamPill] = useState<"3d" | "2d" | "front" | "side" | "top" | "interior">("3d");
    const [renderMenuOpen, setRenderMenuOpen] = useState<boolean>(false);
    useEffect(() => {
      const onFloorChange = (ev: Event) => {
        const customEv = ev as CustomEvent<ArchitecturalFloorStyle>;
        if (customEv.detail) setFloorStyle(customEv.detail);
      };
      const onDoorsHiddenChange = (ev: Event) => {
        const customEv = ev as CustomEvent<boolean | "toggle">;
        if (customEv.detail === "toggle") {
          setDoorsHiddenIn3D((prev) => !prev);
        } else if (typeof customEv.detail === "boolean") {
          setDoorsHiddenIn3D(customEv.detail);
        }
      };
      const onHwViewModeChange = (ev: Event) => {
        const customEv = ev as CustomEvent<"normal" | "hardware" | "technical">;
        if (customEv.detail) {
          setHardwareViewMode(customEv.detail);
          if (customEv.detail === "technical") {
            setRenderEdgeMode("cad");
          } else if (customEv.detail === "normal") {
            setRenderEdgeMode("photoreal");
          }
        }
      };
      const onMatModeChange = (ev: Event) => {
        const customEv = ev as CustomEvent<{ active: boolean; brushMaterialId?: string }>;
        if (customEv.detail) {
          setMaterialModeActive(Boolean(customEv.detail.active));
          if (customEv.detail.brushMaterialId) {
            setActiveBrushMaterialId(customEv.detail.brushMaterialId);
          }
        }
      };
      const onBrushMatChange = (ev: Event) => {
        const customEv = ev as CustomEvent<string>;
        if (customEv.detail) {
          setActiveBrushMaterialId(customEv.detail);
        }
      };
      window.addEventListener("birim:set-floor-style", onFloorChange);
      window.addEventListener("birim:set-doors-hidden", onDoorsHiddenChange);
      window.addEventListener("birim:set-hardware-view-mode", onHwViewModeChange);
      window.addEventListener("birim:set-material-mode", onMatModeChange);
      window.addEventListener("birim:set-brush-material", onBrushMatChange);
      return () => {
        window.removeEventListener("birim:set-floor-style", onFloorChange);
        window.removeEventListener("birim:set-doors-hidden", onDoorsHiddenChange);
        window.removeEventListener("birim:set-hardware-view-mode", onHwViewModeChange);
        window.removeEventListener("birim:set-material-mode", onMatModeChange);
        window.removeEventListener("birim:set-brush-material", onBrushMatChange);
      };
    }, []);
    const [materialModeActive, setMaterialModeActive] = useState<boolean>(false);
    const [materialPaintTool, setMaterialPaintTool] = useState<
      "select" | "paint" | "group" | "same_material"
    >("select");
    const [activeBrushMaterialId, setActiveBrushMaterialId] = useState<string>("mat_veneer_oak");
    const matWorldAnchorsRef = useRef<
      { id: string; worldPos: THREE.Vector3; offsetPx: [number, number] }[]
    >([]);
    const matCalloutDomMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const [hardwareViewMode, setHardwareViewMode] = useState<"normal" | "hardware" | "technical">("normal");
    const [hardwareViewMenuOpen, setHardwareViewMenuOpen] = useState<boolean>(false);
    const [selectedHwCalloutId, setSelectedHwCalloutId] = useState<string | null>(null);
    const hwWorldAnchorsRef = useRef<
      { id: string; worldPos: THREE.Vector3; offsetPx: [number, number] }[]
    >([]);
    const hwCalloutDomMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const [renderEdgeMode, setRenderEdgeMode] = useState<"photoreal" | "cad">("photoreal");
    const [moveObjectMode3D, setMoveObjectMode3D] = useState<boolean>(true);
    const [invertCameraMouse, setInvertCameraMouse] = useState<boolean>(true);
    const [active3DSnap, setActive3DSnap] = useState<ElevationSnapTarget | null>(null);
    const roomArchGroupRef = useRef<THREE.Group | null>(null);
    const [dragDropSnapBanner, setDragDropSnapBanner] = useState<string | null>(null);
    const [hovered3DObjectLabel, setHovered3DObjectLabel] = useState<string | null>(null);
    const [dismissedBayPopover, setDismissedBayPopover] = useState<boolean>(false);

    useEffect(() => {
      setDismissedBayPopover(false);
    }, [activeBayIndex, activeModuleIndex, doorsHiddenIn3D]);

    useEffect(() => {
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          setClicked3DContext(null);
          setEditingBadge(null);
          setRenderMenuOpen(false);
          setHardwareViewMenuOpen(false);
          setDismissedBayPopover(true);
          setDragDropSnapBanner(null);
        }
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, []);
    const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
    const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
    const rimLightRef = useRef<THREE.DirectionalLight | null>(null);

    const latestStateRef = useRef({
      project,
      activeModuleIndex,
      selectedComponentId,
      doorOpenAngleDeg,
      doorsHiddenIn3D,
      moveObjectMode3D,
      spaceObstacles,
      setActiveModuleIndex,
      setActiveBayIndex,
      setSelectedComponentId,
      setShelfElevation,
      setDrawerPlacement,
      setSpecialFittingPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
      setModulePosition,
      finishModuleDragWithSmartSwap,
      updateObstaclePosition,
      beginHistoryTransaction,
      commitHistoryTransaction,
    });
    useEffect(() => {
      latestStateRef.current = {
        project,
        activeModuleIndex,
        doorOpenAngleDeg,
        doorsHiddenIn3D,
        moveObjectMode3D,
        spaceObstacles,
        setActiveModuleIndex,
        setActiveBayIndex,
        setSelectedComponentId,
        setShelfElevation,
        setDrawerPlacement,
        setSpecialFittingPlacement,
        setHangingRailElevation,
        setBayCustomWidth,
        setSubDividerPlacement,
        setModulePosition,
        finishModuleDragWithSmartSwap,
        updateObstaclePosition,
        beginHistoryTransaction,
        commitHistoryTransaction,
      };
    }, [
      project,
      activeModuleIndex,
      selectedComponentId,
      doorOpenAngleDeg,
      doorsHiddenIn3D,
      moveObjectMode3D,
      spaceObstacles,
      setActiveModuleIndex,
      setActiveBayIndex,
      setSelectedComponentId,
      setShelfElevation,
      setDrawerPlacement,
      setSpecialFittingPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
      setModulePosition,
      finishModuleDragWithSmartSwap,
      updateObstaclePosition,
      beginHistoryTransaction,
      commitHistoryTransaction,
    ]);

    // Sync OrbitControls mouse direction (Natural object rotation vs standard camera orbit)
    useEffect(() => {
      if (controlsRef.current) {
        controlsRef.current.rotateSpeed = invertCameraMouse ? -0.85 : 0.9;
      }
    }, [invertCameraMouse]);

    const effectiveShowDimensions = showDimensions ?? localShowDimensions;
    const handleToggleDimensions = useCallback(() => {
      if (onToggleDimensions) {
        onToggleDimensions();
      } else {
        setLocalShowDimensions((prev) => !prev);
      }
    }, [onToggleDimensions]);

    const dimLabels = useMemo<DimensionAnchor[]>(() => {
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!effectiveShowDimensions || !mod) return [];
      const { width: W, height: H, depth: D } = mod.dimensions;
      const T = mod.carcass.panelThickness || 18;
      const soketW = Math.max(200, W - 2 * T);
      const list: DimensionAnchor[] = [
        {
          id: "dim_W",
          tag: "Genişlik",
          valueText: `${W} mm`,
          borderColor: "#CBD5E1",
          badgeBg: "#2B2927",
          localMidpoint: new THREE.Vector3(W * 0.5, H + 105, D * 0.65),
        },
        {
          id: "dim_H",
          tag: "Yükseklik",
          valueText: `${H} mm`,
          borderColor: "#BFDBFE",
          badgeBg: "#2563EB",
          localMidpoint: new THREE.Vector3(W + 115, H * 0.52, D),
        },
        {
          id: "dim_D",
          tag: "Derinlik",
          valueText: `${D} mm`,
          borderColor: "#BBF7D0",
          badgeBg: "#16A34A",
          localMidpoint: new THREE.Vector3(W + 125, 18, D * 0.5),
        },
        {
          id: "dim_SOKET",
          tag: "Soket",
          valueText: `${soketW} mm`,
          borderColor: "#CBD5E1",
          badgeBg: "#2B2927",
          localMidpoint: new THREE.Vector3(W * 0.5, 8, D + 115),
        },
      ];

      if (mod.category !== "complementary" && mod.bays.length >= 1) {
        const fs = calculateFourSpaceDimensions(mod);
        const bayWidths = fs.usableInternal.bayClearWidthsMm;
        let curX = T;
        mod.bays.forEach((b, bIdx) => {
          const bw = bayWidths[bIdx] || Math.round((W - (mod.bays.length + 1) * T) / mod.bays.length);
          const midX = curX + bw * 0.5;
          list.push({
            id: `dim_BAY_${bIdx}`,
            tag: `Bölme ${bIdx + 1}`,
            valueText: `${bw} mm`,
            borderColor: "#93C5FD",
            badgeBg: "#2563EB",
            localMidpoint: new THREE.Vector3(midX, H + 28, D * 0.92),
          });
          curX += bw + T;
        });
      }

      const mainMods = project.modules.filter((m) => m.category !== "complementary");
      if (mainMods.length > 1) {
        const minX = Math.min(...mainMods.map((m) => m.position.x));
        const maxX = Math.max(...mainMods.map((m) => m.position.x + m.dimensions.width));
        const maxH = Math.max(...mainMods.map((m) => m.position.y + m.dimensions.height));
        list.push({
          id: "dim_TOTAL_SPAN",
          tag: "Toplam Genişlik",
          valueText: `${Math.round(maxX - minX)} mm`,
          borderColor: "#CBD5E1",
          badgeBg: "#2B2927",
          localMidpoint: new THREE.Vector3((minX + maxX) * 0.5, maxH + 260, 300),
        });
      }

      return list;
    }, [project, activeModuleIndex, effectiveShowDimensions]);

    const hwCallouts = useMemo(() => {
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!mod || mod.category === "complementary") return [];
      const { width: W, height: H, depth: D } = mod.dimensions;
      const T = mod.carcass.panelThickness || 18;
      const plinthH = mod.carcass.plinthHeight ?? 100;
      const fs = calculateFourSpaceDimensions(mod);
      const bayWidths = fs.usableInternal.bayClearWidthsMm;

      const bayStartXs: number[] = [];
      let accX = T;
      mod.bays.forEach((_, idx) => {
        bayStartXs.push(accX);
        accX += (bayWidths[idx] || 550) + T;
      });

      const targetBayIdx = Math.min(activeBayIndex, Math.max(0, mod.bays.length - 1));
      const targetBay = mod.bays[targetBayIdx] || mod.bays[0];
      const dSys = targetBay?.door?.doorSystemId || "hinged_single";
      const doorHwId = targetBay?.door?.hardwareProductId || "hw_blum_71b3550";
      const doorHw = hardwareCatalog.find((h) => h.id === doorHwId);

      // 1. Hinge / Door Mechanism Callout
      const hingeLeaveSpec = fs.doorLeaves[0] || fs.doorLeaves[targetBayIdx];
      const topHingeY =
        hingeLeaveSpec?.hingePositionsY?.[hingeLeaveSpec.hingePositionsY.length - 1] ||
        Math.round((H - plinthH - 2 * T) * 0.76);
      const hingeTitle = dSys.startsWith("hinged") ? "Menteşe" : "Açılma Sistemi";
      const hingeSub = doorHw
        ? doorHw.id === "hw_blum_71b3550"
          ? "Blum Clip-Top 110°"
          : doorHw.id === "hw_blum_71b7550"
          ? "Blum Clip-Top 155°"
          : doorHw.id === "hw_hettich_9071205"
          ? "Hettich Sensys 110°"
          : doorHw.id === "hw_salice_c7p6ae9"
          ? "Salice Silentia+ 110°"
          : `${doorHw.manufacturerName.split(" ")[0]} • ${doorHw.sku}`
        : "Blum Clip-Top 110°";

      // 2. LED Lighting Callout
      const hasLed = mod.bays.some((b) =>
        (b.specialFittings || []).some((f) => f.type.startsWith("led_"))
      );
      const ledKelvin = mod.carcass.ledColorTempK || 3000;
      const midBayIdx = Math.min(Math.floor(mod.bays.length / 2), mod.bays.length - 1);
      const midBayCenterX =
        (bayStartXs[midBayIdx] || T) + (bayWidths[midBayIdx] || 550) * 0.5;

      // 3. Hanging Rail / Interior Mechanism Callout
      const railBayIdx =
        mod.bays.findIndex((b) => b.hangingRails.length > 0) >= 0
          ? mod.bays.findIndex((b) => b.hangingRails.length > 0)
          : targetBayIdx;
      const railObj = mod.bays[railBayIdx]?.hangingRails?.[0];
      const hasWardrobeLift = mod.bays.some((b) =>
        (b.specialFittings || []).some((f) => f.type === "wardrobe_lift")
      );
      const railElevY = railObj?.elevationY || Math.round((H - plinthH - 2 * T) * 0.78);
      const railCenterX =
        (bayStartXs[railBayIdx] || T) + (bayWidths[railBayIdx] || 550) * 0.58;

      // 4. Drawer Runner Callout
      const drwBayIdx =
        mod.bays.findIndex((b) => b.drawers.length > 0) >= 0
          ? mod.bays.findIndex((b) => b.drawers.length > 0)
          : mod.bays.length - 1;
      const firstDrw = mod.bays[drwBayIdx]?.drawers?.[0];
      const drwHwId = firstDrw?.hardwareProductId || "hw_blum_tandembox_m30";
      const drwHw = hardwareCatalog.find((h) => h.id === drwHwId);
      const drwNl =
        firstDrw?.nominalLengthMm ||
        Math.min(550, Math.max(350, Math.floor((fs.usableInternal.netInnerDepthMm - 10) / 50) * 50));
      const runnerSub = drwHw
        ? drwHw.id.includes("tandembox")
          ? `Blum Tandem ${drwNl} mm`
          : drwHw.id.includes("movento")
          ? `Blum Movento ${drwNl} mm`
          : drwHw.id.includes("hettich")
          ? `Hettich AvanTech ${drwNl} mm`
          : `Blum LEGRABOX ${drwNl} mm`
        : `Blum Tandem ${drwNl} mm`;
      const drwElevY = firstDrw ? firstDrw.elevationY + firstDrw.height * 0.5 : 180;
      const drwPinX = (bayStartXs[drwBayIdx] || T) + 24;

      const hasDoor =
        !mod.isOpenFront &&
        targetBay?.door &&
        targetBay.door.type !== "open" &&
        targetBay.door.doorSystemId !== "open";
      const hasAnyRail =
        Boolean(railObj) ||
        hasWardrobeLift ||
        mod.bays.some((b) => b.hangingRails && b.hangingRails.length > 0);
      const hasAnyDrawer =
        Boolean(firstDrw) ||
        mod.bays.some((b) => b.drawers && b.drawers.length > 0);

      const activeCallouts: {
        id: string;
        group: "hinge" | "lighting" | "accessories" | "runner";
        bayIndex: number;
        title: string;
        subtitle: string;
        sku: string;
        localPos: THREE.Vector3;
        offsetPx: [number, number];
      }[] = [];

      if (hasDoor) {
        activeCallouts.push({
          id: "hw_pin_hinge",
          group: "hinge",
          bayIndex: targetBayIdx,
          title: hingeTitle,
          subtitle: hingeSub,
          sku: doorHw?.sku || "71B3550",
          localPos: new THREE.Vector3(T + 12, plinthH + T + topHingeY, D + 14),
          offsetPx: [-24, -44],
        });
      }

      if (hasLed) {
        activeCallouts.push({
          id: "hw_pin_led",
          group: "lighting",
          bayIndex: midBayIdx,
          title: "LED Aydınlatma",
          subtitle: `Profil – ${ledKelvin}K`,
          sku: "833.74.700",
          localPos: new THREE.Vector3(midBayCenterX, H - T - 14, D * 0.82),
          offsetPx: [42, -38],
        });
      }

      if (hasAnyRail) {
        activeCallouts.push({
          id: "hw_pin_rail",
          group: "accessories",
          bayIndex: railBayIdx,
          title: "Askılık",
          subtitle: hasWardrobeLift ? "Servetto Asansör 10kg" : "Oval – Krom",
          sku: hasWardrobeLift ? "805.20.232" : "HW_HANGING_RAIL",
          localPos: new THREE.Vector3(railCenterX, plinthH + T + railElevY, D * 0.62),
          offsetPx: [52, 22],
        });
      }

      if (hasAnyDrawer) {
        activeCallouts.push({
          id: "hw_pin_runner",
          group: "runner",
          bayIndex: drwBayIdx,
          title: "Çekmece Rayı",
          subtitle: runnerSub,
          sku: drwHw?.sku || "578.5001M",
          localPos: new THREE.Vector3(drwPinX, plinthH + T + drwElevY, D * 0.88),
          offsetPx: [48, -32],
        });
      }

      return activeCallouts;
    }, [project, activeModuleIndex, activeBayIndex, hardwareCatalog]);

    const matCallouts = useMemo(() => {
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!mod || mod.category === "complementary") return [];
      const { width: W, height: H, depth: D } = mod.dimensions;
      const T = mod.carcass.panelThickness || 18;
      const plinthH = mod.carcass.plinthHeight ?? 100;
      const overrides = mod.componentMaterialOverrides || {};

      const formatShortMat = (matId?: string) => {
        const m = DEFAULT_MATERIALS.find((it) => it.id === matId) || DEFAULT_MATERIALS[0];
        const shortName = m.name
          .replace(/^Kastamonu Entegre\s+/i, "")
          .replace(/^Yıldız Entegre\s+/i, "")
          .replace(/^Çamsan Entegre\s+/i, "")
          .replace(/^AGT\s+/i, "")
          .split(" (")[0];
        return {
          label: shortName,
          colorHex: m.colorHex,
          matId: m.id,
        };
      };

      const topCompId = `${mod.id}_top`;
      const topMat = formatShortMat(overrides[topCompId] || mod.carcass.bodyMaterialId);

      const firstBay = mod.bays[0];
      const doorCompId = `${firstBay?.door?.id || `${mod.id}_door_0`}_${
        firstBay?.door?.type === "double" ? "leaf_left" : "left"
      }`;
      const doorMat = formatShortMat(
        overrides[doorCompId] || firstBay?.door?.doorMaterialId || mod.carcass.doorMaterialId
      );

      const rightSideCompId = `${mod.id}_side_right`;
      const rightSideMat = formatShortMat(overrides[rightSideCompId] || mod.carcass.bodyMaterialId);

      const drwBay = mod.bays.find((b) => b.drawers.length > 0) || firstBay;
      const firstDrw = drwBay?.drawers?.[0];
      const drwFrontId = firstDrw ? `${firstDrw.id}_front` : `${mod.id}_drw_0_front`;
      const drwMat = formatShortMat(
        overrides[drwFrontId] || firstDrw?.frontMaterialId || mod.carcass.doorMaterialId
      );

      const plinthCompId = `${mod.id}_plinth`;
      const plinthMat = formatShortMat(
        overrides[plinthCompId] ||
          overrides.__plinth__ ||
          mod.carcass.plinthMaterialId ||
          mod.carcass.bodyMaterialId
      );

      return [
        {
          id: "mat_pin_top",
          scope: "carcass" as const,
          componentId: topCompId,
          title: "Üst Tabla",
          subtitle: topMat.label,
          colorHex: topMat.colorHex,
          localPos: new THREE.Vector3(W * 0.45, H - T * 0.5, D * 0.85),
          offsetPx: [-10, -48] as [number, number],
        },
        {
          id: "mat_pin_door",
          scope: "doors" as const,
          componentId: doorCompId,
          title: "Kapak",
          subtitle: doorMat.label,
          colorHex: doorMat.colorHex,
          localPos: new THREE.Vector3(W * 0.24, H * 0.65, D + 18),
          offsetPx: [-24, -46] as [number, number],
        },
        {
          id: "mat_pin_side_right",
          scope: "selected_part" as const,
          componentId: rightSideCompId,
          title: "Sağ Yan Panel",
          subtitle: rightSideMat.label,
          colorHex: rightSideMat.colorHex,
          localPos: new THREE.Vector3(W, H * 0.45, D * 0.55),
          offsetPx: [18, -36] as [number, number],
        },
        {
          id: "mat_pin_drawer",
          scope: "drawers" as const,
          componentId: drwFrontId,
          title: "Çekmece Önü",
          subtitle: drwMat.label,
          colorHex: drwMat.colorHex,
          localPos: new THREE.Vector3(W * 0.42, plinthH + 140, D + 18),
          offsetPx: [-85, -42] as [number, number],
        },
        {
          id: "mat_pin_plinth",
          scope: "plinth" as const,
          componentId: plinthCompId,
          title: "Soket",
          subtitle: plinthMat.label,
          colorHex: plinthMat.colorHex,
          localPos: new THREE.Vector3(W * 0.36, Math.max(20, plinthH * 0.5), D - 10),
          offsetPx: [-12, 16] as [number, number],
        },
      ];
    }, [project, activeModuleIndex]);

    const sceneRef = useRef<THREE.Scene | null>(null);
    const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null);
    const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const meshGroupRef = useRef<THREE.Group | null>(null);
    const dimGroupRef = useRef<THREE.Group | null>(null);
    const ghostSnapGroupRef = useRef<THREE.Group | null>(null);
    const lastGhostKeyRef = useRef<string>("");
    const lastAccessoryDropTargetRef = useRef<{ bayIndex: number; elevationY: number; accessory: any } | null>(null);
    const dimWorldAnchorsRef = useRef<{ id: string; worldPos: THREE.Vector3 }[]>([]);
    const dimLabelDomMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const gridRef = useRef<THREE.GridHelper | null>(null);
    const needsRenderRef = useRef<boolean>(true);

    const updateProjectedDimensionLabels = useCallback(() => {
      const curRenderer = rendererRef.current;
      const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
      if (!curRenderer || !cam) return;
      const w = curRenderer.domElement.clientWidth;
      const h = curRenderer.domElement.clientHeight;
      if (w === 0 || h === 0) return;

      cam.updateMatrixWorld();
      const placed: { id: string; x: number; y: number; visible: boolean }[] = [];

      for (const item of dimWorldAnchorsRef.current) {
        const ndc = item.worldPos.clone().project(cam);
        if (ndc.z > 1) {
          placed.push({ id: item.id, x: 0, y: 0, visible: false });
          continue;
        }
        const rawX = (ndc.x + 1) * 0.5 * w;
        const rawY = (-ndc.y + 1) * 0.5 * h;
        let x = Math.max(72, Math.min(w - 72, rawX));
        let y = Math.max(64, Math.min(h - 68, rawY));

        // Prevent overlapping labels on screen
        for (const prev of placed) {
          if (!prev.visible) continue;
          if (Math.abs(x - prev.x) < 118 && Math.abs(y - prev.y) < 34) {
            y = prev.y + (y >= prev.y ? 36 : -36);
            y = Math.max(64, Math.min(h - 68, y));
          }
        }
        placed.push({ id: item.id, x, y, visible: true });
      }

      for (const p of placed) {
        const el = dimLabelDomMapRef.current.get(p.id);
        if (!el) continue;
        if (!p.visible) {
          el.style.opacity = "0";
        } else {
          el.style.opacity = "1";
          el.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0) translate(-50%, -50%)`;
        }
      }

      if (bayPopoverDomRef.current && activeBayWorldAnchorRef.current) {
        const ndc = activeBayWorldAnchorRef.current.clone().project(cam);
        if (ndc.z > 1) {
          bayPopoverDomRef.current.style.opacity = "0";
        } else {
          const px = Math.max(120, Math.min(w - 150, (ndc.x + 1) * 0.5 * w + 54));
          const py = Math.max(120, Math.min(h - 140, (-ndc.y + 1) * 0.5 * h));
          bayPopoverDomRef.current.style.opacity = "1";
          bayPopoverDomRef.current.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0) translate(0%, -50%)`;
        }
      }
      if (doorPopoverDomRef.current && activeDoorWorldAnchorRef.current) {
        const ndc = activeDoorWorldAnchorRef.current.clone().project(cam);
        if (ndc.z > 1) {
          doorPopoverDomRef.current.style.opacity = "0";
        } else {
          const px = Math.max(140, Math.min(w - 230, (ndc.x + 1) * 0.5 * w + 18));
          const py = Math.max(140, Math.min(h - 190, (-ndc.y + 1) * 0.5 * h));
          doorPopoverDomRef.current.style.opacity = "1";
          doorPopoverDomRef.current.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0) translate(0%, -50%)`;
        }
      }
      for (const hwAnchor of hwWorldAnchorsRef.current) {
        const el = hwCalloutDomMapRef.current.get(hwAnchor.id);
        if (!el) continue;
        const ndc = hwAnchor.worldPos.clone().project(cam);
        if (ndc.z > 1) {
          el.style.opacity = "0";
        } else {
          const px = Math.max(85, Math.min(w - 140, (ndc.x + 1) * 0.5 * w));
          const py = Math.max(75, Math.min(h - 85, (-ndc.y + 1) * 0.5 * h));
          el.style.opacity = "1";
          el.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0)`;
        }
      }
      for (const matAnchor of matWorldAnchorsRef.current) {
        const el = matCalloutDomMapRef.current.get(matAnchor.id);
        if (!el) continue;
        const ndc = matAnchor.worldPos.clone().project(cam);
        if (ndc.z > 1) {
          el.style.opacity = "0";
        } else {
          const px = Math.max(85, Math.min(w - 140, (ndc.x + 1) * 0.5 * w));
          const py = Math.max(75, Math.min(h - 85, (-ndc.y + 1) * 0.5 * h));
          el.style.opacity = "1";
          el.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0)`;
        }
      }
    }, []);

    const requestRender = useCallback(() => {
      needsRenderRef.current = true;
    }, []);

    // Initialize WebGL Scene once — never destroyed across mode switches
    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;

      const scene = new THREE.Scene();
      const bgHex =
        theme === "warm-light"
          ? 0xd6d2c8
          : theme === "showroom-neutral"
          ? 0xcbc6ba
          : 0x141413;
      scene.background = new THREE.Color(bgHex);
      sceneRef.current = scene;

      const perspCamera = new THREE.PerspectiveCamera(40, width / height, 10, 25000);
      perspCamera.position.set(2300, 2000, 3200);
      perspCamRef.current = perspCamera;

      const aspect = width / height;
      const orthoD = 1800;
      const orthoCamera = new THREE.OrthographicCamera(
        -orthoD * aspect,
        orthoD * aspect,
        orthoD,
        -orthoD,
        -50000,
        50000
      );
      orthoCamera.position.set(2300, 2000, 3200);
      orthoCamRef.current = orthoCamera;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      rendererRef.current = renderer;
      container.appendChild(renderer.domElement);

      const activeCam = isOrthographic ? orthoCamera : perspCamera;
      const controls = new OrbitControls(activeCam, renderer.domElement);
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      };
      controls.screenSpacePanning = true;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxDistance = 14000;
      controls.minDistance = 250;
      controls.target.set(900, 1100, 300);
      controls.addEventListener("change", () => {
        needsRenderRef.current = true;
      });
      controlsRef.current = controls;

      // Generate HDR Studio Lightformer PMREM prefiltered environment map for photorealistic reflections
      scene.environment = getStudioPmremEnvironment(renderer);

      // Calibrated Architectural Daylight + Warm Softbox Lighting with full-room 2048x2048 shadow frustum
      const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.96);
      scene.add(hemiLight);
      hemiLightRef.current = hemiLight;

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.42);
      keyLight.position.set(2600, 4200, 3400);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.camera.left = -4800;
      keyLight.shadow.camera.right = 4800;
      keyLight.shadow.camera.top = 4200;
      keyLight.shadow.camera.bottom = -1200;
      keyLight.shadow.camera.near = 100;
      keyLight.shadow.camera.far = 12000;
      keyLight.shadow.bias = -0.0003;
      keyLight.shadow.normalBias = 1.4;
      keyLight.shadow.radius = 3.2;
      scene.add(keyLight);
      keyLightRef.current = keyLight;

      const rimLight = new THREE.DirectionalLight(0xeef4fa, 0.72);
      rimLight.position.set(-2400, 2600, -1800);
      scene.add(rimLight);
      rimLightRef.current = rimLight;

      const frontFillLight = new THREE.DirectionalLight(0xf8fafc, 0.62);
      frontFillLight.position.set(-1800, 1900, 3200);
      scene.add(frontFillLight);

      // Upward warm floor bounce light (illuminates underside of upper cabinets, countertops, and Gola channels)
      const floorBounceLight = new THREE.DirectionalLight(0xf1f5f9, 0.38);
      floorBounceLight.position.set(600, -1400, 2200);
      scene.add(floorBounceLight);

      // Subtle architectural floor grid with clear contrast
      const gridColor1 = theme === "dark" ? 0x334155 : 0x8c857b;
      const gridColor2 = theme === "dark" ? 0x1e293b : 0xb5afa4;
      const grid = new THREE.GridHelper(8000, 80, gridColor1, gridColor2);
      grid.position.y = -2;
      grid.visible = showGrid;
      scene.add(grid);
      gridRef.current = grid;

      const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(8000, 8000),
        new THREE.ShadowMaterial({ opacity: theme === "dark" ? 0.32 : 0.22 })
      );
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = -1;
      shadowPlane.receiveShadow = true;
      scene.add(shadowPlane);

      const roomArchGroup = new THREE.Group();
      scene.add(roomArchGroup);
      roomArchGroupRef.current = roomArchGroup;

      const meshGroup = new THREE.Group();
      scene.add(meshGroup);
      meshGroupRef.current = meshGroup;

      const dimGroup = new THREE.Group();
      scene.add(dimGroup);
      dimGroupRef.current = dimGroup;

      const ghostSnapGroup = new THREE.Group();
      ghostSnapGroup.name = "v3_ghost_silhouette_and_snaps";
      scene.add(ghostSnapGroup);
      ghostSnapGroupRef.current = ghostSnapGroup;

      // Direct model raycast selection + 3D Front/Perspective Interior Component Dragging with Cross-Module Snapping
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let downPos = { x: 0, y: 0 };
      let activeDrag3D: {
        modIdx: number;
        bayIdx: number;
        kind:
          | "shelf"
          | "drawer"
          | "rail"
          | "special_fitting"
          | "divider"
          | "sub_divider"
          | "module_3d"
          | "obstacle_3d";
        targetId: string;
        startValueMm: number;
        startSecondValueMm?: number;
        startThirdValueMm?: number;
        isSideWallObs?: boolean;
        dragPlane?: THREE.Plane;
        startPlaneHit?: THREE.Vector3;
        itemHeightMm?: number;
        startClientX: number;
        startClientY: number;
        mmPerPx: number;
        hasMoved: boolean;
      } | null = null;

      const handlePointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        downPos = { x: e.clientX, y: e.clientY };
        const curRenderer = rendererRef.current;
        const curGroup = meshGroupRef.current;
        const curRoomGroup = roomArchGroupRef.current;
        const curControls = controlsRef.current;
        if (!curRenderer || !curGroup || !curControls) return;

        const rect = curRenderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const curCam = (curControls.object as THREE.Camera) || perspCamRef.current;
        if (!curCam) return;

        raycaster.setFromCamera(pointer, curCam);
        const state = latestStateRef.current;

        // 1. Raycast solid cabinet meshes FIRST so upper & base cabinets always take priority over wall obstacles behind them!
        const anyDoorsOpen =
          state.doorsHiddenIn3D ||
          state.doorOpenAngleDeg > 5 ||
          state.project.modules.some(
            (m) =>
              Boolean(m.isOpenFront) ||
              m.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open")
          );
        const solidMeshes = collectSolidCabinetMeshes(curGroup, anyDoorsOpen);
        const hits = raycaster.intersectObjects(solidMeshes, false);
        const closestCabinetDist = hits.length > 0 ? hits[0].distance : Infinity;

        // 2. Only grab an Architectural Obstacle (Window, Door, Plumbing, Column) if NO cabinet is in front of it!
        if (curRoomGroup && (state.moveObjectMode3D || e.shiftKey)) {
          const roomHits = raycaster.intersectObjects(curRoomGroup.children, true);
          for (const rh of roomHits) {
            if (rh.object instanceof THREE.Line || rh.object instanceof THREE.LineSegments) continue;
            if (rh.distance >= closestCabinetDist - 2) break;
            let rCand: THREE.Object3D | null = rh.object;
            while (rCand && !rCand.userData?.obstacleId) {
              rCand = rCand.parent;
            }
            if (rCand?.userData?.obstacleId) {
              const obsId = String(rCand.userData.obstacleId);
              const obsObj = (state.spaceObstacles || []).find((o) => o.id === obsId);
              if (obsObj) {
                const hitDist = Math.max(300, rh.distance);
                const fovRad =
                  curCam instanceof THREE.PerspectiveCamera
                    ? (curCam.fov * Math.PI) / 180
                    : 0.7;
                const visibleHeightMm =
                  curCam instanceof THREE.PerspectiveCamera
                    ? 2 * hitDist * Math.tan(fovRad / 2)
                    : 2200;
                const mmPerPx = visibleHeightMm / Math.max(200, rect.height);
                const obsRot = (((obsObj.rotationY || 0) % 360) + 360) % 360;
                const isSideObs = obsRot === 90 || obsRot === 270;
                const planeNormal = isSideObs
                  ? new THREE.Vector3(1, 0, 0)
                  : new THREE.Vector3(0, 0, 1);
                const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                  planeNormal,
                  rh.point
                );
                const startPlaneHit = rh.point.clone();
                state.beginHistoryTransaction();
                activeDrag3D = {
                  modIdx: state.activeModuleIndex,
                  bayIdx: 0,
                  kind: "obstacle_3d",
                  targetId: obsId,
                  startValueMm: obsObj.position.x,
                  startSecondValueMm: obsObj.position.y,
                  startThirdValueMm: obsObj.position.z,
                  isSideWallObs: isSideObs,
                  dragPlane,
                  startPlaneHit,
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  mmPerPx,
                  hasMoved: false,
                };
                curControls.enabled = false;
                e.stopImmediatePropagation();
                return;
              }
            }
          }
        }
        if (hits.length === 0) return;

        let hitObj: THREE.Object3D | null = null;
        let dragMeta: ReturnType<typeof findDraggableInteriorComponent> = null;
        let modIdx = state.activeModuleIndex;
        let mod = state.project.modules[modIdx];

        for (const h of hits) {
          const cand = h.object;
          if (!cand?.userData?.componentId) continue;
          const cModIdx =
            typeof cand.userData.moduleIndex === "number"
              ? cand.userData.moduleIndex
              : state.activeModuleIndex;
          const cMod = state.project.modules[cModIdx];
          if (!cMod) continue;

          // First hit is guaranteed to be the closest solid 3D mesh under the cursor!
          if (!hitObj) {
            hitObj = cand;
            modIdx = cModIdx;
            mod = cMod;
          }

          // Do not look behind the first hit module into a DIFFERENT module!
          if (cModIdx !== modIdx) {
            break;
          }

          const isExternalDrawerFront = String(cand.userData.role) === "drawer_front";
          const doorsAreOpen =
            state.doorsHiddenIn3D ||
            state.doorOpenAngleDeg > 5 ||
            Boolean(cMod.isOpenFront) ||
            cMod.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open");

          const wantInteriorDrag = !state.moveObjectMode3D ? !e.shiftKey : e.ctrlKey || e.metaKey;
          if (wantInteriorDrag && (doorsAreOpen || isExternalDrawerFront)) {
            const fs = calculateFourSpaceDimensions(cMod);
            const dm = findDraggableInteriorComponent(
              cMod,
              String(cand.userData.componentId),
              fs.usableInternal.bayClearWidthsMm
            );
            if (dm) {
              hitObj = cand;
              modIdx = cModIdx;
              mod = cMod;
              dragMeta = dm;
              break;
            }
          }
          if (!doorsAreOpen && String(cand.userData.role || "").startsWith("door")) {
            break;
          }
        }
        if (!hitObj?.userData?.componentId || !mod) return;

        // Immediately select the hit module, bay, and component on pointerdown so clicks NEVER fail!
        const clickedCompId =
          String(hitObj.userData.role) === "door_handle" && hitObj.userData.parentComponentId
            ? String(hitObj.userData.parentComponentId)
            : String(hitObj.userData.componentId);
        state.setActiveModuleIndex(modIdx);
        if (typeof hitObj.userData.bayIndex === "number") {
          state.setActiveBayIndex(hitObj.userData.bayIndex);
        }
        (state.setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
          clickedCompId,
          modIdx
        );
        const pLabel = String(hitObj.userData?.label || hitObj.userData?.role || "Parça");
        const pDims = hitObj.userData?.dimsText ? ` (${hitObj.userData.dimsText})` : "";
        setDragDropSnapBanner(`🎯 Seçildi: ${pLabel}${pDims}`);
        setTimeout(() => setDragDropSnapBanner((prev) => (prev?.startsWith("🎯 Seçildi:") ? null : prev)), 3500);

        // Calculate world-mm per screen-pixel at the hit point
        const hitDist = Math.max(300, hits[0].distance);
        let visibleHeightMm = 2200;
        if (curCam instanceof THREE.PerspectiveCamera) {
          const fovRad = (curCam.fov * Math.PI) / 180;
          visibleHeightMm = 2 * hitDist * Math.tan(fovRad / 2);
        } else if (curCam instanceof THREE.OrthographicCamera) {
          visibleHeightMm = (curCam.top - curCam.bottom) / Math.max(0.01, curCam.zoom);
        }
        const mmPerPx = visibleHeightMm / Math.max(200, rect.height);

        // If user is in 3D Move Mode (or holding Shift), grab and move the WHOLE MODULE along the wall!
        if ((state.moveObjectMode3D || e.shiftKey) && !dragMeta) {
          state.setActiveModuleIndex(modIdx);
          (state.setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
            clickedCompId,
            modIdx
          );
          state.beginHistoryTransaction();
          const modDragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 1, 0),
            hits[0].point
          );
          activeDrag3D = {
            modIdx,
            bayIdx: 0,
            kind: "module_3d",
            targetId: mod.id,
            startValueMm: mod.position.x,
            startSecondValueMm: mod.position.z,
            dragPlane: modDragPlane,
            startPlaneHit: hits[0].point.clone(),
            startClientX: e.clientX,
            startClientY: e.clientY,
            mmPerPx,
            hasMoved: false,
          };
          curControls.enabled = false;
          e.stopImmediatePropagation();
          return;
        }

        if (!dragMeta) {
          curControls.enabled = false;
          return;
        }

        state.setActiveModuleIndex(modIdx);
        state.setActiveBayIndex(dragMeta.bayIdx);
        (state.setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
          String(hitObj.userData.componentId),
          modIdx
        );

        activeDrag3D = {
          modIdx,
          bayIdx: dragMeta.bayIdx,
          kind: dragMeta.kind,
          targetId: dragMeta.targetId,
          startValueMm: dragMeta.startVal,
          itemHeightMm: dragMeta.itemHeightMm,
          startClientX: e.clientX,
          startClientY: e.clientY,
          mmPerPx,
          hasMoved: false,
        };
        curControls.enabled = false;
        e.stopImmediatePropagation();
      };

      const hoverOverlayGroup = new THREE.Group();
      hoverOverlayGroup.name = "v3_hover_highlight_box";
      scene.add(hoverOverlayGroup);

      const hoverBoxGeo = new THREE.BoxGeometry(1, 1, 1);
      const hoverFillMat = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.28,
        depthTest: false,
        depthWrite: false,
      });
      const hoverOutlineMat = new THREE.LineBasicMaterial({
        color: 0x0284c7,
        linewidth: 2,
        depthTest: false,
      });
      const hoverFillMesh = new THREE.Mesh(hoverBoxGeo, hoverFillMat);
      hoverFillMesh.raycast = () => {};
      const hoverOutlineSegments = new THREE.LineSegments(
        new THREE.EdgesGeometry(hoverBoxGeo),
        hoverOutlineMat
      );
      hoverOutlineSegments.raycast = () => {};
      hoverOverlayGroup.add(hoverFillMesh);
      hoverOverlayGroup.add(hoverOutlineSegments);
      hoverOverlayGroup.visible = false;

      let lastHoverCheckTime = 0;
      let currentHoveredMesh: THREE.Mesh | null = null;

      const handlePointerMove = (e: PointerEvent) => {
        if (!activeDrag3D) {
          const now = performance.now();
          if (now - lastHoverCheckTime < 24) return;
          lastHoverCheckTime = now;

          const curRenderer = rendererRef.current;
          const curGroup = meshGroupRef.current;
          const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          if (!curRenderer || !curGroup || !curCam) return;

          const rect = curRenderer.domElement.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          ) {
            if (currentHoveredMesh) {
              currentHoveredMesh = null;
              hoverOverlayGroup.visible = false;
              setHovered3DObjectLabel(null);
              curRenderer.domElement.style.cursor = "grab";
              needsRenderRef.current = true;
            }
            return;
          }

          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, curCam);

          const st = latestStateRef.current;
          const anyDoorsOpen =
            st.doorsHiddenIn3D ||
            st.doorOpenAngleDeg > 5 ||
            st.project.modules.some(
              (m) =>
                Boolean(m.isOpenFront) ||
                m.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open")
            );
          const solidMeshes = collectSolidCabinetMeshes(curGroup, anyDoorsOpen);
          const hits = raycaster.intersectObjects(solidMeshes, false);

          // Pick the closest non-compartment solid mesh if available
          let hitMesh: THREE.Mesh | null = null;
          for (const h of hits) {
            if (h.object instanceof THREE.Mesh && h.object.userData?.role !== "bay_compartment") {
              hitMesh = h.object;
              break;
            }
          }
          if (!hitMesh && hits.length > 0 && hits[0].object instanceof THREE.Mesh) {
            hitMesh = hits[0].object;
          }

          if (hitMesh !== currentHoveredMesh) {
            currentHoveredMesh = hitMesh;
            if (hitMesh) {
              // Compute world bounding box of the hovered part and wrap hoverOverlayGroup around it!
              const bbox = new THREE.Box3().setFromObject(hitMesh);
              if (!bbox.isEmpty()) {
                const center = new THREE.Vector3();
                const size = new THREE.Vector3();
                bbox.getCenter(center);
                bbox.getSize(size);
                hoverOverlayGroup.position.copy(center);
                hoverOverlayGroup.scale.set(
                  Math.max(12, size.x + 8),
                  Math.max(12, size.y + 8),
                  Math.max(12, size.z + 8)
                );
                hoverOverlayGroup.visible = true;
              }
              const partLabel = String(hitMesh.userData?.label || hitMesh.userData?.role || "Parça");
              const dimsTxt = hitMesh.userData?.dimsText ? ` (${hitMesh.userData.dimsText})` : "";
              const bayTxt =
                typeof hitMesh.userData?.bayIndex === "number"
                  ? `Bölme ${hitMesh.userData.bayIndex + 1} • `
                  : "";
              setHovered3DObjectLabel(`${bayTxt}${partLabel}${dimsTxt}`);
              curRenderer.domElement.style.cursor = "pointer";
            } else {
              hoverOverlayGroup.visible = false;
              setHovered3DObjectLabel(null);
              curRenderer.domElement.style.cursor = "grab";
            }
            needsRenderRef.current = true;
          }
          return;
        }
        hoverOverlayGroup.visible = false;
        const dxPx = e.clientX - activeDrag3D.startClientX;
        const dyPx = e.clientY - activeDrag3D.startClientY;
        if (!activeDrag3D.hasMoved && Math.hypot(dxPx, dyPx) < 4) return;
        activeDrag3D.hasMoved = true;

        const state = latestStateRef.current;

        if (activeDrag3D.kind === "obstacle_3d") {
          let deltaX = dxPx * activeDrag3D.mmPerPx;
          let deltaZ = -dxPx * activeDrag3D.mmPerPx;
          let deltaY = -dyPx * activeDrag3D.mmPerPx;

          const curRenderer = rendererRef.current;
          const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          if (curRenderer && curCam && activeDrag3D.dragPlane && activeDrag3D.startPlaneHit) {
            const rect = curRenderer.domElement.getBoundingClientRect();
            const curNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const curNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            const rc = new THREE.Raycaster();
            rc.setFromCamera(new THREE.Vector2(curNdcX, curNdcY), curCam);
            const curHit = new THREE.Vector3();
            if (rc.ray.intersectPlane(activeDrag3D.dragPlane, curHit)) {
              const rawDx = curHit.x - activeDrag3D.startPlaneHit.x;
              const rawDz = curHit.z - activeDrag3D.startPlaneHit.z;
              const rawDy = curHit.y - activeDrag3D.startPlaneHit.y;
              if (Math.abs(rawDx) < 9000 && Math.abs(rawDz) < 9000 && Math.abs(rawDy) < 6000) {
                deltaX = rawDx;
                deltaZ = rawDz;
                deltaY = rawDy;
              }
            }
          }

          const nextY = Math.max(
            0,
            Math.round(((activeDrag3D.startSecondValueMm || 0) + deltaY) / 10) * 10
          );
          if (activeDrag3D.isSideWallObs) {
            const nextZ = Math.max(
              0,
              Math.round(((activeDrag3D.startThirdValueMm || 0) + deltaZ) / 10) * 10
            );
            state.updateObstaclePosition(
              activeDrag3D.targetId,
              activeDrag3D.startValueMm,
              nextZ,
              nextY
            );
            setDragDropSnapBanner(
              `🎯 Yan Duvar Pencere/Engel Taşınıyor: Z:${nextZ}mm • Yükseklik Kotu Y:${nextY}mm`
            );
          } else {
            const nextX = Math.max(
              0,
              Math.round((activeDrag3D.startValueMm + deltaX) / 10) * 10
            );
            state.updateObstaclePosition(
              activeDrag3D.targetId,
              nextX,
              activeDrag3D.startThirdValueMm,
              nextY
            );
            setDragDropSnapBanner(
              `🎯 3D Pencere/Engel Taşınıyor: X:${nextX}mm • Yükseklik Kotu Y:${nextY}mm`
            );
          }
          return;
        }

        if (activeDrag3D.kind === "module_3d") {
          // Compute true 3D raycast delta along the wall plane (with screen-space fallback for side angles)
          let dxMm = dxPx * activeDrag3D.mmPerPx;
          const curRenderer = rendererRef.current;
          const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
          if (curRenderer && curCam) {
            const rect = curRenderer.domElement.getBoundingClientRect();
            const startNdcX = ((activeDrag3D.startClientX - rect.left) / rect.width) * 2 - 1;
            const startNdcY = -((activeDrag3D.startClientY - rect.top) / rect.height) * 2 + 1;
            const curNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const curNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            const wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -300);
            const rcStart = new THREE.Raycaster();
            const rcCur = new THREE.Raycaster();
            rcStart.setFromCamera(new THREE.Vector2(startNdcX, startNdcY), curCam);
            rcCur.setFromCamera(new THREE.Vector2(curNdcX, curNdcY), curCam);
            const ptStart = new THREE.Vector3();
            const ptCur = new THREE.Vector3();
            if (
              rcStart.ray.intersectPlane(wallPlane, ptStart) &&
              rcCur.ray.intersectPlane(wallPlane, ptCur) &&
              Math.abs(ptCur.x - ptStart.x) < 8000
            ) {
              dxMm = ptCur.x - ptStart.x;
            }
          }

          const dragModObj = state.project.modules[activeDrag3D.modIdx];
          const isRotated90Mod =
            (((dragModObj?.rotation?.y || 0) % 360) + 360) % 360 === 90 ||
            (((dragModObj?.rotation?.y || 0) % 360) + 360) % 360 === 270;
          if (isRotated90Mod) {
            let dzMm = -dxPx * activeDrag3D.mmPerPx;
            if (curRenderer && curCam && activeDrag3D.dragPlane && activeDrag3D.startPlaneHit) {
              const rect = curRenderer.domElement.getBoundingClientRect();
              const curNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
              const curNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
              const rc = new THREE.Raycaster();
              rc.setFromCamera(new THREE.Vector2(curNdcX, curNdcY), curCam);
              const curHit = new THREE.Vector3();
              if (
                rc.ray.intersectPlane(activeDrag3D.dragPlane, curHit) &&
                Math.abs(curHit.z - activeDrag3D.startPlaneHit.z) < 8000
              ) {
                dzMm = curHit.z - activeDrag3D.startPlaneHit.z;
              }
            }
            const nextZ = Math.max(
              0,
              Math.round(((activeDrag3D.startSecondValueMm || 0) + dzMm) / 10) * 10
            );
            setDragDropSnapBanner(`✋ 3D Köşe/Yan Modül Taşınıyor: Z: ${nextZ}mm`);
            state.setModulePosition(activeDrag3D.modIdx, activeDrag3D.startValueMm, nextZ, 1);
            return;
          }
          const rawNextX = Math.max(0, activeDrag3D.startValueMm + dxMm);
          let nextX = Math.round(rawNextX / 10) * 10;
          let lockedSnapX: number | null = null;
          let snapText = `✋ 3D Modül Taşınıyor: X: ${nextX}mm (Diğer modülün üzerine bırakırsanız yer değiştirir • Alt: Serbest)`;

          const dragMod = state.project.modules[activeDrag3D.modIdx];
          if (dragMod && !e.altKey) {
            const dragW = dragMod.dimensions.width;
            if (rawNextX <= 22 && (activeDrag3D.startValueMm > 6 || dxMm <= 0)) {
              nextX = 0;
              lockedSnapX = 0;
              snapText = "🧲 Duvar Başlangıcına Snap (X: 0mm)";
            }
            state.project.modules.forEach((other, oIdx) => {
              if (oIdx === activeDrag3D?.modIdx || other.category === "complementary") return;
              const otherRight = other.position.x + other.dimensions.width;
              const otherLeft = other.position.x;
              const startedAtRight = Math.abs((activeDrag3D?.startValueMm || 0) - otherRight) <= 6;
              const startedAtLeft = Math.abs((activeDrag3D?.startValueMm || 0) + dragW - otherLeft) <= 6;
              if (dragMod.category === "complementary" && Math.abs(rawNextX - otherLeft) <= 35) {
                nextX = otherLeft;
                lockedSnapX = otherLeft;
                snapText = `🧲 ${oIdx + 1}. Modül Hizasına Entegre Snap (X: ${otherLeft}mm)`;
              } else if ((!startedAtRight || Math.abs(dxMm) <= 4) && Math.abs(rawNextX - otherRight) <= 28) {
                nextX = otherRight;
                lockedSnapX = otherRight;
                snapText = `🧲 ${oIdx + 1}. Modül Sağına Snap (X: ${otherRight}mm)`;
              } else if (
                (!startedAtLeft || Math.abs(dxMm) <= 4) &&
                Math.abs(rawNextX + dragW - otherLeft) <= 28 &&
                otherLeft - dragW >= 0
              ) {
                nextX = otherLeft - dragW;
                lockedSnapX = otherLeft;
                snapText = `🧲 ${oIdx + 1}. Modül Soluna Snap (X: ${nextX}mm)`;
              }
            });
          }

          // Render live 3D Vertical Magnetic Snap Laser Lines in ghostSnapGroupRef while dragging module in 3D!
          if (ghostSnapGroupRef.current && dragMod) {
            const gGroup = ghostSnapGroupRef.current;
            gGroup.clear();
            const snapXs = [
              0,
              ...state.project.modules.flatMap((m, i) =>
                i === activeDrag3D?.modIdx || m.category === "complementary"
                  ? []
                  : [m.position.x, m.position.x + m.dimensions.width]
              ),
            ];
            snapXs.forEach((sx) => {
              const isLocked = lockedSnapX === sx;
              add3DRod(
                gGroup,
                new THREE.Vector3(sx, 0, 0),
                new THREE.Vector3(sx, dragMod.dimensions.height + 240, 0),
                isLocked ? 7 : 3.5,
                isLocked ? snapSlotActiveRodMat : snapSlotIdleRodMat
              );
              add3DRod(
                gGroup,
                new THREE.Vector3(sx, 0, dragMod.dimensions.depth),
                new THREE.Vector3(sx, dragMod.dimensions.height + 240, dragMod.dimensions.depth),
                isLocked ? 7 : 3.5,
                isLocked ? snapSlotActiveRodMat : snapSlotIdleRodMat
              );
            });
          }

          setDragDropSnapBanner(snapText);
          state.setModulePosition(
            activeDrag3D.modIdx,
            nextX,
            activeDrag3D.startSecondValueMm || 0,
            1
          );
          return;
        }

        if (activeDrag3D.kind === "divider") {
          const rawX = activeDrag3D.startValueMm + dxPx * activeDrag3D.mmPerPx;
          const snappedX = Math.round(rawX / 10) * 10;
          state.setBayCustomWidth(activeDrag3D.bayIdx, snappedX, false);
          return;
        }
        if (activeDrag3D.kind === "sub_divider") {
          const rawX = activeDrag3D.startValueMm + dxPx * activeDrag3D.mmPerPx;
          const snappedX = Math.round(rawX / 10) * 10;
          state.setSubDividerPlacement(
            activeDrag3D.bayIdx,
            activeDrag3D.targetId,
            { offsetX: snappedX },
            false
          );
          return;
        }

        // Moving mouse UP (negative dyPx) increases elevationY
        const rawElevY = activeDrag3D.startValueMm - dyPx * activeDrag3D.mmPerPx;
        const targets = computeElevationSnapTargets(
          state.project,
          activeDrag3D.modIdx,
          activeDrag3D.bayIdx,
          activeDrag3D.targetId,
          activeDrag3D.itemHeightMm
        );
        const { elevationY: snappedY, snappedTarget } = resolveElevationSnap(
          rawElevY,
          targets,
          18
        );
        setActive3DSnap(snappedTarget);

        if (activeDrag3D.kind === "shelf") {
          state.setShelfElevation(activeDrag3D.bayIdx, activeDrag3D.targetId, snappedY, false);
        } else if (activeDrag3D.kind === "drawer") {
          state.setDrawerPlacement(
            activeDrag3D.bayIdx,
            activeDrag3D.targetId,
            snappedY,
            undefined,
            false
          );
        } else if (activeDrag3D.kind === "rail") {
          state.setHangingRailElevation(activeDrag3D.bayIdx, activeDrag3D.targetId, snappedY, false);
        } else if (activeDrag3D.kind === "special_fitting") {
          state.setSpecialFittingPlacement?.(activeDrag3D.bayIdx, activeDrag3D.targetId, { elevationY: snappedY }, false);
        }
      };

      const handlePointerUp = (e: PointerEvent) => {
        const curControls = controlsRef.current;
        if (curControls) curControls.enabled = true;

        if (activeDrag3D) {
          const moved = activeDrag3D.hasMoved;
          const dragKind = activeDrag3D.kind;
          const dragModIdx = activeDrag3D.modIdx;
          const dragStartX = activeDrag3D.startValueMm;
          activeDrag3D = null;
          setActive3DSnap(null);
          if (dragKind === "module_3d" || dragKind === "obstacle_3d") {
            if (ghostSnapGroupRef.current) {
              ghostSnapGroupRef.current.clear();
              needsRenderRef.current = true;
            }
            const state = latestStateRef.current;
            if (dragKind === "module_3d" && moved) {
              const swapMsg = state.finishModuleDragWithSmartSwap(dragModIdx, dragStartX);
              state.commitHistoryTransaction();
              if (swapMsg) {
                setDragDropSnapBanner(swapMsg);
                setTimeout(() => setDragDropSnapBanner(null), 2800);
              } else {
                setDragDropSnapBanner(null);
              }
            } else {
              state.commitHistoryTransaction();
            }
          }
          if (moved) return;
        }

        if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 16) return;
        const curRenderer = rendererRef.current;
        const curGroup = meshGroupRef.current;
        if (!curRenderer || !curGroup) return;

        const rect = curRenderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (!curCam) return;

        raycaster.setFromCamera(pointer, curCam);
        const state = latestStateRef.current;
        const anyDoorsOpen =
          state.doorsHiddenIn3D ||
          state.doorOpenAngleDeg > 5 ||
          state.project.modules.some(
            (m) =>
              Boolean(m.isOpenFront) ||
              m.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open")
          );
        const solidMeshes = collectSolidCabinetMeshes(curGroup, anyDoorsOpen);
        const hits = raycaster.intersectObjects(solidMeshes, false);
        for (const h of hits) {
          const hitObj = h.object;
          if (hitObj?.userData?.componentId) {
            const hitModIdx =
              typeof hitObj.userData.moduleIndex === "number"
                ? hitObj.userData.moduleIndex
                : state.activeModuleIndex;
            state.setActiveModuleIndex(hitModIdx);
            const hitMod = state.project.modules[hitModIdx];
            const roleStr = String(hitObj.userData.role || "");

            // Determine bayIndex either from mesh userData or by projecting 3D hit point along module X
            let resolvedBayIdx =
              typeof hitObj.userData.bayIndex === "number" ? hitObj.userData.bayIndex : -1;
            if (resolvedBayIdx < 0 && hitMod && hitMod.bays.length > 0) {
              const bd = generateModuleGeometry(hitMod, { doorOpenAngleDeg: 0 });
              const T = hitMod.carcass.panelThickness || 18;
              const localX = h.point.x - hitMod.position.x;
              let accX = T;
              for (let bIdx = 0; bIdx < hitMod.bays.length; bIdx++) {
                const bw = bd.bayWidths[bIdx] || 500;
                if (localX <= accX + bw + T * 0.5 || bIdx === hitMod.bays.length - 1) {
                  resolvedBayIdx = bIdx;
                  break;
                }
                accX += bw + T;
              }
            }
            if (resolvedBayIdx >= 0) {
              state.setActiveBayIndex(resolvedBayIdx);
            }

            const rawCompId = String(hitObj.userData.componentId);
            const resolvedCompId =
              roleStr === "door_handle" && hitObj.userData.parentComponentId
                ? String(hitObj.userData.parentComponentId)
                : rawCompId;

            (state.setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
              resolvedCompId,
              hitModIdx
            );

            const isDoorHit =
              roleStr === "door" ||
              roleStr.startsWith("door_") ||
              rawCompId.includes("_door_") ||
              resolvedCompId.includes("door_");
            const safeBay = Math.max(0, resolvedBayIdx);

            if (isDoorHit && !state.doorsHiddenIn3D) {
              const leafSideLabel = resolvedCompId.includes("right") ? "Sağ Kapak" : "Sol Kapak";
              setDoorMenuSubSection(null);
              setClicked3DContext({
                kind: "door",
                bayIndex: safeBay,
                role: roleStr,
                componentId: resolvedCompId,
                label: `Bölme ${safeBay + 1} • ${leafSideLabel}`,
              });
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:select-door-3d", {
                    detail: {
                      bayIndex: safeBay,
                      componentId: resolvedCompId,
                      moduleIndex: hitModIdx,
                    },
                  })
                );
              }
            } else {
              setClicked3DContext({
                kind: "bay",
                bayIndex: safeBay,
                role: roleStr,
                label: `Bölme ${safeBay + 1}`,
              });
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("birim:select-bay-3d", {
                    detail: { bayIndex: safeBay, role: roleStr, moduleIndex: hitModIdx },
                  })
                );
              }
            }
            return;
          }
        }
        state.setSelectedComponentId(null);
        setClicked3DContext(null);
      };

      renderer.domElement.addEventListener("pointerdown", handlePointerDown, { capture: true });
      window.addEventListener("pointermove", handlePointerMove, { capture: true });
      window.addEventListener("pointerup", handlePointerUp, { capture: true });

      let animId: number;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        const curControls = controlsRef.current;
        const curRenderer = rendererRef.current;
        const curScene = sceneRef.current;
        if (!curControls || !curRenderer || !curScene) return;

        const updated = curControls.update();
        if (needsRenderRef.current || updated) {
          const t0 = performance.now();
          const cam = (curControls.object as THREE.Camera) || perspCamRef.current;
          if (cam) {
            curRenderer.render(curScene, cam);
            updateProjectedDimensionLabels();
          }
          const dt = performance.now() - t0;
          if (new URLSearchParams(window.location.search).has("audit"))
            curRenderer.domElement.dataset.performance = JSON.stringify({
              renderCpuMs: dt,
              drawCalls: curRenderer.info.render.calls,
              triangles: curRenderer.info.render.triangles,
              geometries: curRenderer.info.memory.geometries,
              textures: curRenderer.info.memory.textures,
            });
          if (onPerformanceSample) onPerformanceSample({ lastRenderMs: dt });
          needsRenderRef.current = false;
        }
      };
      animate();

      const resizeObserver = new ResizeObserver(() => {
        const curRenderer = rendererRef.current;
        if (!container || !curRenderer) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;

        if (perspCamRef.current) {
          perspCamRef.current.aspect = w / h;
          perspCamRef.current.updateProjectionMatrix();
        }
        if (orthoCamRef.current) {
          const asp = w / h;
          const d = 1800;
          orthoCamRef.current.left = -d * asp;
          orthoCamRef.current.right = d * asp;
          orthoCamRef.current.top = d;
          orthoCamRef.current.bottom = -d;
          orthoCamRef.current.updateProjectionMatrix();
        }
        curRenderer.setSize(w, h);
        const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (cam && sceneRef.current) {
          curRenderer.render(sceneRef.current, cam);
          updateProjectedDimensionLabels();
        }
        needsRenderRef.current = true;
      });
      resizeObserver.observe(container);

      return () => {
        cancelAnimationFrame(animId);
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener("pointerdown", handlePointerDown, { capture: true });
        window.removeEventListener("pointermove", handlePointerMove, { capture: true });
        window.removeEventListener("pointerup", handlePointerUp, { capture: true });
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update Theme, Lighting Atmosphere Preset & Grid visibility
    useEffect(() => {
      if (sceneRef.current) {
        const bgHex =
          renderEdgeMode === "cad"
            ? 0xf8fafc
            : lightingPreset === "night_led" || theme === "dark"
            ? 0x1e293b
            : lightingPreset === "showroom_warm"
            ? 0xd6d0c4
            : 0xdcd7cd;
        sceneRef.current.background = new THREE.Color(bgHex);
      }
      if (roomArchGroupRef.current) {
        roomArchGroupRef.current.visible = showRoomArchitecture3D && renderEdgeMode !== "cad";
      }
      if (hemiLightRef.current && keyLightRef.current && rimLightRef.current && rendererRef.current) {
        if (lightingPreset === "night_led") {
          hemiLightRef.current.color.setHex(0xd6d3d1);
          hemiLightRef.current.groundColor.setHex(0x18181b);
          hemiLightRef.current.intensity = 0.26;
          keyLightRef.current.intensity = 0.36;
          rimLightRef.current.intensity = 0.24;
          rendererRef.current.toneMappingExposure = 0.92;
        } else if (lightingPreset === "showroom_warm") {
          hemiLightRef.current.color.setHex(0xffffff);
          hemiLightRef.current.groundColor.setHex(0x64748b);
          hemiLightRef.current.intensity = 0.56;
          keyLightRef.current.color.setHex(0xf8fafc);
          keyLightRef.current.intensity = 1.18;
          rimLightRef.current.intensity = 0.5;
          rendererRef.current.toneMappingExposure = 0.98;
        } else {
          hemiLightRef.current.color.setHex(0xffffff);
          hemiLightRef.current.groundColor.setHex(0x64748b);
          hemiLightRef.current.intensity = 0.6;
          keyLightRef.current.color.setHex(0xffffff);
          keyLightRef.current.intensity = 1.16;
          rimLightRef.current.intensity = 0.52;
          rendererRef.current.toneMappingExposure = 0.98;
        }
      }
      if (gridRef.current) {
        gridRef.current.visible = showGrid && floorStyle === "studio";
      }
      requestRender();
    }, [theme, showGrid, lightingPreset, floorStyle, renderEdgeMode, showRoomArchitecture3D, requestRender]);

    // Camera Projection Mode
    useEffect(() => {
      const controls = controlsRef.current;
      const perspCam = perspCamRef.current;
      const orthoCam = orthoCamRef.current;
      if (!controls || !perspCam || !orthoCam) return;

      if (isOrthographic) {
        const offset = new THREE.Vector3().subVectors(perspCam.position, controls.target);
        const dist = offset.length();
        const fovRad = (perspCam.fov * Math.PI) / 180;
        const visibleHeight = 2 * dist * Math.tan(fovRad / 2);
        if (visibleHeight > 0) orthoCam.zoom = 3600 / visibleHeight;
        orthoCam.position.copy(perspCam.position);
        orthoCam.quaternion.copy(perspCam.quaternion);
        orthoCam.updateProjectionMatrix();
        controls.object = orthoCam;
      } else {
        const dir = new THREE.Vector3().subVectors(orthoCam.position, controls.target).normalize();
        if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
        const fovRad = (perspCam.fov * Math.PI) / 180;
        const visibleHeight = 3600 / Math.max(0.01, orthoCam.zoom);
        const dist = visibleHeight / (2 * Math.tan(fovRad / 2));
        perspCam.position.copy(controls.target).addScaledVector(dir, dist);
        perspCam.quaternion.copy(orthoCam.quaternion);
        perspCam.updateProjectionMatrix();
        controls.object = perspCam;
      }
      controls.update();
      requestRender();
    }, [isOrthographic, requestRender]);

    // Camera Preset Transitions (triggered ONLY when cameraPreset changes — never on module selection or property edits)
    useEffect(() => {
      const controls = controlsRef.current;
      const perspCam = perspCamRef.current;
      const orthoCam = orthoCamRef.current;
      const { project: curProj, activeModuleIndex: curModIdx } = latestStateRef.current;
      const activeMod = curProj.modules[curModIdx] || curProj.modules[0];
      if (!controls || !perspCam || !orthoCam || !activeMod) return;

      const fp = getModuleOrientedFootprint(activeMod, curModIdx);
      const cx = fp.x + fp.planWidth / 2;
      const cy = fp.yBottom + fp.rawHeight / 2;
      const cz = fp.z + fp.planDepth / 2;
      controls.target.set(cx, cy, cz);

      const maxDim = Math.max(fp.planWidth, fp.rawHeight, fp.planDepth);
      const fitDist = maxDim * 2.15;
      const targetPos = new THREE.Vector3();

      if (cameraPreset === "front") {
        targetPos.set(cx, cy, cz + fitDist);
      } else if (cameraPreset === "side") {
        targetPos.set(cx - fitDist, cy, cz);
      } else if (cameraPreset === "top") {
        targetPos.set(cx, cy + fitDist, cz + 1);
      } else {
        targetPos.set(
          cx + fp.planWidth * 1.15,
          cy + fp.rawHeight * 1.05,
          cz + Math.max(fp.planWidth, fp.rawHeight) * 1.3
        );
      }

      perspCam.position.copy(targetPos);
      perspCam.lookAt(cx, cy, cz);
      perspCam.updateProjectionMatrix();

      orthoCam.position.copy(targetPos);
      orthoCam.lookAt(cx, cy, cz);
      controls.update();
      requestRender();
    }, [cameraPreset, requestRender]);

    // Fast Selection & Active Module Highlight WITHOUT rebuilding scene geometry
    useEffect(() => {
      const meshGroup = meshGroupRef.current;
      if (!meshGroup) return;
      const isLight = theme !== "dark";

      meshGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData?.componentId) {
          const isSel = obj.userData.componentId === selectedComponentId;
          const isActMod = obj.userData.moduleIndex === activeModuleIndex;
          const isRail =
            obj.userData.role === "hanging_rail" ||
            ((obj.userData.role === "door_handle" || obj.userData.role === "drawer_handle") &&
              obj.userData.handleCategory !== "milled_wood_grip" &&
              obj.userData.handleCategory !== "j_pull") ||
            obj.userData.role === "gola_profile" ||
            obj.userData.role === "drawer_slide" ||
            obj.userData.role === "door_hinge" ||
            obj.userData.role?.includes("fit");
          if (!obj.userData.preserveCustomMaterial) {
            if (renderEdgeMode === "cad") {
              obj.material = isSel ? cadSelectedMat : cadTechnicalMat;
            } else {
              const matDef = obj.userData.matDef || DEFAULT_MATERIALS[0];
              const grainDir = obj.userData.grainDir || "lengthwise";
              const surfFin = obj.userData.surfFin;
              obj.material = getV3PbrMaterial(matDef, isSel, isRail, grainDir, surfFin);
            }
          }

          if (obj.children.length > 0 && obj.children[0] instanceof THREE.LineSegments) {
            obj.children[0].material = getCachedEdgeMaterial(isSel, isActMod, isLight, renderEdgeMode === "photoreal");
          }
        }
      });

      requestRender();
    }, [activeModuleIndex, selectedComponentId, theme, renderEdgeMode, requestRender]);

    // Rebuild Parametric Meshes ONLY when project geometry or kinematic sliders change
    useEffect(() => {
      const meshGroup = meshGroupRef.current;
      if (!meshGroup) return;

      meshGroup.clear();
      if (roomArchGroupRef.current) roomArchGroupRef.current.clear();
      const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
      const isLight = theme !== "dark";

      let activeSceneLedLights = 0;
      project.modules.forEach((mod, modIdx) => {
        const breakdown = generateModuleGeometry(mod, {
          doorOpenAngleDeg,
          drawerOpenMm,
          explodedFactor,
        });

        const isActiveMod = modIdx === activeModuleIndex;
        const modContainer = createModuleGroup(mod);

        breakdown.components.forEach((comp) => {
          const fallbackStoneDef = {
            id: "mat_stone_calacatta",
            name: "Çimstone Calacatta Kuvars",
            category: "stone" as const,
            colorHex: "#f5f4f0",
            costPerM2: 185,
          };
          const fallbackLedDef = {
            id: "mat_led_warm_3000k",
            name: "Häfele Loox5 3000K Sıcak LED",
            category: "metal" as const,
            colorHex: "#fff7d6",
            costPerM2: 45,
          };
          const matDef =
            matMap.get(comp.materialId) ||
            (comp.role === "countertop" || comp.materialId === "mat_stone_calacatta"
              ? fallbackStoneDef
              : comp.materialId === "mat_led_warm_3000k"
              ? fallbackLedDef
              : DEFAULT_MATERIALS[0]);
          const isSelected = comp.id === selectedComponentId;
          const isLedStrip = comp.materialId === "mat_led_warm_3000k";
          const isRail =
            !isLedStrip &&
            (comp.role === "hanging_rail" ||
              ((comp.role === "door_handle" || comp.role === "drawer_handle") &&
                comp.handleCategory !== "milled_wood_grip" &&
                comp.handleCategory !== "j_pull") ||
              comp.role === "gola_profile" ||
              comp.role === "drawer_slide" ||
              comp.role === "door_hinge" ||
              comp.role.includes("fit"));

          const grainDir =
            mod.componentGrainOverrides?.[comp.id] ||
            (comp.role.includes("door") ? mod.componentGrainOverrides?.__doors__ : undefined) ||
            (comp.role === "drawer_front" ? mod.componentGrainOverrides?.__drawers__ : undefined) ||
            mod.componentGrainOverrides?.__all__ ||
            "lengthwise";
          const surfFin = mod.surfaceFinishOverride;
          const material =
            renderEdgeMode === "cad"
              ? isSelected
                ? cadSelectedMat
                : cadTechnicalMat
              : getV3PbrMaterial(matDef, isSelected, isRail, grainDir, surfFin);
          const edgeMat = getCachedEdgeMaterial(isSelected, isActiveMod, isLight, renderEdgeMode === "photoreal");

          const isDoorPart =
            comp.role === "door" ||
            comp.role.startsWith("door_") ||
            comp.role === "door_handle" ||
            comp.role === "door_hinge";
          const isCutawayBayDoor =
            isActiveMod &&
            cutawayActiveBay &&
            isDoorPart &&
            comp.bayIndex === activeBayIndex &&
            !comp.id.includes("sliding");
          if (isActiveMod && (doorsHiddenIn3D || isCutawayBayDoor) && isDoorPart) {
            return;
          }
          const compGroup = createComponentMesh(comp, material, edgeMat, {
            componentId: comp.id,
            label: comp.label || comp.role,
             dimsText: `${comp.dimensions.width}×${comp.dimensions.height} mm`,
            role: comp.role,
            moduleIndex: modIdx,
            bayIndex: comp.bayIndex,
            matDef,
            grainDir,
            surfFin,
          });
          modContainer.add(compGroup);

          // Unmistakable Blue 3D Selection Frame around ANY Selected Panel / Door / Drawer / Plinth (Matches image_e5c524.jpg & image_dad0ff.jpg)
          if (
            isActiveMod &&
            comp.isManufacturablePanel !== false &&
            (comp.id === selectedComponentId ||
              (clicked3DContext?.kind === "door" && clicked3DContext.componentId === comp.id))
          ) {
            const dFrameGeo = new THREE.BoxGeometry(
              comp.dimensions.width + 8,
              comp.dimensions.height + 8,
              comp.dimensions.depth + 8
            );
            const dFrameLines = new THREE.LineSegments(
              new THREE.EdgesGeometry(dFrameGeo),
              new THREE.LineBasicMaterial({
                color: 0x1d4ed8,
                transparent: false,
                linewidth: 2,
              })
            );
            dFrameLines.raycast = () => {};
            const dFrameFill = new THREE.Mesh(
              dFrameGeo,
              new THREE.MeshBasicMaterial({
                color: 0x3b82f6,
                transparent: true,
                opacity: 0.22,
                depthWrite: false,
              })
            );
            dFrameFill.raycast = () => {};
            const pivot = comp.pivot ?? comp.position;
            const fx = comp.position.x - pivot.x + comp.dimensions.width / 2;
            const fy = comp.position.y - pivot.y + comp.dimensions.height / 2;
            const fz = comp.position.z - pivot.z + comp.dimensions.depth / 2 + 2;
            dFrameLines.position.set(fx, fy, fz);
            dFrameFill.position.set(fx, fy, fz);
            compGroup.add(dFrameLines);
            compGroup.add(dFrameFill);

            const doorLocalAnchor = new THREE.Vector3(
              comp.position.x + comp.dimensions.width,
              comp.position.y + comp.dimensions.height * 0.52,
              comp.position.z + comp.dimensions.depth
            );
            modContainer.updateMatrixWorld(true);
            activeDoorWorldAnchorRef.current = doorLocalAnchor.applyMatrix4(modContainer.matrixWorld);
          }
          if (isLedStrip && activeSceneLedLights < 8) {
            activeSceneLedLights++;
            const ledLight = new THREE.PointLight(0xffcf6e, 1.35, 1600);
            ledLight.position.set(
              comp.position.x + comp.dimensions.width / 2,
              comp.position.y - 12,
              comp.position.z + comp.dimensions.depth / 2
            );
            modContainer.add(ledLight);
          }
        });

        // Soft Contact Ambient Occlusion (AO) Floor & Back-Wall Shadow Pad for Photorealistic Grounding
        const aoTex = getContactAoShadowTexture();
        if (aoTex) {
          if (mod.position.y <= 80) {
            const aoGeo = new THREE.PlaneGeometry(
              mod.dimensions.width + 130,
              mod.dimensions.depth + 130
            );
            const aoMat = new THREE.MeshBasicMaterial({
              map: aoTex,
              transparent: true,
              opacity: isLight ? 0.68 : 0.82,
              depthWrite: false,
            });
            const aoMesh = new THREE.Mesh(aoGeo, aoMat);
            aoMesh.raycast = () => {};
            aoMesh.rotation.x = -Math.PI / 2;
            aoMesh.position.set(
              mod.dimensions.width / 2,
              -mod.position.y + 1.5,
              mod.dimensions.depth / 2
            );
            modContainer.add(aoMesh);
          }

          // Back-Wall Contact Shadow Halo behind EVERY cabinet (both Floor & Upper Wall Cabinets!) so carcass never blends into the wall
          const wallAoGeo = new THREE.PlaneGeometry(
            mod.dimensions.width + 160,
            mod.dimensions.height + 160
          );
          const wallAoMat = new THREE.MeshBasicMaterial({
            map: aoTex,
            transparent: true,
            opacity: isLight ? 0.58 : 0.75,
            depthWrite: false,
          });
          const wallAoMesh = new THREE.Mesh(wallAoGeo, wallAoMat);
          wallAoMesh.raycast = () => {};
          wallAoMesh.position.set(
            mod.dimensions.width / 2,
            mod.dimensions.height / 2,
            1.5
          );
          modContainer.add(wallAoMesh);
        }
        // Subtle Interior Cavity Studio Bounce Light on Active Module when Doors are Open
        if (isActiveMod && (doorOpenAngleDeg > 10 || mod.isOpenFront)) {
          const cavityLight = new THREE.PointLight(0xfff7ed, 0.42, 1600);
          cavityLight.position.set(
            mod.dimensions.width / 2,
            mod.dimensions.height * 0.62,
            mod.dimensions.depth * 0.72
          );
          modContainer.add(cavityLight);
        }

        
        // 3D Direct Compartment Hit Volumes & Active Compartment Highlight Frame (Step 2 & 3 of Wardrobe Workflow)
        if (isActiveMod && mod.bays.length >= 1) {
          const T = mod.carcass.panelThickness || 18;
          const plinthH = mod.carcass.plinthHeight ?? 100;
          const innerH =
            breakdown.netInnerHeight || Math.max(300, mod.dimensions.height - plinthH - 2 * T);
          let curBayX = T;
          const showBayOverlay =
            cutawayActiveBay ||
            doorsHiddenIn3D ||
            doorOpenAngleDeg > 5 ||
            Boolean(mod.isOpenFront) ||
            mod.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open");

          mod.bays.forEach((bayObj, bIdx) => {
            const bw =
              breakdown.bayWidths[bIdx] ||
              Math.round((mod.dimensions.width - (mod.bays.length + 1) * T) / mod.bays.length);
            if (showBayOverlay) {
              // Raycastable compartment back-volume plane so clicking empty space in a bay selects that bay
              const bayHitGeo = new THREE.PlaneGeometry(
                Math.max(80, bw - 6),
                Math.max(120, innerH - 6)
              );
              const isActBay = bIdx === activeBayIndex;
              const bayHitMat = new THREE.MeshBasicMaterial({
                color: isActBay ? 0x38bdf8 : 0x94a3b8,
                transparent: true,
                opacity: isActBay ? 0.1 : 0.015,
                side: THREE.DoubleSide,
                depthWrite: false,
              });
              const bayHitMesh = new THREE.Mesh(bayHitGeo, bayHitMat);
              bayHitMesh.position.set(curBayX + bw / 2, plinthH + T + innerH / 2, T + 8);
              bayHitMesh.userData = {
                componentId: `${mod.id}_bay_compartment_${bIdx}`,
                role: "bay_compartment",
                moduleIndex: modIdx,
                bayIndex: bIdx,
              };
              modContainer.add(bayHitMesh);

              if (isActBay) {
                const bayFrameGeo = new THREE.BoxGeometry(
                  Math.max(80, bw - 4),
                  Math.max(120, innerH - 4),
                  Math.max(100, mod.dimensions.depth - T - 8)
                );
                const bayFrameLines = new THREE.LineSegments(
                  new THREE.EdgesGeometry(bayFrameGeo),
                  new THREE.LineBasicMaterial({
                    color: 0x0284c7,
                    transparent: true,
                    opacity: 0.95,
                  })
                );
                bayFrameLines.position.set(
                  curBayX + bw / 2,
                  plinthH + T + innerH / 2,
                  T + (mod.dimensions.depth - T) / 2
                );
                modContainer.add(bayFrameLines);

                // Double-thick front blue rectangle border around active compartment opening (Matches image_e719c6.jpg)
                const frontRectGeo = new THREE.BoxGeometry(
                  Math.max(80, bw + 6),
                  Math.max(120, innerH + 6),
                  12
                );
                const frontRectLines = new THREE.LineSegments(
                  new THREE.EdgesGeometry(frontRectGeo),
                  new THREE.LineBasicMaterial({
                    color: 0x2563eb,
                    transparent: true,
                    opacity: 1,
                  })
                );
                frontRectLines.position.set(
                  curBayX + bw / 2,
                  plinthH + T + innerH / 2,
                  mod.dimensions.depth + 2
                );
                modContainer.add(frontRectLines);

                // Compute world anchor for the floating "Bölme X" popover card
                const localAnchor = new THREE.Vector3(
                  curBayX + bw,
                  plinthH + T + innerH * 0.48,
                  mod.dimensions.depth
                );
                modContainer.updateMatrixWorld(true);
                activeBayWorldAnchorRef.current = localAnchor.applyMatrix4(modContainer.matrixWorld);
              }
            }
            curBayX += bw + T;
          });
        }

        // Unmistakable 3D Selection Bounding Frame & Halo on the Active Module (Both Base & Upper Wall Cabinets)
        if (isActiveMod) {
          const selW = mod.dimensions.width + 16;
          const selH = mod.dimensions.height + 16;
          const selD = mod.dimensions.depth + 16;
          const selBoxGeo = new THREE.BoxGeometry(selW, selH, selD);
          const selEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(selBoxGeo),
            new THREE.LineBasicMaterial({
              color: 0x2563eb,
              transparent: true,
              opacity: 0.95,
            })
          );
          selEdges.raycast = () => {};
          selEdges.position.set(
            mod.dimensions.width / 2,
            mod.dimensions.height / 2,
            mod.dimensions.depth / 2
          );
          modContainer.add(selEdges);

          const baseRingGeo = new THREE.BoxGeometry(selW + 12, 8, selD + 12);
          const baseRingMesh = new THREE.Mesh(
            baseRingGeo,
            new THREE.MeshBasicMaterial({
              color: 0x3b82f6,
              transparent: true,
              opacity: 0.28,
              depthWrite: false,
            })
          );
          baseRingMesh.raycast = () => {};
          baseRingMesh.position.set(mod.dimensions.width / 2, 4, mod.dimensions.depth / 2);
          modContainer.add(baseRingMesh);
        }

        meshGroup.add(modContainer);
      });

      // Render 3D Architectural Backdrop Wall & Obstacles (Window, Plumbing, Door, Column, Beam)
      if (showRoomArchitecture3D) {
        const roomGroup = new THREE.Group();
        roomGroup.name = "v3_room_architecture_3d";
        const mainW = spaceWalls?.[0]?.length || 3600;
        const ceilH = project.space?.ceilingHeight || 2600;

        // Architectural Back Wall + Any Side Return Walls (L/U Kitchen or Left/Right Window Wall) + Floor Surface
        const wallMat = new THREE.MeshStandardMaterial({
          color:
            lightingPreset === "night_led"
              ? 0x27272a
              : lightingPreset === "showroom_warm"
              ? 0xc2bab0
              : 0xbdb5a8,
          roughness: 0.9,
          metalness: 0.02,
          transparent: false,
          side: THREE.DoubleSide,
        });
        const skirtMat = new THREE.MeshStandardMaterial({
          color: 0xf1f5f9,
          roughness: 0.45,
        });

        const effectiveWalls =
          spaceWalls && spaceWalls.length > 0
            ? spaceWalls
            : [
                {
                  id: "wall_main",
                  name: "Ana Duvar",
                  length: mainW,
                  height: ceilH,
                  thickness: 150,
                  position: { x: 0, y: 0, z: 0 },
                  rotationY: 0,
                  elements: [],
                },
              ];

        // Also ensure a Left Side Wall is rendered if any obstacle is rotated 90°/270° at X=0!
        const hasLeftSideObstacle = (spaceObstacles || []).some((o) => {
          const r = (((o.rotationY || 0) % 360) + 360) % 360;
          return (r === 90 || r === 270) && o.position.x <= 50;
        });
        const hasLeftWallAlready = effectiveWalls.some(
          (w) => (((w.rotationY || 0) % 360) + 360) % 360 === 90 && w.position.x <= 50
        );
        const wallsToRender =
          hasLeftSideObstacle && !hasLeftWallAlready
            ? [
                ...effectiveWalls,
                {
                  id: "wall_auto_left_side",
                  name: "Sol Yan Duvar",
                  length: 2200,
                  height: ceilH,
                  thickness: 150,
                  position: { x: 0, y: 0, z: 0 },
                  rotationY: 90,
                  elements: [],
                },
              ]
            : effectiveWalls;

        wallsToRender.forEach((w) => {
          const wLen = Math.max(100, w.length || 3600);
          const wH = Math.max(400, w.height || ceilH);
          const wThick = Math.max(40, w.thickness || 150);
          const rotRad = -((w.rotationY || 0) * Math.PI) / 180;

          const wallSegGroup = new THREE.Group();
          wallSegGroup.position.set(w.position.x, 0, w.position.z);
          wallSegGroup.rotation.y = rotRad;

          const normWRot = (((w.rotationY || 0) % 360) + 360) % 360;
          const isLeftReturnWall = normWRot === 90 && w.position.x <= 50;
          // For a 90° left return wall at x=0, rotRad = -90°, so local +Z points to world -X (outside the room)
          // and local -Z points to world +X (inside the room)!
          const wallLocalZ = isLeftReturnWall ? wThick / 2 : -wThick / 2;
          const skirtLocalZ = isLeftReturnWall ? -7 : 7;

          const wGeo = new THREE.BoxGeometry(wLen, wH, wThick);
          const wMesh = new THREE.Mesh(wGeo, wallMat);
          wMesh.position.set(wLen / 2, wH / 2, wallLocalZ);
          wMesh.receiveShadow = true;
          wMesh.add(
            new THREE.LineSegments(
              new THREE.EdgesGeometry(wGeo),
              new THREE.LineBasicMaterial({
                color: 0x78716c,
                transparent: true,
                opacity: 0.55,
              })
            )
          );
          wallSegGroup.add(wMesh);

          const sGeo = new THREE.BoxGeometry(wLen, 80, 14);
          const sMesh = new THREE.Mesh(sGeo, skirtMat);
          sMesh.position.set(wLen / 2, 40, skirtLocalZ);
          wallSegGroup.add(sMesh);

          roomGroup.add(wallSegGroup);
        });

        if (floorStyle !== "studio") {
          const floorTex = getArchitecturalFloorTexture(floorStyle);
          const floorGeo = new THREE.PlaneGeometry(mainW + 1600, 3800);
          const floorMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: floorTex || null,
            roughness: floorStyle === "travertine" ? 0.28 : 0.42,
            metalness: 0.05,
          });
          const floorMesh = new THREE.Mesh(floorGeo, floorMat);
          floorMesh.rotation.x = -Math.PI / 2;
          floorMesh.position.set(mainW / 2, -2, 1600);
          floorMesh.receiveShadow = true;
          roomGroup.add(floorMesh);
        }

        // Render each architectural obstacle (Window, Plumbing, Door, Column, Beam) in 3D
        // Properly respecting 90° / 270° Side-Wall Rotations, Z-axis position along side walls, and Y-axis sill height!
        (spaceObstacles || []).forEach((obs) => {
          const ow = obs.dimensions.width;
          const oh = obs.dimensions.height;
          const od = Math.max(24, obs.dimensions.depth || 80);
          const normRotY = (((obs.rotationY || 0) % 360) + 360) % 360;
          const isSideWall = normRotY === 90 || normRotY === 270;

          // When rotated 90°/270° (on Left or Right Side Wall), if near the left wall (x <= 120), lock inner face proud at x = 16mm
          // so the window is NEVER buried inside the left wall! Similarly on the Back Wall (z <= 120), lock inner face proud at z = 16mm!
          const effectiveWallX = isSideWall && obs.position.x <= 120 ? 16 : obs.position.x + 16;
          const effectiveWallZ = !isSideWall && obs.position.z <= 120 ? 16 : obs.position.z + 16;
          const cx3D = isSideWall ? effectiveWallX : obs.position.x + ow / 2;
          const cy3D = obs.position.y + oh / 2;
          const cz3D = isSideWall ? obs.position.z + ow / 2 : effectiveWallZ;
          const obsRotRad = isSideWall ? Math.PI / 2 : -((obs.rotationY || 0) * Math.PI) / 180;

          if (obs.type === "window") {
            const winGroup = new THREE.Group();
            winGroup.userData = { obstacleId: obs.id };
            winGroup.position.set(cx3D, cy3D, cz3D);
            winGroup.rotation.y = obsRotRad;

            const frameThick = 58;
            const frameDepth = 74;
            const outerFrameMat = new THREE.MeshStandardMaterial({
              color: 0x27272a,
              roughness: 0.38,
              metalness: 0.35,
            });
            const sashFrameMat = new THREE.MeshStandardMaterial({
              color: 0xf8fafc,
              roughness: 0.3,
              metalness: 0.1,
            });

            // 1. 4-Sided Outer Architectural Casing Frame (Pencere Kasası & Pervaz Çerçevesi)
            const topBarGeo = new THREE.BoxGeometry(ow + 24, frameThick, frameDepth);
            const topBar = new THREE.Mesh(topBarGeo, outerFrameMat);
            topBar.userData = { obstacleId: obs.id };
            topBar.position.set(0, oh / 2 - frameThick / 2, 0);
            winGroup.add(topBar);

            const botBar = new THREE.Mesh(topBarGeo, outerFrameMat);
            botBar.userData = { obstacleId: obs.id };
            botBar.position.set(0, -oh / 2 + frameThick / 2, 0);
            winGroup.add(botBar);

            const sideBarGeo = new THREE.BoxGeometry(frameThick, Math.max(80, oh - frameThick * 2), frameDepth);
            const leftBar = new THREE.Mesh(sideBarGeo, outerFrameMat);
            leftBar.userData = { obstacleId: obs.id };
            leftBar.position.set(-ow / 2 + frameThick / 2, 0, 0);
            winGroup.add(leftBar);

            const rightBar = new THREE.Mesh(sideBarGeo, outerFrameMat);
            rightBar.userData = { obstacleId: obs.id };
            rightBar.position.set(ow / 2 - frameThick / 2, 0, 0);
            winGroup.add(rightBar);

            // 2. Inner White Casement Sash Frame + Center Mullion
            const innerW = Math.max(120, ow - frameThick * 2);
            const innerH = Math.max(120, oh - frameThick * 2);
            const sashBarT = 32;
            const sashTopGeo = new THREE.BoxGeometry(innerW, sashBarT, 52);
            const sashTop = new THREE.Mesh(sashTopGeo, sashFrameMat);
            sashTop.userData = { obstacleId: obs.id };
            sashTop.position.set(0, innerH / 2 - sashBarT / 2, 0);
            winGroup.add(sashTop);

            const sashBot = new THREE.Mesh(sashTopGeo, sashFrameMat);
            sashBot.userData = { obstacleId: obs.id };
            sashBot.position.set(0, -innerH / 2 + sashBarT / 2, 0);
            winGroup.add(sashBot);

            const sashSideGeo = new THREE.BoxGeometry(sashBarT, innerH, 52);
            const sashLeft = new THREE.Mesh(sashSideGeo, sashFrameMat);
            sashLeft.userData = { obstacleId: obs.id };
            sashLeft.position.set(-innerW / 2 + sashBarT / 2, 0, 0);
            winGroup.add(sashLeft);

            const sashRight = new THREE.Mesh(sashSideGeo, sashFrameMat);
            sashRight.userData = { obstacleId: obs.id };
            sashRight.position.set(innerW / 2 - sashBarT / 2, 0, 0);
            winGroup.add(sashRight);

            // Center vertical mullion (Orta Kayıt)
            const mullionGeo = new THREE.BoxGeometry(44, innerH, 58);
            const mullionMesh = new THREE.Mesh(mullionGeo, outerFrameMat);
            mullionMesh.renderOrder = 13;
            mullionMesh.userData = { obstacleId: obs.id };
            winGroup.add(mullionMesh);

            // 3. Window Handle (Pencere Kolu) on center sash + Opening Direction V-Lines
            const winHandleMat = new THREE.MeshStandardMaterial({
              color: 0xfbbf24,
              roughness: 0.22,
              metalness: 0.85,
            });
            const winHandleRosette = new THREE.Mesh(
              new THREE.BoxGeometry(22, 64, 14),
              winHandleMat
            );
            winHandleRosette.userData = { obstacleId: obs.id };
            winHandleRosette.position.set(20, -20, 34);
            winGroup.add(winHandleRosette);

            const winHandleLever = new THREE.Mesh(
              new THREE.BoxGeometry(16, 96, 18),
              winHandleMat
            );
            winHandleLever.userData = { obstacleId: obs.id };
            winHandleLever.position.set(20, -48, 46);
            winGroup.add(winHandleLever);

            // Double-glazed reflective glass
            const glassGeo = new THREE.BoxGeometry(innerW - sashBarT * 2, innerH - sashBarT * 2, 28);
            const glassMat = new THREE.MeshBasicMaterial({
              color: 0x38bdf8,
              transparent: true,
              opacity: 0.44,
              polygonOffset: true,
              polygonOffsetFactor: -2,
            });
            const glassMesh = new THREE.Mesh(glassGeo, glassMat);
            glassMesh.renderOrder = 12;
            glassMesh.userData = { obstacleId: obs.id };
            glassMesh.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(glassGeo),
                new THREE.LineBasicMaterial({ color: 0x0284c7 })
              )
            );
            winGroup.add(glassMesh);

            // Window Opening Direction V-Lines on Right Sash
            const winVLinePts = new Float32Array([
              innerW / 2 - sashBarT, innerH / 2 - sashBarT, 20,
              22, -20, 20,
              22, -20, 20,
              innerW / 2 - sashBarT, -innerH / 2 + sashBarT, 20,
            ]);
            const winVGeo = new THREE.BufferGeometry();
            winVGeo.setAttribute("position", new THREE.BufferAttribute(winVLinePts, 3));
            winGroup.add(
              new THREE.LineSegments(
                winVGeo,
                new THREE.LineBasicMaterial({ color: 0x0369a1 })
              )
            );

            // 4. Protruding Marble/Stone Window Sill (Denizlik)
            const sillGeo = new THREE.BoxGeometry(ow + 76, 32, 130);
            const sillMat = new THREE.MeshStandardMaterial({
              color: 0xd6d3d1,
              roughness: 0.4,
            });
            const sillMesh = new THREE.Mesh(sillGeo, sillMat);
            sillMesh.renderOrder = 13;
            sillMesh.userData = { obstacleId: obs.id };
            sillMesh.position.set(0, -oh / 2 - 16, 32);
            sillMesh.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(sillGeo),
                new THREE.LineBasicMaterial({ color: 0x44403c })
              )
            );
            winGroup.add(sillMesh);
            roomGroup.add(winGroup);
          } else if (obs.type === "plumbing") {
            const plumbGroup = new THREE.Group();
            plumbGroup.userData = { obstacleId: obs.id };
            plumbGroup.position.set(cx3D, cy3D, cz3D);
            plumbGroup.rotation.y = obsRotRad;
            const pipeGeo = new THREE.CylinderGeometry(16, 16, 55, 16);
            pipeGeo.rotateX(Math.PI / 2);
            const hotMesh = new THREE.Mesh(
              pipeGeo,
              new THREE.MeshBasicMaterial({ color: 0xdc2626 })
            );
            hotMesh.userData = { obstacleId: obs.id };
            hotMesh.position.set(-45, 15, 25);
            const coldMesh = new THREE.Mesh(
              pipeGeo,
              new THREE.MeshBasicMaterial({ color: 0x2563eb })
            );
            coldMesh.userData = { obstacleId: obs.id };
            coldMesh.position.set(45, 15, 25);
            const drainGeo = new THREE.CylinderGeometry(26, 26, 60, 16);
            drainGeo.rotateX(Math.PI / 2);
            const drainMesh = new THREE.Mesh(
              drainGeo,
              new THREE.MeshBasicMaterial({ color: 0x334155 })
            );
            drainMesh.userData = { obstacleId: obs.id };
            drainMesh.position.set(0, -35, 28);
            plumbGroup.add(hotMesh, coldMesh, drainMesh);
            roomGroup.add(plumbGroup);
          } else if (obs.type === "door") {
            const doorGroup = new THREE.Group();
            doorGroup.userData = { obstacleId: obs.id };
            doorGroup.position.set(cx3D, cy3D, isSideWall ? cz3D : effectiveWallZ);
            doorGroup.rotation.y = obsRotRad;

            const jambW = 68;
            const jambD = 76;
            const isRightHinged = obs.doorSwing === "right";
            const frameMat = new THREE.MeshStandardMaterial({
              color: 0x292524,
              roughness: 0.42,
              metalness: 0.15,
            });
            const leafMat = new THREE.MeshStandardMaterial({
              color: 0xb45309,
              roughness: 0.48,
              metalness: 0.08,
            });
            const leafPanelMat = new THREE.MeshStandardMaterial({
              color: 0x92400e,
              roughness: 0.52,
            });
            const handleGoldMat = new THREE.MeshStandardMaterial({
              color: 0xfbbf24,
              roughness: 0.2,
              metalness: 0.9,
            });

            // 1. 3-Sided Outer Architrave Frame (Kapı Kasası & Pervaz Çerçevesi: Sol Dikme, Sağ Dikme, Üst Başlık)
            const jambGeo = new THREE.BoxGeometry(jambW, oh, jambD);
            const leftJamb = new THREE.Mesh(jambGeo, frameMat);
            leftJamb.userData = { obstacleId: obs.id };
            leftJamb.position.set(-ow / 2 + jambW / 2, 0, 0);
            leftJamb.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(jambGeo),
                new THREE.LineBasicMaterial({ color: 0x1c1917 })
              )
            );
            doorGroup.add(leftJamb);

            const rightJamb = new THREE.Mesh(jambGeo, frameMat);
            rightJamb.userData = { obstacleId: obs.id };
            rightJamb.position.set(ow / 2 - jambW / 2, 0, 0);
            rightJamb.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(jambGeo),
                new THREE.LineBasicMaterial({ color: 0x1c1917 })
              )
            );
            doorGroup.add(rightJamb);

            const headGeo = new THREE.BoxGeometry(ow + 36, jambW, jambD + 8);
            const topHeader = new THREE.Mesh(headGeo, frameMat);
            topHeader.userData = { obstacleId: obs.id };
            topHeader.position.set(0, oh / 2 - jambW / 2, 0);
            topHeader.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(headGeo),
                new THREE.LineBasicMaterial({ color: 0x1c1917 })
              )
            );
            doorGroup.add(topHeader);

            // 2. 3D Hinge Barrels on Hinge Side Jamb
            const leafW = Math.max(240, ow - jambW * 2);
            const leafH = Math.max(400, oh - jambW);
            const leafD = 42;
            const hingeX = isRightHinged ? leafW / 2 : -leafW / 2;
            [-leafH * 0.36, 0, leafH * 0.36].forEach((hy) => {
              const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(10, 10, 68, 14),
                handleGoldMat
              );
              barrel.userData = { obstacleId: obs.id };
              barrel.position.set(hingeX, hy - jambW / 2, 26);
              doorGroup.add(barrel);
            });

            // 3. Pivoted Door Leaf (Slightly Ajar 22° into Room so Opening Direction & Handle are Immediately Clear!)
            const leafPivot = new THREE.Group();
            leafPivot.userData = { obstacleId: obs.id };
            leafPivot.position.set(hingeX, -jambW / 2, 18);
            const swingAngleRad = (isRightHinged ? 1 : -1) * ((22 * Math.PI) / 180);
            leafPivot.rotation.y = swingAngleRad;

            const leafCenterOffsetX = isRightHinged ? -leafW / 2 : leafW / 2;
            const leafGeo = new THREE.BoxGeometry(leafW, leafH, leafD);
            const leafMesh = new THREE.Mesh(leafGeo, leafMat);
            leafMesh.userData = { obstacleId: obs.id };
            leafMesh.position.set(leafCenterOffsetX, 0, 0);
            leafMesh.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(leafGeo),
                new THREE.LineBasicMaterial({ color: 0x451a03 })
              )
            );
            leafPivot.add(leafMesh);

            // Decorative Recessed Upper & Lower Door Panels
            const decPanelW = Math.max(120, leafW - 150);
            const decUpperGeo = new THREE.BoxGeometry(decPanelW, leafH * 0.38, leafD + 6);
            const decUpper = new THREE.Mesh(decUpperGeo, leafPanelMat);
            decUpper.userData = { obstacleId: obs.id };
            decUpper.position.set(leafCenterOffsetX, leafH * 0.2, 0);
            leafPivot.add(decUpper);

            const decLowerGeo = new THREE.BoxGeometry(decPanelW, leafH * 0.32, leafD + 6);
            const decLower = new THREE.Mesh(decLowerGeo, leafPanelMat);
            decLower.userData = { obstacleId: obs.id };
            decLower.position.set(leafCenterOffsetX, -leafH * 0.22, 0);
            leafPivot.add(decLower);

            // 4. Prominent 3D Metallic Lever Door Handle & Escutcheon Plate (Kapı Kolu & Aynası) on Latch Edge
            const handleLocalX = isRightHinged ? -leafW + 68 : leafW - 68;
            const handleLocalY = -leafH / 2 + Math.min(leafH - 180, 1020);
            const escutcheonGeo = new THREE.BoxGeometry(34, 165, leafD + 18);
            const escutcheonMesh = new THREE.Mesh(escutcheonGeo, handleGoldMat);
            escutcheonMesh.userData = { obstacleId: obs.id };
            escutcheonMesh.position.set(handleLocalX, handleLocalY, 0);
            leafPivot.add(escutcheonMesh);

            // Front & Back Lever Grips pointing inward toward the center of the door leaf
            const leverDir = isRightHinged ? 1 : -1;
            [leafD / 2 + 28, -(leafD / 2 + 28)].forEach((hz) => {
              const neckMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(11, 11, 34, 16).rotateX(Math.PI / 2),
                handleGoldMat
              );
              neckMesh.userData = { obstacleId: obs.id };
              neckMesh.position.set(handleLocalX, handleLocalY + 18, hz * 0.65);
              leafPivot.add(neckMesh);

              const leverGrip = new THREE.Mesh(
                new THREE.BoxGeometry(135, 22, 22),
                handleGoldMat
              );
              leverGrip.userData = { obstacleId: obs.id };
              leverGrip.position.set(handleLocalX + leverDir * 52, handleLocalY + 18, hz);
              leafPivot.add(leverGrip);
            });

            // 5. Architectural Opening-Direction Triangle V-Lines on Both Faces of the Door Leaf (Hinge -> Handle)
            const hingeLocalX = 0;
            const vLinePts = new Float32Array([
              hingeLocalX, leafH / 2 - 25, leafD / 2 + 5,
              handleLocalX, handleLocalY + 18, leafD / 2 + 5,
              handleLocalX, handleLocalY + 18, leafD / 2 + 5,
              hingeLocalX, -leafH / 2 + 25, leafD / 2 + 5,
            ]);
            const vLineGeo = new THREE.BufferGeometry();
            vLineGeo.setAttribute("position", new THREE.BufferAttribute(vLinePts, 3));
            leafPivot.add(
              new THREE.LineSegments(
                vLineGeo,
                new THREE.LineBasicMaterial({ color: 0xfef08a })
              )
            );

            doorGroup.add(leafPivot);

            // 6. 3D Floor Opening Swing Arc (Zeminde 90° Kapı Açılış Yönü Yayı)
            const arcPoints: number[] = [];
            const steps = 20;
            const floorLocalY = -oh / 2 + 6;
            for (let s = 0; s < steps; s++) {
              const a0 = (s / steps) * (Math.PI / 2);
              const a1 = ((s + 1) / steps) * (Math.PI / 2);
              const x0 = hingeX + (isRightHinged ? -1 : 1) * Math.cos(a0) * leafW;
              const z0 = 18 + Math.sin(a0) * leafW;
              const x1 = hingeX + (isRightHinged ? -1 : 1) * Math.cos(a1) * leafW;
              const z1 = 18 + Math.sin(a1) * leafW;
              arcPoints.push(x0, floorLocalY, z0, x1, floorLocalY, z1);
            }
            const arcGeo = new THREE.BufferGeometry();
            arcGeo.setAttribute("position", new THREE.Float32BufferAttribute(arcPoints, 3));
            doorGroup.add(
              new THREE.LineSegments(
                arcGeo,
                new THREE.LineBasicMaterial({ color: 0xf59e0b })
              )
            );

            roomGroup.add(doorGroup);
          } else {
            // Column, Beam, or Electrical
            const colGeo = new THREE.BoxGeometry(ow, oh, od);
            const colMat = new THREE.MeshBasicMaterial({
              color: obs.type === "electrical" ? 0xf59e0b : obs.type === "niche" ? 0xded8cc : obs.type === "partition" ? 0xcbd5e1 : 0xa8a29e,
              transparent: true,
              opacity: 0.6,
            });
            const colMesh = new THREE.Mesh(colGeo, colMat);
            colMesh.userData = { obstacleId: obs.id };
            colMesh.position.set(
              isSideWall ? obs.position.x + od / 2 : obs.position.x + ow / 2,
              cy3D,
              isSideWall ? obs.position.z + ow / 2 : obs.position.z + od / 2
            );
            colMesh.rotation.y = obsRotRad;
            colMesh.add(
              new THREE.LineSegments(
                new THREE.EdgesGeometry(colGeo),
                new THREE.LineBasicMaterial({ color: 0x44403c })
              )
            );
            roomGroup.add(colMesh);
          }
        });

        if (roomArchGroupRef.current) roomArchGroupRef.current.add(roomGroup);
      }

      if (rendererRef.current) publishSceneDiagnostics(rendererRef.current.domElement, meshGroup);
      requestRender();
    }, [
      project,
      doorOpenAngleDeg,
      drawerOpenMm,
      toggleDoorOpen,
      setDrawerOpenMm,
      explodedFactor,
      activeModuleIndex,
      activeBayIndex,
      doorsHiddenIn3D,
      cutawayActiveBay,
      selectedComponentId,
      theme,
      showRoomArchitecture3D,
      spaceObstacles,
      spaceWalls,
      lightingPreset,
      floorStyle,
      renderEdgeMode,
      requestRender,
    ]);

    // Rebuild 3D Dimension Lines & Labels when active module or showDimensions changes
    useEffect(() => {
      const dimGroup = dimGroupRef.current;
      if (!dimGroup) return;

      // Dispose previous dimension resources
      dimGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) obj.material.dispose();
        }
      });
      dimGroup.clear();
      dimGroup.visible = effectiveShowDimensions;

      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!effectiveShowDimensions || !mod) {
        dimWorldAnchorsRef.current = [];
        requestRender();
        return;
      }

      const modDimContainer = createModuleGroup(mod);
      const { width: W, height: H, depth: D } = mod.dimensions;
      const T = mod.carcass.panelThickness;
      const fourSpaces = calculateFourSpaceDimensions(mod);
      const localAnchors: DimensionAnchor[] = [];

      const soketW = Math.max(200, W - 2 * T);
      // 1. Total Width (Genişlik) along top edge
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_W",
        new THREE.Vector3(0, H, D * 0.65),
        new THREE.Vector3(W, H, D * 0.65),
        new THREE.Vector3(0, 1, 0),
        95,
        "Genişlik",
        `${W} mm`,
        0x2b2927,
        "#CBD5E1",
        "#2B2927"
      );

      // 2. Total Height (Yükseklik) along right-front vertical edge (Blue)
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_H",
        new THREE.Vector3(W, 0, D),
        new THREE.Vector3(W, H, D),
        new THREE.Vector3(1, 0, 0),
        95,
        "Yükseklik",
        `${H} mm`,
        0x2563eb,
        "#BFDBFE",
        "#2563EB"
      );

      // 3. Total Depth (Derinlik) along right-bottom floor edge (Green)
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_D",
        new THREE.Vector3(W, 0, 0),
        new THREE.Vector3(W, 0, D),
        new THREE.Vector3(1, 0, 0),
        95,
        "Derinlik",
        `${D} mm`,
        0x16a34a,
        "#BBF7D0",
        "#16A34A"
      );

      // 4. Soket (Plinth width) along front-bottom floor edge
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_SOKET",
        new THREE.Vector3(T, 0, D),
        new THREE.Vector3(W - T, 0, D),
        new THREE.Vector3(0, 0, 1),
        95,
        "Soket",
        `${soketW} mm`,
        0x2b2927,
        "#CBD5E1",
        "#2B2927"
      );

      // 5. Per-Bay Net Width Segments along top-front edge (Bölme 1 600 mm | Bölme 2 600 mm | Bölme 3 600 mm)
      if (mod.category !== "complementary" && mod.bays.length >= 1) {
        const bayWidths = fourSpaces.usableInternal.bayClearWidthsMm;
        let curBayX = T;
        mod.bays.forEach((b, bIdx) => {
          const bw =
            bayWidths[bIdx] ||
            Math.round((W - (mod.bays.length + 1) * T) / Math.max(1, mod.bays.length));
          const isSelBay = bIdx === activeBayIndex;
          addDimensionSegment(
            modDimContainer,
            localAnchors,
            `dim_BAY_${bIdx}`,
            new THREE.Vector3(curBayX, H, D * 0.92),
            new THREE.Vector3(curBayX + bw, H, D * 0.92),
            new THREE.Vector3(0, 1, 0),
            26,
            `Bölme ${bIdx + 1}`,
            `${bw} mm`,
            isSelBay ? 0x2563eb : 0x64748b,
            isSelBay ? "#2563EB" : "#CBD5E1",
            isSelBay ? "#2563EB" : "#475569"
          );
          curBayX += bw + T;
        });
      }

            dimGroup.add(modDimContainer);
      modDimContainer.updateMatrixWorld(true);

      const allWorldAnchors: { id: string; worldPos: THREE.Vector3 }[] = localAnchors.map((a) => ({
        id: a.id,
        worldPos: a.localMidpoint.clone().applyMatrix4(modDimContainer.matrixWorld),
      }));

      // Build 3D Dimension Rods & Anchors for ALL other modules in the scene
      project.modules.forEach((otherMod, mIdx) => {
        if (mIdx === activeModuleIndex || otherMod.category === "complementary") return;
        const otherDimContainer = createModuleGroup(otherMod);
        const oW = otherMod.dimensions.width;
        const oH = otherMod.dimensions.height;
        const oD = otherMod.dimensions.depth;
        const oAnchors: DimensionAnchor[] = [];
        addDimensionSegment(
          otherDimContainer,
          oAnchors,
          `dim_MOD_${mIdx}`,
          new THREE.Vector3(0, oH, oD),
          new THREE.Vector3(oW, oH, oD),
          new THREE.Vector3(0, 1, 0),
          75,
          `#${mIdx + 1} ${otherMod.name}`,
          `${oW}×${oH} mm`,
          0x57534e,
          "#57534e",
          "#44403c"
        );
        dimGroup.add(otherDimContainer);
        otherDimContainer.updateMatrixWorld(true);
        oAnchors.forEach((oa) => {
          allWorldAnchors.push({
            id: oa.id,
            worldPos: oa.localMidpoint.clone().applyMatrix4(otherDimContainer.matrixWorld),
          });
        });
      });

      // Build Total Row Span 3D Dimension Rod across all main modules
      const mainMods = project.modules.filter((m) => m.category !== "complementary");
      if (mainMods.length > 1) {
        const minX = Math.min(...mainMods.map((m) => m.position.x));
        const maxX = Math.max(...mainMods.map((m) => m.position.x + m.dimensions.width));
        const maxH = Math.max(...mainMods.map((m) => m.position.y + m.dimensions.height));
        const maxD = Math.max(...mainMods.map((m) => m.dimensions.depth));
        const totalAnchors: DimensionAnchor[] = [];
        addDimensionSegment(
          dimGroup,
          totalAnchors,
          "dim_TOTAL_SPAN",
          new THREE.Vector3(minX, maxH, maxD),
          new THREE.Vector3(maxX, maxH, maxD),
          new THREE.Vector3(0, 1, 0),
          260,
          "TOPLAM DİZİLİM",
          `${Math.round(maxX - minX)} mm`,
          0x0f766e,
          "#0f766e",
          "#0f766e"
        );
        totalAnchors.forEach((ta) => {
          allWorldAnchors.push({
            id: ta.id,
            worldPos: ta.localMidpoint.clone(),
          });
        });
      }

      dimWorldAnchorsRef.current = allWorldAnchors;

      updateProjectedDimensionLabels();
      requestRender();
    }, [
      project,
      activeModuleIndex,
      activeBayIndex,
      effectiveShowDimensions,
      updateProjectedDimensionLabels,
      requestRender,
    ]);

    useEffect(() => {
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!mod) {
        hwWorldAnchorsRef.current = [];
        return;
      }
      const modContainer = createModuleGroup(mod);
      modContainer.updateMatrixWorld(true);
      hwWorldAnchorsRef.current = hwCallouts.map((hc) => ({
        id: hc.id,
        worldPos: hc.localPos.clone().applyMatrix4(modContainer.matrixWorld),
        offsetPx: hc.offsetPx,
      }));
      matWorldAnchorsRef.current = matCallouts.map((mc) => ({
        id: mc.id,
        worldPos: mc.localPos.clone().applyMatrix4(modContainer.matrixWorld),
        offsetPx: mc.offsetPx,
      }));
      updateProjectedDimensionLabels();
      requestRender();
    }, [project, activeModuleIndex, hwCallouts, matCallouts, hardwareViewMode, materialModeActive, updateProjectedDimensionLabels, requestRender]);

    if (!activeModule) return null;
    const { width, height, depth } = activeModule.dimensions;

    const activeTpl = activeModule.templateId
      ? v4ModuleTemplates.find((t) => t.templateId === activeModule.templateId)
      : undefined;
    const dimBounds = {
      W: {
        min: activeTpl?.dimensionLimits?.minW ?? 200,
        max: activeTpl?.dimensionLimits?.maxW ?? 3600,
        step: 50,
        presets: [450, 600, 800, 900, 1200, 1600, 1800, 2000, 2400],
        current: width,
        label: "Genişlik",
        isFixed: Boolean(activeModule.isFixedWidth),
      },
      H: {
        min: activeTpl?.dimensionLimits?.minH ?? 300,
        max: activeTpl?.dimensionLimits?.maxH ?? 2800,
        step: 50,
        presets: [720, 900, 1400, 2000, 2100, 2200, 2400, 2600],
        current: height,
        label: "Yükseklik",
        isFixed: false,
      },
      D: {
        min: activeTpl?.dimensionLimits?.minD ?? 200,
        max: activeTpl?.dimensionLimits?.maxD ?? 950,
        step: 50,
        presets: [320, 350, 450, 580, 600, 650, 700],
        presetsLabel: "Derinlik",
        current: depth,
        label: "Derinlik",
        isFixed: false,
      },
      SOKET: {
        min: 0,
        max: 200,
        step: 10,
        presets: [0, 60, 80, 100, 120, 150],
        current: activeModule.carcass.plinthHeight ?? 100,
        label: "Soket / Kaide Yüksekliği",
        isFixed: false,
      },
    };

    const commitBadgeEdit = (overrideVal?: number) => {
      if (!editingBadge) return;
      const bInfo = dimBounds[editingBadge];
      if (bInfo.isFixed) {
        setEditingBadge(null);
        return;
      }
      const val = typeof overrideVal === "number" ? overrideVal : Number(badgeDraftValue);
      if (Number.isNaN(val) || !Number.isFinite(val)) return;
      if (val < bInfo.min || val > bInfo.max) {
        // Block invalid dimension outside allowed parametric rules
        return;
      }
      if (editingBadge === "W") {
        setDimensions(Math.round(val), height, depth);
      } else if (editingBadge === "H") {
        setDimensions(width, Math.round(val), depth);
      } else if (editingBadge === "D") {
        setDimensions(width, height, Math.round(val));
      } else if (editingBadge === "SOKET") {
        setPlinthHeight(Math.round(val));
      }
      setEditingBadge(null);
    };

const clear3DGhostPreview = useCallback(() => {
      lastGhostKeyRef.current = "";
      if (ghostSnapGroupRef.current) {
        ghostSnapGroupRef.current.clear();
        requestRender();
      }
    }, [requestRender]);

    const resolve3DHitPointFromDragEvent = (e: React.DragEvent<HTMLDivElement>): THREE.Vector3 => {
      const rect = e.currentTarget.getBoundingClientRect();
      const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
      const hitPt = new THREE.Vector3();
      if (cam && rect.width > 0 && rect.height > 0) {
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
        const mod = activeModule || project.modules[0];
        const planeZ = mod ? (mod.position.z + mod.dimensions.depth / 2) : 280;
        const cabinetPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
        if (rc.ray.intersectPlane(cabinetPlane, hitPt)) {
          return hitPt;
        }
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        if (rc.ray.intersectPlane(floorPlane, hitPt)) {
          return hitPt;
        }
      }
      return hitPt;
    };

    const resolve3DWorldXFromDragEvent = (e: React.DragEvent<HTMLDivElement>): number => {
      const rect = e.currentTarget.getBoundingClientRect();
      const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
      if (cam && rect.width > 0 && rect.height > 0) {
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
        // Intersect with vertical cabinet front/mid plane Z=280mm or floor plane Y=0mm
        const wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -280);
        const hitPt = new THREE.Vector3();
        if (rc.ray.intersectPlane(wallPlane, hitPt)) {
          return Math.max(0, Math.round(hitPt.x));
        }
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        if (rc.ray.intersectPlane(floorPlane, hitPt)) {
          return Math.max(0, Math.round(hitPt.x));
        }
      }
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const wallLen = spaceWalls?.[0]?.length || 3600;
      return Math.round((relX * wallLen) / 50) * 50;
    };

    const handle3DDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      const activeAcc = typeof window !== "undefined" ? (window as any).__birimActiveDraggedAccessory : null;
      const hasAccessoryMime = e.dataTransfer.types.includes("application/x-birim-accessory-id");

      // CASE 1: ACCESSORY / INTERIOR ITEM DRAG
      if (hasAccessoryMime || activeAcc) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const mod = activeModule || project.modules[0];
        if (!mod) return;

        const hit = resolve3DHitPointFromDragEvent(e);
        const relX = hit.x - mod.position.x;
        const relY = hit.y - mod.position.y;

        const carcassT = mod.carcass?.panelThickness || 18;
        const plinthH = mod.carcass?.plinthHeight || 0;
        const netH = calculateNetInnerHeight(mod);
        const bayWidths = calculateBayWidths(mod);

        // 1. Identify which Bay is hovered
        let targetBayIdx = 0;
        let accX = carcassT;
        let bayStartX = carcassT;
        let curBayWidth = bayWidths[0] || 500;

        for (let i = 0; i < bayWidths.length; i++) {
          const bw = bayWidths[i];
          if (relX >= accX && relX <= accX + bw + carcassT) {
            targetBayIdx = i;
            bayStartX = accX;
            curBayWidth = bw;
            break;
          }
          accX += bw + carcassT;
        }
        targetBayIdx = Math.max(0, Math.min(mod.bays.length - 1, targetBayIdx));

        // 2. Identify Elevation Y (snapped to 32mm hole pattern)
        const cursorElevY = relY - plinthH - carcassT;
        const snappedElevY = Math.max(64, Math.min(netH - 64, Math.round(cursorElevY / 32) * 32));

        lastAccessoryDropTargetRef.current = {
          bayIndex: targetBayIdx,
          elevationY: snappedElevY,
          accessory: activeAcc || { id: "lib_shelf", title: "Raf", visual: "shelf" },
        };

        const ghostKey = `acc_${targetBayIdx}_${snappedElevY}_${activeAcc?.id || "shelf"}`;
        if (lastGhostKeyRef.current !== ghostKey && ghostSnapGroupRef.current) {
          lastGhostKeyRef.current = ghostKey;
          const gGroup = ghostSnapGroupRef.current;
          gGroup.clear();

          const accKind = activeAcc?.visual || "shelf";

          // Render Ghost Accessory Mesh
          const ghostWorldX = mod.position.x + bayStartX;
          const ghostWorldY = mod.position.y + plinthH + carcassT + snappedElevY;
          const ghostWorldZ = mod.position.z + 10;
          const ghostD = mod.dimensions.depth - 30;

          let accGeo: THREE.BufferGeometry;
          if (accKind === "drawer" || accKind === "internal_drawer") {
            accGeo = new THREE.BoxGeometry(curBayWidth - 10, 160, ghostD);
          } else if (accKind === "rail") {
            accGeo = new THREE.CylinderGeometry(12, 12, curBayWidth - 8, 16);
          } else if (accKind === "shelf") {
            accGeo = new THREE.BoxGeometry(curBayWidth - 4, 18, ghostD);
          } else {
            accGeo = new THREE.BoxGeometry(curBayWidth - 12, 100, ghostD);
          }

          const accMesh = new THREE.Mesh(
            accGeo,
            new THREE.MeshBasicMaterial({
              color: 0x2563eb,
              transparent: true,
              opacity: 0.5,
              depthWrite: false,
            })
          );

          if (accKind === "rail") {
            accMesh.rotation.z = Math.PI / 2;
            accMesh.position.set(ghostWorldX + curBayWidth / 2, ghostWorldY, ghostWorldZ + ghostD / 2);
          } else if (accKind === "drawer" || accKind === "internal_drawer") {
            accMesh.position.set(ghostWorldX + curBayWidth / 2, ghostWorldY + 80, ghostWorldZ + ghostD / 2);
          } else if (accKind === "shelf") {
            accMesh.position.set(ghostWorldX + curBayWidth / 2, ghostWorldY + 9, ghostWorldZ + ghostD / 2);
          } else {
            accMesh.position.set(ghostWorldX + curBayWidth / 2, ghostWorldY + 50, ghostWorldZ + ghostD / 2);
          }

          accMesh.add(
            new THREE.LineSegments(
              new THREE.EdgesGeometry(accGeo),
              new THREE.LineBasicMaterial({ color: 0x60a5fa, linewidth: 2 })
            )
          );
          gGroup.add(accMesh);

          // Vertical laser height rod from cabinet bottom up to accessory
          add3DRod(
            gGroup,
            new THREE.Vector3(ghostWorldX + 25, mod.position.y + plinthH + carcassT, mod.position.z + 25),
            new THREE.Vector3(ghostWorldX + 25, ghostWorldY, mod.position.z + 25),
            3.5,
            snapSlotActiveRodMat
          );

          requestRender();
        }

        setDragDropSnapBanner(`📐 ${activeAcc?.title || "Aksesuar"} • Bölme ${targetBayIdx + 1} • Y: ${snappedElevY} mm`);
        return;
      }

      // CASE 2: MODULE / CABINET DRAG
      const hasMime = e.dataTransfer.types.includes("application/x-birim-template-id");
      const activeTplId = getActiveDraggedTemplateId();
      if (!hasMime && !activeTplId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";

      const rawWorldX = resolve3DWorldXFromDragEvent(e);
      const tplId = activeTplId || "v4_kb_01_single_door";
      const preview = computeRowSnapPreview(project, tplId, rawWorldX);
      if (!preview) return;

      const ghostKey = `${preview.templateId}_${preview.snappedX}_${preview.snappedY}_${preview.isSnappedToSlot ? 1 : 0}`;
      if (lastGhostKeyRef.current !== ghostKey && ghostSnapGroupRef.current) {
        lastGhostKeyRef.current = ghostKey;
        const gGroup = ghostSnapGroupRef.current;
        gGroup.clear();

        // A. Render ALL Magnetic Snap Target Slots along the wall (Vertical Laser Guides + Floor/Wall Target Pads)
        preview.snapSlots.forEach((slot) => {
          const rodMat = slot.isActive ? snapSlotActiveRodMat : snapSlotIdleRodMat;
          const rodRadius = slot.isActive ? 6.5 : 4;
          // Left snap edge vertical laser line
          add3DRod(
            gGroup,
            new THREE.Vector3(slot.x, slot.y, 0),
            new THREE.Vector3(slot.x, slot.y + slot.height + 180, 0),
            rodRadius,
            rodMat
          );
          add3DRod(
            gGroup,
            new THREE.Vector3(slot.x, slot.y, slot.depth),
            new THREE.Vector3(slot.x, slot.y + slot.height + 180, slot.depth),
            rodRadius,
            rodMat
          );
          if (slot.isActive) {
            // Right edge laser line for the locked snap slot
            add3DRod(
              gGroup,
              new THREE.Vector3(slot.x + slot.width, slot.y, slot.depth),
              new THREE.Vector3(slot.x + slot.width, slot.y + slot.height + 180, slot.depth),
              rodRadius,
              rodMat
            );
          }

          // Magnetic Slot Footprint Target Box
          const padGeo = new THREE.BoxGeometry(slot.width, 10, slot.depth);
          const padMesh = new THREE.Mesh(
            padGeo,
            new THREE.MeshBasicMaterial({
              color: slot.isActive ? 0x10b981 : 0xf59e0b,
              transparent: true,
              opacity: slot.isActive ? 0.36 : 0.14,
              depthWrite: false,
            })
          );
          padMesh.position.set(slot.x + slot.width / 2, slot.y + 5, slot.depth / 2);
          padMesh.add(
            new THREE.LineSegments(
              new THREE.EdgesGeometry(padGeo),
              slot.isActive ? ghostLockedEdgeMat : ghostFreeEdgeMat
            )
          );
          gGroup.add(padMesh);
        });

        // B. Render Full-Scale 3D Ghost Cabinet Silhouette at (snappedX, snappedY, 0)
        const ghostBreakdown = generateModuleGeometry(preview.previewModule, {
          doorOpenAngleDeg: 0,
          drawerOpenMm: 0,
          explodedFactor: 0,
        });
        const ghostModContainer = createModuleGroup(preview.previewModule);
        const fillMat = preview.isSnappedToSlot ? ghostLockedMat : ghostFreeMat;
        const lineMat = preview.isSnappedToSlot ? ghostLockedEdgeMat : ghostFreeEdgeMat;

        ghostBreakdown.components.forEach((comp) => {
          ghostModContainer.add(
            createComponentMesh(comp, fillMat, lineMat, {
              componentId: comp.id,
              role: comp.role,
              moduleIndex: -1,
            })
          );
        });
        gGroup.add(ghostModContainer);
        requestRender();
      }

      setDragDropSnapBanner(
        `🧲 SİLUET SNAP: ${preview.previewModule.name} (${preview.previewModule.dimensions.width}×${preview.previewModule.dimensions.height}mm) → ${preview.snapLabel}`
      );
    };

    const handle3DDrop = (e: React.DragEvent<HTMLDivElement>) => {
      const activeAcc = typeof window !== "undefined" ? (window as any).__birimActiveDraggedAccessory : null;
      const hasAccessoryMime = e.dataTransfer.types.includes("application/x-birim-accessory-id");

      if (hasAccessoryMime || activeAcc || lastAccessoryDropTargetRef.current) {
        e.preventDefault();
        clear3DGhostPreview();
        const dropInfo = lastAccessoryDropTargetRef.current;
        const acc = dropInfo?.accessory || activeAcc || { id: "lib_shelf", title: "Raf" };
        const bayIdx = dropInfo ? dropInfo.bayIndex : 0;
        const elevY = dropInfo ? dropInfo.elevationY : 400;

        addInteriorItemAtElevation(bayIdx, acc.id, elevY);

        // Auto-open doors if closed so the user sees the newly placed accessory
        if (doorOpenAngleDeg === 0) {
          setDoorOpenAngleDeg(85);
        }

        setDragDropSnapBanner(`✓ ${acc.title} yerleştirildi: Bölme ${bayIdx + 1} (Y: ${elevY} mm)`);
        setTimeout(() => setDragDropSnapBanner(null), 3500);

        lastAccessoryDropTargetRef.current = null;
        if (typeof window !== "undefined") {
          (window as any).__birimActiveDraggedAccessory = null;
        }
        return;
      }

      const tplId =
        e.dataTransfer.getData("application/x-birim-template-id") ||
        getActiveDraggedTemplateId();
      clear3DGhostPreview();
      setActiveDraggedTemplateId(null);
      if (!tplId) return;
      e.preventDefault();
      const rawWorldX = resolve3DWorldXFromDragEvent(e);
      const res = dropV4TemplateWithSnap(tplId, rawWorldX);
      if (res) {
        setDragDropSnapBanner(`✓ ${res.placedName} → ${res.snapLabel}`);
        setTimeout(() => setDragDropSnapBanner(null), 3200);
      } else {
        setDragDropSnapBanner(null);
      }
    };

    return (
      <div
        data-testid="v3-three-viewport-dropzone"
        onDragOver={handle3DDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            clear3DGhostPreview();
            setDragDropSnapBanner(null);
          }
        }}
        onDrop={handle3DDrop}
        className="relative w-full h-full select-none overflow-hidden"
      >
        {dragDropSnapBanner && (
          <div
            data-testid="viewport-3d-dragdrop-snap-banner"
            className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-auto px-4 py-2 rounded-2xl bg-[#EEF3F8] text-[#1C1917] border-2 border-amber-200 shadow-xl font-mono text-xs font-extrabold flex items-center gap-2"
          >
            <span>{dragDropSnapBanner}</span>
            <button
              type="button"
              onClick={() => setDragDropSnapBanner(null)}
              className="ml-1 text-slate-500 hover:text-slate-900 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
        {hovered3DObjectLabel && !dragDropSnapBanner && (
          <div
            data-testid="viewport-3d-hover-object-badge"
            className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3.5 py-1.5 rounded-full bg-slate-900/90 text-white border border-sky-400/50 shadow-lg text-xs font-semibold flex items-center gap-2 backdrop-blur-xs"
          >
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span>🎯 Seçilecek Obje: {hovered3DObjectLabel}</span>
          </div>
        )}
        <div
          ref={mountRef}
          data-testid="v3-three-canvas"
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* INTERACTIVE CLICK-TO-EDIT 3D DIMENSION CALLOUT PILLS & FLOATING POPOVER WINDOW */}
        {effectiveShowDimensions && dimLabels.length > 0 && (
          <div
            data-testid="viewport-3d-dim-labels"
            className="absolute inset-0 pointer-events-none overflow-hidden z-[16]"
          >
            {dimLabels.map((item) => {
              const badgeKey: null | "W" | "H" | "D" | "SOKET" =
                item.id === "dim_W"
                  ? "W"
                  : item.id === "dim_H"
                  ? "H"
                  : item.id === "dim_D"
                  ? "D"
                  : item.id === "dim_SOKET"
                  ? "SOKET"
                  : null;
              const isBayBadge = item.id.startsWith("dim_BAY_");
              const bayBadgeIdx = isBayBadge ? Number(item.id.replace("dim_BAY_", "")) : -1;
              const isActiveBayBadge = isBayBadge && bayBadgeIdx === activeBayIndex;
              const isEditingThis = badgeKey !== null && editingBadge === badgeKey;

              return (
                <div
                  key={item.id}
                  data-testid={`viewport-3d-dim-${item.id}`}
                  ref={(el) => {
                    if (el) {
                      dimLabelDomMapRef.current.set(item.id, el);
                    } else {
                      dimLabelDomMapRef.current.delete(item.id);
                    }
                  }}
                  style={{
                    transform: "translate3d(-9999px, -9999px, 0)",
                  }}
                  onClick={(e) => {
                    if (isBayBadge && bayBadgeIdx >= 0) {
                      e.stopPropagation();
                      setActiveBayIndex(bayBadgeIdx);
                      setCutawayActiveBay(true);
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("birim:select-bay-3d", {
                            detail: {
                              bayIndex: bayBadgeIdx,
                              role: "bay_compartment",
                              moduleIndex: activeModuleIndex,
                            },
                          })
                        );
                      }
                      return;
                    }
                    if (!badgeKey) return;
                    e.stopPropagation();
                    const curVal = dimBounds[badgeKey].current;
                    setBadgeDraftValue(String(curVal));
                    setEditingBadge(badgeKey);
                  }}
                  title={
                    isBayBadge
                      ? `${item.tag} (${item.valueText}) — Bölmeyi seçmek ve iç düzenini açmak için tıklayın`
                      : badgeKey
                      ? `${item.tag} ölçüsünü doğrudan 3D sahnede düzenlemek için tıklayın`
                      : item.tag
                  }
                  className={`absolute top-0 left-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full backdrop-blur-xs border shadow-md whitespace-nowrap transition-opacity duration-75 ${
                    isActiveBayBadge
                      ? "bg-[#2563EB] text-white border-[#1D4ED8] ring-2 ring-[#2563EB]/30 pointer-events-auto cursor-pointer"
                      : isBayBadge
                      ? "bg-white/95 hover:bg-[#EFF6FF] text-[#111827] border-[#CBD5E1] hover:border-[#2563EB] pointer-events-auto cursor-pointer"
                      : isEditingThis
                      ? "bg-[#EEF3F8] border-2 border-[#3B82F6] ring-2 ring-[#3B82F6]/30 pointer-events-auto cursor-pointer"
                      : badgeKey
                      ? "bg-white/95 hover:bg-[#EEF3F8] hover:border-[#3B82F6] border-[#CBD5E1] pointer-events-auto cursor-pointer group"
                      : "bg-white/95 pointer-events-none border-[#CBD5E1]"
                  }`}
                >
                  <span
                    className={`text-[11px] font-bold leading-none ${
                      isActiveBayBadge ? "text-white" : "text-[#111827]"
                    }`}
                  >
                    {item.tag}
                  </span>
                  <span
                    className={`text-[11px] font-semibold leading-none font-mono ${
                      isActiveBayBadge ? "text-blue-100" : "text-[#111827]"
                    }`}
                  >
                    {item.valueText}
                  </span>
                  {badgeKey && (
                    <span className="text-[10px] text-[#475569] group-hover:text-[#111827] leading-none ml-0.5">
                      ✎
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* FAZ 2: 3D HARDWARE SELECTION PINS & CONTEXTUAL CALLOUT CARDS (Matches Birim_Tasarim_5_Donanim_Mekanizmalar.png) */}
        {showInCanvasHud &&
          (hardwareViewMode === "hardware" || hardwareViewMode === "technical") &&
          hwCallouts.length > 0 && (
            <div
              data-testid="viewport-3d-hardware-callouts"
              className="absolute inset-0 pointer-events-none overflow-hidden z-[18]"
            >
              {hwCallouts.map((hc) => {
                const isSelectedPin = selectedHwCalloutId === hc.id;
                return (
                  <div
                    key={hc.id}
                    data-testid={`viewport-3d-hw-${hc.id}`}
                    ref={(el) => {
                      if (el) {
                        hwCalloutDomMapRef.current.set(hc.id, el);
                      } else {
                        hwCalloutDomMapRef.current.delete(hc.id);
                      }
                    }}
                    style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
                    className="absolute top-0 left-0 transition-opacity duration-75"
                  >
                    {/* Blue 3D Hardware Pin Dot at exact 3D coordinate */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHwCalloutId(hc.id);
                        setActiveBayIndex(hc.bayIndex);
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("birim:select-hardware-3d", {
                              detail: {
                                pinId: hc.id,
                                group: hc.group,
                                bayIndex: hc.bayIndex,
                                sku: hc.sku,
                              },
                            })
                          );
                        }
                      }}
                      className={`-translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-auto cursor-pointer transition-transform hover:scale-125 ${
                        isSelectedPin
                          ? "bg-[#1D4ED8] ring-4 ring-[#2563EB]/40 scale-115"
                          : "bg-[#2563EB] ring-2 ring-[#2563EB]/25"
                      }`}
                      title={`${hc.title}: ${hc.subtitle} — Sağ panelde düzenlemek için tıklayın`}
                    />

                    {/* Leader Line + Contextual Hardware Callout Card */}
                    <button
                      type="button"
                      data-testid={`viewport-3d-hw-card-${hc.group}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHwCalloutId(hc.id);
                        setActiveBayIndex(hc.bayIndex);
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("birim:select-hardware-3d", {
                              detail: {
                                pinId: hc.id,
                                group: hc.group,
                                bayIndex: hc.bayIndex,
                                sku: hc.sku,
                              },
                            })
                          );
                        }
                      }}
                      style={{
                        transform: `translate(${hc.offsetPx[0]}px, ${hc.offsetPx[1]}px)`,
                      }}
                      className={`pointer-events-auto cursor-pointer px-3 py-1.5 rounded-2xl backdrop-blur-md border shadow-xl flex items-center gap-2 text-left whitespace-nowrap transition ${
                        isSelectedPin
                          ? "bg-[#EFF6FF]/98 border-2 border-[#2563EB] ring-2 ring-[#2563EB]/20"
                          : "bg-white/95 hover:bg-[#EFF6FF] border-[#CBD5E1] hover:border-[#2563EB]"
                      }`}
                    >
                      <span className="w-6 h-6 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#111827] shrink-0">
                        {hc.group === "hinge" ? (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="4" y="6" width="6" height="12" rx="1" />
                            <circle cx="15" cy="12" r="3" />
                            <path d="M10 10h2M10 14h2" />
                          </svg>
                        ) : hc.group === "lighting" ? (
                          <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" />
                          </svg>
                        ) : hc.group === "accessories" ? (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M4 12h16M6 10v4M18 10v4" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="3" y="7" width="18" height="10" rx="1.5" />
                            <path d="M9 11h6" />
                          </svg>
                        )}
                      </span>
                      <span className="block">
                        <span className="text-[11px] font-extrabold text-[#111827] block leading-tight">
                          {hc.title}
                        </span>
                        <span className="text-[10px] font-medium text-[#475569] block leading-tight mt-0.5">
                          {hc.subtitle}
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        {/* FAZ 2 (SCREEN 6): 3D PART-LEVEL MATERIAL CALLOUT PINS & CARDS (Matches image_dad0ff.jpg: Üst Tabla, Kapak, Sağ Yan Panel, Çekmece Önü, Soket) */}
        {showInCanvasHud && materialModeActive && matCallouts.length > 0 && (
          <div
            data-testid="viewport-3d-material-callouts"
            className="absolute inset-0 pointer-events-none overflow-hidden z-[19]"
          >
            {matCallouts.map((mc) => {
              const isSelectedPart = selectedComponentId === mc.componentId;
              return (
                <div
                  key={mc.id}
                  data-testid={`viewport-3d-mat-${mc.id}`}
                  ref={(el) => {
                    if (el) {
                      matCalloutDomMapRef.current.set(mc.id, el);
                    } else {
                      matCalloutDomMapRef.current.delete(mc.id);
                    }
                  }}
                  style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
                  className="absolute top-0 left-0 transition-opacity duration-75"
                >
                  {/* Blue 3D Part Selection Dot */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      (setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
                        mc.componentId,
                        activeModuleIndex
                      );
                      if (materialPaintTool === "paint") {
                        applyMaterialByTargetScope("selected_part", activeBrushMaterialId, mc.componentId);
                      } else if (materialPaintTool === "group") {
                        applyMaterialByTargetScope(mc.scope, activeBrushMaterialId, mc.componentId);
                      } else if (materialPaintTool === "same_material") {
                        applyMaterialByTargetScope(
                          "same_material_parts",
                          activeBrushMaterialId,
                          mc.componentId
                        );
                      }
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("birim:select-material-part-3d", {
                            detail: {
                              componentId: mc.componentId,
                              scope: mc.scope,
                              title: mc.title,
                            },
                          })
                        );
                      }
                    }}
                    className={`-translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-auto cursor-pointer transition-transform hover:scale-125 ${
                      isSelectedPart
                        ? "bg-[#1D4ED8] ring-4 ring-[#2563EB]/40 scale-115"
                        : "bg-[#2563EB] ring-2 ring-[#2563EB]/25"
                    }`}
                  />

                  {/* Contextual Material Callout Card */}
                  <button
                    type="button"
                    data-testid={`viewport-3d-mat-card-${mc.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      (setSelectedComponentId as (id: string | null, mIdx?: number) => void)(
                        mc.componentId,
                        activeModuleIndex
                      );
                      if (materialPaintTool === "paint") {
                        applyMaterialByTargetScope("selected_part", activeBrushMaterialId, mc.componentId);
                      } else if (materialPaintTool === "group") {
                        applyMaterialByTargetScope(mc.scope, activeBrushMaterialId, mc.componentId);
                      } else if (materialPaintTool === "same_material") {
                        applyMaterialByTargetScope(
                          "same_material_parts",
                          activeBrushMaterialId,
                          mc.componentId
                        );
                      }
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("birim:select-material-part-3d", {
                            detail: {
                              componentId: mc.componentId,
                              scope: mc.scope,
                              title: mc.title,
                            },
                          })
                        );
                      }
                    }}
                    style={{
                      transform: `translate(${mc.offsetPx[0]}px, ${mc.offsetPx[1]}px)`,
                    }}
                    className={`pointer-events-auto cursor-pointer px-3 py-1.5 rounded-2xl backdrop-blur-md border shadow-xl flex items-center gap-2 text-left whitespace-nowrap transition ${
                      isSelectedPart
                        ? "bg-[#EFF6FF]/98 border-2 border-[#2563EB] ring-2 ring-[#2563EB]/20"
                        : "bg-white/95 hover:bg-[#EFF6FF] border-[#CBD5E1] hover:border-[#2563EB]"
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-lg border border-stone-300 shadow-inner shrink-0"
                      style={{ backgroundColor: mc.colorHex }}
                    />
                    <span className="block">
                      <span className="text-xs font-extrabold text-[#111827] block leading-tight">
                        {mc.title}
                      </span>
                      <span className="text-[11px] font-medium text-[#475569] block leading-tight mt-0.5">
                        {mc.subtitle}
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 3D DIRECT DIMENSION EDITING POPOVER WINDOW (Mevcut değer, Sayısal giriş, Hazır ölçüler, Geçerlilik kontrolü, Enter/Esc) */}
        {editingBadge && (() => {
          const bInfo = dimBounds[editingBadge];
          const draftNum = Number(badgeDraftValue);
          const isNumeric = badgeDraftValue.trim() !== "" && !Number.isNaN(draftNum) && Number.isFinite(draftNum);
          const isOutOfRange = !isNumeric || draftNum < bInfo.min || draftNum > bInfo.max;
          const validPresets = bInfo.presets.filter((p) => p >= bInfo.min && p <= bInfo.max);

          return (
            <div
              data-testid={`viewport-3d-dim-popover-${editingBadge}`}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-20 left-1/2 -translate-x-1/2 z-30 w-80 bg-white/98 backdrop-blur-md rounded-2xl border-2 border-[#CBD5E1] shadow-2xl p-4 space-y-3 text-xs text-[#111827] pointer-events-auto"
            >
              <div className="flex items-start justify-between gap-2 border-b border-[#E2E8F0] pb-2">
                <div>
                  <div className="text-xs font-bold text-[#111827]">
                    📐 {bInfo.label} Düzenle (3D Doğrudan Giriş)
                  </div>
                  <div className="text-[11px] text-[#475569] mt-0.5">
                    Mevcut değer: <b className="font-mono text-[#111827]">{bInfo.current} mm</b> • İzin verilen: <span className="font-mono">{bInfo.min}–{bInfo.max} mm</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingBadge(null)}
                  className="px-1.5 py-0.5 rounded-lg text-[#64748B] hover:text-[#111827] hover:bg-[#F1F5F9] cursor-pointer"
                  title="İptal (Esc)"
                >
                  ✕
                </button>
              </div>

              {bInfo.isFixed ? (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium">
                  Bu modül sabit genişlikli bir şablondur ({bInfo.current} mm). Genişliği değiştirilemez.
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitBadgeEdit();
                  }}
                  className="space-y-3"
                >
                  {/* Numeric Input + Stepper */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.max(bInfo.min, (isNumeric ? draftNum : bInfo.current) - bInfo.step);
                        setBadgeDraftValue(String(next));
                      }}
                      className="h-9 px-2.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] font-mono text-xs font-bold text-[#111827] cursor-pointer"
                    >
                      −{bInfo.step}
                    </button>
                    <div className="flex-1 flex items-center justify-between bg-[#F8FAFC] rounded-xl border border-[#94A3B8] px-3 py-1.5">
                      <input
                        type="number"
                        data-testid={`viewport-3d-dim-input-${editingBadge}`}
                        autoFocus
                        min={bInfo.min}
                        max={bInfo.max}
                        step={bInfo.step}
                        value={badgeDraftValue}
                        onChange={(e) => setBadgeDraftValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setEditingBadge(null);
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            commitBadgeEdit();
                          }
                        }}
                        className="w-full font-mono text-sm font-bold text-[#111827] bg-transparent focus:outline-none text-center"
                      />
                      <span className="text-[11px] font-semibold text-[#475569] ml-1">mm</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.min(bInfo.max, (isNumeric ? draftNum : bInfo.current) + bInfo.step);
                        setBadgeDraftValue(String(next));
                      }}
                      className="h-9 px-2.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] font-mono text-xs font-bold text-[#111827] cursor-pointer"
                    >
                      +{bInfo.step}
                    </button>
                  </div>

                  {/* Live Validity Check Feedback */}
                  {isOutOfRange ? (
                    <div
                      data-testid="viewport-3d-dim-validation-error"
                      className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px] font-semibold flex items-center justify-between gap-2"
                    >
                      <span>
                        ⚠️ Geçersiz ölçü! İzin verilen aralık: {bInfo.min} – {bInfo.max} mm.
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setBadgeDraftValue(
                            String(Math.max(bInfo.min, Math.min(bInfo.max, draftNum || bInfo.min)))
                          )
                        }
                        className="px-2 py-0.5 rounded bg-white border border-red-300 text-[10px] font-bold text-red-900 shrink-0 cursor-pointer"
                      >
                        Sınıra Çek
                      </button>
                    </div>
                  ) : (
                    <div className="px-2.5 py-1.5 rounded-xl bg-[#EEF3F8] border border-[#CBD5E1] text-[10px] text-[#111827] flex items-center justify-between">
                      <span>✓ Parametrik kurallara uygun</span>
                      <span className="font-mono font-bold">
                        Δ {draftNum - bInfo.current >= 0 ? `+${draftNum - bInfo.current}` : draftNum - bInfo.current} mm
                      </span>
                    </div>
                  )}

                  {/* Supported Quick Preset Dimension Chips */}
                  {validPresets.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">
                        Hazır Ölçü Seçenekleri (mm):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {validPresets.map((presetVal) => {
                          const isCurrent = draftNum === presetVal;
                          return (
                            <button
                              key={presetVal}
                              type="button"
                              data-testid={`viewport-3d-dim-preset-${presetVal}`}
                              onClick={() => {
                                setBadgeDraftValue(String(presetVal));
                                commitBadgeEdit(presetVal);
                              }}
                              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold border transition cursor-pointer ${
                                isCurrent
                                  ? "bg-[#EEF3F8] text-[#111827] border-[#3B82F6] shadow-2xs"
                                  : "bg-white hover:bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]"
                              }`}
                            >
                              {presetVal}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Confirm (Enter) & Cancel (Escape) Buttons */}
                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-[#E2E8F0]">
                    <button
                      type="button"
                      data-testid="viewport-3d-dim-cancel-btn"
                      onClick={() => setEditingBadge(null)}
                      className="px-3 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] text-[11px] font-semibold cursor-pointer"
                    >
                      İptal (Esc)
                    </button>
                    <button
                      type="submit"
                      data-testid="viewport-3d-dim-confirm-btn"
                      disabled={isOutOfRange}
                      className="px-4 py-1.5 rounded-xl bg-[#EEF3F8] hover:bg-[#E4ECF4] disabled:opacity-40 text-[#111827] border border-[#94A3B8] text-[11px] font-bold cursor-pointer"
                    >
                      Onayla (Enter)
                    </button>
                  </div>
                </form>
              )}
            </div>
          );
        })()}

        {/* 3D DIRECT INTERACTION MINI CONTEXT MENU (Door Click -> Hide Doors / Compartment Selection Bar) */}
        {showInCanvasHud && (clicked3DContext || doorsHiddenIn3D || doorOpenAngleDeg > 5) && (
          <div
            data-testid="viewport-3d-context-mini-menu"
            className="absolute top-18 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center justify-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-[#CBD5E1] shadow-lg text-xs text-[#111827]"
          >
            {clicked3DContext?.kind === "door" && !doorsHiddenIn3D ? (
              <>
                <span className="px-2 py-0.5 rounded-lg bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] font-bold text-[11px]">
                  🚪 {clicked3DContext.label} Seçildi
                </span>
                <button
                  type="button"
                  data-testid="mini-menu-hide-doors-btn"
                  onClick={() => {
                    setDoorsHiddenIn3D(true);
                    setClicked3DContext({
                      kind: "bay",
                      bayIndex: clicked3DContext.bayIndex,
                      role: "bay_compartment",
                      label: `Bölme ${clicked3DContext.bayIndex + 1}`,
                    });
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("birim:select-bay-3d", {
                          detail: {
                            bayIndex: clicked3DContext.bayIndex,
                            role: "bay_compartment",
                            moduleIndex: activeModuleIndex,
                          },
                        })
                      );
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl bg-[#EEF3F8] hover:bg-[#E4ECF4] text-[#111827] border border-[#94A3B8] font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                >
                  <span>👁️ Kapakları Gizle (İç Düzenle)</span>
                </button>
                <button
                  type="button"
                  data-testid="mini-menu-open-door-btn"
                  onClick={() => toggleDoorOpen()}
                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#111827] border border-[#CBD5E1] font-semibold cursor-pointer transition"
                >
                  {doorOpenAngleDeg > 0 ? "Kapağı Kapat (0°)" : "Kapağı Aç (85°)"}
                </button>
                <button
                  type="button"
                  data-testid="mini-menu-flip-door-btn"
                  onClick={() => flipActiveDoorDirection(clicked3DContext.bayIndex)}
                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#F1F5F9] text-[#111827] border border-[#CBD5E1] font-semibold cursor-pointer transition"
                >
                  ⇄ Yön Çevir
                </button>
                <button
                  type="button"
                  onClick={() => setClicked3DContext(null)}
                  className="px-1.5 py-0.5 rounded-lg text-[#64748B] hover:text-[#111827] cursor-pointer"
                  title="Mini menüyü kapat"
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <span className="text-[11px] font-bold text-[#111827] mr-1">
                  🎯 3D Bölme Seçimi:
                </span>
                {activeModule.bays.map((b, bIdx) => {
                  const isSelBay = activeBayIndex === bIdx;
                  return (
                    <button
                      key={b.index}
                      type="button"
                      data-testid={`viewport-3d-bay-pill-${bIdx}`}
                      onClick={() => {
                        setActiveBayIndex(bIdx);
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("birim:select-bay-3d", {
                              detail: {
                                bayIndex: bIdx,
                                role: "bay_compartment",
                                moduleIndex: activeModuleIndex,
                              },
                            })
                          );
                        }
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                        isSelBay
                          ? "bg-[#EEF3F8] text-[#111827] border border-[#94A3B8] shadow-2xs"
                          : "bg-white hover:bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]"
                      }`}
                    >
                      Bölme {bIdx + 1}
                    </button>
                  );
                })}
                {doorsHiddenIn3D && (
                  <button
                    type="button"
                    data-testid="mini-menu-show-doors-btn"
                    onClick={() => {
                      setDoorsHiddenIn3D(false);
                      setClicked3DContext(null);
                    }}
                    className="ml-1 px-2.5 py-1 rounded-xl bg-[#EEF3F8] hover:bg-[#E4ECF4] text-[#111827] border border-[#94A3B8] text-[11px] font-bold cursor-pointer transition"
                  >
                    🚪 Kapakları Göster
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* FLOATING 3D DOOR CONTEXTUAL MENU (Matches image_e5c524.jpg: "Kapak İşlemleri" -> Kapak Tipini Değiştir, Açılma Yönü, Kulp Değiştir, Kapak Malzemesi, Bu Kapağı Kopyala) */}
        {showInCanvasHud &&
          clicked3DContext?.kind === "door" &&
          !doorsHiddenIn3D &&
          (() => {
            const targetBayIdx = Math.min(
              clicked3DContext.bayIndex,
              Math.max(0, activeModule.bays.length - 1)
            );
            const targetBay = activeModule.bays[targetBayIdx] || activeModule.bays[0];
            const targetDoorCompId =
              clicked3DContext.componentId || selectedComponentId || `${targetBay?.door?.id}_left`;
            const curDoorProf =
              targetBay?.door?.crossSectionProfile ||
              activeModule.carcass.crossSectionProfile ||
              "flat_slab";
            const curHandleSku = targetBay?.door?.handleProfileId || "K019";

            return (
              <div
                ref={doorPopoverDomRef}
                data-testid="viewport-3d-floating-door-card"
                onClick={(e) => e.stopPropagation()}
                style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
                className="absolute top-0 left-0 z-[25] w-56 bg-white/98 backdrop-blur-md rounded-2xl border border-[#CBD5E1] shadow-2xl p-3 space-y-1.5 text-xs text-[#111827] pointer-events-auto transition-opacity duration-75"
              >
                <div className="flex items-center justify-between px-1 pb-1.5 border-b border-[#E2E8F0]">
                  <div>
                    <div className="font-bold text-xs text-[#111827]">Kapak İşlemleri</div>
                    <div className="text-[10px] text-[#64748B] font-medium">
                      {clicked3DContext.label}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setClicked3DContext(null);
                      setDoorMenuSubSection(null);
                    }}
                    title="Menüyü kapat"
                    className="text-xs text-[#64748B] hover:text-[#111827] px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* 1. Kapak Tipini Değiştir */}
                <button
                  type="button"
                  data-testid="floating-door-change-type"
                  onClick={() =>
                    setDoorMenuSubSection((prev) => (prev === "type" ? null : "type"))
                  }
                  className="w-full px-2 py-1.5 rounded-xl hover:bg-[#EEF3F8] text-[#111827] font-semibold flex items-center justify-between gap-2 text-left transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[#475569] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="4" y="3" width="16" height="18" rx="2" />
                      <path d="M9 3v18" />
                    </svg>
                    <span>Kapak Tipini Değiştir</span>
                  </span>
                  <span className="text-[10px] text-[#64748B]">›</span>
                </button>
                {doorMenuSubSection === "type" && (
                  <div className="grid grid-cols-5 gap-1 p-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    {[
                      { id: "flat_slab", label: "Düz" },
                      { id: "shaker_frame", label: "Çerçeve" },
                      { id: "fluted_ribbed", label: "Fitilli" },
                      { id: "glass_frame", label: "Cam" },
                      { id: "mirror_door", label: "Ayna" },
                    ].map((pt) => (
                      <button
                        key={pt.id}
                        type="button"
                        data-testid={`floating-door-type-${pt.id}`}
                        onClick={() => {
                          setBayV4DoorConfig(targetBayIdx, {
                            crossSectionProfile: pt.id as import("@birim/core").DoorCrossSectionProfile,
                            isGlassFramed: pt.id === "glass_frame",
                          });
                        }}
                        className={`py-1 px-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          curDoorProf === pt.id
                            ? "bg-[#2563EB] text-white"
                            : "bg-white hover:bg-[#EEF3F8] text-[#111827] border border-[#E2E8F0]"
                        }`}
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* 2. Açılma Yönü */}
                <button
                  type="button"
                  data-testid="floating-door-change-direction"
                  onClick={() =>
                    setDoorMenuSubSection((prev) => (prev === "direction" ? null : "direction"))
                  }
                  className="w-full px-2 py-1.5 rounded-xl hover:bg-[#EEF3F8] text-[#111827] font-semibold flex items-center justify-between gap-2 text-left transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[#475569] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 12h16M15 7l5 5-5 5" />
                    </svg>
                    <span>Açılma Yönü</span>
                  </span>
                  <span className="text-[10px] text-[#64748B]">›</span>
                </button>
                {doorMenuSubSection === "direction" && (
                  <div className="grid grid-cols-3 gap-1 p-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    {[
                      { id: "single_left", label: "Sol" },
                      { id: "single_right", label: "Sağ" },
                      { id: "double", label: "Çift" },
                    ].map((dir) => (
                      <button
                        key={dir.id}
                        type="button"
                        data-testid={`floating-door-dir-${dir.id}`}
                        onClick={() =>
                          setBayDoorType(
                            targetBayIdx,
                            dir.id as "single_left" | "single_right" | "double"
                          )
                        }
                        className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          targetBay?.door?.type === dir.id
                            ? "bg-[#2563EB] text-white"
                            : "bg-white hover:bg-[#EEF3F8] text-[#111827] border border-[#E2E8F0]"
                        }`}
                      >
                        {dir.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* 3. Kulp Değiştir */}
                <button
                  type="button"
                  data-testid="floating-door-change-handle"
                  onClick={() =>
                    setDoorMenuSubSection((prev) => (prev === "handle" ? null : "handle"))
                  }
                  className="w-full px-2 py-1.5 rounded-xl hover:bg-[#EEF3F8] text-[#111827] font-semibold flex items-center justify-between gap-2 text-left transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[#475569] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M6 18L18 6M8 6h10v10" />
                    </svg>
                    <span>Kulp Değiştir</span>
                  </span>
                  <span className="text-[10px] text-[#64748B]">{curHandleSku}</span>
                </button>
                {doorMenuSubSection === "handle" && (
                  <div className="grid grid-cols-2 gap-1 p-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    {[
                      { sku: "K019", label: "K019 Mat Siyah", mat: "mat_handle_matte_black", cat: "bar_handle" as const },
                      { sku: "K020", label: "K020 Inox", mat: "mat_handle_inox", cat: "bar_handle" as const },
                      { sku: "K021", label: "K021 Pirinç", mat: "mat_handle_brass", cat: "bar_handle" as const },
                      { sku: "K022", label: "K022 Antrasit", mat: "mat_handle_anthracite", cat: "bar_handle" as const },
                    ].map((hk) => (
                      <button
                        key={hk.sku}
                        type="button"
                        data-testid={`floating-door-handle-${hk.sku}`}
                        onClick={() =>
                          setBayV4DoorConfig(targetBayIdx, {
                            handleCategory: hk.cat,
                            handleProfileId: hk.sku,
                            handleMaterialId: hk.mat,
                          })
                        }
                        className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          curHandleSku === hk.sku
                            ? "bg-[#2563EB] text-white"
                            : "bg-white hover:bg-[#EEF3F8] text-[#111827] border border-[#E2E8F0]"
                        }`}
                      >
                        {hk.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* 4. Kapak Malzemesi (Applies ONLY to this selected door leaf unless copied!) */}
                <button
                  type="button"
                  data-testid="floating-door-change-material"
                  onClick={() =>
                    setDoorMenuSubSection((prev) => (prev === "material" ? null : "material"))
                  }
                  className="w-full px-2 py-1.5 rounded-xl hover:bg-[#EEF3F8] text-[#111827] font-semibold flex items-center justify-between gap-2 text-left transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[#475569] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="8" r="1.5" fill="currentColor" />
                      <circle cx="8.5" cy="13" r="1.5" fill="currentColor" />
                      <circle cx="15.5" cy="13" r="1.5" fill="currentColor" />
                    </svg>
                    <span>Kapak Malzemesi</span>
                  </span>
                  <span className="text-[10px] text-[#64748B]">›</span>
                </button>
                {doorMenuSubSection === "material" && (
                  <div className="p-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                    <div className="text-[9px] font-bold text-[#475569]">
                      Sadece seçili kapağa renk/doku ata:
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {DEFAULT_MATERIALS.filter(
                        (m) =>
                          m.category === "wood" ||
                          m.category === "lacquer" ||
                          m.category === "laminate" ||
                          m.category === "glass" ||
                          m.category === "mirror"
                      )
                        .slice(0, 6)
                        .map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            data-testid={`floating-door-mat-${m.id}`}
                            onClick={() => {
                              setSelectedComponentMaterial(m.id, targetDoorCompId);
                              setDragDropSnapBanner(
                                `🎨 ${clicked3DContext.label}: "${m.name.split(" (")[0]}" atandı`
                              );
                              setTimeout(() => setDragDropSnapBanner(null), 2200);
                            }}
                            className="p-1 rounded-lg bg-white hover:bg-[#EEF3F8] border border-[#E2E8F0] flex items-center gap-1 text-[9px] font-bold text-[#111827] truncate cursor-pointer"
                            title={m.name}
                          >
                            <span
                              className="w-3 h-3 rounded-xs border border-stone-300 shrink-0"
                              style={{ backgroundColor: m.colorHex }}
                            />
                            <span className="truncate">{m.name.split(" ")[2] || m.name.split(" ")[0]}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* 5. Bu Kapağı Kopyala (Tüm Kapaklara Uygula) */}
                <button
                  type="button"
                  data-testid="floating-door-copy-to-all"
                  onClick={() => {
                    copyDoorConfigToAllBays(targetBayIdx);
                    setDragDropSnapBanner(
                      "✓ Seçili kapak tipi, kulp ve malzeme ayarları tüm uygun kapaklara kopyalandı"
                    );
                    setTimeout(() => setDragDropSnapBanner(null), 2600);
                  }}
                  className="w-full px-2 py-1.5 rounded-xl hover:bg-[#EEF3F8] text-[#111827] font-semibold flex items-center gap-2 text-left transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-[#475569] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  <span>Bu Kapağı Kopyala</span>
                </button>

                {/* 6. Kapakları Gizle / Aç (İç Düzen Geçişi) */}
                <div className="pt-1 border-t border-[#E2E8F0] flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => toggleDoorOpen()}
                    className="flex-1 py-1 px-2 rounded-lg bg-[#F8FAFC] hover:bg-[#EEF3F8] border border-[#E2E8F0] text-[10px] font-bold text-[#111827] cursor-pointer"
                  >
                    {doorOpenAngleDeg > 0 ? "Kapağı Kapat" : "Kapağı Aç"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDoorsHiddenIn3D(true);
                      setClicked3DContext({
                        kind: "bay",
                        bayIndex: targetBayIdx,
                        role: "bay_compartment",
                        label: `Bölme ${targetBayIdx + 1}`,
                      });
                    }}
                    className="flex-1 py-1 px-2 rounded-lg bg-[#F8FAFC] hover:bg-[#EEF3F8] border border-[#E2E8F0] text-[10px] font-bold text-[#475569] hover:text-[#111827] cursor-pointer"
                  >
                    İçini Göster
                  </button>
                </div>
              </div>
            );
          })()}

        {/* FLOATING 3D COMPARTMENT POPOVER CARD (Matches image_e548e6.jpg: Bölme X -> Raf Ekle, Askılık Ekle, Çekmece Ekle, Aksesuar Ekle, Bölme Ayarları, Şablon Uygula, Bölmeyi Sil) */}
        {showInCanvasHud && !dismissedBayPopover && (cutawayActiveBay || doorsHiddenIn3D || doorOpenAngleDeg > 5) && (
          <div
            ref={bayPopoverDomRef}
            data-testid="viewport-3d-floating-bay-card"
            onClick={(e) => e.stopPropagation()}
            style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
            className="absolute top-0 left-0 z-[15] w-52 bg-white/98 backdrop-blur-md rounded-2xl border border-[#CBD5E1] shadow-2xl p-2.5 space-y-1 text-xs text-[#111827] pointer-events-auto transition-opacity duration-75"
          >
            <div className="flex items-center justify-between px-1.5 pb-1.5 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-[#111827]">
                  Bölme {activeBayIndex + 1}
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-[#EFF6FF] text-[#2563EB] font-mono text-[10px] font-bold">
                  {calculateFourSpaceDimensions(activeModule).usableInternal.bayClearWidthsMm[activeBayIndex] || 600} mm
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDismissedBayPopover(true);
                  setCutawayActiveBay(false);
                  setBayMenuSubSection(null);
                }}
                title="Bölme menüsünü kapat"
                className="text-[10px] text-[#64748B] hover:text-[#111827] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <button
              type="button"
              data-testid="floating-bay-add-shelf"
              onClick={() => addShelf(activeBayIndex)}
              className="w-full px-2 py-1.5 rounded-xl hover:bg-[#EEF3F8] text-[#111827] font-medium flex items-center gap-2 text-left transition cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-[#475569] shrink-0" />
              <span>Raf Ekle</span>
            </button>
            <button
              type="button"
              data-testid="floating-bay-add-rail"
              onClick={() => addHangingRail(activeBayIndex)}
              className="w-full px-2 py-1.5 rounded-xl hover:bg-[#EEF3F8] text-[#111827] font-medium flex items-center gap-2 text-left transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-[#475569] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 4a2 2 0 012 2c0 1.1-.9 2-2 2v2l8 5v2H4v-2l8-5V8" />
              </svg>
              <span>Askılık Ekle</span>
            </button>
            <button
              type="button"
              data-testid="floating-bay-add-drawer"
              onClick={() => addDrawer(activeBayIndex)}
              className="w-full px-2 py-1.5 rounded-xl hover:bg-[#EEF3F8] text-[#111827] font-medium flex items-center gap-2 text-left transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#475569] shrink-0" />
              <span>Çekmece Ekle</span>
            </button>

            {/* Aksesuar Ekle › */}
            <button
              type="button"
              data-testid="floating-bay-add-accessory"
              onClick={() =>
                setBayMenuSubSection((prev) => (prev === "accessories" ? null : "accessories"))
              }
              className="w-full px-2 py-1.5 rounded-xl hover:bg-[#EEF3F8] text-[#111827] font-medium flex items-center justify-between gap-2 text-left transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-[#475569] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="6" width="18" height="12" rx="2" />
                  <path d="M7 6v12M11 6v12M15 6v12M19 6v12" />
                </svg>
                <span>Aksesuar Ekle</span>
              </span>
              <span className="text-[10px] text-[#64748B]">›</span>
            </button>
            {bayMenuSubSection === "accessories" && (
              <div className="grid grid-cols-2 gap-1 p-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                {[
                  { type: "trouser_rack" as const, label: "Pantolonluk" },
                  { type: "shoe_rack" as const, label: "Ayakkabılık" },
                  { type: "tie_rack" as const, label: "Kravatlık" },
                  { type: "belt_rack" as const, label: "Kemerlik" },
                  { type: "wardrobe_lift" as const, label: "Asansör" },
                  { type: "wire_basket" as const, label: "Tel Sepet" },
                ].map((acc) => (
                  <button
                    key={acc.type}
                    type="button"
                    data-testid={`floating-bay-acc-${acc.type}`}
                    onClick={() => {
                      addSpecialFitting(activeBayIndex, acc.type);
                      setBayMenuSubSection(null);
                    }}
                    className="py-1 px-1.5 rounded-lg bg-white hover:bg-[#EFF6FF] text-[#111827] border border-[#E2E8F0] hover:border-[#2563EB] text-[10px] font-bold transition cursor-pointer text-left truncate"
                  >
                    + {acc.label}
                  </button>
                ))}
              </div>
            )}

            {/* Bölme Ayarları */}
            <button
              type="button"
              data-testid="floating-bay-open-settings"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("birim:select-bay-3d", {
                      detail: {
                        bayIndex: activeBayIndex,
                        role: "bay_compartment",
                        moduleIndex: activeModuleIndex,
                      },
                    })
                  );
                }
              }}
              className="w-full px-2 py-1.5 rounded-xl hover:bg-[#EEF3F8] text-[#111827] font-medium flex items-center gap-2 text-left transition cursor-pointer border-t border-[#F1F5F9] pt-1.5"
            >
              <svg className="w-3.5 h-3.5 text-[#475569] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              <span>Bölme Ayarları</span>
            </button>

            {/* Şablon Uygula › */}
            <button
              type="button"
              data-testid="floating-bay-apply-template"
              onClick={() =>
                setBayMenuSubSection((prev) => (prev === "templates" ? null : "templates"))
              }
              className="w-full px-2 py-1.5 rounded-xl hover:bg-[#EEF3F8] text-[#111827] font-medium flex items-center justify-between gap-2 text-left transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-[#475569] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
                <span>Şablon Uygula</span>
              </span>
              <span className="text-[10px] text-[#64748B]">›</span>
            </button>
            {bayMenuSubSection === "templates" && (
              <div className="space-y-1 p-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                {[
                  { id: "shirt_shelf" as const, label: "Gömlek + Raf" },
                  { id: "dress_drawer" as const, label: "Elbise + Çekmece" },
                  { id: "mixed_combo" as const, label: "Karma Düzen" },
                  { id: "shelves_5" as const, label: "5 Raflı İstif" },
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    data-testid={`floating-bay-tpl-${tpl.id}`}
                    onClick={() => {
                      applyBayInteriorPreset(activeBayIndex, tpl.id);
                      setBayMenuSubSection(null);
                    }}
                    className="w-full py-1 px-2 rounded-lg bg-white hover:bg-[#EFF6FF] text-[#111827] border border-[#E2E8F0] hover:border-[#2563EB] text-[10px] font-bold transition cursor-pointer text-left"
                  >
                    ✓ {tpl.label}
                  </button>
                ))}
              </div>
            )}

            {/* Bölmeyi Sil */}
            {activeModule.bays.length > 1 && (
              <button
                type="button"
                data-testid="floating-bay-delete-bay"
                onClick={() => {
                  removeBayAt(activeBayIndex);
                  setDragDropSnapBanner(`🗑️ Bölme ${activeBayIndex + 1} silindi ve komşu bölme ile birleştirildi`);
                  setTimeout(() => setDragDropSnapBanner(null), 2200);
                }}
                className="w-full px-2 py-1.5 rounded-xl hover:bg-red-50 text-red-600 font-semibold flex items-center gap-2 text-left transition cursor-pointer border-t border-[#F1F5F9] pt-1.5"
              >
                <svg className="w-3.5 h-3.5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
                <span>Bölmeyi Sil</span>
              </button>
            )}
          </div>
        )}

        {/* Live Cross-Module / Cross-Bay Elevation Snap Badge during 3D Drag */}
        {active3DSnap && (
          <div
            data-testid="in-canvas-snap-badge"
            className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3.5 py-1.5 rounded-full bg-white/95 text-[#1C1917] border border-[#CBD5E1] shadow-lg text-xs font-bold flex items-center gap-2"
          >
            <span>🎯 Hizalandı: {active3DSnap.label}</span>
            <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#1C1917] font-mono">
              Y: {active3DSnap.elevationY} mm
            </span>
          </div>
        )}

        {/* LEFT VERTICAL VIEW & CAMERA PILL (Design Studio: 3D | 2D Plan | Ön | Yan | Üst | İç Görünüm | Fit) */}
        <div
          data-testid="viewport-3d-visual-quality-bar"
          className="absolute left-4 top-4 z-20 flex flex-col items-center gap-1 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-[#E2E8F0] shadow-md text-[#2B2927] w-[58px]"
        >
          {[
            {
              id: "3d",
              label: "3D",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3L4 7.5v9L12 21l8-4.5v-9L12 3z" />
                  <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("3d");
                const group = meshGroupRef.current,
                  controls = controlsRef.current,
                  perspective = perspCamRef.current;
                if (group && controls && perspective) {
                  const bounds = new THREE.Box3().setFromObject(group);
                  if (!bounds.isEmpty()) {
                    const center = bounds.getCenter(new THREE.Vector3());
                    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
                    const dist = Math.max(1200, radius * 2.35);
                    const dir = new THREE.Vector3(0.95, 0.55, 1.35).normalize();
                    controls.target.copy(center);
                    perspective.position.copy(center).addScaledVector(dir, dist);
                    perspective.lookAt(center);
                    perspective.updateProjectionMatrix();
                    controls.update();
                    requestRender();
                  }
                }
              },
            },
            {
              id: "2d-elevation",
              label: "2D Cephe",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M12 3v18M3 15h18" />
                </svg>
              ),
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("birim:studio-view-change", { detail: "2d-elevation" })
                  );
                }
              },
            },
            {
              id: "2d-section",
              label: "2D Kesit",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                  <path d="M5 9h14M5 15h14" />
                </svg>
              ),
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("birim:studio-view-change", { detail: "2d-section" })
                  );
                }
              },
            },
            {
              id: "2d",
              label: "2D Plan",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 9v12" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("2d");
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("birim:studio-view-change", { detail: "plan" }));
                }
              },
            },
            {
              id: "front",
              label: "Ön",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M4 9h16" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("front");
                const group = meshGroupRef.current,
                  controls = controlsRef.current,
                  perspective = perspCamRef.current;
                if (group && controls && perspective) {
                  const bounds = new THREE.Box3().setFromObject(group);
                  if (!bounds.isEmpty()) {
                    const center = bounds.getCenter(new THREE.Vector3());
                    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
                    const dist = Math.max(1200, radius * 2.3);
                    controls.target.copy(center);
                    perspective.position.set(center.x, center.y + 80, center.z + dist);
                    perspective.lookAt(center);
                    perspective.updateProjectionMatrix();
                    controls.update();
                    requestRender();
                  }
                }
              },
            },
            {
              id: "side",
              label: "Yan",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M12 4v16" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("side");
                const group = meshGroupRef.current,
                  controls = controlsRef.current,
                  perspective = perspCamRef.current;
                if (group && controls && perspective) {
                  const bounds = new THREE.Box3().setFromObject(group);
                  if (!bounds.isEmpty()) {
                    const center = bounds.getCenter(new THREE.Vector3());
                    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
                    const dist = Math.max(1200, radius * 2.3);
                    controls.target.copy(center);
                    perspective.position.set(center.x + dist, center.y + 80, center.z + 180);
                    perspective.lookAt(center);
                    perspective.updateProjectionMatrix();
                    controls.update();
                    requestRender();
                  }
                }
              },
            },
            {
              id: "top",
              label: "Üst",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M4 15h16" />
                </svg>
              ),
              onClick: () => {
                setActiveCamPill("top");
                const group = meshGroupRef.current,
                  controls = controlsRef.current,
                  perspective = perspCamRef.current;
                if (group && controls && perspective) {
                  const bounds = new THREE.Box3().setFromObject(group);
                  if (!bounds.isEmpty()) {
                    const center = bounds.getCenter(new THREE.Vector3());
                    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
                    const dist = Math.max(1400, radius * 2.4);
                    controls.target.copy(center);
                    perspective.position.set(center.x, center.y + dist, center.z + 120);
                    perspective.lookAt(center);
                    perspective.updateProjectionMatrix();
                    controls.update();
                    requestRender();
                  }
                }
              },
            },
            {
              id: "interior",
              label: "İç Görünüm",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              ),
              onClick: () => {
                setCutawayActiveBay((v) => !v);
                setActiveCamPill((prev) => (prev === "interior" ? "3d" : "interior"));
              },
            },
            {
              id: "hide-doors",
              label: doorsHiddenIn3D ? "Kapak Göster" : "Kapakları Gizle",
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ),
              onClick: () => {
                setDoorsHiddenIn3D((v) => !v);
              },
            },
          ].map((btn) => {
            const isActive =
              btn.id === "interior"
                ? doorOpenAngleDeg > 10 || activeCamPill === "interior"
                : activeCamPill === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                data-testid={`viewport-3d-pill-${btn.id}`}
                onClick={btn.onClick}
                className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                  isActive
                    ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] shadow-xs"
                    : "text-[#57534E] hover:bg-[#F1F5F9] hover:text-[#1C1917]"
                }`}
              >
                {btn.icon}
                <span className="text-[9px] font-semibold leading-tight text-center">
                  {btn.label}
                </span>
              </button>
            );
          })}

          <div className="w-8 h-px bg-[#E2E8F0] my-0.5" />

          <button
            type="button"
            data-testid="in-canvas-fit-scene"
            title="Sahneye Sığdır"
            onClick={() => {
              const group = meshGroupRef.current,
                controls = controlsRef.current,
                perspective = perspCamRef.current,
                orthographic = orthoCamRef.current;
              if (!group || !controls || !perspective || !orthographic) return;
              const bounds = new THREE.Box3().setFromObject(group);
              if (bounds.isEmpty()) return;
              const center = bounds.getCenter(new THREE.Vector3());
              const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
              const halfFov = Math.atan(
                Math.tan((perspective.fov * Math.PI) / 360) * Math.min(1, perspective.aspect)
              );
              const distance = Math.max(500, (radius / Math.sin(halfFov)) * 1.15);
              const direction = new THREE.Vector3(1, 0.7, 1.3).normalize();
              controls.maxDistance = Math.max(14000, distance * 3);
              controls.target.copy(center);
              for (const camera of [perspective, orthographic]) {
                camera.position.copy(center).addScaledVector(direction, distance);
                camera.far = Math.max(25000, distance * 5);
                camera.lookAt(center);
              }
              perspective.updateProjectionMatrix();
              orthographic.updateProjectionMatrix();
              controls.update();
              requestRender();
            }}
            className="w-full py-2 rounded-xl flex items-center justify-center text-[#57534E] hover:bg-[#F1F5F9] hover:text-[#1C1917] transition cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </div>

        {/* TOP-CENTER CONTEXTUAL ACTION BAR (Design Studio: Seç | Taşı | Ölçü | Kopyala | Aynala | Sil) */}
        {showInCanvasHud && (
          <div
            data-testid="in-canvas-direct-hud"
            className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-[#E2E8F0] shadow-md text-[#2B2927]"
          >
            {materialModeActive && (
              <>
                {[
                  {
                    id: "select" as const,
                    label: "Seç",
                    testId: "hud-mat-tool-select",
                    icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5 3l14 8-6.5 2L9 19.5 5 3z" />
                      </svg>
                    ),
                  },
                  {
                    id: "paint" as const,
                    label: "Boya",
                    testId: "hud-mat-tool-paint",
                    icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M19 11l-8-8-8.6 8.6a2 2 0 000 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11z" />
                        <path d="M20 14c1.1 1.5 2 3.2 2 4.5a2 2 0 01-4 0c0-1.3.9-3 2-4.5z" />
                      </svg>
                    ),
                  },
                  {
                    id: "group" as const,
                    label: "Bölge",
                    testId: "hud-mat-tool-group",
                    icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 3" />
                      </svg>
                    ),
                  },
                  {
                    id: "same_material" as const,
                    label: "Aynı Malzeme",
                    testId: "hud-mat-tool-same-mat",
                    icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="8" y="8" width="12" height="12" rx="2" />
                        <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
                      </svg>
                    ),
                  },
                ].map((mTool) => (
                  <button
                    key={mTool.id}
                    type="button"
                    data-testid={mTool.testId}
                    onClick={() => setMaterialPaintTool(mTool.id)}
                    className={`px-3 py-1.5 rounded-xl flex flex-col items-center gap-0.5 transition cursor-pointer ${
                      materialPaintTool === mTool.id
                        ? "bg-[#EFF6FF] text-[#1D4ED8] border border-[#2563EB] font-bold"
                        : "text-[#57534E] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    {mTool.icon}
                    <span className="text-[10px]">{mTool.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="hud-mat-tool-clear"
                  onClick={() => {
                    resetModuleMaterialOverrides();
                    setDragDropSnapBanner("🧹 Özel parça malzeme atamaları temizlendi");
                    setTimeout(() => setDragDropSnapBanner(null), 2000);
                  }}
                  className="px-3 py-1.5 rounded-xl flex flex-col items-center gap-0.5 text-red-600 hover:bg-red-50 transition cursor-pointer"
                  title="Özel parça malzeme atamalarını sıfırla"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                  <span className="text-[10px] font-medium">Temizle</span>
                </button>
                <div className="h-6 w-px bg-[#E2E8F0] mx-0.5" />
              </>
            )}
            {/* 1. Seç */}
            <button
              type="button"
              data-testid="hud-tool-select"
              onClick={() => setMoveObjectMode3D(false)}
              className={`px-3 py-1.5 rounded-xl flex flex-col items-center gap-0.5 transition cursor-pointer ${
                !moveObjectMode3D
                  ? "bg-[#F1F5F9] text-[#1C1917] font-semibold"
                  : "text-[#57534E] hover:bg-[#F8F6F2]"
              }`}
              title="Seçim ve İnceleme Modu"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 3l14 8-6.5 2L9 19.5 5 3z" />
              </svg>
              <span className="text-[10px]">Seç</span>
            </button>

            {/* 2. Taşı */}
            <button
              type="button"
              data-testid="viewport-3d-move-mode-toggle"
              onClick={() => setMoveObjectMode3D((v) => !v)}
              className={`px-3 py-1.5 rounded-xl flex flex-col items-center gap-0.5 transition cursor-pointer ${
                moveObjectMode3D
                  ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] font-semibold"
                  : "text-[#57534E] hover:bg-[#F8F6F2]"
              }`}
              title="Modülü 3D Sahnede Tutup Taşı (Mıknatıslı Duvar Hizalama)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
              </svg>
              <span className="text-[10px]">Taşı</span>
            </button>

            {/* 3. Ölçü */}
            <button
              type="button"
              data-testid="in-canvas-toggle-dimensions"
              onClick={handleToggleDimensions}
              className={`px-3 py-1.5 rounded-xl flex flex-col items-center gap-0.5 transition cursor-pointer ${
                effectiveShowDimensions
                  ? "bg-[#F1F5F9] text-[#1C1917] font-semibold"
                  : "text-[#57534E] hover:bg-[#F8F6F2]"
              }`}
              title="3D Ölçü Çizgilerini Göster / Gizle"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 8v8M20 8v8M4 12h16" />
              </svg>
              <span className="text-[10px]">Ölçü</span>
            </button>

            {/* 3B. Böl (Bölme Ekle / Dikme At) */}
            <button
              type="button"
              data-testid="hud-tool-split-bay"
              onClick={() => {
                const nextCount = Math.min(6, activeModule.bays.length + 1);
                setBayCount(nextCount);
                setActiveBayIndex(nextCount - 1);
                setCutawayActiveBay(true);
              }}
              className="px-3 py-1.5 rounded-xl flex flex-col items-center gap-0.5 text-[#57534E] hover:bg-[#EEF3F8] hover:text-[#111827] transition cursor-pointer"
              title="Modüle yeni dikey bölme (ara dikme) ekle"
            >
              <Columns className="w-4 h-4" />
              <span className="text-[10px]">Böl</span>
            </button>

            {/* 3C. Birleştir (Ara Dikme Sil / Bölme Birleştir) */}
            <button
              type="button"
              data-testid="hud-tool-merge-bay"
              disabled={activeModule.bays.length <= 1}
              onClick={() => {
                if (activeModule.bays.length > 1) {
                  removeBayAt(activeBayIndex);
                }
              }}
              className="px-3 py-1.5 rounded-xl flex flex-col items-center gap-0.5 text-[#57534E] hover:bg-[#EEF3F8] hover:text-[#111827] disabled:opacity-40 transition cursor-pointer"
              title="Seçili ara dikmeyi kaldır ve bölmeleri birleştir"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 12h6M8 9l-3 3 3 3M16 9l3 3-3 3" />
              </svg>
              <span className="text-[10px]">Birleştir</span>
            </button>

            {/* 4. Kopyala */}
            <button
              type="button"
              data-testid="in-canvas-add-module"
              onClick={addAdjacentModule}
              className="px-3 py-1.5 rounded-xl flex flex-col items-center gap-0.5 text-[#57534E] hover:bg-[#F8F6F2] hover:text-[#1C1917] transition cursor-pointer"
              title="Seçili modülü yanına kopyala"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              <span className="text-[10px]">Kopyala</span>
            </button>

            {/* 4B. Kapak Aç / Kapat (İçini Göster) */}
            <button
              type="button"
              data-testid="hud-tool-toggle-doors"
              onClick={() => {
                toggleDoorOpen();
                setDragDropSnapBanner(
                  doorOpenAngleDeg > 0
                    ? "🚪 Kapaklar Kapatıldı"
                    : "🚪 Kapaklar Açıldı (İç Donanım Görünümü)"
                );
                setTimeout(() => setDragDropSnapBanner(null), 2000);
              }}
              className={`px-3 py-1.5 rounded-xl flex flex-col items-center gap-0.5 transition cursor-pointer ${
                doorOpenAngleDeg > 0
                  ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1] font-semibold shadow-xs"
                  : "text-[#57534E] hover:bg-[#F8F6F2] hover:text-[#1C1917]"
              }`}
              title="Dolap kapaklarını aç / kapat (veya 3D sahnede kapağa çift tıklayın)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 3h11a2 2 0 012 2v14a2 2 0 01-2 2H5V3z" />
                <path d="M5 3l9 3v15l-9-3V3z" />
                <circle cx="11.5" cy="12" r="1" fill="currentColor" />
              </svg>
              <span className="text-[10px]">{doorOpenAngleDeg > 0 ? "Kapağı Kapat" : "Kapak Aç"}</span>
            </button>

                        {/* 5. Aynala (Kapak Yönü / Modül Simetrisi) */}
            <button
              type="button"
              data-testid="in-canvas-flip-door-dir"
              onClick={() => {
                flipActiveDoorDirection(activeBayIndex);
                setDragDropSnapBanner("⇄ Kapak Açılış Yönü Aynalandı (Sol ⇄ Sağ)");
                setTimeout(() => setDragDropSnapBanner(null), 2200);
              }}
              className="px-3 py-1.5 rounded-xl flex flex-col items-center gap-0.5 text-[#57534E] hover:bg-[#F8F6F2] hover:text-[#1C1917] transition cursor-pointer"
              title="Kapak açılış yönünü aynala (Sol ⇄ Sağ)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3v18M4 7l5 5-5 5V7zM20 7l-5 5 5 5V7z" />
              </svg>
              <span className="text-[10px]">Aynala</span>
            </button>

            <div className="h-6 w-px bg-[#E2E8F0] mx-0.5" />

            {/* 6. Sil */}
            <button
              type="button"
              data-testid="hud-tool-delete"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("birim:delete-active-selection"));
                }
              }}
              className="px-3 py-1.5 rounded-xl flex flex-col items-center gap-0.5 text-red-600 hover:bg-red-50 transition cursor-pointer"
              title="Seçili parçayı veya modülü sil"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
              <span className="text-[10px] font-medium">Sil</span>
            </button>
          </div>
        )}

        {/* BOTTOM-LEFT 3D COORDINATE AXIS GIZMO (Z Blue, Y Green, X Red) */}
        <div
          data-testid="viewport-3d-axis-gizmo"
          className="absolute left-5 bottom-5 z-10 pointer-events-none select-none"
        >
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            {/* Z Vertical Axis (Blue) */}
            <line x1="20" y1="44" x2="20" y2="12" stroke="#2563EB" strokeWidth="2" />
            <polygon points="20,8 17,14 23,14" fill="#2563EB" />
            <text x="16" y="7" fill="#2563EB" fontSize="10" fontWeight="700">Z</text>
            {/* Y Depth Axis (Green) */}
            <line x1="20" y1="44" x2="42" y2="28" stroke="#16A34A" strokeWidth="2" />
            <polygon points="46,25 39,27 42,31" fill="#16A34A" />
            <text x="47" y="26" fill="#16A34A" fontSize="10" fontWeight="700">Y</text>
            {/* X Horizontal Axis (Red) */}
            <line x1="20" y1="44" x2="50" y2="52" stroke="#DC2626" strokeWidth="2" />
            <polygon points="54,53 48,49 47,54" fill="#DC2626" />
            <text x="55" y="56" fill="#DC2626" fontSize="10" fontWeight="700">X</text>
            <circle cx="20" cy="44" r="2.5" fill="#2B2927" />
          </svg>
        </div>

        {/* BOTTOM-CENTER NAVIGATION PILL (Orbit | Pan | Zoom | Sığdır) + RENDER MODE SELECTOR (Gerçekçi ⌄) */}
        <div
          data-testid="viewport-3d-bottom-nav-bar"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3"
        >
          <div className="bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-[#E2E8F0] shadow-md flex items-center gap-1 text-[#2B2927]">
            <button
              type="button"
              onClick={() => setMoveObjectMode3D(false)}
              className={`px-3 py-1 rounded-xl flex flex-col items-center gap-0.5 transition cursor-pointer ${
                !moveObjectMode3D ? "bg-[#F1F5F9] text-[#1C1917] font-semibold" : "text-[#57534E] hover:bg-[#F8F6F2]"
              }`}
              title="Sahneyi Döndür (Orbit)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="text-[10px]">Orbit</span>
            </button>
            <div className="h-5 w-px bg-[#E2E8F0]" />
            <button
              type="button"
              onClick={() => setMoveObjectMode3D(true)}
              className={`px-3 py-1 rounded-xl flex flex-col items-center gap-0.5 transition cursor-pointer ${
                moveObjectMode3D ? "bg-[#F1F5F9] text-[#1C1917] font-semibold" : "text-[#57534E] hover:bg-[#F8F6F2]"
              }`}
              title="Kaydır / Taşı (Pan)"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v6M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8" />
                <path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15" />
              </svg>
              <span className="text-[10px]">Pan</span>
            </button>
            <div className="h-5 w-px bg-[#E2E8F0]" />
            <button
              type="button"
              onClick={() => {
                const perspective = perspCamRef.current,
                  controls = controlsRef.current;
                if (perspective && controls) {
                  const dir = new THREE.Vector3().subVectors(perspective.position, controls.target);
                  const nextLen = dir.length() > 1350 ? dir.length() * 0.82 : dir.length() * 1.25;
                  perspective.position.copy(controls.target).add(dir.normalize().multiplyScalar(nextLen));
                  perspective.updateProjectionMatrix();
                  controls.update();
                  requestRender();
                }
              }}
              className="px-3 py-1 rounded-xl flex flex-col items-center gap-0.5 text-[#57534E] hover:bg-[#F8F6F2] hover:text-[#1C1917] transition cursor-pointer"
              title="Yakınlaştır / Uzaklaştır (Zoom)"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
              </svg>
              <span className="text-[10px]">Zoom</span>
            </button>
            <div className="h-5 w-px bg-[#E2E8F0]" />
            <button
              type="button"
              onClick={() => {
                const group = meshGroupRef.current,
                  controls = controlsRef.current,
                  perspective = perspCamRef.current;
                if (group && controls && perspective) {
                  const bounds = new THREE.Box3().setFromObject(group);
                  if (!bounds.isEmpty()) {
                    const center = bounds.getCenter(new THREE.Vector3());
                    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
                    const dist = Math.max(1200, radius * 2.35);
                    const dir = new THREE.Vector3(0.95, 0.55, 1.35).normalize();
                    controls.target.copy(center);
                    perspective.position.copy(center).addScaledVector(dir, dist);
                    perspective.lookAt(center);
                    perspective.updateProjectionMatrix();
                    controls.update();
                    requestRender();
                  }
                }
              }}
              className="px-3 py-1 rounded-xl flex flex-col items-center gap-0.5 text-[#57534E] hover:bg-[#F8F6F2] hover:text-[#1C1917] transition cursor-pointer"
              title="Sahneye Sığdır"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              <span className="text-[10px]">Sığdır</span>
            </button>
          </div>

          {/* Görüntü ⌄ Hardware View Mode Selector Pill (Normal Görünüm | Donanımları Göster | Teknik Görünüm — Matches Birim_Tasarim_5_Donanim_Mekanizmalar.png) */}
          {showInCanvasHud && (
            <div className="relative">
              <button
                type="button"
                data-testid="viewport-3d-hardware-view-mode-btn"
                onClick={() => setHardwareViewMenuOpen((v) => !v)}
                className={`bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border shadow-md flex items-center gap-2 text-xs font-semibold transition cursor-pointer ${
                  hardwareViewMode !== "normal"
                    ? "border-[#2563EB] text-[#1D4ED8] bg-[#EFF6FF]/95"
                    : "border-[#E2E8F0] text-[#111827] hover:bg-white"
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="4" width="18" height="14" rx="2" />
                  <circle cx="8.5" cy="10.5" r="2" />
                  <path d="M14 9h4M14 13h4" />
                </svg>
                <span>
                  {hardwareViewMode === "hardware"
                    ? "Donanımları Göster"
                    : hardwareViewMode === "technical"
                    ? "Teknik Görünüm"
                    : "Görüntü"}
                </span>
                <span className="text-[10px] text-[#64748B]">⌄</span>
              </button>

              {hardwareViewMenuOpen && (
                <div
                  data-testid="viewport-3d-hardware-view-menu"
                  className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-2xl border border-[#CBD5E1] shadow-2xl p-2 space-y-1 z-30 text-xs"
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    3D Donanım Görünüm Modu
                  </div>
                  {[
                    {
                      id: "normal" as const,
                      label: "Normal Görünüm",
                      sub: "Temiz mobilya ve sunum görünümü",
                    },
                    {
                      id: "hardware" as const,
                      label: "Donanımları Göster",
                      sub: "Menteşe, ray, LED ve askılık etiketleri",
                    },
                    {
                      id: "technical" as const,
                      label: "Teknik Görünüm",
                      sub: "CAD tel kafes + donanım ve CNC eksenleri",
                    },
                  ].map((vm) => (
                    <button
                      key={vm.id}
                      type="button"
                      data-testid={`viewport-3d-hw-mode-${vm.id}`}
                      onClick={() => {
                        setHardwareViewMode(vm.id);
                        setHardwareViewMenuOpen(false);
                        if (vm.id === "hardware" || vm.id === "technical") {
                          if (doorOpenAngleDeg < 15 && !doorsHiddenIn3D) {
                            setDoorOpenAngleDeg(65);
                          }
                        }
                        if (vm.id === "technical") {
                          setRenderEdgeMode("cad");
                        } else {
                          setRenderEdgeMode("photoreal");
                        }
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-left transition cursor-pointer ${
                        hardwareViewMode === vm.id
                          ? "bg-[#EFF6FF] border border-[#2563EB] text-[#111827] font-bold"
                          : "hover:bg-[#F8FAFC] text-[#111827]"
                      }`}
                    >
                      <div className="text-[11px] font-bold">{vm.label}</div>
                      <div className="text-[9px] text-[#64748B]">{vm.sub}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ölçüler Toggle Pill (Matches image_e719c6.jpg Bottom Bar) */}
          <button
            type="button"
            onClick={handleToggleDimensions}
            className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-[#E2E8F0] shadow-md flex items-center gap-2 text-xs font-semibold text-[#111827] cursor-pointer"
          >
            <span>Ölçüler</span>
            <span
              className={`w-8 h-4.5 rounded-full p-0.5 flex items-center transition ${
                effectiveShowDimensions ? "bg-[#3B82F6] justify-end" : "bg-[#CBD5E1] justify-start"
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-white shadow-2xs" />
            </span>
          </button>

          {/* Render Mode & Environment Selector Pill (Gerçekçi ⌄) */}
          <div className="relative">
            <button
              type="button"
              data-testid="viewport-3d-edge-mode-toggle"
              onClick={() => setRenderMenuOpen((v) => !v)}
              className="bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-[#E2E8F0] shadow-md flex items-center gap-2 text-xs font-semibold text-[#1C1917] hover:bg-[#FFFFFF] transition cursor-pointer"
            >
              <svg className="w-4 h-4 text-[#57534E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <span>{renderEdgeMode === "photoreal" ? "Gerçekçi" : "Teknik CAD"}</span>
              <span className="text-[10px] text-[#57534E]">⌄</span>
            </button>

            {renderMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-2xl border border-[#E2E8F0] shadow-xl p-3 space-y-3 z-30 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E] mb-1.5">
                    Görünüm Modu
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRenderEdgeMode("photoreal");
                        setRenderMenuOpen(false);
                      }}
                      className={`py-1.5 px-2 rounded-lg font-semibold cursor-pointer ${
                        renderEdgeMode === "photoreal"
                          ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1]"
                          : "bg-[#F1F5F9] text-[#1C1917]"
                      }`}
                    >
                      Gerçekçi PBR
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenderEdgeMode("cad");
                        setRenderMenuOpen(false);
                      }}
                      className={`py-1.5 px-2 rounded-lg font-semibold cursor-pointer ${
                        renderEdgeMode === "cad"
                          ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1]"
                          : "bg-[#F1F5F9] text-[#1C1917]"
                      }`}
                    >
                      Teknik Çizim
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E] mb-1.5">
                    Stüdyo Işığı
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: "daylight", label: "Gün Işığı" },
                      { id: "showroom_warm", label: "Stüdyo 3000K" },
                      { id: "night_led", label: "Gece LED" },
                    ].map((lp) => (
                      <button
                        key={lp.id}
                        type="button"
                        data-testid={`viewport-3d-light-${lp.id}`}
                        onClick={() =>
                          setLightingPreset(lp.id as "daylight" | "showroom_warm" | "night_led")
                        }
                        className={`py-1 px-1.5 rounded-lg text-[10px] font-semibold cursor-pointer ${
                          lightingPreset === lp.id
                            ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1]"
                            : "bg-[#F1F5F9] text-[#1C1917]"
                        }`}
                      >
                        {lp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E] mb-1.5">
                    Zemin Kaplaması
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { id: "oak_parquet", label: "Meşe Parke" },
                      { id: "herringbone_oak", label: "Balıksırtı" },
                      { id: "walnut_parquet", label: "Ceviz Parke" },
                      { id: "travertine", label: "Traverten Taş" },
                      { id: "neolith_calacatta", label: "Neolith Mermer" },
                      { id: "microcement", label: "Mikrobeton" },
                      { id: "studio", label: "Stüdyo Fon" },
                    ].map((fl) => (
                      <button
                        key={fl.id}
                        type="button"
                        data-testid={`viewport-3d-floor-${fl.id}`}
                        onClick={() => setFloorStyle(fl.id as ArchitecturalFloorStyle)}
                        className={`py-1 px-2 rounded-lg text-[10px] font-semibold text-left cursor-pointer ${
                          floorStyle === fl.id
                            ? "bg-[#EEF3F8] text-[#111827] border border-[#CBD5E1]"
                            : "bg-[#F1F5F9] text-[#1C1917]"
                        }`}
                      >
                        {fl.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1.5 border-t border-[#E2E8F0] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    data-testid="viewport-3d-room-toggle"
                    onClick={() => setShowRoomArchitecture3D((prev) => !prev)}
                    className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] hover:bg-[#EEF3F8] text-[10px] font-semibold text-[#1C1917] cursor-pointer"
                  >
                    {showRoomArchitecture3D ? "🏠 Duvarlar: Açık" : "🏠 Duvarlar: Gizli"}
                  </button>
                  <button
                    type="button"
                    data-testid="viewport-3d-rotate-mod-90"
                    onClick={() => rotateActiveModule90(90)}
                    className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] hover:bg-[#EEF3F8] text-[10px] font-semibold text-[#1C1917] cursor-pointer"
                  >
                    🔄 90° Döndür
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

V3ThreeViewport.displayName = "V3ThreeViewport";
export default V3ThreeViewport;
