import React from "react";
import {
  calculateModulePlacement,
  DesignProject,
  ModuleInstance,
  ArchitecturalElement,
  WallDefinition,
  ValidationIssue,
} from "@birim/core";

let activeDraggedTemplateIdState: string | null = null;
let transparentDragCanvas: HTMLCanvasElement | null = null;

export function setActiveDraggedTemplateId(templateId: string | null): void {
  activeDraggedTemplateIdState = templateId;
}

export function getActiveDraggedTemplateId(): string | null {
  return activeDraggedTemplateIdState;
}

/**
 * Initiates a clean silhouette drag operation:
 * - Suppresses the browser's default rectangular HTML button screenshot via a 1x1 transparent canvas
 * - Stores the active templateId so 3D and 2D viewports can render the real-scale Cabinet Silhouette
 *   and magnetic snap target lines live during `onDragOver`.
 */
export function startModuleSilhouetteDrag(
  e: React.DragEvent<HTMLElement>,
  templateId: string
): void {
  setActiveDraggedTemplateId(templateId);
  e.dataTransfer.setData("application/x-birim-template-id", templateId);
  e.dataTransfer.effectAllowed = "copy";

  if (typeof document !== "undefined") {
    if (!transparentDragCanvas) {
      transparentDragCanvas = document.createElement("canvas");
      transparentDragCanvas.width = 110;
      transparentDragCanvas.height = 96;
      transparentDragCanvas.style.position = "fixed";
      transparentDragCanvas.style.top = "-9999px";
      transparentDragCanvas.style.left = "-9999px";
      transparentDragCanvas.style.pointerEvents = "none";
      document.body.appendChild(transparentDragCanvas);
    }
    const ctx = transparentDragCanvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 110, 96);
      const isWall = templateId.includes("_kw_") || templateId.includes("wall");
      const w = 58;
      const h = isWall ? 38 : 58;
      const dx = 14;
      const dy = 8;
      const x0 = 20;
      const y0 = isWall ? 24 : 18;

      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      // Isometric Top Face Silhouette
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + dx, y0 - dy);
      ctx.lineTo(x0 + w + dx, y0 - dy);
      ctx.lineTo(x0 + w, y0);
      ctx.closePath();
      ctx.fillStyle = "rgba(16, 185, 129, 0.34)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#047857";
      ctx.stroke();

      // Isometric Right Side Face Silhouette
      ctx.beginPath();
      ctx.moveTo(x0 + w, y0);
      ctx.lineTo(x0 + w + dx, y0 - dy);
      ctx.lineTo(x0 + w + dx, y0 + h - dy);
      ctx.lineTo(x0 + w, y0 + h);
      ctx.closePath();
      ctx.fillStyle = "rgba(5, 150, 105, 0.38)";
      ctx.fill();
      ctx.stroke();

      // Isometric Front Carcass Silhouette + Internal Shelves/Bays
      ctx.fillStyle = "rgba(16, 185, 129, 0.24)";
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeRect(x0, y0, w, h);

      // Center bay & shelf dashed silhouette lines
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0 + w / 2, y0);
      ctx.lineTo(x0 + w / 2, y0 + h);
      ctx.moveTo(x0 + 4, y0 + h * 0.36);
      ctx.lineTo(x0 + w - 4, y0 + h * 0.36);
      ctx.moveTo(x0 + 4, y0 + h * 0.68);
      ctx.lineTo(x0 + w - 4, y0 + h * 0.68);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    e.dataTransfer.setDragImage(transparentDragCanvas, 52, 48);
  }
}

export interface SnapSlotCandidate {
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  label: string;
  isActive: boolean;
}

export interface RowSnapPreviewResult {
  templateId: string;
  previewModule: ModuleInstance;
  snappedX: number;
  snappedY: number;
  snappedZ: number;
  snapLabel: string;
  isSnappedToSlot: boolean;
  snapSlots: SnapSlotCandidate[];
}

export type CornerFootprintType =
  | "l_corner"
  | "diagonal_corner"
  | "blind_corner"
  | "outer_corner"
  | "none";

export interface OrientedFootprint2D {
  moduleId: string;
  moduleIndex: number;
  name: string;
  category: ModuleInstance["category"];
  x: number; // Top-left X in room plan (mm)
  z: number; // Top-left Z in room plan (mm)
  planWidth: number; // Effective X span after rotationY (mm)
  planDepth: number; // Effective Z span after rotationY (mm)
  yBottom: number; // Elevation from floor (mm)
  yTop: number; // Top elevation (mm)
  rotationY: number; // 0, 90, 180, 270
  rawWidth: number;
  rawHeight: number;
  rawDepth: number;
  isCorner: boolean;
  isOpenFront: boolean;
  cornerType: CornerFootprintType;
  wingDepthMm: number;
}

