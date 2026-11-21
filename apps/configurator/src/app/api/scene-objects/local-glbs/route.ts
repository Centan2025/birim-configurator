import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { SceneObjectCatalogItem } from "@birim/catalog";

export const dynamic = "force-dynamic";

function resolveSceneObjectsDir(): string | null {
  const candidates = [
    path.join(process.cwd(), "public", "models", "scene-objects"),
    path.join(process.cwd(), "apps", "configurator", "public", "models", "scene-objects"),
  ];
  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        return dir;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function readGlbDimensionsMm(filePath: string): { width: number; height: number; depth: number } {
  try {
    const fd = fs.openSync(filePath, "r");
    try {
      const header = Buffer.alloc(20);
      const readHeader = fs.readSync(fd, header, 0, 20, 0);
      if (readHeader < 20) return { width: 500, height: 800, depth: 500 };
      const magic = header.readUInt32LE(0);
      const jsonLen = header.readUInt32LE(12);
      const jsonType = header.readUInt32LE(16);
      if (magic !== 0x46546c67 || jsonType !== 0x4e4f534a || jsonLen <= 0 || jsonLen > 5_000_000) {
        return { width: 500, height: 800, depth: 500 };
      }
      const jsonBuf = Buffer.alloc(jsonLen);
      fs.readSync(fd, jsonBuf, 0, jsonLen, 20);
      const gltf = JSON.parse(jsonBuf.toString("utf8")) as {
        meshes?: Array<{ primitives?: Array<{ attributes?: { POSITION?: number } }> }>;
        accessors?: Array<{ min?: number[]; max?: number[] }>;
      };

      let minX = Infinity;
      let minY = Infinity;
      let minZ = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let maxZ = -Infinity;

      const accessors = gltf.accessors || [];
      for (const mesh of gltf.meshes || []) {
        for (const prim of mesh.primitives || []) {
          const posIdx = prim.attributes?.POSITION;
          if (typeof posIdx === "number" && accessors[posIdx]) {
            const mn = accessors[posIdx].min;
            const mx = accessors[posIdx].max;
            if (Array.isArray(mn) && Array.isArray(mx) && mn.length >= 3 && mx.length >= 3) {
              minX = Math.min(minX, mn[0]);
              minY = Math.min(minY, mn[1]);
              minZ = Math.min(minZ, mn[2]);
              maxX = Math.max(maxX, mx[0]);
              maxY = Math.max(maxY, mx[1]);
              maxZ = Math.max(maxZ, mx[2]);
            }
          }
        }
      }

      if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
        return { width: 500, height: 800, depth: 500 };
      }
      let sx = Math.max(0.01, maxX - minX);
      let sy = Math.max(0.01, maxY - minY);
      let sz = Math.max(0.01, maxZ - minZ);
      // Standard glTF 2.0 files store meters (1.0 = 1000mm); convert to millimeters if <= 25 units
      if (Math.max(sx, sy, sz) <= 25) {
        sx *= 1000;
        sy *= 1000;
        sz *= 1000;
      }
      return {
        width: Math.max(40, Math.round(sx)),
        height: Math.max(20, Math.round(sy)),
        depth: Math.max(40, Math.round(sz)),
      };
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return { width: 500, height: 800, depth: 500 };
  }
}

function humanizeGlbFilename(stem: string): string {
  const clean = stem
    .replace(/^obj_(plant|decor|arch|birim)_/i, "")
    .replace(/^obj_/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!clean) return stem;
  return clean
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function GET() {
  const dir = resolveSceneObjectsDir();
  if (!dir) {
    return NextResponse.json({ items: [] as SceneObjectCatalogItem[] });
  }

  let files: string[] = [];
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".glb"))
      .sort();
  } catch {
    return NextResponse.json({ items: [] as SceneObjectCatalogItem[] });
  }

  const items: SceneObjectCatalogItem[] = files.map((fileName) => {
    const stem = fileName.replace(/\.glb$/i, "");
    const dims = readGlbDimensionsMm(path.join(dir, fileName));
    const lower = stem.toLowerCase();
    const isPlant =
      lower.includes("plant") ||
      lower.includes("olive") ||
      lower.includes("bitki") ||
      lower.includes("saksi") ||
      lower.includes("agac") ||
      lower.includes("monstera") ||
      lower.includes("ficus") ||
      lower.includes("pothos") ||
      lower.includes("herb");
    const isCountertopSmall = isPlant && dims.height <= 600;

    return {
      catalogId: stem,
      sku: `GLB-${stem.slice(0, 14).toUpperCase()}`,
      name: humanizeGlbFilename(stem),
      brand: isPlant ? "Birim Botanik" : "Yerel 3B Model",
      category: "custom_glb",
      anchorMode: isCountertopSmall ? "surface_raycast" : "free_floor",
      visualKind: isPlant ? "plant_olive_tree" : "custom_glb_mesh",
      defaultDimensions: dims,
      primaryColorHex: isPlant ? "#4A6B46" : "#94A3B8",
      secondaryColorHex: "#DFD9CE",
      metalness: 0.04,
      roughness: 0.78,
      glbUrl: `/models/scene-objects/${fileName}`,
      commercialRole: "decor_only",
      unitPriceEur: 0,
      defaultElevationY: isCountertopSmall ? 900 : 0,
      description: `public/models/scene-objects/${fileName} klasöründen otomatik algılanan 3B .GLB modeli.`,
    };
  });

  return NextResponse.json({ items });
}
