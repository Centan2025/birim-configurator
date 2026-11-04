"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { generateModuleGeometry } from "@birim/geometry";
import { DEFAULT_MATERIALS } from "@birim/core";

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

  // Initialize Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d); // Darker professional graphite
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
      1,
      30000
    );
    orthoCamera.position.set(2400, 2200, 3400);
    orthoCameraRef.current = orthoCamera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
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
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const currentCam = isOrthographic ? orthoCameraRef.current : perspCameraRef.current;
      if (!currentCam) return;

      raycaster.setFromCamera(mouse, currentCam);
      const intersects = raycaster.intersectObjects(meshGroup.children, true);
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

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      const curCam = isOrthographic ? orthoCameraRef.current : perspCameraRef.current;
      if (curCam) renderer.render(scene, curCam);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
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
      renderer.setSize(w, h);
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
  }, [setSelectedComponentId, isOrthographic]);

  // Handle camera presets
  useEffect(() => {
    const controls = controlsRef.current;
    const camera = isOrthographic ? orthoCameraRef.current : perspCameraRef.current;
    const activeMod = project.modules[activeModIndex] || project.modules[0];
    if (!controls || !camera || !activeMod) return;

    const { width, height, depth } = activeMod.dimensions;
    const centerX = activeMod.position.x + width / 2;
    const centerY = activeMod.position.y + height / 2;
    const centerZ = activeMod.position.z + depth / 2;
    controls.target.set(centerX, centerY, centerZ);

    if (cameraPreset === "front") {
      camera.position.set(centerX, centerY, Math.max(width, height) * 2);
    } else if (cameraPreset === "side") {
      camera.position.set(-Math.max(depth, height) * 2.2, centerY, centerZ);
    } else if (cameraPreset === "top") {
      camera.position.set(centerX, Math.max(width, depth) * 2.5, centerZ + 1);
    } else {
      camera.position.set(centerX + width * 1.2, centerY + height * 1.1, centerZ + Math.max(width, height) * 1.3);
    }
  }, [cameraPreset, project, activeModIndex, isOrthographic]);

  // Update Geometry & Meshes
  useEffect(() => {
    const meshGroup = meshGroupRef.current;
    if (!meshGroup) return;

    while (meshGroup.children.length > 0) {
      const child = meshGroup.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      meshGroup.remove(child);
    }

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

        const geo = new THREE.BoxGeometry(
          Math.max(1, comp.dimensions.width),
          Math.max(1, comp.dimensions.height),
          Math.max(1, comp.dimensions.depth)
        );

        let matColor = matDef.colorHex;
        let metalness = matDef.metalness;
        let roughness = matDef.roughness;

        if (comp.role === "hanging_rail" || comp.role.includes("fit")) {
          matColor = "#cccccc";
          metalness = 0.95;
          roughness = 0.15;
        }

        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(matColor),
          metalness,
          roughness,
          emissive: isSelected ? new THREE.Color(0x2563eb) : new THREE.Color(0x000000),
          emissiveIntensity: isSelected ? 0.35 : 0.0,
        });

        // Handle pivot for swinging door opening
        if (
          comp.role.includes("door") &&
          comp.rotation &&
          comp.rotation[1] !== 0 &&
          !comp.id.includes("sliding")
        ) {
          const doorMesh = new THREE.Mesh(geo, material);
          doorMesh.castShadow = true;
          doorMesh.receiveShadow = true;
          doorMesh.userData = { componentId: comp.id, role: comp.role };

          const pivot = new THREE.Group();
          const isLeftDoor = comp.role === "door_left";
          const hingeX = isLeftDoor ? comp.position.x : comp.position.x + comp.dimensions.width;

          pivot.position.set(modOffsetX + hingeX, modOffsetY + comp.position.y, modOffsetZ + comp.position.z);

          const localOffsetX = isLeftDoor ? comp.dimensions.width / 2 : -comp.dimensions.width / 2;
          doorMesh.position.set(localOffsetX, comp.dimensions.height / 2, comp.dimensions.depth / 2);

          pivot.rotation.y = comp.rotation[1];
          pivot.add(doorMesh);
          meshGroup.add(pivot);
        } else {
          const mesh = new THREE.Mesh(geo, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData = { componentId: comp.id, role: comp.role };

          mesh.position.set(
            modOffsetX + comp.position.x + comp.dimensions.width / 2,
            modOffsetY + comp.position.y + comp.dimensions.height / 2,
            modOffsetZ + comp.position.z + comp.dimensions.depth / 2
          );

          const wireGeo = new THREE.EdgesGeometry(geo);
          const wireMat = new THREE.LineBasicMaterial({
            color: isSelected ? 0x60a5fa : 0x000000,
            linewidth: 1,
            opacity: isSelected ? 0.9 : 0.2,
            transparent: true,
          });
          const wire = new THREE.LineSegments(wireGeo, wireMat);
          mesh.add(wire);

          meshGroup.add(mesh);
        }
      });
    });
  }, [project, activeModIndex, doorAngle, drawerOpenMm, explodedFactor, selectedComponentId]);

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
          onClick={() => useConfiguratorStore.getState().toggleOrthographic()}
          className={`px-2 py-1 rounded transition-colors ${isOrthographic ? "bg-blue-600 font-semibold text-white" : "text-slate-300 hover:bg-slate-800"}`}
        >
          {isOrthographic ? "Ortografik" : "Perspektif"}
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