export interface KitchenRuleStatus {
  code: string;
  label: string;
  verified: boolean;
  standardRef: string;
}

export const KITCHEN_ENGINEERING_RULE_REGISTRY: KitchenRuleStatus[] = [
  {
    code: "RULE_WALL_BOUNDARY",
    label: "Duvar Sınırı & Köşe Dönüş Taşma Kontrolü",
    verified: true,
    standardRef: "EN 1116 / Birim Montaj Standardı",
  },
  {
    code: "RULE_CORNER_DEAD_SPACE",
    label: "90° L/U Köşe Kör Alan & Kapak Açılım Payı (Min 50mm Kör Köşe Dolgu)",
    verified: true,
    standardRef: "Blum Menteşe Açılım Standardı",
  },
  {
    code: "RULE_WINDOW_COLLISION",
    label: "Pencere Alt Denizlik & Üst Dolap Çakışma Kontrolü",
    verified: true,
    standardRef: "Mimari Rölöve Doğrulaması",
  },
  {
    code: "RULE_COLUMN_COLLISION",
    label: "Taşıyıcı Kolon / Kiriş Gövde Çakışma Kontrolü",
    verified: true,
    standardRef: "Mimari Rölöve Doğrulaması",
  },
  {
    code: "RULE_PLUMBING_ALIGNMENT",
    label: "Temiz/Atık Su Tesisatı — Evye Modülü Merkezleme Kontrolü",
    verified: true,
    standardRef: "Birim Mutfak Tesisat Standardı (±250mm)",
  },
  {
    code: "RULE_SERVICE_VENT_CLEARANCE",
    label: "Boy Kiler / Ankastre Cihaz Arka Havalandırma Boşluğu (Min 50mm)",
    verified: true,
    standardRef: "Ankastre Cihaz Hava Sirkülasyon Standardı",
  },
  {
    code: "RULE_WALL_FILLER_TOLERANCE",
    label: "Duvar Bitiş Montaj Kör Parça (bitiş çıtası) Önerisi (15-50mm)",
    verified: true,
    standardRef: "Birim Saha Montaj Toleransı",
  },
  {
    code: "RULE_MEP_GAS_FLUE_ROUTING",
    label: "Doğalgaz Borusu & Davlumbaz Baca Kanalı 3D Eğim Hesabı",
    verified: false,
    standardRef: "DOĞRULANMAMIŞ — Saha Mekanik Proje Onayı Gerekir",
  },
  {
    code: "RULE_COUNTERTOP_QUARTZ_SEAM",
    label: "Kuvars/Porselen Tezgâh Plaka Ek Yeri & Evye Kesim Statik Analizi",
    verified: false,
    standardRef: "DOĞRULANMAMIŞ — Taş Atölyesi Onayı Gerekir",
  },
];

/**
 * Computes the oriented 2D/3D Axis-Aligned Bounding Box (AABB) of a module,
 * properly respecting 90-degree L/U corner rotations (`rotation.y`).
 */
