import {
  ModuleInstance,
  doesModuleEmitTopHorizontalGola,
  isCooktopModule,
  isSinkModule,
} from "@birim/core";
import { ComponentGeometry } from "../types";

export interface CarcassShellParams {
  module: ModuleInstance;
  components: ComponentGeometry[];
  bayWidths: number[];
  netInnerH: number;
  netInnerD: number;
  innerSpanW: number;
  isWardrobe: boolean;
  drawerOpenMm: number;
  explodeX: number;
  explodeY: number;
  explodeZ: number;
}

export interface CarcassShellResult {
  effBackType: string;
  isSinkBase: boolean;
  lowerName: string;
}

export function appendCarcassShellGeometry(params: CarcassShellParams): CarcassShellResult {
  const {
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
  } = params;
  const { width, height, depth } = module.dimensions;
  const {
    panelThickness: T,
    backPanelThickness: T_back,
    plinthHeight,
    bodyMaterialId,
    doorMaterialId,
    doorPerimeterGap,
  } = module.carcass;

  // 1. WORLD-STANDARD ARCHITECTURAL PLINTH & TOE-KICK SYSTEMS (3 Authentic Constructions):
  //    A) "pedestal_box"         — Independent 4-sided leveled structural box frame + divider load ribs + bottom PVC seal (Wardrobe/Living standard, 35mm setback)
  //    B) "adjustable_legs_clip" — DIN 68935 / Häfele Axilo 78 legs + C-clips + front & side clip-on plinths + PVC water seal (Kitchen/Bath standard, 55mm setback)
  //    C) "gable_rails"          — Full-height side panels to floor + front & rear structural rails + divider load ribs + bottom PVC seal (Built-in standard, 26mm setback)
  const effPlinthType =
    module.carcass.plinthConstruction ||
    (module.carcass.hasAdjustableLegs === false
      ? isWardrobe
        ? "gable_rails"
        : "pedestal_box"
      : isWardrobe
      ? "pedestal_box"
      : "adjustable_legs_clip");

  const defaultPlinthSetback =
    effPlinthType === "adjustable_legs_clip"
      ? 55
      : effPlinthType === "pedestal_box"
      ? 35
      : 26;
  const plinthFrontSetback = Math.max(
    15,
    Math.min(
      Math.max(30, depth - 130),
      module.carcass.plinthSetbackMm ?? defaultPlinthSetback
    )
  );

  // Compute X positions of all intermediate bay dividers so structural plinth ribs or legs sit directly under every divider!
  const dividerStartXs: number[] = [];
  {
    let accX = T;
    for (let bI = 0; bI < module.bays.length - 1; bI++) {
      accX += bayWidths[bI] || 0;
      dividerStartXs.push(accX);
      accX += T;
    }
    if (dividerStartXs.length === 0 && width >= 950) {
      dividerStartXs.push(Math.round((width - T) / 2));
    }
  }

  if (plinthHeight > 0) {
    const baseExpY = explodeY > 0 ? -explodeY : 0;
    const sealH = plinthHeight >= 75 ? 3.5 : 0; // Co-extruded bottom PVC moisture & dust seal lip (keeps board cut >= 71.5mm!)
    const boardH = plinthHeight - sealH;
    const frontPlinthZ = Math.max(60, depth - plinthFrontSetback - T);
    const rearRailZ = 20; // 20mm rear wall skirting / cable clearance
    const plinthMatId =
      module.carcass.plinthMaterialId ||
      (effPlinthType === "adjustable_legs_clip"
        ? doorMaterialId || bodyMaterialId
        : bodyMaterialId);

    if (effPlinthType === "pedestal_box") {
      // A. INDEPENDENT 4-SIDED LEVELED STRUCTURAL BOX PLINTH (İtalyan Modüler Gardırop Standardı)
      const sideReveal = 3; // Crisp 3mm architectural shadow reveal on exposed ends
      const boxW = Math.max(120, width - 2 * sideReveal);
      const sideReturnDepth = Math.max(70, frontPlinthZ - rearRailZ);
      const ribDepth = Math.max(70, frontPlinthZ - (rearRailZ + T));

      components.push(
        {
          id: `${module.id}_plinth_front`,
          role: "plinth",
          label: `Kutu Baza Ön Bandı (H:${plinthHeight}mm, Girinti:${plinthFrontSetback}mm)`,
          dimensions: { width: boxW, height: boardH, depth: T },
          position: { x: sideReveal, y: baseExpY + sealH, z: frontPlinthZ + explodeZ * 0.45 },
          materialId: plinthMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_plinth_rear`,
          role: "plinth",
          label: `Kutu Baza Arka Taşıyıcı Kayıt`,
          dimensions: { width: Math.max(70, boxW - 2 * T), height: boardH, depth: T },
          position: { x: sideReveal + T, y: baseExpY + sealH, z: rearRailZ - explodeZ * 0.35 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_plinth_side_left`,
          role: "plinth",
          label: `Kutu Baza Sol Dönüş Bandı`,
          dimensions: { width: T, height: boardH, depth: sideReturnDepth },
          position: { x: sideReveal - explodeX * 0.45, y: baseExpY + sealH, z: rearRailZ },
          materialId: plinthMatId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        },
        {
          id: `${module.id}_plinth_side_right`,
          role: "plinth",
          label: `Kutu Baza Sağ Dönüş Bandı`,
          dimensions: { width: T, height: boardH, depth: sideReturnDepth },
          position: {
            x: width - sideReveal - T + explodeX * 0.45,
            y: baseExpY + sealH,
            z: rearRailZ,
          },
          materialId: plinthMatId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        }
      );

      // Structural transverse load-bearing ribs directly beneath every vertical divider (zero bottom-panel sag!)
      dividerStartXs.forEach((divX, rIdx) => {
        if (ribDepth >= 70) {
          components.push({
            id: `${module.id}_plinth_rib_${rIdx + 1}`,
            role: "plinth",
            label: `Baza Ara Taşıyıcı Kayıt #${rIdx + 1}`,
            dimensions: { width: T, height: boardH, depth: ribDepth },
            position: { x: divX, y: baseExpY + sealH, z: rearRailZ + T },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "x",
          });
        }
      });

      // Bottom PVC Moisture & Dust Seal Gaskets on Front & Sides
      if (sealH > 0) {
        components.push(
          {
            id: `${module.id}_plinth_seal_front`,
            role: "special_fitting",
            label: "Baza Altı PVC Nem & Toz Sızdırmazlık Fitili (Ön)",
            dimensions: { width: boxW, height: sealH, depth: T + 3 },
            position: { x: sideReveal, y: baseExpY, z: frontPlinthZ - 1.5 + explodeZ * 0.45 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${module.id}_plinth_seal_left`,
            role: "special_fitting",
            label: "Baza Altı PVC Nem & Toz Fitili (Sol Yan)",
            dimensions: { width: T + 2, height: sealH, depth: sideReturnDepth },
            position: { x: sideReveal - 1 - explodeX * 0.45, y: baseExpY, z: rearRailZ },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${module.id}_plinth_seal_right`,
            role: "special_fitting",
            label: "Baza Altı PVC Nem & Toz Fitili (Sağ Yan)",
            dimensions: { width: T + 2, height: sealH, depth: sideReturnDepth },
            position: {
              x: width - sideReveal - T - 1 + explodeX * 0.45,
              y: baseExpY,
              z: rearRailZ,
            },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          }
        );
      }

      // Concealed Internal M10 Steel Leveling Glides (Terazi Pingoları) inside corners & under divider ribs
      const glideXs = [sideReveal + T + 18, ...dividerStartXs.map((dx) => dx + T / 2), width - sideReveal - T - 18];
      const glideZs = [rearRailZ + T + 24, Math.max(rearRailZ + T + 60, frontPlinthZ - 26)];
      let gCounter = 1;
      for (const gx of glideXs) {
        for (const gz of glideZs) {
          components.push({
            id: `${module.id}_plinth_glide_${gCounter++}`,
            role: "special_fitting",
            label: `Gizli Çelik Baza Terazi Pingosu M10`,
            dimensions: { width: 32, height: Math.min(28, plinthHeight - 8), depth: 32 },
            position: { x: gx - 16, y: baseExpY, z: gz - 16 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        }
      }
    } else if (effPlinthType === "adjustable_legs_clip") {
      // B. DIN 68935 / HÄFELE AXILO 78 ADJUSTABLE LEGS + SNAP-ON C-CLIPS + FRONT/SIDE CLIP-ON PLINTH + WATER SEAL
      const sideReturnInset = 8; // Side return sits cleanly at x=8..26, enclosing legs completely!
      const legOuterOffset = Math.max(58, sideReturnInset + T + 34);
      const legXs = [
        legOuterOffset,
        ...dividerStartXs.map((dx) => dx + Math.round(T / 2)),
        Math.max(legOuterOffset + 40, width - legOuterOffset),
      ];
      const frontLegZ = Math.max(88, frontPlinthZ - 32);
      const rearLegZ = 56;
      const legZs = [rearLegZ, frontLegZ];

      let legCounter = 1;
      for (const lx of legXs) {
        for (const lz of legZs) {
          components.push({
            id: `${module.id}_plastic_leg_${legCounter}`,
            role: "special_fitting",
            label: `Häfele Axilo 78 Ayarlanabilir Baza Ayağı #${legCounter} (H:${plinthHeight}mm)`,
            dimensions: { width: 64, height: plinthHeight, depth: 64 },
            position: { x: lx - 32, y: baseExpY, z: lz - 32 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          });
          // Add 3D Snap-On Plinth C-Clip on every front-row leg latching onto the rear of _plinth_front!
          if (lz === frontLegZ) {
            components.push({
              id: `${module.id}_plinth_clip_${legCounter}`,
              role: "special_fitting",
              label: `Baza C-Klips Bağlantı Aparatı #${legCounter}`,
              dimensions: { width: 42, height: 30, depth: Math.max(24, frontPlinthZ - frontLegZ + 8) },
              position: {
                x: lx - 21,
                y: baseExpY + Math.round(plinthHeight * 0.45),
                z: frontLegZ - 4,
              },
              materialId: "mat_anodized_metal",
              isManufacturablePanel: false,
            });
          }
          legCounter++;
        }
      }

      // Clip-On Front Plinth Board + Side Return Panels so 3/4 views show a clean finished enclosed base!
      const sideRetDepth = Math.max(70, frontPlinthZ - rearRailZ);
      components.push(
        {
          id: `${module.id}_plinth_front`,
          role: "plinth",
          label: `Klipsli Ön Baza Bandı (H:${plinthHeight}mm, Girinti:${plinthFrontSetback}mm, Su Contalı)`,
          dimensions: { width, height: boardH, depth: T },
          position: { x: 0, y: baseExpY + sealH, z: frontPlinthZ + explodeZ * 0.55 },
          materialId: plinthMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_plinth_side_left`,
          role: "plinth",
          label: `Klipsli Sol Dönüş Baza Bandı`,
          dimensions: { width: T, height: boardH, depth: sideRetDepth },
          position: { x: sideReturnInset - explodeX * 0.5, y: baseExpY + sealH, z: rearRailZ },
          materialId: plinthMatId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        },
        {
          id: `${module.id}_plinth_side_right`,
          role: "plinth",
          label: `Klipsli Sağ Dönüş Baza Bandı`,
          dimensions: { width: T, height: boardH, depth: sideRetDepth },
          position: {
            x: width - sideReturnInset - T + explodeX * 0.5,
            y: baseExpY + sealH,
            z: rearRailZ,
          },
          materialId: plinthMatId,
          isManufacturablePanel: true,
          thicknessAxis: "x",
        },
        {
          id: `${module.id}_plinth_rear`,
          role: "plinth",
          label: module.category === "kitchen_island" ? "Ada Arka Baza Bandı (4 Yüz Görünür)" : "Klipsli Arka Baza Denge Kayıtı",
          dimensions: { width: Math.max(80, width - 2 * sideReturnInset - 2 * T), height: boardH, depth: T },
          position: {
            x: sideReturnInset + T,
            y: baseExpY + sealH,
            z: rearRailZ - explodeZ * 0.35,
          },
          materialId: module.category === "kitchen_island" ? plinthMatId : bodyMaterialId,
          isFrontFacing: module.category === "kitchen_island",
          isManufacturablePanel: true,
          thicknessAxis: "z",
        }
      );

      if (sealH > 0) {
        components.push(
          {
            id: `${module.id}_plinth_seal_front`,
            role: "special_fitting",
            label: "Ko-Ekstrüze Baza Su Sızdırmazlık Contası (Ön)",
            dimensions: { width, height: sealH, depth: T + 3.5 },
            position: { x: 0, y: baseExpY, z: frontPlinthZ - 1.5 + explodeZ * 0.55 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${module.id}_plinth_seal_left`,
            role: "special_fitting",
            label: "Ko-Ekstrüze Baza Su Sızdırmazlık Contası (Sol Yan)",
            dimensions: { width: T + 2.5, height: sealH, depth: sideRetDepth },
            position: { x: sideReturnInset - 1.25 - explodeX * 0.5, y: baseExpY, z: rearRailZ },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${module.id}_plinth_seal_right`,
            role: "special_fitting",
            label: "Ko-Ekstrüze Baza Su Sızdırmazlık Contası (Sağ Yan)",
            dimensions: { width: T + 2.5, height: sealH, depth: sideRetDepth },
            position: {
              x: width - sideReturnInset - T - 1.25 + explodeX * 0.5,
              y: baseExpY,
              z: rearRailZ,
            },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          }
        );
      }
    } else {
      // C. "gable_rails" — FULL-HEIGHT SIDE PANELS TO FLOOR + DUAL FRONT/REAR STRUCTURAL RAILS + DIVIDER RIBS
      const ribDepth = Math.max(70, frontPlinthZ - (rearRailZ + T));
      components.push(
        {
          id: `${module.id}_plinth_front`,
          role: "plinth",
          label: `Gömme Ön Baza Kayıdı (H:${plinthHeight}mm, Girinti:${plinthFrontSetback}mm)`,
          dimensions: { width: innerSpanW, height: boardH, depth: T },
          position: { x: T, y: baseExpY + sealH, z: frontPlinthZ + explodeZ * 0.45 },
          materialId: plinthMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_plinth_rear`,
          role: "plinth",
          label: `Gömme Arka Baza Denge Kayıdı`,
          dimensions: { width: innerSpanW, height: boardH, depth: T },
          position: { x: T, y: baseExpY + sealH, z: rearRailZ - explodeZ * 0.35 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        }
      );

      dividerStartXs.forEach((divX, rIdx) => {
        if (ribDepth >= 70) {
          components.push({
            id: `${module.id}_plinth_rib_${rIdx + 1}`,
            role: "plinth",
            label: `Baza Ara Destek Kayıdı #${rIdx + 1}`,
            dimensions: { width: T, height: boardH, depth: ribDepth },
            position: { x: divX, y: baseExpY + sealH, z: rearRailZ + T },
            materialId: bodyMaterialId,
            isManufacturablePanel: true,
            thicknessAxis: "x",
          });
        }
      });

      if (sealH > 0) {
        components.push({
          id: `${module.id}_plinth_seal_front`,
          role: "special_fitting",
          label: "Baza Altı PVC Nem Fitili",
          dimensions: { width: innerSpanW, height: sealH, depth: T + 3 },
          position: { x: T, y: baseExpY, z: frontPlinthZ - 1.5 + explodeZ * 0.45 },
          materialId: "mat_anodized_metal",
          isManufacturablePanel: false,
        });
      }

      const glideXs = [T + 22, ...dividerStartXs.map((dx) => dx + T / 2), width - T - 22];
      let gCounter = 1;
      for (const gx of glideXs) {
        for (const gz of [rearRailZ + T + 24, Math.max(rearRailZ + T + 60, frontPlinthZ - 26)]) {
          components.push({
            id: `${module.id}_plinth_glide_${gCounter++}`,
            role: "special_fitting",
            label: `Gizli Dikme/Baza Terazi Pingosu M10`,
            dimensions: { width: 30, height: Math.min(26, plinthHeight - 8), depth: 30 },
            position: { x: gx - 15, y: baseExpY, z: gz - 15 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        }
      }
    }
  }

  // Plinth Drawer Option (Checklist #18 / Section 5.2: Süpürgelik / Baza Çekmecesi)
  if (module.carcass.hasPlinthDrawer && plinthHeight >= 80) {
    const pDrawerW = Math.max(120, width - 2 * T - 26);
    const pDrawerD = Math.max(200, Math.min(450, depth - 90));
    components.push({
      id: `${module.id}_plinth_drawer_box`,
      role: "drawer_bottom",
      label: `Baza Gizli Çekmece Kasası (${pDrawerW}×${pDrawerD}mm)`,
      dimensions: { width: pDrawerW, height: Math.max(45, plinthHeight - 24), depth: pDrawerD },
      position: { x: T + 13, y: 12, z: depth - pDrawerD - 55 + drawerOpenMm * 0.6 },
      materialId: bodyMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "y",
    });
  }

  // 2 & 3. Left & Right Side Panels — Supports Tip A (sides_through), Tip B (top_bottom_through), Tip C (miter_45), Tip D (kitchen_stretchers)
  const joineryTopology =
    module.carcass.jointType === "miter_45"
      ? "miter_45"
      : module.carcass.carcassJoineryTopology ||
        (module.category === "kitchen_base" || module.category === "kitchen_island"
          ? "kitchen_stretchers"
          : "sides_through");
  const topT = module.carcass.topPanelThicknessMm || T;
  const hasCustomTopThick = topT !== T;
  const sideRunsToFloor = plinthHeight > 0 && effPlinthType === "gable_rails";
  const sideH = hasCustomTopThick
    ? Math.max(80, (sideRunsToFloor ? height : height - plinthHeight) - topT)
    : sideRunsToFloor
    ? Math.max(80, joineryTopology === "top_bottom_through" ? height - T : height)
    : joineryTopology === "top_bottom_through"
    ? Math.max(80, height - plinthHeight - 2 * T)
    : height - plinthHeight;
  const sideY = sideRunsToFloor
    ? 0
    : joineryTopology === "top_bottom_through" && !hasCustomTopThick
    ? plinthHeight + T
    : plinthHeight;

  // P1-05: Compute exact trapezoid/pentagon 2D CNC contour when slopedCeiling is active!
  const slopedCfg = module.carcass.slopedCeiling;
  const buildBackSlopeSideContour = (mirroredRight: boolean): [number, number][] | undefined => {
    if (!slopedCfg || slopedCfg.mode !== "back_slope") return undefined;
    const kneeRelH = Math.max(120, Math.min(sideH - 40, slopedCfg.kneeHeightMm - sideY));
    const radSlope = ((slopedCfg.slopeAngleDeg || 35) * Math.PI) / 180;
    const riseNeeded = sideH - kneeRelH;
    const runDepth = Math.min(depth - 40, Math.max(40, Math.round((riseNeeded / Math.max(0.2, Math.tan(radSlope))) * 100) / 100));
    // In CutPiece DXF space: X = depth (0..depth), Y = height (0..sideH)
    // Left side has front at x=0, rear at x=depth; mirrored right side has rear at x=0, front at x=depth
    if (!mirroredRight) {
      return [
        [0, 0],
        [depth, 0],
        [depth, kneeRelH],
        [Math.max(20, Math.round((depth - runDepth) * 100) / 100), sideH],
        [0, sideH],
      ];
    }
    return [
      [0, 0],
      [depth, 0],
      [depth, sideH],
      [Math.min(depth - 20, Math.round(runDepth * 100) / 100), sideH],
      [0, kneeRelH],
    ];
  };

  const leftSlopeH =
    slopedCfg?.mode === "left_slope"
      ? Math.max(160, Math.min(sideH, slopedCfg.kneeHeightMm - sideY))
      : sideH;
  const rightSlopeH =
    slopedCfg?.mode === "right_slope"
      ? Math.max(160, Math.min(sideH, slopedCfg.kneeHeightMm - sideY))
      : sideH;

  const leftSideMatId = module.carcass.exposedLeftSideUseDoorMaterial ? (doorMaterialId || bodyMaterialId) : bodyMaterialId;
  const rightSideMatId = module.carcass.exposedRightSideUseDoorMaterial ? (doorMaterialId || bodyMaterialId) : bodyMaterialId;

  components.push({
    id: `${module.id}_side_left`,
    role: "carcass_side_left",
    label:
      slopedCfg && slopedCfg.mode !== "none"
        ? "Sol Yan Panel (Eğimli Tavan Kesimli)"
        : joineryTopology === "miter_45"
        ? "Sol Yan Panel (45° Gönye)"
        : module.carcass.exposedLeftSideUseDoorMaterial
        ? "Sol Yan Panel (Görünen Yan - Kapak Malzemeli)"
        : "Sol Yan Panel",
    dimensions: { width: T, height: leftSlopeH, depth },
    position: { x: explodeX > 0 ? -explodeX : 0, y: sideY, z: 0 },
    materialId: leftSideMatId,
    isFrontFacing: module.carcass.exposedLeftSideUseDoorMaterial ? true : undefined,
    isManufacturablePanel: true,
    thicknessAxis: "x",
    polygonContourMm: buildBackSlopeSideContour(false),
  });

  components.push({
    id: `${module.id}_side_right`,
    role: "carcass_side_right",
    label:
      slopedCfg && slopedCfg.mode !== "none"
        ? "Sağ Yan Panel (Eğimli Tavan Kesimli)"
        : joineryTopology === "miter_45"
        ? "Sağ Yan Panel (45° Gönye)"
        : module.carcass.exposedRightSideUseDoorMaterial
        ? "Sağ Yan Panel (Görünen Yan - Kapak Malzemeli)"
        : "Sağ Yan Panel",
    dimensions: { width: T, height: rightSlopeH, depth },
    position: { x: width - T + explodeX, y: sideY, z: 0 },
    materialId: rightSideMatId,
    isFrontFacing: module.carcass.exposedRightSideUseDoorMaterial ? true : undefined,
    isManufacturablePanel: true,
    thicknessAxis: "x",
    polygonContourMm: buildBackSlopeSideContour(true),
  });

  // Applied Decorative End Panels (Checklist #19: D_carcass + T_door + 2mm covering front door reveal!)
  const T_door_ext = module.carcass.doorThickness || 18;
  const endPanelDepth = depth + T_door_ext + 2;
  if (module.carcass.appliedEndPanelLeft && module.carcass.appliedEndPanelLeft !== "none") {
    const epFloor = module.carcass.appliedEndPanelLeft === "floor_to_top";
    components.push({
      id: `${module.id}_applied_end_left`,
      role: "end_panel",
      label: epFloor ? "Sol Görünen Yan Panel (Zemine İnen, Cumba Örten)" : "Sol Görünen Yan Panel (Gövde Boyu, Cumba Örten)",
      dimensions: { width: T, height: epFloor ? height : height - plinthHeight, depth: endPanelDepth },
      position: { x: -T, y: epFloor ? 0 : plinthHeight, z: 0 },
      materialId: doorMaterialId,
      isFrontFacing: true,
      isManufacturablePanel: true,
      thicknessAxis: "x",
    });
  }
  if (module.carcass.appliedEndPanelRight && module.carcass.appliedEndPanelRight !== "none") {
    const epFloor = module.carcass.appliedEndPanelRight === "floor_to_top";
    components.push({
      id: `${module.id}_applied_end_right`,
      role: "end_panel",
      label: epFloor ? "Sağ Görünen Yan Panel (Zemine İnen, Cumba Örten)" : "Sağ Görünen Yan Panel (Gövde Boyu, Cumba Örten)",
      dimensions: { width: T, height: epFloor ? height : height - plinthHeight, depth: endPanelDepth },
      position: { x: width, y: epFloor ? 0 : plinthHeight, z: 0 },
      materialId: doorMaterialId,
      isFrontFacing: true,
      isManufacturablePanel: true,
      thicknessAxis: "x",
    });
  }

  // Island Decorative Back Cladding (MD Spec Section 7.3)
  if (module.category === "kitchen_island" || module.carcass.islandBackCladding) {
    components.push({
      id: `${module.id}_island_back_cladding`,
      role: "end_panel",
      label: "Ada Mutfak Dekoratif Arka Kapama Paneli",
      dimensions: { width, height, depth: T },
      position: { x: 0, y: 0, z: -T },
      materialId: doorMaterialId,
      isFrontFacing: true,
      isManufacturablePanel: true,
      thicknessAxis: "z",
    });
  }

  // 4. Bottom Panel (When sideRunsToFloor / gable_rails is active, bottom panel ALWAYS sits between floor-standing side uprights!)
  const horizPanelW =
    joineryTopology === "top_bottom_through" || joineryTopology === "miter_45" ? width : innerSpanW;
  const horizPanelX =
    joineryTopology === "top_bottom_through" || joineryTopology === "miter_45" ? 0 : T;
  const bottomPanelW = sideRunsToFloor ? innerSpanW : horizPanelW;
  const bottomPanelX = sideRunsToFloor ? T : horizPanelX;
  const hasWallBottomGola268 =
    (module.category === "kitchen_wall" || module.moduleFamilyId === "fam_kitchen_wall") &&
    module.bays.some(
      (b) =>
        b.door?.handleCategory === "gola_profile" &&
        b.door?.handleProfileId !== "hnd_gola_vertical" &&
        b.door?.handleProfileId !== "hnd_overhang_recessed_lip"
    );
  const bottomPanelDepth = hasWallBottomGola268 ? Math.max(120, depth - 26) : depth;
  if (module.templateId !== "tpl_kt_07_fridge_surround") components.push({
    id: `${module.id}_bottom`,
    role: "carcass_bottom",
    label: hasWallBottomGola268
      ? "Alt Panel (Gola 268 Ön 26mm Geri Çekili)"
      : joineryTopology === "miter_45" && !sideRunsToFloor
      ? "Alt Panel (45° Gönye)"
      : "Alt Panel",
    dimensions: { width: bottomPanelW, height: T, depth: bottomPanelDepth },
    position: { x: bottomPanelX, y: plinthHeight - explodeY * 0.5, z: 0 },
    materialId: bodyMaterialId,
    isManufacturablePanel: true,
    thicknessAxis: "y",
  });

  // 5. Top Construction: Tip D Kitchen Base Stretchers (Checklist #10!) vs Full Top Panel
  const isSinkMod = isSinkModule(module);
  const isCooktopMod = isCooktopModule(module);
  if (joineryTopology === "kitchen_stretchers") {
    const stretcherW = 90; // Standard 90mm rail width (80-100mm per MD Spec Section 3.1 Tip D)
    const stretcherMode =
      module.carcass.kitchenTopStretcherMode ||
      (isSinkMod
        ? "vertical_sink"
        : isCooktopMod && width >= 900
        ? "aluminum_reinforced"
        : "horizontal");

    const golaBaseDoor = doesModuleEmitTopHorizontalGola(module)
      ? module.bays.find(
          (b) =>
            b.door?.handleCategory === "gola_profile" &&
            b.door?.handleProfileId !== "hnd_gola_vertical"
        )?.door
      : undefined;
    const topGolaRecessMm = golaBaseDoor
      ? golaBaseDoor.handleProfileId === "hnd_gola_melamine_box"
        ? 38
        : golaBaseDoor.handleProfileId === "hnd_gola_moulded_box"
        ? 25
        : golaBaseDoor.handleProfileId === "hnd_bevel_30_backing"
        ? 18
        : 26
      : 0;

    const hasAnyExtDrawerForTop = module.bays.some((b) =>
      (b.drawers || []).some((d) => !d.isInternal && !d.isHidden)
    );
    const effectiveOpenFrontForTop = Boolean(module.isOpenFront) && !hasAnyExtDrawerForTop;
    const effBackTypeForStretcher = isSinkMod ? "none" : module.carcass.backPanelType || "grooved";
    const rearStretcherD =
      effBackTypeForStretcher === "grooved" && !effectiveOpenFrontForTop
        ? Math.max(stretcherW, (module.carcass.backOffsetMm ?? (isWardrobe ? 12 : 18)) + T_back + 74)
        : stretcherW;
    if (stretcherMode === "vertical_sink") {
      // Vertical Front Apron Stretcher + Rear Wall-Mounting Stretcher (since sink bases omit back panel for plumbing!)
      components.push(
        {
          id: `${module.id}_top_stretcher_front_vert`,
          role: "carcass_top",
          label: topGolaRecessMm > 0 ? `Eviye Altı Dikey Ön Alın Kaydı (Gola ${topGolaRecessMm}mm Geri Çekili)` : "Eviye Altı Dikey Ön Alın Kaydı (90mm)",
          dimensions: { width: innerSpanW, height: stretcherW, depth: T },
          position: { x: T, y: height - stretcherW + explodeY, z: Math.max(40, depth - topGolaRecessMm - T) },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        },
        {
          id: `${module.id}_top_stretcher_rear_vert`,
          role: "carcass_top",
          label: "Eviye Altı Dikey Arka Bağlantı Kaydı (90mm)",
          dimensions: { width: innerSpanW, height: stretcherW, depth: T },
          position: { x: T, y: height - stretcherW + explodeY, z: 0 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        }
      );
    } else if (stretcherMode === "aluminum_reinforced") {
      // Extruded Aluminum Structural Front Rail for wide (900-1200mm) cooktop cabinets + grooved wooden rear stretcher flush at z = 0
      components.push(
        {
          id: `${module.id}_top_stretcher_front_alu`,
          role: "special_fitting",
          label: "Ocak Altı Alüminyum Mukavemet Ön Kaydı (Isı & Sehim Korumalı)",
          dimensions: { width: innerSpanW, height: 35, depth: 35 },
          position: { x: T, y: height - 35 + explodeY, z: Math.max(40, depth - topGolaRecessMm - 35) },
          materialId: "mat_anodized_metal",
          isManufacturablePanel: false,
        },
        {
          id: `${module.id}_top_stretcher_rear`,
          role: "carcass_top",
          label: `Üst Arka Bağlantı Kaydı (${rearStretcherD}mm, Arkalık Kanallı)`,
          dimensions: { width: innerSpanW, height: T, depth: rearStretcherD },
          position: { x: T, y: height - T + explodeY, z: 0 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "y",
        }
      );
    } else {
      components.push(
        {
          id: `${module.id}_top_stretcher_front`,
          role: "carcass_top",
          label: topGolaRecessMm > 0 ? `Üst Ön Kayıt (Gola ${topGolaRecessMm}mm Geri Çekili)` : "Üst Ön Kayıt (90mm)",
          dimensions: { width: innerSpanW, height: T, depth: stretcherW },
          position: { x: T, y: height - T + explodeY, z: Math.max(rearStretcherD + 20, depth - topGolaRecessMm - stretcherW) },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "y",
        },
        {
          id: `${module.id}_top_stretcher_rear`,
          role: "carcass_top",
          label: `Üst Arka Kayıt (${rearStretcherD}mm, Arkalık Kanallı)`,
          dimensions: { width: innerSpanW, height: T, depth: rearStretcherD },
          position: { x: T, y: height - T + explodeY, z: 0 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "y",
        }
      );
    }
  } else {
    components.push({
      id: `${module.id}_top`,
      role: "carcass_top",
      label: hasCustomTopThick
        ? `Üst Tabla (${topT}mm Kalınlık)`
        : joineryTopology === "miter_45"
        ? "Üst Panel (45° Gönye)"
        : "Üst Panel",
      dimensions: { width: hasCustomTopThick ? width : horizPanelW, height: topT, depth },
      position: { x: hasCustomTopThick ? 0 : horizPanelX, y: height - topT + explodeY, z: 0 },
      materialId: bodyMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "y",
    });
  }

  // 5b. Taç Profili (Crown Molding / Cornice — Modern, Basamaklı, Klasik Kavisli veya LED Kanallı)
  const crownCfg = module.carcass.crownMolding;
  if (crownCfg?.enabled) {
    const crownH = Math.max(25, Math.min(200, crownCfg.heightMm || 60));
    const crownProj = Math.max(0, Math.min(120, crownCfg.projectionMm ?? 25));
    const crownMat = crownCfg.materialId || doorMaterialId;
    const crownY = height + explodeY * 1.15;
    const crownBaseThick = 18;
    const frontProjDepth = crownBaseThick + crownProj;
    const styleLabel =
      crownCfg.style === "stepped"
        ? "Basamaklı"
        : crownCfg.style === "classic_coving"
        ? "Klasik Kavisli"
        : crownCfg.style === "led_channel"
        ? "LED Kanallı"
        : "Modern Düz";

    components.push(
      {
        id: `${module.id}_crown_front`,
        role: "end_panel",
        label: `Ön Taç Profili (${styleLabel} • ${crownH}mm, 45° Gönyeli)`,
        dimensions: { width: width + crownProj * 2, height: crownH, depth: frontProjDepth },
        position: { x: -crownProj, y: crownY, z: depth - crownBaseThick },
        materialId: crownMat,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      },
      {
        id: `${module.id}_crown_left`,
        role: "end_panel",
        label: `Sol Yan Taç Profili (${styleLabel} • ${crownH}mm)`,
        dimensions: { width: frontProjDepth, height: crownH, depth: Math.max(40, depth - crownBaseThick) },
        position: { x: -crownProj, y: crownY, z: 0 },
        materialId: crownMat,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      },
      {
        id: `${module.id}_crown_right`,
        role: "end_panel",
        label: `Sağ Yan Taç Profili (${styleLabel} • ${crownH}mm)`,
        dimensions: { width: frontProjDepth, height: crownH, depth: Math.max(40, depth - crownBaseThick) },
        position: { x: width - crownBaseThick, y: crownY, z: 0 },
        materialId: crownMat,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      }
    );

    if (crownCfg.style === "stepped" || crownCfg.style === "classic_coving") {
      const upperLipH = Math.max(14, Math.round(crownH * 0.42));
      const extraProj = crownCfg.style === "classic_coving" ? 16 : 12;
      components.push({
        id: `${module.id}_crown_upper_tier`,
        role: "end_panel",
        label: `Üst Taç Kademe Şeridi (${styleLabel})`,
        dimensions: {
          width: width + (crownProj + extraProj) * 2,
          height: upperLipH,
          depth: frontProjDepth + extraProj,
        },
        position: {
          x: -(crownProj + extraProj),
          y: crownY + (crownH - upperLipH),
          z: depth - crownBaseThick,
        },
        materialId: crownMat,
        isFrontFacing: true,
        isManufacturablePanel: false,
      });
    } else if (crownCfg.style === "led_channel") {
      components.push({
        id: `${module.id}_crown_led_strip`,
        role: "led_strip",
        label: `Taç Altı LED Aydınlatma Şeridi`,
        dimensions: { width: Math.max(40, width - 20), height: 4, depth: 8 },
        position: { x: 10, y: crownY - 2, z: depth + Math.max(4, crownProj - 10) },
        materialId: "mat_led_warm",
        isManufacturablePanel: false,
      });
    }
  }

  // 6. Back Panel — All 5 Modes Supported (Checklist #2: grooved, rebated, nailed, flush, none; auto-omitted on sink base!)
  const hasAnyExternalDrawerForBack = module.bays.some((b) =>
    (b.drawers || []).some((d) => !d.isInternal && !d.isHidden)
  );
  const effectiveOpenFrontForBack = Boolean(module.isOpenFront) && !hasAnyExternalDrawerForBack;
  const effBackType = isSinkMod && !module.carcass.backPanelType ? "none" : isSinkMod ? "none" : (module.carcass.backPanelType || "grooved");
  if (effBackType !== "none" && !effectiveOpenFrontForBack) {
    if (effBackType === "nailed") {
      components.push({
        id: `${module.id}_back`,
        role: "carcass_back",
        label: `Arkadan Çakma Arkalık (${T_back}mm)`,
        dimensions: { width: Math.max(80, width - 2), height: Math.max(80, height - plinthHeight - 2), depth: T_back },
        position: { x: 1, y: plinthHeight + 1, z: -T_back - explodeZ * 0.8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    } else if (effBackType === "rebated") {
      components.push({
        id: `${module.id}_back`,
        role: "carcass_back",
        label: `Lambalı Geçme Arkalık (${T_back}mm)`,
        dimensions: { width: innerSpanW + 20, height: netInnerH + 20, depth: T_back },
        position: { x: T - 10, y: plinthHeight + T - 10, z: 0 - explodeZ * 0.8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    } else if (effBackType === "flush") {
      const flushT = Math.max(18, T_back);
      components.push({
        id: `${module.id}_back`,
        role: "carcass_back",
        label: `Tam Kalınlık Yapısal Arkalık (${flushT}mm)`,
        dimensions: { width: innerSpanW, height: netInnerH, depth: flushT },
        position: { x: T, y: plinthHeight + T, z: 0 - explodeZ * 0.8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    } else {
      const dOffset = module.carcass.backOffsetMm ?? (isWardrobe ? 12 : 18);
      const backW = innerSpanW + 16;
      // 4-sided 8mm grooved back panel: seats 8mm into carcass_bottom AND 8mm into carcass_top / grooved _top_stretcher_rear!
      const backH = netInnerH + 16;
      components.push({
        id: `${module.id}_back`,
        role: "carcass_back",
        label: `Kanallı Arkalık (${T_back}mm, Offset:${dOffset}mm)`,
        dimensions: { width: backW, height: backH, depth: T_back },
        position: { x: T - 8, y: plinthHeight + T - 8, z: dOffset - explodeZ * 0.8 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });
    }
  }

  // 6b. WP-05 Special Carcass Topology for Blind Corner, L-Corner & Built-in Appliance Housing
  const lowerName = module.name.toLowerCase();
  if (module.templateId?.includes("blind") || lowerName.includes("kör köşe")) {
    const blindW = Math.max(120, Math.round(innerSpanW * 0.45));
    const hasHorizGolaBlind = module.bays.some(
      (b) =>
        b.door?.handleCategory === "gola_profile" &&
        b.door?.handleProfileId !== "hnd_gola_vertical"
    );
    const blindFrontY = plinthHeight + doorPerimeterGap;
    const blindFrontH = Math.max(
      120,
      height - plinthHeight - 2 * doorPerimeterGap - (hasHorizGolaBlind && height <= 1200 ? 30 : 0)
    );
    components.push(
      {
        id: `${module.id}_blind_center_post`,
        role: "carcass_divider",
        label: "Kör Köşe Orta Taşıyıcı Dikme (Menteşe Karşılığı)",
        dimensions: { width: T, height: netInnerH, depth: 72 },
        position: { x: T + blindW - T, y: plinthHeight + T, z: depth - 72 - (hasHorizGolaBlind ? 26 : 0) },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      },
      {
        id: `${module.id}_blind_panel`,
        role: "wall_filler",
        label: "Kör Köşe Ön Sabit Kapama Paneli",
        dimensions: { width: T + blindW - 2, height: blindFrontH, depth: T },
        position: { x: 2, y: blindFrontY, z: depth },
        materialId: doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      },
      {
        id: `${module.id}_corner_filler`,
        role: "wall_filler",
        label: "90° L-Kör Köşe Klapa Ön Alın Bandı (65mm)",
        dimensions: { width: 65, height: blindFrontH, depth: T },
        position: { x: T + blindW - 65, y: blindFrontY, z: depth + T },
        materialId: doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      },
      {
        id: `${module.id}_corner_filler_return`,
        role: "wall_filler",
        label: "90° L-Kör Köşe Dönüş Klapa Kanadı (55mm Kulp Kurtarma Payı)",
        dimensions: { width: T, height: blindFrontH, depth: 55 },
        position: { x: T + blindW - 65, y: blindFrontY, z: depth + T },
        materialId: doorMaterialId || bodyMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      }
    );
  }

  if (
    module.templateId?.includes("oven") ||
    module.templateId?.includes("microwave") ||
    lowerName.includes("ankastre fırın")
  ) {
    components.push({
      id: `${module.id}_appliance_shelf`,
      role: "shelf",
      label: "Ankastre Cihaz Taşıyıcı Tabla (22mm)",
      dimensions: { width: innerSpanW, height: 22, depth: Math.max(120, netInnerD - 50) },
      position: { x: T, y: plinthHeight + T + Math.min(netInnerH - 100, 720), z: 20 },
      materialId: bodyMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "y",
    });
    components.push({
      id: `${module.id}_appliance_vent_strip`,
      role: "plinth",
      label: "Ankastre Havalandırma Ön Kayıtı",
      dimensions: { width: innerSpanW, height: 70, depth: T },
      position: { x: T, y: height - T - 70, z: depth - T },
      materialId: doorMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "z",
    });

    if (module.templateId?.includes("oven") || lowerName.includes("ankastre fırın")) {
      const ovenY = module.templateId?.includes("kb_09")
        ? plinthHeight + T + 125
        : plinthHeight + T + 380;
      const ovenH = Math.min(595, Math.max(200, height - ovenY - T));
      components.push({
        id: `${module.id}_builtin_oven_unit`,
        role: "special_fitting",
        label: "Ankastre Fırın Ünitesi (EN 1116 600mm)",
        dimensions: { width: Math.max(100, width - 8), height: ovenH, depth: 24 },
        position: { x: 4, y: ovenY, z: depth - 2 },
        materialId: "mat_smoked_glass",
        isManufacturablePanel: false,
      });
    }
    if (module.templateId?.includes("microwave")) {
      const mwY = module.templateId?.includes("oven_microwave")
        ? plinthHeight + T + 985
        : plinthHeight + T + 4;
      const mwH = Math.min(380, Math.max(150, height - mwY - T));
      components.push({
        id: `${module.id}_builtin_microwave_unit`,
        role: "special_fitting",
        label: "Ankastre Mikrodalga Ünitesi (380mm)",
        dimensions: { width: Math.max(100, width - 8), height: mwH, depth: 22 },
        position: { x: 4, y: mwY, z: depth - 2 },
        materialId: "mat_smoked_glass",
        isManufacturablePanel: false,
      });
    }
  }

  const tplLower = (module.templateId || "").toLowerCase();
  const nameLower = (module.name || "").toLowerCase();
  if (tplLower.includes("oven") || tplLower.includes("fridge")) {
    components.push({
      id: `${module.id}_appliance_vent_grille`,
      role: "special_fitting",
      label: "Ankastre Havalandırma Menfezi (Min 200cm²)",
      dimensions: { width: Math.max(180, width - 120), height: 42, depth: 16 },
      position: { x: 60, y: Math.max(18, plinthHeight - 48), z: depth - 28 },
      materialId: "mat_anodized_metal",
      isManufacturablePanel: false,
    });
  }
  const isKitchenBaseOrCorner =
    module.category === "kitchen_base" ||
    module.category === "kitchen_corner" ||
    String(module.moduleFamilyId) === "fam_base" ||
    (String(module.moduleFamilyId) === "fam_corner" && height <= 1150) ||
    tplLower.includes("kitchen_base") ||
    tplLower.includes("_kb_") ||
    tplLower.includes("_kc_");

  const isSinkBase = isSinkModule(module);
  const isCooktopBase = isCooktopModule(module);

  // Automatic 38mm Calacatta Quartz Countertop Slab (WITH TRUE 3D CSG/POLYGON APERTURE OVER SINK & COOKTOP!) + Waterfall Options
  const ctopThickness = isKitchenBaseOrCorner || module.category === "kitchen_island" ? 38 : 0;
  if (ctopThickness > 0) {
    const rearOverhang = module.carcass.islandOverhangRearMm ?? (module.category === "kitchen_island" ? 280 : 0);
    const ctopDepth = depth + 40 + rearOverhang; // +40mm front drip overhang (20mm door + 20mm drip)
    const ctopMatId = module.carcass.countertopMaterialId || "mat_neolith_calacatta_luxe";
    const holeW = isSinkBase
      ? Math.min(560, Math.max(320, width - 80))
      : isCooktopBase
      ? Math.min(580, Math.max(320, width - 80))
      : 0;
    const holeD = isSinkBase
      ? Math.min(460, Math.max(280, depth - 110))
      : isCooktopBase
      ? Math.min(500, Math.max(280, depth - 100))
      : 0;

    components.push({
      id: `${module.id}_auto_countertop`,
      role: "countertop",
      label: `Çimstone Calacatta Kuvars Tezgâh (38mm${holeW > 0 ? ", Boşaltmalı" : ""})`,
      dimensions: { width, height: ctopThickness, depth: ctopDepth },
      position: { x: 0, y: height, z: -rearOverhang },
      cutoutHole:
        holeW > 0
          ? {
              centerXMm: width / 2,
              centerZMm: rearOverhang + depth / 2 + 10,
              widthMm: holeW,
              depthMm: holeD,
            }
          : undefined,
      materialId: ctopMatId,
      isFrontFacing: true,
      isManufacturablePanel: false,
    });
    if (module.category !== "kitchen_island") {
      components.push({
        id: `${module.id}_auto_backsplash_strip`,
        role: "countertop",
        label: `Tezgâh Arka Süpürgelik Çıtası (45×18mm)`,
        dimensions: { width, height: 45, depth: 18 },
        position: { x: 0, y: height + ctopThickness, z: 0 },
        materialId: ctopMatId,
        isFrontFacing: true,
        isManufacturablePanel: false,
      });
    }
    if (module.carcass.hasWaterfallLeft) {
      components.push({
        id: `${module.id}_waterfall_left`,
        role: "countertop",
        label: "Sol Şelale Tezgâh Yan İnişi (45° Gönye, 38mm)",
        dimensions: { width: 38, height: height + ctopThickness, depth: ctopDepth },
        position: { x: -38, y: 0, z: -rearOverhang },
        materialId: ctopMatId,
        isFrontFacing: true,
        isManufacturablePanel: false,
      });
    }
    if (module.carcass.hasWaterfallRight) {
      components.push({
        id: `${module.id}_waterfall_right`,
        role: "countertop",
        label: "Sağ Şelale Tezgâh Yan İnişi (45° Gönye, 38mm)",
        dimensions: { width: 38, height: height + ctopThickness, depth: ctopDepth },
        position: { x: width, y: 0, z: -rearOverhang },
        materialId: ctopMatId,
        isFrontFacing: true,
        isManufacturablePanel: false,
      });
    }
  }
  if (isSinkBase) {
    const cutW = Math.min(560, Math.max(320, width - 80));
    const cutD = Math.min(460, Math.max(280, depth - 110));
    components.push({
      id: `${module.id}_cutout_sink`,
      role: "special_fitting",
      label: `Paslanmaz Çelik Eviye & Kuğu Batarya (${cutW}×${cutD}mm)`,
      dimensions: { width: cutW, height: 32, depth: cutD },
      position: { x: (width - cutW) / 2, y: height + ctopThickness - 14, z: (depth - cutD) / 2 + 10 },
      materialId: "mat_metal_chrome",
      isManufacturablePanel: false,
    });
  } else if (isCooktopBase) {
    const cutW = Math.min(580, Math.max(320, width - 80));
    const cutD = Math.min(500, Math.max(280, depth - 100));
    components.push({
      id: `${module.id}_cutout_cooktop`,
      role: "special_fitting",
      label: `4 Gözlü Ankastre İndüksiyonlu Ocak (${cutW}×${cutD}mm)`,
      dimensions: { width: cutW, height: 18, depth: cutD },
      position: { x: (width - cutW) / 2, y: height + ctopThickness - 4, z: (depth - cutD) / 2 + 12 },
      materialId: "mat_smoked_glass",
      isManufacturablePanel: false,
    });
  }


  return { effBackType, isSinkBase, lowerName };
}
