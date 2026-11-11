import { calculateModulePlacement, ModuleInstance, WallDefinition } from "@birim/core";

export interface AngledWallSnapSolution {
  wallId: string;
  wallName: string;
  moduleRotationYDeg: number;
  snappedPositionX: number;
  snappedPositionZ: number;
  alongWallMm: number;
  perpDistanceMm: number;
  snappedToNeighborModuleId?: string;
}

function normalizeDeg(deg: number): number {
  return (((Math.round(deg * 10) / 10) % 360) + 360) % 360;
}

/**
 * Computes the room-facing unit tangent `T` (along which module local +X runs)
 * and room-inward unit normal `N` (along which module local +Z / doors open)
 * for any orthogonal or arbitrary-angle `WallDefinition`.
 */
export function getWallRoomBasis(
  wall: WallDefinition,
  roomCenterHint: { x: number; z: number } = { x: 1800, z: 1400 }
): {
  p0: { x: number; z: number };
  p1: { x: number; z: number };
  rawTangent: { x: number; z: number };
  inwardNormal: { x: number; z: number };
  moduleTangent: { x: number; z: number };
  moduleRotationYDeg: number;
} {
  const theta = ((wall.rotationY || 0) * Math.PI) / 180;
  const tx = Math.cos(theta);
  const tz = Math.sin(theta);
  const p0 = { x: wall.position.x, z: wall.position.z };
  const p1 = { x: p0.x + tx * wall.length, z: p0.z + tz * wall.length };
  const mid = { x: (p0.x + p1.x) * 0.5, z: (p0.z + p1.z) * 0.5 };

  // Candidate unit normals perpendicular to wall segment: nA = (-tz, tx), nB = (tz, -tx)
  const nA = { x: -tz, z: tx };
  const toRoom = { x: roomCenterHint.x - mid.x, z: roomCenterHint.z - mid.z };
  const dotA = toRoom.x * nA.x + toRoom.z * nA.z;
  const inwardNormal = dotA >= 0 ? nA : { x: tz, z: -tx };

  // In Birim's 3D/2D right-handed convention (`calculateModulePlacement`):
  // local +Z (front doors) maps to (sin β, cos β) = inwardNormal
  // local +X (module width) maps to (cos β, -sin β) = (inwardNormal.z, -inwardNormal.x)
  const betaRad = Math.atan2(inwardNormal.x, inwardNormal.z);
  const moduleRotationYDeg = normalizeDeg((betaRad * 180) / Math.PI);
  const moduleTangent = { x: Math.cos(betaRad), z: -Math.sin(betaRad) };

  return {
    p0,
    p1,
    rawTangent: { x: tx, z: tz },
    inwardNormal,
    moduleTangent,
    moduleRotationYDeg,
  };
}

/**
 * Given a desired world `origin` (where module local `(0,0)` rear-left corner sits)
 * and `moduleRotationYDeg`, returns the exact `module.position.{x, z}` so that
 * `calculateModulePlacement(mod).origin` equals `origin` with 0.0mm drift!
 */
