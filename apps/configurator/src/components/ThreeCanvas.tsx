"use client";

import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { generateModuleGeometry } from "@birim/geometry";
import { DEFAULT_MATERIALS, MaterialDefinition } from "@birim/core";

// 1. Shared Unit Geometries (Never recreated, GPU buffer persists across life of app)
const UNIT_BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const UNIT_EDGES_GEO = new THREE.EdgesGeometry(UNIT_BOX_GEO);

// 2. Shared Material Caches (Avoids shader compilation and GPU memory leaks)
const materialCache = new Map<string, THREE.MeshStandardMaterial>();
const edgeMaterialCache = new Map<string, THREE.LineBasicMaterial>();

function getPanelMaterial(matDef: MaterialDefinition, isSelected: boolean, isRail: boolean): THREE.MeshStandardMaterial {
  const key = `${matDef.id}_${isSelected ? 1 : 0}_${isRail ? 1 : 0}`;
  let m = materialCache.get(key);
  if (!m) {
    let matColor = matDef.colorHex;
    let metalness = matDef.metalness;
    let roughness = matDef.roughness;

    if (isRail) {
      matColor = "#cccccc";
      metalness = 0.95;
      roughness = 0.15;
    }

    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(matColor),
      metalness,
      roughness,
      emissive: isSelected ? new THREE.Color(0x2563eb) : new THREE.Color(0x000000),
      emissiveIntensity: isSelected ? 0.35 : 0.0,
    });
    materialCache.set(key, m);
  }
  return m;
}

function getEdgeMaterial(isSelected: boolean): THREE.LineBasicMaterial {
  const key = isSelected ? "sel" : "norm";
  let m = edgeMaterialCache.get(key);
  if (!m) {
    m = new THREE.LineBasicMaterial({
      color: isSelected ? 0x60a5fa : 0x000000,
      linewidth: 1,
      opacity: isSelected ? 0.9 : 0.2,
      transparent: true,
    });
    edgeMaterialCache.set(key, m);
  }
  return m;
}