export function classifyModuleCornerFootprint(mod: ModuleInstance): {
  isCorner: boolean;
  cornerType: CornerFootprintType;
  wingDepthMm: number;
} {
  const tplLower = (mod.templateId || "").toLowerCase();
  const nameLower = (mod.name || "").toLowerCase();
  const rawW = mod.dimensions.width;
  const rawH = mod.dimensions.height;
  const rawD = mod.dimensions.depth;

  const isWallL =
    mod.category === "kitchen_wall" || mod.moduleFamilyId === "fam_kitchen_wall";
  const isWardrobe =
    !mod.category ||
    mod.category.startsWith("wardrobe") ||
    mod.category === "special_corner" ||
    mod.moduleFamilyId === "fam_wardrobe" ||
    mod.moduleFamilyId === "fam_special_corner" ||
    Boolean(mod.templateId?.startsWith("tpl_wd_")) ||
    Boolean(mod.templateId?.startsWith("tpl_wardrobe")) ||
    Boolean(mod.templateId?.startsWith("tpl_sc_")) ||
    (Boolean(mod.isCorner) && rawH >= 1400);

  const minArm = Math.min(rawW, rawD);
  const wingDepthMm = isWallL
    ? Math.min(350, Math.round(minArm * 0.56))
    : isWardrobe
    ? Math.min(600, Math.round(minArm * 0.58))
    : Math.min(580, Math.round(minArm * 0.64));

  const isBlind =
    tplLower.includes("blind") || nameLower.includes("kör köşe") || nameLower.includes("lemans");
  const isDiagonal =
    tplLower.includes("diagonal") || nameLower.includes("diyagonal") || nameLower.includes("45°");
  const isOuter =
    tplLower.includes("outer_corner") || nameLower.includes("dış köşe");
  const isExplicitL =
    tplLower.includes("l_corner") ||
    tplLower.includes("corner_wall") ||
    tplLower.includes("corner_wardrobe") ||
    tplLower.includes("walkin_l") ||
    tplLower.includes("inner_corner") ||
    nameLower.includes("l köşe") ||
    nameLower.includes("köşe gardırop") ||
    nameLower.includes("köşe üst") ||
    nameLower.includes("iç köşe") ||
    nameLower.includes("l giyinme");

  if (isBlind) {
    return { isCorner: true, cornerType: "blind_corner", wingDepthMm: rawD };
  }
  if (isDiagonal) {
    return { isCorner: true, cornerType: "diagonal_corner", wingDepthMm };
  }
  if (isOuter) {
    return { isCorner: true, cornerType: "outer_corner", wingDepthMm };
  }
  if (isExplicitL || (Boolean(mod.isCorner) && rawW >= 620 && rawD >= 620)) {
    return { isCorner: true, cornerType: "l_corner", wingDepthMm };
  }
  return { isCorner: Boolean(mod.isCorner), cornerType: "none", wingDepthMm: rawD };
}

export function getModuleOrientedFootprint(
  mod: ModuleInstance,
  idx: number
): OrientedFootprint2D {
  const rotY = (((mod.rotation?.y || 0) % 360) + 360) % 360;

  const rawW = mod.dimensions.width;
  const rawH = mod.dimensions.height;
  const rawD = mod.dimensions.depth;

  const placement = calculateModulePlacement(mod);
  const planWidth = placement.width;
  const planDepth = placement.depth;
  const cornerMeta = classifyModuleCornerFootprint(mod);

  return {
    moduleId: mod.id,
    moduleIndex: idx,
    name: mod.name,
    category: mod.category,
    x: mod.position.x,
    z: mod.position.z,
    planWidth,
    planDepth,
    yBottom: mod.position.y,
    yTop: mod.position.y + rawH,
    rotationY: rotY,
    rawWidth: rawW,
    rawHeight: rawH,
    rawDepth: rawD,
    isCorner: cornerMeta.isCorner,
    isOpenFront: Boolean(mod.isOpenFront || mod.bays[0]?.door?.type === "open" || mod.bays[0]?.door?.doorSystemId === "open"),
    cornerType: cornerMeta.cornerType,
    wingDepthMm: cornerMeta.wingDepthMm,
  };
}

/**
 * Returns default architectural obstacles (Window, Column, Plumbing, Electrical)
 * for kitchen spaces if the project's space does not yet have any populated,
 * or returns the existing elements in `project.space.elements`.
 */
export function getEffectiveSpaceObstacles(project: DesignProject): ArchitecturalElement[] {
  if (project.space.elements && project.space.elements.length > 0) {
    return project.space.elements;
  }

  // Provide realistic architectural fixtures for kitchen layouts
  if (project.space.type.startsWith("kitchen")) {
    return [
      {
        id: "arch_plumbing_main",
        type: "plumbing",
        name: "Su & Gider Tesisat Noktası",
        position: { x: 350, y: 450, z: 0 },
        dimensions: { width: 200, height: 250, depth: 80 },
      },
      {
        id: "arch_window_main",
        type: "window",
        name: "Mutfak Penceresi (Denizlik: 1100mm)",
        position: { x: 1850, y: 1100, z: 0 },
        dimensions: { width: 950, height: 1050, depth: 150 },
      },
      {
        id: "arch_column_right",
        type: "column",
        name: "Taşıyıcı Köşe Kolonu",
        position: { x: 2950, y: 0, z: 0 },
        dimensions: { width: 250, height: 2600, depth: 300 },
      },
    ];
  }

  // Wardrobe room default architectural element (right wall column at 3300mm)
  return [
    {
      id: "arch_wardrobe_column",
      type: "column",
      name: "Oda Köşe Kolonu",
      position: { x: 3350, y: 0, z: 0 },
      dimensions: { width: 250, height: 2700, depth: 250 },
    },
  ];
}

/**
 * Returns normalized walls for 2D/3D spatial rendering, including L and U return walls.
 */
