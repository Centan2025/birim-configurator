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
  const cameraPreset = useConfiguratorStore((s) => s.cameraPreset);
  const selectedComponentId = useConfiguratorStore((s) => s.selectedComponentId);
  const setSelectedComponentId = useConfiguratorStore((s) => s.setSelectedComponentId);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Slate-900
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 10, 20000);
    camera.position.set(2200, 2200, 3200);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 10000;
    controls.minDistance = 300;
    controls.target.set(900, 1100, 300);
    controlsRef.current = controls;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfffbf0, 1.4);
    mainLight.position.set(2500, 4000, 3000);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.bias = -0.0005;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xddeeff, 0.5);
    fillLight.position.set(-2000, 2500, -1500);
    scene.add(fillLight);

    // Floor Grid & Shadow Plane
    const grid = new THREE.GridHelper(6000, 60, 0x334155, 0x1e293b);
    grid.position.y = -2;
    scene.add(grid);

    const shadowPlaneGeo = new THREE.PlaneGeometry(6000, 6000);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Mesh container
    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    // Raycasting for interactive click selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
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

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
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
  }, [setSelectedComponentId]);

  // Handle camera presets
  useEffect(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const activeMod = project.modules[activeModIndex] || project.modules[0];
    if (!controls || !camera || !activeMod) return;

    const { width, height, depth } = activeMod.dimensions;
    const centerX = width / 2;
    const centerY = height / 2;
    const centerZ = depth / 2;
    controls.target.set(centerX, centerY, centerZ);

    if (cameraPreset === "front") {
      camera.position.set(centerX, centerY, Math.max(width, height) * 1.8);
    } else if (cameraPreset === "side") {
      camera.position.set(-Math.max(depth, height) * 2, centerY, centerZ);
    } else if (cameraPreset === "top") {
      camera.position.set(centerX, Math.max(width, depth) * 2.2, centerZ + 1);
    } else {
      // Isometric view
      camera.position.set(width * 1.4, height * 1.3, depth + Math.max(width, height) * 1.2);
    }
  }, [cameraPreset, project, activeModIndex]);

  // Update Geometry & Meshes when project, doorAngle or selection changes
  useEffect(() => {
    const meshGroup = meshGroupRef.current;
    if (!meshGroup) return;

    // Clear existing meshes
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

    const activeMod = project.modules[activeModIndex] || project.modules[0];
    if (!activeMod) return;

    // Materials map
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));

    // Generate geometry for all modules
    project.modules.forEach((mod) => {
      const breakdown = generateModuleGeometry(mod, { doorOpenAngleDeg: doorAngle });
      const modOffsetX = mod.position.x;
      const modOffsetY = mod.position.y;
      const modOffsetZ = mod.position.z;

      breakdown.components.forEach((comp) => {
        const matDef = matMap.get(comp.materialId) || DEFAULT_MATERIALS[0];
        const isSelected = comp.id === selectedComponentId;

        // Build box geometry
        const geo = new THREE.BoxGeometry(
          Math.max(1, comp.dimensions.width),
          Math.max(1, comp.dimensions.height),
          Math.max(1, comp.dimensions.depth)
        );

        let matColor = matDef.colorHex;
        let metalness = matDef.metalness;
        let roughness = matDef.roughness;

        if (comp.role === "hanging_rail") {
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

        // Handle pivot for door opening
        if (comp.role.includes("door") && comp.rotation && comp.rotation[1] !== 0) {
          const doorMesh = new THREE.Mesh(geo, material);
          doorMesh.castShadow = true;
          doorMesh.receiveShadow = true;
          doorMesh.userData = { componentId: comp.id, role: comp.role };

          // Pivot group
          const pivot = new THREE.Group();
          const isLeftDoor = comp.role === "door_left";
          const hingeX = isLeftDoor ? comp.position.x : comp.position.x + comp.dimensions.width;

          pivot.position.set(modOffsetX + hingeX, modOffsetY + comp.position.y, modOffsetZ + comp.position.z);

          // Position mesh relative to pivot
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

          // Edge lines for technical CAD look
          const wireGeo = new THREE.EdgesGeometry(geo);
          const wireMat = new THREE.LineBasicMaterial({
            color: isSelected ? 0x60a5fa : 0x000000,
            linewidth: 1,
            opacity: isSelected ? 0.9 : 0.25,
            transparent: true,
          });
          const wire = new THREE.LineSegments(wireGeo, wireMat);
          mesh.add(wire);

          meshGroup.add(mesh);
        }
      });
    });
  }, [project, activeModIndex, doorAngle, selectedComponentId]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      {/* 3D Viewport HUD Controls */}
      <div className="absolute top-4 left-4 flex gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs">
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
      </div>

      <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700/60 text-xs flex items-center gap-3">
        <span className="text-slate-400">Kapak Açıklığı:</span>
        <input
          type="range"
          min={0}
          max={90}
          value={doorAngle}
          onChange={(e) => useConfiguratorStore.getState().setDoorOpenAngleDeg(Number(e.target.value))}
          className="w-24 accent-amber-500 cursor-pointer"
        />
        <span className="font-mono text-amber-400">{doorAngle}°</span>
        <button
          onClick={() => useConfiguratorStore.getState().toggleDoorOpen()}
          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600"
        >
          {doorAngle > 0 ? "Kapat" : "Aç"}
        </button>
      </div>
    </div>
  );
}