export default function ThreeCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);
  const project = useConfiguratorStore((s) => s.project);
  const activeModIndex = useConfiguratorStore((s) => s.activeModuleIndex);
  const doorAngle = useConfiguratorStore((s) => s.doorOpenAngleDeg);
  const drawerOpenMm = useConfiguratorStore((s) => s.drawerOpenMm);
  const explodedFactor = useConfiguratorStore((s) => s.explodedFactor);
  const isOrthographic = useConfiguratorStore((s) => s.isOrthographic);
  const cameraPreset = useConfiguratorStore((s) => s.cameraPreset);
  const selectedComponentId = useConfiguratorStore((s) => s.selectedComponentId);
  const setSelectedComponentId = useConfiguratorStore((s) => s.setSelectedComponentId);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const perspCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const needsRenderRef = useRef<boolean>(true);

  const requestRender = useCallback(() => {
    needsRenderRef.current = true;
  }, []);

  // Initialize Scene & On-Demand Render Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    const perspCamera = new THREE.PerspectiveCamera(42, width / height, 10, 25000);
    perspCamera.position.set(2400, 2200, 3400);
    perspCameraRef.current = perspCamera;

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
    orthoCamera.position.set(2400, 2200, 3400);
    orthoCameraRef.current = orthoCamera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const activeCamera = isOrthographic ? orthoCamera : perspCamera;
    const controls = new OrbitControls(activeCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 15000;
    controls.minDistance = 200;
    controls.target.set(1000, 1100, 300);
    controls.addEventListener("change", () => {
      needsRenderRef.current = true;
    });
    controlsRef.current = controls;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfff8ee, 1.3);
    mainLight.position.set(3000, 4500, 3500);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.bias = -0.0005;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xddeeff, 0.6);
    fillLight.position.set(-2500, 2500, -1800);
    scene.add(fillLight);

    // Floor Grid
    const grid = new THREE.GridHelper(8000, 80, 0x334155, 0x1e293b);
    grid.position.y = -2;
    scene.add(grid);

    const shadowPlaneGeo = new THREE.PlaneGeometry(8000, 8000);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.28 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    // Raycaster for click selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (e: MouseEvent) => {
      const activeRenderer = rendererRef.current;
      const currentMeshGroup = meshGroupRef.current;
      if (!activeRenderer || !currentMeshGroup) return;

      const rect = activeRenderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const currentCam = (controlsRef.current?.object as THREE.Camera) || perspCameraRef.current;
      if (!currentCam) return;

      raycaster.setFromCamera(mouse, currentCam);
      const intersects = raycaster.intersectObjects(currentMeshGroup.children, true);
      if (intersects.length > 0) {
        const topObject = intersects[0].object;
        if (topObject.userData && topObject.userData.componentId) {
          setSelectedComponentId(topObject.userData.componentId);
        }
      } else {
        setSelectedComponentId(null);
      }
    };

    renderer.domElement.addEventListener("click", handleClick);

    // On-demand rendering loop: Only renders when camera moves or scene is flagged dirty
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const currentControls = controlsRef.current;
      const currentRenderer = rendererRef.current;
      const currentScene = sceneRef.current;
      if (!currentControls || !currentRenderer || !currentScene) return;

      const controlsUpdated = currentControls.update();
      if (needsRenderRef.current || controlsUpdated) {
        const curCam = (currentControls.object as THREE.Camera) || perspCameraRef.current;
        if (curCam) currentRenderer.render(currentScene, curCam);
        needsRenderRef.current = false;
      }
    };
    animate();

    const handleResize = () => {
      const currentRenderer = rendererRef.current;
      if (!container || !currentRenderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      if (perspCameraRef.current) {
        perspCameraRef.current.aspect = w / h;
        perspCameraRef.current.updateProjectionMatrix();
      }
      if (orthoCameraRef.current) {
        const asp = w / h;
        const d = 1800;
        orthoCameraRef.current.left = -d * asp;
        orthoCameraRef.current.right = d * asp;
        orthoCameraRef.current.top = d;
        orthoCameraRef.current.bottom = -d;
        orthoCameraRef.current.updateProjectionMatrix();
      }
      currentRenderer.setSize(w, h);
      needsRenderRef.current = true;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [setSelectedComponentId]);

  // Seamless Camera Projection Switching (Perspective <-> Orthographic) without destroying scene
  useEffect(() => {
    const controls = controlsRef.current;
    const perspCam = perspCameraRef.current;
    const orthoCam = orthoCameraRef.current;
    if (!controls || !perspCam || !orthoCam) return;

    if (isOrthographic) {
      // Perspective -> Orthographic
      const offset = new THREE.Vector3().subVectors(perspCam.position, controls.target);
      const dist = offset.length();
      const fovRad = (perspCam.fov * Math.PI) / 180;
      const visibleHeight = 2 * dist * Math.tan(fovRad / 2);
      if (visibleHeight > 0) {
        orthoCam.zoom = 3600 / visibleHeight;
      }
      orthoCam.position.copy(perspCam.position);
      orthoCam.quaternion.copy(perspCam.quaternion);
      orthoCam.updateProjectionMatrix();

      controls.object = orthoCam;
    } else {
      // Orthographic -> Perspective
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

  // Handle camera presets
  useEffect(() => {
    const controls = controlsRef.current;
    const perspCam = perspCameraRef.current;
    const orthoCam = orthoCameraRef.current;
    const activeMod = project.modules[activeModIndex] || project.modules[0];
    if (!controls || !perspCam || !orthoCam || !activeMod) return;

    const { width, height, depth } = activeMod.dimensions;
    const centerX = activeMod.position.x + width / 2;
    const centerY = activeMod.position.y + height / 2;
    const centerZ = activeMod.position.z + depth / 2;
    controls.target.set(centerX, centerY, centerZ);

    const maxDim = Math.max(width, height, depth);
    const fitDist = maxDim * 2.2;

    const targetPos = new THREE.Vector3();
    if (cameraPreset === "front") {
      targetPos.set(centerX, centerY, centerZ + fitDist);
    } else if (cameraPreset === "side") {
      targetPos.set(centerX - fitDist, centerY, centerZ);
    } else if (cameraPreset === "top") {
      targetPos.set(centerX, centerY + fitDist, centerZ + 1);
    } else {
      targetPos.set(centerX + width * 1.2, centerY + height * 1.1, centerZ + Math.max(width, height) * 1.3);
    }

    perspCam.position.copy(targetPos);
    perspCam.lookAt(centerX, centerY, centerZ);
    perspCam.updateProjectionMatrix();

    orthoCam.position.copy(targetPos);
    orthoCam.lookAt(centerX, centerY, centerZ);
    const fovRad = (perspCam.fov * Math.PI) / 180;
    const visibleHeight = 2 * targetPos.distanceTo(controls.target) * Math.tan(fovRad / 2);
    if (visibleHeight > 0) {
      orthoCam.zoom = 3600 / visibleHeight;
    }
    orthoCam.updateProjectionMatrix();

    controls.update();
    requestRender();
  }, [cameraPreset, project, activeModIndex, requestRender]);

  // Fast selection highlight without rebuilding scene geometry
  useEffect(() => {
    const meshGroup = meshGroupRef.current;
    if (!meshGroup) return;

    meshGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData && child.userData.componentId) {
        const isSelected = child.userData.componentId === selectedComponentId;
        const isRail = child.userData.role === "hanging_rail" || child.userData.role?.includes("fit");
        const matDef = child.userData.matDef || DEFAULT_MATERIALS[0];
        child.material = getPanelMaterial(matDef, isSelected, isRail);

        // Update wireframe child
        if (child.children.length > 0 && child.children[0] instanceof THREE.LineSegments) {
          child.children[0].material = getEdgeMaterial(isSelected);
        }
      }
    });
    requestRender();
  }, [selectedComponentId, requestRender]);

  // Update Geometry & Meshes (Shared Unit Geometry + Scaled Meshes)
  useEffect(() => {
    const meshGroup = meshGroupRef.current;
    if (!meshGroup) return;

    // Fast clear without disposing shared unit geometries or materials
    meshGroup.clear();

    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));

    project.modules.forEach((mod) => {
      const breakdown = generateModuleGeometry(mod, {
        doorOpenAngleDeg: doorAngle,
        drawerOpenMm,
        explodedFactor,
      });

      const modOffsetX = mod.position.x;
      const modOffsetY = mod.position.y;
      const modOffsetZ = mod.position.z;

      breakdown.components.forEach((comp) => {
        const matDef = matMap.get(comp.materialId) || DEFAULT_MATERIALS[0];
        const isSelected = comp.id === selectedComponentId;
        const isRail = comp.role === "hanging_rail" || comp.role.includes("fit");

        const material = getPanelMaterial(matDef, isSelected, isRail);
        const wireMat = getEdgeMaterial(isSelected);

        const compW = Math.max(1, comp.dimensions.width);
        const compH = Math.max(1, comp.dimensions.height);
        const compD = Math.max(1, comp.dimensions.depth);

        // Handle pivot for swinging door opening
        if (
          comp.role.includes("door") &&
          comp.rotation &&
          comp.rotation[1] !== 0 &&
          !comp.id.includes("sliding")
        ) {
          const doorMesh = new THREE.Mesh(UNIT_BOX_GEO, material);
          doorMesh.scale.set(compW, compH, compD);
          doorMesh.castShadow = true;
          doorMesh.receiveShadow = true;
          doorMesh.userData = { componentId: comp.id, role: comp.role, matDef };

          const pivot = new THREE.Group();
          const isLeftDoor = comp.role === "door_left";
          const hingeX = isLeftDoor ? comp.position.x : comp.position.x + comp.dimensions.width;

          pivot.position.set(modOffsetX + hingeX, modOffsetY + comp.position.y, modOffsetZ + comp.position.z);

          const localOffsetX = isLeftDoor ? comp.dimensions.width / 2 : -comp.dimensions.width / 2;
          doorMesh.position.set(localOffsetX, comp.dimensions.height / 2, comp.dimensions.depth / 2);

          const wire = new THREE.LineSegments(UNIT_EDGES_GEO, wireMat);
          wire.scale.copy(doorMesh.scale);
          doorMesh.add(wire);

          pivot.rotation.y = comp.rotation[1];
          pivot.add(doorMesh);
          meshGroup.add(pivot);
        } else {
          const mesh = new THREE.Mesh(UNIT_BOX_GEO, material);
          mesh.scale.set(compW, compH, compD);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData = { componentId: comp.id, role: comp.role, matDef };

          mesh.position.set(
            modOffsetX + comp.position.x + comp.dimensions.width / 2,
            modOffsetY + comp.position.y + comp.dimensions.height / 2,
            modOffsetZ + comp.position.z + comp.dimensions.depth / 2
          );

          const wire = new THREE.LineSegments(UNIT_EDGES_GEO, wireMat);
          wire.scale.copy(mesh.scale);
          mesh.add(wire);

          meshGroup.add(mesh);
        }
      });
    });

    requestRender();
  }, [project, activeModIndex, doorAngle, drawerOpenMm, explodedFactor, requestRender, selectedComponentId]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 3D Viewport Top HUD Controls */}
      <div className="absolute top-4 left-4 flex gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs">
        <button
          onClick={() => useConfiguratorStore.getState().setCameraPreset("iso")}
          className={`px-2.5 py-1 rounded transition-colors ${cameraPreset === "iso" ? "bg-amber-600 font-semibold text-white" : "text-slate-300 hover:bg-slate-800"}`}
        >
          İzo (3D)
        </button>
        <button
          onClick={() => useConfiguratorStore.getState().setCameraPreset("front")}
          className={`px-2.5 py-1 rounded transition-colors ${cameraPreset === "front" ? "bg-amber-600 font-semibold text-white" : "text-slate-300 hover:bg-slate-800"}`}
        >
          Ön (Görünüş)
        </button>
        <button
          onClick={() => useConfiguratorStore.getState().setCameraPreset("side")}
          className={`px-2.5 py-1 rounded transition-colors ${cameraPreset === "side" ? "bg-amber-600 font-semibold text-white" : "text-slate-300 hover:bg-slate-800"}`}
        >
          Yan (Profil)
        </button>
        <button
          onClick={() => useConfiguratorStore.getState().setCameraPreset("top")}
          className={`px-2.5 py-1 rounded transition-colors ${cameraPreset === "top" ? "bg-amber-600 font-semibold text-white" : "text-slate-300 hover:bg-slate-800"}`}
        >
          Üst (Plan)
        </button>
        <div className="h-4 w-px bg-slate-700 my-auto" />
        <button
          onClick={() => useConfiguratorStore.getState().setOrthographic(false)}
          className={`px-2.5 py-1 rounded transition-colors ${!isOrthographic ? "bg-amber-600 font-semibold text-white" : "text-slate-300 hover:bg-slate-800"}`}
        >
          Perspektif
        </button>
        <button
          onClick={() => useConfiguratorStore.getState().setOrthographic(true)}
          className={`px-2.5 py-1 rounded transition-colors ${isOrthographic ? "bg-amber-600 font-semibold text-white" : "text-slate-300 hover:bg-slate-800"}`}
        >
          Ortografik
        </button>
      </div>

      {/* 3D Animation & Exploded View Sliders Bottom HUD */}
      <div className="absolute bottom-4 left-4 bg-slate-900/85 backdrop-blur-md p-3 rounded-lg border border-slate-700/60 text-xs flex flex-wrap items-center gap-4">
        {/* Door Angle Slider */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Kapak:</span>
          <input
            type="range"
            min={0}
            max={90}
            value={doorAngle}
            onChange={(e) => useConfiguratorStore.getState().setDoorOpenAngleDeg(Number(e.target.value))}
            className="w-20 accent-amber-500 cursor-pointer"
          />
          <span className="font-mono text-amber-400 w-8">{doorAngle}°</span>
        </div>

        {/* Drawer Pull-out Slider */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Çekmece:</span>
          <input
            type="range"
            min={0}
            max={350}
            step={10}
            value={drawerOpenMm}
            onChange={(e) => useConfiguratorStore.getState().setDrawerOpenMm(Number(e.target.value))}
            className="w-20 accent-blue-500 cursor-pointer"
          />
          <span className="font-mono text-blue-400 w-12">{drawerOpenMm}mm</span>
        </div>

        {/* Exploded View Slider */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Patlatılmış:</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={explodedFactor}
            onChange={(e) => useConfiguratorStore.getState().setExplodedFactor(Number(e.target.value))}
            className="w-20 accent-emerald-500 cursor-pointer"
          />
          <span className="font-mono text-emerald-400 w-10">{Math.round(explodedFactor * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
