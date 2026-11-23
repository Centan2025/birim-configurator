import React from "react";
import {
  DesignProject,
  ModuleInstance,
  SceneObjectInstance,
  WallDefinition,
} from "@birim/core";
import {
  createSceneObjectInstanceFromCatalog,
  getV4TemplateById,
  V5_SPECIALIZED_MODULE_TEMPLATES,
  KITCHEN_TEMPLATES,
  WARDROBE_TEMPLATES,
} from "@birim/catalog";
import { getWallRoomBasis, originToModulePosition } from "./angledWallSnapEngine";
import { getEffectiveSpaceWalls, getModuleOrientedFootprint } from "./kitchenSpatialEngine";

let activeDraggedSceneCatalogId: string | null = null;

export function setActiveDraggedSceneCatalogId(catalogId: string | null): void {
  activeDraggedSceneCatalogId = catalogId;
}

export function getActiveDraggedSceneCatalogId(): string | null {
  return activeDraggedSceneCatalogId;
}

export function startSceneObjectSilhouetteDrag(
  e: React.DragEvent<HTMLElement>,
  catalogId: string
): void {
  setActiveDraggedSceneCatalogId(catalogId);
  e.dataTransfer.setData("application/x-birim-scene-object-id", catalogId);
  e.dataTransfer.effectAllowed = "copy";
  // V72: Crisp architectural wireframe blueprint drawing ghost under cursor while dragging!
  if (typeof document !== "undefined" && e.dataTransfer.setDragImage) {
    try {
      const c = document.createElement("canvas");
      c.width = 116;
      c.height = 84;
      const ctx = c.getContext("2d");
      if (ctx) {
        const low = catalogId.toLowerCase();
        ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(4, 4, 108, 76, 12);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#BAE6FD";
        ctx.lineWidth = 2;
        if (low.includes("table") || low.includes("masa")) {
          ctx.strokeRect(22, 24, 72, 10);
          ctx.beginPath();
          ctx.moveTo(28, 34); ctx.lineTo(28, 62);
          ctx.moveTo(88, 34); ctx.lineTo(88, 62);
          ctx.stroke();
        } else if (low.includes("chair") || low.includes("stool") || low.includes("sandalye")) {
          ctx.beginPath();
          ctx.moveTo(40, 18); ctx.lineTo(40, 44); ctx.lineTo(74, 44);
          ctx.moveTo(40, 44); ctx.lineTo(40, 66);
          ctx.moveTo(74, 44); ctx.lineTo(74, 66);
          ctx.stroke();
        } else {
          // Isometric architectural cube wireframe
          ctx.beginPath();
          ctx.moveTo(58, 16); ctx.lineTo(86, 28); ctx.lineTo(86, 56); ctx.lineTo(58, 68); ctx.lineTo(30, 56); ctx.lineTo(30, 28); ctx.closePath();
          ctx.moveTo(30, 28); ctx.lineTo(58, 40); ctx.lineTo(86, 28);
          ctx.moveTo(58, 40); ctx.lineTo(58, 68);
          ctx.stroke();
        }
        c.style.position = "fixed";
        c.style.top = "-200px";
        document.body.appendChild(c);
        e.dataTransfer.setDragImage(c, 58, 42);
        window.setTimeout(() => c.remove(), 0);
      }
    } catch {}
  }
}

export interface MultiWallModuleSnapResult {
  wallId: string;
  wallName: string;
  position: { x: number; y: number; z: number };
  rotationYDeg: number;
  insertBetweenShift?: {
    wallId: string;
    fromAlongMm: number;
    shiftDeltaMm: number;
  };
  snapLabel: string;
}

export function computeRoomDynamicCenter(walls: WallDefinition[]): { x: number; z: number } {
  const mainLen = walls[0]?.length || 3600;
  return { x: Math.max(900, mainLen * 0.5), z: 1200 };
}

