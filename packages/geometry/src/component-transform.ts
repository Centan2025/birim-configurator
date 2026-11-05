import { Position3D } from "@birim/core";
import { ComponentGeometry } from "./types";

/** Three.js Euler XYZ: apply Z then Y then X, about an explicit module-space pivot. */
export function transformComponentPoint(component: ComponentGeometry, point: Position3D): Position3D {
  const r = component.rotation;
  if (!r) return { ...point };
  const pivot = component.pivot ?? component.position;
  let x = point.x - pivot.x, y = point.y - pivot.y, z = point.z - pivot.z;
  [x, y] = [x * Math.cos(r[2]) - y * Math.sin(r[2]), x * Math.sin(r[2]) + y * Math.cos(r[2])];
  [x, z] = [x * Math.cos(r[1]) + z * Math.sin(r[1]), -x * Math.sin(r[1]) + z * Math.cos(r[1])];
  [y, z] = [y * Math.cos(r[0]) - z * Math.sin(r[0]), y * Math.sin(r[0]) + z * Math.cos(r[0])];
  return { x: x + pivot.x, y: y + pivot.y, z: z + pivot.z };
}

export function componentBounds(component: ComponentGeometry) {
  const points = [0, 1].flatMap(x => [0, 1].flatMap(y => [0, 1].map(z => transformComponentPoint(component, {
    x: component.position.x + x * component.dimensions.width,
    y: component.position.y + y * component.dimensions.height,
    z: component.position.z + z * component.dimensions.depth,
  }))));
  return { min: { x: Math.min(...points.map(p => p.x)), y: Math.min(...points.map(p => p.y)), z: Math.min(...points.map(p => p.z)) }, max: { x: Math.max(...points.map(p => p.x)), y: Math.max(...points.map(p => p.y)), z: Math.max(...points.map(p => p.z)) } };
}
