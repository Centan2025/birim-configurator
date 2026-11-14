import * as THREE from "three";

const SHARED_RESOURCE_FLAG = "__birimSharedResource";

export function markSharedGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
  geometry.userData = { ...geometry.userData, [SHARED_RESOURCE_FLAG]: true };
  return geometry;
}

export function markSharedMaterial<T extends THREE.Material>(material: T): T {
  material.userData = { ...material.userData, [SHARED_RESOURCE_FLAG]: true };
  return material;
}

export function markSharedTexture<T extends THREE.Texture>(texture: T): T {
  texture.userData = { ...texture.userData, [SHARED_RESOURCE_FLAG]: true };
  return texture;
}

export function isSharedWebGLResource(
  resource: { userData?: Record<string, unknown> } | null | undefined
): boolean {
  return Boolean(resource?.userData?.[SHARED_RESOURCE_FLAG]);
}

function disposeMaterialSafely(mat: THREE.Material | null | undefined): void {
  if (!mat || isSharedWebGLResource(mat)) return;
  const record = mat as unknown as Record<string, unknown>;
  const textureKeys = [
    "map",
    "bumpMap",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "aoMap",
    "alphaMap",
    "emissiveMap",
  ];
  for (const key of textureKeys) {
    const candidate = record[key];
    if (candidate instanceof THREE.Texture && !isSharedWebGLResource(candidate)) {
      candidate.dispose();
    }
  }
  mat.dispose();
}

/**
 * Traverses an Object3D subtree, disposes all non-shared BufferGeometries, EdgesGeometries,
 * Materials, and owned Textures from GPU VRAM, and clears the container's children.
 */
export function disposeObject3DTree(root: THREE.Object3D | null | undefined): void {
  if (!root) return;
  const geometriesToDispose = new Set<THREE.BufferGeometry>();
  const materialsToDispose = new Set<THREE.Material>();

  root.traverse((obj) => {
    if (
      obj instanceof THREE.Mesh ||
      obj instanceof THREE.Line ||
      obj instanceof THREE.LineSegments ||
      obj instanceof THREE.Points
    ) {
      if (obj.geometry && !isSharedWebGLResource(obj.geometry)) {
        geometriesToDispose.add(obj.geometry);
      }
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => {
          if (m && !isSharedWebGLResource(m)) materialsToDispose.add(m);
        });
      } else if (obj.material && !isSharedWebGLResource(obj.material)) {
        materialsToDispose.add(obj.material);
      }
    }
  });

  geometriesToDispose.forEach((geo) => geo.dispose());
  materialsToDispose.forEach((mat) => disposeMaterialSafely(mat));
  root.clear();
}

/**
 * Attaches WebGL context-loss & restoration handlers so GPU driver resets or background tab
 * eviction recover gracefully instead of leaving a dead white canvas.
 */
export function attachWebGLContextRecovery(
  canvas: HTMLCanvasElement,
  callbacks: {
    onContextLost?: () => void;
    onContextRestored?: () => void;
  }
): () => void {
  const handleLost = (event: Event) => {
    event.preventDefault();
    callbacks.onContextLost?.();
  };
  const handleRestored = () => {
    callbacks.onContextRestored?.();
  };

  canvas.addEventListener("webglcontextlost", handleLost, false);
  canvas.addEventListener("webglcontextrestored", handleRestored, false);

  return () => {
    canvas.removeEventListener("webglcontextlost", handleLost, false);
    canvas.removeEventListener("webglcontextrestored", handleRestored, false);
  };
}

export interface WebGL2CapabilityReport {
  supported: boolean;
  tier: "high_performance" | "compatibility" | "low_power_software" | "unavailable";
  winningAttributes: WebGLContextAttributes | null;
  gpuRendererInfo: string;
  isLegacyOrLowSpecGpu: boolean;
  failureReason?: string;
}

let cachedCapabilityReport: WebGL2CapabilityReport | null = null;

