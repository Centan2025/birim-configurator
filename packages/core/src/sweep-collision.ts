export interface Point2D {
  x: number;
  z: number;
}

export interface SweepModuleInput {
  id: string;
  name: string;
  category?: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  carcass: { panelThickness: number; plinthHeight: number };
  isOpenFront?: boolean;
  bays: Array<{
    index: number;
    customWidth?: number;
    door: {
      type: string;
      doorSystemId?: string;
      handleCategory?: string;
    };
    drawers: Array<{
      id: string;
      elevationY: number;
      height: number;
      isInternal?: boolean;
    }>;
  }>;
}

export interface SweepCollisionIssue {
  id: string;
  severity: "error" | "warning";
  kind: "corner_handle_clash" | "door_arc_collision" | "drawer_pullout_collision";
  moduleAId: string;
  moduleBId: string;
  moduleAName: string;
  moduleBName: string;
  overlapDepthMm: number;
  recommendedFillerMm: number;
  intersectionPointXZ: Point2D;
  message: string;
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Transforms a module-local (lx, lz) point into world (X, Z) coordinates.
 * Module local origin (0, 0) is back-left corner; +X is right along width, +Z is forward along depth.
 */
export function moduleLocalToWorldXZ(
  mod: Pick<SweepModuleInput, "position" | "rotation">,
  lx: number,
  lz: number
): Point2D {
  const rotDeg = ((mod.rotation?.y ?? 0) % 360 + 360) % 360;
  const rad = rotDeg * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: mod.position.x + lx * cos + lz * sin,
    z: mod.position.z - lx * sin + lz * cos,
  };
}

function getHandleProjectionMm(handleCategory?: string): number {
  if (
    !handleCategory ||
    handleCategory === "push_to_open" ||
    handleCategory === "gola_horizontal" ||
    handleCategory === "gola_vertical" ||
    handleCategory === "integrated_j_pull" ||
    handleCategory === "milled_wood_grip" ||
    handleCategory === "none"
  ) {
    return 4;
  }
  return 38;
}

function computeModuleBodyPolygonXZ(mod: SweepModuleInput, includeHandleClearance = false): Point2D[] {
  const W = mod.dimensions.width;
  const maxHandle = includeHandleClearance
    ? Math.max(
        0,
        ...mod.bays.map((b) =>
          b.door.type === "open" ? 0 : getHandleProjectionMm(b.door.handleCategory)
        )
      )
    : 0;
  const D = mod.dimensions.depth + maxHandle;
  return [
    moduleLocalToWorldXZ(mod, 0, 0),
    moduleLocalToWorldXZ(mod, W, 0),
    moduleLocalToWorldXZ(mod, W, D),
    moduleLocalToWorldXZ(mod, 0, D),
  ];
}

interface SweptVolume2D {
  moduleId: string;
  moduleName: string;
  kind: "door_arc" | "drawer_pullout";
  yMin: number;
  yMax: number;
  polygonXZ: Point2D[];
  handleProjMm: number;
}

/**
 * Computes all convex 2D (X, Z) swept volumes for hinged doors (0°..90° arc) and full-extension drawers.
 */
