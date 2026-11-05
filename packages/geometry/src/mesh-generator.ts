import {
  ModuleInstance,
  calculateBayWidths,
  calculateNetInnerHeight,
  calculateNetInnerDepth,
  calculateFourSpaceDimensions,
  inferDoorSystemIdFromType,
} from "@birim/core";
import { ComponentGeometry, ModuleGeometryBreakdown } from "./types";
import { generateHandleGeometry } from "./handle-geometry";

export interface GenerateGeometryOptions {
  doorOpenAngleDeg?: number; // 0 = closed, 90 = open
  drawerOpenMm?: number; // 0 = closed, 350 = pulled out
  explodedFactor?: number; // 0 = normal, 1 = fully exploded
}

const moduleGeometryCache = new Map<string, ModuleGeometryBreakdown>();

export function generateModuleGeometry(
  module: ModuleInstance,
  options: GenerateGeometryOptions = {}
): ModuleGeometryBreakdown {
  const cacheKey = JSON.stringify([module, options]);
  const cached = moduleGeometryCache.get(cacheKey);
  if (cached) return cached;

  const { doorOpenAngleDeg = 0, drawerOpenMm = 0, explodedFactor = 0 } = options;
  const { width, height, depth } = module.dimensions;
  const {
    panelThickness: T,
    backPanelThickness: T_back,
    plinthHeight,
    bodyMaterialId,
    doorMaterialId,
    doorPerimeterGap,
  } = module.carcass;

  // Handle complementary single-piece modules cleanly (Countertop, Backsplash, End Panel, Wall Filler, Leveling Feet, Wall Bracket)
  if (module.category === "complementary" && module.complementaryRole) {
    const nonPanelRoles = new Set([
      "leveling_feet",
      "led_channel",
      "wall_bracket",
      "service_spacer",
    ]);
    const isPanel = !nonPanelRoles.has(module.complementaryRole);
    const compRole =
      module.complementaryRole === "countertop" || module.complementaryRole === "waterfall_edge"
        ? "countertop"
        : module.complementaryRole === "plinth_strip" || module.complementaryRole === "skirting"
        ? "plinth"
        : isPanel
        ? "carcass_side_left"
        : "special_fitting";
    const minAxis =
      width <= height && width <= depth ? "x" : height <= width && height <= depth ? "y" : "z";
    const compResult: ModuleGeometryBreakdown = {
      moduleId: module.id,
      overall: module.dimensions,
      components: [
        {
          id: `${module.id}_comp_main`,
          role: compRole,
          label: module.name,
          dimensions: { width, height, depth },
          position: { x: 0, y: 0, z: 0 },
          materialId: bodyMaterialId,
          isFrontFacing: true,
          isManufacturablePanel: isPanel,
          thicknessAxis: isPanel ? minAxis : undefined,
        },
      ],
      bayWidths: [width],
      netInnerHeight: height,
      netInnerDepth: depth,
    };
    moduleGeometryCache.set(cacheKey, compResult);
    return compResult;
  }

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
  const isWardrobe =
    !module.category ||
    module.category.startsWith("wardrobe") ||
    module.moduleFamilyId === "fam_wardrobe" ||
    Boolean(module.templateId?.startsWith("tpl_wd_")) ||
    Boolean(module.templateId?.startsWith("tpl_wardrobe")) ||
    Boolean(module.templateId?.startsWith("tpl_sc_05")) ||
    Boolean(module.templateId?.startsWith("tpl_sc_06"));

  // 1. Plinth (Baza) — in wardrobes, side panels extend to floor so plinth fits between side panels (x = T, width = innerSpanW)
  if (plinthHeight > 0) {
    components.push({
      id: `${module.id}_plinth_front`,
      role: "plinth",
      label: "Baza Ön",
      dimensions: {
        width: isWardrobe ? innerSpanW : width,
        height: plinthHeight,
        depth: T,
      },
      position: {
        x: isWardrobe ? T : 0,
        y: explodeY > 0 ? -explodeY : 0,
        z: depth - T - 20,
      },
      materialId: bodyMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "z",
    });
  }

  // 2. Left Side Panel — in wardrobes, side panels extend all the way to the floor (y = 0, height = height)
  const sideH = isWardrobe ? height : height - plinthHeight;
  const sideY = isWardrobe ? 0 : plinthHeight;
  components.push({
    id: `${module.id}_side_left`,
    role: "carcass_side_left",
    label: "Sol Yan Panel",
    dimensions: { width: T, height: sideH, depth },
    position: { x: explodeX > 0 ? -explodeX : 0, y: sideY, z: 0 },
    materialId: bodyMaterialId,
    isManufacturablePanel: true,
    thicknessAxis: "x",
  });

  // 3. Right Side Panel
  components.push({
    id: `${module.id}_side_right`,
    role: "carcass_side_right",
    label: "Sağ Yan Panel",
    dimensions: { width: T, height: sideH, depth },
    position: { x: width - T + explodeX, y: sideY, z: 0 },
    materialId: bodyMaterialId,
    isManufacturablePanel: true,
    thicknessAxis: "x",
  });

  // 4. Bottom Panel
  components.push({
    id: `${module.id}_bottom`,
    role: "carcass_bottom",
    label: "Alt Panel",
    dimensions: { width: innerSpanW, height: T, depth },
    position: { x: T, y: plinthHeight - explodeY * 0.5, z: 0 },
    materialId: bodyMaterialId,
    isManufacturablePanel: true,
    thicknessAxis: "y",
  });

  // 5. Top Panel
  components.push({
    id: `${module.id}_top`,
    role: "carcass_top",
    label: "Üst Panel",
    dimensions: { width: innerSpanW, height: T, depth },
    position: { x: T, y: height - T + explodeY, z: 0 },
    materialId: bodyMaterialId,
    isManufacturablePanel: true,
    thicknessAxis: "y",
  });

  // 6. Back Panel
  const backW = innerSpanW + 16;
  const backH = netInnerH + 16;
  components.push({
    id: `${module.id}_back`,
    role: "carcass_back",
    label: "Arkalık",
    dimensions: { width: backW, height: backH, depth: T_back },
    position: { x: T - 8, y: plinthHeight + T - 8, z: 12 - explodeZ * 0.8 },
    materialId: bodyMaterialId,
    isManufacturablePanel: true,
    thicknessAxis: "z",
  });

  // 6b. WP-05 Special Carcass Topology for Blind Corner, L-Corner & Built-in Appliance Housing
  const lowerName = module.name.toLowerCase();
  if (module.templateId?.includes("blind") || lowerName.includes("kör köşe")) {
    const blindW = Math.max(120, Math.round(innerSpanW * 0.45));
    components.push({
      id: `${module.id}_blind_panel`,
      role: "carcass_divider",
      label: "Kör Köşe Ön Sabit Panel",
      dimensions: { width: blindW, height: netInnerH, depth: T },
      position: { x: T, y: plinthHeight + T, z: depth - T },
      materialId: bodyMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "z",
    });
    components.push({
      id: `${module.id}_corner_filler`,
      role: "carcass_divider",
      label: "Kör Köşe Dönüş Kör Çıtası",
      dimensions: { width: 70, height: netInnerH, depth: T },
      position: { x: T + blindW - 70, y: plinthHeight + T, z: depth },
      materialId: doorMaterialId,
      isManufacturablePanel: true,
      thicknessAxis: "z",
    });
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
    module.moduleFamilyId === "fam_base" ||
    (module.moduleFamilyId === "fam_corner" && height <= 1150) ||
    tplLower.includes("kitchen_base") ||
    tplLower.includes("_kb_") ||
    tplLower.includes("_kc_");

  // Automatic 38mm Calacatta Quartz Countertop Slab + 45mm Rear Backsplash Strip on all Kitchen Base & Corner Cabinets
  const ctopThickness = isKitchenBaseOrCorner ? 38 : 0;
  if (isKitchenBaseOrCorner) {
    components.push({
      id: `${module.id}_auto_countertop`,
      role: "countertop",
      label: `Çimstone Calacatta Kuvars Tezgâh (38mm)`,
      dimensions: { width, height: ctopThickness, depth: depth + 26 },
      position: { x: 0, y: height, z: 0 },
      materialId: "mat_stone_calacatta",
      isFrontFacing: true,
      isManufacturablePanel: false,
    });
    components.push({
      id: `${module.id}_auto_backsplash_strip`,
      role: "countertop",
      label: `Tezgâh Arka Süpürgelik Çıtası (45×18mm)`,
      dimensions: { width, height: 45, depth: 18 },
      position: { x: 0, y: height + ctopThickness, z: 0 },
      materialId: "mat_stone_calacatta",
      isFrontFacing: true,
      isManufacturablePanel: false,
    });
  }

  const isSinkBase = tplLower.includes("sink") || nameLower.includes("evye");
  const isCooktopBase =
    tplLower.includes("cooktop") ||
    tplLower.includes("oven_base") ||
    nameLower.includes("ocak");
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

  // 7. Bays, Internal Dividers, Shelves, Rails, Drawers & All 12 V4 Door Systems
  let currentX = T;

  module.bays.forEach((bay, bayIdx) => {
    const bayW = bayWidths[bayIdx] || 0;
    const bayStartX = currentX;

    // Intermediate Divider
    if (bayIdx < module.bays.length - 1) {
      const dividerX = bayStartX + bayW;
      components.push({
        id: `${module.id}_divider_${bayIdx}`,
        role: "carcass_divider",
        label: `Ara Dikme ${bayIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: T, height: netInnerH, depth: netInnerD },
        position: { x: dividerX, y: plinthHeight + T, z: 20 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      });
    }

    // Shelves
    bay.shelves.forEach((shelf, sIdx) => {
      const shelfT = shelf.thickness || T;
      components.push({
        id: shelf.id || `${module.id}_bay_${bayIdx}_shelf_${sIdx}`,
        role: "shelf",
        label: `Raf B${bayIdx + 1}-${sIdx + 1} (${shelf.isAdjustable ? "Hareketli" : "Sabit"})`,
        bayIndex: bayIdx,
        dimensions: { width: bayW - 2, height: shelfT, depth: netInnerD - 10 },
        position: { x: bayStartX + 1, y: plinthHeight + T + shelf.elevationY, z: 20 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      });
    });

    // Mandatory fixed shelf directly above bottom drawer stack when upper bay space exists
    const bottomDrawersInBay = bay.drawers.filter((d) => d.elevationY < netInnerH * 0.55);
    if (bottomDrawersInBay.length > 0) {
      const maxDrawerTopEle = Math.max(...bottomDrawersInBay.map((d) => d.elevationY + d.height));
      const hasShelfAboveDrawers = bay.shelves.some(
        (s) => Math.abs(s.elevationY - maxDrawerTopEle) <= 55
      );
      if (!hasShelfAboveDrawers && maxDrawerTopEle + T + 80 < netInnerH) {
        components.push({
          id: `${module.id}_bay_${bayIdx}_drawer_top_shelf`,
          role: "shelf",
          label: `Çekmece Üstü Sabit Tabla B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: bayW - 2, height: T, depth: netInnerD - 10 },
          position: { x: bayStartX + 1, y: plinthHeight + T + maxDrawerTopEle, z: 20 },
          materialId: bodyMaterialId,
          isManufacturablePanel: true,
          thicknessAxis: "y",
        });
      }
    }

    // Hanging Rails
    bay.hangingRails.forEach((rail, rIdx) => {
      components.push({
        id: rail.id || `${module.id}_bay_${bayIdx}_rail_${rIdx}`,
        role: "hanging_rail",
        label: `Askı Borusu B${bayIdx + 1}-${rIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: bayW, height: 25, depth: 15 },
        position: { x: bayStartX, y: plinthHeight + T + rail.elevationY, z: depth / 2 },
        materialId: "mat_metal_chrome",
        isManufacturablePanel: false,
      });
    });

    // Special Fittings (World-Brand Hardware / Metal Accessories — NOT wooden shelves!)
    const fittingBrandLabels: Record<string, string> = {
      trouser_rack: "Häfele Teleskopik Pantolonluk [807.95.122]",
      shoe_rack: "Häfele Eğimli Ayakkabılık [807.96.310]",
      wire_basket: "Häfele Frenli Tel Sepet [807.52.220]",
      wardrobe_lift: "Servetto Gardırop Asansörü 10kg [805.20.232]",
      jewelry_tray: "Häfele Kadife Takı & Saat Çekmecesi [807.88.150]",
      corner_lemans: "Kesseböhmer LeMans II Kör Köşe [541.32.240]",
      pantry_pullout: "Kesseböhmer Dispensa Boy Kiler [545.13.251]",
      waste_bin: "Häfele Raylı Çöp Sistemi [502.70.252]",
      spice_pullout: "Kesseböhmer Teleskopik Şişelik [545.61.211]",
      cutlery_tray: "Blum AMBIA-LINE Çatal-Kaşık [556.86.322]",
      tie_rack: "Häfele Yandan Çıkışlı Kravatlık",
      led_profile: "Häfele Loox5 Raf/Üst Gömme LED Kanal 3000K [833.74.700]",
      led_vertical_strip: "Häfele Loox5 Yan Dikme Boy LED Kanal 3000K [833.74.710]",
      led_rod_strip: "Häfele Loox5 Sensörlü LED Askı Borusu 3000K [833.72.810]",
    };
    bay.specialFittings?.forEach((fit, fIdx) => {
      const baseId = fit.id || `${module.id}_bay_${bayIdx}_fit_${fIdx}`;
      const brandLabel = fittingBrandLabels[fit.type] || `Özel Donanım (${fit.type})`;
      const fitW = Math.max(80, bayW - 20);
      const fitD = Math.max(120, netInnerD - 40);
      const fitX = bayStartX + 10;
      const fitY = plinthHeight + T + fit.elevationY;
      const fitZ = 30;

      const isLedFitting =
        fit.type === "led_profile" ||
        fit.type === "led_vertical_strip" ||
        fit.type === "led_rod_strip";

      // Primary interactive component (for LED fittings, use a sleek 3000K warm emissive LED bar instead of a full-bay chrome box!)
      components.push({
        id: baseId,
        role: "special_fitting",
        label: `${brandLabel} B${bayIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: isLedFitting
          ? fit.type === "led_vertical_strip"
            ? { width: 14, height: Math.max(160, netInnerH - 40), depth: 18 }
            : { width: Math.max(60, bayW - 12), height: 14, depth: 22 }
          : { width: fitW, height: fit.height, depth: fitD },
        position: isLedFitting
          ? fit.type === "led_vertical_strip"
            ? { x: bayStartX + 3, y: plinthHeight + T + 20, z: Math.max(60, depth - 85) }
            : fit.type === "led_rod_strip"
            ? { x: bayStartX + 6, y: fitY, z: depth / 2 }
            : { x: bayStartX + 6, y: plinthHeight + T + netInnerH - 16, z: Math.max(80, depth - 110) }
          : { x: fitX, y: fitY, z: fitZ },
        materialId: isLedFitting ? "mat_led_warm_3000k" : "mat_metal_chrome",
        isManufacturablePanel: false,
      });

      // Detailed 3D mechanical sub-components per world-brand accessory type
      if (fit.type === "trouser_rack") {
        const rodCount = Math.max(4, Math.min(9, Math.floor((fitW - 40) / 65)));
        const stepX = (fitW - 40) / Math.max(1, rodCount - 1);
        for (let r = 0; r < rodCount; r++) {
          components.push({
            id: `${baseId}_sub_rod_${r + 1}`,
            role: "special_fitting",
            label: `Häfele Pantolon Askı Çubuğu #${r + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 10, height: 12, depth: Math.max(80, fitD - 24) },
            position: { x: fitX + 20 + Math.round(r * stepX), y: fitY + fit.height - 18, z: fitZ + 12 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          });
        }
      } else if (fit.type === "wardrobe_lift") {
        // Left & right side damper mechanisms + central vertical pull-down wand
        components.push(
          {
            id: `${baseId}_sub_damper_left`,
            role: "special_fitting",
            label: "Servetto Sol Amortisör Kutusu",
            bayIndex: bayIdx,
            dimensions: { width: 28, height: 140, depth: 95 },
            position: { x: bayStartX + 2, y: fitY, z: depth / 2 - 45 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${baseId}_sub_damper_right`,
            role: "special_fitting",
            label: "Servetto Sağ Amortisör Kutusu",
            bayIndex: bayIdx,
            dimensions: { width: 28, height: 140, depth: 95 },
            position: { x: bayStartX + bayW - 30, y: fitY, z: depth / 2 - 45 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${baseId}_sub_pull_wand`,
            role: "special_fitting",
            label: "Servetto Teleskopik Çekme Kolu",
            bayIndex: bayIdx,
            dimensions: { width: 14, height: Math.max(300, fit.height - 60), depth: 14 },
            position: { x: bayStartX + bayW / 2 - 7, y: fitY + 20, z: depth / 2 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          }
        );
      } else if (fit.type === "pantry_pullout") {
        // Kesseböhmer Dispensa 5-tier wire baskets along the tall frame
        const tiers = 5;
        const stepY = Math.floor((fit.height - 100) / Math.max(1, tiers - 1));
        for (let t = 0; t < tiers; t++) {
          components.push({
            id: `${baseId}_sub_basket_${t + 1}`,
            role: "special_fitting",
            label: `Kesseböhmer Dispensa Sepet #${t + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: Math.max(80, fitW - 24), height: 75, depth: Math.max(100, fitD - 20) },
            position: { x: fitX + 12, y: fitY + t * stepY, z: fitZ + 10 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        }
      } else if (fit.type === "corner_lemans") {
        // Kesseböhmer LeMans II pivot pole + 2 kidney swing trays
        components.push(
          {
            id: `${baseId}_sub_pivot_pole`,
            role: "special_fitting",
            label: "Kesseböhmer LeMans Döner Mil Ø35mm",
            bayIndex: bayIdx,
            dimensions: { width: 32, height: fit.height, depth: 32 },
            position: { x: fitX + fitW * 0.25, y: fitY, z: fitZ + fitD * 0.5 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          },
          {
            id: `${baseId}_sub_tray_upper`,
            role: "special_fitting",
            label: "Kesseböhmer LeMans II Üst Döner Tabla",
            bayIndex: bayIdx,
            dimensions: { width: Math.max(80, fitW - 30), height: 65, depth: Math.max(100, fitD - 30) },
            position: { x: fitX + 15, y: fitY + Math.round(fit.height * 0.58), z: fitZ + 15 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          }
        );
      } else if (fit.type === "waste_bin") {
        // Häfele dual waste bins (30L + 15L)
        const halfW = Math.max(40, Math.floor((fitW - 24) / 2));
        components.push(
          {
            id: `${baseId}_sub_bin_30l`,
            role: "special_fitting",
            label: "Häfele 30L Ana Çöp Kovası",
            bayIndex: bayIdx,
            dimensions: { width: halfW + 16, height: Math.max(120, fit.height - 36), depth: Math.max(100, fitD - 24) },
            position: { x: fitX + 6, y: fitY + 18, z: fitZ + 12 },
            materialId: "mat_anodized_metal",
            isManufacturablePanel: false,
          },
          {
            id: `${baseId}_sub_bin_15l`,
            role: "special_fitting",
            label: "Häfele 15L Geri Dönüşüm Kovası",
            bayIndex: bayIdx,
            dimensions: { width: Math.max(36, halfW - 16), height: Math.max(120, fit.height - 36), depth: Math.max(100, fitD - 24) },
            position: { x: fitX + halfW + 26, y: fitY + 18, z: fitZ + 12 },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          }
        );
      } else if (fit.type === "led_profile") {
        components.push({
          id: `${baseId}_sub_led_top`,
          role: "special_fitting",
          label: "Häfele Loox5 Üst Tabla Gömme LED 3000K",
          bayIndex: bayIdx,
          dimensions: { width: Math.max(60, bayW - 12), height: 10, depth: 18 },
          position: { x: bayStartX + 6, y: plinthHeight + T + netInnerH - 12, z: Math.max(80, depth - 110) },
          materialId: "mat_led_warm_3000k",
          isManufacturablePanel: false,
        });
        bay.shelves.forEach((sh, shIdx) => {
          components.push({
            id: `${baseId}_sub_led_sh_${shIdx}`,
            role: "special_fitting",
            label: `Häfele Loox5 Raf #${shIdx + 1} Altı Gömme LED 3000K`,
            bayIndex: bayIdx,
            dimensions: { width: Math.max(60, bayW - 12), height: 10, depth: 18 },
            position: { x: bayStartX + 6, y: plinthHeight + T + sh.elevationY - 10, z: Math.max(80, depth - 110) },
            materialId: "mat_led_warm_3000k",
            isManufacturablePanel: false,
          });
        });
      } else if (fit.type === "led_vertical_strip") {
        const vLedH = Math.max(160, netInnerH - 40);
        components.push(
          {
            id: `${baseId}_sub_led_vert_left`,
            role: "special_fitting",
            label: "Häfele Loox5 Sol Dikme Boy LED 3000K",
            bayIndex: bayIdx,
            dimensions: { width: 12, height: vLedH, depth: 16 },
            position: { x: bayStartX + 2, y: plinthHeight + T + 20, z: Math.max(60, depth - 85) },
            materialId: "mat_led_warm_3000k",
            isManufacturablePanel: false,
          },
          {
            id: `${baseId}_sub_led_vert_right`,
            role: "special_fitting",
            label: "Häfele Loox5 Sağ Dikme Boy LED 3000K",
            bayIndex: bayIdx,
            dimensions: { width: 12, height: vLedH, depth: 16 },
            position: { x: bayStartX + bayW - 14, y: plinthHeight + T + 20, z: Math.max(60, depth - 85) },
            materialId: "mat_led_warm_3000k",
            isManufacturablePanel: false,
          }
        );
      } else if (fit.type === "led_rod_strip") {
        components.push({
          id: `${baseId}_sub_led_rod`,
          role: "special_fitting",
          label: "Häfele Loox5 Sensörlü LED Askı Borusu 3000K",
          bayIndex: bayIdx,
          dimensions: { width: Math.max(60, bayW - 4), height: 28, depth: 18 },
          position: { x: bayStartX + 2, y: fitY, z: depth / 2 },
          materialId: "mat_led_warm_3000k",
          isManufacturablePanel: false,
        });
      }
    });

    // Sub-dividers
    bay.subDividers?.forEach((sub, sdIdx) => {
      const divT = sub.thickness || T;
      const clampedX = Math.max(40, Math.min(Math.max(60, bayW - divT - 40), sub.offsetX));
      components.push({
        id: sub.id || `${module.id}_bay_${bayIdx}_subdiv_${sdIdx}`,
        role: "carcass_sub_divider",
        label: `Raf Arası Dikme B${bayIdx + 1}-${sdIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: divT, height: sub.height, depth: netInnerD - 10 },
        position: {
          x: bayStartX + clampedX,
          y: plinthHeight + T + sub.elevationY,
          z: 20,
        },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      });
    });

    // Drawers with manufacturer cutting deduction support
    const bayLeafSpec = fourSpace.doorLeaves[bayIdx];
    const hasNoUpperDoor =
      Boolean(module.isOpenFront) ||
      !bay.door ||
      bay.door.type === "open" ||
      bay.door.doorSystemId === "open";
    bay.drawers.forEach((drawer, dIdx) => {
      const isExtDrawer = !drawer.isInternal;
      const isExtOverlay = isExtDrawer && bayLeafSpec?.overlayType !== "inset";
      const isLowestExtDrawer = isExtOverlay && drawer.elevationY <= 5;
      const isHighestDrawerInBay = !bay.drawers.some(
        (other) => other.id !== drawer.id && other.elevationY > drawer.elevationY
      );
      const isTopComboExtDrawer = isExtOverlay && drawer.elevationY >= netInnerH * 0.55;
      const isTopAtCabinetCeiling =
        isExtOverlay &&
        isHighestDrawerInBay &&
        (isTopComboExtDrawer ||
          (hasNoUpperDoor && drawer.elevationY + drawer.height >= netInnerH * 0.7));
      const extraCoverMm =
        isLowestExtDrawer || isTopComboExtDrawer ? Math.max(0, T - doorPerimeterGap) : 0;
      const drawerY0 = plinthHeight + T + drawer.elevationY;
      const frontX = isExtDrawer ? (bayLeafSpec?.doorX0Mm ?? bayStartX + 2) : bayStartX + 2;
      const frontY = isLowestExtDrawer ? plinthHeight + doorPerimeterGap : drawerY0 + 1.5;
      const cabinetTopAlignY =
        height - doorPerimeterGap - (bay.door.handleCategory === "gola_profile" ? 30 : 0);
      const frontH = isTopAtCabinetCeiling
        ? Math.max(40, cabinetTopAlignY - frontY)
        : Math.max(40, drawer.height + extraCoverMm - 3);
      const frontW = isExtDrawer
        ? Math.max(60, bayLeafSpec?.fullDoorSpanWidthMm || bayW - 4)
        : Math.max(60, bayW - 4);
      const pulledZ = drawerOpenMm;
      const frontZ = isExtDrawer
        ? (bayLeafSpec?.doorZ0Mm ?? depth) + pulledZ + explodeZ
        : depth - T + pulledZ + explodeZ - 24;
      const hwId = drawer.hardwareProductId || "";
      const isAvanTech = hwId === "hw_hettich_avantech_m";
      const isLegrabox = hwId.includes("legrabox");
      const isMovento = hwId.includes("movento");
      const isTandembox = hwId.includes("tandembox");
      const lengthDeductionMm = isTandembox ? 24 : isAvanTech ? 21 : 10;
      const bottomWidthDeductionMm = isTandembox
        ? 75
        : isMovento
        ? 42
        : isLegrabox
        ? 35
        : isAvanTech
        ? 24
        : 68;
      const backWidthDeductionMm = isTandembox
        ? 87
        : isMovento
        ? 42
        : isLegrabox
        ? 38
        : isAvanTech
        ? 24
        : 68;

      const maxBoxD = Math.max(120, frontZ - pulledZ - explodeZ - 24);
      const boxD = Math.min(
        maxBoxD,
        drawer.nominalLengthMm
          ? Math.min(netInnerD - 10, drawer.nominalLengthMm - lengthDeductionMm)
          : Math.min(500, Math.max(260, netInnerD - 50))
      );
      const boxH = Math.max(70, Math.min(220, drawer.height - 38));
      const boxT = isAvanTech || isLegrabox ? 13 : 16;
      const bottomT = isTandembox || isLegrabox || isAvanTech ? 16 : 8;
      // Respect manufacturer width deduction (24mm AvanTech, 35mm LEGRABOX, 42mm MOVENTO, 75mm TANDEMBOX)
      const sideClearance = isTandembox
        ? 21.5
        : isMovento
        ? 21
        : isLegrabox
        ? 17.5
        : isAvanTech
        ? 12
        : 18;
      const boxX0 = bayStartX + sideClearance;
      const boxW = Math.max(100, bayW - 2 * sideClearance);
      const bottomBoardW = hwId
        ? Math.max(80, bayW - bottomWidthDeductionMm)
        : Math.max(68, boxW - 2 * boxT);
      const backBoardW = hwId
        ? Math.max(80, bayW - backWidthDeductionMm)
        : Math.max(68, boxW - 2 * boxT);
      const boxZ0 = frontZ - boxD;

      // 1. Front Panel
      components.push({
        id: `${drawer.id}_front`,
        role: "drawer_front",
        label: `Çekmece Önü B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: frontW, height: frontH, depth: T },
        position: {
          x: frontX,
          y: frontY,
          z: frontZ,
        },
        materialId: drawer.frontMaterialId || doorMaterialId,
        isFrontFacing: true,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });

      // 3. Left Side Panel of Box
      components.push({
        id: `${drawer.id}_side_left`,
        role: "drawer_side_left",
        label: `Çekmece Sol Kasa B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: boxT, height: boxH, depth: boxD },
        position: { x: boxX0, y: drawerY0 + 8, z: boxZ0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      });

      // 4. Right Side Panel of Box
      components.push({
        id: `${drawer.id}_side_right`,
        role: "drawer_side_right",
        label: `Çekmece Sağ Kasa B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: boxT, height: boxH, depth: boxD },
        position: { x: boxX0 + boxW - boxT, y: drawerY0 + 8, z: boxZ0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "x",
      });

      // 5. Back Panel of Box
      components.push({
        id: `${drawer.id}_back`,
        role: "drawer_back",
        label: `Çekmece Arka Kasa B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: backBoardW, height: boxH, depth: boxT },
        position: { x: bayStartX + (bayW - backBoardW) / 2, y: drawerY0 + 8, z: boxZ0 },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "z",
      });

      // 6. Bottom Floor Board of Box
      components.push({
        id: `${drawer.id}_bottom`,
        role: "drawer_bottom",
        label: `Çekmece Tabanı B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: bottomBoardW, height: bottomT, depth: hwId ? boxD : boxD - boxT },
        position: { x: bayStartX + (bayW - bottomBoardW) / 2, y: drawerY0 + 8, z: boxZ0 + boxT },
        materialId: bodyMaterialId,
        isManufacturablePanel: true,
        thicknessAxis: "y",
      });

      // 7. Left & Right Undermount Slide Rails
      const slideZ0 = boxZ0 - (pulledZ > 0 ? pulledZ * 0.5 : 0);
      components.push({
        id: `${drawer.id}_slide_left`,
        role: "drawer_slide",
        label: `Çekmece Rayı Sol B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: 12, height: 16, depth: boxD },
        position: {
          x: bayStartX + 4,
          y: drawerY0 + 2,
          z: slideZ0,
        },
        materialId: "mat_anodized_metal",
        isManufacturablePanel: false,
      });

      components.push({
        id: `${drawer.id}_slide_right`,
        role: "drawer_slide",
        label: `Çekmece Rayı Sağ B${bayIdx + 1}-${dIdx + 1}`,
        bayIndex: bayIdx,
        dimensions: { width: 12, height: 16, depth: boxD },
        position: {
          x: bayStartX + bayW - 16,
          y: drawerY0 + 2,
          z: slideZ0,
        },
        materialId: "mat_anodized_metal",
        isManufacturablePanel: false,
      });
    });

    // Doors — Consuming Canonical 4-Space Door Leaf Geometry
    if (!module.isOpenFront && bay.door && bay.door.type !== "open" && bay.door.doorSystemId !== "open") {
      const dType = bay.door.type;
      const dSys = bay.door.doorSystemId || inferDoorSystemIdFromType(dType);
      const leafSpec = fourSpace.doorLeaves[bayIdx];
      const isInset = leafSpec.overlayType === "inset";
      const isHalfOverlay = leafSpec.overlayType === "half_overlay";

      const doorH = leafSpec.baseDoorHeightMm;
      const doorY = leafSpec.doorY0Mm;
      const doorZ = leafSpec.doorZ0Mm + explodeZ;
      const fullDoorW = leafSpec.fullDoorSpanWidthMm;
      const doorX0 = leafSpec.doorX0Mm;
      const T_door = leafSpec.leafThicknessMm;
      const rad = (doorOpenAngleDeg * Math.PI) / 180;
      const openRatio = Math.min(1, Math.max(0, doorOpenAngleDeg / 90));
      const doorMatId = bay.door.doorMaterialId || doorMaterialId;

      const isHingedDoubleSplit =
        dSys === "hinged_double" ||
        dType === "double" ||
        dType === "inset_double" ||
        (!dSys.startsWith("sliding") &&
          !dSys.startsWith("lift_") &&
          dSys !== "folding_side" &&
          dType !== "folding" &&
          dSys !== "pocket_retractable" &&
          dType !== "pocket" &&
          dSys !== "tambour_roller" &&
          dType !== "tambour" &&
          leafSpec.leafCount === 2);

      if (isHingedDoubleSplit) {
        const leafW = leafSpec.leafWidthMm;
        components.push({
          id: `${bay.door.id}_leaf_left`,
          role: "door_left",
          label: `Çift Kapak Sol B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: leafW, height: doorH, depth: T_door },
          position: { x: doorX0, y: doorY, z: doorZ },
          rotation: [0, -rad, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        components.push({
          id: `${bay.door.id}_leaf_right`,
          role: "door_right",
          label: `Çift Kapak Sağ B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: leafW, height: doorH, depth: T_door },
          position: { x: doorX0 + leafW + leafSpec.centerRevealGapMm, y: doorY, z: doorZ },
          rotation: [0, rad, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      } else if (dSys === "sliding_top_hung" || dSys === "sliding_bottom_rolling" || dType === "sliding") {
        const slideOffset = openRatio * (bayW * 0.75);
        const doorW = leafSpec.leafWidthMm;
        const trackZOffset = dSys === "sliding_bottom_rolling" ? -18 : bayIdx % 2 === 0 ? 0 : 25;
        components.push({
          id: `${bay.door.id}_sliding`,
          role: "door_left",
          label: `${dSys === "sliding_bottom_rolling" ? "Alttan Sürgülü" : "Üstten Sürgülü"} Kapak B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: doorW, height: doorH, depth: T_door },
          position: {
            x: bayStartX - (bayIdx === 0 ? T : 0) + slideOffset,
            y: doorY,
            z: doorZ + trackZOffset,
          },
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      } else if (dSys === "lift_up_stay" || dType === "lift_up_stay") {
        components.push({
          id: `${bay.door.id}_lift_stay`,
          role: "door_left",
          label: `Yukarı Kalkar Kapak (HK top) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: doorH, depth: T_door },
          position: {
            x: doorX0,
            y: doorY,
            z: doorZ,
          },
          rotation: [-rad * 0.95, 0, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        // Real 3D Blum AVENTOS HK top Power Units & Telescopic Stay Arms (Left & Right Side Panels)
        const mechH = Math.min(130, Math.max(80, doorH * 0.36));
        const mechD = Math.min(210, Math.max(110, netInnerD * 0.62));
        const mechY = doorY + Math.max(30, doorH - mechH - 22);
        const mechZ = Math.max(24, depth - mechD - 16);
        [-1, 1].forEach((sideSign) => {
          const isRightSide = sideSign === 1;
          components.push({
            id: `${bay.door.id}_aventos_mech_hk_${isRightSide ? "right" : "left"}`,
            role: "special_fitting",
            label: `Blum AVENTOS HK top Güç Ünitesi & Kaldırma Kolu (${isRightSide ? "Sağ" : "Sol"}) B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 32, height: mechH, depth: mechD },
            position: {
              x: isRightSide ? bayStartX + bayW - 34 : bayStartX + 2,
              y: mechY,
              z: mechZ,
            },
            rotation: [-rad * 0.45, 0, 0],
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        });
      } else if (dSys === "lift_parallel") {
        // WP-04: 4-bar parallelogram linkage arc (AVENTOS HL top)
        const armRadius = Math.min(220, doorH * 0.52);
        const linkAngle = openRatio * (Math.PI * 0.62);
        const liftDy = Math.round(armRadius * (1 - Math.cos(linkAngle)) + openRatio * (doorH * 0.32));
        const liftDz = Math.round(armRadius * Math.sin(linkAngle));
        components.push({
          id: `${bay.door.id}_lift_parallel`,
          role: "door_left",
          label: `Paralel Kalkar Kapak (HL top) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: doorH, depth: T_door },
          position: {
            x: doorX0,
            y: doorY + liftDy,
            z: doorZ + liftDz,
          },
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        // Real 3D Blum AVENTOS HL top 4-Bar Parallelogram Power Units & Arms (Left & Right)
        const mechH = Math.min(140, Math.max(85, doorH * 0.38));
        const mechD = Math.min(220, Math.max(120, netInnerD * 0.65));
        const mechY = doorY + Math.max(30, doorH - mechH - 24);
        const mechZ = Math.max(24, depth - mechD - 14);
        [-1, 1].forEach((sideSign) => {
          const isRightSide = sideSign === 1;
          components.push({
            id: `${bay.door.id}_aventos_mech_hl_${isRightSide ? "right" : "left"}`,
            role: "special_fitting",
            label: `Blum AVENTOS HL top Paralel Mekanizma (${isRightSide ? "Sağ" : "Sol"}) B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 32, height: mechH, depth: mechD + Math.round(liftDz * 0.7) },
            position: {
              x: isRightSide ? bayStartX + bayW - 34 : bayStartX + 2,
              y: mechY,
              z: mechZ,
            },
            rotation: [-linkAngle * 0.42, 0, 0],
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        });
      } else if (dSys === "lift_bi_fold") {
        // WP-04: Coupled 2-leaf bi-fold linkage (AVENTOS HF top)
        const halfH = leafSpec.leafHeightMm;
        const thetaTop = rad * 0.96;
        const thetaBot = rad * 0.58;
        const topPivotY = doorY + halfH + doorPerimeterGap;
        const midJointRiseY = Math.round(halfH * (1 - Math.cos(thetaTop)) * 0.72);
        const midJointOutZ = Math.round(halfH * Math.sin(thetaTop) * 0.78);
        components.push({
          id: `${bay.door.id}_lift_bifold_top`,
          role: "door_left",
          label: `Katlanır Kalkar Üst Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: halfH, depth: T_door },
          position: {
            x: doorX0,
            y: topPivotY + midJointRiseY * 0.55,
            z: doorZ + midJointOutZ * 0.75,
          },
          rotation: [-thetaTop, 0, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        components.push({
          id: `${bay.door.id}_lift_bifold_bot`,
          role: "door_right",
          label: `Katlanır Kalkar Alt Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: halfH, depth: T_door },
          position: {
            x: doorX0,
            y: doorY + midJointRiseY + Math.round(openRatio * halfH * 0.55),
            z: doorZ + midJointOutZ,
          },
          rotation: [thetaBot, 0, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        // Real 3D Blum AVENTOS HF top Bi-Fold Power Units, Telescopic Arms & Center Knuckle Hinges (Left & Right)
        const mechH = Math.min(145, Math.max(90, doorH * 0.34));
        const mechD = Math.min(230, Math.max(120, netInnerD * 0.66));
        const mechY = doorY + Math.max(40, doorH - mechH - 22);
        const mechZ = Math.max(24, depth - mechD - 14);
        [-1, 1].forEach((sideSign) => {
          const isRightSide = sideSign === 1;
          components.push({
            id: `${bay.door.id}_aventos_mech_hf_${isRightSide ? "right" : "left"}`,
            role: "special_fitting",
            label: `Blum AVENTOS HF top Katlanır Teleskopik Mekanizma (${isRightSide ? "Sağ" : "Sol"}) B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 32, height: mechH, depth: mechD + Math.round(midJointOutZ * 0.75) },
            position: {
              x: isRightSide ? bayStartX + bayW - 34 : bayStartX + 2,
              y: mechY,
              z: mechZ,
            },
            rotation: [-thetaTop * 0.45, 0, 0],
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        });
      } else if (dSys === "folding_side" || dType === "folding") {
        // WP-04: Coupled side-folding wing kinematics (WingLine L)
        const wingW = leafSpec.leafWidthMm;
        const thetaWing = rad * 0.94;
        const jointX = doorX0 + Math.round(wingW * Math.cos(thetaWing)) + doorPerimeterGap;
        const jointZ = doorZ + Math.round(wingW * Math.sin(thetaWing) * 0.82);
        components.push({
          id: `${bay.door.id}_fold_wing_1`,
          role: "door_left",
          label: `Katlanır Sol Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: wingW, height: doorH, depth: T_door },
          position: { x: doorX0, y: doorY, z: doorZ },
          rotation: [0, -thetaWing, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        components.push({
          id: `${bay.door.id}_fold_wing_2`,
          role: "door_right",
          label: `Katlanır Orta Kanat B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: wingW, height: doorH, depth: T_door },
          position: {
            x: jointX,
            y: doorY,
            z: jointZ,
          },
          rotation: [0, thetaWing * 0.92, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      } else if (dSys === "pocket_retractable" || dType === "pocket") {
        // WP-04: Two-stage pivot (0..35%) then linear pocket retraction (35..100%)
        const pivotPhase = Math.min(1, openRatio / 0.35);
        const retractPhase = openRatio > 0.35 ? (openRatio - 0.35) / 0.65 : 0;
        const pocketYawRad = -pivotPhase * (Math.PI / 2);
        const retractZ = Math.round(retractPhase * Math.min(500, depth * 0.76));
        components.push({
          id: `${bay.door.id}_pocket_leaf`,
          role: "door_left",
          label: `Pocket Gizlenen Kapak B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: doorH, depth: T_door },
          position: {
            x: doorX0 + Math.round(pivotPhase * 22),
            y: doorY,
            z: doorZ - retractZ,
          },
          rotation: [0, pocketYawRad, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
        if (openRatio > 0.05) {
          components.push({
            id: `${bay.door.id}_revego_pocket_track`,
            role: "special_fitting",
            label: `REVEGO Pocket Taşıyıcı Ray B${bayIdx + 1}`,
            bayIndex: bayIdx,
            dimensions: { width: 16, height: 24, depth: Math.max(200, depth - 60) },
            position: {
              x: bayStartX + 6,
              y: doorY + doorH - 28,
              z: T + 20,
            },
            materialId: "mat_metal_chrome",
            isManufacturablePanel: false,
          });
        }
      } else if (dSys === "tambour_roller" || dType === "tambour") {
        const visibleH = Math.max(60, doorH * (1 - openRatio * 0.82));
        components.push({
          id: `${bay.door.id}_tambour_curtain`,
          role: "door_left",
          label: `Tambur Panjur Kapak (Önizleme) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: visibleH, depth: T_door },
          position: {
            x: doorX0,
            y: doorY + (doorH - visibleH),
            z: doorZ - 8,
          },
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      } else {
        const isRight = dType === "single_right" || dType === "inset_right" || dType === "half_overlay_right";
        components.push({
          id: `${bay.door.id}_${isRight ? "right" : "left"}`,
          role: isRight ? "door_right" : "door_left",
          label: `Kapak ${isRight ? "Sağ" : "Sol"}${isInset ? " (İçten)" : isHalfOverlay ? " (Yarım Bini)" : ""} B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: fullDoorW, height: doorH, depth: T_door },
          position: { x: doorX0, y: doorY, z: doorZ },
          rotation: [0, isRight ? rad : -rad, 0],
          materialId: doorMatId,
          isFrontFacing: true,
          isManufacturablePanel: true,
          thicknessAxis: "z",
        });
      }
    }

    currentX += bayW + T;
  });

  // Explicit motion transforms are consumed identically by both renderers and 2D.
  const fronts = components.filter(c => c.role === "door_left" || c.role === "door_right" || c.role === "drawer_front");
  for (const front of fronts) {
    const bayIdx = front.bayIndex ?? 0;
    const bay = module.bays[bayIdx];
    const leafSpec = fourSpace.doorLeaves[bayIdx];
    if (front.rotation) {
      const topPivot = front.rotation[0] !== 0;
      const isRightEdgeHinge =
        front.role === "door_right" && !topPivot && !front.id.includes("fold_wing_2");
      front.pivot = {
        x: front.position.x + (isRightEdgeHinge ? front.dimensions.width : 0),
        y: front.position.y + (topPivot ? front.dimensions.height : 0),
        z: front.position.z + (topPivot ? 0 : front.dimensions.depth),
      };
    }
    if (front.role === "drawer_front" && bay.drawers.find(d => `${d.id}_front` === front.id)?.isInternal) continue;
    const category = bay.door.handleCategory ?? (bay.door.handleType === "none" || bay.door.handleType === "push_to_open" ? "handleless_plain" : "bar_handle");
    components.push(
      ...generateHandleGeometry(front, category, {
        moduleCategory: module.category,
        moduleElevationY: module.position.y,
        moduleHeight: module.dimensions.height,
      })
    );

    // Emit visible 3D/2D concealed hinge cups & mounting plates along the hinge edge of hinged doors
    const dSys = bay.door.doorSystemId || inferDoorSystemIdFromType(bay.door.type);
    const isHingedLeaf =
      (front.role === "door_left" || front.role === "door_right") &&
      !dSys.startsWith("sliding") &&
      !dSys.startsWith("lift") &&
      dSys !== "tambour_roller" &&
      !front.id.includes("fold_wing_2");
    if (isHingedLeaf && leafSpec && leafSpec.hingePositionsY.length > 0) {
      const isRightHinge = front.role === "door_right";
      const hwBrand = bay.door.hardwareProductId?.includes("hettich")
        ? "Hettich Sensys"
        : bay.door.hardwareProductId?.includes("salice")
        ? "Salice Silentia+"
        : "Blum CLIP top";
      leafSpec.hingePositionsY.forEach((hy, hIdx) => {
        const hingeW = 28;
        const hingeH = 64;
        const hingeD = 38;
        const hx = isRightHinge
          ? front.position.x + front.dimensions.width - hingeW - 2
          : front.position.x + 2;
        const absY = front.position.y + hy - hingeH / 2;
        const hz = front.position.z - hingeD + 4;
        components.push({
          id: `${front.id}_hinge_${hIdx + 1}`,
          role: "door_hinge",
          label: `${hwBrand} Menteşe #${hIdx + 1} (Y:${hy}mm) B${bayIdx + 1}`,
          bayIndex: bayIdx,
          dimensions: { width: hingeW, height: hingeH, depth: hingeD },
          position: { x: hx, y: absY, z: hz },
          rotation: front.rotation,
          pivot: front.pivot,
          parentComponentId: front.id,
          materialId: "mat_metal_chrome",
          isManufacturablePanel: false,
        });
      });
    }
  }

  const result: ModuleGeometryBreakdown = {
    moduleId: module.id,
    overall: module.dimensions,
    components,
    bayWidths,
    netInnerHeight: netInnerH,
    netInnerDepth: netInnerD,
  };
  if (moduleGeometryCache.size > 400) {
    moduleGeometryCache.clear();
  }
  moduleGeometryCache.set(cacheKey, result);
  return result;
}

export function generateMultiModuleGeometry(
  modules: ModuleInstance[],
  options: GenerateGeometryOptions = {}
): ModuleGeometryBreakdown[] {
  return modules.map((m) => generateModuleGeometry(m, options));
}