const LEGACY_GPU_REGEX =
  /GeForce\s*210|GeForce\s*[89]\d00|GeForce\s*GT\s*[123]\d0|Direct3D9|vs_3_0|ps_3_0|SwiftShader|Basic Render Driver|llvmpipe|Software|GDI Generic|Intel\(R\)\s*HD Graphics\s*(2000|3000)?\b/i;

function readUnmaskedGpuString(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  try {
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (dbg) {
      const unmasked = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      if (typeof unmasked === "string" && unmasked.trim()) return unmasked.trim();
    }
    const stdRenderer = gl.getParameter(gl.RENDERER);
    if (typeof stdRenderer === "string" && stdRenderer.trim()) return stdRenderer.trim();
  } catch {
    // Ignore restricted parameter reads
  }
  return "Bilinmeyen Ekran Kartı";
}

function releaseProbeContext(gl: WebGLRenderingContext | WebGL2RenderingContext | null): void {
  if (!gl) return;
  try {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    // Ignore
  }
}

/**
 * Probes ONLY `webgl2` (required by Three.js r163+ / 0.173.0) on fresh isolated `<canvas>` elements
 * so a WebGL1 probe NEVER poisons the target `<canvas>` and Three.js NEVER throws
 * `Uncaught Error: Error creating WebGL context` on Direct3D9Ex / NVIDIA GeForce 210 terminals!
 */
