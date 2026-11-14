export interface ExportMaterialSpec {
  id: string;
  name: string;
  colorHex: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
}

export interface ExportBoxPart {
  id: string;
  name: string;
  role: string;
  moduleId: string;
  moduleName: string;
  materialId: string;
  /** World or module-transformed box center in millimeters */
  positionMm: { x: number; y: number; z: number };
  /** Box extents in millimeters */
  dimensionsMm: { width: number; height: number; depth: number };
  /** Y-axis rotation in degrees */
  rotationYDeg?: number;
}

function hexToLinearRgba(hex: string, opacity = 1): [number, number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "d").slice(0, 6);
  const srgb = [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return [
    Number(toLinear(srgb[0]).toFixed(4)),
    Number(toLinear(srgb[1]).toFixed(4)),
    Number(toLinear(srgb[2]).toFixed(4)),
    Number(opacity.toFixed(4)),
  ];
}

interface IndexedBoxGeometry {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * Generates a 24-vertex, 36-index box mesh centered at (0,0,0) scaled by `unitScale` (0.001 for meters, 1.0 for mm).
 */
function buildIndexedBox(
  widthMm: number,
  heightMm: number,
  depthMm: number,
  unitScale: number
): IndexedBoxGeometry {
  const hx = (Math.max(1, widthMm) * unitScale) / 2;
  const hy = (Math.max(1, heightMm) * unitScale) / 2;
  const hz = (Math.max(1, depthMm) * unitScale) / 2;

  // 6 faces * 4 vertices = 24 vertices (CCW winding outward)
  const pos = [
    // +Z Front
    -hx, -hy,  hz,   hx, -hy,  hz,   hx,  hy,  hz,  -hx,  hy,  hz,
    // -Z Back
     hx, -hy, -hz,  -hx, -hy, -hz,  -hx,  hy, -hz,   hx,  hy, -hz,
    // +Y Top
    -hx,  hy,  hz,   hx,  hy,  hz,   hx,  hy, -hz,  -hx,  hy, -hz,
    // -Y Bottom
    -hx, -hy, -hz,   hx, -hy, -hz,   hx, -hy,  hz,  -hx, -hy,  hz,
    // +X Right
     hx, -hy,  hz,   hx, -hy, -hz,   hx,  hy, -hz,   hx,  hy,  hz,
    // -X Left
    -hx, -hy, -hz,  -hx, -hy,  hz,  -hx,  hy,  hz,  -hx,  hy, -hz,
  ];

  const norm = [
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0,-1,  0, 0,-1,  0, 0,-1,  0, 0,-1,
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    0,-1, 0,  0,-1, 0,  0,-1, 0,  0,-1, 0,
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
   -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ];

  const uv: number[] = [];
  const idx: number[] = [];
  for (let f = 0; f < 6; f++) {
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    const base = f * 4;
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(norm),
    uvs: new Float32Array(uv),
    indices: new Uint16Array(idx),
    min: [-hx, -hy, -hz],
    max: [hx, hy, hz],
  };
}

/**
 * Exports parametric furniture parts into a standards-compliant Binary glTF 2.0 (.glb) buffer.
 * Uses 1.0 unit = 1.0 meter as required by glTF 2.0, Android Scene Viewer AR, Blender, Rhino, and D5 Render.
 */
export function exportPartsToGLB(
  parts: ExportBoxPart[],
  materials: ExportMaterialSpec[],
  projectTitle = "Birim_Mobilya_Model"
): Uint8Array {
  const unitScale = 0.001; // glTF 2.0 standard: meters
  const matMap = new Map<string, number>();
  const gltfMaterials: Array<Record<string, unknown>> = [];

  const ensureMaterialIndex = (matId: string): number => {
    const existing = matMap.get(matId);
    if (existing !== undefined) return existing;
    const spec = materials.find((m) => m.id === matId) || {
      id: matId,
      name: matId,
      colorHex: "#E5E0D8",
      roughness: 0.65,
      metalness: 0.04,
    };
    const isGlass =
      spec.id.includes("glass") || (spec.opacity !== undefined && spec.opacity < 0.98);
    const rgba = hexToLinearRgba(spec.colorHex, isGlass ? spec.opacity ?? 0.42 : 1);
    const idx = gltfMaterials.length;
    gltfMaterials.push({
      name: spec.name,
      doubleSided: true,
      alphaMode: isGlass ? "BLEND" : "OPAQUE",
      pbrMetallicRoughness: {
        baseColorFactor: rgba,
        metallicFactor: spec.metalness ?? 0.04,
        roughnessFactor: spec.roughness ?? 0.62,
      },
    });
    matMap.set(matId, idx);
    return idx;
  };

  const binChunks: Uint8Array[] = [];
  let byteOffset = 0;
  const bufferViews: Array<Record<string, unknown>> = [];
  const accessors: Array<Record<string, unknown>> = [];
  const meshes: Array<Record<string, unknown>> = [];
  const nodes: Array<Record<string, unknown>> = [];
  const rootChildren: number[] = [];

  const pushAlignedBuffer = (rawBytes: Uint8Array, target?: number): number => {
    const padLen = (4 - (rawBytes.byteLength % 4)) % 4;
    const padded =
      padLen === 0 ? rawBytes : new Uint8Array(rawBytes.byteLength + padLen);
    if (padLen > 0) padded.set(rawBytes, 0);
    const viewIdx = bufferViews.length;
    const bv: Record<string, unknown> = {
      buffer: 0,
      byteOffset,
      byteLength: rawBytes.byteLength,
    };
    if (target) bv.target = target;
    bufferViews.push(bv);
    binChunks.push(padded);
    byteOffset += padded.byteLength;
    return viewIdx;
  };

  for (const part of parts) {
    const geo = buildIndexedBox(
      part.dimensionsMm.width,
      part.dimensionsMm.height,
      part.dimensionsMm.depth,
      unitScale
    );
    const posView = pushAlignedBuffer(
      new Uint8Array(geo.positions.buffer, geo.positions.byteOffset, geo.positions.byteLength),
      34962
    );
    const normView = pushAlignedBuffer(
      new Uint8Array(geo.normals.buffer, geo.normals.byteOffset, geo.normals.byteLength),
      34962
    );
    const uvView = pushAlignedBuffer(
      new Uint8Array(geo.uvs.buffer, geo.uvs.byteOffset, geo.uvs.byteLength),
      34962
    );
    const idxView = pushAlignedBuffer(
      new Uint8Array(geo.indices.buffer, geo.indices.byteOffset, geo.indices.byteLength),
      34963
    );

    const posAcc = accessors.length;
    accessors.push({
      bufferView: posView,
      componentType: 5126,
      count: 24,
      type: "VEC3",
      min: geo.min,
      max: geo.max,
    });
    const normAcc = accessors.length;
    accessors.push({
      bufferView: normView,
      componentType: 5126,
      count: 24,
      type: "VEC3",
    });
    const uvAcc = accessors.length;
    accessors.push({
      bufferView: uvView,
      componentType: 5126,
      count: 24,
      type: "VEC2",
    });
    const idxAcc = accessors.length;
    accessors.push({
      bufferView: idxView,
      componentType: 5123,
      count: 36,
      type: "SCALAR",
    });

    const matIdx = ensureMaterialIndex(part.materialId);
    const meshIdx = meshes.length;
    meshes.push({
      name: `${part.moduleName} - ${part.name}`,
      primitives: [
        {
          attributes: {
            POSITION: posAcc,
            NORMAL: normAcc,
            TEXCOORD_0: uvAcc,
          },
          indices: idxAcc,
          material: matIdx,
        },
      ],
    });

    const rotRad = ((part.rotationYDeg || 0) * Math.PI) / 180;
    const half = rotRad / 2;
    const nodeIdx = nodes.length;
    nodes.push({
      name: `${part.moduleName}_${part.name}`.replace(/\s+/g, "_"),
      mesh: meshIdx,
      translation: [
        Number((part.positionMm.x * unitScale).toFixed(5)),
        Number((part.positionMm.y * unitScale).toFixed(5)),
        Number((part.positionMm.z * unitScale).toFixed(5)),
      ],
      rotation: [0, Number(Math.sin(half).toFixed(6)), 0, Number(Math.cos(half).toFixed(6))],
    });
    rootChildren.push(nodeIdx);
  }

  const rootNodeIdx = nodes.length;
  nodes.push({
    name: projectTitle.replace(/\s+/g, "_"),
    children: rootChildren,
  });

  const gltfJson = {
    asset: {
      version: "2.0",
      generator: "Birim Mobilya Parametric CAD/AR Exporter v4.6",
    },
    scene: 0,
    scenes: [{ name: projectTitle, nodes: [rootNodeIdx] }],
    nodes,
    meshes,
    materials: gltfMaterials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: byteOffset }],
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltfJson));
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonChunkLen = jsonBytes.byteLength + jsonPad;

  const totalLength = 12 + 8 + jsonChunkLen + (byteOffset > 0 ? 8 + byteOffset : 0);
  const out = new Uint8Array(totalLength);
  const dv = new DataView(out.buffer);

  // 12-byte GLB header: magic 'glTF' (0x46546C67), version 2, totalLength
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, totalLength, true);

  // JSON chunk header + payload (padded with ASCII space 0x20 per glTF spec)
  dv.setUint32(12, jsonChunkLen, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  for (let p = 0; p < jsonPad; p++) {
    out[20 + jsonBytes.byteLength + p] = 0x20;
  }

  // BIN chunk header + payload
  if (byteOffset > 0) {
    const binHeaderOffset = 20 + jsonChunkLen;
    dv.setUint32(binHeaderOffset, byteOffset, true);
    dv.setUint32(binHeaderOffset + 4, 0x004e4942, true);
    let cursor = binHeaderOffset + 8;
    for (const chunk of binChunks) {
      out.set(chunk, cursor);
      cursor += chunk.byteLength;
    }
  }

  return out;
}

