"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { DEFAULT_MATERIALS, type MaterialDefinition } from "@birim/core";
import type { V4ModuleTemplateDefinition } from "@birim/catalog";
import { generateModuleGeometry } from "../adapter/useV3Adapter";
import { createComponentMesh } from "../../components/componentMesh";
import { disposeRendererPmremEnvironment, getStudioPmremEnvironment, getV3PbrMaterial } from "../materials/pbrMaterialSystem";
import {
  attachWebGLContextRecovery,
  disposeObject3DTree,
  disposeWebGLRendererCleanly,
  getCachedHardwarePerformanceTier,
  markSharedMaterial,
  probeWebGL2Support,
} from "../materials/webglResourceGuard";
import { V3IsometricModuleIcon } from "./V3IsometricModuleIcon";

const THUMB_SHARED_MATS = {
  metal: markSharedMaterial(new THREE.MeshStandardMaterial({ color: 0x333840, roughness: 0.32, metalness: 0.76 })),
  door: markSharedMaterial(new THREE.MeshStandardMaterial({ color: 0xe2e0dc, roughness: 0.72, metalness: 0.02 })),
  darkAccent: markSharedMaterial(new THREE.MeshStandardMaterial({ color: 0x3b3e44, roughness: 0.82, metalness: 0.03 })),
  outerCarcass: markSharedMaterial(new THREE.MeshStandardMaterial({ color: 0xf4f3f0, roughness: 0.78, metalness: 0.02 })),
  innerCarcass: markSharedMaterial(new THREE.MeshStandardMaterial({ color: 0xe8e6e2, roughness: 0.76, metalness: 0.02 })),
};

const thumbnailDataUrlCache = new Map<string, string>();
const pendingQueue: Array<{
  template: V4ModuleTemplateDefinition;
  resolve: (url: string | null) => void;
}> = [];
let isDrainingQueue = false;

let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedScene: THREE.Scene | null = null;
let sharedCamera: THREE.PerspectiveCamera | null = null;
let sharedModHolder: THREE.Group | null = null;
let sharedKeyLight: THREE.DirectionalLight | null = null;
let sharedEdgeMat: THREE.LineBasicMaterial | null = null;
let detachStudioThumbRecovery: (() => void) | null = null;
let studioThumbIdleTimer: ReturnType<typeof setTimeout> | null = null;
let webglUnavailable = false;

function resetStudioThumbStage(): void {
  if (studioThumbIdleTimer) {
    clearTimeout(studioThumbIdleTimer);
    studioThumbIdleTimer = null;
  }
  if (detachStudioThumbRecovery) {
    detachStudioThumbRecovery();
    detachStudioThumbRecovery = null;
  }
  if (sharedScene) {
    sharedScene.environment = null;
    disposeObject3DTree(sharedScene);
    sharedScene = null;
  }
  if (sharedRenderer) {
    disposeRendererPmremEnvironment(sharedRenderer);
    disposeWebGLRendererCleanly(sharedRenderer);
    sharedRenderer = null;
  }
  sharedCamera = null;
  sharedModHolder = null;
  sharedKeyLight = null;
  sharedEdgeMat = null;
}

function scheduleStudioThumbIdleRelease(): void {
  if (studioThumbIdleTimer) clearTimeout(studioThumbIdleTimer);
  studioThumbIdleTimer = setTimeout(() => {
    studioThumbIdleTimer = null;
    if (!isDrainingQueue && pendingQueue.length === 0) {
      resetStudioThumbStage();
    }
  }, 12_000);
}

const THUMB_W = 440;
const THUMB_H = 250;

function getOrInitStudioThumbStage(): boolean {
  if (webglUnavailable || typeof document === "undefined") return false;
  // On software/low-spec integrated GPUs or WebGL2-less PCs, skip spawning a 2nd WebGL2 context
  // so V3IsometricModuleIcon renders instantly with 0 VRAM / context pressure.
  const hwTier = getCachedHardwarePerformanceTier();
  if (hwTier === "tier0_software" || hwTier === "tier1_low_igpu") {
    webglUnavailable = true;
    return false;
  }
  const cap = probeWebGL2Support();
  if (!cap.supported || cap.isLegacyOrLowSpecGpu) {
    webglUnavailable = true;
    return false;
  }
  if (sharedRenderer && sharedScene && sharedCamera && sharedModHolder) return true;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_W;
    canvas.height = THUMB_H;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    renderer.setSize(THUMB_W, THUMB_H, false);
    renderer.setPixelRatio(1);
    detachStudioThumbRecovery = attachWebGLContextRecovery(renderer.domElement, {
      onContextLost: () => {
        resetStudioThumbStage();
      },
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x888d96);
    scene.environment = getStudioPmremEnvironment(renderer);
    (scene as unknown as { environmentIntensity?: number }).environmentIntensity = 0.52;

    // Medium cool-grey architectural studio wall so light cabinets pop clearly
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x888d96,
      roughness: 0.95,
      metalness: 0.0,
    });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(14000, 9000), wallMat);
    backWall.position.set(0, 3200, -14);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Darker matte concrete-grey studio floor for crisp cabinet base separation
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x676c75,
      roughness: 0.88,
      metalness: 0.02,
    });
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(14000, 12000), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, -1, 5800);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Sculpted architectural studio daylight with clear side/front contrast
    const hemi = new THREE.HemisphereLight(0xffffff, 0x5c616a, 0.95);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.95);
    key.position.set(-2200, 3200, 2600);
    key.castShadow = true;
    key.shadow.mapSize.width = 1024;
    key.shadow.mapSize.height = 1024;
    key.shadow.camera.left = -2600;
    key.shadow.camera.right = 2600;
    key.shadow.camera.top = 2800;
    key.shadow.camera.bottom = -400;
    key.shadow.camera.near = 200;
    key.shadow.camera.far = 9000;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.35;
    key.shadow.radius = 2.8;
    scene.add(key.target);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xa5c8ff, 0.68);
    rim.position.set(2800, 2200, 1200);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0xfff6ea, 0.48);
    fill.position.set(600, 1400, 3400);
    scene.add(fill);

    const modHolder = new THREE.Group();
    scene.add(modHolder);

    const cam = new THREE.PerspectiveCamera(28, THUMB_W / THUMB_H, 50, 20000);

    sharedRenderer = renderer;
    sharedScene = scene;
    sharedCamera = cam;
    sharedModHolder = modHolder;
    sharedKeyLight = key;
    sharedEdgeMat = new THREE.LineBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.34,
    });
    return true;
  } catch {
    webglUnavailable = true;
    return false;
  }
}