export function probeWebGL2Support(forceRefresh = false): WebGL2CapabilityReport {
  if (typeof document === "undefined") {
    return {
      supported: false,
      tier: "unavailable",
      winningAttributes: null,
      gpuRendererInfo: "SSR",
      isLegacyOrLowSpecGpu: false,
      failureReason: "Sunucu tarafı ön-render (SSR).",
    };
  }

  if (cachedCapabilityReport && !forceRefresh) {
    return cachedCapabilityReport;
  }

  const candidateTiers: {
    tier: WebGL2CapabilityReport["tier"];
    attrs: WebGLContextAttributes;
  }[] = [
    {
      tier: "high_performance",
      attrs: {
        antialias: true,
        alpha: false,
        depth: true,
        stencil: false,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
      },
    },
    {
      tier: "compatibility",
      attrs: {
        antialias: false,
        alpha: false,
        depth: true,
        stencil: false,
        powerPreference: "default",
        failIfMajorPerformanceCaveat: false,
      },
    },
    {
      tier: "low_power_software",
      attrs: {
        antialias: false,
        alpha: false,
        depth: true,
        stencil: false,
        powerPreference: "low-power",
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false,
      },
    },
  ];

  for (const cand of candidateTiers) {
    // Always use a brand-new canvas per attempt so failed attributes never taint the next attempt
    const testCanvas = document.createElement("canvas");
    testCanvas.width = 4;
    testCanvas.height = 4;
    let gl2: WebGL2RenderingContext | null = null;
    try {
      gl2 = testCanvas.getContext("webgl2", cand.attrs) as WebGL2RenderingContext | null;
    } catch {
      gl2 = null;
    }

    if (gl2) {
      const gpuInfo = readUnmaskedGpuString(gl2);
      const isLegacy = cand.tier !== "high_performance" || LEGACY_GPU_REGEX.test(gpuInfo);
      releaseProbeContext(gl2);
      cachedCapabilityReport = {
        supported: true,
        tier: cand.tier,
        winningAttributes: cand.attrs,
        gpuRendererInfo: gpuInfo,
        isLegacyOrLowSpecGpu: isLegacy,
      };
      return cachedCapabilityReport;
    }
  }

  // WebGL2 failed across all 3 tiers (e.g., NVIDIA GeForce 210 Direct3D9Ex vs_3_0 ps_3_0!).
  // Inspect WebGL1 on a disposable diagnostic canvas ONLY to display the exact GPU hardware reason.
  let legacyGpuName = "WebGL2 Desteklemeyen Eski Ekran Kartı (Direct3D9Ex / WDDM 1.1)";
  try {
    const diagCanvas = document.createElement("canvas");
    const gl1 =
      (diagCanvas.getContext("webgl", { failIfMajorPerformanceCaveat: false }) as WebGLRenderingContext | null) ||
      (diagCanvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (gl1) {
      legacyGpuName = readUnmaskedGpuString(gl1);
      releaseProbeContext(gl1);
    }
  } catch {
    // Ignore
  }

  cachedCapabilityReport = {
    supported: false,
    tier: "unavailable",
    winningAttributes: null,
    gpuRendererInfo: legacyGpuName,
    isLegacyOrLowSpecGpu: true,
    failureReason:
      legacyGpuName.includes("Direct3D9") || legacyGpuName.includes("GeForce 210")
        ? `Donanım (${legacyGpuName}) yalnızca Direct3D9Ex / Shader Model 3.0 desteklediği için WebGL2 oluşturulamıyor.`
        : `Bu terminalde WebGL2 grafik bağlamı açılamadı (${legacyGpuName}).`,
  };
  return cachedCapabilityReport;
}

export interface SafeWebGL2RendererBundle {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  capability: WebGL2CapabilityReport;
}

/**
 * Safely instantiates `THREE.WebGLRenderer` by pre-acquiring a verified `WebGL2RenderingContext`
 * on a clean `<canvas>` and passing `{ canvas, context }` directly to Three.js.
 * Returns `null` cleanly (ZERO uncaught exceptions, ZERO Three.js red console spam) when WebGL2 is absent!
 */
export function createSafeWebGL2Renderer(options?: {
  forceRefreshProbe?: boolean;
  preferAlpha?: boolean;
}): { ok: true; bundle: SafeWebGL2RendererBundle } | { ok: false; capability: WebGL2CapabilityReport } {
  const cap = probeWebGL2Support(Boolean(options?.forceRefreshProbe));
  if (!cap.supported || !cap.winningAttributes || typeof document === "undefined") {
    return { ok: false, capability: cap };
  }

  const attrs: WebGLContextAttributes = {
    ...cap.winningAttributes,
    alpha: options?.preferAlpha ?? false,
    // Disable MSAA on legacy/integrated GPUs to avoid ANGLE BindToCurrentSequence / D3D surface allocation errors
    antialias: cap.isLegacyOrLowSpecGpu ? false : Boolean(cap.winningAttributes.antialias),
  };

  const canvas = document.createElement("canvas");
  let gl2: WebGL2RenderingContext | null = null;
  try {
    gl2 = canvas.getContext("webgl2", attrs) as WebGL2RenderingContext | null;
    if (!gl2 && attrs.antialias) {
      attrs.antialias = false;
      gl2 = canvas.getContext("webgl2", attrs) as WebGL2RenderingContext | null;
    }
  } catch {
    gl2 = null;
  }

  if (!gl2) {
    return {
      ok: false,
      capability: {
        ...cap,
        supported: false,
        tier: "unavailable",
        failureReason: "WebGL2 grafik yüzeyi (BindToCurrentSequence) ayrılamadı.",
      },
    };
  }

  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl2,
      antialias: Boolean(attrs.antialias),
      alpha: Boolean(attrs.alpha),
      powerPreference: attrs.powerPreference ?? "default",
    });
    return {
      ok: true,
      bundle: {
        renderer,
        canvas,
        capability: cap,
      },
    };
  } catch (err) {
    releaseProbeContext(gl2);
    return {
      ok: false,
      capability: {
        ...cap,
        supported: false,
        tier: "unavailable",
        failureReason:
          err instanceof Error ? err.message : "THREE.WebGLRenderer başlatılamadı.",
      },
    };
  }
}

/**
 * Deterministically disposes a `THREE.WebGLRenderer` and releases its underlying GPU context slot
 * so React 19 StrictMode / route transitions never exhaust browser WebGL context limits (max 8–16).
 */
export function disposeWebGLRendererCleanly(renderer: THREE.WebGLRenderer | null | undefined): void {
  if (!renderer) return;
  try {
    renderer.dispose();
  } catch {
    // Ignore dispose errors on already-lost contexts
  }
  try {
    const gl = renderer.getContext();
    if (gl && !gl.isContextLost()) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    // Ignore
  }
}
