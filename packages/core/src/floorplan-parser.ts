import { FloorPlanPolyline, FloorPlanUnderlay, WallDefinition } from "./types";

/**
 * Parses ASCII DXF or text-based DWG content to extract 2D architectural LINE and LWPOLYLINE segments.
 */
export function parseCadDxfText(
  content: string,
  fileName = "plan.dxf",
  scaleMmPerUnit = 1
): FloorPlanUnderlay {
  const lines = content.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim());
  const polylines: FloorPlanPolyline[] = [];

  let i = 0;
  while (i < lines.length) {
    const token = lines[i];
    if (token === "LINE") {
      let x1 = 0,
        y1 = 0,
        x2 = 0,
        y2 = 0,
        layer = "0";
      i++;
      while (i + 1 < lines.length && lines[i] !== "0") {
        const code = lines[i];
        const val = lines[i + 1];
        if (code === "8") layer = val;
        else if (code === "10") x1 = parseFloat(val) || 0;
        else if (code === "20") y1 = parseFloat(val) || 0;
        else if (code === "11") x2 = parseFloat(val) || 0;
        else if (code === "21") y2 = parseFloat(val) || 0;
        i += 2;
      }
      polylines.push({
        layer,
        points: [
          { x: Math.round(x1 * scaleMmPerUnit), z: Math.round(y1 * scaleMmPerUnit) },
          { x: Math.round(x2 * scaleMmPerUnit), z: Math.round(y2 * scaleMmPerUnit) },
        ],
      });
      continue;
    }

    if (token === "LWPOLYLINE") {
      const pts: { x: number; z: number }[] = [];
      let curX: number | null = null;
      let closed = false;
      let layer = "0";
      i++;
      while (i + 1 < lines.length && lines[i] !== "0") {
        const code = lines[i];
        const val = lines[i + 1];
        if (code === "8") layer = val;
        else if (code === "70") closed = (parseInt(val, 10) & 1) === 1;
        else if (code === "10") curX = parseFloat(val) || 0;
        else if (code === "20" && curX !== null) {
          const curY = parseFloat(val) || 0;
          pts.push({
            x: Math.round(curX * scaleMmPerUnit),
            z: Math.round(curY * scaleMmPerUnit),
          });
          curX = null;
        }
        i += 2;
      }
      if (closed && pts.length > 2) {
        pts.push({ ...pts[0] });
      }
      if (pts.length >= 2) {
        polylines.push({ layer, points: pts });
      }
      continue;
    }
    i++;
  }

  let minX = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxZ = -Infinity;
  for (const pl of polylines) {
    for (const pt of pl.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.z < minZ) minZ = pt.z;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.z > maxZ) maxZ = pt.z;
    }
  }

  if (!Number.isFinite(minX) || polylines.length === 0) {
    minX = 0;
    minZ = 0;
    maxX = 3600;
    maxZ = 2400;
  } else {
    // Normalize polyline coordinates so minimum corner starts at (0, 0)
    for (const pl of polylines) {
      for (const pt of pl.points) {
        pt.x = Math.round(pt.x - minX);
        pt.z = Math.round(pt.z - minZ);
      }
    }
  }

  const widthMm = Math.max(500, Math.round(maxX - minX));
  const depthMm = Math.max(500, Math.round(maxZ - minZ));
  const ext = fileName.toLowerCase().endsWith(".dwg") ? "dwg" : "dxf";

  return {
    fileName,
    fileType: ext,
    scaleMmPerUnit,
    widthMm,
    depthMm,
    offsetXMm: 0,
    offsetZMm: 0,
    opacity: 0.75,
    polylines,
  };
}

/**
 * Parses a PDF file's MediaBox (in PDF points, 1 pt = 25.4/72 mm) and returns a calibrated FloorPlanUnderlay.
 */
export function parsePdfFloorPlanMetadata(
  rawTextOrBinary: string,
  fileName = "plan.pdf",
  scaleFactor = 50, // Default 1:50 architectural scale
  dataUrl?: string
): FloorPlanUnderlay {
  const mediaBoxMatch = rawTextOrBinary.match(
    /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/
  );
  let widthMm = 3600;
  let depthMm = 2600;

  if (mediaBoxMatch) {
    const x0 = parseFloat(mediaBoxMatch[1]) || 0;
    const y0 = parseFloat(mediaBoxMatch[2]) || 0;
    const x1 = parseFloat(mediaBoxMatch[3]) || 595;
    const y1 = parseFloat(mediaBoxMatch[4]) || 842;
    const pageWidthMm = Math.abs(x1 - x0) * (25.4 / 72);
    const pageHeightMm = Math.abs(y1 - y0) * (25.4 / 72);
    widthMm = Math.max(600, Math.round(pageWidthMm * scaleFactor));
    depthMm = Math.max(600, Math.round(pageHeightMm * scaleFactor));
  }

  return {
    fileName,
    fileType: "pdf",
    scaleMmPerUnit: scaleFactor,
    widthMm,
    depthMm,
    offsetXMm: 0,
    offsetZMm: 0,
    opacity: 0.65,
    dataUrl,
    polylines: [
      {
        layer: "PDF_PAGE_BOUNDS",
        points: [
          { x: 0, z: 0 },
          { x: widthMm, z: 0 },
          { x: widthMm, z: depthMm },
          { x: 0, z: depthMm },
          { x: 0, z: 0 },
        ],
      },
    ],
  };
}

/**
 * Converts eligible CAD underlay polylines (segments >= 400mm) into parametric WallDefinition objects.
 */
export function convertUnderlayPolylinesToWalls(
  underlay: FloorPlanUnderlay,
  ceilingHeightMm = 2600,
  wallThicknessMm = 150
): WallDefinition[] {
  const walls: WallDefinition[] = [];
  const polylines = underlay.polylines || [];
  let idx = 1;

  for (const pl of polylines) {
    for (let i = 0; i + 1 < pl.points.length; i++) {
      const p1 = pl.points[i];
      const p2 = pl.points[i + 1];
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const len = Math.round(Math.hypot(dx, dz));
      if (len < 400) continue;

      const angleDeg = Math.round((Math.atan2(dz, dx) * 180) / Math.PI);
      const normalizedAngle = ((angleDeg % 360) + 360) % 360;

      walls.push({
        id: `wall_cad_${idx}`,
        name: `CAD Duvar ${idx} (${pl.layer || "0"})`,
        length: len,
        height: ceilingHeightMm,
        thickness: wallThicknessMm,
        position: {
          x: Math.round(p1.x + underlay.offsetXMm),
          y: 0,
          z: Math.round(p1.z + underlay.offsetZMm),
        },
        rotationY: normalizedAngle,
        elements: [],
      });
      idx++;
      if (walls.length >= 16) break;
    }
    if (walls.length >= 16) break;
  }

  return walls;
}