/**
 * Computes exact `module.position.{x, z}` for a cabinet or object spanning `[alongMm, alongMm + widthMm]`
 * along `wall` (measured strictly forward along `rawTangent` from `wall.position`!) with depth `depthMm`
 * extending along `inwardNormal` into the room interior — guaranteed 0.0mm negative-Z drift on 90°/270°/180° walls!
 */
export function wallIntervalToModulePosition(
  wall: WallDefinition,
  alongMm: number,
  widthMm: number,
  depthMm: number,
  roomCenter: { x: number; z: number }
): { x: number; z: number; rotationYDeg: number } {
  const basis = getWallRoomBasis(wall, roomCenter);
  const wx = basis.rawTangent.x;
  const wz = basis.rawTangent.z;
  const nx = basis.inwardNormal.x;
  const nz = basis.inwardNormal.z;

  const dotModuleVsWall = basis.moduleTangent.x * wx + basis.moduleTangent.z * wz;
  // If moduleTangent points opposite to rawTangent (as on a 90° Left Wall where local +X runs from +Z to -Z),
  // the cabinet's local (0,0) origin sits at `alongMm + widthMm` along the wall so the cabinet occupies `[alongMm, alongMm + widthMm]`!
  const originAlong = dotModuleVsWall >= 0 ? alongMm : alongMm + widthMm;
  const originX = basis.p0.x + wx * originAlong;
  const originZ = basis.p0.z + wz * originAlong;
  const pos = originToModulePosition(widthMm, depthMm, basis.moduleRotationYDeg, originX, originZ);

  // Double-check against the 4 physical corners of `[alongMm, alongMm+widthMm] x [0, depthMm]`
  const c00x = basis.p0.x + wx * alongMm;
  const c00z = basis.p0.z + wz * alongMm;
  const c10x = basis.p0.x + wx * (alongMm + widthMm);
  const c10z = basis.p0.z + wz * (alongMm + widthMm);
  const minCornerX = Math.round(Math.min(c00x, c10x, c00x + nx * depthMm, c10x + nx * depthMm));
  const minCornerZ = Math.round(Math.min(c00z, c10z, c00z + nz * depthMm, c10z + nz * depthMm));

  // For orthogonal walls (0°, 90°, 180°, 270°), minCornerX/Z is exact to 0.0mm
  const isOrtho = Math.abs(wx) < 1e-4 || Math.abs(wz) < 1e-4;
  return {
    x: isOrtho ? minCornerX : pos.x,
    z: isOrtho ? minCornerZ : pos.z,
    rotationYDeg: basis.moduleRotationYDeg,
  };
}

/**
 * Determines which wall a module currently sits against (`wall.id`).
 */
export function resolveModuleHostWallId(
  project: DesignProject,
  mod?: ModuleInstance | null
): string {
  const walls = getEffectiveSpaceWalls(project);
  const fallbackId = walls[0]?.id || "wall_main";
  if (!mod || walls.length <= 1) return fallbackId;
  const roomCenter = computeRoomDynamicCenter(walls);
  const mRot = (((mod.rotation?.y ?? 0) % 360) + 360) % 360;
  const fp = getModuleOrientedFootprint(mod, 0);
  const cx = fp.x + fp.planWidth * 0.5;
  const cz = fp.z + fp.planDepth * 0.5;

  let bestId = fallbackId;
  let bestScore = Infinity;
  for (const w of walls) {
    const b = getWallRoomBasis(w, roomCenter);
    const rotDiff = Math.abs(((((mRot - b.moduleRotationYDeg) % 360) + 540) % 360) - 180);
    const perpDist = Math.abs((cx - b.p0.x) * b.inwardNormal.x + (cz - b.p0.z) * b.inwardNormal.z);
    const score = rotDiff * 25 + perpDist;
    if (score < bestScore) {
      bestScore = score;
      bestId = w.id;
    }
  }
  return bestId;
}

