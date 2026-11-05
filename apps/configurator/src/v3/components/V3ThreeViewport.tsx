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
} from "../materials/pbrMaterialSystem";
import { Plus, Layers, RotateCw, Columns, Ruler } from "lucide-react";

const v3EdgeCache = new Map<string, THREE.LineBasicMaterial>();

function getCachedEdgeMaterial(
  isSelected: boolean,
  isActiveMod: boolean,
  isLightTheme: boolean
): THREE.LineBasicMaterial {
  const key = `sel:${isSelected ? 1 : 0}_act:${isActiveMod ? 1 : 0}_light:${isLightTheme ? 1 : 0}`;
  let m = v3EdgeCache.get(key);
  if (!m) {
    m = new THREE.LineBasicMaterial({
      color: isSelected ? 0xb86b2b : isActiveMod ? 0x1c1917 : isLightTheme ? 0x292524 : 0x64748b,
      linewidth: 1,
      opacity: isSelected ? 1.0 : isActiveMod ? 0.88 : 0.65,
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
      addSubDivider,
      addAdjacentModule,
      rotateActiveModule90,
    } = useV3Adapter();

    const [editingBadge, setEditingBadge] = useState<null | "W" | "H" | "D">(null);
    const [badgeDraftValue, setBadgeDraftValue] = useState<string>("");
    const [localShowDimensions, setLocalShowDimensions] = useState<boolean>(true);
    const [active3DSnap, setActive3DSnap] = useState<ElevationSnapTarget | null>(null);

    const latestStateRef = useRef({
      project,
      activeModuleIndex,
      setActiveModuleIndex,
      setActiveBayIndex,
      setSelectedComponentId,
      setShelfElevation,
      setDrawerPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
    });
    useEffect(() => {
      latestStateRef.current = {
        project,
        activeModuleIndex,
        setActiveModuleIndex,
        setActiveBayIndex,
        setSelectedComponentId,
        setShelfElevation,
        setDrawerPlacement,
        setHangingRailElevation,
        setBayCustomWidth,
        setSubDividerPlacement,
      };
    }, [
      project,
      activeModuleIndex,
      setActiveModuleIndex,
      setActiveBayIndex,
      setSelectedComponentId,
      setShelfElevation,
      setDrawerPlacement,
      setHangingRailElevation,
      setBayCustomWidth,
      setSubDividerPlacement,
    ]);

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
      return list;
    }, [project, activeModuleIndex, effectiveShowDimensions]);

    const sceneRef = useRef<THREE.Scene | null>(null);
    const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null);
    const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const meshGroupRef = useRef<THREE.Group | null>(null);
    const dimGroupRef = useRef<THREE.Group | null>(null);
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
      scene.environment = getStudioEnvironmentTexture();
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
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxDistance = 14000;
      controls.minDistance = 250;
      controls.target.set(900, 1100, 300);
      controls.addEventListener("change", () => {
        needsRenderRef.current = true;
      });
      controlsRef.current = controls;

      // Calibrated Architectural Daylight + Warm Softbox Lighting
      const hemiLight = new THREE.HemisphereLight(0xfffdf8, 0xd8d2c5, 0.9);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xfff7ea, 1.35);
      keyLight.position.set(2800, 4400, 3500);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0005;
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0xeef4fa, 0.55);
      rimLight.position.set(-2400, 2400, -1800);
      scene.add(rimLight);

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

      const meshGroup = new THREE.Group();
      scene.add(meshGroup);
      meshGroupRef.current = meshGroup;

      const dimGroup = new THREE.Group();
      scene.add(dimGroup);
      dimGroupRef.current = dimGroup;

      // Direct model raycast selection + 3D Front/Perspective Interior Component Dragging with Cross-Module Snapping
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let downPos = { x: 0, y: 0 };
      let activeDrag3D: {
        modIdx: number;
        bayIdx: number;
        kind: "shelf" | "drawer" | "rail" | "divider" | "sub_divider";
        targetId: string;
        startValueMm: number;
        itemHeightMm?: number;
        startClientX: number;
        startClientY: number;
        mmPerPx: number;
        hasMoved: boolean;
      } | null = null;

      const handlePointerDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        downPos = { x: e.clientX, y: e.clientY };
        const curRenderer = rendererRef.current;
        const curGroup = meshGroupRef.current;
        const curControls = controlsRef.current;
        if (!curRenderer || !curGroup || !curControls) return;

        const rect = curRenderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const curCam = (curControls.object as THREE.Camera) || perspCamRef.current;
        if (!curCam) return;

        raycaster.setFromCamera(pointer, curCam);
        const hits = raycaster.intersectObjects(curGroup.children, true);
        if (hits.length === 0) return;

        let hitObj: THREE.Object3D | null = hits[0].object;
        while (hitObj && (!hitObj.userData || !hitObj.userData.componentId)) {
          hitObj = hitObj.parent;
        }
        if (!hitObj?.userData?.componentId) return;

        const state = latestStateRef.current;
        const modIdx =
          typeof hitObj.userData.moduleIndex === "number"
            ? hitObj.userData.moduleIndex
            : state.activeModuleIndex;
        const mod = state.project.modules[modIdx];
        if (!mod) return;

        const fourSpaces = calculateFourSpaceDimensions(mod);
        const dragMeta = findDraggableInteriorComponent(
          mod,
          String(hitObj.userData.componentId),
          fourSpaces.usableInternal.bayClearWidthsMm
        );
        if (!dragMeta) return;

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
      };

      const handlePointerMove = (e: MouseEvent) => {
        if (!activeDrag3D) return;
        const dxPx = e.clientX - activeDrag3D.startClientX;
        const dyPx = e.clientY - activeDrag3D.startClientY;
        if (!activeDrag3D.hasMoved && Math.hypot(dxPx, dyPx) < 4) return;
        activeDrag3D.hasMoved = true;

        const state = latestStateRef.current;
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

      const handlePointerUp = (e: MouseEvent) => {
        const curControls = controlsRef.current;
        if (curControls) curControls.enabled = true;

        if (activeDrag3D) {
          const moved = activeDrag3D.hasMoved;
          activeDrag3D = null;
          setActive3DSnap(null);
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
        if (hits.length > 0) {
          let hitObj: THREE.Object3D | null = hits[0].object;
          while (hitObj && (!hitObj.userData || !hitObj.userData.componentId)) {
            hitObj = hitObj.parent;
          }
          if (hitObj?.userData?.componentId) {
            if (typeof hitObj.userData.moduleIndex === "number") {
              state.setActiveModuleIndex(hitObj.userData.moduleIndex);
            }
            state.setSelectedComponentId(hitObj.userData.componentId);
            return;
          }
        }
        state.setSelectedComponentId(null);
      };

      renderer.domElement.addEventListener("mousedown", handlePointerDown);
      window.addEventListener("mousemove", handlePointerMove);
      window.addEventListener("mouseup", handlePointerUp);

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
        renderer.domElement.removeEventListener("mousedown", handlePointerDown);
        window.removeEventListener("mousemove", handlePointerMove);
        window.removeEventListener("mouseup", handlePointerUp);
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update Theme & Grid visibility
    useEffect(() => {
      if (sceneRef.current) {
        const bgHex =
          theme === "warm-light"
            ? 0xd6d2c8
            : theme === "showroom-neutral"
            ? 0xcbc6ba
            : 0x141413;
        sceneRef.current.background = new THREE.Color(bgHex);
      }
      if (gridRef.current) {
        gridRef.current.visible = showGrid;
      }
      requestRender();
    }, [theme, showGrid, requestRender]);

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
            obj.userData.role?.includes("fit");
          const matDef = obj.userData.matDef || DEFAULT_MATERIALS[0];
          obj.material = getV3PbrMaterial(matDef, isSel, isRail);

          if (obj.children.length > 0 && obj.children[0] instanceof THREE.LineSegments) {
            obj.children[0].material = getCachedEdgeMaterial(isSel, isActMod, isLight);
          }
        }
      });

      requestRender();
    }, [activeModuleIndex, selectedComponentId, theme, requestRender]);

    // Rebuild Parametric Meshes ONLY when project geometry or kinematic sliders change
    useEffect(() => {
      const meshGroup = meshGroupRef.current;
      if (!meshGroup) return;

      meshGroup.clear();
      const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
      const isLight = theme !== "dark";

      project.modules.forEach((mod, modIdx) => {
        const breakdown = generateModuleGeometry(mod, {
          doorOpenAngleDeg,
          drawerOpenMm,
          explodedFactor,
        });

        const isActiveMod = modIdx === activeModuleIndex;
        const modContainer = createModuleGroup(mod);

        breakdown.components.forEach((comp) => {
          const matDef = matMap.get(comp.materialId) || DEFAULT_MATERIALS[0];
          const isSelected = comp.id === selectedComponentId;
          const isRail =
            comp.role === "hanging_rail" ||
            ((comp.role === "door_handle" || comp.role === "drawer_handle") &&
              comp.handleCategory !== "milled_wood_grip" &&
              comp.handleCategory !== "j_pull") ||
            comp.role === "gola_profile" ||
            comp.role === "drawer_slide" ||
            comp.role.includes("fit");

          const material = getV3PbrMaterial(matDef, isSelected, isRail);
          const edgeMat = getCachedEdgeMaterial(isSelected, isActiveMod, isLight);

          modContainer.add(
            createComponentMesh(comp, material, edgeMat, {
              componentId: comp.id,
              role: comp.role,
              moduleIndex: modIdx,
              bayIndex: comp.bayIndex,
              matDef,
            })
          );
        });

        meshGroup.add(modContainer);
      });

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

      dimGroup.add(modDimContainer);
      modDimContainer.updateMatrixWorld(true);

      dimWorldAnchorsRef.current = localAnchors.map((a) => ({
        id: a.id,
        worldPos: a.localMidpoint.clone().applyMatrix4(modDimContainer.matrixWorld),
      }));

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

    return (
      <div className="relative w-full h-full select-none overflow-hidden">
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

        {/* Always-accessible 3D Dimension Toggle in bottom-right of any 3D Perspective Viewport */}
        <button
          type="button"
          data-testid="viewport-3d-dimensions-toggle"
          onClick={handleToggleDimensions}
          className={`absolute bottom-3 right-3 z-10 px-2.5 py-1.5 rounded-xl border shadow-sm text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
            effectiveShowDimensions
              ? "bg-amber-700 text-white border-amber-800 hover:bg-amber-800"
              : "bg-white/95 text-stone-700 border-stone-300 hover:bg-stone-100"
          }`}
          title="3D Perspektif Ölçü Çizgilerini Göster / Gizle"
        >
          <Ruler className="w-3.5 h-3.5" />
          <span>{effectiveShowDimensions ? "Ölçüler: Açık" : "Ölçüler: Kapalı"}</span>
        </button>

        {/* IN-CANVAS DIRECT DIMENSION & CONTEXTUAL ACTION HUD */}
        {showInCanvasHud && (
          <div
            data-testid="in-canvas-direct-hud"
            className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-stone-200/90 shadow-md text-xs"
          >
            <span className="font-bold text-stone-800 px-1.5 border-r border-stone-200">
              {activeModule.name}
            </span>

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

            {/* Contextual 1-Click Interior & Module Actions */}
            <button
              type="button"
              data-testid="in-canvas-add-divider"
              onClick={() => addSubDivider(activeBayIndex)}
              className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-amber-50 text-stone-800 font-semibold flex items-center gap-1 cursor-pointer"
              title="İki raf arasına dikey Ara Dikme (bölücü) ekle"
            >
              <Columns className="w-3 h-3 text-amber-700" />
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
