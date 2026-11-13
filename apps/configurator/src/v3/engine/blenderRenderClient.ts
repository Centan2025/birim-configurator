import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

export interface BlenderEngineStatus {
  available: boolean;
  path: string | null;
  version: string | null;
}

export interface BlenderRenderParams {
  roots: THREE.Object3D[];
  cameraPosition: THREE.Vector3;
  cameraTarget: THREE.Vector3;
  cameraFov: number;
  width: number;
  height: number;
  samples: number;
  bounces: number;
  isDark: boolean;
  onProgress?: (pct: number) => void;
  shouldCancel?: () => boolean;
}

export interface BlenderRenderResult {
  dataUrl: string;
  elapsedMs: number;
  device: string;
  engine: string;
}

export async function checkBlenderRenderStatus(): Promise<BlenderEngineStatus> {
  try {
    const res = await fetch("/api/render/blender", { cache: "no-store" });
    if (!res.ok) return { available: false, path: null, version: null };
    return (await res.json()) as BlenderEngineStatus;
  } catch {
    return { available: false, path: null, version: null };
  }
}

export async function renderSceneWithBlenderCycles(
  params: BlenderRenderParams
): Promise<BlenderRenderResult> {
  const t0 = performance.now();
  const {
    roots,
    cameraPosition,
    cameraTarget,
    cameraFov,
    width,
    height,
    samples,
    bounces,
    isDark,
    onProgress,
    shouldCancel,
  } = params;

  onProgress?.(6);

  // Temporarily hide non-mesh CAD overlays (LineSegments, Line, Points) during GLB export
  const hiddenLines: Array<{ obj: THREE.Object3D; prevVis: boolean }> = [];
  for (const root of roots) {
    root.traverse((obj) => {
      const maybeLine = obj as THREE.Object3D & { isLine?: boolean; isLineSegments?: boolean; isPoints?: boolean };
      if ((maybeLine.isLine || maybeLine.isLineSegments || maybeLine.isPoints) && obj.visible) {
        hiddenLines.push({ obj, prevVis: obj.visible });
        obj.visible = false;
      }
    });
  }

  let glbBuffer: ArrayBuffer;
  try {
    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(roots, {
      binary: true,
      onlyVisible: true,
    });
    if (!(result instanceof ArrayBuffer)) {
      throw new Error("GLB ikili ciktisi olusturulamadi.");
    }
    glbBuffer = result;
  } finally {
    for (const item of hiddenLines) {
      item.obj.visible = item.prevVis;
    }
  }

  if (shouldCancel?.()) {
    throw new Error("Render iptal edildi.");
  }

  onProgress?.(22);

  const formData = new FormData();
  formData.append("glb", new Blob([glbBuffer], { type: "model/gltf-binary" }), "scene.glb");
  formData.append(
    "meta",
    JSON.stringify({
      width,
      height,
      samples,
      bounces,
      isDark,
      camera: {
        position: [cameraPosition.x, cameraPosition.y, cameraPosition.z],
        target: [cameraTarget.x, cameraTarget.y, cameraTarget.z],
        fov: cameraFov,
      },
    })
  );

  const controller = new AbortController();
  const cancelTimer = setInterval(() => {
    if (shouldCancel?.()) {
      controller.abort();
    }
  }, 150);

  let fakePct = 24;
  const progressTimer = setInterval(() => {
    fakePct = Math.min(92, fakePct + (fakePct < 65 ? 5 : 2));
    onProgress?.(fakePct);
  }, 350);

  try {
    const response = await fetch("/api/render/blender", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    const payload = (await response.json()) as {
      dataUrl?: string;
      elapsedMs?: number;
      device?: string;
      engine?: string;
      error?: string;
    };

    if (!response.ok || !payload.dataUrl) {
      throw new Error(payload.error || `Blender render basarisiz (HTTP ${response.status})`);
    }

    onProgress?.(100);
    return {
      dataUrl: payload.dataUrl,
      elapsedMs: payload.elapsedMs ?? Math.round(performance.now() - t0),
      device: payload.device ?? "CPU",
      engine: payload.engine ?? "Blender Cycles (OIDN)",
    };
  } finally {
    clearInterval(cancelTimer);
    clearInterval(progressTimer);
  }
}