/**
 * Exports parametric parts into Wavefront .OBJ + .MTL (millimeter scale) for SketchUp, 3ds Max, AutoCAD & Rhino.
 */
export function exportPartsToOBJ(
  parts: ExportBoxPart[],
  materials: ExportMaterialSpec[],
  mtlFileName = "birim_materials.mtl"
): { objContent: string; mtlContent: string } {
  const objLines: string[] = [
    "# Birim Mobilya Mimari 3D CAD Model (.OBJ - Birim: mm)",
    `mtllib ${mtlFileName}`,
    "",
  ];
  const usedMatIds = new Set<string>();
  let vertexOffset = 1;

  for (const part of parts) {
    usedMatIds.add(part.materialId);
    const geo = buildIndexedBox(
      part.dimensionsMm.width,
      part.dimensionsMm.height,
      part.dimensionsMm.depth,
      1.0
    );
    const rad = ((part.rotationYDeg || 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const safeGroup = `${part.moduleName}_${part.name}`.replace(/[^a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ-]/g, "_");
    objLines.push(`o ${safeGroup}`);
    objLines.push(`g ${part.role}`);
    objLines.push(`usemtl ${part.materialId}`);

    for (let i = 0; i < geo.positions.length; i += 3) {
      const lx = geo.positions[i];
      const ly = geo.positions[i + 1];
      const lz = geo.positions[i + 2];
      const wx = part.positionMm.x + lx * cos + lz * sin;
      const wy = part.positionMm.y + ly;
      const wz = part.positionMm.z - lx * sin + lz * cos;
      objLines.push(`v ${wx.toFixed(2)} ${wy.toFixed(2)} ${wz.toFixed(2)}`);
    }

    for (let i = 0; i < geo.normals.length; i += 3) {
      const nx = geo.normals[i];
      const ny = geo.normals[i + 1];
      const nz = geo.normals[i + 2];
      const wnx = nx * cos + nz * sin;
      const wnz = -nx * sin + nz * cos;
      objLines.push(`vn ${wnx.toFixed(4)} ${ny.toFixed(4)} ${wnz.toFixed(4)}`);
    }

    for (let i = 0; i < geo.indices.length; i += 3) {
      const i1 = vertexOffset + geo.indices[i];
      const i2 = vertexOffset + geo.indices[i + 1];
      const i3 = vertexOffset + geo.indices[i + 2];
      objLines.push(`f ${i1}//${i1} ${i2}//${i2} ${i3}//${i3}`);
    }
    objLines.push("");
    vertexOffset += 24;
  }

  const mtlLines: string[] = ["# Birim Mobilya PBR Material Library (.MTL)", ""];
  for (const matId of usedMatIds) {
    const spec = materials.find((m) => m.id === matId) || {
      id: matId,
      name: matId,
      colorHex: "#E5E0D8",
      opacity: 1,
    };
    const [r, g, b] = hexToLinearRgba(spec.colorHex, 1);
    const alpha = spec.id.includes("glass") ? 0.45 : spec.opacity ?? 1;
    mtlLines.push(`newmtl ${matId}`);
    mtlLines.push(`Kd ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`);
    mtlLines.push("Ka 0.1000 0.1000 0.1000");
    mtlLines.push("Ks 0.1800 0.1800 0.1800");
    mtlLines.push(`d ${alpha.toFixed(3)}`);
    mtlLines.push("illum 2");
    mtlLines.push("");
  }

  return {
    objContent: objLines.join("\n"),
    mtlContent: mtlLines.join("\n"),
  };
}

/**
 * Exports parametric parts into Universal Scene Description ASCII (.usda) at 1:1 meter scale
 * for Apple AR / USDZ pipelines and Omniverse / Houdini workflows.
 */
export function exportPartsToUSDA(
  parts: ExportBoxPart[],
  materials: ExportMaterialSpec[],
  projectTitle = "Birim_Model"
): string {
  const safeRoot = projectTitle.replace(/[^a-zA-Z0-9_]/g, "_") || "Birim_Model";
  const lines: string[] = [
    '#usda 1.0',
    '(',
    `    defaultPrim = "${safeRoot}"`,
    '    metersPerUnit = 1',
    '    upAxis = "Y"',
    ')',
    '',
    `def Xform "${safeRoot}"`,
    '{',
    '    def Scope "Materials"',
    '    {',
  ];

  const uniqueMats = new Map<string, ExportMaterialSpec>();
  for (const p of parts) {
    if (!uniqueMats.has(p.materialId)) {
      const m = materials.find((x) => x.id === p.materialId) || {
        id: p.materialId,
        name: p.materialId,
        colorHex: "#E5E0D8",
        roughness: 0.6,
        metalness: 0.05,
      };
      uniqueMats.set(p.materialId, m);
    }
  }

  uniqueMats.forEach((m, matId) => {
    const safeMat = matId.replace(/[^a-zA-Z0-9_]/g, "_");
    const [r, g, b] = hexToLinearRgba(m.colorHex, 1);
    const opacity = m.id.includes("glass") ? 0.42 : m.opacity ?? 1;
    lines.push(`        def Material "${safeMat}"`);
    lines.push('        {');
    lines.push(`            token outputs:surface.connect = </${safeRoot}/Materials/${safeMat}/PBRShader.outputs:surface>`);
    lines.push('            def Shader "PBRShader"');
    lines.push('            {');
    lines.push('                uniform token info:id = "UsdPreviewSurface"');
    lines.push(`                color3f inputs:diffuseColor = (${r}, ${g}, ${b})`);
    lines.push(`                float inputs:metallic = ${(m.metalness ?? 0.04).toFixed(3)}`);
    lines.push(`                float inputs:roughness = ${(m.roughness ?? 0.62).toFixed(3)}`);
    lines.push(`                float inputs:opacity = ${opacity.toFixed(3)}`);
    lines.push('                token outputs:surface');
    lines.push('            }');
    lines.push('        }');
  });
  lines.push('    }');

  parts.forEach((p, idx) => {
    const safeName = `Part_${idx + 1}_${p.role.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const safeMat = p.materialId.replace(/[^a-zA-Z0-9_]/g, "_");
    const sx = (p.dimensionsMm.width * 0.001).toFixed(4);
    const sy = (p.dimensionsMm.height * 0.001).toFixed(4);
    const sz = (p.dimensionsMm.depth * 0.001).toFixed(4);
    const tx = (p.positionMm.x * 0.001).toFixed(4);
    const ty = (p.positionMm.y * 0.001).toFixed(4);
    const tz = (p.positionMm.z * 0.001).toFixed(4);
    const ry = (p.rotationYDeg || 0).toFixed(2);

    lines.push(`    def Cube "${safeName}" (`);
    lines.push('        prepend apiSchemas = ["MaterialBindingAPI"]');
    lines.push('    )');
    lines.push('    {');
    lines.push('        double size = 1.0');
    lines.push(`        rel material:binding = </${safeRoot}/Materials/${safeMat}>`);
    lines.push(`        double3 xformOp:translate = (${tx}, ${ty}, ${tz})`);
    lines.push(`        float3 xformOp:rotateXYZ = (0, ${ry}, 0)`);
    lines.push(`        float3 xformOp:scale = (${sx}, ${sy}, ${sz})`);
    lines.push('        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:rotateXYZ", "xformOp:scale"]');
    lines.push('    }');
  });

  lines.push('}');
  return lines.join('\n');
}

/**
 * Converts placed `SceneObjectInstance` items (appliances, sinks, Birim freestanding furniture, props)
 * into `ExportBoxPart` entries so `.GLB`, `.OBJ`, `.USDA`, and `.USDZ` exports contain the complete room!
 */
export function convertSceneObjectsToExportBoxes(
  sceneObjects: import("@birim/core").SceneObjectInstance[] | undefined
): ExportBoxPart[] {
  if (!sceneObjects || sceneObjects.length === 0) return [];
  const out: ExportBoxPart[] = [];
  for (const obj of sceneObjects) {
    if (obj.isHidden) continue;
    const scale = obj.scaleFactor || 1;
    const w = Math.round(obj.dimensions.width * scale);
    const h = Math.round(obj.dimensions.height * scale);
    const d = Math.round(obj.dimensions.depth * scale);
    out.push({
      id: obj.id,
      name: obj.name,
      role: `scene_${obj.category}`,
      moduleId: obj.hostModuleId || "scene_objects",
      moduleName: obj.brand || "Sahne Objesi",
      materialId: `mat_scene_${obj.id}`,
      positionMm: {
        x: obj.position.x + w / 2,
        y: obj.position.y + h / 2,
        z: obj.position.z + d / 2,
      },
      dimensionsMm: { width: w, height: h, depth: d },
      rotationYDeg: obj.rotation?.y || 0,
    });
  }
  return out;
}

function crc32Bytes(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds a compliant, zero-compression 64-byte-aligned Apple AR Quick Look `.USDZ` binary archive
 * directly in memory from parametric cabinets + placed scene objects!
 */
export function exportPartsToUSDZ(
  parts: ExportBoxPart[],
  materials: ExportMaterialSpec[],
  projectTitle = "Birim_Model"
): Uint8Array {
  const usdaText = exportPartsToUSDA(parts, materials, projectTitle);
  const encoder = new TextEncoder();
  const fileBytes = encoder.encode(usdaText);
  const fileNameBytes = encoder.encode("scene.usda");
  const crc = crc32Bytes(fileBytes);

  // USDZ requires uncompressed (method 0) ZIP entries whose data starts at a 64-byte multiple!
  const baseLocalHeaderLen = 30 + fileNameBytes.length;
  const padNeeded = (64 - (baseLocalHeaderLen % 64)) % 64;
  const extraLen = padNeeded === 0 ? 0 : padNeeded < 4 ? padNeeded + 64 : padNeeded;
  const extraField = new Uint8Array(extraLen);
  if (extraLen >= 4) {
    // 0x1986 USDZ alignment extra header tag
    extraField[0] = 0x86;
    extraField[1] = 0x19;
    extraField[2] = (extraLen - 4) & 0xff;
    extraField[3] = ((extraLen - 4) >> 8) & 0xff;
  }

  const localHeaderSize = 30 + fileNameBytes.length + extraLen;
  const centralDirOffset = localHeaderSize + fileBytes.length;
  const centralDirSize = 46 + fileNameBytes.length;
  const totalSize = centralDirOffset + centralDirSize + 22;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const out = new Uint8Array(buf);
  let p = 0;

  // Local file header
  view.setUint32(p, 0x04034b50, true); p += 4;
  view.setUint16(p, 20, true); p += 2; // version needed
  view.setUint16(p, 0, true); p += 2;  // flags
  view.setUint16(p, 0, true); p += 2;  // store (0 = uncompressed, mandatory for USDZ)
  view.setUint16(p, 0, true); p += 2;  // mod time
  view.setUint16(p, 0, true); p += 2;  // mod date
  view.setUint32(p, crc, true); p += 4;
  view.setUint32(p, fileBytes.length, true); p += 4;
  view.setUint32(p, fileBytes.length, true); p += 4;
  view.setUint16(p, fileNameBytes.length, true); p += 2;
  view.setUint16(p, extraLen, true); p += 2;
  out.set(fileNameBytes, p); p += fileNameBytes.length;
  if (extraLen > 0) {
    out.set(extraField, p); p += extraLen;
  }
  out.set(fileBytes, p); p += fileBytes.length;

  // Central directory header
  view.setUint32(p, 0x02014b50, true); p += 4;
  view.setUint16(p, 20, true); p += 2;
  view.setUint16(p, 20, true); p += 2;
  view.setUint16(p, 0, true); p += 2;
  view.setUint16(p, 0, true); p += 2;
  view.setUint16(p, 0, true); p += 2;
  view.setUint16(p, 0, true); p += 2;
  view.setUint32(p, crc, true); p += 4;
  view.setUint32(p, fileBytes.length, true); p += 4;
  view.setUint32(p, fileBytes.length, true); p += 4;
  view.setUint16(p, fileNameBytes.length, true); p += 2;
  view.setUint16(p, 0, true); p += 2;
  view.setUint16(p, 0, true); p += 2;
  view.setUint16(p, 0, true); p += 2;
  view.setUint16(p, 0, true); p += 2;
  view.setUint32(p, 0, true); p += 4;
  view.setUint32(p, 0, true); p += 4; // local header offset = 0
  out.set(fileNameBytes, p); p += fileNameBytes.length;

  // End of central directory
  view.setUint32(p, 0x06054b50, true); p += 4;
  view.setUint16(p, 0, true); p += 2;
  view.setUint16(p, 0, true); p += 2;
  view.setUint16(p, 1, true); p += 2;
  view.setUint16(p, 1, true); p += 2;
  view.setUint32(p, centralDirSize, true); p += 4;
  view.setUint32(p, centralDirOffset, true); p += 4;
  view.setUint16(p, 0, true);

  return out;
}