export function originToModulePosition(
  widthMm: number,
  depthMm: number,
  moduleRotationYDeg: number,
  originX: number,
  originZ: number
): { x: number; z: number } {
  const rad = (moduleRotationYDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const corners = [0, widthMm].flatMap((x) =>
    [0, depthMm].map((z) => ({ x: x * c + z * s, z: -x * s + z * c }))
  );
  const minX = Math.min(...corners.map((p) => p.x));
  const minZ = Math.min(...corners.map((p) => p.z));
  return {
    x: Math.round(originX + minX),
    z: Math.round(originZ + minZ),
  };
}

/**
 * Projects a module's center onto all room walls (including 30°/45°/135°/freehand angled walls!)
 * and computes the exact parallel rotation + flush back-panel position + magnetic neighbor chaining
 * along the angled wall tangent!
 */
export function solveAngledWallSnapForModule(params: {
  mod: ModuleInstance;
  modIdx: number;
  candidatePosX: number;
  candidatePosZ: number;
  walls: WallDefinition[];
  allModules: ModuleInstance[];
  maxPerpSnapDistMm?: number;
  forceWallId?: string;
}): AngledWallSnapSolution | null {
  const {
    mod,
    modIdx,
    candidatePosX,
    candidatePosZ,
    walls,
    allModules,
    maxPerpSnapDistMm = 135,
    forceWallId,
  } = params;
  if (!walls || walls.length === 0) return null;

  const mainLen = walls[0]?.length || 3600;
  const roomCenter = { x: mainLen * 0.5, z: 1400 };
  const tempMod: ModuleInstance = {
    ...mod,
    position: { ...mod.position, x: candidatePosX, z: candidatePosZ },
  };
  const curPlacement = calculateModulePlacement(tempMod);
  const modCenter = {
    x: candidatePosX + curPlacement.width * 0.5,
    z: candidatePosZ + curPlacement.depth * 0.5,
  };

  let best: AngledWallSnapSolution | null = null;
  let bestScore = Infinity;

  for (const wall of walls) {
    if (forceWallId && wall.id !== forceWallId) continue;
    const basis = getWallRoomBasis(wall, roomCenter);
    const vx = modCenter.x - basis.p0.x;
    const vz = modCenter.z - basis.p0.z;

    const sRaw = vx * basis.rawTangent.x + vz * basis.rawTangent.z;
    const perpCenter = vx * basis.inwardNormal.x + vz * basis.inwardNormal.z;
    const backClearance = perpCenter - mod.dimensions.depth * 0.5;

    if (!forceWallId) {
      if (sRaw < -120 || sRaw > wall.length + 120) continue;
      if (Math.abs(backClearance) > maxPerpSnapDistMm) continue;
    }

    // Determine whether `moduleTangent` points in the same direction as `rawTangent` (+1) or opposite (-1)
    const dirSign =
      basis.moduleTangent.x * basis.rawTangent.x + basis.moduleTangent.z * basis.rawTangent.z >= 0
        ? 1
        : -1;

    // In `rawTangent` parameter `u in [0 .. wall.length]`, module spans `[uStart .. uStart + W]` if dirSign > 0,
    // or `[uStart - W .. uStart]` if dirSign < 0.
    const clampedCenterS = Math.max(
      mod.dimensions.width * 0.5,
      Math.min(Math.max(mod.dimensions.width * 0.5, wall.length - mod.dimensions.width * 0.5), sRaw)
    );
    let uOrigin =
      dirSign > 0
        ? clampedCenterS - mod.dimensions.width * 0.5
        : clampedCenterS + mod.dimensions.width * 0.5;

    // Snap `uOrigin` to 10mm grid along the angled wall
    uOrigin = Math.round(uOrigin / 10) * 10;

    // Edge-to-edge magnetic chaining with other cabinets already parallel to this angled wall!
    let snappedNeighborId: string | undefined;
    for (let i = 0; i < allModules.length; i++) {
      if (i === modIdx) continue;
      const other = allModules[i];
      if (!other || other.category === "complementary") continue;
      const otherRot = normalizeDeg(other.rotation?.y || 0);
      const angleDiff = Math.abs((((otherRot - basis.moduleRotationYDeg + 540) % 360) - 180));
      if (angleDiff > 3) continue;

      const otherPlace = calculateModulePlacement(other);
      const ovx = otherPlace.origin.x - basis.p0.x;
      const ovz = otherPlace.origin.z - basis.p0.z;
      const otherPerp = ovx * basis.inwardNormal.x + ovz * basis.inwardNormal.z;
      if (Math.abs(otherPerp) > 45) continue;

      const otherUOrigin = ovx * basis.rawTangent.x + ovz * basis.rawTangent.z;
      // Other module occupies [otherMinU, otherMaxU] along rawTangent
      const otherMinU = dirSign > 0 ? otherUOrigin : otherUOrigin - other.dimensions.width;
      const otherMaxU = dirSign > 0 ? otherUOrigin + other.dimensions.width : otherUOrigin;

      const myMinU = dirSign > 0 ? uOrigin : uOrigin - mod.dimensions.width;
      const myMaxU = dirSign > 0 ? uOrigin + mod.dimensions.width : uOrigin;

      if (Math.abs(myMinU - otherMaxU) <= 38) {
        const targetMinU = otherMaxU;
        uOrigin = dirSign > 0 ? targetMinU : targetMinU + mod.dimensions.width;
        snappedNeighborId = other.id;
        break;
      }
      if (Math.abs(myMaxU - otherMinU) <= 38) {
        const targetMaxU = otherMinU;
        uOrigin = dirSign > 0 ? targetMaxU - mod.dimensions.width : targetMaxU;
        snappedNeighborId = other.id;
        break;
      }
    }

    const worldOriginX = basis.p0.x + basis.rawTangent.x * uOrigin;
    const worldOriginZ = basis.p0.z + basis.rawTangent.z * uOrigin;
    const pos = originToModulePosition(
      mod.dimensions.width,
      mod.dimensions.depth,
      basis.moduleRotationYDeg,
      worldOriginX,
      worldOriginZ
    );

    const score = Math.abs(backClearance);
    if (score < bestScore) {
      bestScore = score;
      best = {
        wallId: wall.id,
        wallName: wall.name,
        moduleRotationYDeg: basis.moduleRotationYDeg,
        snappedPositionX: pos.x,
        snappedPositionZ: pos.z,
        alongWallMm: Math.round(uOrigin),
        perpDistanceMm: Math.round(Math.abs(backClearance)),
        snappedToNeighborModuleId: snappedNeighborId,
      };
    }
  }

  return best;
}
