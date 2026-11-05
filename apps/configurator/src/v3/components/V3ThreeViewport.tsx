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
import { calculateFourSpaceDimensions } from "@birim/core";
import {
  computeElevationSnapTargets,
  resolveElevationSnap,
  findDraggableInteriorComponent,
  type ElevationSnapTarget,
} from "../engine/elevationSnapEngine";
import {
  getV3PbrMaterial,
  getStudioEnvironmentTexture,
  getArchitecturalFloorTexture,
} from "../materials/pbrMaterialSystem";
import { Plus, Layers, RotateCw, Columns, Ruler } from "lucide-react";


let cachedContactAoTex: THREE.CanvasTexture | null = null;
function getContactAoShadowTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (cachedContactAoTex) return cachedContactAoTex;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  grad.addColorStop(0, "rgba(15, 13, 11, 0.52)");
  grad.addColorStop(0.55, "rgba(28, 25, 23, 0.26)");
  grad.addColorStop(1, "rgba(28, 25, 23, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
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
      color: isSelected ? 0xb86b2b : isActiveMod ? 0x1c1917 : isLightTheme ? 0x292524 : 0x64748b,
      linewidth: 1,
      opacity: isSelected
        ? 1.0
        : isPhotoreal
        ? isActiveMod
          ? 0.42
          : 0.26
        : isActiveMod
        ? 0.88
        : 0.65,
      transparent: true,
    });
    v3EdgeCache.set(key, m);
  }
  return m;
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
      drawerOpenMm,
      explodedFactor,
      isOrthographic,
      cameraPreset,
      selectedComponentId,
      setSelectedComponentId,
      spaceObstacles,
      spaceWalls,
      setActiveModuleIndex,
      setActiveBayIndex,
      setDimensions,
      setShelfElevation,
      setDrawerPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
      addShelf,
      addDrawer,
      addSpecialFitting,
      addSubDivider,
      addAdjacentModule,
      rotateActiveModule90,
      setModulePosition,
      swapModuleWithNeighbor,
      finishModuleDragWithSmartSwap,
      updateObstaclePosition,
      beginHistoryTransaction,
      commitHistoryTransaction,
      dropV4TemplateWithSnap,
    } = useV3Adapter();

    const [editingBadge, setEditingBadge] = useState<null | "W" | "H" | "D">(null);
    const [badgeDraftValue, setBadgeDraftValue] = useState<string>("");
    const [localShowDimensions, setLocalShowDimensions] = useState<boolean>(true);
    const [showRoomArchitecture3D, setShowRoomArchitecture3D] = useState<boolean>(true);
    const [lightingPreset, setLightingPreset] = useState<"daylight" | "showroom_warm" | "night_led">(
      "showroom_warm"
    );
    const [floorStyle, setFloorStyle] = useState<"oak_parquet" | "travertine" | "studio">(
      "oak_parquet"
    );
    const [renderEdgeMode, setRenderEdgeMode] = useState<"photoreal" | "cad">("photoreal");
    const [moveObjectMode3D, setMoveObjectMode3D] = useState<boolean>(true);
    const [invertCameraMouse, setInvertCameraMouse] = useState<boolean>(true);
    const [active3DSnap, setActive3DSnap] = useState<ElevationSnapTarget | null>(null);
    const roomArchGroupRef = useRef<THREE.Group | null>(null);
    const [dragDropSnapBanner, setDragDropSnapBanner] = useState<string | null>(null);
    const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
    const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
    const rimLightRef = useRef<THREE.DirectionalLight | null>(null);

    const latestStateRef = useRef({
      project,
      activeModuleIndex,
      doorOpenAngleDeg,
      moveObjectMode3D,
      spaceObstacles,
      setActiveModuleIndex,
      setActiveBayIndex,
      setSelectedComponentId,
      setShelfElevation,
      setDrawerPlacement,
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
        moveObjectMode3D,
        spaceObstacles,
        setActiveModuleIndex,
        setActiveBayIndex,
        setSelectedComponentId,
        setShelfElevation,
        setDrawerPlacement,
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
      doorOpenAngleDeg,
      moveObjectMode3D,
      spaceObstacles,
      setActiveModuleIndex,
      setActiveBayIndex,
      setSelectedComponentId,
      setShelfElevation,
      setDrawerPlacement,
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
      const T = mod.carcass.panelThickness;
      const fourSpaces = calculateFourSpaceDimensions(mod);
      const list: DimensionAnchor[] = [
        {
          id: "dim_SEL",
          tag: `★ SEÇİLİ MODÜL #${activeModuleIndex + 1}`,
          valueText: mod.name,
          borderColor: "#d97706",
          badgeBg: "#b45309",
          localMidpoint: new THREE.Vector3(W * 0.5, H + 235, D * 0.5),
        },
        {
          id: "dim_W",
          tag: "GENİŞLİK",
          valueText: `${W} mm`,
          borderColor: "#b45309",
          badgeBg: "#b45309",
          localMidpoint: new THREE.Vector3(W * 0.5, H + 115, D),
        },
        {
          id: "dim_H",
          tag: "YÜKSEKLİK",
          valueText: `${H} mm`,
          borderColor: "#0369a1",
          badgeBg: "#0369a1",
          localMidpoint: new THREE.Vector3(W + 130, H * 0.5, D),
        },
        {
          id: "dim_D",
          tag: "DERİNLİK",
          valueText: `${D} mm`,
          borderColor: "#15803d",
          badgeBg: "#15803d",
          localMidpoint: new THREE.Vector3(W + 120, 0, D * 0.5),
        },
      ];
      let curX = T;
      fourSpaces.usableInternal.bayClearWidthsMm.forEach((bayW: number, bIdx: number) => {
        list.push({
          id: `dim_B_${bIdx}`,
          tag: `BÖLME ${bIdx + 1}`,
          valueText: `${bayW} mm`,
          borderColor: "#44403c",
          badgeBg: "#44403c",
          localMidpoint: new THREE.Vector3(curX + bayW * 0.5, 0, D + 115),
        });
        curX += bayW + T;
      });

      // Add dimensions for ALL other modules in the scene so measurements are visible across the entire layout
      project.modules.forEach((otherMod, mIdx) => {
        if (mIdx === activeModuleIndex || otherMod.category === "complementary") return;
        list.push({
          id: `dim_MOD_${mIdx}`,
          tag: `#${mIdx + 1} ${otherMod.name}`,
          valueText: `${otherMod.dimensions.width}×${otherMod.dimensions.height} mm`,
          borderColor: "#57534e",
          badgeBg: "#44403c",
          localMidpoint: new THREE.Vector3(
            otherMod.dimensions.width * 0.5,
            otherMod.dimensions.height + 95,
            otherMod.dimensions.depth
          ),
        });
      });

      // Add Total Row Span dimension when multiple modules exist
      const mainMods = project.modules.filter((m) => m.category !== "complementary");
      if (mainMods.length > 1) {
        const minX = Math.min(...mainMods.map((m) => m.position.x));
        const maxX = Math.max(...mainMods.map((m) => m.position.x + m.dimensions.width));
        const maxH = Math.max(...mainMods.map((m) => m.position.y + m.dimensions.height));
        list.push({
          id: "dim_TOTAL_SPAN",
          tag: "TOPLAM DİZİLİM",
          valueText: `${Math.round(maxX - minX)} mm`,
          borderColor: "#0f766e",
          badgeBg: "#0f766e",
          localMidpoint: new THREE.Vector3((minX + maxX) * 0.5, maxH + 340, 300),
        });
      }

      return list;
    }, [project, activeModuleIndex, effectiveShowDimensions]);

    const sceneRef = useRef<THREE.Scene | null>(null);
    const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null);
    const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const meshGroupRef = useRef<THREE.Group | null>(null);
    const dimGroupRef = useRef<THREE.Group | null>(null);
    const ghostSnapGroupRef = useRef<THREE.Group | null>(null);
    const lastGhostKeyRef = useRef<string>("");
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

      // Generate PMREM prefiltered environment map for realistic roughness-aware reflections
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        scene.environment = pmrem.fromEquirectangular(getStudioEnvironmentTexture()).texture;
        pmrem.dispose();
      } catch {
        scene.environment = getStudioEnvironmentTexture();
      }

      // Calibrated Architectural Daylight + Warm Softbox Lighting with full-room 2048x2048 shadow frustum
      const hemiLight = new THREE.HemisphereLight(0xfffdf8, 0xd8d2c5, 0.92);
      scene.add(hemiLight);
      hemiLightRef.current = hemiLight;

      const keyLight = new THREE.DirectionalLight(0xfff5e4, 1.45);
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

      const frontFillLight = new THREE.DirectionalLight(0xfff8ed, 0.52);
      frontFillLight.position.set(-1800, 1900, 3200);
      scene.add(frontFillLight);

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

        // 1. Check if an Architectural Obstacle (Window, Door, Plumbing, Column) was grabbed in 3D
        if (curRoomGroup && (state.moveObjectMode3D || e.shiftKey)) {
          const roomHits = raycaster.intersectObjects(curRoomGroup.children, true);
          for (const rh of roomHits) {
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
                // Build the exact 3D vertical plane of the wall this window/obstacle sits on:
                // - Side wall (90°/270°): vertical plane with normal (1, 0, 0) passing through rh.point
                // - Back wall (0°/180°): vertical plane with normal (0, 0, 1) passing through rh.point
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

        const hits = raycaster.intersectObjects(curGroup.children, true);
        if (hits.length === 0) return;

        let hitObj: THREE.Object3D | null = null;
        let dragMeta: ReturnType<typeof findDraggableInteriorComponent> = null;
        let modIdx = state.activeModuleIndex;
        let mod = state.project.modules[modIdx];

        for (const h of hits) {
          let cand: THREE.Object3D | null = h.object;
          while (cand && (!cand.userData || !cand.userData.componentId)) {
            cand = cand.parent;
          }
          if (!cand?.userData?.componentId) continue;
          const cModIdx =
            typeof cand.userData.moduleIndex === "number"
              ? cand.userData.moduleIndex
              : state.activeModuleIndex;
          const cMod = state.project.modules[cModIdx];
          if (!cMod) continue;
          if (!hitObj) {
            hitObj = cand;
            modIdx = cModIdx;
            mod = cMod;
          }
          // Only allow grabbing internal shelves/rails/dividers if doors are open OR module/bay is open-front OR it is an external drawer front
          const isExternalDrawerFront = String(cand.userData.role) === "drawer_front";
          const doorsAreOpen =
            state.doorOpenAngleDeg > 5 ||
            Boolean(cMod.isOpenFront) ||
            cMod.bays.some((b) => b.door.type === "open" || b.door.doorSystemId === "open");

          // When moveObjectMode3D is active, left-clicking a cabinet moves the WHOLE cabinet unless Ctrl is held to move an internal shelf/drawer
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
          // Stop at the first solid front hit if doors are closed so we do not grab hidden shelves through closed doors!
          if (!doorsAreOpen && String(cand.userData.role || "").startsWith("door")) {
            break;
          }
        }
        if (!hitObj?.userData?.componentId || !mod) return;

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
          state.setSelectedComponentId(String(hitObj.userData.componentId));
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

        if (!dragMeta) return;

        state.setActiveModuleIndex(modIdx);
        state.setActiveBayIndex(dragMeta.bayIdx);
        state.setSelectedComponentId(String(hitObj.userData.componentId));

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

      const handlePointerMove = (e: PointerEvent) => {
        if (!activeDrag3D) return;
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
              setDragDropSnapBanner(null);
            }
          }
          if (moved) return;
        }

        if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
        const curRenderer = rendererRef.current;
        const curGroup = meshGroupRef.current;
        if (!curRenderer || !curGroup) return;

        const rect = curRenderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const curCam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
        if (!curCam) return;

        raycaster.setFromCamera(pointer, curCam);
        const hits = raycaster.intersectObjects(curGroup.children, true);
        const state = latestStateRef.current;
        for (const h of hits) {
          let hitObj: THREE.Object3D | null = h.object;
          while (hitObj && (!hitObj.userData || !hitObj.userData.componentId)) {
            hitObj = hitObj.parent;
          }
          if (hitObj?.userData?.componentId) {
            if (typeof hitObj.userData.moduleIndex === "number") {
              state.setActiveModuleIndex(hitObj.userData.moduleIndex);
            }
            if (typeof hitObj.userData.bayIndex === "number") {
              state.setActiveBayIndex(hitObj.userData.bayIndex);
            }
            state.setSelectedComponentId(String(hitObj.userData.componentId));
            return;
          }
        }
        state.setSelectedComponentId(null);
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
          lightingPreset === "night_led" || theme === "dark"
            ? 0x18181b
            : lightingPreset === "showroom_warm"
            ? 0xc8c0b3
            : 0xd2ccc0;
        sceneRef.current.background = new THREE.Color(bgHex);
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
          hemiLightRef.current.color.setHex(0xfff6e5);
          hemiLightRef.current.groundColor.setHex(0x3b352e);
          hemiLightRef.current.intensity = 0.48;
          keyLightRef.current.color.setHex(0xffeacc);
          keyLightRef.current.intensity = 1.18;
          rimLightRef.current.intensity = 0.44;
          rendererRef.current.toneMappingExposure = 0.96;
        } else {
          hemiLightRef.current.color.setHex(0xfffdf9);
          hemiLightRef.current.groundColor.setHex(0x44403c);
          hemiLightRef.current.intensity = 0.52;
          keyLightRef.current.color.setHex(0xfffaf0);
          keyLightRef.current.intensity = 1.14;
          rimLightRef.current.intensity = 0.48;
          rendererRef.current.toneMappingExposure = 0.94;
        }
      }
      if (gridRef.current) {
        gridRef.current.visible = showGrid && floorStyle === "studio";
      }
      requestRender();
    }, [theme, showGrid, lightingPreset, floorStyle, requestRender]);

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
            const matDef = obj.userData.matDef || DEFAULT_MATERIALS[0];
            obj.material = getV3PbrMaterial(matDef, isSel, isRail);
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

          const material = getV3PbrMaterial(matDef, isSelected, isRail);
          const edgeMat = getCachedEdgeMaterial(isSelected, isActiveMod, isLight, renderEdgeMode === "photoreal");

          modContainer.add(
            createComponentMesh(comp, material, edgeMat, {
              componentId: comp.id,
              role: comp.role,
              moduleIndex: modIdx,
              bayIndex: comp.bayIndex,
              matDef,
            })
          );
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
        if (aoTex && mod.position.y <= 80) {
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
          aoMesh.rotation.x = -Math.PI / 2;
          aoMesh.position.set(
            mod.dimensions.width / 2,
            -mod.position.y + 1.5,
            mod.dimensions.depth / 2
          );
          modContainer.add(aoMesh);
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

        
        // Unmistakable 3D Selection Bounding Frame & Base Halo on the Active Module
        if (isActiveMod) {
          const selW = mod.dimensions.width + 24;
          const selH = mod.dimensions.height + 24;
          const selD = mod.dimensions.depth + 24;
          const selBoxGeo = new THREE.BoxGeometry(selW, selH, selD);
          const selEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(selBoxGeo),
            new THREE.LineBasicMaterial({
              color: 0xd97706,
              transparent: true,
              opacity: 0.92,
            })
          );
          selEdges.position.set(
            mod.dimensions.width / 2,
            mod.dimensions.height / 2,
            mod.dimensions.depth / 2
          );
          modContainer.add(selEdges);

          // Glowing Base Platform Frame on floor/wall under the Selected Module
          const baseRingGeo = new THREE.BoxGeometry(selW + 16, 8, selD + 16);
          const baseRingMesh = new THREE.Mesh(
            baseRingGeo,
            new THREE.MeshBasicMaterial({
              color: 0xf59e0b,
              transparent: true,
              opacity: 0.28,
              depthWrite: false,
            })
          );
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
          color: lightingPreset === "night_led" ? 0x27272a : 0xf5f3ee,
          roughness: 0.88,
          metalness: 0.02,
          transparent: true,
          opacity: 0.84,
          side: THREE.DoubleSide,
        });
        const skirtMat = new THREE.MeshStandardMaterial({
          color: 0xe7e5e4,
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
              color: obs.type === "electrical" ? 0xf59e0b : 0xa8a29e,
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
      explodedFactor,
      activeModuleIndex,
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

      // 1. Total Width (W) along top-front edge
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_W",
        new THREE.Vector3(0, H, D),
        new THREE.Vector3(W, H, D),
        new THREE.Vector3(0, 1, 0),
        95,
        "GENİŞLİK",
        `${W} mm`,
        0xb45309,
        "#b45309",
        "#b45309"
      );

      // 2. Total Height (H) along right-front vertical edge
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_H",
        new THREE.Vector3(W, 0, D),
        new THREE.Vector3(W, H, D),
        new THREE.Vector3(1, 0, 0),
        115,
        "YÜKSEKLİK",
        `${H} mm`,
        0x0369a1,
        "#0369a1",
        "#0369a1"
      );

      // 3. Total Depth (D) along right-bottom floor edge
      addDimensionSegment(
        modDimContainer,
        localAnchors,
        "dim_D",
        new THREE.Vector3(W, 0, 0),
        new THREE.Vector3(W, 0, D),
        new THREE.Vector3(1, 0, 0),
        105,
        "DERİNLİK",
        `${D} mm`,
        0x15803d,
        "#15803d",
        "#15803d"
      );

      // 4. Per-bay internal widths along front-bottom
      let curX = T;
      fourSpaces.usableInternal.bayClearWidthsMm.forEach((bayW: number, bIdx: number) => {
        addDimensionSegment(
          modDimContainer,
          localAnchors,
          `dim_B_${bIdx}`,
          new THREE.Vector3(curX, 0, D + 20),
          new THREE.Vector3(curX + bayW, 0, D + 20),
          new THREE.Vector3(0, 0, 1),
          90,
          `BÖLME ${bIdx + 1}`,
          `${bayW} mm`,
          0x44403c,
          "#44403c",
          "#44403c"
        );
        curX += bayW + T;
      });

      // Add Selected Module top anchor
      localAnchors.unshift({
        id: "dim_SEL",
        tag: `★ SEÇİLİ MODÜL #${activeModuleIndex + 1}`,
        valueText: mod.name,
        borderColor: "#d97706",
        badgeBg: "#b45309",
        localMidpoint: new THREE.Vector3(W * 0.5, H + 235, D * 0.5),
      });

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
      effectiveShowDimensions,
      updateProjectedDimensionLabels,
      requestRender,
    ]);

    if (!activeModule) return null;
    const { width, height, depth } = activeModule.dimensions;

    const commitBadgeEdit = () => {
      const val = Number(badgeDraftValue);
      if (!Number.isNaN(val) && editingBadge) {
        if (editingBadge === "W") {
          setDimensions(val, height, depth);
        } else if (editingBadge === "H") {
          setDimensions(width, val, depth);
        } else if (editingBadge === "D") {
          setDimensions(width, height, val);
        }
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
          doorOpenAngleDeg: 22,
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
            className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-4 py-2 rounded-2xl bg-amber-700 text-white border-2 border-amber-200 shadow-xl font-mono text-xs font-extrabold flex items-center gap-2"
          >
            <span>{dragDropSnapBanner}</span>
          </div>
        )}
        <div
          ref={mountRef}
          data-testid="v3-three-canvas"
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* CRISP PROJECTED 3D DIMENSION CALLOUT PILLS OVERLAY */}
        {effectiveShowDimensions && dimLabels.length > 0 && (
          <div
            data-testid="viewport-3d-dim-labels"
            className="absolute inset-0 pointer-events-none overflow-hidden z-[8]"
          >
            {dimLabels.map((item) => (
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
                  borderColor: item.borderColor,
                  transform: "translate3d(-9999px, -9999px, 0)",
                }}
                className="absolute top-0 left-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/95 backdrop-blur-xs border-2 shadow-lg whitespace-nowrap transition-opacity duration-75"
              >
                <span
                  style={{ backgroundColor: item.badgeBg }}
                  className="px-1.5 py-0.5 rounded-md text-[10px] font-black tracking-wide text-white leading-none"
                >
                  {item.tag}
                </span>
                <span className="text-[13px] font-black font-mono text-stone-950 leading-none tracking-tight">
                  {item.valueText}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Live Cross-Module / Cross-Bay Elevation Snap Badge during 3D Drag */}
        {active3DSnap && (
          <div
            data-testid="in-canvas-snap-badge"
            className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3.5 py-1.5 rounded-xl bg-sky-700 text-white border-2 border-white shadow-lg font-mono text-xs font-extrabold flex items-center gap-2"
          >
            <span>🎯 Hizalandı: {active3DSnap.label}</span>
            <span className="px-1.5 py-0.5 rounded bg-sky-900 text-sky-100">
              Y: {active3DSnap.elevationY} mm
            </span>
          </div>
        )}

        {/* UNIFIED NON-OVERLAPPING 3D BOTTOM DOCK BAR (Lighting, Floor, Edge Mode, Mouse Mode, Room & Dimensions) */}
        <div
          data-testid="viewport-3d-visual-quality-bar"
          className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-stone-300 shadow-lg text-xs text-stone-800 overflow-x-auto"
        >
          <div className="flex items-center gap-1 shrink-0">
            {[
              { id: "daylight", label: "☀️ Gün Işığı" },
              { id: "showroom_warm", label: "✨ Showroom 3000K" },
              { id: "night_led", label: "🌙 Gece / LED" },
            ].map((lp) => (
              <button
                key={lp.id}
                type="button"
                data-testid={`viewport-3d-light-${lp.id}`}
                onClick={() =>
                  setLightingPreset(lp.id as "daylight" | "showroom_warm" | "night_led")
                }
                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 ${
                  lightingPreset === lp.id
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300"
                }`}
              >
                {lp.label}
              </button>
            ))}

            <div className="h-4 w-px bg-stone-200 mx-0.5 shrink-0" />

            {[
              { id: "oak_parquet", label: "🪵 Parke" },
              { id: "travertine", label: "🏛️ Mermer" },
              { id: "studio", label: "⬜ Stüdyo" },
            ].map((fl) => (
              <button
                key={fl.id}
                type="button"
                data-testid={`viewport-3d-floor-${fl.id}`}
                onClick={() => setFloorStyle(fl.id as "oak_parquet" | "travertine" | "studio")}
                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 ${
                  floorStyle === fl.id
                    ? "bg-amber-100 text-amber-950 border border-amber-400"
                    : "bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300"
                }`}
              >
                {fl.label}
              </button>
            ))}

            <div className="h-4 w-px bg-stone-200 mx-0.5 shrink-0" />

            <button
              type="button"
              data-testid="viewport-3d-edge-mode-toggle"
              onClick={() =>
                setRenderEdgeMode((m) => (m === "photoreal" ? "cad" : "photoreal"))
              }
              className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 ${
                renderEdgeMode === "photoreal"
                  ? "bg-emerald-100 text-emerald-950 border border-emerald-400"
                  : "bg-stone-100 text-stone-800 border border-stone-300"
              }`}
              title="Fotogerçekçi yumuşak derz görünümü ile teknik CAD kenar çizgisi arasında geçiş yap"
            >
              {renderEdgeMode === "photoreal" ? "📸 Fotogerçekçi" : "📐 CAD Çizgili"}
            </button>

            <div className="h-4 w-px bg-stone-200 mx-0.5 shrink-0" />

            <button
              type="button"
              data-testid="viewport-3d-move-mode-toggle"
              onClick={() => setMoveObjectMode3D((v) => !v)}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 ${
                moveObjectMode3D
                  ? "bg-amber-600 text-white ring-1 ring-amber-400"
                  : "bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300"
              }`}
              title="Sol Tuşla nesneleri doğrudan 3D sahnede taşı, boşlukta Sol Tuşla sahneyi kaydır (Pan), Sağ Tuşla döndür."
            >
              {moveObjectMode3D
                ? "🖱️ Sol: Taşı/Pan | Sağ: Döndür"
                : "🔄 Sol: Döndür (Shift+Sol: Taşı)"}
            </button>

            <button
              type="button"
              data-testid="viewport-3d-mouse-dir-toggle"
              onClick={() => setInvertCameraMouse((v) => !v)}
              className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 font-bold transition cursor-pointer shrink-0"
              title="Fare ile 3D döndürme yönünü değiştir"
            >
              {invertCameraMouse ? "🖱️ Doğal" : "🖱️ Ters"}
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="viewport-3d-room-toggle"
              onClick={() => setShowRoomArchitecture3D((prev) => !prev)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                showRoomArchitecture3D
                  ? "bg-sky-100 text-sky-950 border-sky-400 hover:bg-sky-200"
                  : "bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200"
              }`}
              title="3D Sahnede Duvar, Pencere, Kapı, Kolon ve Tesisat Noktalarını Göster / Gizle"
            >
              <span>{showRoomArchitecture3D ? "🏠 Mekân: Açık" : "🏠 Mekân: Kapalı"}</span>
            </button>

            <button
              type="button"
              data-testid="viewport-3d-dimensions-toggle"
              onClick={handleToggleDimensions}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                effectiveShowDimensions
                  ? "bg-amber-600 text-white border-amber-500 hover:bg-amber-500"
                  : "bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200"
              }`}
              title="3D Perspektif Ölçü Çizgilerini Göster / Gizle"
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>{effectiveShowDimensions ? "Ölçüler: Açık" : "Ölçüler: Kapalı"}</span>
            </button>
          </div>
        </div>

        {/* IN-CANVAS DIRECT DIMENSION & CONTEXTUAL ACTION HUD */}
        {showInCanvasHud && (
          <div
            data-testid="in-canvas-direct-hud"
            className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center gap-1.5 bg-white/95 text-stone-900 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-stone-300 shadow-lg text-xs max-w-[96%]"
          >
            <span className="font-bold text-amber-800 px-1.5 border-r border-stone-200 flex items-center gap-1">
              <span>★ #{activeModuleIndex + 1} {activeModule.name}</span>
            </span>
            {project.modules.length > 1 && (
              <div className="inline-flex items-center gap-1 pr-1.5 border-r border-stone-200">
                <button
                  type="button"
                  data-testid="hud-swap-mod-left-btn"
                  onClick={() => {
                    const res = swapModuleWithNeighbor(activeModuleIndex, "left");
                    if (res) {
                      setDragDropSnapBanner(`🔄 Solundaki "${res.swappedWithName}" ile yer değiştirdi`);
                      setTimeout(() => setDragDropSnapBanner(null), 2500);
                    }
                  }}
                  className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] cursor-pointer"
                  title="Seçili modülü solundaki modülle yer değiştir"
                >
                  ⇄ Sol
                </button>
                <button
                  type="button"
                  data-testid="hud-swap-mod-right-btn"
                  onClick={() => {
                    const res = swapModuleWithNeighbor(activeModuleIndex, "right");
                    if (res) {
                      setDragDropSnapBanner(`🔄 Sağındaki "${res.swappedWithName}" ile yer değiştirdi`);
                      setTimeout(() => setDragDropSnapBanner(null), 2500);
                    }
                  }}
                  className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] cursor-pointer"
                  title="Seçili modülü sağındaki modülle yer değiştir"
                >
                  Sağ ⇄
                </button>
              </div>
            )}

            {effectiveShowDimensions && (
              <>
                {/* Clickable Width Label */}
                {editingBadge === "W" ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitBadgeEdit();
                    }}
                    className="inline-flex items-center gap-1"
                  >
                    <input
                      type="number"
                      data-testid="in-canvas-input-W"
                      autoFocus
                      min={300}
                      max={3600}
                      step={50}
                      value={badgeDraftValue}
                      onChange={(e) => setBadgeDraftValue(e.target.value)}
                      onBlur={commitBadgeEdit}
                      className="w-16 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-700 font-mono text-xs font-bold text-stone-900 text-center"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    data-testid="in-canvas-badge-W"
                    onClick={() => {
                      setEditingBadge("W");
                      setBadgeDraftValue(String(width));
                    }}
                    className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-amber-50 hover:border-amber-700 border border-stone-200 font-mono font-bold text-stone-900 transition cursor-pointer"
                    title="Genişliği doğrudan değiştirmek için tıklayın"
                  >
                    W: {width}mm
                  </button>
                )}

                {/* Clickable Height Label */}
                {editingBadge === "H" ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitBadgeEdit();
                    }}
                    className="inline-flex items-center gap-1"
                  >
                    <input
                      type="number"
                      data-testid="in-canvas-input-H"
                      autoFocus
                      min={400}
                      max={2800}
                      step={50}
                      value={badgeDraftValue}
                      onChange={(e) => setBadgeDraftValue(e.target.value)}
                      onBlur={commitBadgeEdit}
                      className="w-16 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-700 font-mono text-xs font-bold text-stone-900 text-center"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    data-testid="in-canvas-badge-H"
                    onClick={() => {
                      setEditingBadge("H");
                      setBadgeDraftValue(String(height));
                    }}
                    className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-amber-50 hover:border-amber-700 border border-stone-200 font-mono font-bold text-stone-900 transition cursor-pointer"
                    title="Yüksekliği doğrudan değiştirmek için tıklayın"
                  >
                    H: {height}mm
                  </button>
                )}

                {/* Clickable Depth Label */}
                {editingBadge === "D" ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitBadgeEdit();
                    }}
                    className="inline-flex items-center gap-1"
                  >
                    <input
                      type="number"
                      data-testid="in-canvas-input-D"
                      autoFocus
                      min={250}
                      max={900}
                      step={50}
                      value={badgeDraftValue}
                      onChange={(e) => setBadgeDraftValue(e.target.value)}
                      onBlur={commitBadgeEdit}
                      className="w-16 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-700 font-mono text-xs font-bold text-stone-900 text-center"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    data-testid="in-canvas-badge-D"
                    onClick={() => {
                      setEditingBadge("D");
                      setBadgeDraftValue(String(depth));
                    }}
                    className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-amber-50 hover:border-amber-700 border border-stone-200 font-mono font-bold text-stone-900 transition cursor-pointer"
                    title="Derinliği doğrudan değiştirmek için tıklayın"
                  >
                    D: {depth}mm
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              data-testid="in-canvas-toggle-dimensions"
              onClick={handleToggleDimensions}
              className={`px-2 py-1 rounded-lg border font-semibold flex items-center gap-1 cursor-pointer transition ${
                effectiveShowDimensions
                  ? "bg-amber-50 border-amber-600 text-amber-900"
                  : "bg-stone-100 border-stone-200 text-stone-600 hover:bg-stone-200"
              }`}
              title="Perspektif ekranında ölçü çizgilerini ve etiketlerini aç/kapat"
            >
              <Ruler className="w-3 h-3 text-amber-700" />
              <span>{effectiveShowDimensions ? "Ölçü Gizle" : "Ölçü Göster"}</span>
            </button>

            <div className="h-4 w-px bg-stone-200 mx-0.5" />

            {/* Contextual 1-Click Interior, Sub-Divider & LED Actions */}
            <button
              type="button"
              data-testid="in-canvas-add-led"
              onClick={() => addSpecialFitting(activeBayIndex, "led_profile")}
              className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-400 text-amber-950 font-bold flex items-center gap-1 cursor-pointer"
              title="Seçili bölmeye Häfele Loox5 3000K Sıcak LED Aydınlatma ekle"
            >
              <span>💡 +LED ({(activeBay?.specialFittings || []).filter((f) => f.type.startsWith("led_")).length})</span>
            </button>

            <button
              type="button"
              data-testid="in-canvas-add-divider"
              onClick={() => addSubDivider(activeBayIndex)}
              className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-amber-50 border border-stone-300 text-stone-900 font-semibold flex items-center gap-1 cursor-pointer"
              title="İki raf arasına dikey Ara Dikme (bölücü) ekle"
            >
              <Columns className="w-3 h-3 text-amber-400" />
              <span>+Raf Arası Dikme ({activeBay?.subDividers?.length || 0})</span>
            </button>

            <button
              type="button"
              data-testid="in-canvas-add-shelf"
              onClick={() => addShelf(activeBayIndex)}
              className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-amber-50 text-stone-800 font-semibold flex items-center gap-1 cursor-pointer"
              title="Seçili bölmeye raf ekle"
            >
              <Layers className="w-3 h-3 text-amber-700" />
              <span>+Raf ({activeBay?.shelves.length || 0})</span>
            </button>

            <button
              type="button"
              data-testid="in-canvas-add-drawer"
              onClick={() => addDrawer(activeBayIndex)}
              className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-amber-50 text-stone-800 font-semibold flex items-center gap-1 cursor-pointer"
              title="Seçili bölmeye çekmece ekle"
            >
              <Plus className="w-3 h-3 text-amber-700" />
              <span>+Çekmece ({activeBay?.drawers.length || 0})</span>
            </button>

            <button
              type="button"
              data-testid="in-canvas-rotate-mod"
              onClick={rotateActiveModule90}
              className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-amber-50 text-stone-800 font-semibold flex items-center gap-1 cursor-pointer"
              title="Modülü 90° Köşe Dönüşü İçin Döndür"
            >
              <RotateCw className="w-3 h-3 text-amber-700" />
              <span>{activeModule.rotation?.y || 0}°</span>
            </button>

            <button
              type="button"
              data-testid="in-canvas-fit-scene"
              className="px-2 py-1 rounded-lg bg-stone-100 text-stone-800 font-semibold cursor-pointer"
              onClick={() => {
                const group = meshGroupRef.current,
                  controls = controlsRef.current;
                const perspective = perspCamRef.current,
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
                orthographic.zoom =
                  Math.min(
                    orthographic.right - orthographic.left,
                    orthographic.top - orthographic.bottom
                  ) / Math.max(1, radius * 2.3);
                perspective.updateProjectionMatrix();
                orthographic.updateProjectionMatrix();
                controls.update();
                requestRender();
              }}
            >
              Tümünü sığdır
            </button>

            <button
              type="button"
              data-testid="in-canvas-add-module"
              onClick={addAdjacentModule}
              className="px-2 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold flex items-center gap-1 cursor-pointer"
              title="Aktif modülün bir kopyasını yanına bitişik olarak ekle"
            >
              <Plus className="w-3 h-3" />
              <span>Aynı Modülden Ekle</span>
            </button>
          </div>
        )}
      </div>
    );
  }
);

V3ThreeViewport.displayName = "V3ThreeViewport";
export default V3ThreeViewport;