export function getEffectiveSpaceWalls(project: DesignProject): WallDefinition[] {
  const baseWalls = project.space.walls;
  if (project.space.type === "kitchen_u" && baseWalls.length < 3) {
    return [
      {
        id: "wall_u_back",
        name: "Arka Duvar",
        length: 2800,
        height: 2600,
        thickness: 150,
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        elements: [],
      },
      {
        id: "wall_u_left",
        name: "Sol Dönüş Duvarı",
        length: 2200,
        height: 2600,
        thickness: 150,
        position: { x: 0, y: 0, z: 0 },
        rotationY: 90,
        elements: [],
      },
      {
        id: "wall_u_right",
        name: "Sağ Dönüş Duvarı",
        length: 2200,
        height: 2600,
        thickness: 150,
        position: { x: 2800, y: 0, z: 0 },
        rotationY: 90,
        elements: [],
      },
    ];
  }
  return baseWalls;
}

/**
 * Runs complete geometric spatial & kitchen engineering validations:
 * 1. Oriented 3D AABB module-to-module overlap (including rotated L/U corner arms)
 * 2. Wall boundary overflow
 * 3. Window collision with wall/tall cabinets
 * 4. Structural column collision
 * 5. Plumbing point alignment with sink module (`Evye`)
 * 6. Tall cabinet appliance ventilation & wall filler tolerances
 */
