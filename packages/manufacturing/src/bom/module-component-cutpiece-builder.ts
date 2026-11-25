import {
  DesignProject,
  MaterialDefinition,
  ModuleInstance,
  ParametricPart,
  calculateFourSpaceDimensions,
  calculateRecommendedHingesPerLeaf,
  computeProjectGrainContinuityMap,
  inferDoorSystemIdFromType,
  computeGolaSidePanelNotches,
  computeDividerTJunctionYs,
  isSinkModule,
  isCooktopModule,
  roundIntMm,
  roundMm,
  resolveCanonicalHandlePlacement,
  resolveMultiHoleSpec,
  resolveKlapaAndHingeBehavior,
  resolveInternalDrawerHingeClearance,
} from "@birim/core";
import type { generateModuleGeometry } from "@birim/geometry";
import {
  getHardwareProductById,
  HANDLE_PROFILES,
  getAllHandleProfiles,
  selectOptimalRunnerLengthMm,
} from "@birim/catalog";
import { CutPiece, EdgeBandingConfig, HardwareBOMItem } from "../types";
import { generateDrillingForPart } from "../drilling-engine";
import { doesBayDoorHingeOnLeft, doesBayDoorHingeOnRight, formatEdgeBandCode, hasSinkOrCooktopAppliance } from "./bom-helpers-and-kerf";

export interface ModuleComponentCutPieceContext {
  geo: ReturnType<typeof generateModuleGeometry>;
  addHardware: (
    sku: string,
    name: string,
    category: HardwareBOMItem["category"],
    quantity: number,
    unit?: HardwareBOMItem["unit"],
    unitPrice?: number
  ) => void;
  materialsMap: Map<string, MaterialDefinition>;
  bodyMat: MaterialDefinition;
  module: ModuleInstance;
  hasGroovedBack: boolean;
  fourSpace: ReturnType<typeof calculateFourSpaceDimensions>;
  project: DesignProject;
  doorMat: MaterialDefinition;
  bayMechanismAdded: Set<number>;
  grainContinuityMap: ReturnType<typeof computeProjectGrainContinuityMap>;
  validationWarnings: string[];
  cutList: CutPiece[];
}