export function computeModuleSweptVolumes(mod: SweepModuleInput): SweptVolume2D[] {
  if (mod.category === "complementary" || mod.isOpenFront) return [];
  const T = mod.carcass?.panelThickness || 18;
  const plinth = mod.carcass?.plinthHeight ?? 80;
  const W = mod.dimensions.width;
  const H = mod.dimensions.height;
  const D = mod.dimensions.depth;
  const bayCount = Math.max(1, mod.bays.length);
  const availW = Math.max(100, W - (bayCount + 1) * T);
  const defaultBayW = availW / bayCount;

  const volumes: SweptVolume2D[] = [];
  let curX = T;

  for (let i = 0; i < mod.bays.length; i++) {
    const bay = mod.bays[i];
    const bw = bay.customWidth && bay.customWidth > 80 ? bay.customWidth : defaultBayW;
    const bayLeftX = curX - T / 2;
    const bayRightX = curX + bw + T / 2;
    const spanW = Math.max(100, bayRightX - bayLeftX);
    const doorType = bay.door?.type || "single_left";
    const handleProj = getHandleProjectionMm(bay.door?.handleCategory);

    // 1. Hinged door arc sweep polygons (90 deg opening envelope)
    if (doorType === "single_left" || doorType === "single_right" || doorType === "double") {
      const leaves =
        doorType === "double"
          ? [
              { hingeX: bayLeftX, radius: spanW / 2 + handleProj, dir: 1 as const },
              { hingeX: bayRightX, radius: spanW / 2 + handleProj, dir: -1 as const },
            ]
          : doorType === "single_left"
          ? [{ hingeX: bayLeftX, radius: spanW + handleProj, dir: 1 as const }]
          : [{ hingeX: bayRightX, radius: spanW + handleProj, dir: -1 as const }];

      for (const leaf of leaves) {
        const pts: Point2D[] = [moduleLocalToWorldXZ(mod, leaf.hingeX, D)];
        const steps = 6;
        for (let s = 0; s <= steps; s++) {
          const theta = (s / steps) * (Math.PI / 2);
          const lx = leaf.hingeX + leaf.dir * leaf.radius * Math.cos(theta);
          const lz = D + leaf.radius * Math.sin(theta);
          pts.push(moduleLocalToWorldXZ(mod, lx, lz));
        }
        volumes.push({
          moduleId: mod.id,
          moduleName: mod.name,
          kind: "door_arc",
          yMin: mod.position.y + plinth,
          yMax: mod.position.y + H,
          polygonXZ: pts,
          handleProjMm: handleProj,
        });
      }
    }

    // 2. External drawer pullout sweep rectangles
    const extDrawers = (bay.drawers || []).filter((d) => !d.isInternal);
    if (extDrawers.length > 0) {
      const pulloutStroke = Math.min(500, Math.max(270, D - 50)) + handleProj;
      const minDrwY = Math.min(...extDrawers.map((d) => d.elevationY));
      const maxDrwY = Math.max(...extDrawers.map((d) => d.elevationY + d.height));
      volumes.push({
        moduleId: mod.id,
        moduleName: mod.name,
        kind: "drawer_pullout",
        yMin: mod.position.y + plinth + T + minDrwY,
        yMax: mod.position.y + plinth + T + maxDrwY,
        polygonXZ: [
          moduleLocalToWorldXZ(mod, bayLeftX + 2, D),
          moduleLocalToWorldXZ(mod, bayRightX - 2, D),
          moduleLocalToWorldXZ(mod, bayRightX - 2, D + pulloutStroke),
          moduleLocalToWorldXZ(mod, bayLeftX + 2, D + pulloutStroke),
        ],
        handleProjMm: handleProj,
      });
    }

    curX += bw + T;
  }

  return volumes;
}

/**
 * Separating Axis Theorem (SAT) penetration depth test between two convex 2D polygons in (X, Z).
 * Returns penetration depth in mm (> 0 means overlapping).
 */
