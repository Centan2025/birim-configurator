import {
  ModuleInstance,
  calculateBayWidths,
  calculateNetInnerHeight,
  calculateNetInnerDepth,
  calculateFourSpaceDimensions,
  computeModuleIntrinsicSignature,
} from "@birim/core";
import { ComponentGeometry, ModuleGeometryBreakdown } from "./types";
import { moduleGeometryCache } from "./geometry-builders/kinematics-and-math";
import { tryGenerateSpecializedHullGeometry } from "./geometry-builders/specialized-hull-geometry";
import { tryGenerateCornerModuleGeometry } from "./geometry-builders/corner-module-geometry";
import { appendCarcassShellGeometry } from "./geometry-builders/carcass-shell-geometry";
import { appendBaysAndDoorsGeometry } from "./geometry-builders/bays-and-doors-geometry";
import { finalizeHandlesIslandAndHardwareGeometry } from "./geometry-builders/post-carcass-hardware-geometry";

export interface GenerateGeometryOptions {
  doorOpenAngleDeg?: number; // 0 = closed, 90 = open
  drawerOpenMm?: number; // 0 = closed, 350 = pulled out
  explodedFactor?: number; // 0 = normal, 1 = fully exploded
}

export const GEOMETRY_ENGINE_REV = "2026-11-21-r7";

export function generateModuleGeometry(
  module: ModuleInstance,
  options: GenerateGeometryOptions = {}
): ModuleGeometryBreakdown {
  const cacheKey = `${GEOMETRY_ENGINE_REV}|${computeModuleIntrinsicSignature(module)}|${options.doorOpenAngleDeg || 0}:${options.drawerOpenMm || 0}:${options.explodedFactor || 0}`;
  const cached = moduleGeometryCache.get(cacheKey);
  if (cached) return cached;

  const { doorOpenAngleDeg = 0, drawerOpenMm = 0, explodedFactor = 0 } = options;
  const { width, height, depth } = module.dimensions;
  const T = module.carcass.panelThickness;

  const specialized = tryGenerateSpecializedHullGeometry({
    module,
    cacheKey,
    doorOpenAngleDeg,
    drawerOpenMm,
  });
  if (specialized) return specialized;

  const components: ComponentGeometry[] = [];
  const fourSpace = calculateFourSpaceDimensions(module);
  const bayWidths = calculateBayWidths(module);
  const netInnerH = calculateNetInnerHeight(module);
  const netInnerD = calculateNetInnerDepth(module);

  // Exploded offsets
  const explodeX = explodedFactor > 0 ? explodedFactor * 250 : 0;
  const explodeY = explodedFactor > 0 ? explodedFactor * 200 : 0;
  const explodeZ = explodedFactor > 0 ? explodedFactor * 300 : 0;

  const innerSpanW = width - 2 * T;
  const tplLowerCheck = (module.templateId || "").toLowerCase();
  const nameLowerCheck = (module.name || "").toLowerCase();
  const isWardrobe =
    !module.category ||
    module.category.startsWith("wardrobe") ||
    module.category === "special_corner" ||
    module.moduleFamilyId === "fam_wardrobe" ||
    module.moduleFamilyId === "fam_special_corner" ||
    Boolean(module.templateId?.startsWith("tpl_wd_")) ||
    Boolean(module.templateId?.startsWith("tpl_wardrobe")) ||
    Boolean(module.templateId?.startsWith("tpl_sc_")) ||
    (Boolean(module.isCorner) && height >= 1400);

  const isWallCornerCandidate =
    module.category === "kitchen_wall" || module.moduleFamilyId === "fam_kitchen_wall";
  const minCornerDimMm = isWallCornerCandidate ? 500 : 600;

  const isDiagonalCorner =
    Boolean(module.isCorner) &&
    (tplLowerCheck.includes("diagonal") ||
      nameLowerCheck.includes("diyagonal") ||
      nameLowerCheck.includes("45°")) &&
    width >= minCornerDimMm &&
    depth >= minCornerDimMm;

  const isTrueLCorner =
    Boolean(module.isCorner) &&
    !isDiagonalCorner &&
    !tplLowerCheck.includes("blind") &&
    !tplLowerCheck.includes("outer_corner") &&
    !nameLowerCheck.includes("kör") &&
    !nameLowerCheck.includes("dış köşe") &&
    width >= minCornerDimMm &&
    depth >= minCornerDimMm;


  const cornerResult = tryGenerateCornerModuleGeometry({
    module,
    cacheKey,
    isTrueLCorner,
    isDiagonalCorner,
    isWardrobe,
    doorOpenAngleDeg,
    drawerOpenMm,
  });
  if (cornerResult) return cornerResult;

  const { effBackType, isSinkBase, lowerName } = appendCarcassShellGeometry({
    module,
    components,
    bayWidths,
    netInnerH,
    netInnerD,
    innerSpanW,
    isWardrobe,
    drawerOpenMm,
    explodeX,
    explodeY,
    explodeZ,
  });

  const frontCarcassMetaMap = appendBaysAndDoorsGeometry({
    module,
    components,
    fourSpace,
    bayWidths,
    netInnerH,
    netInnerD,
    innerSpanW,
    isWardrobe,
    effBackType,
    isSinkBase,
    lowerName,
    doorOpenAngleDeg,
    drawerOpenMm,
    explodeZ,
  });

  const finalComponents = finalizeHandlesIslandAndHardwareGeometry({
    module,
    components,
    fourSpace,
    bayWidths,
    frontCarcassMetaMap,
  });

  const result: ModuleGeometryBreakdown = {
    moduleId: module.id,
    overall: module.dimensions,
    components: finalComponents,
    bayWidths,
    netInnerHeight: netInnerH,
    netInnerDepth: netInnerD,
  };
  moduleGeometryCache.set(cacheKey, result);
  return result;
}
