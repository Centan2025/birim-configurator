import { Position3D } from "@birim/core";
import { ComponentGeometry } from "./types";

/** Three.js Euler XYZ: apply Z then Y then X, about an explicit module-space pivot. */
export function transformComponentPoint(component: ComponentGeometry, point: Position3D): Position3D {
  const r = component.rotation;
  if (!r || (r[0] === 0 && r[1] === 0 && r[2] === 0)) {
    return { x: point.x, y: point.y, z: point.z };
  }
  const pivot = component.pivot ?? component.position;
  let x = point.x - pivot.x, y = point.y - pivot.y, z = point.z - pivot.z;
  if (r[2] !== 0) {
    const cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    const nx = x * cz - y * sz;
    y = x * sz + y * cz;
    x = nx;
  }
  if (r[1] !== 0) {
    const cy = Math.cos(r[1]), sy = Math.sin(r[1]);
    const nx = x * cy + z * sy;
    z = -x * sy + z * cy;
    x = nx;
  }
  if (r[0] !== 0) {
    const cx = Math.cos(r[0]), sx = Math.sin(r[0]);
    const ny = y * cx - z * sx;
    z = y * sx + z * cx;
    y = ny;
  }
  return { x: x + pivot.x, y: y + pivot.y, z: z + pivot.z };
}

export function componentBounds(component: ComponentGeometry) {
  const px = component.position.x;
  const py = component.position.y;
  const pz = component.position.z;
  const w = component.dimensions.width;
  const h = component.dimensions.height;
  const d = component.dimensions.depth;
  const r = component.rotation;

  if (!r || (r[0] === 0 && r[1] === 0 && r[2] === 0)) {
    return {
      min: { x: px, y: py, z: pz },
      max: { x: px + w, y: py + h, z: pz + d },
    };
  }

  const pivot = component.pivot ?? component.position;
  const ox = px - pivot.x;
  const oy = py - pivot.y;
  const oz = pz - pivot.z;
  const cz = Math.cos(r[2]), sz = Math.sin(r[2]);
  const cy = Math.cos(r[1]), sy = Math.sin(r[1]);
  const cx = Math.cos(r[0]), sx = Math.sin(r[0]);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let ix = 0; ix <= 1; ix++) {
    const lx = ox + ix * w;
    for (let iy = 0; iy <= 1; iy++) {
      const ly = oy + iy * h;
      const x1 = lx * cz - ly * sz;
      const y1 = lx * sz + ly * cz;
      for (let iz = 0; iz <= 1; iz++) {
        const lz = oz + iz * d;
        const x2 = x1 * cy + lz * sy;
        const z2 = -x1 * sy + lz * cy;
        const y3 = y1 * cx - z2 * sx;
        const z3 = y1 * sx + z2 * cx;
        const wx = x2 + pivot.x;
        const wy = y3 + pivot.y;
        const wz = z3 + pivot.z;
        if (wx < minX) minX = wx;
        if (wx > maxX) maxX = wx;
        if (wy < minY) minY = wy;
        if (wy > maxY) maxY = wy;
        if (wz < minZ) minZ = wz;
        if (wz > maxZ) maxZ = wz;
      }
    }
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}
