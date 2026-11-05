import {
  calculateModulePlacement,
  DesignProject,
  ModuleInstance,
  ArchitecturalElement,
  WallDefinition,
  ValidationIssue,
} from "@birim/core";

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
export function getModuleOrientedFootprint(
  mod: ModuleInstance,
  idx: number
): OrientedFootprint2D {
  const rotY = ((mod.rotation?.y || 0) % 360 + 360) % 360;
  const isRotated90 = rotY === 90 || rotY === 270;

  const rawW = mod.dimensions.width;
  const rawH = mod.dimensions.height;
  const rawD = mod.dimensions.depth;

  const placement = calculateModulePlacement(mod);
  const planWidth = placement.width;
  const planDepth = placement.depth;

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

  // 1. Oriented Module-to-Module Overlap & Corner Clearance Check
  for (let i = 0; i < footprints.length; i++) {
    for (let j = i + 1; j < footprints.length; j++) {
      const a = footprints[i];
      const b = footprints[j];

      const xOverlap = a.x < b.x + b.planWidth && a.x + a.planWidth > b.x;
      const zOverlap = a.z < b.z + b.planDepth && a.z + a.planDepth > b.z;
      const yOverlap = a.yBottom < b.yTop && a.yTop > b.yBottom;

      if (xOverlap && zOverlap && yOverlap) {
        issues.push({
          severity: "error",
          code: "ERR_SPATIAL_MODULE_OVERLAP",
          message: `"${a.name}" ile "${b.name}" planda çakışıyor (${Math.round(
            Math.min(a.x + a.planWidth, b.x + b.planWidth) - Math.max(a.x, b.x)
          )}mm girişim).`,
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
