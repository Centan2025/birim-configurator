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
  KITCHEN_TEMPLATES,
  WARDROBE_TEMPLATES,
} from "@birim/catalog";
import { getWallRoomBasis, originToModulePosition } from "./angledWallSnapEngine";

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

/**
 * Multi-Wall + Angled-Wall + Insert-Between Module Placement Solver.
 * Supports placing or dragging a module onto ANY wall (`0°`, `90°`, `180°`, `270°`, `45°`, etc.)
 * and optionally inserting between two existing cabinets by shifting downstream neighbors cleanly!
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
    getV4TemplateById(templateId) ||
    WARDROBE_TEMPLATES.find((w) => w.templateId === templateId) ||
    KITCHEN_TEMPLATES.find((k) => k.templateId === templateId);
  if (!tpl) return null;

  const newMod = tpl.createInstance(`mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const isWallCab =
    newMod.category === "kitchen_wall" || newMod.moduleFamilyId === "fam_kitchen_wall";
  const targetY = isWallCab ? 1450 : newMod.position.y || 0;

  const walls: WallDefinition[] =
    project.space.walls && project.space.walls.length > 0
      ? project.space.walls
      : [
          {
            id: "wall_main",
            name: "Ana Duvar",
            length: 3600,
            height: project.space.ceilingHeight || 2600,
            thickness: 150,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            elements: [],
          },
        ];

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
      const b = getWallRoomBasis(w);
      const dx = targetHint.worldX - b.p0.x;
      const dz = targetHint.worldZ - b.p0.z;
      const along = Math.max(0, Math.min(w.length, dx * b.moduleTangent.x + dz * b.moduleTangent.z));
      const projX = b.p0.x + b.moduleTangent.x * along;
      const projZ = b.p0.z + b.moduleTangent.z * along;
      const dist = Math.hypot(targetHint.worldX - projX, targetHint.worldZ - projZ);
      if (dist < bestDist) {
        bestDist = dist;
        chosenWall = w;
      }
    }
  }

  const basis = getWallRoomBasis(chosenWall);
  const sameWallMods = project.modules
    .filter((m) => {
      if (m.category === "complementary" || m.category === "kitchen_island") return false;
      const mWall = m.category === "kitchen_wall" || m.moduleFamilyId === "fam_kitchen_wall";
      if (mWall !== isWallCab) return false;
      const mRot = (((m.rotation?.y ?? 0) % 360) + 360) % 360;
      const diff = Math.abs(((((mRot - basis.moduleRotationYDeg) % 360) + 540) % 360) - 180);
      return diff <= 20;
    })
    .map((m) => {
      const dx = m.position.x - basis.p0.x;
      const dz = m.position.z - basis.p0.z;
      const along = Math.round(dx * basis.moduleTangent.x + dz * basis.moduleTangent.z);
      return { mod: m, alongStart: along, alongEnd: along + m.dimensions.width };
    })
    .sort((a, b) => a.alongStart - b.alongStart);

  let chosenAlong =
    sameWallMods.length > 0 ? sameWallMods[sameWallMods.length - 1].alongEnd : 0;
  let snapLabel = `${chosenWall.name} • Sıra Sonu (${chosenAlong}mm)`;
  let insertBetweenShift: MultiWallModuleSnapResult["insertBetweenShift"] = undefined;

  if (typeof targetHint?.worldX === "number") {
    const wx = targetHint.worldX;
    const wz = targetHint.worldZ ?? 0;
    const cursorAlong = Math.max(
      0,
      Math.round(
        (wx - basis.p0.x) * basis.moduleTangent.x +
          (wz - basis.p0.z) * basis.moduleTangent.z
      )
    );

    if (targetHint.insertBetween && sameWallMods.length > 0) {
      // Find nearest joint between cabinets and shift subsequent cabinets along wall!
      let nearestSeam = sameWallMods[0].alongStart;
      let minSeamDist = Math.abs(cursorAlong - nearestSeam);
      for (const item of sameWallMods) {
        for (const seam of [item.alongStart, item.alongEnd]) {
          const d = Math.abs(cursorAlong - seam);
          if (d < minSeamDist) {
            minSeamDist = d;
            nearestSeam = seam;
          }
        }
      }
      chosenAlong = nearestSeam;
      insertBetweenShift = {
        wallId: chosenWall.id,
        fromAlongMm: nearestSeam,
        shiftDeltaMm: newMod.dimensions.width,
      };
      snapLabel = `${chosenWall.name} • Araya Ekle & Kaydır (${chosenAlong}mm)`;
    } else {
      // Find nearest non-overlapping neighbor edge along this wall
      const candidates: number[] = [0];
      for (const item of sameWallMods) {
        candidates.push(item.alongEnd);
        if (item.alongStart - newMod.dimensions.width >= 0) {
          candidates.push(item.alongStart - newMod.dimensions.width);
        }
      }
      const freeCands = candidates.filter(
        (c) =>
          c >= 0 &&
          !sameWallMods.some(
            (s) => c < s.alongEnd - 2 && c + newMod.dimensions.width > s.alongStart + 2
          )
      );
      if (freeCands.length > 0) {
        chosenAlong = freeCands.reduce((best, cur) =>
          Math.abs(cur - cursorAlong) < Math.abs(best - cursorAlong) ? cur : best
        );
        snapLabel = `${chosenWall.name} • Mıknatıs Snap (${chosenAlong}mm)`;
      }
    }
  }

  const originX = basis.p0.x + basis.moduleTangent.x * chosenAlong;
  const originZ = basis.p0.z + basis.moduleTangent.z * chosenAlong;
  const worldPos = originToModulePosition(
    newMod.dimensions.width,
    newMod.dimensions.depth,
    basis.moduleRotationYDeg,
    originX,
    originZ
  );

  newMod.position = { x: worldPos.x, y: targetY, z: worldPos.z };
  newMod.rotation = { x: 0, y: basis.moduleRotationYDeg, z: 0 };

  return {
    moduleInstance: newMod,
    snap: {
      wallId: chosenWall.id,
      wallName: chosenWall.name,
      position: { ...newMod.position },
      rotationYDeg: basis.moduleRotationYDeg,
      insertBetweenShift,
      snapLabel,
    },
  };
}

/**
 * BVH-style Surface & Anchor Resolver for placing `SceneObjectInstance` items onto:
 * - Countertops (`sink`, `cooktop`, `espresso_machine`)
 * - Tall/base oven cavities (`oven_builtin`, `microwave_builtin`)
 * - Walls (`fridge`, `hood`, `wall_tv`, `radiator`, `window`, `door`)
 * - Ceilings (`pendant_linear_led`, `hood_island`)
 * - Free floor (`dining_table`, `sofa`, `chair`, `bar_stool`, `rug`, `plant`)
 */