function disposeGroupGeometries(grp: THREE.Object3D) {
  disposeObject3DTree(grp);
}

function renderTemplateThumbnailSync(template: V4ModuleTemplateDefinition): string | null {
  const cached = thumbnailDataUrlCache.get(template.templateId);
  if (cached) return cached;
  if (!getOrInitStudioThumbStage() || !sharedRenderer || !sharedScene || !sharedCamera || !sharedModHolder || !sharedEdgeMat) {
    return null;
  }

  try {
    const inst = template.createInstance(`thumb_${template.templateId}`);
    // Elevate wall cabinets slightly above floor for true wall-hung shadow cue; floor cabinets sit at y=0
    const isWallUpper = inst.category === "kitchen_wall" || inst.moduleFamilyId === "fam_kitchen_wall";
    inst.position = { x: 0, y: isWallUpper ? 420 : 0, z: 0 };
    inst.rotation = { x: 0, y: 0, z: 0 };

    const geom = generateModuleGeometry(inst);
    const matMap = new Map<string, MaterialDefinition>(
      DEFAULT_MATERIALS.map((m) => [m.id, m])
    );

    disposeGroupGeometries(sharedModHolder);
    sharedModHolder.clear();

    const w = Math.max(300, inst.dimensions.width);
    const h = Math.max(300, inst.dimensions.height);
    const d = Math.max(200, inst.dimensions.depth);

    const innerGrp = new THREE.Group();
    innerGrp.position.set(-w * 0.5, inst.position.y, 0);

    for (const comp of geom.components) {
      const roleStr = comp.role as string;
      if (
        roleStr === "hinge_cup" ||
        roleStr === "drawer_slide" ||
        roleStr === "shelf_pin" ||
        roleStr === "cam_lock" ||
        roleStr === "dowel"
      ) {
        continue;
      }
      const matDef =
        matMap.get(comp.materialId) ||
        matMap.get(inst.carcass.doorMaterialId) ||
        DEFAULT_MATERIALS[0];
      const isMetal =
        comp.role === "door_handle" ||
        comp.role === "hanging_rail" ||
        comp.role === "gola_profile" ||
        matDef.category === "metal";
      const isDoorLike =
        comp.role === "door_left" ||
        comp.role === "door_right" ||
        comp.role === "door_sliding" ||
        comp.role === "drawer_front";
      const isDarkAccent =
        comp.role === "carcass_back" ||
        comp.role === "carcass_divider" ||
        comp.role === "sub_divider";
      const isOuterCarcass =
        comp.role === "carcass_side_left" ||
        comp.role === "carcass_side_right" ||
        comp.role === "carcass_top" ||
        comp.role === "carcass_bottom" ||
        comp.role === "plinth";
      const pbrMat = isMetal
        ? THUMB_SHARED_MATS.metal
        : isDoorLike
        ? THUMB_SHARED_MATS.door
        : isDarkAccent
        ? THUMB_SHARED_MATS.darkAccent
        : isOuterCarcass
        ? THUMB_SHARED_MATS.outerCarcass
        : THUMB_SHARED_MATS.innerCarcass;
      const meshGrp = createComponentMesh(comp, pbrMat, sharedEdgeMat, {
        role: comp.role,
      });
      meshGrp.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      innerGrp.add(meshGrp);
    }

    sharedModHolder.add(innerGrp);

    // Frame camera using true 3D bounding box at 3/4 architectural showroom angle with clean studio margin
    const bounds = new THREE.Box3().setFromObject(innerGrp);
    const bSize = new THREE.Vector3();
    const bCenter = new THREE.Vector3();
    bounds.getSize(bSize);
    bounds.getCenter(bCenter);

    const effW = Math.max(w, bSize.x || w);
    const effH = Math.max(h, bSize.y || h);
    const effD = Math.max(d, bSize.z || d);
    const targetX = Number.isFinite(bCenter.x) ? bCenter.x : 0;
    const targetY = Number.isFinite(bCenter.y) ? bCenter.y : inst.position.y + effH * 0.5;
    const targetZ = Number.isFinite(bCenter.z) ? bCenter.z : effD * 0.45;

    const tanHalfV = Math.tan(THREE.MathUtils.degToRad(sharedCamera.fov) / 2);
    const tanHalfH = tanHalfV * (THUMB_W / THUMB_H);
    const distV = (effH * 0.54) / (tanHalfV * 0.72);
    const distH = (effW * 0.56 + effD * 0.34) / (tanHalfH * 0.74);
    const dist = Math.max(1060, distV, distH) + effD * 0.62;

    sharedCamera.position.set(
      targetX - dist * 0.24,
      targetY + Math.min(240, effH * 0.07),
      targetZ + dist * 0.97
    );
    sharedCamera.lookAt(targetX, targetY, targetZ);
    sharedCamera.updateProjectionMatrix();

    if (sharedKeyLight) {
      sharedKeyLight.target.position.set(targetX, targetY, targetZ);
      sharedKeyLight.target.updateMatrixWorld();
    }

    sharedRenderer.shadowMap.needsUpdate = true;
    sharedRenderer.render(sharedScene, sharedCamera);
    const dataUrl = sharedRenderer.domElement.toDataURL("image/webp", 0.9);
    if (dataUrl && dataUrl.length > 200) {
      thumbnailDataUrlCache.set(template.templateId, dataUrl);
      return dataUrl;
    }
    return null;
  } catch {
    return null;
  }
}