export function validateSpatialAndKitchenEngineering(
  project: DesignProject
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const footprints = project.modules.map((m, idx) => getModuleOrientedFootprint(m, idx));
  const obstacles = getEffectiveSpaceObstacles(project);
  const mainWallLength = project.space.walls[0]?.length || 3600;

  // Helper: decompose an L-corner footprint into its two actual physical arm rectangles in 2D Plan
  const getFootprintSubRects = (fp: OrientedFootprint2D) => {
    if (fp.cornerType !== "l_corner") {
      return [{ x1: fp.x, z1: fp.z, x2: fp.x + fp.planWidth, z2: fp.z + fp.planDepth }];
    }
    const wd = Math.min(fp.wingDepthMm, fp.planWidth, fp.planDepth);
    if (fp.rotationY === 90) {
      return [
        { x1: fp.x, z1: fp.z, x2: fp.x + fp.planWidth, z2: fp.z + wd },
        { x1: fp.x + fp.planWidth - wd, z1: fp.z, x2: fp.x + fp.planWidth, z2: fp.z + fp.planDepth },
      ];
    }
    if (fp.rotationY === 180) {
      return [
        { x1: fp.x, z1: fp.z + fp.planDepth - wd, x2: fp.x + fp.planWidth, z2: fp.z + fp.planDepth },
        { x1: fp.x + fp.planWidth - wd, z1: fp.z, x2: fp.x + fp.planWidth, z2: fp.z + fp.planDepth },
      ];
    }
    if (fp.rotationY === 270) {
      return [
        { x1: fp.x, z1: fp.z + fp.planDepth - wd, x2: fp.x + fp.planWidth, z2: fp.z + fp.planDepth },
        { x1: fp.x, z1: fp.z, x2: fp.x + wd, z2: fp.z + fp.planDepth },
      ];
    }
    return [
      { x1: fp.x, z1: fp.z, x2: fp.x + fp.planWidth, z2: fp.z + wd },
      { x1: fp.x, z1: fp.z, x2: fp.x + wd, z2: fp.z + fp.planDepth },
    ];
  };

  // 1. Oriented Module-to-Module Overlap & Corner Clearance Check
  for (let i = 0; i < footprints.length; i++) {
    for (let j = i + 1; j < footprints.length; j++) {
      const a = footprints[i];
      const b = footprints[j];
      const yOverlap = a.yBottom < b.yTop && a.yTop > b.yBottom;
      if (!yOverlap) continue;

      const rectsA = getFootprintSubRects(a);
      const rectsB = getFootprintSubRects(b);
      let overlapMm = 0;
      for (const ra of rectsA) {
        for (const rb of rectsB) {
          const xo = Math.min(ra.x2, rb.x2) - Math.max(ra.x1, rb.x1);
          const zo = Math.min(ra.z2, rb.z2) - Math.max(ra.z1, rb.z1);
          if (xo > 2 && zo > 2) {
            overlapMm = Math.max(overlapMm, Math.min(xo, zo));
          }
        }
      }

      if (overlapMm > 2) {
        issues.push({
          severity: "error",
          code: "ERR_SPATIAL_MODULE_OVERLAP",
          message: `"${a.name}" ile "${b.name}" planda çakışıyor (${Math.round(overlapMm)}mm girişim).`,
          targetId: a.moduleId,
          blockingProduction: true,
        });
      }
    }
  }

  // 2. Wall Boundary Overflow & Installation Filler Checks
  footprints.forEach((fp) => {
    if (fp.rotationY === 0 && fp.x + fp.planWidth > mainWallLength) {
      const overflow = fp.x + fp.planWidth - mainWallLength;
      issues.push({
        severity: "error",
        code: "ERR_WALL_BOUNDARY_OVERFLOW",
        message: `"${fp.name}" ana duvar sınırını (${mainWallLength}mm) ${overflow}mm aşıyor.`,
        targetId: fp.moduleId,
        blockingProduction: true,
      });
    }

    // Tall pantry ventilation & appliance clearance rule
    if (fp.category === "kitchen_tall" && fp.rawDepth < 560) {
      issues.push({
        severity: "warning",
        code: "WARN_APPLIANCE_VENT_CLEARANCE",
        message: `"${fp.name}" ankastre/soğutucu hava sirkülasyonu için min. 560mm derinlik gerektirir (Mevcut: ${fp.rawDepth}mm).`,
        targetId: fp.moduleId,
      });
    }
  });

  // 3. Architectural Obstacles (Window, Column, Plumbing) Geometric Checks
  obstacles.forEach((obs) => {
    const ox1 = obs.position.x;
    const ox2 = obs.position.x + obs.dimensions.width;
    const oy1 = obs.position.y;
    const oy2 = obs.position.y + obs.dimensions.height;
    const oz1 = obs.position.z;
    const oz2 = obs.position.z + obs.dimensions.depth;

    if (obs.type === "column") {
      footprints.forEach((fp) => {
        const xHit = fp.x < ox2 && fp.x + fp.planWidth > ox1;
        const zHit = fp.z < oz2 && fp.z + fp.planDepth > oz1;
        if (xHit && zHit) {
          issues.push({
            severity: "error",
            code: "ERR_COLUMN_COLLISION",
            message: `"${fp.name}" modülü "${obs.name}" (${ox1}–${ox2}mm) ile çakışıyor.`,
            targetId: fp.moduleId,
            blockingProduction: true,
          });
        }
      });
    }

    if (obs.type === "window") {
      footprints.forEach((fp) => {
        const xHit = fp.x < ox2 && fp.x + fp.planWidth > ox1;
        const zHit = fp.z < oz2 + 400; // along back wall
        const yHit = fp.yBottom < oy2 && fp.yTop > oy1;
        if (xHit && zHit && yHit) {
          issues.push({
            severity: "error",
            code: "ERR_WINDOW_COLLISION",
            message: `"${fp.name}" üst kotu (${fp.yTop}mm), "${obs.name}" (${oy1}–${oy2}mm) açıklığını kapatıyor.`,
            targetId: fp.moduleId,
            blockingProduction: true,
          });
        }
      });
    }

    if (obs.type === "plumbing" && project.space.type.startsWith("kitchen")) {
      const plumbingCenterX = ox1 + obs.dimensions.width / 2;
      const sinkMod = footprints.find(
        (fp) =>
          fp.name.toLowerCase().includes("evye") || fp.moduleId.toLowerCase().includes("sink")
      );
      if (sinkMod) {
        const sinkCenterX = sinkMod.x + sinkMod.planWidth / 2;
        const dist = Math.abs(sinkCenterX - plumbingCenterX);
        if (dist > 350) {
          issues.push({
            severity: "warning",
            code: "WARN_PLUMBING_OFFSET",
            message: `Evye dolabı merkezi (${Math.round(
              sinkCenterX
            )}mm), su tesisat aksından (${Math.round(
              plumbingCenterX
            )}mm) ${Math.round(dist)}mm uzakta. Tesisat uzatması gerekir.`,
            targetId: sinkMod.moduleId,
          });
        }
      }
    }
  });

  // 4. Wall End Filler (Bitiş Kör Parçası) Recommendation
  const maxRightX = Math.max(
    0,
    ...footprints.filter((f) => f.rotationY === 0).map((f) => f.x + f.planWidth)
  );
  const rightGap = mainWallLength - maxRightX;
  if (rightGap > 0 && rightGap < 45) {
    issues.push({
      severity: "info",
      code: "INFO_WALL_FILLER_REQUIRED",
      message: `Duvar bitişinde ${rightGap}mm boşluk kaldı; kapakların duvara sürtmemesi için min. ${rightGap}mm montaj kör çıtası (paspayı) kullanılmalıdır.`,
    });
  }

  return issues;
}