export function solveSceneObjectPlacementSnap(
  project: DesignProject,
  catalogIdOrObj: string | SceneObjectInstance,
  cursorWorld?: { x: number; z: number }
): { object: SceneObjectInstance; snapSummary: string } | null {
  const baseObj =
    typeof catalogIdOrObj === "string"
      ? createSceneObjectInstanceFromCatalog(catalogIdOrObj)
      : structuredClone(catalogIdOrObj);
  if (!baseObj) return null;

  const ceilH = project.space.ceilingHeight || 2600;
  const cx = cursorWorld?.x;
  const cz = cursorWorld?.z;

  // 1. Countertop-mounted cutouts & tabletop appliances (Sink, Cooktop, Vessel Sink, Espresso Machine)
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
      } else {
        // Prefer sink module for sinks, wide drawer module for cooktops
        const preferred = baseCabs.find((m) =>
          baseObj.visualKind.includes("sink")
            ? m.name.toLowerCase().includes("eviye") || m.name.toLowerCase().includes("evye") || m.name.toLowerCase().includes("banyo")
            : m.dimensions.width >= baseObj.dimensions.width
        );
        if (preferred) host = preferred;
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
        snapSummary: `${host.name} tezgâh üstüne merkezlenerek yerleştirildi (Y: ${topY}mm)`,
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
            ? 1445
            : 840
          : (hostCand.carcass.plinthHeight || 100) + 18;
      baseObj.hostModuleId = hostCand.id;
      baseObj.position = {
        x: Math.round(hostCand.position.x + (hostCand.dimensions.width - baseObj.dimensions.width) / 2),
        y: elevY,
        z: Math.round(hostCand.position.z + Math.max(10, hostCand.dimensions.depth - baseObj.dimensions.depth)),
      };
      baseObj.rotation = hostCand.rotation ? { ...hostCand.rotation } : { x: 0, y: 0, z: 0 };
      return {
        object: baseObj,
        snapSummary: `${hostCand.name} ankastre nişine oturtuldu (Y: ${elevY}mm)`,
      };
    }
  }

  // 3. Ceiling-mounted fixtures (Pendant lights, Island Hood)
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
    const maxRightX = project.modules
      .filter((m) => m.category !== "complementary" && (m.rotation?.y || 0) === 0)
      .reduce((mx, m) => Math.max(mx, m.position.x + m.dimensions.width), 0);
    const px =
      typeof cx === "number"
        ? Math.max(0, Math.round((cx - baseObj.dimensions.width / 2) / 50) * 50)
        : baseObj.anchorMode === "wall_base"
        ? maxRightX + 20
        : Math.max(200, Math.round(maxRightX / 2 - baseObj.dimensions.width / 2));
    const py = baseObj.anchorMode === "wall_elevated" ? baseObj.position.y || 1100 : 0;
    baseObj.position = { x: px, y: py, z: 0 };
    return {
      object: baseObj,
      snapSummary: `Duvar düzlemine mıknatıslandı (X: ${px}mm, Y: ${py}mm)`,
    };
  }

  // 5. Free-floor furniture & decor (Tables, Chairs, Sofas, Rugs, Olive Tree)
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
