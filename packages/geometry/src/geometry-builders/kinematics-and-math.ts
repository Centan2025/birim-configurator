import { BoundedLruCache } from "@birim/core";
import type { ModuleGeometryBreakdown } from "../types";

export const moduleGeometryCache = new BoundedLruCache<string, ModuleGeometryBreakdown>(512);

/**
 * Exact 2-Bar Articulated Linkage Inverse Kinematics in the Y-Z Plane (Law of Cosines).
 * Connects a stationary carcass pivot (yS, zS) to a moving door pivot (yD, zD) using two
 * rigid steel arms of constant lengths L1 and L2 so 60fps Three.js fast-path transforms
 * stay 100% connected from 0° (closed inside cabinet) to 90° (fully open)!
 */
export function solve2BarLinkageYZ(
  yS: number,
  zS: number,
  yD: number,
  zD: number,
  L1: number,
  L2: number,
  bendRearward = true
): { yE: number; zE: number; pitch1Rad: number; pitch2Rad: number } {
  const dy = yD - yS;
  const dz = zD - zS;
  const rawDist = Math.hypot(dy, dz);
  const minReach = Math.abs(L1 - L2) + 2;
  const maxReach = L1 + L2 - 1;
  const d = Math.max(minReach, Math.min(maxReach, rawDist > 1e-3 ? rawDist : minReach));
  const ux = rawDist > 1e-3 ? dy / rawDist : -1;
  const uz = rawDist > 1e-3 ? dz / rawDist : 0;

  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const midY = yS + a * ux;
  const midZ = zS + a * uz;

  // Candidate elbows perpendicular to (ux, uz) in (Y, Z)
  const candAY = midY - h * uz;
  const candAZ = midZ + h * ux;
  const candBY = midY + h * uz;
  const candBZ = midZ - h * ux;

  const pickA = bendRearward ? candAZ <= candBZ : candAZ > candBZ;
  const yE = pickA ? candAY : candBY;
  const zE = pickA ? candAZ : candBZ;

  // In Three.js right-handed coords (+Y up, +Z forward), a +Z bar rotated around X by rx = -atan2(dy, dz) lands on (+dy, +dz)!
  const pitch1Rad = -Math.atan2(yE - yS, zE - zS);
  const pitch2Rad = -Math.atan2(yD - yE, zD - zE);
  return { yE, zE, pitch1Rad, pitch2Rad };
}

export function resolveStandardCornerWingDepthMm(
  width: number,
  depth: number,
  isWallCorner: boolean,
  isWardrobeCorner: boolean
): number {
  const minArm = Math.min(width, depth);
  if (isWallCorner) {
    return minArm >= 580 ? 350 : Math.min(350, Math.round(minArm * 0.56));
  }
  if (isWardrobeCorner) {
    return minArm >= 920 ? 600 : Math.min(600, Math.round(minArm * 0.58));
  }
  return minArm >= 780 ? 580 : Math.min(580, Math.round(minArm * 0.64));
}