export function convexPolygonPenetrationMm(polyA: Point2D[], polyB: Point2D[]): {
  overlaps: boolean;
  depthMm: number;
  contactPoint: Point2D;
} {
  let minOverlap = Infinity;
  const polys = [polyA, polyB];

  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const edgeX = p2.x - p1.x;
      const edgeZ = p2.z - p1.z;
      const len = Math.hypot(edgeX, edgeZ);
      if (len < 1e-6) continue;
      const axisX = -edgeZ / len;
      const axisZ = edgeX / len;

      let minA = Infinity;
      let maxA = -Infinity;
      for (const p of polyA) {
        const proj = p.x * axisX + p.z * axisZ;
        if (proj < minA) minA = proj;
        if (proj > maxA) maxA = proj;
      }

      let minB = Infinity;
      let maxB = -Infinity;
      for (const p of polyB) {
        const proj = p.x * axisX + p.z * axisZ;
        if (proj < minB) minB = proj;
        if (proj > maxB) maxB = proj;
      }

      const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
      if (overlap <= 1.5) {
        return { overlaps: false, depthMm: 0, contactPoint: { x: 0, z: 0 } };
      }
      if (overlap < minOverlap) {
        minOverlap = overlap;
      }
    }
  }

  const cx =
    (polyA.reduce((s, p) => s + p.x, 0) / polyA.length +
      polyB.reduce((s, p) => s + p.x, 0) / polyB.length) *
    0.5;
  const cz =
    (polyA.reduce((s, p) => s + p.z, 0) / polyA.length +
      polyB.reduce((s, p) => s + p.z, 0) / polyB.length) *
    0.5;

  return {
    overlaps: true,
    depthMm: Math.round(minOverlap * 10) / 10,
    contactPoint: { x: Math.round(cx), z: Math.round(cz) },
  };
}

/**
 * Evaluates 3D corner door-arc & drawer-pullout sweep collisions across all modules in a project.
 * Enforces minimum 50mm corner filler clearance when two perpendicular runs meet with protruding handles.
 */
export function evaluateCornerAndSweepCollisions(
  modules: SweepModuleInput[],
  minCornerFillerMm = 50
): SweepCollisionIssue[] {
  const issues: SweepCollisionIssue[] = [];
  const activeMods = modules.filter((m) => m.category !== "complementary");

  for (let i = 0; i < activeMods.length; i++) {
    const modA = activeMods[i];
    const aYMin = modA.position.y;
    const aYMax = modA.position.y + modA.dimensions.height;
    const sweepsA = computeModuleSweptVolumes(modA);

    for (let j = 0; j < activeMods.length; j++) {
      if (i === j) continue;
      const modB = activeMods[j];
      const bYMin = modB.position.y;
      const bYMax = modB.position.y + modB.dimensions.height;

      // Skip modules in non-overlapping vertical bands (e.g. base vs upper wall cabinet)
      if (Math.min(aYMax, bYMax) - Math.max(aYMin, bYMin) <= 10) continue;

      const bodyBWithHandles = computeModuleBodyPolygonXZ(modB, true);
      const sweepsB = computeModuleSweptVolumes(modB);
      const rotA = ((modA.rotation?.y ?? 0) % 360 + 360) % 360;
      const rotB = ((modB.rotation?.y ?? 0) % 360 + 360) % 360;
      const angleDiff = Math.abs(rotA - rotB) % 180;
      const isPerpendicularCorner = Math.abs(angleDiff - 90) <= 5;

      for (const sw of sweepsA) {
        if (Math.min(sw.yMax, bYMax) - Math.max(sw.yMin, bYMin) <= 10) continue;
        let hit = convexPolygonPenetrationMm(sw.polygonXZ, bodyBWithHandles);
        if (!hit.overlaps && isPerpendicularCorner) {
          for (const swB of sweepsB) {
            if (Math.min(sw.yMax, swB.yMax) - Math.max(sw.yMin, swB.yMin) <= 10) continue;
            const arcHit = convexPolygonPenetrationMm(sw.polygonXZ, swB.polygonXZ);
            if (arcHit.overlaps && sw.kind === "drawer_pullout") {
              hit = arcHit;
              break;
            }
          }
        }
        if (!hit.overlaps) continue;

        // Avoid duplicate A<->B pair reporting of identical kind
        const pairKey = [modA.id, modB.id].sort().join("::") + "::" + sw.kind;
        if (issues.some((existing) => existing.id === pairKey)) continue;

        const recFiller = Math.max(minCornerFillerMm, Math.ceil((hit.depthMm + 12) / 5) * 5);
        const kindLabel =
          sw.kind === "drawer_pullout"
            ? "çekmece açılım yolu"
            : isPerpendicularCorner
            ? "90° köşe kapak/kulp açılım yayı"
            : "kapak açılım yayı";

        issues.push({
          id: pairKey,
          severity: sw.kind === "drawer_pullout" || hit.depthMm > 18 ? "error" : "warning",
          kind:
            sw.kind === "drawer_pullout"
              ? "drawer_pullout_collision"
              : isPerpendicularCorner
              ? "corner_handle_clash"
              : "door_arc_collision",
          moduleAId: modA.id,
          moduleBId: modB.id,
          moduleAName: modA.name,
          moduleBName: modB.name,
          overlapDepthMm: hit.depthMm,
          recommendedFillerMm: recFiller,
          intersectionPointXZ: hit.contactPoint,
          message: `${modA.name} ile ${modB.name} arasında ${kindLabel} çakışması (${hit.depthMm} mm girişim). Köşe birleşiminde en az ${recFiller} mm kör çıta (filler) bırakılmalıdır.`,
        });
      }
    }
  }

  return issues;
}

