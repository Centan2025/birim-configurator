"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  useV3Adapter,
  generateModuleGeometry,
  DEFAULT_MATERIALS,
  getModuleOrientedFootprint,
} from "../adapter/useV3Adapter";
import {
  getV3PbrMaterial,
  getStudioEnvironmentTexture,
} from "../materials/pbrMaterialSystem";
import { Plus, Layers, RotateCw, Columns } from "lucide-react";

// Shared GPU Unit Geometry & Edges across all V3.1 modes
const SHARED_UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const SHARED_UNIT_EDGES = new THREE.EdgesGeometry(SHARED_UNIT_BOX);

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

export interface V3ThreeViewportProps {
  theme?: "warm-light" | "showroom-neutral" | "dark";
  showGrid?: boolean;
  showInCanvasHud?: boolean;
  onPerformanceSample?: (metrics: { lastRenderMs: number }) => void;
}

export const V3ThreeViewport: React.FC<V3ThreeViewportProps> = React.memo(
  ({
    theme = "warm-light",
    showGrid = true,
    showInCanvasHud = true,
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
      setDimensions,
      addShelf,
      addDrawer,
      addSubDivider,
      addAdjacentModule,
      rotateActiveModule90,
    } = useV3Adapter();

    const [editingBadge, setEditingBadge] = useState<null | "W" | "H" | "D">(null);
    const [badgeDraftValue, setBadgeDraftValue] = useState<string>("");

    const sceneRef = useRef<THREE.Scene | null>(null);
    const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null);
    const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const meshGroupRef = useRef<THREE.Group | null>(null);
    const gridRef = useRef<THREE.GridHelper | null>(null);
    const needsRenderRef = useRef<boolean>(true);

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

      // Direct model raycast selection
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let downPos = { x: 0, y: 0 };

      const handlePointerDown = (e: MouseEvent) => {
        downPos = { x: e.clientX, y: e.clientY };
      };

      const handlePointerUp = (e: MouseEvent) => {
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
        if (hits.length > 0) {
          let hitObj: THREE.Object3D | null = hits[0].object;
          while (hitObj && (!hitObj.userData || !hitObj.userData.componentId)) {
            hitObj = hitObj.parent;
          }
          if (hitObj?.userData?.componentId) {
            if (typeof hitObj.userData.moduleIndex === "number") {
              setActiveModuleIndex(hitObj.userData.moduleIndex);
            }
            setSelectedComponentId(hitObj.userData.componentId);
            return;
          }
        }
        setSelectedComponentId(null);
      };

      renderer.domElement.addEventListener("mousedown", handlePointerDown);
      renderer.domElement.addEventListener("mouseup", handlePointerUp);

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
          if (cam) curRenderer.render(curScene, cam);
          const dt = performance.now() - t0;
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
        }
        needsRenderRef.current = true;
      });
      resizeObserver.observe(container);

      return () => {
        cancelAnimationFrame(animId);
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener("mousedown", handlePointerDown);
        renderer.domElement.removeEventListener("mouseup", handlePointerUp);
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
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

    // Camera Preset Transitions (triggered only when cameraPreset changes)
    useEffect(() => {
      const controls = controlsRef.current;
      const perspCam = perspCamRef.current;
      const orthoCam = orthoCamRef.current;
      const activeMod = project.modules[activeModuleIndex] || project.modules[0];
      if (!controls || !perspCam || !orthoCam || !activeMod) return;

      const fp = getModuleOrientedFootprint(activeMod, activeModuleIndex);
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

    // Fast Selection & Active Module Highlight WITHOUT rebuilding scene geometry (keeps Plan selection < 15ms!)
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
            obj.userData.role === "drawer_handle" ||
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
        const rotYDeg = ((mod.rotation?.y || 0) % 360 + 360) % 360;

        // Module container group supports 90-degree L/U corner rotation around its top-left origin
        const modContainer = new THREE.Group();
        modContainer.position.set(mod.position.x, mod.position.y, mod.position.z);
        if (rotYDeg === 90) {
          modContainer.rotation.y = Math.PI / 2;
          modContainer.position.z += mod.dimensions.width;
        } else if (rotYDeg === 270) {
          modContainer.rotation.y = -Math.PI / 2;
          modContainer.position.x += mod.dimensions.depth;
        }

        breakdown.components.forEach((comp) => {
          const matDef = matMap.get(comp.materialId) || DEFAULT_MATERIALS[0];
          const isSelected = comp.id === selectedComponentId;
          const isRail =
            comp.role === "hanging_rail" ||
            comp.role === "drawer_handle" ||
            comp.role === "drawer_slide" ||
            comp.role.includes("fit");

          const material = getV3PbrMaterial(matDef, isSelected, isRail);
          const edgeMat = getCachedEdgeMaterial(isSelected, isActiveMod, isLight);

          const w = Math.max(1, comp.dimensions.width);
          const h = Math.max(1, comp.dimensions.height);
          const d = Math.max(1, comp.dimensions.depth);

          if (
            comp.role.includes("door") &&
            comp.rotation &&
            comp.rotation[1] !== 0 &&
            !comp.id.includes("sliding")
          ) {
            const doorMesh = new THREE.Mesh(SHARED_UNIT_BOX, material);
            doorMesh.scale.set(w, h, d);
            doorMesh.castShadow = true;
            doorMesh.receiveShadow = true;
            doorMesh.userData = {
              componentId: comp.id,
              role: comp.role,
              moduleIndex: modIdx,
              bayIndex: comp.bayIndex,
              matDef,
            };

            const pivot = new THREE.Group();
            const isLeftDoor = comp.role === "door_left";
            const hingeX = isLeftDoor ? comp.position.x : comp.position.x + comp.dimensions.width;
            pivot.position.set(hingeX, comp.position.y, comp.position.z);

            const localX = isLeftDoor ? comp.dimensions.width / 2 : -comp.dimensions.width / 2;
            doorMesh.position.set(localX, comp.dimensions.height / 2, comp.dimensions.depth / 2);

            const wire = new THREE.LineSegments(SHARED_UNIT_EDGES, edgeMat);
            doorMesh.add(wire);

            pivot.rotation.y = comp.rotation[1];
            pivot.add(doorMesh);
            modContainer.add(pivot);
          } else {
            const mesh = new THREE.Mesh(SHARED_UNIT_BOX, material);
            mesh.scale.set(w, h, d);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = {
              componentId: comp.id,
              role: comp.role,
              moduleIndex: modIdx,
              bayIndex: comp.bayIndex,
              matDef,
            };

            mesh.position.set(
              comp.position.x + comp.dimensions.width / 2,
              comp.position.y + comp.dimensions.height / 2,
              comp.position.z + comp.dimensions.depth / 2
            );

            const wire = new THREE.LineSegments(SHARED_UNIT_EDGES, edgeMat);
            mesh.add(wire);

            modContainer.add(mesh);
          }
        });

        meshGroup.add(modContainer);
      });

      requestRender();
    }, [project, doorOpenAngleDeg, drawerOpenMm, explodedFactor, requestRender]);

    if (!activeModule) return null;
    const { width, height, depth } = activeModule.dimensions;

    const commitBadgeEdit = () => {
      const val = Number(badgeDraftValue);
      if (!Number.isNaN(val) && editingBadge) {
        if (editingBadge === "W") {
          setDimensions(Math.min(3600, Math.max(300, val)), height, depth);
        } else if (editingBadge === "H") {
          setDimensions(width, Math.min(2800, Math.max(400, val)), depth);
        } else if (editingBadge === "D") {
          setDimensions(width, height, Math.min(900, Math.max(250, val)));
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

        {/* IN-CANVAS DIRECT DIMENSION & CONTEXTUAL ACTION HUD */}
        {showInCanvasHud && (
          <div
            data-testid="in-canvas-direct-hud"
            className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-stone-200/90 shadow-md text-xs"
          >
            <span className="font-bold text-stone-800 px-1.5 border-r border-stone-200">
              {activeModule.name}
            </span>

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
              data-testid="in-canvas-add-module"
              onClick={addAdjacentModule}
              className="px-2 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold flex items-center gap-1 cursor-pointer"
              title="Yanına Bitişik Modül Ekle"
            >
              <Plus className="w-3 h-3" />
              <span>Modül</span>
            </button>
          </div>
        )}
      </div>
    );
  }
);

V3ThreeViewport.displayName = "V3ThreeViewport";
export default V3ThreeViewport;