function scheduleDrainQueue() {
  if (isDrainingQueue || pendingQueue.length === 0) return;
  isDrainingQueue = true;
  const step = () => {
    const item = pendingQueue.shift();
    if (item) {
      const url = renderTemplateThumbnailSync(item.template);
      item.resolve(url);
    }
    if (pendingQueue.length > 0) {
      window.requestAnimationFrame(step);
    } else {
      isDrainingQueue = false;
      scheduleStudioThumbIdleRelease();
    }
  };
  window.requestAnimationFrame(step);
}

function enqueueTemplateThumbnail(template: V4ModuleTemplateDefinition): Promise<string | null> {
  const cached = thumbnailDataUrlCache.get(template.templateId);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve) => {
    pendingQueue.push({ template, resolve });
    scheduleDrainQueue();
  });
}

export interface V3StudioModuleThumbnailProps {
  template: V4ModuleTemplateDefinition;
  isWallUpper?: boolean;
}

export const V3StudioModuleThumbnail: React.FC<V3StudioModuleThumbnailProps> = React.memo(
  ({ template, isWallUpper = false }) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const [imgUrl, setImgUrl] = useState<string | null>(
      () => thumbnailDataUrlCache.get(template.templateId) || null
    );

    useEffect(() => {
      if (imgUrl) return;
      const el = hostRef.current;
      if (!el || typeof IntersectionObserver === "undefined") {
        let active = true;
        enqueueTemplateThumbnail(template)
          .then((url) => {
            if (active && url) setImgUrl(url);
          })
          .catch(() => {
            // Fallback isometric icon remains rendered
          });
        return () => {
          active = false;
        };
      }
      let active = true;
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            obs.disconnect();
            enqueueTemplateThumbnail(template)
              .then((url) => {
                if (active && url) setImgUrl(url);
              })
              .catch(() => {
                // Fallback isometric icon remains rendered
              });
          }
        },
        { rootMargin: "160px" }
      );
      obs.observe(el);
      return () => {
        active = false;
        obs.disconnect();
      };
    }, [template, imgUrl]);

    return (
      <div
        ref={hostRef}
        style={{
          background:
            "linear-gradient(180deg, #888d96 0%, #7c818a 68%, #676c75 100%)",
        }}
        className="relative w-full h-[160px] rounded-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-14px_24px_rgba(0,0,0,0.45)] flex items-center justify-center mb-2 overflow-hidden pointer-events-none"
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={template.name}
            draggable={false}
            className="w-full h-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.05]"
          />
        ) : (
          <div className="transition-transform duration-300 ease-out group-hover:scale-[1.05] drop-shadow-[0_12px_14px_rgba(0,0,0,0.68)]">
            <V3IsometricModuleIcon template={template} size="lg" />
          </div>
        )}

        {/* Subtle showroom vignette & bottom mini finish swatches */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black/20 to-transparent"
        />

        {isWallUpper && (
          <span className="absolute left-2 bottom-1.5 text-[8.5px] font-mono font-bold text-violet-200/95 bg-black/45 px-1.5 py-0.5 rounded backdrop-blur-sm">
            Y: 145 cm
          </span>
        )}

      </div>
    );
  }
);

V3StudioModuleThumbnail.displayName = "V3StudioModuleThumbnail";