/**
 * Automatically resolves perpendicular 90° corner sweep collisions by shifting the colliding run
 * outward by `recommendedFillerMm` (min 50mm) along its wall vector and returning the filler spec.
 */
export function computeCornerFillerAutoFix<T extends SweepModuleInput>(
  modules: T[],
  minCornerFillerMm = 50
): {
  adjustedModules: T[];
  resolvedCount: number;
  insertedFillerSpecs: Array<{
    position: { x: number; y: number; z: number };
    rotationY: number;
    widthMm: number;
    heightMm: number;
    depthMm: number;
  }>;
} {
  const cloned = modules.map((m) => ({
    ...m,
    position: { ...m.position },
    rotation: m.rotation ? { ...m.rotation } : { x: 0, y: 0, z: 0 },
  }));
  const issues = evaluateCornerAndSweepCollisions(cloned, minCornerFillerMm);
  const insertedFillerSpecs: Array<{
    position: { x: number; y: number; z: number };
    rotationY: number;
    widthMm: number;
    heightMm: number;
    depthMm: number;
  }> = [];
  let resolvedCount = 0;

  const shiftedIds = new Set<string>();
  for (const issue of issues) {
    const target = cloned.find((m) => m.id === issue.moduleAId);
    if (!target || shiftedIds.has(target.id)) continue;

    const shiftMm = Math.max(minCornerFillerMm, issue.recommendedFillerMm);
    const rotDeg = ((target.rotation?.y ?? 0) % 360 + 360) % 360;
    const rad = rotDeg * DEG_TO_RAD;
    const dirX = Math.cos(rad);
    const dirZ = -Math.sin(rad);

    insertedFillerSpecs.push({
      position: { ...target.position },
      rotationY: rotDeg,
      widthMm: shiftMm,
      heightMm: target.dimensions.height,
      depthMm: target.carcass.panelThickness || 18,
    });

    // Shift target and all downstream modules on the same wall axis
    for (const m of cloned) {
      if (m.category === "complementary") continue;
      const mRot = ((m.rotation?.y ?? 0) % 360 + 360) % 360;
      if (Math.abs(mRot - rotDeg) <= 2 && Math.abs(m.position.y - target.position.y) <= 50) {
        const relProj =
          (m.position.x - target.position.x) * dirX + (m.position.z - target.position.z) * dirZ;
        if (relProj >= -2) {
          m.position.x = Math.round(m.position.x + dirX * shiftMm);
          m.position.z = Math.round(m.position.z + dirZ * shiftMm);
          shiftedIds.add(m.id);
        }
      }
    }
    resolvedCount++;
  }

  return { adjustedModules: cloned, resolvedCount, insertedFillerSpecs };
}