/**
 * Multi-Wall + Angled-Wall + Insert-Between Module Placement Solver.
 * Places modules accurately onto ANY wall (`0°`, `90°`, `180°`, `270°`, or angled),
 * automatically clearing perpendicular corner cabinets at the start of return walls!
 */
export function computeMultiWallModuleSnap(
  project: DesignProject,
  templateId: string,
  targetHint?: {
    worldX?: number;
    worldZ?: number;
    wallId?: string;
    insertBetween?: boolean;
  }
): { moduleInstance: ModuleInstance; snap: MultiWallModuleSnapResult } | null {
  const tpl =
    V5_SPECIALIZED_MODULE_TEMPLATES.find((s) => s.templateId === templateId) ||
    getV4TemplateById(templateId) ||
    WARDROBE_TEMPLATES.find((w) => w.templateId === templateId) ||
    KITCHEN_TEMPLATES.find((k) => k.templateId === templateId);
  if (!tpl) return null;

  const newMod = tpl.createInstance(`mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const isFreestandingIslandOrTable =
    newMod.carcass.hullShape === "capsule_table" || newMod.category === "kitchen_island";
  if (isFreestandingIslandOrTable && typeof targetHint?.worldX !== "number" && typeof targetHint?.worldZ !== "number") {
    const existingFreeCount = project.modules.filter(
      (m) => m.carcass.hullShape === "capsule_table" || m.category === "kitchen_island"
    ).length;
    newMod.position = {
      x: Math.round(450 + existingFreeCount * 320),
      y: newMod.position.y || 0,
      z: Math.round(1150 + existingFreeCount * 220),
    };
    newMod.rotation = { x: 0, y: 0, z: 0 };
    return {
      moduleInstance: newMod,
      snap: {
        wallId: targetHint?.wallId || project.space.walls?.[0]?.id || "wall_main",
        wallName: "Serbest Oda Alanı",
        position: { ...newMod.position },
        rotationYDeg: 0,
        snapLabel: "Serbest Oda Yerleşimi",
      },
    };
  }
  const isWallCab =
    newMod.category === "kitchen_wall" || newMod.moduleFamilyId === "fam_kitchen_wall";
  const targetY = isWallCab ? 1450 : newMod.position.y || 0;
  const targetTopY = targetY + newMod.dimensions.height;

  const effectiveWalls = getEffectiveSpaceWalls(project);
  const walls: WallDefinition[] =
    effectiveWalls.length > 0
      ? effectiveWalls
      : [
          {
            id: "wall_main",
            name: "Ana Duvar",
            length: 3600,
            height: project.space?.ceilingHeight || 2600,
            thickness: 150,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            elements: [],
          },
        ];

  const roomCenter = computeRoomDynamicCenter(walls);

  // Pick explicit wallId or nearest wall to world cursor `(worldX, worldZ)`
  let chosenWall = walls[0];
  if (targetHint?.wallId) {
    chosenWall = walls.find((w) => w.id === targetHint.wallId) || walls[0];
  } else if (
    typeof targetHint?.worldX === "number" &&
    typeof targetHint?.worldZ === "number" &&
    walls.length > 1
  ) {
    let bestDist = Infinity;
    for (const w of walls) {
      const b = getWallRoomBasis(w, roomCenter);
      const dx = targetHint.worldX - b.p0.x;
      const dz = targetHint.worldZ - b.p0.z;
      const along = Math.max(0, Math.min(w.length, dx * b.rawTangent.x + dz * b.rawTangent.z));
      const projX = b.p0.x + b.rawTangent.x * along;
      const projZ = b.p0.z + b.rawTangent.z * along;
      const dist = Math.hypot(targetHint.worldX - projX, targetHint.worldZ - projZ);
      if (dist < bestDist) {
        bestDist = dist;
        chosenWall = w;
      }
    }
  }

  const basis = getWallRoomBasis(chosenWall, roomCenter);
  const wx = basis.rawTangent.x;
  const wz = basis.rawTangent.z;
  const nx = basis.inwardNormal.x;
  const nz = basis.inwardNormal.z;

  // Project ALL vertically-overlapping modules that lie inside this wall's depth corridor `[0 .. newMod.depth + 40]`
  // onto positive wall-distance `s ∈ [0, wall.length]`, INCLUDING corner/perpendicular cabinets at `s = 0`!
  const occupiedIntervals: { mod: ModuleInstance; alongStart: number; alongEnd: number }[] = [];

  project.modules.forEach((m, idx) => {
    if (m.category === "complementary" || m.category === "kitchen_island") return;
    const mTopY = m.position.y + m.dimensions.height;
    const yOverlaps = m.position.y < targetTopY - 5 && mTopY > targetY + 5;
    if (!yOverlaps) return;

    const fp = getModuleOrientedFootprint(m, idx);
    const corners = [
      { x: fp.x, z: fp.z },
      { x: fp.x + fp.planWidth, z: fp.z },
      { x: fp.x, z: fp.z + fp.planDepth },
      { x: fp.x + fp.planWidth, z: fp.z + fp.planDepth },
    ];
    let minPerp = Infinity;
    let maxPerp = -Infinity;
    let minAlong = Infinity;
    let maxAlong = -Infinity;
    for (const c of corners) {
      const dx = c.x - basis.p0.x;
      const dz = c.z - basis.p0.z;
      const perp = dx * nx + dz * nz;
      const along = dx * wx + dz * wz;
      if (perp < minPerp) minPerp = perp;
      if (perp > maxPerp) maxPerp = perp;
      if (along < minAlong) minAlong = along;
      if (along > maxAlong) maxAlong = along;
    }

    // Does this existing module physically occupy the depth strip in front of `chosenWall`?
    if (maxPerp > 8 && minPerp < newMod.dimensions.depth - 8 && maxAlong > 2) {
      occupiedIntervals.push({
        mod: m,
        alongStart: Math.max(0, Math.round(minAlong)),
        alongEnd: Math.round(maxAlong),
      });
    }
  });

  occupiedIntervals.sort((a, b) => a.alongStart - b.alongStart);

  // Check if wall start (s=0) touches a perpendicular wall and needs a 50mm filler clearance when empty
  const hasPerpWallAtZero = walls.some((other) => {
    if (other.id === chosenWall.id) return false;
    const ob = getWallRoomBasis(other, roomCenter);
    const dot = Math.abs(ob.rawTangent.x * wx + ob.rawTangent.z * wz);
    const distP0 = Math.hypot(other.position.x - basis.p0.x, other.position.z - basis.p0.z);
    return dot < 0.35 && distP0 <= 80;
  });
  const startClearance = !newMod.isCorner && hasPerpWallAtZero ? 50 : 0;

  let chosenAlong =
    occupiedIntervals.length > 0
      ? occupiedIntervals[occupiedIntervals.length - 1].alongEnd
      : startClearance;
  let snapLabel = `${chosenWall.name} • Sıra Sonu (${chosenAlong}mm)`;
  let insertBetweenShift: MultiWallModuleSnapResult["insertBetweenShift"] = undefined;

  if (typeof targetHint?.worldX === "number") {
    const cx = targetHint.worldX;
    const cz = targetHint.worldZ ?? 0;
    const cursorAlong = Math.max(
      0,
      Math.round((cx - basis.p0.x) * wx + (cz - basis.p0.z) * wz - newMod.dimensions.width * 0.5)
    );

    const candidates: number[] = [startClearance];
    for (const item of occupiedIntervals) {
      candidates.push(item.alongEnd);
      if (item.alongStart - newMod.dimensions.width >= 0) {
        candidates.push(item.alongStart - newMod.dimensions.width);
      }
    }
    const freeCands = candidates.filter(
      (c) =>
        c >= 0 &&
        !occupiedIntervals.some(
          (s) => c < s.alongEnd - 2 && c + newMod.dimensions.width > s.alongStart + 2
        )
    );
    if (freeCands.length > 0) {
      chosenAlong = freeCands.reduce((best, cur) =>
        Math.abs(cur - cursorAlong) < Math.abs(best - cursorAlong) ? cur : best
      );
      snapLabel = `${chosenWall.name} • Mıknatıs Hiza (${chosenAlong}mm)`;
    }
  }

  const placed = wallIntervalToModulePosition(
    chosenWall,
    chosenAlong,
    newMod.dimensions.width,
    newMod.dimensions.depth,
    roomCenter
  );

  // L-köşe modülün iki kapalı sırtı zaten x=0 (Sol Duvar) ve z=0 (Ana Duvar) eksenlerindedir;
  // Sol Duvar seçiliyken (90°) eklense bile 0° oturmalı ki açık L ağzı duvara değil odaya (+X, +Z) baksın!
  const finalRotY =
    newMod.isCorner && Math.round(placed.rotationYDeg) === 90
      ? 0
      : placed.rotationYDeg;

  newMod.position = { x: placed.x, y: targetY, z: placed.z };
  newMod.rotation = { x: 0, y: finalRotY, z: 0 };

  return {
    moduleInstance: newMod,
    snap: {
      wallId: chosenWall.id,
      wallName: chosenWall.name,
      position: { ...newMod.position },
      rotationYDeg: finalRotY,
      insertBetweenShift,
      snapLabel,
    },
  };
}

/**
 * BVH-style Surface & Anchor Resolver for placing `SceneObjectInstance` items onto any wall or floor.
 */
export function solveSceneObjectPlacementSnap(
  project: DesignProject,
  catalogIdOrObj: string | SceneObjectInstance,
  cursorWorld?: { x?: number; z?: number; wallId?: string }
): { object: SceneObjectInstance; snapSummary: string } | null {
  const baseObj =
    typeof catalogIdOrObj === "string"
      ? createSceneObjectInstanceFromCatalog(catalogIdOrObj)
      : structuredClone(catalogIdOrObj);
  if (!baseObj) return null;

  const ceilH = project.space?.ceilingHeight || 2600;
  const cx = cursorWorld?.x;
  const cz = cursorWorld?.z;
  const effectiveWalls = getEffectiveSpaceWalls(project);
  const walls: WallDefinition[] =
    effectiveWalls.length > 0
      ? effectiveWalls
      : [
          {
            id: "wall_main",
            name: "Ana Duvar",
            length: 3600,
            height: ceilH,
            thickness: 150,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            elements: [],
          },
        ];
  const roomCenter = computeRoomDynamicCenter(walls);

  // 1. Countertop-mounted cutouts & tabletop appliances
  if (baseObj.anchorMode === "countertop_cutout" || baseObj.visualKind === "espresso_machine") {
    const baseCabs = project.modules.filter(
      (m) => m.category === "kitchen_base" || m.category === "kitchen_island" || m.dimensions.height <= 1000
    );
    if (baseCabs.length > 0) {
      let host = baseCabs[0];
      if (typeof cx === "number") {
        host = baseCabs.reduce((best, cur) => {
          const dCur = Math.hypot(
            cur.position.x + cur.dimensions.width / 2 - cx,
            cur.position.z + cur.dimensions.depth / 2 - (cz ?? 0)
          );
          const dBest = Math.hypot(
            best.position.x + best.dimensions.width / 2 - cx,
            best.position.z + best.dimensions.depth / 2 - (cz ?? 0)
          );
          return dCur < dBest ? cur : best;
        }, baseCabs[0]);
      } else if (cursorWorld?.wallId) {
        const onSelectedWall = baseCabs.find((m) => resolveModuleHostWallId(project, m) === cursorWorld.wallId);
        if (onSelectedWall) host = onSelectedWall;
      }
      const topY = host.position.y + host.dimensions.height + 30;
      baseObj.hostModuleId = host.id;
      baseObj.position = {
        x: Math.round(host.position.x + (host.dimensions.width - baseObj.dimensions.width) / 2),
        y: topY,
        z: Math.round(host.position.z + (host.dimensions.depth - baseObj.dimensions.depth) / 2),
      };
      baseObj.rotation = host.rotation ? { ...host.rotation } : { x: 0, y: 0, z: 0 };
      return {
        object: baseObj,
        snapSummary: `${host.name} tezgâh üstüne yerleştirildi (Y: ${topY}mm)`,
      };
    }
  }

  // 2. Module cavity built-in appliances (Oven, Microwave)
  if (baseObj.anchorMode === "module_cavity") {
    const hostCand =
      project.modules.find((m) => m.category === "kitchen_tall" && m.dimensions.width >= 580) ||
      project.modules.find((m) => m.category === "kitchen_base" && m.dimensions.width >= 580);
    if (hostCand) {
      const elevY =
        hostCand.category === "kitchen_tall"
          ? baseObj.visualKind === "microwave_builtin"
            ? 1466
            : 856
          : (hostCand.carcass.plinthHeight || 100) + 18;
      const frontBezelCompensationMm = 54; // 18mm door front + ~36mm protruding handle inside GLB bbox
      baseObj.hostModuleId = hostCand.id;
      baseObj.position = {
        x: Math.round(hostCand.position.x + (hostCand.dimensions.width - baseObj.dimensions.width) / 2),
        y: elevY,
        z: Math.round(hostCand.position.z + Math.max(10, hostCand.dimensions.depth - baseObj.dimensions.depth + frontBezelCompensationMm)),
      };
      baseObj.rotation = hostCand.rotation ? { ...hostCand.rotation } : { x: 0, y: 0, z: 0 };
      return {
        object: baseObj,
        snapSummary: `${hostCand.name} ankastre nişine oturtuldu (Y: ${elevY}mm)`,
      };
    }
  }

  // 3. Ceiling-mounted fixtures
  if (baseObj.anchorMode === "ceiling") {
    const island = project.modules.find((m) => m.category === "kitchen_island");
    const px =
      typeof cx === "number"
        ? Math.round(cx / 50) * 50
        : island
        ? Math.round(island.position.x + (island.dimensions.width - baseObj.dimensions.width) / 2)
        : 900;
    const pz =
      typeof cz === "number"
        ? Math.round(cz / 50) * 50
        : island
        ? Math.round(island.position.z + (island.dimensions.depth - baseObj.dimensions.depth) / 2)
        : 1400;
    const py = Math.max(1450, ceilH - baseObj.dimensions.height);
    baseObj.position = { x: px, y: py, z: pz };
    return {
      object: baseObj,
      snapSummary: `Tavan kotuna (${ceilH}mm) askılı olarak hizalandı`,
    };
  }

  // 4. Wall-base & Wall-elevated objects (Fridges, Dishwashers, Washers, Wall TVs, Doors, Windows, Radiators)
  if (baseObj.anchorMode === "wall_base" || baseObj.anchorMode === "wall_elevated") {
    let targetWall = walls[0];
    if (cursorWorld?.wallId) {
      targetWall = walls.find((w) => w.id === cursorWorld.wallId) || walls[0];
    } else if (typeof cx === "number" && typeof cz === "number" && walls.length > 1) {
      let bestD = Infinity;
      for (const w of walls) {
        const b = getWallRoomBasis(w, roomCenter);
        const along = Math.max(
          0,
          Math.min(w.length, (cx - b.p0.x) * b.rawTangent.x + (cz - b.p0.z) * b.rawTangent.z)
        );
        const pxProj = b.p0.x + b.rawTangent.x * along;
        const pzProj = b.p0.z + b.rawTangent.z * along;
        const d = Math.hypot(cx - pxProj, cz - pzProj);
        if (d < bestD) {
          bestD = d;
          targetWall = w;
        }
      }
    }
    const basis = getWallRoomBasis(targetWall, roomCenter);
    const wx = basis.rawTangent.x;
    const wz = basis.rawTangent.z;
    const nx = basis.inwardNormal.x;
    const nz = basis.inwardNormal.z;

    let maxAlong = 0;
    project.modules.forEach((m, idx) => {
      if (m.category === "complementary" || m.category === "kitchen_island") return;
      const fp = getModuleOrientedFootprint(m, idx);
      const corners = [
        { x: fp.x, z: fp.z },
        { x: fp.x + fp.planWidth, z: fp.z },
        { x: fp.x, z: fp.z + fp.planDepth },
        { x: fp.x + fp.planWidth, z: fp.z + fp.planDepth },
      ];
      let minPerp = Infinity;
      let maxPerp = -Infinity;
      let mMaxAlong = -Infinity;
      for (const c of corners) {
        const perp = (c.x - basis.p0.x) * nx + (c.z - basis.p0.z) * nz;
        const al = (c.x - basis.p0.x) * wx + (c.z - basis.p0.z) * wz;
        if (perp < minPerp) minPerp = perp;
        if (perp > maxPerp) maxPerp = perp;
        if (al > mMaxAlong) mMaxAlong = al;
      }
      if (maxPerp > 8 && minPerp < baseObj.dimensions.depth + 40 && mMaxAlong > maxAlong) {
        maxAlong = Math.round(mMaxAlong);
      }
    });

    (project.sceneObjects || []).forEach((so) => {
      const perp = (so.position.x - basis.p0.x) * nx + (so.position.z - basis.p0.z) * nz;
      if (perp >= -40 && perp < baseObj.dimensions.depth + 80) {
        const al =
          (so.position.x - basis.p0.x) * wx +
          (so.position.z - basis.p0.z) * wz +
          so.dimensions.width;
        if (al > maxAlong) maxAlong = Math.round(al);
      }
    });

    let chosenAlong =
      baseObj.anchorMode === "wall_base"
        ? maxAlong > 0
          ? maxAlong + 20
          : 50
        : Math.max(200, Math.round((targetWall.length || 3600) * 0.45 - baseObj.dimensions.width / 2));
    if (typeof cx === "number") {
      const rawAlong =
        (cx - basis.p0.x) * wx + ((cz ?? 0) - basis.p0.z) * wz - baseObj.dimensions.width / 2;
      chosenAlong = Math.max(0, Math.round(rawAlong / 50) * 50);
    }

    const placed = wallIntervalToModulePosition(
      targetWall,
      chosenAlong,
      baseObj.dimensions.width,
      baseObj.dimensions.depth,
      roomCenter
    );
    const py = baseObj.anchorMode === "wall_elevated" ? baseObj.position.y || 1100 : 0;
    baseObj.position = { x: placed.x, y: py, z: placed.z };
    baseObj.rotation = { x: 0, y: placed.rotationYDeg, z: 0 };
    return {
      object: baseObj,
      snapSummary: `${targetWall.name} üzerine yerleştirildi (Y: ${py}mm)`,
    };
  }

  // 5. Free-floor furniture & decor
  const existingFreeCount = (project.sceneObjects || []).filter(
    (o) => o.anchorMode === "free_floor"
  ).length;
  const fx =
    typeof cx === "number"
      ? Math.round((cx - baseObj.dimensions.width / 2) / 50) * 50
      : 450 + (existingFreeCount % 3) * 650;
  const fz =
    typeof cz === "number"
      ? Math.max(200, Math.round((cz - baseObj.dimensions.depth / 2) / 50) * 50)
      : 1450 + Math.floor(existingFreeCount / 3) * 750;

  baseObj.position = { x: fx, y: 0, z: fz };
  return {
    object: baseObj,
    snapSummary: `Mekân zeminine yerleştirildi (X: ${fx}mm, Z: ${fz}mm)`,
  };
}