export function appendModuleComponentCutPiecesAndHardware(ctx: ModuleComponentCutPieceContext): number {
  const {
    geo,
    addHardware,
    materialsMap,
    bodyMat,
    module,
    hasGroovedBack,
    fourSpace,
    project,
    doorMat,
    bayMechanismAdded,
    grainContinuityMap,
    validationWarnings,
    cutList,
  } = ctx;
  let addedDrillingHolesCount = 0;
    geo.components.forEach((comp) => {
      if (comp.role === "hanging_rail") {
        addHardware(
          "HW_HANGING_RAIL",
          `Oval Alüminyum Elbise Askı Borusu ${comp.dimensions.width}mm`,
          "rod",
          1,
          "adet",
          4.5
        );
        addHardware(
          "HW_RAIL_SOCKET",
          "Askı Borusu Flanşı (Sağ-Sol Takım)",
          "connector",
          1,
          "takım",
          1.8
        );
        return;
      }
      if (comp.role === "gola_profile") {
        const cid = comp.id;
        if (
          !cid.includes("melamine_box") &&
          !cid.includes("moulded_box") &&
          !cid.includes("bevel_backing")
        ) {
          const spanMm = Math.max(comp.dimensions.width, comp.dimensions.height);
          const spanM = roundMm(spanMm / 1000, 2);
          const sku = cid.includes("gola_c_channel")
            ? "GOLA-C-73"
            : cid.includes("gola_wall_268")
            ? "GOLA-W-268"
            : cid.includes("gola_vertical")
            ? "GOLA-V-1020"
            : "GOLA-L-56";
          const name = cid.includes("gola_c_channel")
            ? "Alüminyum Orta Yatay Gola C-Profil (73.5×26mm)"
            : cid.includes("gola_wall_268")
            ? "Alüminyum Üst Dolap Gömme Gola 268 Profil (18×26mm)"
            : cid.includes("gola_vertical")
            ? "Alüminyum Boy Dikey Gola 1020 Profil (56×26mm)"
            : "Alüminyum Üst Yatay Gola L-Profil (56×26mm)";
          addHardware(sku, name, "handle", spanM, "metre", 14.5);
        }
        return;
      }
      if (comp.id.includes("_gola_fixing_bracket_")) {
        addHardware(
          "712.63.511",
          "Gola Gövde Sabitleyici L-Klips Montaj Aparatı (Scilm SU116 / Häfele)",
          "connector",
          1,
          "adet",
          0.95
        );
        return;
      }
      if (
        comp.isManufacturablePanel === false ||
        comp.role === "door_handle" ||
        comp.role === "door_hinge" ||
        comp.role === "drawer_handle" ||
        comp.role === "drawer_slide" ||
        comp.role === "special_fitting"
      ) {
        return;
      }

      let mat = materialsMap.get(comp.materialId) || bodyMat;
      const customGrain =
        module.componentGrainOverrides?.[comp.id] || module.componentGrainOverrides?.__all__;
      let grain: CutPiece["grain"] = mat.hasGrain
        ? customGrain === "crosswise"
          ? "crosswise"
          : "lengthwise"
        : "none";
      const defaultEbThickness = module.carcass.edgeBandThickness || 1;
      let edgeBanding: EdgeBandingConfig = {
        top: false,
        bottom: false,
        left: false,
        right: false,
        thickness: defaultEbThickness,
      };

      // Local Panel Coordinate System:
      // length (`lengthMm`, Y-axis 0..h) = primary/long span;
      // width (`widthMm`, X-axis 0..w) = secondary/depth span.
      // Edge Banding Convention:
      // left (x=0) & right (x=w) run along lengthMm (Boy/B);
      // bottom (y=0) & top (y=h) run along widthMm (En/E).
      let length = comp.dimensions.height;
      let width = comp.dimensions.depth;
      const bayIdx = comp.bayIndex ?? 0;
      const bay = module.bays[bayIdx] || module.bays[0];
      const dSys = bay
        ? bay.door.doorSystemId || inferDoorSystemIdFromType(bay.door.type)
        : "open";
      const isInsetDoor = Boolean(
        bay?.door.overlayType === "inset" ||
          dSys === "hinged_inset" ||
          bay?.door.type.startsWith("inset")
      );

      let mirrorInnerFaceX = false;
      let partHingePositionsY: number[] | undefined;
      let partHingePositionsBackY: number[] | undefined;
      let bottomJointOffsetY = 0;
      let hasPartBackGroove = false;
      let hasSinkOrHobCutout = false;
      const countertopCutouts: import("@birim/core").PanelCutoutConfig[] = [];
      let cutoutWidthMm: number | undefined;
      let cutoutDepthMm: number | undefined;

      if (comp.role.includes("side") && !comp.role.includes("drawer")) {
        length = comp.dimensions.height;
        width = comp.thicknessAxis === "z" ? comp.dimensions.width : comp.dimensions.depth;
        const isRightSide = comp.role === "carcass_side_right";
        mirrorInnerFaceX = isRightSide && module.category !== "complementary";
        hasPartBackGroove = hasGroovedBack;
        // Mirrored right side panel has its front edge at x = w (right: true), left side panel at x = 0 (left: true)
        edgeBanding = {
          top: false,
          bottom: true,
          left: !mirrorInnerFaceX,
          right: mirrorInnerFaceX,
          thickness: defaultEbThickness,
        };

        if (module.category !== "complementary") {
          const sideBottomY = comp.position.y || 0;
          bottomJointOffsetY = Math.max(0, roundMm((module.carcass.plinthHeight || 0) - sideBottomY));

          const hostBayIdx = isRightSide ? Math.max(0, module.bays.length - 1) : 0;
          const hostBay = module.bays[hostBayIdx];
          const hostLeaf = fourSpace.doorLeaves[hostBayIdx];
          const shouldDrillHingeMounts = isRightSide
            ? doesBayDoorHingeOnRight(hostBay)
            : doesBayDoorHingeOnLeft(hostBay);

          if (shouldDrillHingeMounts && hostLeaf && hostLeaf.hingePositionsY.length > 0) {
            const verticalOffsetToDoor = Math.max(0, hostLeaf.doorY0Mm - sideBottomY);
            partHingePositionsY = hostLeaf.hingePositionsY.map((hy) =>
              roundMm(verticalOffsetToDoor + hy, 2)
            );
          } else {
            partHingePositionsY = [];
          }
        }
      } else if (comp.role === "carcass_bottom" || comp.role === "carcass_top") {
        const isVertStretcher = comp.thicknessAxis === "z";
        const isStretcherStrip = comp.id.includes("_top_stretcher_");
        if (comp.cncBlankOverride) {
          length = comp.cncBlankOverride.lengthMm;
          width = comp.cncBlankOverride.widthMm;
          cutoutWidthMm = comp.cncBlankOverride.notchWidthMm;
          cutoutDepthMm = comp.cncBlankOverride.notchDepthMm;
          hasSinkOrHobCutout = true;
        } else {
          length = comp.dimensions.width;
          width = isVertStretcher ? comp.dimensions.height : comp.dimensions.depth;
        }
        // Front or vertical kitchen stretchers NEVER receive a rear back-panel groove!
        hasPartBackGroove = hasGroovedBack && (!isStretcherStrip || comp.id.includes("_top_stretcher_rear"));
        edgeBanding = {
          top: false,
          bottom: false,
          left: true,
          right: isStretcherStrip && !isVertStretcher,
          thickness: defaultEbThickness,
        };
      } else if (comp.role === "carcass_divider" || comp.role === "carcass_sub_divider") {
        length = comp.dimensions.height;
        width = comp.thicknessAxis === "z" ? comp.dimensions.width : comp.dimensions.depth;
        const isBlindFrontFiller = comp.id.includes("_blind_front_");
        edgeBanding = {
          top: false,
          bottom: false,
          left: true,
          right: isBlindFrontFiller,
          thickness: defaultEbThickness,
        };
        if (comp.role === "carcass_divider" && typeof comp.bayIndex === "number") {
          const leftBay = module.bays[comp.bayIndex];
          const rightBay = module.bays[comp.bayIndex + 1];
          const leftLeaf = fourSpace.doorLeaves[comp.bayIndex];
          const rightLeaf = fourSpace.doorLeaves[comp.bayIndex + 1];
          const divBottomY = comp.position.y || (module.carcass.plinthHeight || 0) + (module.carcass.panelThickness || 18);

          partHingePositionsY =
            doesBayDoorHingeOnRight(leftBay) && leftLeaf
              ? leftLeaf.hingePositionsY.map((hy) =>
                  roundMm(Math.max(0, leftLeaf.doorY0Mm - divBottomY + hy), 2)
                )
              : [];
          partHingePositionsBackY =
            doesBayDoorHingeOnLeft(rightBay) && rightLeaf
              ? rightLeaf.hingePositionsY.map((hy) =>
                  roundMm(Math.max(0, rightLeaf.doorY0Mm - divBottomY + hy), 2)
                )
              : [];
        }
      } else if (comp.role === "carcass_back") {
        length = comp.dimensions.height;
        width = comp.thicknessAxis === "x" ? comp.dimensions.depth : comp.dimensions.width;
        grain = "none";
        edgeBanding = { top: false, bottom: false, left: false, right: false, thickness: 0 };
      } else if (comp.role === "shelf") {
        if (comp.cncBlankOverride) {
          length = comp.cncBlankOverride.lengthMm;
          width = comp.cncBlankOverride.widthMm;
          cutoutWidthMm = comp.cncBlankOverride.notchWidthMm;
          cutoutDepthMm = comp.cncBlankOverride.notchDepthMm;
          hasSinkOrHobCutout = true;
        } else {
          length = comp.dimensions.width;
          width = comp.dimensions.depth;
        }
        edgeBanding = {
          top: false,
          bottom: false,
          left: true,
          right: false,
          thickness: defaultEbThickness,
        };
        const isFixedOrApplianceShelf =
          comp.label.includes("Sabit") || comp.label.includes("Taşıyıcı Tabla");
        const isRafixShelf = comp.label.includes("Rafix");
        if (isFixedOrApplianceShelf && isRafixShelf) {
          addHardware(
            "HW_RAFIX_20_SET",
            "Häfele Rafix 20 Sabit Raf Gövdesi + Ø5mm Pim [262.34.502]",
            "connector",
            4,
            "adet",
            0.55
          );
        } else if (isFixedOrApplianceShelf) {
          addHardware(
            "HW_MINIFIX_SET",
            "Häfele Minifix 15 + Mil Bağlantı Elemanı",
            "connector",
            4,
            "adet",
            0.45
          );
          addHardware("HW_DOWEL_8X35", "Ahşap Kavela 8x35mm", "fastener", 4, "adet", 0.05);
        } else {
          addHardware(
            "HW_SHELF_PIN",
            "Kilitli Raf Pimi 5mm (Häfele)",
            "fastener",
            4,
            "adet",
            0.15
          );
        }
      } else if (comp.role === "countertop") {
        mat = materialsMap.get(comp.materialId) || bodyMat;
        // Waterfall vertical leg has thicknessAxis === "x" (width=40mm thickness, height=legH, depth=tableDepth)!
        if (comp.thicknessAxis === "x") {
          length = comp.dimensions.height;
          width = comp.dimensions.depth;
        } else {
          length = comp.dimensions.width;
          width = comp.dimensions.depth;
          // Angled attached table scarf/miter joint blank allowance so angled cut sits flush against island without overlapping!
          const tblAngle = module.attachedTableConfig?.angleDeg ?? 0;
          if (module.complementaryRole === "attached_table" && Math.abs(tblAngle) % 90 !== 0) {
            const rad = Math.min(Math.PI / 3, Math.abs((tblAngle * Math.PI) / 180));
            const scarfAllowance = Math.ceil(width * 0.5 * Math.tan(rad));
            length += scarfAllowance;
          }
        }
        const isStoneOrCompact = mat.category === "stone" || mat.category === "compact";
        edgeBanding = isStoneOrCompact
          ? { top: false, bottom: false, left: false, right: false, thickness: 0 }
          : { top: true, bottom: true, left: true, right: false, thickness: 2 };

        // Compute exact per-appliance CNC apertures along continuous or single countertops!
        if (length >= 520 && width >= 460) {
          if (module.category === "complementary" && module.complementaryRole === "countertop") {
            const ctopStartX = module.position.x;
            const ctopEndX = ctopStartX + length;
            const ctopRot = (((module.rotation?.y ?? 0) % 360) + 360) % 360;
            project.modules.forEach((cand) => {
              if (cand.id === module.id || cand.category === "complementary") return;
              const candRot = (((cand.rotation?.y ?? 0) % 360) + 360) % 360;
              if (Math.abs(candRot - ctopRot) > 5) return;
              const isSink = isSinkModule(cand);
              const isHob = isCooktopModule(cand) || (!isSink && hasSinkOrCooktopAppliance(cand));
              if (!isSink && !isHob) return;
              const candCenterAlong = cand.position.x + cand.dimensions.width / 2;
              if (candCenterAlong >= ctopStartX - 25 && candCenterAlong <= ctopEndX + 25) {
                const localAlongY = Math.max(
                  220,
                  Math.min(length - 220, roundMm(candCenterAlong - ctopStartX, 1))
                );
                const apLengthAlong = isSink
                  ? Math.min(560, Math.max(320, roundIntMm(cand.dimensions.width - 80)))
                  : Math.min(580, Math.max(320, roundIntMm(cand.dimensions.width - 80)));
                const apDepthAcross = isSink
                  ? Math.min(460, Math.max(280, roundIntMm(width - 130)))
                  : Math.min(490, Math.max(280, roundIntMm(width - 110)));
                countertopCutouts.push({
                  id: `cutout_${isSink ? "sink" : "hob"}_${cand.id}`,
                  targetPanel: "bottom",
                  kind: "plumbing_pass",
                  shape: "rect",
                  centerXMm: roundMm(width * 0.52, 1),
                  centerYMm: localAlongY,
                  widthMm: apDepthAcross,
                  heightMm: apLengthAlong,
                  cornerRadiusMm: 10,
                  label: isSink ? `Eviye Boşaltması (${cand.name})` : `Ocak Boşaltması (${cand.name})`,
                });
                hasSinkOrHobCutout = true;
              }
            });
          } else if (hasSinkOrCooktopAppliance(module)) {
            const isSink = isSinkModule(module);
            const apLengthAlong = Math.min(560, Math.max(320, roundIntMm(length - 110)));
            const apDepthAcross = Math.min(480, Math.max(280, roundIntMm(width - 115)));
            hasSinkOrHobCutout = true;
            cutoutWidthMm = apLengthAlong;
            cutoutDepthMm = apDepthAcross;
            countertopCutouts.push({
              id: `cutout_${isSink ? "sink" : "hob"}_${module.id}`,
              targetPanel: "bottom",
              kind: "plumbing_pass",
              shape: "rect",
              centerXMm: roundMm(width * 0.52, 1),
              centerYMm: roundMm(length / 2, 1),
              widthMm: apDepthAcross,
              heightMm: apLengthAlong,
              cornerRadiusMm: 10,
              label: isSink ? "Eviye Boşaltması" : "Ocak Boşaltması",
            });
          }
        }
      } else if (comp.role === "kerf_curve") {
        mat = materialsMap.get(comp.materialId) || doorMat;
        grain = "lengthwise";
        length = comp.dimensions.height;
        width = comp.dimensions.width;
        edgeBanding = {
          top: true,
          bottom: true,
          left: false,
          right: false,
          thickness: defaultEbThickness,
        };
      } else if (
        comp.role === "door_stile_left" ||
        comp.role === "door_stile_right" ||
        comp.role === "door_rail_top" ||
        comp.role === "door_rail_bottom" ||
        comp.role === "door_center_panel"
      ) {
        mat = materialsMap.get(comp.materialId) || doorMat;
        const isRail = comp.role === "door_rail_top" || comp.role === "door_rail_bottom";
        length = isRail ? comp.dimensions.width : comp.dimensions.height;
        width = isRail ? comp.dimensions.height : comp.dimensions.width;
        grain = mat.hasGrain ? "lengthwise" : "none";
        // Center panel & painted shaker frame pieces are unbanded (mortise-tenon / lacquer); laminate outer edges get 1-side band
        const needsOuterBand =
          comp.role !== "door_center_panel" &&
          mat.category !== "lacquer" &&
          mat.category !== "glass" &&
          mat.category !== "mirror" &&
          mat.category !== "metal";
        edgeBanding = {
          top: false,
          bottom: false,
          left: needsOuterBand,
          right: false,
          thickness: needsOuterBand ? defaultEbThickness : 0,
        };
      } else if (comp.role.includes("door")) {
        mat = materialsMap.get(comp.materialId) || doorMat;
        const doorGrain =
          module.componentGrainOverrides?.[comp.id] ||
          module.componentGrainOverrides?.__doors__ ||
          module.componentGrainOverrides?.__all__;
        grain = mat.hasGrain ? (doorGrain === "crosswise" ? "crosswise" : "lengthwise") : "none";
        length = comp.dimensions.height;
        width = comp.dimensions.width;
        const activeDoorProf =
          bay?.door?.crossSectionProfile || module.carcass.crossSectionProfile || "flat_slab";
        // P1-03: Lacquer, glass, mirror, metal, and 45°/J-pull/cove milled edges NEVER receive flat PVC edge-banding deduction!
        const isUnbandedMaterial =
          mat.requiresEdgeBanding === false ||
          (mat.requiresEdgeBanding !== true &&
            (mat.category === "lacquer" ||
              mat.category === "glass" ||
              mat.category === "mirror" ||
              mat.category === "metal" ||
              mat.category === "stone" ||
              mat.category === "compact"));
        const isUnbandedDoorFinishOrProfile =
          isUnbandedMaterial ||
          activeDoorProf === "bevel_45" ||
          activeDoorProf === "j_pull_bevel" ||
          activeDoorProf === "cove_arch";
        const doorEbT = isUnbandedDoorFinishOrProfile
          ? 0
          : bay?.door.doorEdgeBandThicknessMm || defaultEbThickness;
        edgeBanding = isUnbandedDoorFinishOrProfile
          ? { top: false, bottom: false, left: false, right: false, thickness: 0 }
          : { top: true, bottom: true, left: true, right: true, thickness: doorEbT };

        const leafInfo = fourSpace.doorLeaves[bayIdx];
        partHingePositionsY = leafInfo?.hingePositionsY;
        const selectedHw = getHardwareProductById(bay?.door.hardwareProductId);

        if (dSys.startsWith("hinged")) {
          const hingesNeeded =
            leafInfo?.effectiveHingeCount ||
            leafInfo?.recommendedHingesPerLeaf ||
            calculateRecommendedHingesPerLeaf(length, leafInfo?.leafWeightKg ?? 0, false);
          const isExplicitNonDefaultHw =
            selectedHw && selectedHw.id !== "hw_blum_71b3550";
          const crankType = leafInfo?.hingeCrankType || "straight_full_overlay";
          let hingeSku = selectedHw?.sku || "HW_BLUM_HINGE_110";
          let hingeName = selectedHw?.name || "Blum Clip Top Blumotion 110° Frenli Düz Menteşe";
          let hingePrice = selectedHw?.unitPriceEur || 3.8;

          const klapaRes = resolveKlapaAndHingeBehavior(
            bay?.door,
            geo.bayWidths[bayIdx] || 450,
            Boolean(bay?.drawers?.some((dr) => dr.isInternal && !dr.isHidden))
          );
          if (!isExplicitNonDefaultHw && klapaRes.hingeAxisShiftedByKlapa) {
            hingeSku = klapaRes.recommendedHingeSku;
            hingeName = klapaRes.recommendedHingeLabelTr;
            hingePrice = 5.4;
          } else if (!isExplicitNonDefaultHw && leafInfo?.overlayType === "inset") {
            hingeSku = "71B3750";
            hingeName = "Blum CLIP top BLUMOTION 110° Tam Deveboynu (İçerlek / Inset) Menteşe";
            hingePrice = 4.35;
          } else if (!isExplicitNonDefaultHw && leafInfo?.overlayType === "half_overlay") {
            hingeSku = "71B3650";
            hingeName = "Blum CLIP top BLUMOTION 110° Yarım Deveboynu (Orta Dikme) Menteşe";
            hingePrice = 4.15;
          } else if (!selectedHw && crankType === "half_cranked_middle") {
            hingeSku = "71B3650";
            hingeName = "Blum CLIP top BLUMOTION 110° Yarım Deveboynu (Orta Dikme) Menteşe";
            hingePrice = 4.15;
          }
          addHardware(hingeSku, hingeName, "hinge", hingesNeeded, "adet", hingePrice);
        } else if (!bayMechanismAdded.has(bayIdx)) {
          bayMechanismAdded.add(bayIdx);
          if (dSys.startsWith("lift")) {
            const lf = leafInfo?.powerFactorLf || 1800;
            const autoLiftSku =
              dSys === "lift_bi_fold"
                ? lf <= 5350 ? "22F2210+22F3500" : lf <= 10150 ? "22F2510+22F3500" : "22F2810+22F3500"
                : dSys === "lift_parallel"
                ? lf <= 3200 ? "22L2200+22L3500" : lf <= 6800 ? "22L2500+22L3500" : "22L2800+22L3500"
                : lf <= 1610 ? "22K2300" : lf <= 2800 ? "22K2500" : lf <= 5200 ? "22K2700" : "22K2900";
            const liftSku = selectedHw?.sku || autoLiftSku;
            const needsThirdPowerUnit = lf > 9000 || module.dimensions.width >= 1200;
            const liftQty = needsThirdPowerUnit ? 1.5 : 1;
            const liftName =
              (selectedHw?.name || `Blum AVENTOS Güç Ünitesi (LF=${lf})`) +
              (needsThirdPowerUnit ? " [Geniş Kapak 3 Güç Üniteli]" : "");
            const liftPrice = selectedHw?.unitPriceEur || 52.0;
            addHardware(liftSku, liftName, "special", liftQty, "takım", liftPrice);
          } else if (dSys.startsWith("sliding") || bay?.door.type === "sliding" || bay?.door.type === "sliding_bottom") {
            const sMount =
              bay?.door.slidingMountingType ||
              (dSys === "sliding_bottom_rolling" ? "inset_inside" : dSys === "sliding_coplanar" ? "coplanar_flush" : "top_hung_pelmet");
            if (bayIdx === 0) {
              const trackMeters = Number((module.dimensions.width / 1000).toFixed(2));
              if (sMount === "inset_inside") {
                addHardware(
                  "HT_SLIDELINE_M_SET",
                  "Hettich SlideLine M İçten Çalışan Çift Kanal Sürgü & Fren Seti",
                  "slide",
                  1,
                  "takım",
                  118.0
                );
                addHardware(
                  "HF_SLIDO_INSET_TRACK",
                  "Gömme Çift Kanallı Eloksallı Alüminyum Üst/Alt Sürgü Rayı",
                  "slide",
                  Number((trackMeters * 2).toFixed(2)),
                  "metre",
                  19.5
                );
              } else if (sMount === "coplanar_flush") {
                addHardware(
                  "HT_INLINE_XL_SET",
                  "Hettich InLine XL Hemzemin (Koplanar) Sürgü Mekanizma Seti",
                  "slide",
                  1,
                  "takım",
                  365.0
                );
              } else {
                addHardware(
                  selectedHw?.sku || "HT_TOPLINE_XL_SET",
                  "Hettich TopLine XL Üstten Askılı Yavaşlatıcılı Sürgü Araba & STB-19 Kılavuz Seti",
                  "slide",
                  1,
                  "takım",
                  168.0
                );
                addHardware(
                  "HT_TOPLINE_TRACK_2R",
                  "TopLine XL Üstten Askılı Çift Yollu Alüminyum Taşıyıcı Ray",
                  "slide",
                  trackMeters,
                  "metre",
                  28.0
                );
                if (sMount === "top_hung_pelmet") {
                  addHardware(
                    "HF_SLIDO_FASCIA_CLIP",
                    "Häfele Slido Üst Alın Kapama (Valans) Montaj Klips Takımı",
                    "special",
                    Math.max(4, Math.ceil(module.dimensions.width / 450)),
                    "adet",
                    2.8
                  );
                }
              }
            }
          } else if (dSys === "folding_side") {
            const foldSku = selectedHw?.sku || "WingLineL_25";
            const foldName =
              selectedHw?.name || "Hettich WingLine L Katlanır Kapak Sistemi";
            const foldPrice = selectedHw?.unitPriceEur || 110.0;
            addHardware(foldSku, foldName, "special", 1, "takım", foldPrice);
          } else if (dSys === "pocket_retractable") {
            const pocketSku = selectedHw?.sku || "REVEGO_UNO_650";
            const pocketName =
              selectedHw?.name || "Blum REVEGO Pocket Gizlenen Kapak Sistemi";
            const pocketPrice = selectedHw?.unitPriceEur || 420.0;
            addHardware(pocketSku, pocketName, "special", 1, "takım", pocketPrice);
          } else if (
            (dSys === "tambour_roller" || bay?.door?.type === "tambour") &&
            module.carcass.hullShape !== "capsule_stadium" &&
            module.carcass.hullShape !== "rounded_corners"
          ) {
            const guideMeters = roundMm((comp.dimensions.height * 2.2) / 1000, 2);
            addHardware(
              selectedHw?.sku || "HW_TAMBOUR_CASSETTE_SET",
              selectedHw?.name || "Yaylı Dengelemeli Dikey Tambur Panjur Sarım Tamburu & Kaset Mekanizması",
              "slide",
              1,
              "takım",
              selectedHw?.unitPriceEur || 92.0
            );
            addHardware(
              "HW_TAMBOUR_GUIDE_ALU",
              "Eloksallı Alüminyum Gömme Tambur Yan Kılavuz Rayı + Sessiz Fırça Fitil",
              "slide",
              Math.max(1.2, guideMeters),
              "metre",
              16.5
            );
            addHardware(
              "HW_TAMBOUR_PULL_PROFILE",
              "Tambur Kapak Entegre Alüminyum Alt Tutamak & Stoper Profili",
              "handle",
              1,
              "adet",
              14.0
            );
          }
        }

        const openTech = bay?.door.openingTechnology;
        if (openTech === "push_to_open") {
          addHardware(
            "956A1004",
            "Blum TIP-ON Bas-Aç Mekanik İtici + Adaptör",
            "special",
            1,
            "adet",
            6.5
          );
        } else if (openTech === "push_to_open_soft_close") {
          addHardware(
            "TIP_ON_BLUMOTION_SET",
            "Blum TIP-ON BLUMOTION Bas-Aç + Frenli Ünite",
            "special",
            1,
            "takım",
            14.0
          );
        } else if (openTech === "servo_electric") {
          addHardware(
            "Z10A3000",
            "Blum SERVO-DRIVE Elektrikli Açılma Ünitesi",
            "special",
            1,
            "takım",
            145.0
          );
        }

        const handleCat = bay?.door.handleCategory || "bar_handle";
        const doorProfForHandle =
          bay?.door?.crossSectionProfile || module.carcass.crossSectionProfile || "flat_slab";
        const isIntegratedMilledHandleless =
          dSys === "tambour_roller" ||
          bay?.door?.type === "tambour" ||
          comp.id.includes("_tambour_") ||
          handleCat === "handleless_plain" ||
          handleCat === "j_pull" ||
          handleCat === "gola_profile" ||
          handleCat === "milled_wood_grip" ||
          doorProfForHandle === "j_pull_bevel" ||
          doorProfForHandle === "bevel_45" ||
          bay?.door?.openingTechnology === "push_to_open" ||
          bay?.door?.openingTechnology === "servo_electric";
        if (!isIntegratedMilledHandleless) {
          const hProfile =
            getAllHandleProfiles().find((hp) => hp.id === bay?.door.handleProfileId) ||
            getAllHandleProfiles().find((hp) => hp.category === handleCat) ||
            HANDLE_PROFILES[1];
          addHardware(hProfile.sku, hProfile.name, "handle", 1, "adet", hProfile.unitPriceEur);
        }
      } else if (comp.role === "drawer_front") {
        mat = materialsMap.get(comp.materialId) || doorMat;
        const drwGrain =
          module.componentGrainOverrides?.[comp.id] ||
          module.componentGrainOverrides?.__drawers__ ||
          module.componentGrainOverrides?.__doors__ ||
          module.componentGrainOverrides?.__all__;
        const drwContAssign = grainContinuityMap.get(`${module.id}::${comp.id}`) || grainContinuityMap.get(comp.id);
        grain = mat.hasGrain ? (drwGrain === "crosswise" ? "crosswise" : "lengthwise") : "none";
        const isVertContDrawer = Boolean(drwContAssign && drwContAssign.grainDirection === "lengthwise" && mat.hasGrain);
        length = isVertContDrawer ? comp.dimensions.height : comp.dimensions.width;
        width = isVertContDrawer ? comp.dimensions.width : comp.dimensions.height;
        edgeBanding = {
          top: true,
          bottom: true,
          left: true,
          right: true,
          thickness: defaultEbThickness,
        };
        const drawer = bay?.drawers.find((d) => `${d.id}_front` === comp.id);
        const drwHandleCat = bay?.door.handleCategory || "bar_handle";
        const drwProf = bay?.door?.crossSectionProfile || module.carcass.crossSectionProfile || "flat_slab";
        const isDrwHandleless =
          drwHandleCat === "handleless_plain" ||
          drwHandleCat === "j_pull" ||
          drwHandleCat === "gola_profile" ||
          drwHandleCat === "milled_wood_grip" ||
          drwProf === "j_pull_bevel" ||
          drwProf === "bevel_45" ||
          drawer?.slideType === "push_to_open" ||
          drawer?.slideType === "servo_electric";
        if (!drawer?.isInternal && !isDrwHandleless) {
          const profile =
            getAllHandleProfiles().find((p) => p.id === bay?.door.handleProfileId) ||
            getAllHandleProfiles().find(
              (p) => p.category === (bay?.door.handleCategory || "bar_handle")
            ) ||
            HANDLE_PROFILES[1];
          addHardware(profile.sku, profile.name, "handle", 1, "adet", profile.unitPriceEur);
        }
      } else if (comp.role === "end_panel") {
        mat = materialsMap.get(comp.materialId) || doorMat;
        length = comp.dimensions.height;
        width = Math.max(comp.dimensions.depth, comp.dimensions.width);
        edgeBanding = {
          top: true,
          bottom: true,
          left: true,
          right: true,
          thickness: defaultEbThickness,
        };
        addHardware(
          "HW_PANEL_JOIN_SCREW_4X30",
          "Görünen Yan Panel İçten Gizli Montaj Vidası 4.0×30mm",
          "fastener",
          6,
          "adet",
          0.09
        );
      } else if (
        comp.role === "drawer_box" ||
        comp.role === "drawer_side_left" ||
        comp.role === "drawer_side_right" ||
        comp.role === "drawer_back" ||
        comp.role === "drawer_bottom"
      ) {
        if (comp.role === "drawer_bottom" && !comp.id.endsWith("_plinth_drawer_box")) {
          const drawerCfg = bay?.drawers.find((d) => `${d.id}_bottom` === comp.id);
          const drHw = getHardwareProductById(drawerCfg?.hardwareProductId);
          const optimalNl =
            drawerCfg?.nominalLengthMm ||
            selectOptimalRunnerLengthMm(fourSpace.usableInternal.netInnerDepthMm);
          const runnerSku = drHw ? `${drHw.sku}_NL${optimalNl}` : "HW_BLUM_TANDEM_BOX";
          const runnerName = drHw
            ? `${drHw.name} (NL=${optimalNl}mm)`
            : `Blum Antaro / Tandembox Çekmece Rayı Frenli ${optimalNl}mm`;
          const runnerPrice = drHw?.unitPriceEur || 28.0;
          addHardware(runnerSku, runnerName, "slide", 1, "takım", runnerPrice);
          const effectiveBoxSys = drawerCfg?.boxSystemType || module.carcass.drawerBoxSystem;
          const isWoodenUndermountRunner =
            effectiveBoxSys === "wooden_undermount" ||
            (!effectiveBoxSys &&
              Boolean(drHw && (drHw.sku.startsWith("760H") || drHw.sku.startsWith("560H"))));
          if (isWoodenUndermountRunner) {
            addHardware(
              "T51.1700",
              "Blum MOVENTO / TANDEM Gizli Ray Ön Mandal Seti (Sağ+Sol)",
              "connector",
              1,
              "takım",
              3.9
            );
          }
          if (comp.siphonCutout || drawerCfg?.hasSiphonCutout) {
            addHardware(
              "HW_SIPHON_TRIM_U",
              "Eviye Altı Çekmece U-Sifon Dönüş Aparatı",
              "special",
              1,
              "takım",
              9.5
            );
          }
          if (drawerCfg?.hasCooktopHeatShield) {
            addHardware(
              "HW_HEAT_SHIELD_COOKTOP",
              "Ocak Altı Çekmece İndüksiyon Isı Koruma Sacı",
              "special",
              1,
              "adet",
              16.0
            );
          }
        } else if (comp.id.endsWith("_plinth_drawer_box")) {
          addHardware(
            "HW_PLINTH_DRAWER_RUNNER",
            "Baza Çekmecesi Tekerlekli Gizli Ray Seti",
            "slide",
            1,
            "takım",
            22.0
          );
        }
        length =
          comp.role === "drawer_bottom" || comp.role === "drawer_back" || comp.role === "drawer_box"
            ? comp.dimensions.width
            : comp.dimensions.depth;
        width = comp.role === "drawer_bottom" ? comp.dimensions.depth : comp.dimensions.height;
        // Grooved 8mm drawer bottom is unbanded; drawer sides & back get 1 long-edge band (left = Boy) along their top long rim!
        edgeBanding =
          comp.role === "drawer_bottom"
            ? { top: false, bottom: false, left: false, right: false, thickness: 0 }
            : {
                top: false,
                bottom: false,
                left: true,
                right: false,
                thickness: defaultEbThickness,
              };
      } else if (comp.role === "plinth") {
        // Visible front & side plinth boards receive 4-edge moisture-sealed PVC banding (2B + 2E) so mop water never swells raw edges!
        length = Math.max(comp.dimensions.width, comp.dimensions.depth);
        width = comp.dimensions.height;
        const isExposedPlinthFace =
          comp.id.includes("_plinth_front") || comp.id.includes("_plinth_side_");
        edgeBanding = isExposedPlinthFace
          ? {
              top: true,
              bottom: true,
              left: true,
              right: true,
              thickness: defaultEbThickness,
            }
          : {
              top: false,
              bottom: false,
              left: true,
              right: false,
              thickness: defaultEbThickness,
            };
      }

      const minSawDim = comp.role === "plinth" ? 50 : 70;
      if (width < minSawDim || length < minSawDim) {
        validationWarnings.push(
          `Parça "${comp.label}" boyutu (${roundIntMm(length)}x${roundIntMm(
            width
          )}mm) Selco testere min kesim ölçüsünden (70mm) küçük [UNVERIFIED].`
        );
      }

      const rawLengthMm = roundIntMm(length);
      const rawWidthMm = roundIntMm(width);
      const preSwapEdgeBanding = { ...edgeBanding };
      const swapAxesForCrossGrain = grain === "crosswise" && mat.hasGrain && comp.role !== "drawer_front";
      const nominalLengthMm = swapAxesForCrossGrain ? rawWidthMm : rawLengthMm;
      const nominalWidthMm = swapAxesForCrossGrain ? rawLengthMm : rawWidthMm;
      if (swapAxesForCrossGrain) {
        // Proper 90° CCW rigid rotation (det = +1): (x', y') = (L - y, x)
        // Old right (x=W) -> top (y'=W), old left (x=0) -> bottom (y'=0),
        // old top (y=L) -> left (x'=0), old bottom (y=0) -> right (x'=L).
        edgeBanding = {
          top: edgeBanding.right,
          bottom: edgeBanding.left,
          left: edgeBanding.top,
          right: edgeBanding.bottom,
          thickness: edgeBanding.thickness,
        };
      }
      const areaM2 = (nominalLengthMm * nominalWidthMm) / 1_000_000;

      let edgeBandMeters = 0;
      if (edgeBanding.top) edgeBandMeters += nominalWidthMm / 1000;
      if (edgeBanding.bottom) edgeBandMeters += nominalWidthMm / 1000;
      if (edgeBanding.left) edgeBandMeters += nominalLengthMm / 1000;
      if (edgeBanding.right) edgeBandMeters += nominalLengthMm / 1000;

      const stablePartId = `P_${module.id}_${comp.id}`;
      const thicknessMm =
        comp.thicknessAxis === "x"
          ? comp.dimensions.width
          : comp.thicknessAxis === "y"
          ? comp.dimensions.height
          : comp.thicknessAxis === "z"
          ? comp.dimensions.depth
          : Math.min(comp.dimensions.width, comp.dimensions.height, comp.dimensions.depth);

      const dOffsetGroove = module.carcass.backOffsetMm ?? (module.category?.startsWith("wardrobe") ? 12 : 18);
      const grooveWidthMm = roundMm((module.carcass.backPanelThickness || 8) + 0.5, 1);

      const isSideOrDiv =
        comp.role === "carcass_side_left" ||
        comp.role === "carcass_side_right" ||
        comp.role === "carcass_divider";
      const golaNotches = isSideOrDiv
        ? computeGolaSidePanelNotches(module, comp.position.y || 0, rawLengthMm)
        : undefined;
      const tJunctionFixedShelfYs =
        comp.role === "carcass_divider" && typeof comp.bayIndex === "number"
          ? computeDividerTJunctionYs(module, comp.bayIndex)
          : undefined;

      const hasPartVertLed =
        Boolean(module.carcass.ledLightingEnabled) &&
        (module.carcass.ledPlacementMode === "vertical_sides" ||
          module.carcass.ledPlacementMode === "full_showcase") &&
        (comp.role === "carcass_side_left" || comp.role === "carcass_side_right");
      const hasPartShelfLed =
        Boolean(module.carcass.ledLightingEnabled) &&
        (module.carcass.ledPlacementMode === "shelf_underside" ||
          module.carcass.ledPlacementMode === "top_and_shelves" ||
          module.carcass.ledPlacementMode === "full_showcase") &&
        (comp.role === "shelf" || comp.role === "carcass_top");
      const ledGrooveSpec =
        hasPartVertLed || hasPartShelfLed
          ? {
              enabled: true,
              offsetFromFrontMm: module.carcass.ledFrontSetbackMm ?? 75,
              widthMm: module.carcass.ledChannelWidthMm ?? 12,
              depthMm: module.carcass.ledChannelDepthMm ?? 8,
              cableExitHole: true,
            }
          : undefined;

      const bbCfg = module.carcass.baseboardNotch;
      const isRearNotchedVertical =
        Boolean(bbCfg?.enabled) &&
        (comp.role === "carcass_side_left" ||
          comp.role === "carcass_side_right" ||
          comp.role === "carcass_divider" ||
          (comp.role === "plinth" && (comp.id.includes("side_left") || comp.id.includes("side_right"))));
      const bbEffectiveH =
        comp.role === "plinth"
          ? Math.min(rawLengthMm, bbCfg?.heightMm || 80)
          : Math.min(rawLengthMm, bbCfg?.heightMm || 80);
      const bbEffectiveD = Math.min(rawWidthMm - 20, bbCfg?.depthMm || 15);
      const baseboardCutouts =
        isRearNotchedVertical && bbCfg && bbEffectiveD > 0 && bbEffectiveH > 0
          ? [
              {
                id: `bb_${comp.id}`,
                targetPanel: (comp.role === "carcass_side_left"
                  ? "left_side"
                  : comp.role === "carcass_side_right"
                  ? "right_side"
                  : "back") as import("@birim/core").CutoutTargetPanel,
                kind: "baseboard_notch" as const,
                shape: "corner_notch" as const,
                centerXMm: mirrorInnerFaceX
                  ? bbEffectiveD / 2
                  : rawWidthMm - bbEffectiveD / 2,
                centerYMm: bbEffectiveH / 2,
                widthMm: bbEffectiveD,
                heightMm: bbEffectiveH,
                label: `Süpürgelik Kertmesi (${bbCfg.heightMm}×${bbCfg.depthMm}mm)`,
              },
            ]
          : [];

      const partJoineryTopology =
        module.carcass.carcassJoineryTopology ||
        (module.category === "kitchen_base" || module.category === "kitchen_island"
          ? "kitchen_stretchers"
          : "sides_through");
      const partStretcherMode =
        module.carcass.kitchenTopStretcherMode ||
        (hasSinkOrCooktopAppliance(module) && module.name.toLowerCase().includes("eviye")
          ? "vertical_sink"
          : hasSinkOrCooktopAppliance(module) && module.dimensions.width >= 900
          ? "aluminum_reinforced"
          : "horizontal");
      const partBackMode =
        hasSinkOrCooktopAppliance(module) && module.name.toLowerCase().includes("eviye")
          ? "none"
          : module.carcass.backPanelType || "grooved";
      const isWallCab =
        module.category === "kitchen_wall" ||
        Boolean(module.templateId?.includes("floating")) ||
        ((module.position?.y || 0) >= 150 && (module.carcass.plinthHeight ?? 0) === 0);

      // Compute fixed & appliance-carrier shelf Y offsets on outer side panels so Minifix/Dowel rows are drilled accurately!
      const sideFixedShelfSplit =
        comp.role === "carcass_side_left" || comp.role === "carcass_side_right"
          ? (() => {
              const sideBaseY = comp.position.y || 0;
              const panelT_fs = module.carcass.panelThickness || 18;
              const plinth_fs = module.carcass.plinthHeight || 0;
              const adjBay =
                comp.role === "carcass_side_right"
                  ? module.bays[Math.max(0, module.bays.length - 1)]
                  : module.bays[0];
              const minifixYs: number[] = [];
              const rafixYs: number[] = [];
              for (const s of adjBay?.shelves || []) {
                if (s.isHidden || s.isGlass) continue;
                const isFixedSh = s.isFixed === true || s.isAdjustable === false;
                if (!isFixedSh) continue;
                const shT = s.thickness || panelT_fs;
                const centerY = roundMm(plinth_fs + panelT_fs + s.elevationY + shT / 2 - sideBaseY, 2);
                if (s.fixedConnectorType === "rafix_20") rafixYs.push(centerY);
                else minifixYs.push(centerY);
              }
              const carrierComp = geo.components.find((gc) => gc.id === `${module.id}_appliance_shelf`);
              if (carrierComp) {
                minifixYs.push(roundMm(carrierComp.position.y + carrierComp.dimensions.height / 2 - sideBaseY, 2));
              }
              return { minifixYs, rafixYs };
            })()
          : undefined;
      const firstFixedShelfComp = geo.components.find(
        (gc) => gc.role === "shelf" && gc.label.includes("Sabit")
      );
      const refSideComp = geo.components.find(
        (gc) => gc.role === "carcass_side_left" || gc.role === "carcass_side_right"
      );
      const refCarcassFrontZ = refSideComp
        ? refSideComp.position.z + refSideComp.dimensions.depth
        : module.dimensions.depth;
      const fixedShelfFrontOffsetMm =
        firstFixedShelfComp
          ? roundMm(Math.max(0, refCarcassFrontZ - (firstFixedShelfComp.position.z + firstFixedShelfComp.dimensions.depth)), 2)
          : undefined;
      const fixedShelfDepthMm = firstFixedShelfComp ? roundMm(firstFixedShelfComp.dimensions.depth, 2) : undefined;
      const snapRunnerLen = (clearD: number) => {
        const nlList = [550, 500, 450, 400, 350, 300, 270];
        return nlList.find((nl) => nl <= clearD - 12) || 300;
      };
      const nominalRunnerNL = snapRunnerLen(Math.max(280, (module.dimensions.depth || 560) - 24));
      const sideDrawerRunners =
        comp.role === "carcass_side_left" || comp.role === "carcass_side_right"
          ? (() => {
              const sideBaseY = comp.position.y || 0;
              const panelT_dr = module.carcass.panelThickness || 18;
              const plinth_dr = module.carcass.plinthHeight || 0;
              const adjBay =
                comp.role === "carcass_side_right"
                  ? module.bays[Math.max(0, module.bays.length - 1)]
                  : module.bays[0];
              const adjBlindPlan = resolveInternalDrawerHingeClearance(module, adjBay);
              const sideBlockedByBlind =
                comp.role === "carcass_side_right"
                  ? adjBlindPlan.hasRightBlindFiller
                  : adjBlindPlan.hasLeftBlindFiller;
              const list: Array<{ y: number; runnerLengthMm: number; isInternal?: boolean; drawerId?: string }> = [];
              for (const d of adjBay?.drawers || []) {
                if (d.isHidden) continue;
                if (d.isInternal && sideBlockedByBlind) continue;
                list.push({
                  y: roundMm(plinth_dr + panelT_dr + (d.elevationY || 0) + 22 - sideBaseY, 2),
                  runnerLengthMm: nominalRunnerNL,
                  isInternal: Boolean(d.isInternal),
                  drawerId: d.id,
                });
              }
              return list.length > 0 ? list : undefined;
            })()
          : comp.role === "carcass_sub_divider" &&
            comp.id.includes("_blind_divider_") &&
            typeof comp.bayIndex === "number"
          ? (() => {
              const targetBay = module.bays[comp.bayIndex];
              const bPlan = resolveInternalDrawerHingeClearance(module, targetBay);
              const list: Array<{ y: number; runnerLengthMm: number; isInternal?: boolean; drawerId?: string }> = [];
              for (const d of targetBay?.drawers || []) {
                if (d.isHidden || !d.isInternal) continue;
                list.push({
                  y: roundMm((d.elevationY || 0) + 22 - bPlan.blockBottomInnerYMm, 2),
                  runnerLengthMm: nominalRunnerNL,
                  isInternal: true,
                  drawerId: d.id,
                });
              }
              return list.length > 0 ? list : undefined;
            })()
          : undefined;
      const dividerDrawerRunners =
        comp.role === "carcass_divider" && typeof comp.bayIndex === "number"
          ? (() => {
              const lb = module.bays[comp.bayIndex];
              const rb = module.bays[comp.bayIndex + 1];
              const lbBlind = resolveInternalDrawerHingeClearance(module, lb);
              const rbBlind = resolveInternalDrawerHingeClearance(module, rb);
              const leftList = (lb?.drawers || [])
                .filter((d) => !d.isHidden && !(d.isInternal && lbBlind.hasRightBlindFiller))
                .map((d) => ({
                  y: roundMm((d.elevationY || 0) + 22, 2),
                  runnerLengthMm: nominalRunnerNL,
                  isInternal: Boolean(d.isInternal),
                  drawerId: d.id,
                }));
              const rightList = (rb?.drawers || [])
                .filter((d) => !d.isHidden && !(d.isInternal && rbBlind.hasLeftBlindFiller))
                .map((d) => ({
                  y: roundMm((d.elevationY || 0) + 22, 2),
                  runnerLengthMm: nominalRunnerNL,
                  isInternal: Boolean(d.isInternal),
                  drawerId: d.id,
                }));
              return { leftList, rightList };
            })()
          : undefined;
      const sideFixedShelfYs = sideFixedShelfSplit?.minifixYs;
      const sideRafixShelfYs = sideFixedShelfSplit?.rafixYs;

      const dividerFixedShelfSplit =
        comp.role === "carcass_divider" && typeof comp.bayIndex === "number"
          ? (() => {
              const panelT_div = module.carcass.panelThickness || 18;
              const lb = module.bays[comp.bayIndex];
              const rb = module.bays[comp.bayIndex + 1];
              const tJYs = tJunctionFixedShelfYs || [];
              const leftMinifix: number[] = [];
              const leftRafix: number[] = [];
              const rightMinifix: number[] = [];
              const rightRafix: number[] = [];
              for (const s of lb?.shelves || []) {
                if (s.isHidden || s.isGlass || (s.isAdjustable !== false && s.isFixed !== true)) continue;
                const cy = roundMm(s.elevationY + (s.thickness || panelT_div) / 2, 2);
                if (tJYs.some((ty) => Math.abs(ty - cy) <= 12)) continue;
                if (s.fixedConnectorType === "rafix_20") leftRafix.push(cy);
                else leftMinifix.push(cy);
              }
              for (const s of rb?.shelves || []) {
                if (s.isHidden || s.isGlass || (s.isAdjustable !== false && s.isFixed !== true)) continue;
                const cy = roundMm(s.elevationY + (s.thickness || panelT_div) / 2, 2);
                if (tJYs.some((ty) => Math.abs(ty - cy) <= 12)) continue;
                if (s.fixedConnectorType === "rafix_20") rightRafix.push(cy);
                else rightMinifix.push(cy);
              }
              return { leftMinifix, leftRafix, rightMinifix, rightRafix };
            })()
          : undefined;

      const canonicalHandleSpec = (() => {
        if (
          comp.role !== "door_left" &&
          comp.role !== "door_right" &&
          comp.role !== "drawer_front"
        ) {
          return undefined;
        }
        if (
          comp.id.includes("_tambour_") ||
          dSys === "tambour_roller" ||
          bay?.door?.type === "tambour"
        ) {
          return undefined;
        }
        if (comp.role === "drawer_front") {
          const drObj = bay?.drawers.find((d) => `${d.id}_front` === comp.id);
          if (drObj?.isInternal) return undefined;
        }
        const hCat = bay?.door?.handleCategory || "bar_handle";
        const doorProfCheck =
          bay?.door?.crossSectionProfile || module.carcass.crossSectionProfile || "flat_slab";
        const hp =
          getAllHandleProfiles().find((p) => p.id === bay?.door?.handleProfileId) ||
          getAllHandleProfiles().find((p) => p.category === hCat);
        const rawCc =
          hCat === "knob"
            ? 1
            : hp?.holeSpacingCcMm ??
              (hp as { centerToCenterMm?: number } | undefined)?.centerToCenterMm ??
              160;
        const spec = resolveCanonicalHandlePlacement({
          partRole: comp.role,
          partId: comp.id,
          partLabel: comp.label,
          frontWidthMm: comp.dimensions.width,
          frontHeightMm: comp.dimensions.height,
          frontElevationYMm: comp.position?.y ?? 0,
          moduleCategory: module.category,
          moduleElevationYMm: module.position?.y ?? 0,
          handleCategory: hCat,
          openingTechnology: bay?.door?.openingTechnology,
          crossSectionProfile: doorProfCheck,
          spacingCcMm: rawCc,
          handleOrientation: bay?.door?.handleOrientation,
          handleOffsetY: bay?.door?.handleOffsetY,
          handleEdgeInsetX: bay?.door?.handleEdgeInsetX,
        });
        return spec.isDrilledThrough ? spec : undefined;
      })();

      const resolvedHandleSpacingMm = canonicalHandleSpec?.spacingCcMm;

      // Detect wooden drawer components (16mm wooden sides + 16mm inner sub-front + 8mm grooved bottom)
      const isWoodenDrawerComponent = (() => {
        if (
          comp.role !== "drawer_side_left" &&
          comp.role !== "drawer_side_right" &&
          comp.role !== "drawer_back" &&
          comp.role !== "drawer_box" &&
          comp.role !== "drawer_front"
        ) {
          return false;
        }
        const prefix = comp.id.replace(/_(side_left|side_right|back|sub_front|front)$/, "");
        const botComp = geo.components.find((gc) => gc.id === `${prefix}_bottom`);
        return Boolean(botComp && Math.min(botComp.dimensions.height, botComp.dimensions.depth) <= 10);
      })();

      const hasDrawerBottomGroove =
        isWoodenDrawerComponent &&
        (comp.role === "drawer_side_left" ||
          comp.role === "drawer_side_right" ||
          comp.role === "drawer_back" ||
          comp.role === "drawer_box");

      const wallHangerCornerNotches =
        isWallCab && comp.role === "carcass_back" && partBackMode === "grooved"
          ? { widthMm: 45, heightMm: 65 }
          : undefined;

      const parametricPart: ParametricPart = {
        id: stablePartId,
        moduleId: module.id,
        bayIndex: comp.bayIndex,
        label: comp.label,
        role: comp.role,
        dimensions: {
          width: comp.role === "drawer_front" ? roundIntMm(comp.dimensions.height) : rawWidthMm,
          height: comp.role === "drawer_front" ? roundIntMm(comp.dimensions.width) : rawLengthMm,
          depth: thicknessMm,
        },
        materialId: mat.id,
        grain,
        edgeBanding: swapAxesForCrossGrain ? preSwapEdgeBanding : edgeBanding,
        jointType: module.carcass.jointType,
        holes: [],
        position: comp.position,
        rotation: comp.rotation,
        isFrontFacing: comp.isFrontFacing,
        hardwareRefId: bay?.door.hardwareProductId,
        handleSpacingMm: resolvedHandleSpacingMm,
        handleDrillSpec: canonicalHandleSpec
          ? {
              orientation: canonicalHandleSpec.orientation,
              centerXMm: canonicalHandleSpec.centerXMm,
              centerYMm: canonicalHandleSpec.centerYMm,
              spacingCcMm: canonicalHandleSpec.spacingCcMm,
            }
          : undefined,
        isInsetDoor,
        insetDoorThicknessMm:
          bay?.door?.doorThicknessMm || module.carcass.doorThickness || 18,
        insetRevealGapMm: module.carcass.doorPerimeterGap || 2,
        dividerJointPositionsY:
          (comp.role === "carcass_bottom" || comp.role === "carcass_top") &&
          module.bays.length > 1 &&
          !comp.id.includes("_top_stretcher_")
            ? (() => {
                const T_p = module.carcass.panelThickness || 18;
                const sideToFloorBom =
                  (module.carcass.plinthHeight || 0) > 0 &&
                  module.carcass.plinthConstruction === "gable_rails" &&
                  comp.role === "carcass_bottom";
                const isOuterThrough =
                  !sideToFloorBom &&
                  (partJoineryTopology === "top_bottom_through" ||
                    partJoineryTopology === "miter_45");
                const ys: number[] = [];
                const isSlopedTop = comp.id.includes("_top_sloped");
                const isFlatTopSlice = comp.id.includes("_top_flat");
                const rotZ = comp.rotation?.[2] || 0;
                const cosSlope = Math.max(0.35, Math.cos(Math.abs(rotZ)));
                const compStartX = comp.position.x;
                const compHorizSpan = isSlopedTop
                  ? comp.dimensions.width * cosSlope
                  : comp.dimensions.width;

                let curX = isOuterThrough ? T_p : 0;
                for (let bi = 0; bi < module.bays.length - 1; bi++) {
                  curX += fourSpace.usableInternal.bayClearWidthsMm[bi] || 0;
                  const divCenterFromInner = curX + T_p / 2;
                  const divWorldX = (isOuterThrough ? 0 : T_p) + divCenterFromInner;
                  if (isSlopedTop) {
                    if (
                      divWorldX > compStartX + 24 &&
                      divWorldX < compStartX + compHorizSpan - 24
                    ) {
                      ys.push(roundMm((divWorldX - compStartX) / cosSlope, 2));
                    }
                  } else if (isFlatTopSlice) {
                    if (
                      divWorldX > compStartX + 24 &&
                      divWorldX < compStartX + compHorizSpan - 24
                    ) {
                      ys.push(roundMm(divWorldX - compStartX, 2));
                    }
                  } else {
                    ys.push(roundMm(divCenterFromInner, 2));
                  }
                  curX += T_p;
                }
                return ys;
              })()
            : undefined,
        polygonContourMm: comp.polygonContourMm,
        hingePositionsY: partHingePositionsY,
        hingePositionsBackY: partHingePositionsBackY,
        tJunctionFixedShelfYs,
        fixedShelfJointYs: sideFixedShelfYs && sideFixedShelfYs.length > 0 ? sideFixedShelfYs : undefined,
        rafixShelfJointYs: sideRafixShelfYs && sideRafixShelfYs.length > 0 ? sideRafixShelfYs : undefined,
        fixedShelfFrontOffsetMm,
        fixedShelfDepthMm,
        drawerRunnerSpecs: sideDrawerRunners,
        dividerLeftDrawerRunners: dividerDrawerRunners?.leftList.length ? dividerDrawerRunners.leftList : undefined,
        dividerRightDrawerRunners: dividerDrawerRunners?.rightList.length ? dividerDrawerRunners.rightList : undefined,
        dividerLeftFixedShelfYs: dividerFixedShelfSplit?.leftMinifix.length ? dividerFixedShelfSplit.leftMinifix : undefined,
        dividerRightFixedShelfYs: dividerFixedShelfSplit?.rightMinifix.length ? dividerFixedShelfSplit.rightMinifix : undefined,
        dividerLeftRafixYs: dividerFixedShelfSplit?.leftRafix.length ? dividerFixedShelfSplit.leftRafix : undefined,
        dividerRightRafixYs: dividerFixedShelfSplit?.rightRafix.length ? dividerFixedShelfSplit.rightRafix : undefined,
        ...(() => {
          const mhSpec = resolveMultiHoleSpec(module);
          const panelT_mh = module.carcass.panelThickness || 18;
          let adjYs: number[] = [];
          if (comp.role === "carcass_side_left" || comp.role === "carcass_side_right") {
            const targetBIdx = comp.role === "carcass_side_right" ? Math.max(0, module.bays.length - 1) : 0;
            const targetBay = module.bays[targetBIdx];
            adjYs = (targetBay?.shelves || [])
              .filter((s) => !s.isHidden && s.isAdjustable !== false && !s.isFixed)
              .map((s) => roundMm(bottomJointOffsetY + panelT_mh + s.elevationY, 2));
          } else if (comp.role === "carcass_divider" && typeof comp.bayIndex === "number") {
            const lb = module.bays[comp.bayIndex];
            const rb = module.bays[comp.bayIndex + 1];
            const rawYs = [
              ...(lb?.shelves || []).filter((s) => !s.isHidden && s.isAdjustable !== false && !s.isFixed).map((s) => s.elevationY),
              ...(rb?.shelves || []).filter((s) => !s.isHidden && s.isAdjustable !== false && !s.isFixed).map((s) => s.elevationY),
            ];
            adjYs = Array.from(new Set(rawYs.map((v) => roundMm(v, 2)))).sort((a, b) => a - b);
          }
          const isSideOrDivMh =
            comp.role === "carcass_side_left" ||
            comp.role === "carcass_side_right" ||
            comp.role === "carcass_divider";
          const effectiveMhMode =
            isSideOrDivMh && !module.carcass.multiHoleMode && adjYs.length === 0
              ? ("none" as const)
              : mhSpec.mode;
          return {
            multiHoleMode: effectiveMhMode,
            multiHoleRowCount: mhSpec.rowCount,
            multiHoleFrontSetbackMm: module.carcass.multiHoleFrontSetbackMm,
            multiHoleEdgeMarginMm: mhSpec.edgeMarginMm,
            multiHoleDividerThroughBore: mhSpec.dividerThroughBore,
            adjustableShelfPositionsY: adjYs.length > 0 ? adjYs : undefined,
          };
        })(),
        bottomJointOffsetY,
        matingPanelThicknessMm: module.carcass.panelThickness || 18,
        hasBackGroove: hasPartBackGroove,
        backGrooveOffsetMm: dOffsetGroove + 8,
        backGrooveWidthMm: grooveWidthMm,
        ledGrooveSpec,
        golaNotches: golaNotches && golaNotches.length > 0 ? golaNotches : undefined,
        useDepthBasedConnectorRule: module.carcass.useDepthBasedConnectors !== false,
        mirrorInnerFaceX,
        hasSinkOrHobCutout,
        cutoutWidthMm,
        cutoutDepthMm,
        carcassJoineryTopology: partJoineryTopology,
        connectorSystem: module.carcass.connectorSystem,
        kitchenStretcherMode: partStretcherMode,
        backPanelMode: partBackMode,
        hasDrawerBottomGroove,
        drawerBottomGrooveOffsetMm: 13,
        drawerBottomGrooveWidthMm: 8.5,
        drawerBottomGrooveDepthMm: 6,
        isWoodenDrawerBox: isWoodenDrawerComponent,
        isWallCabinet: isWallCab,
      };

      const rawHoles = generateDrillingForPart(parametricPart);
      const isVertGrainSwappedDrawerFront =
        comp.role === "drawer_front" && nominalWidthMm > nominalLengthMm && comp.dimensions.width > comp.dimensions.height;
      const holes = isVertGrainSwappedDrawerFront
        ? rawHoles.map((h) => ({
            ...h,
            x: roundMm(h.y, 2),
            y: roundMm(h.x, 2),
          }))
        : swapAxesForCrossGrain
        ? rawHoles.map((h) => {
            // Proper 90° CCW rotation (det = +1): (x', y') = (rawLengthMm - h.y, h.x)
            // Matches edgeBanding rotation 100% without mirroring asymmetric hinge/handle layouts.
            const rotDir =
              h.direction === "edge_top"
                ? ("edge_left" as const)
                : h.direction === "edge_bottom"
                ? ("edge_right" as const)
                : h.direction === "edge_left"
                ? ("edge_bottom" as const)
                : h.direction === "edge_right"
                ? ("edge_top" as const)
                : h.direction;
            return {
              ...h,
              x: roundMm(rawLengthMm - h.y, 2),
              y: roundMm(h.x, 2),
              direction: rotDir,
            };
          })
        : rawHoles;
      for (const h of holes) {
        if (h.x < -0.5 || h.x > nominalWidthMm + 0.5 || h.y < -0.5 || h.y > nominalLengthMm + 0.5) {
          validationWarnings.push(
            `[ERR_CNC_HOLE_OUT_OF_BOUNDS] Parça "${comp.label}" (${nominalWidthMm}x${nominalLengthMm}mm) üzerinde delik "${h.id}" sınır dışı (${h.x}, ${h.y}mm).`
          );
          break;
        }
      }
      addedDrillingHolesCount += holes.length;

      const ebT = edgeBanding.thickness || 0;
      const preMillMm = Math.max(0, module.carcass.preMillingMm ?? 0);
      // Signed edge delta:
      // - When ebT > preMillMm (e.g. 2mm band, 0mm pre-mill): positive delta -> cut smaller by +2mm per banded edge
      // - When ebT === preMillMm (e.g. 1mm band, 1mm pre-mill): 0 delta -> cut equals finished size
      // - When preMillMm > ebT (e.g. 0.8mm band, 1.5mm pre-mill): negative delta (-0.7mm) -> cut LARGER by +0.7mm per banded edge!
      const netEbDeltaPerEdge = ebT - preMillMm;
      const topDelta = edgeBanding.top ? netEbDeltaPerEdge : 0;
      const bottomDelta = edgeBanding.bottom ? netEbDeltaPerEdge : 0;
      const leftDelta = edgeBanding.left ? netEbDeltaPerEdge : 0;
      const rightDelta = edgeBanding.right ? netEbDeltaPerEdge : 0;
      const lengthDeduction = topDelta + bottomDelta;
      const widthDeduction = leftDelta + rightDelta;
      const rawNetLength = roundMm(nominalLengthMm - lengthDeduction, 1);
      const rawNetWidth = roundMm(nominalWidthMm - widthDeduction, 1);
      if (rawNetLength < 10 || rawNetWidth < 10) {
        validationWarnings.push(
          `[ERR_CNC_INVALID_CUT_DIM] Parça "${comp.label}" net kesim ölçüsü (${rawNetLength}x${rawNetWidth}mm) geçersiz (< 10mm).`
        );
      }
      const netCutLengthMm = Math.max(10, rawNetLength);
      const netCutWidthMm = Math.max(10, rawNetWidth);
      const rawOriginOffsetXMm = roundMm(leftDelta, 2);
      const rawOriginOffsetYMm = roundMm(bottomDelta, 2);

      const drawerMatchForGrain =
        comp.role === "drawer_front"
          ? bay?.drawers.find((d) => `${d.id}_front` === comp.id)
          : undefined;
      const grainAssign =
        grainContinuityMap.get(`${module.id}::${comp.id}`) || grainContinuityMap.get(comp.id) ||
        (comp.role.includes("door") && bay?.door?.id ? (grainContinuityMap.get(`${module.id}::${bay.door.id}`) || grainContinuityMap.get(bay.door.id)) : undefined);
      const grainGroupId =
        grainAssign?.grainGroupId ||
        drawerMatchForGrain?.grainGroupId ||
        (comp.role.includes("door") ? bay?.door?.grainGroupId : undefined);
      if (grainGroupId && grain === "none") {
        grain = grainAssign?.grainDirection || "lengthwise";
      }

      cutList.push({
        id: stablePartId,
        pieceName: comp.label,
        moduleName: module.name,
        moduleId: module.id,
        componentRole: comp.role,
        materialId: mat.id,
        materialName: mat.name,
        lengthMm: nominalLengthMm,
        widthMm: nominalWidthMm,
        nominalLengthMm,
        nominalWidthMm,
        netCutLengthMm,
        netCutWidthMm,
        preMillingMm: preMillMm,
        rawOriginOffsetXMm,
        rawOriginOffsetYMm,
        miterBevelAngleDeg:
          module.complementaryRole === "attached_table" &&
          comp.id.endsWith("_table_top") &&
          module.attachedTableConfig?.angleDeg
            ? module.attachedTableConfig.angleDeg
            : undefined,
        miterBevelEdge:
          module.complementaryRole === "attached_table" &&
          comp.id.endsWith("_table_top") &&
          module.attachedTableConfig?.angleDeg
            ? "left"
            : undefined,
        edgeBandCode: formatEdgeBandCode(edgeBanding),
        thicknessMm,
        quantity: 1,
        edgeBanding,
        grain,
        grainGroupId,
        grainOffsetXMm: grainAssign?.offsetXMm,
        grainOffsetYMm: grainAssign?.offsetYMm,
        grainSequenceLabel: grainAssign?.sequenceLabel,
        notes: (() => {
          const noteParts: string[] = [];
          if (grainAssign) noteParts.push(`Desen Takibi: ${grainAssign.sequenceLabel}`);
          const scribeL = module.carcass.scribeAllowanceLeftMm || 0;
          const scribeR = module.carcass.scribeAllowanceRightMm || 0;
          if (scribeL > 0 && (comp.role === "carcass_side_left" || comp.id.endsWith("_klapa_left"))) {
            noteParts.push(`Sol Yamuk Duvar Tıraş Payı: +${scribeL}mm`);
          }
          if (scribeR > 0 && (comp.role === "carcass_side_right" || comp.id.endsWith("_klapa_right"))) {
            noteParts.push(`Sağ Yamuk Duvar Tıraş Payı: +${scribeR}mm`);
          }
          if (bbCfg?.enabled && comp.role === "plinth" && comp.id.includes("rear")) {
            noteParts.push(`Süpürgelik geri çekmesi: +${bbCfg.depthMm}mm öne konumlandırılır`);
          } else if (bbCfg?.enabled && comp.role === "carcass_back" && bbCfg.heightMm > (module.carcass.plinthHeight ?? 80)) {
            noteParts.push(
              `Arka süpürgelik boşluğu: alt ${Math.round(bbCfg.heightMm - (module.carcass.plinthHeight ?? 80))}mm kertme/yükseltme (${bbCfg.heightMm}×${bbCfg.depthMm}mm)`
            );
          } else if (bbCfg?.enabled && isRearNotchedVertical) {
            noteParts.push(`CNC Arka Süpürgelik Çentiği: ${bbCfg.heightMm}×${bbCfg.depthMm}mm`);
          }
          return noteParts.length > 0 ? noteParts.join(" • ") : undefined;
        })(),
        cncFileName: `${stablePartId}.dxf`,
        areaM2: roundMm(areaM2, 3),
        edgeBandMeters: roundMm(edgeBandMeters, 3),
        holes,
        mirrorInnerFaceX,
        hasBackGroove: hasPartBackGroove,
        backGrooveOffsetMm: dOffsetGroove + 8,
        backGrooveWidthMm: grooveWidthMm,
        ledGrooveSpec,
        golaNotches: golaNotches && golaNotches.length > 0 ? golaNotches : undefined,
        siphonCutout: comp.siphonCutout,
        hasSinkOrHobCutout,
        utilityCutouts: (module.utilityCutouts || []).filter((co) =>
          (comp.role === "carcass_back" && co.targetPanel === "back") ||
          ((comp.role === "carcass_side_left" || (comp.role === "carcass_side" && comp.id.includes("left"))) && co.targetPanel === "left_side") ||
          ((comp.role === "carcass_side_right" || (comp.role === "carcass_side" && comp.id.includes("right"))) && co.targetPanel === "right_side") ||
          (comp.role === "carcass_bottom" && co.targetPanel === "bottom")
        ).concat(baseboardCutouts, countertopCutouts),
        cutoutWidthMm,
        cutoutDepthMm,
        carcassJoineryTopology: partJoineryTopology,
        connectorSystem: module.carcass.connectorSystem,
        backPanelMode: partBackMode,
        hasDrawerBottomGroove,
        drawerBottomGrooveOffsetMm: hasDrawerBottomGroove ? 13 : undefined,
        drawerBottomGrooveWidthMm: hasDrawerBottomGroove ? 8.5 : undefined,
        drawerBottomGrooveDepthMm: hasDrawerBottomGroove ? 6 : undefined,
        wallHangerCornerNotches,
        polygonContourMm: comp.polygonContourMm,
        kerfBendingMeta: comp.kerfBendingMeta,
        tambourTrackGrooveSpec: comp.tambourTrackGrooveSpec,
      });
    });

  return addedDrillingHolesCount;
}
