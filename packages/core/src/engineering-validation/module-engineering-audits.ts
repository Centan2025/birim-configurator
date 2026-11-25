import {
  ArchitecturalElement,
  DesignProject,
  ModuleInstance,
} from "../types";
import { DEFAULT_MATERIALS } from "../defaults";
import {
  calculateBayWidths,
  calculateModulePlacement,
  calculateNetInnerDepth,
  calculateNetInnerHeight,
  calculateShelfDeflection,
} from "../rules";
import {
  calculateFourSpaceDimensions,
  inferDoorSystemIdFromType,
  resolveCanonicalHandlePlacement,
} from "../v4-profiles";
import {
  ENGINEERING_TOLERANCE_POLICY,
  getErgonomicProfile,
  roundGeometryMm,
} from "../tolerance-policy";
import {
  isBuiltInOvenOrFridgeTower,
  isSinkModule,
} from "../parametric-spec-engine";
import { computeEffectiveCeilingClearHeight } from "../ceiling-and-grain-engine";
import { BoundedLruCache, computeModuleStructuralSignature } from "../lru-cache";
import {
  EngineeringValidationFinding,
  RemediationProposal,
  evaluateFreestandingTipOverRisk,
  resolveCoreHandleSpacingCcMm,
} from "./stability-and-deflection";

export interface ModuleEngineeringAuditParams {
  project: DesignProject;
  ergProfile: ReturnType<typeof getErgonomicProfile>;
  allObstacles: ArchitecturalElement[];
  roomWidthMm: number;
  spaceEnvSig: string;
  moduleEngineeringSliceCache: BoundedLruCache<string, EngineeringValidationFinding[]>;
  addProjectFinding: (f: EngineeringValidationFinding) => void;
}

export function runPerModuleEngineeringAudits(params: ModuleEngineeringAuditParams): void {
  const {
    project,
    ergProfile,
    allObstacles,
    roomWidthMm,
    spaceEnvSig,
    moduleEngineeringSliceCache,
    addProjectFinding,
  } = params;
  let addFinding = addProjectFinding;
  // 2. Modül bazlı derin mühendislik denetimleri (P0-03, P1-02, P1-06, P2-01, P2-02, P2-04)
  for (const mod of project.modules) {
    if (mod.category === "complementary") continue;

    const hasLeftFillerMod = project.modules.some(
      (other) =>
        other.id !== mod.id &&
        other.complementaryRole === "wall_filler" &&
        Math.abs(other.position.x + other.dimensions.width - mod.position.x) <= 15
    );
    const hasRightFillerMod = project.modules.some(
      (other) =>
        other.id !== mod.id &&
        other.complementaryRole === "wall_filler" &&
        Math.abs(other.position.x - (mod.position.x + mod.dimensions.width)) <= 15
    );
    const hasLowerBaseSupportMod =
      mod.position.y >= 150 &&
      (mod.carcass.plinthHeight || 0) === 0 &&
      project.modules.some(
        (bm) =>
          bm.id !== mod.id &&
          bm.category !== "complementary" &&
          Math.abs(bm.position.y + bm.dimensions.height - mod.position.y) <= 20 &&
          bm.position.x < mod.position.x + mod.dimensions.width - 20 &&
          bm.position.x + bm.dimensions.width > mod.position.x + 20
      );

    const modSliceKey = `${computeModuleStructuralSignature(mod)}|ERG:${ergProfile.id}|SP:${spaceEnvSig}|LF:${hasLeftFillerMod ? 1 : 0}|RF:${hasRightFillerMod ? 1 : 0}|SB:${hasLowerBaseSupportMod ? 1 : 0}`;
    const cachedModFindings = moduleEngineeringSliceCache.get(modSliceKey);
    if (cachedModFindings) {
      for (let i = 0; i < cachedModFindings.length; i++) {
        addProjectFinding(cachedModFindings[i]);
      }
      continue;
    }

    const modFindings: EngineeringValidationFinding[] = [];
    const addFinding = (f: EngineeringValidationFinding) => {
      modFindings.push(f);
      addProjectFinding(f);
    };

    const T = mod.carcass.panelThickness || 18;
    const plinthH = mod.carcass.plinthHeight || 0;
    const fourSpace = calculateFourSpaceDimensions(mod, project.customMaterials);
    const bayWidths = calculateBayWidths(mod);
    const netInnerD = calculateNetInnerDepth(mod);
    const netInnerH = calculateNetInnerHeight(mod);

    // 2a. Serbest Duran Yüksek Dolap Devrilme Güvenliği (EN 14749 / P0-03)
    const tipCheck = evaluateFreestandingTipOverRisk(mod, project.space);
    if (!tipCheck.isSafe && tipCheck.reason) {
      addFinding({
        severity: "error",
        code: "ERR_FREESTANDING_TIPOVER_UNSAFE",
        message: tipCheck.reason,
        targetId: mod.id,
        targetModuleId: mod.id,
        targetComponentId: mod.id,
        blockingProduction: true,
        compatibilityStatus: "INCOMPATIBLE",
        sourceId: "SRC_EN_14749_2022",
        ruleNature: "MANDATORY_SAFETY",
        worldPositionMm: {
          x: roundGeometryMm(mod.position.x + mod.dimensions.width / 2),
          y: roundGeometryMm(mod.position.y + mod.dimensions.height * 0.75),
          z: roundGeometryMm(mod.position.z + mod.dimensions.depth),
        },
        suggestions: [
          "Modülü arka duvara yaslayıp EN 14749 çelik L-braket duvar sabitlemesini etkinleştirin.",
          "Serbest ada/bölücü kullanımda taban derinliğini artırın veya zemine çelik ankraj onaylayın.",
        ],
        remediationProposals: [
          {
            id: `fix_tip_anchor_${mod.id}`,
            label: "Duvar/Zemin Devrilme Sabitlemesini Onayla (EN 14749)",
            description:
              "BOM listesine 2 adet çelik L-duvar/zemin sabitleme braketi ekler ve devrilme emniyetini onaylar.",
            requiresExplicitUserApproval: true,
            targetModuleId: mod.id,
            patchKind: "enable_wall_anchor",
            patchPayload: tipCheck.isBackedByWall
              ? { wallAnchored: true }
              : { floorAnchored: true },
          },
          {
            id: `fix_tip_depth_${mod.id}`,
            label: `Gövde Derinliğini ${Math.max(550, Math.ceil(mod.dimensions.height / 2.4 / 10) * 10)}mm Yap`,
            description: "Taban derinliğini büyüterek devrilme denge momentini güvenli sınıra taşır.",
            requiresExplicitUserApproval: true,
            targetModuleId: mod.id,
            patchKind: "increase_module_depth",
            patchPayload: {
              depth: Math.max(550, Math.ceil(mod.dimensions.height / 2.4 / 10) * 10),
            },
          },
        ],
      });
    }

    // 2b. Dinamik Menteşe Y Kotları ile İç Çekmece Fiziksel Çarpışma Kontrolü (P1-02)
    let bayCursorX = T;
    mod.bays.forEach((bay, bayIdx) => {
      const bayW = bayWidths[bayIdx] || 500;
      const leaf = fourSpace.doorLeaves[bayIdx];
      const dSys = bay.door?.doorSystemId || inferDoorSystemIdFromType(bay.door?.type || "open");

      if (leaf && dSys.startsWith("hinged") && leaf.hingePositionsY.length > 0) {
        const doorOffsetAboveInnerBottom = (leaf.doorY0Mm || plinthH) - (plinthH + T);
        const hingeInnerYs = leaf.hingePositionsY.map((hy) =>
          roundGeometryMm(doorOffsetAboveInnerBottom + hy)
        );
        const hasZeroProtrusionOrSpacer =
          bay.door.hardwareProductId === "hw_blum_71b7550" ||
          bay.door.hardwareProductId === "hw_hettich_9099540" ||
          mod.carcass.internalDrawerHingeSolution === "spacer_block_25mm" ||
          mod.carcass.internalDrawerHingeSolution === "blind_panel_filler" ||
          String(mod.carcass.internalDrawerHingeSolution) === "zero_protrusion_155deg";

        bay.drawers.forEach((drw) => {
          if (!drw.isInternal) return;
          // Ray montaj ekseni çekmece tabanından ~22mm yukarıdadır; menteşe tabanı ±42mm yasaklı kuşak oluşturur
          const runnerMountY = drw.elevationY + 22;
          const clashingHingeY = hingeInnerYs.find(
            (hy) =>
              Math.abs(runnerMountY - hy) < 42 ||
              (hy >= drw.elevationY - 15 && hy <= drw.elevationY + drw.height + 15)
          );

          const blindAndHingeProposals: RemediationProposal[] = [
            {
              id: `fix_int_drw_blind_${drw.id}`,
              label: "Kör Dikme + Kapama (40mm)",
              description:
                "İç çekmece bloğu boyunca 18mm kör dikme ve 40mm ön kör kapama çıtası oluşturarak standart menteşe çıkıntısını güvenli şekilde aşar.",
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              targetBayIndex: bayIdx,
              targetComponentId: drw.id,
              patchKind: "add_internal_drawer_spacer",
              patchPayload: {
                internalDrawerHingeSolution: "blind_panel_filler",
                internalDrawerBlindWidthMm: 40,
              },
            },
            {
              id: `fix_int_drw_155_${drw.id}`,
              label: "155° Sıfır Çıkıntı Menteşe",
              description: "Kapak tam açıldığında iç açıklığı sıfır çıkıntıyla serbest bırakır (Blum 71B7550).",
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              targetBayIndex: bayIdx,
              targetComponentId: bay.door.id,
              patchKind: "switch_hinge_155_zero",
              patchPayload: { hardwareProductId: "hw_blum_71b7550" },
            },
            {
              id: `fix_int_drw_spacer_${drw.id}`,
              label: "25mm Menteşe Paspayı",
              description:
                "Gövde yanına 25mm besleme çıtası ekleyerek iç çekmece rayını menteşe gövdesinden kurtarır.",
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              targetBayIndex: bayIdx,
              targetComponentId: drw.id,
              patchKind: "add_internal_drawer_spacer",
              patchPayload: { internalDrawerHingeSolution: "spacer_block_25mm" },
            },
          ];

          if (clashingHingeY !== undefined && !hasZeroProtrusionOrSpacer) {
            addFinding({
              severity: "error",
              code: "ERR_INTERNAL_DRAWER_HINGE_BODY_CLASH",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: İç çekmece (Y=${drw.elevationY}..${drw.elevationY + drw.height}mm) menteşe gövdesiyle (Y=${clashingHingeY}mm) fiziksel olarak çakışıyor; Kör Dikme + Kapama (40mm) ekleyin veya 155° sıfır çıkıntılı menteşeye geçin.`,
              targetId: drw.id,
              targetModuleId: mod.id,
              targetComponentId: drw.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_BLUM_CAT_HINGE",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + bayW / 2),
                y: roundGeometryMm(mod.position.y + plinthH + T + clashingHingeY),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth - 37),
              },
              suggestions: [
                "İç çekmece bloğu boyunca 40mm Kör Dikme + Ön Kör Kapama (blind_panel_filler) ekleyin.",
                "Menteşeyi Blum 155° Sıfır Çıkıntılı (71B7550) modele yükseltin.",
              ],
              remediationProposals: blindAndHingeProposals,
            });
          } else if (!hasZeroProtrusionOrSpacer) {
            addFinding({
              severity: "warning",
              code: "WARN_INTERNAL_DRAWER_HINGE_PROTRUSION",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: İç çekmece standart 110° menteşeli kapak arkasında; kapak iç çıkıntısını aşmak için Kör Dikme + Kapama (40mm) ekleyin veya 155° sıfır çıkıntılı menteşeye geçin.`,
              targetId: drw.id,
              targetModuleId: mod.id,
              targetComponentId: drw.id,
              blockingProduction: false,
              compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
              sourceId: "SRC_BLUM_CAT_HINGE",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + bayW / 2),
                y: roundGeometryMm(mod.position.y + plinthH + T + drw.elevationY + drw.height / 2),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth - 37),
              },
              suggestions: [
                "İç çekmece bloğu boyunca 40mm Kör Dikme + Ön Kör Kapama (blind_panel_filler) ekleyin.",
                "Menteşeyi Blum 155° Sıfır Çıkıntılı (71B7550) modele yükseltin.",
              ],
              remediationProposals: blindAndHingeProposals,
            });
          }
        });
      }


      // 2b-i-erg. İnsan Boyu Antropometri & Yüksek Çekmece Görüş / Kavrama Ergonomisi (TS EN 14749 / DIN 33402 / Blum)
      const activeBayDrawers = bay.drawers.filter((d) => !d.isHidden);
      if (activeBayDrawers.length > 0) {
        const sightlineLimitMm = ergProfile.maxDrawerSightlineHeightMm || 1450;
        const overhandLimitMm = ergProfile.maxOverhandTopGripHeightMm || 1200;
        const absMaxReachMm = ergProfile.maxUnderhandDrawerGripHeightMm || 1750;
        const highDrawers = activeBayDrawers.filter(
          (d) => mod.position.y + plinthH + T + d.elevationY + d.height > sightlineLimitMm
        );
        if (highDrawers.length > 0) {
          const highestDrw = highDrawers.reduce((a, b) =>
            a.elevationY + a.height >= b.elevationY + b.height ? a : b
          );
          const highestTopWorldYMm = roundGeometryMm(
            mod.position.y + plinthH + T + highestDrw.elevationY + highestDrw.height
          );
          const isGolaBay = bay.door?.handleCategory === "gola_profile";
          const golaNote = isGolaBay
            ? ` ${Math.round(overhandLimitMm / 10)} cm üzerindeki çekmecelerde üstten L-Gola otomatik iptal edilerek her yüksek çekmecenin kendi altından (avuç yukarı) açılacağı C-Gola profiline çevrildi;`
            : "";
          const overShoulderNote =
            highestTopWorldYMm > absMaxReachMm
              ? ` Üst çekmece kotu (${Math.round(highestTopWorldYMm / 10)} cm) güvenli uzanma sınırını (${Math.round(absMaxReachMm / 10)} cm) da aşıyor.`
              : "";
          addFinding({
            severity: "warning",
            code: "WARN_HIGH_DRAWER_ERGONOMIC_REACH",
            message: `"${mod.name}" Bölme ${bayIdx + 1}: ${highDrawers.length} adet çekmece ortalama insan göz/görüş hizasını (${Math.round(sightlineLimitMm / 10)} cm) aşıyor (En üst: ${Math.round(highestTopWorldYMm / 10)} cm).${golaNote}${overShoulderNote} Kör noktada kalan yüksek çekmeceler yerine ${Math.round(sightlineLimitMm / 10)} cm üstünün raf + kapak düzenine çevrilmesi önerilir.`,
            targetId: highestDrw.id,
            targetModuleId: mod.id,
            targetComponentId: highestDrw.id,
            compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
            sourceId: ergProfile.sourceId,
            ruleNature: "ERGONOMIC_ADVISORY",
            worldPositionMm: {
              x: roundGeometryMm(mod.position.x + bayCursorX + bayW / 2),
              y: highestTopWorldYMm,
              z: roundGeometryMm(mod.position.z + mod.dimensions.depth),
            },
            suggestions: [
              `${Math.round(sightlineLimitMm / 10)} cm üzerindeki çekmeceleri kaldırıp ergonomik raf + üst kapak düzenine dönüştürün (TS EN 14749 / Blum SPACE TOWER standardı).`,
              "Yüksek çekmeceleri koruyacaksanız Bas-Aç (TIP-ON) ray sistemine geçin veya iç organizasyonu hafif tekstil/kuru gıda ile sınırlayın.",
            ],
            remediationProposals: [
              {
                id: `fix_high_drw_shelves_${mod.id}_${bayIdx}`,
                label: `${Math.round(sightlineLimitMm / 10)} cm Üzerindeki Çekmeceleri Raf Düzenine Çevir`,
                description: `Göz hizası (${Math.round(sightlineLimitMm / 10)} cm) altındaki ergonomik çekmeceleri korur; üst bölgeyi sabit ayırıcı tabla + Sistem 32 hareketli raflara dönüştürür.`,
                requiresExplicitUserApproval: true,
                targetModuleId: mod.id,
                targetBayIndex: bayIdx,
                targetComponentId: highestDrw.id,
                patchKind: "convert_high_drawers_to_shelves",
                patchPayload: { maxSightlineWorldYMm: sightlineLimitMm },
              },
              {
                id: `fix_high_drw_tipon_${mod.id}_${bayIdx}`,
                label: "Yüksek Çekmece Grubunu Bas-Aç (TIP-ON) Sisteme Çevir",
                description:
                  "Yüksek kotta el sokma zorluğunu ortadan kaldırmak için cepheye hafif dokunuşla açılan Bas-Aç mekanizmasına geçer.",
                requiresExplicitUserApproval: true,
                targetModuleId: mod.id,
                targetBayIndex: bayIdx,
                targetComponentId: highestDrw.id,
                patchKind: "switch_high_drawers_to_push_open",
                patchPayload: { openingTechnology: "push_to_open" },
              },
            ],
          });
        }
      }

      // 2b-ii. Özel İç Donanım Net Genişlik / Net Derinlik / Net Yükseklik ve Menteşe Kambur Payı Denetimi (Bölüm 4)
      const fittingEnvelopeSpecs: Record<
        string,
        {
          label: string;
          minWidthMm: number;
          maxWidthMm: number;
          minDepthMm: number;
          minHeightMm: number;
          isSideRunnerPullout: boolean;
        }
      > = {
        trouser_rack: {
          label: "Teleskopik Pantolonluk",
          minWidthMm: 420,
          maxWidthMm: 1200,
          minDepthMm: 450,
          minHeightMm: 550,
          isSideRunnerPullout: true,
        },
        shoe_rack: {
          label: "Raylı Ayakkabılık",
          minWidthMm: 380,
          maxWidthMm: 1200,
          minDepthMm: 330,
          minHeightMm: 160,
          isSideRunnerPullout: true,
        },
        wire_basket: {
          label: "Teleskopik Tel Sepet",
          minWidthMm: 340,
          maxWidthMm: 1050,
          minDepthMm: 430,
          minHeightMm: 150,
          isSideRunnerPullout: true,
        },
        jewelry_tray: {
          label: "Kadife Takı Çekmecesi",
          minWidthMm: 350,
          maxWidthMm: 1200,
          minDepthMm: 400,
          minHeightMm: 80,
          isSideRunnerPullout: true,
        },
        pantry_pullout: {
          label: "Tandem / Dispensa Boy Kiler Mekanizması",
          minWidthMm: 250,
          maxWidthMm: 570,
          minDepthMm: 490,
          minHeightMm: 1100,
          isSideRunnerPullout: true,
        },
        imove_pull_down: {
          label: "Asansörlü Üst Dolap Rafı (iMove)",
          minWidthMm: 450,
          maxWidthMm: 880,
          minDepthMm: 260,
          minHeightMm: 480,
          isSideRunnerPullout: false,
        },
        foldable_ironing_board: {
          label: "Katlanır Raylı Ütü Masası",
          minWidthMm: 350,
          maxWidthMm: 580,
          minDepthMm: 480,
          minHeightMm: 140,
          isSideRunnerPullout: true,
        },
        spice_pullout: {
          label: "Dar Şişelik / Baharatlık Mekanizması",
          minWidthMm: 110,
          maxWidthMm: 280,
          minDepthMm: 450,
          minHeightMm: 450,
          isSideRunnerPullout: true,
        },
        waste_bin: {
          label: "Raylı Çöp Ayrıştırma Mekanizması",
          minWidthMm: 350,
          maxWidthMm: 880,
          minDepthMm: 420,
          minHeightMm: 360,
          isSideRunnerPullout: false,
        },
        swivel_mirror: {
          label: "Döner Raylı Boy Aynası",
          minWidthMm: 340,
          maxWidthMm: 1200,
          minDepthMm: 360,
          minHeightMm: 1000,
          isSideRunnerPullout: true,
        },
        dish_drainer: {
          label: "Paslanmaz Tabaklık / Bardaklık",
          minWidthMm: 400,
          maxWidthMm: 980,
          minDepthMm: 250,
          minHeightMm: 280,
          isSideRunnerPullout: false,
        },
      };

      const bayHasZeroProtrusionOrSpacer =
        bay.door?.hardwareProductId === "hw_blum_71b7550" ||
        bay.door?.hardwareProductId === "hw_hettich_9099540" ||
        mod.carcass.internalDrawerHingeSolution === "spacer_block_25mm" ||
        mod.carcass.internalDrawerHingeSolution === "blind_panel_filler" ||
        String(mod.carcass.internalDrawerHingeSolution) === "zero_protrusion_155deg";

      (bay.specialFittings || []).forEach((fit) => {
        if (fit.isHidden) return;
        const env = fittingEnvelopeSpecs[fit.type];
        if (!env) return;

        const widthTooNarrow = bayW < env.minWidthMm;
        const widthTooWide = bayW > env.maxWidthMm;
        const depthTooShallow = netInnerD < env.minDepthMm;
        const heightTooLow = netInnerH < env.minHeightMm;

        if (widthTooNarrow || widthTooWide || depthTooShallow || heightTooLow) {
          const reasons: string[] = [];
          if (widthTooNarrow) reasons.push(`net iç genişlik ${roundGeometryMm(bayW)}mm < min ${env.minWidthMm}mm`);
          if (widthTooWide) reasons.push(`net iç genişlik ${roundGeometryMm(bayW)}mm > maks ${env.maxWidthMm}mm`);
          if (depthTooShallow) reasons.push(`net iç derinlik ${roundGeometryMm(netInnerD)}mm < min ${env.minDepthMm}mm`);
          if (heightTooLow) reasons.push(`net iç yükseklik ${roundGeometryMm(netInnerH)}mm < min ${env.minHeightMm}mm`);

          const proposals: RemediationProposal[] = [];
          if (depthTooShallow) {
            const depthDelta = env.minDepthMm - netInnerD;
            proposals.push({
              id: `fix_fit_depth_${fit.id}`,
              label: `Gövde Derinliğini ${Math.ceil(mod.dimensions.depth + depthDelta + 6)}mm Yap`,
              description: `${env.label} mekanizmasının ray boyu için gereken ${env.minDepthMm}mm net iç derinliği sağlar.`,
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              targetBayIndex: bayIdx,
              targetComponentId: fit.id,
              patchKind: "increase_module_depth",
              patchPayload: { depth: Math.ceil(mod.dimensions.depth + depthDelta + 6) },
            });
          }
          if (widthTooNarrow) {
            const neededExtraW = Math.ceil((env.minWidthMm - bayW) * Math.max(1, mod.bays.length));
            proposals.push({
              id: `fix_fit_width_${fit.id}`,
              label: `Modül Genişliğini ${mod.dimensions.width + neededExtraW}mm Yap`,
              description: `${env.label} için gereken minimum ${env.minWidthMm}mm bölme açıklığını sağlar.`,
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              targetBayIndex: bayIdx,
              targetComponentId: fit.id,
              patchKind: "expand_module_width",
              patchPayload: { width: mod.dimensions.width + neededExtraW },
            });
          }

          addFinding({
            severity: "error",
            code: "ERR_INTERNAL_FITTING_ENVELOPE_VIOLATION",
            message: `"${mod.name}" Bölme ${bayIdx + 1}: ${env.label} (${fit.type}) mevcut iç hacme sığmıyor (${reasons.join("; ")}).`,
            targetId: fit.id,
            targetModuleId: mod.id,
            targetComponentId: fit.id,
            blockingProduction: true,
            compatibilityStatus: "INCOMPATIBLE",
            sourceId: "SRC_HAFELE_WARDROBE_ACC",
            ruleNature: "ENGINEERING_VALIDITY",
            worldPositionMm: {
              x: roundGeometryMm(mod.position.x + bayCursorX + bayW / 2),
              y: roundGeometryMm(mod.position.y + plinthH + T + (fit.elevationY || 200)),
              z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.5),
            },
            suggestions: [
              `${env.label} için net iç genişlik ${env.minWidthMm}–${env.maxWidthMm}mm ve net iç derinlik en az ${env.minDepthMm}mm olmalıdır.`,
            ],
            remediationProposals: proposals.length > 0 ? proposals : undefined,
          });
        }

        // Yan raylı iç mekanizma menteşeli kapak arkasındaysa menteşe gövdesi Y çakışması ve 25mm kambur payı kontrolü
        if (env.isSideRunnerPullout && leaf && dSys.startsWith("hinged") && leaf.hingePositionsY.length > 0) {
          const doorOffY = (leaf.doorY0Mm || plinthH) - (plinthH + T);
          const fitHingeYs = leaf.hingePositionsY.map((hy) => roundGeometryMm(doorOffY + hy));
          const runnerAxisY = (fit.elevationY || 0) + 18;
          const clashingHingeY = fitHingeYs.find(
            (hy) =>
              Math.abs(runnerAxisY - hy) < 34 ||
              (hy >= fit.elevationY - 10 && hy <= fit.elevationY + Math.min(48, fit.height || 90))
          );

          if (clashingHingeY !== undefined && !bayHasZeroProtrusionOrSpacer) {
            addFinding({
              severity: "error",
              code: "ERR_INTERNAL_FITTING_HINGE_BODY_CLASH",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: ${env.label} yan rayı (Y=${fit.elevationY}mm) menteşe taban plakasıyla (Y=${clashingHingeY}mm) çakışıyor!`,
              targetId: fit.id,
              targetModuleId: mod.id,
              targetComponentId: fit.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_BLUM_CAT_HINGE",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + bayW / 2),
                y: roundGeometryMm(mod.position.y + plinthH + T + clashingHingeY),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth - 37),
              },
              suggestions: [
                "25mm yan besleme çıtası (spacer_block_25mm) ekleyin veya 155° sıfır çıkıntılı menteşeye geçin.",
                "Aksesuar kotunu menteşe ekseninden en az 45mm yukarı/aşağı kaydırın.",
              ],
              remediationProposals: [
                {
                  id: `fix_fit_spacer_${fit.id}`,
                  label: "25mm Yan Besleme Çıtası Ekle",
                  description: "Yan rayı menteşe gövdesinden ve kapak kamburundan kurtarır.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  targetBayIndex: bayIdx,
                  targetComponentId: fit.id,
                  patchKind: "add_internal_drawer_spacer",
                  patchPayload: { internalDrawerHingeSolution: "spacer_block_25mm" },
                },
                {
                  id: `fix_fit_155_${fit.id}`,
                  label: "Blum 155° Sıfır Çıkıntılı Menteşeye Geç (71B7550)",
                  description: "Kapak açıldığında iç net açıklığı sıfır çıkıntıyla serbest bırakır.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  targetBayIndex: bayIdx,
                  targetComponentId: bay.door.id,
                  patchKind: "switch_hinge_155_zero",
                  patchPayload: { hardwareProductId: "hw_blum_71b7550" },
                },
              ],
            });
          } else if (
            !bayHasZeroProtrusionOrSpacer &&
            bay.door?.overlayType !== "inset" &&
            (fit.type === "wire_basket" || fit.type === "foldable_ironing_board" || fit.type === "pantry_pullout")
          ) {
            addFinding({
              severity: "warning",
              code: "WARN_INTERNAL_PULLOUT_HINGE_SPACER_REQUIRED",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: Standart 110° menteşeli kapak arkasındaki ${env.label} için ~22–25mm kapak kambur mesafe pulu/çıtası veya 155° sıfır çıkıntılı menteşe kullanılmalıdır.`,
              targetId: fit.id,
              targetModuleId: mod.id,
              targetComponentId: fit.id,
              blockingProduction: false,
              compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
              sourceId: "SRC_BLUM_CAT_HINGE",
              ruleNature: "ENGINEERING_VALIDITY",
              remediationProposals: [
                {
                  id: `adv_fit_spacer_${fit.id}`,
                  label: "25mm Besleme Çıtası Tanımla",
                  description: "BOM ve montaj föyüne 25mm yan besleme çıtası ekler.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  targetBayIndex: bayIdx,
                  targetComponentId: fit.id,
                  patchKind: "add_internal_drawer_spacer",
                  patchPayload: { internalDrawerHingeSolution: "spacer_block_25mm" },
                },
              ],
            });
          }
        }
      });


      // 2b-ext. Bölme İçi Fiziksel & Üretim Çakışma Kontrolü (Ara Dikme × Pantolonluk/Çekmece/Askı, Raf × Pantolonluk Sarkma Boşluğu/Çekmece, Aksesuar × Aksesuar)
      const visShelvesForClash = (bay.shelves || []).filter((s) => !s.isHidden);
      const visDrawersForClash = (bay.drawers || []).filter((d) => !d.isHidden);
      const visRailsForClash = (bay.hangingRails || []).filter((r) => !r.isHidden);
      const visFittingsForClash = (bay.specialFittings || []).filter((f) => f && !f.type.startsWith("led_"));
      const visSubDivsForClash = (bay.subDividers || []).filter((sd) => !sd.isHidden);

      const fitLabelTr = (fitType: string): string => {
        const map: Record<string, string> = {
          trouser_rack: "Pantolonluk",
          wire_basket: "Tel Sepet",
          shoe_rack: "Ayakkabılık",
          jewelry_tray: "Takı Çekmecesi",
          wardrobe_lift: "Asansörlü Askı",
          tie_belt_rack: "Kravat / Kemer Askısı",
          pantry_pullout: "Kiler Mekanizması",
          foldable_ironing_board: "Katlanır Ütü Masası",
          safe_box: "Gizli Kasa",
        };
        return map[fitType] || "İç Aksesuar";
      };

      const getFittingZone = (fit: typeof visFittingsForClash[number]) => {
        const baseY = fit.elevationY || 0;
        const frameH = Math.max(45, fit.height || (fit.type === "trouser_rack" ? 65 : 140));
        // Pantolonluk altında asılı pantolonlar için en az 340mm net sarkma boşluğu gerekir
        const hangDropMm = fit.type === "trouser_rack" ? 340 : 0;
        return {
          frameBot: baseY,
          frameTop: baseY + frameH,
          clearBot: Math.max(0, baseY - hangDropMm),
          clearTop: baseY + frameH,
          hangDropMm,
        };
      };

      // A) Raf Arası Dikme (Sub-Divider) Çakışmaları
      visSubDivsForClash.forEach((sd) => {
        const sdBot = sd.elevationY || 0;
        const sdTop = sdBot + Math.max(60, sd.height || 300);
        const sdX = Math.max(20, Math.min(bayW - 20, sd.offsetX || bayW * 0.5));

        visFittingsForClash.forEach((fit) => {
          const fz = getFittingZone(fit);
          const hitsFrame = sdTop > fz.frameBot + 4 && sdBot < fz.frameTop - 4;
          const hitsDrop = fz.hangDropMm > 0 && sdTop > fz.clearBot + 10 && sdBot < fz.frameBot;
          if (hitsFrame || hitsDrop) {
            const ovBot = Math.max(sdBot, hitsFrame ? fz.frameBot : fz.clearBot);
            const ovTop = Math.min(sdTop, hitsFrame ? fz.frameTop : fz.frameBot);
            const ovMidY = (ovBot + ovTop) * 0.5;
            addFinding({
              severity: "error",
              code: "ERR_SUBDIVIDER_INTERIOR_CLASH",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: Raf arası dikme, ${fitLabelTr(fit.type)} ${hitsFrame ? "mekanizmasının içinden geçiyor" : "altındaki askı/pantolon sarkma alanını kesiyor"} — üretim ve montaj hatası!`,
              targetId: sd.id,
              targetModuleId: mod.id,
              targetComponentId: sd.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_HAFELE_WARDROBE_ACC",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + sdX),
                y: roundGeometryMm(mod.position.y + plinthH + T + ovMidY),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.65),
              },
              suggestions: [
                `Ara dikmeyi ${fitLabelTr(fit.type)} kotunun dışına taşıyın veya kaldırın.`,
                `${fitLabelTr(fit.type)} mekanizmasını ara dikme bulunmayan bir yüksekliğe alın.`,
              ],
            });
          }
        });

        visDrawersForClash.forEach((dr) => {
          const drBot = dr.elevationY || 0;
          const drTop = drBot + Math.max(80, dr.height || 180);
          if (sdTop > drBot + 4 && sdBot < drTop - 4) {
            const ovMidY = (Math.max(sdBot, drBot) + Math.min(sdTop, drTop)) * 0.5;
            addFinding({
              severity: "error",
              code: "ERR_SUBDIVIDER_INTERIOR_CLASH",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: Raf arası dikme, çekmece gövdesiyle (Y=${roundGeometryMm(drBot)}mm) kesişiyor — üretim hatası!`,
              targetId: sd.id,
              targetModuleId: mod.id,
              targetComponentId: sd.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_BLUM_CAT_HINGE",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + sdX),
                y: roundGeometryMm(mod.position.y + plinthH + T + ovMidY),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.65),
              },
              suggestions: [
                "Ara dikme yalnızca çekmecelerin üstündeki raflar arasında konumlanmalıdır.",
              ],
            });
          }
        });

        visRailsForClash.forEach((rl) => {
          const rlY = rl.elevationY || 0;
          if (sdTop > rlY - 90 && sdBot < rlY + 25) {
            addFinding({
              severity: "error",
              code: "ERR_SUBDIVIDER_INTERIOR_CLASH",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: Raf arası dikme, elbise askı borusunu (Y=${roundGeometryMm(rlY)}mm) kesiyor!`,
              targetId: sd.id,
              targetModuleId: mod.id,
              targetComponentId: sd.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_HAFELE_WARDROBE_ACC",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + sdX),
                y: roundGeometryMm(mod.position.y + plinthH + T + rlY),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.55),
              },
              suggestions: [
                "Ara dikmeyi askı borusu seviyesinin dışına taşıyın veya bölmeyi iki ayrı tam dikmeye ayırın.",
              ],
            });
          }
        });
      });

      // A2) Asansörlü Askı × Sabit Askı Borusu Çakışma / Yetersiz Sarkma Uyarısı
      visFittingsForClash
        .filter((fit) => fit.type === "wardrobe_lift")
        .forEach((fit) => {
          const liftBot = fit.elevationY || 0;
          const liftTop = liftBot + Math.max(240, fit.height || 820);
          visRailsForClash.forEach((rl) => {
            if (rl.profileType === "lift_pantograph") return;
            const rlY = rl.elevationY || 0;
            const overlapsBody = rlY >= liftBot - 30 && rlY <= liftTop + 30;
            const tooCloseBelow = !overlapsBody && rlY < liftBot - 30 && liftTop - rlY < 850;
            if (overlapsBody || tooCloseBelow) {
              addFinding({
                severity: "warning",
                code: overlapsBody
                  ? "WARN_WARDROBE_LIFT_RAIL_INTERFERENCE"
                  : "WARN_WARDROBE_LIFT_RAIL_CLEARANCE",
                message: overlapsBody
                  ? `"${mod.name}" Bölme ${bayIdx + 1}: Asansörlü askı (Y=${roundGeometryMm(liftBot)}–${roundGeometryMm(liftTop)}mm) ile sabit askı borusu (Y=${roundGeometryMm(rlY)}mm) çakışıyor — mekanizmanın inişini engelleyebilir.`
                  : `"${mod.name}" Bölme ${bayIdx + 1}: Asansörlü askının hemen altında sabit askı borusu (Y=${roundGeometryMm(rlY)}mm) var — üstteki giysilerin sarkması için en az 850 mm dikey boşluk önerilir.`,
                targetId: fit.id,
                targetModuleId: mod.id,
                targetComponentId: fit.id,
                blockingProduction: false,
                compatibilityStatus: "COMPATIBLE",
                sourceId: "SRC_HAFELE_WARDROBE_ACC",
                ruleNature: "ENGINEERING_VALIDITY",
                worldPositionMm: {
                  x: roundGeometryMm(mod.position.x + bayCursorX + bayW * 0.5),
                  y: roundGeometryMm(mod.position.y + plinthH + T + rlY),
                  z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.55),
                },
                suggestions: [
                  "Alttaki sabit askı borusunu daha aşağı alın veya kaldırın.",
                  "Asansörlü askıyı sabit askı borusu bulunmayan üst bölmeye yerleştirin.",
                ],
              });
            }
          });
        });

      // B) Raf × Pantolonluk / İç Aksesuar / Çekmece / Askı Borusu Çakışmaları
      visShelvesForClash.forEach((sh) => {
        const shBot = sh.elevationY || 0;
        const shTop = shBot + (sh.thickness || T);

        visFittingsForClash.forEach((fit) => {
          const fz = getFittingZone(fit);
          const hitsFrame = shTop > fz.frameBot - 4 && shBot < fz.frameTop + 4;
          const hitsTrouserDrop =
            !hitsFrame && fz.hangDropMm > 0 && shTop > fz.clearBot + 10 && shBot < fz.frameBot;

          if (hitsFrame || hitsTrouserDrop) {
            addFinding({
              severity: "error",
              code: "ERR_SHELF_INTERIOR_CLASH",
              message: hitsFrame
                ? `"${mod.name}" Bölme ${bayIdx + 1}: Raf (Y=${roundGeometryMm(shBot)}mm), ${fitLabelTr(fit.type)} mekanizmasıyla fiziksel olarak çakışıyor!`
                : `"${mod.name}" Bölme ${bayIdx + 1}: Raf (Y=${roundGeometryMm(shBot)}mm), Pantolonluk (Y=${roundGeometryMm(fz.frameBot)}mm) altındaki pantolon sarkma alanını kesiyor (en az 340 mm boşluk gerekir)!`,
              targetId: sh.id,
              targetModuleId: mod.id,
              targetComponentId: sh.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_HAFELE_WARDROBE_ACC",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + bayW * 0.5),
                y: roundGeometryMm(mod.position.y + plinthH + T + shBot + (sh.thickness || T) * 0.5),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.65),
              },
              suggestions: hitsFrame
                ? [
                    `Rafı ${fitLabelTr(fit.type)} kotundan yukarı veya aşağı kaydırın ya da rafı silin.`,
                  ]
                : [
                    `Rafı Pantolonluk kotunun en az 340 mm altına (Y ≤ ${Math.max(80, roundGeometryMm(fz.frameBot - 350))}mm) indirin veya kaldırın.`,
                  ],
            });
          }
        });

        visDrawersForClash.forEach((dr) => {
          const drBot = dr.elevationY || 0;
          const drTop = drBot + Math.max(80, dr.height || 180);
          // Çekmece üst kapağı olarak tam üstüne konulan raf (drTop ± 12mm) geçerlidir; çekmece gövdesinin içinden geçen raf hatadır!
          if (shTop > drBot + 12 && shBot < drTop - 12) {
            addFinding({
              severity: "error",
              code: "ERR_SHELF_INTERIOR_CLASH",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: Raf (Y=${roundGeometryMm(shBot)}mm), çekmece gövdesinin içinden geçiyor — üretim hatası!`,
              targetId: sh.id,
              targetModuleId: mod.id,
              targetComponentId: sh.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_BLUM_CAT_HINGE",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + bayW * 0.5),
                y: roundGeometryMm(mod.position.y + plinthH + T + shBot),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.65),
              },
              suggestions: [
                `Rafı çekmece üstüne (Y ≥ ${roundGeometryMm(drTop)}mm) taşıyın veya silin.`,
              ],
            });
          }
        });

        visRailsForClash.forEach((rl) => {
          const rlY = rl.elevationY || 0;
          if (shTop > rlY - 50 && shBot < rlY + 25) {
            addFinding({
              severity: "error",
              code: "ERR_SHELF_INTERIOR_CLASH",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: Raf (Y=${roundGeometryMm(shBot)}mm), elbise askı borusuyla (Y=${roundGeometryMm(rlY)}mm) çakışıyor!`,
              targetId: sh.id,
              targetModuleId: mod.id,
              targetComponentId: sh.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_HAFELE_WARDROBE_ACC",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + bayW * 0.5),
                y: roundGeometryMm(mod.position.y + plinthH + T + rlY),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.55),
              },
              suggestions: [
                "Askı borusu ile üst raf arasında en az 50–60 mm elbise askısı takma payı bırakın.",
              ],
            });
          }
        });
      });

      // C) İç Aksesuar × Çekmece / İç Aksesuar Çakışmaları
      for (let fi = 0; fi < visFittingsForClash.length; fi += 1) {
        const fA = visFittingsForClash[fi];
        const zA = getFittingZone(fA);
        for (let fj = fi + 1; fj < visFittingsForClash.length; fj += 1) {
          const fB = visFittingsForClash[fj];
          const zB = getFittingZone(fB);
          if (zA.clearTop > zB.clearBot + 8 && zA.clearBot < zB.clearTop - 8) {
            addFinding({
              severity: "error",
              code: "ERR_INTERNAL_COMPONENTS_OVERLAP",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: ${fitLabelTr(fA.type)} ile ${fitLabelTr(fB.type)} düşeyde iç içe geçiyor!`,
              targetId: fA.id,
              targetModuleId: mod.id,
              targetComponentId: fA.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_HAFELE_WARDROBE_ACC",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + bayW * 0.5),
                y: roundGeometryMm(mod.position.y + plinthH + T + (zA.frameBot + zB.frameBot) * 0.5),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.65),
              },
              suggestions: [
                "İki iç aksesuar arasında yeterli dikey çalışma boşluğu bırakacak şekilde kotlarını ayırın.",
              ],
            });
          }
        }
        visDrawersForClash.forEach((dr) => {
          const drBot = dr.elevationY || 0;
          const drTop = drBot + Math.max(80, dr.height || 180);
          if (zA.clearTop > drBot + 8 && zA.clearBot < drTop - 8) {
            addFinding({
              severity: "error",
              code: "ERR_INTERNAL_COMPONENTS_OVERLAP",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: ${fitLabelTr(fA.type)} ile çekmece (Y=${roundGeometryMm(drBot)}mm) çakışıyor!`,
              targetId: fA.id,
              targetModuleId: mod.id,
              targetComponentId: fA.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_HAFELE_WARDROBE_ACC",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + bayW * 0.5),
                y: roundGeometryMm(mod.position.y + plinthH + T + Math.max(zA.clearBot, drBot) + 40),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.65),
              },
              suggestions: [
                `${fitLabelTr(fA.type)} mekanizmasını çekmece bloğunun üstüne taşıyın.`,
              ],
            });
          }
        });
      }

      // 2c. Duvar Köşesine Sıfır Kulplu Menteşeli Kapak 90° Açılım & Kulp Çarpışma Kontrolü (P2-01)
      const handleCat = bay.door?.handleCategory || "bar_handle";
      const hasProtrudingHandle =
        handleCat === "bar_handle" ||
        handleCat === "knob" ||
        handleCat === "long_profile_handle" ||
        handleCat === "decorative_bespoke";

      const hasPhysicalLeftReturnWall = (project.space?.walls || []).some(
        (w) => Math.abs((((w.rotationY || 0) % 180) + 180) % 180 - 90) <= 12 && Math.abs(w.position.x) <= 50
      );
      const hasPhysicalRightReturnWall = (project.space?.walls || []).some(
        (w) =>
          Math.abs((((w.rotationY || 0) % 180) + 180) % 180 - 90) <= 12 &&
          Math.abs(w.position.x - roomWidthMm) <= 80
      );
      if (!mod.isCorner && dSys.startsWith("hinged") && hasProtrudingHandle) {
        const isLeftmostBay = bayIdx === 0;
        const isRightmostBay = bayIdx === mod.bays.length - 1;
        const hingesLeft =
          bay.door.type === "single_left" ||
          bay.door.type === "inset_left" ||
          bay.door.type === "half_overlay_left" ||
          bay.door.type === "double" ||
          bay.door.type === "inset_double";
        const hingesRight =
          bay.door.type === "single_right" ||
          bay.door.type === "inset_right" ||
          bay.door.type === "half_overlay_right" ||
          bay.door.type === "double" ||
          bay.door.type === "inset_double";

        const hasLeftFiller = hasLeftFillerMod;
        const hasRightFiller = hasRightFillerMod;

        const modRotNorm = (((mod.rotation?.y ?? 0) % 360) + 360) % 360;
        const roomDepthMm = project.space?.walls?.[1]?.length || 3200;
        const isRot0 = Math.abs(modRotNorm) <= 8 || Math.abs(modRotNorm - 360) <= 8;
        const isRot90 = Math.abs(modRotNorm - 90) <= 8;
        const isRot270 = Math.abs(modRotNorm - 270) <= 8;

        const hitsLeftReturnWall =
          isLeftmostBay &&
          hingesLeft &&
          !hasLeftFiller &&
          ((isRot0 && hasPhysicalLeftReturnWall && mod.position.x <= 15) ||
            (isRot90 && mod.position.z + mod.dimensions.width >= roomDepthMm - 15) ||
            (isRot270 && mod.position.z <= 15));
        const hitsRightReturnWall =
          isRightmostBay &&
          hingesRight &&
          !hasRightFiller &&
          ((isRot0 && hasPhysicalRightReturnWall && mod.position.x + mod.dimensions.width >= roomWidthMm - 15) ||
            (isRot90 && mod.position.z <= 15) ||
            (isRot270 && mod.position.z + mod.dimensions.width >= roomDepthMm - 15));

        if (hitsLeftReturnWall || hitsRightReturnWall) {
          const blocksInternalPullout = bay.drawers.some((d) => d.isInternal);
          addFinding({
            severity: blocksInternalPullout ? "error" : "warning",
            code: "CHK_SPATIAL_WALL_CORNER_HANDLE_SWING_CLASH",
            message: `"${mod.name}" yan duvara kör parça (wall_filler) olmadan sıfır yerleştirildi; kapak açıldığında çıkıntılı kulp yan duvara çarparak 90° açılımı ${
              blocksInternalPullout ? "ve iç çekmece çıkışını engeller!" : "kısıtlar."
            }`,
            targetId: bay.door.id,
            targetModuleId: mod.id,
            targetComponentId: bay.door.id,
            blockingProduction: blocksInternalPullout,
            compatibilityStatus: blocksInternalPullout
              ? "INCOMPATIBLE"
              : "COMPATIBLE_WITH_CONDITIONS",
            ruleNature: blocksInternalPullout ? "ENGINEERING_VALIDITY" : "ERGONOMIC_ADVISORY",
            worldPositionMm: {
              x: roundGeometryMm(
                hitsLeftReturnWall ? mod.position.x + 15 : mod.position.x + mod.dimensions.width - 15
              ),
              y: roundGeometryMm(mod.position.y + mod.dimensions.height * 0.55),
              z: roundGeometryMm(mod.position.z + mod.dimensions.depth),
            },
            suggestions: [
              "Duvar ile dolap arasına en az 45-50mm Kör Parça (wall_filler) ekleyin.",
              "Kulpsuz J-Kanal (j_pull) veya Bas-Aç kapak mekanizmasına geçin.",
            ],
            remediationProposals: [
              {
                id: `fix_wall_filler_${mod.id}`,
                label: "Duvar Arasına 50mm Kör Parça Payı Bırak",
                description:
                  "Modülü yan duvardan 50mm içeri kaydırarak kapak kulpunun 90° serbest açılmasını sağlar.",
                requiresExplicitUserApproval: true,
                targetModuleId: mod.id,
                targetBayIndex: bayIdx,
                patchKind: "add_wall_filler_50mm",
                patchPayload: {
                  shiftXMm: hitsLeftReturnWall ? 50 : -50,
                },
              },
            ],
          });
        }
      }

      // 2d. Eviye Kazan Hacmi ile Üst Çekmece Çarpışma Denetimi (P1-06)
      if (isSinkModule(mod)) {
        const sinkBowlBottomFromInnerTopMm = 230;
        const safeDrawerTopLimitY = Math.max(0, netInnerH - sinkBowlBottomFromInnerTopMm);
        bay.drawers.forEach((drw) => {
          const drwTopY = drw.elevationY + drw.height;
          if (drwTopY > safeDrawerTopLimitY && !drw.hasSiphonCutout) {
            addFinding({
              severity: "error",
              code: "ERR_SINK_BOWL_DRAWER_COLLISION",
              message: `Eviye modülü "${mod.name}" üst çekmecesi (üst kot ${drwTopY}mm > izin verilen ${safeDrawerTopLimitY}mm) eviye kazanı ve sifon tesisatıyla çarpışıyor; U-sifon kesimi zorunludur.`,
              targetId: drw.id,
              targetModuleId: mod.id,
              targetComponentId: drw.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              sourceId: "SRC_BLUM_SINK_DRAWER",
              ruleNature: "ENGINEERING_VALIDITY",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + bayCursorX + bayW / 2),
                y: roundGeometryMm(mod.position.y + plinthH + T + drwTopY),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.5),
              },
              suggestions: [
                "Çekmecede U-Sifon Boşaltmasını (hasSiphonCutout) etkinleştirin.",
                "Üst bölgeyi sabit kör klapa yapıp çekmeceyi alt kota indirin.",
              ],
              remediationProposals: [
                {
                  id: `fix_sink_siphon_${drw.id}`,
                  label: "Çekmeceye CNC U-Sifon Boşaltması Uygula",
                  description:
                    "Çekmece tabanına ve sırtlığına sifon/batarya geçişi için U-kesim ve dönüş aparatı ekler.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  targetBayIndex: bayIdx,
                  targetComponentId: drw.id,
                  patchKind: "enable_siphon_cutout",
                  patchPayload: { hasSiphonCutout: true },
                },
              ],
            });
          }
        });
      }


      // P0-02: Kulp Vida Ekseni (C-C) — Kapak ve Çekmece Klapa Genişliğine Sığma Kontrolü (Sessiz Kırpma Yasak!)
      if (!mod.isOpenFront && bay.door && bay.door.type !== "open" && dSys !== "open") {
        const hCat = bay.door.handleCategory || "bar_handle";
        const doorProf = bay.door.crossSectionProfile || mod.carcass.crossSectionProfile || "flat_slab";
        const doorCc = resolveCoreHandleSpacingCcMm(bay.door);
        if (leaf && leaf.leafCount > 0) {
          const isLift = dSys.startsWith("lift_");
          const hCheck = resolveCanonicalHandlePlacement({
            partRole: "door_left",
            partId: isLift ? `${bay.door.id}_lift` : bay.door.id,
            frontWidthMm: leaf.leafWidthMm,
            frontHeightMm: leaf.leafHeightMm,
            frontElevationYMm: leaf.doorY0Mm,
            moduleCategory: mod.category,
            moduleElevationYMm: mod.position.y,
            handleCategory: hCat,
            openingTechnology: bay.door.openingTechnology,
            crossSectionProfile: doorProf,
            spacingCcMm: doorCc,
            handleOrientation: bay.door.handleOrientation,
            handleOffsetY: bay.door.handleOffsetY,
            handleEdgeInsetX: bay.door.handleEdgeInsetX,
          });
          if (hCheck.exceedsPanelSpan) {
            const avail = hCheck.orientation === "horizontal" ? leaf.leafWidthMm : leaf.leafHeightMm;
            addFinding({
              severity: "error",
              code: "ERR_HANDLE_CC_EXCEEDS_PANEL_SPAN",
              message: `"${mod.name}" Bölme ${bayIdx + 1}: Seçilen kulp vida ekseni (C-C ${hCheck.spacingCcMm}mm + kenar payları = min ${hCheck.minRequiredSpanMm}mm), kapak ölçüsüne (${avail}mm) sığmıyor!`,
              targetId: bay.door.id,
              targetModuleId: mod.id,
              targetComponentId: bay.door.id,
              blockingProduction: true,
              compatibilityStatus: "INCOMPATIBLE",
              ruleNature: "ENGINEERING_VALIDITY",
              suggestions: [
                "Tek delikli Düğme Kulp (knob) veya daha kısa C-C eksenli kulp seçin.",
                "Bölme/kapak genişliğini büyütün.",
              ],
              remediationProposals: [
                {
                  id: `fix_door_handle_knob_${bay.door.id}`,
                  label: "Tek Delikli Düğme Kulpa (Knob) Geç",
                  description: "Dar kapakta vida ekseni taşmasını tek M4 merkez bağlantısıyla çözer.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  targetBayIndex: bayIdx,
                  targetComponentId: bay.door.id,
                  patchKind: "switch_handle_to_knob",
                  patchPayload: { handleCategory: "knob" },
                },
              ],
            });
          }
        }
      }

      bay.drawers.forEach((drw) => {
        if (drw.isHidden || drw.isInternal) return;
        const hCat = bay.door?.handleCategory || "bar_handle";
        const doorProf = bay.door?.crossSectionProfile || mod.carcass.crossSectionProfile || "flat_slab";
        const drwCc = resolveCoreHandleSpacingCcMm(bay.door);
        const drwFrontW = Math.max(80, bayW + 2 * T - 4);
        const drwHCheck = resolveCanonicalHandlePlacement({
          partRole: "drawer_front",
          partId: `${drw.id}_front`,
          frontWidthMm: drwFrontW,
          frontHeightMm: drw.height,
          moduleCategory: mod.category,
          handleCategory: hCat,
          openingTechnology: bay.door?.openingTechnology,
          crossSectionProfile: doorProf,
          spacingCcMm: drwCc,
        });
        if (drwHCheck.exceedsPanelSpan) {
          addFinding({
            severity: "error",
            code: "ERR_HANDLE_CC_EXCEEDS_PANEL_SPAN",
            message: `"${mod.name}" Bölme ${bayIdx + 1}: Çekmece klapası genişliği (${roundGeometryMm(
              drwFrontW
            )}mm), seçilen kulp vida ekseni (C-C ${drwHCheck.spacingCcMm}mm, min ${drwHCheck.minRequiredSpanMm}mm) için yetersiz!`,
            targetId: drw.id,
            targetModuleId: mod.id,
            targetComponentId: drw.id,
            blockingProduction: true,
            compatibilityStatus: "INCOMPATIBLE",
            ruleNature: "ENGINEERING_VALIDITY",
            suggestions: [
              "Düğme kulp (knob), 96mm dar kulp veya Bas-Aç (push_to_open) seçin.",
            ],
            remediationProposals: [
              {
                id: `fix_drw_handle_knob_${drw.id}`,
                label: "Bölme Kulplarını Düğme Kulpa (Knob) Çevir",
                description: "Dar çekmece klapasına sığmayan kulp eksenini tek nokta bağlantıya çevirir.",
                requiresExplicitUserApproval: true,
                targetModuleId: mod.id,
                targetBayIndex: bayIdx,
                targetComponentId: drw.id,
                patchKind: "switch_handle_to_knob",
                patchPayload: { handleCategory: "knob" },
              },
            ],
          });
        }
      });

      // P1-02: Fiziksel Euler-Bernoulli Raf Sehimi (EN 16122 L/200 Güvenlik & Cam Raf Kalınlık Denetimi)
      const bodyMatObj =
        (project.customMaterials || []).find((m) => m.id === mod.carcass.bodyMaterialId) ||
        DEFAULT_MATERIALS.find((m) => m.id === mod.carcass.bodyMaterialId) ||
        DEFAULT_MATERIALS[0];
      const baseShelfMatCat: "melamine" | "lacquer" | "wood" | "glass" | "metal" =
        bodyMatObj.category === "lacquer"
          ? "lacquer"
          : bodyMatObj.category === "wood"
          ? "wood"
          : bodyMatObj.category === "glass"
          ? "glass"
          : bodyMatObj.category === "metal"
          ? "metal"
          : "melamine";
      const designLoadKgPerM =
        mod.category === "kitchen_tall" || mod.name.toLowerCase().includes("kitap") ? 45 : 28;

      // Tall multi-shelf bay structural fixed tie check (DIN 68871 / EN 14749 Konstruktionsboden)
      const visibleBayShelves = bay.shelves.filter((s) => !s.isHidden);
      const hasFixedTieInBay = visibleBayShelves.some(
        (s) => s.isAdjustable === false || s.isFixed === true
      );
      const hasPulloutFrameInBay = (bay.specialFittings || []).some(
        (f) => !f.isHidden && f.type === "pantry_pullout"
      );
      if (
        mod.dimensions.height >= 1800 &&
        mod.category !== "complementary" &&
        visibleBayShelves.length >= 3 &&
        !hasFixedTieInBay &&
        bay.drawers.length === 0 &&
        !hasPulloutFrameInBay
      ) {
        const midY = netInnerH * 0.5;
        const bestMidShelf = [...visibleBayShelves].sort(
          (a, b) => Math.abs(a.elevationY - midY) - Math.abs(b.elevationY - midY)
        )[0];
        addFinding({
          severity: "warning",
          code: "INFO_TALL_CARCASS_NEEDS_FIXED_SHELF",
          message: `"${mod.name}" Bölme ${bayIdx + 1}: Çok raflı yüksek dolapta (${mod.dimensions.height}mm) tüm raflar hareketli seçilmiş; dikmelerin bel vermemesi için orta kotta en az 1 Sabit Taşıyıcı Raf önerilir.`,
          targetId: `bay_${bayIdx}`,
          targetModuleId: mod.id,
          targetComponentId: bestMidShelf?.id,
          compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
          sourceId: "SRC_STD_ISO7170_2021",
          ruleNature: "ENGINEERING_VALIDITY",
          worldPositionMm: {
            x: roundGeometryMm(mod.position.x + bayCursorX + bayW / 2),
            y: roundGeometryMm(mod.position.y + plinthH + T + (bestMidShelf?.elevationY || midY)),
            z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.5),
          },
          suggestions: [
            "Orta kottaki rafı Minifix/Kavela veya Rafix 20 bağlantılı Sabit Taşıyıcı Raf yapın.",
          ],
          remediationProposals: bestMidShelf
            ? [
                {
                  id: `fix_mid_fixed_shelf_${mod.id}_${bayIdx}`,
                  label: "Orta Rafı Sabit Taşıyıcı Raf Yap",
                  description:
                    "Orta kottaki rafı Minifix + Kavela bağlantılı sabit taşıyıcı rafa dönüştürerek yan dikmeleri birbirine kilitler.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  targetBayIndex: bayIdx,
                  targetComponentId: bestMidShelf.id,
                  patchKind: "convert_mid_shelf_to_fixed",
                  patchPayload: { shelfId: bestMidShelf.id },
                },
              ]
            : undefined,
        });
      }

      bay.shelves.forEach((sh) => {
        if (sh.isHidden) return;
        const shThick = sh.thickness || (sh.isGlass ? 8 : T);
        const shCat = sh.isGlass ? "glass" : baseShelfMatCat;
        const shDepth = Math.max(150, netInnerD - (sh.frontSetbackMm ?? 15));
        const effSpanW = mod.isCorner ? Math.round(bayW * 0.58) : bayW;
        const rawDefl = calculateShelfDeflection(effSpanW, shDepth, shThick, shCat, designLoadKgPerM);
        // Semi-rigid cam-lock + dowel rotational end-restraint reduces midspan deflection by ~15% (0.85), never hiding truly excessive spans!
        const isFixedShelf = sh.isAdjustable === false || sh.isFixed === true;
        const supportBoundaryFactor =
          isFixedShelf && !sh.isGlass && mod.carcass.backPanelType !== "none" ? 0.85 : 1.0;
        const effDeflectionMm = roundGeometryMm(rawDefl.deflectionMm * supportBoundaryFactor);
        const en16122LimitMm = roundGeometryMm(effSpanW / 200);
        const glassTooThinForSpan =
          Boolean(sh.isGlass) && ((shThick < 8 && effSpanW > 700) || (shThick < 10 && effSpanW > 950));

        if (effDeflectionMm > en16122LimitMm || glassTooThinForSpan) {
          const targetThick = sh.isGlass ? (bayW > 950 ? 10 : 8) : 25;
          addFinding({
            severity: "error",
            code: "ERR_SHELF_STRUCTURAL_DEFLECTION",
            message: glassTooThinForSpan
              ? `"${mod.name}" Bölme ${bayIdx + 1}: ${shThick}mm cam raf ${roundGeometryMm(
                  bayW
                )}mm açıklık için kırılma riski taşıyor (en az ${targetThick}mm temperli cam gerekir).`
              : `"${mod.name}" Bölme ${bayIdx + 1}: ${shThick}mm raf sehimi (${effDeflectionMm}mm), EN 16122 güvenlik sınırını (L/200 = ${en16122LimitMm}mm) aşıyor!`,
            targetId: sh.id,
            targetModuleId: mod.id,
            targetComponentId: sh.id,
            blockingProduction: true,
            compatibilityStatus: "INCOMPATIBLE",
            sourceId: "SRC_EN_16122_2012",
            ruleNature: "MANDATORY_SAFETY",
            worldPositionMm: {
              x: roundGeometryMm(mod.position.x + bayCursorX + bayW / 2),
              y: roundGeometryMm(mod.position.y + plinthH + T + sh.elevationY),
              z: roundGeometryMm(mod.position.z + mod.dimensions.depth * 0.5),
            },
            suggestions: [
              `Raf kalınlığını ${targetThick}mm yapın veya orta ara dikme ekleyerek açıklığı daraltın.`,
            ],
            remediationProposals: [
              {
                id: `fix_shelf_thick_${sh.id}`,
                label: `Bu Rafı ${targetThick}mm'ye Yükselt`,
                description: `Atalet momentini (b·t³/12) artırarak bu rafın sehimini EN 16122 güvenlik sınırının altına çeker.`,
                requiresExplicitUserApproval: true,
                targetModuleId: mod.id,
                targetBayIndex: bayIdx,
                targetComponentId: sh.id,
                patchKind: "upgrade_shelf_thickness_25mm",
                patchPayload: { thickness: targetThick },
              },
              ...(mod.bays.reduce((sum, b) => sum + b.shelves.length, 0) > 1
                ? ([
                    {
                      id: `fix_shelf_thick_all_${mod.id}`,
                      label: `Modüldeki Tüm Rafları ${targetThick}mm Yap`,
                      description: `Aynı modüldeki tüm ince rafları ${targetThick}mm kalınlığa yükselterek tek seferde EN 16122 uyumu sağlar.`,
                      requiresExplicitUserApproval: true,
                      targetModuleId: mod.id,
                      targetBayIndex: bayIdx,
                      targetComponentId: sh.id,
                      patchKind: "upgrade_shelf_thickness_25mm" as const,
                      patchPayload: {
                        thickness: targetThick,
                        applyToModule: true,
                        isGlass: Boolean(sh.isGlass),
                      } as Record<string, number | string | boolean>,
                    },
                  ] as RemediationProposal[])
                : []),
            ],
          });
        }
      });

      // 2e. Bölgesel ve Erişilebilirlik Ergonomi Profili Kontrolleri (P2-02)
      bay.shelves.forEach((sh) => {
        const absShelfY = mod.position.y + plinthH + T + sh.elevationY;
        if (absShelfY > ergProfile.maxComfortableShelfHeightMm) {
          addFinding({
            severity: "info",
            code: "INFO_ERGONOMIC_PROFILE_SHELF_REACH",
            message: `[${ergProfile.name}] Raf yüksekliği (${absShelfY}mm), profil konfor erişim sınırını (${ergProfile.maxComfortableShelfHeightMm}mm) aşıyor.`,
            targetId: sh.id,
            targetModuleId: mod.id,
            targetComponentId: sh.id,
            compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
            sourceId: ergProfile.sourceId,
            ruleNature: "ERGONOMIC_ADVISORY",
          });
        }
      });

      bayCursorX += bayW + T;
    });

    // 2f. Ankastre Soğutucu / Fırın Boy Kulesi 200 cm² Baza Hava Girişi Denetimi (P1-06)
    if (isBuiltInOvenOrFridgeTower(mod)) {
      // 200 cm² = 20.000 mm² serbest hava kesiti için tipik 450mm menfezde en az 60mm baza yüksekliği gerekir
      const freePlinthVentAreaCm2 = Math.round(((mod.dimensions.width - 120) * plinthH * 0.65) / 100);
      if (plinthH < 60 || freePlinthVentAreaCm2 < 200 || netInnerD < 530) {
        addFinding({
          severity: "error",
          code: "ERR_APPLIANCE_200CM2_AIRFLOW_VIOLATION",
          message: `Ankastre cihaz kulesi "${mod.name}" soğutma/tahliye şartını karşılamıyor (Baza serbest hava kesiti: ~${Math.max(
            0,
            freePlinthVentAreaCm2
          )} cm² < min 200 cm²; Net iç derinlik: ${netInnerD}mm < min 530mm). Kompresör/cihaz aşırı ısınma riski!`,
          targetId: mod.id,
          targetModuleId: mod.id,
          targetComponentId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          sourceId: "SRC_APPLIANCE_VENT_200CM2",
          ruleNature: "MANDATORY_SAFETY",
          worldPositionMm: {
            x: roundGeometryMm(mod.position.x + mod.dimensions.width / 2),
            y: roundGeometryMm(mod.position.y + Math.max(40, plinthH / 2)),
            z: roundGeometryMm(mod.position.z + mod.dimensions.depth - 40),
          },
          suggestions: [
            "Baza yüksekliğini en az 80-100mm yapın (200 cm² alüminyum menfez için).",
            "Gövde net iç derinliğini arka 50mm baca boşluğu dahil en az 550mm yapın.",
          ],
          remediationProposals: [
            {
              id: `fix_vent_plinth_${mod.id}`,
              label: "Baza Yüksekliğini 100mm ve Gövde Derinliğini 580mm Yap",
              description:
                "200 cm² baza hava girişi ve 50mm kesintisiz arka baca kanalı şartını sağlar.",
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              patchKind: "increase_plinth_for_ventilation",
              patchPayload: { plinthHeight: Math.max(100, plinthH), depth: Math.max(580, mod.dimensions.depth) },
            },
          ],
        });
      }
    }


    // 2h. Baş-Kesim Sonrası Net Kesilebilir Plaka Ebadı (2770×2040mm) ve 70mm Kıskaç Kontrolü (P0-03)
    const maxSheetLen = mod.carcass.allowJumboSheet3660
      ? 3630
      : ENGINEERING_TOLERANCE_POLICY.USABLE_STANDARD_SHEET_LENGTH_MM;
    const maxSheetWid = mod.carcass.allowJumboSheet3660
      ? 1800
      : ENGINEERING_TOLERANCE_POLICY.USABLE_STANDARD_SHEET_WIDTH_MM;

    const candidatePanels: { label: string; l: number; w: number }[] = [
      {
        label: "Yan Dikme",
        l: Math.max(fourSpace.netPanelCut.sidePanelHeightMm, fourSpace.netPanelCut.sidePanelDepthMm),
        w: Math.min(fourSpace.netPanelCut.sidePanelHeightMm, fourSpace.netPanelCut.sidePanelDepthMm),
      },
      {
        label: "Alt/Üst Tabla",
        l: Math.max(fourSpace.netPanelCut.horizontalPanelWidthMm, fourSpace.netPanelCut.horizontalPanelDepthMm),
        w: Math.min(fourSpace.netPanelCut.horizontalPanelWidthMm, fourSpace.netPanelCut.horizontalPanelDepthMm),
      },
    ];
    fourSpace.doorLeaves.forEach((dl, dbi) => {
      if (dl.leafCount > 0) {
        candidatePanels.push({
          label: `Bölme ${dbi + 1} Kapak Kanadı`,
          l: Math.max(dl.leafHeightMm, dl.leafWidthMm),
          w: Math.min(dl.leafHeightMm, dl.leafWidthMm),
        });
      }
    });

    for (const cp of candidatePanels) {
      if (cp.l > maxSheetLen || cp.w > maxSheetWid) {
        const isWidthOverflow =
          (cp.label === "Alt/Üst Tabla" && fourSpace.netPanelCut.horizontalPanelWidthMm > maxSheetLen) ||
          (mod.dimensions.height <= maxSheetLen + plinthH && mod.dimensions.width > maxSheetLen);
        const targetClampedW = Math.min(mod.dimensions.width, maxSheetLen);
        const targetClampedH = Math.min(mod.dimensions.height, maxSheetLen + plinthH);

        addFinding({
          severity: "error",
          code: "ERR_PANEL_EXCEEDS_USABLE_SHEET_SIZE",
          message: `"${mod.name}" ${cp.label} net kesim ölçüsü (${roundGeometryMm(cp.l)}×${roundGeometryMm(
            cp.w
          )}mm), baş-kesim sonrası net kesilebilir plaka sınırını (${maxSheetLen}×${maxSheetWid}mm) aşıyor; parça plakaya yerleşemez!`,
          targetId: mod.id,
          targetModuleId: mod.id,
          targetComponentId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          ruleNature: "ENGINEERING_VALIDITY",
          worldPositionMm: {
            x: roundGeometryMm(mod.position.x + mod.dimensions.width / 2),
            y: roundGeometryMm(mod.position.y + mod.dimensions.height - 60),
            z: roundGeometryMm(mod.position.z + mod.dimensions.depth),
          },
          suggestions: [
            `Modül yüksekliğini/genişliğini net plaka sınırı (${maxSheetLen}mm) içine çekin veya üst yüklük modülüne bölün.`,
            "Özel Jumbo levha (3660×1830mm) tedariki varsa Jumbo Plaka modunu etkinleştirin.",
          ],
          remediationProposals: isWidthOverflow
            ? [
                {
                  id: `fix_sheet_clamp_width_${mod.id}`,
                  label: `Genişliği Net Plaka Sınırına (${targetClampedW}mm) Çek`,
                  description: `Modül genişliğini ${maxSheetLen}mm net kesilebilir standart plaka sınırına indirir.`,
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  patchKind: "clamp_width_to_usable_sheet",
                  patchPayload: { width: targetClampedW },
                },
              ]
            : [
                {
                  id: `fix_sheet_clamp_${mod.id}`,
                  label: `Yüksekliği Net Plaka Sınırına (${maxSheetLen + plinthH}mm) Çek`,
                  description: "Yan dikme boyunu 2770mm net kesilebilir standart plaka sınırına indirir.",
                  requiresExplicitUserApproval: true,
                  targetModuleId: mod.id,
                  patchKind: "clamp_height_to_usable_sheet",
                  patchPayload: { height: targetClampedH },
                },
              ],
        });
        break;
      }
    }

    // 2i. Duvara Asılı Dolaplarda (kitchen_wall & Asma TV/Banyo) EN 14749 Askı Kapasitesi ve Duvar Cinsi Kontrolü (P1-04)
    const isWallHungNoBase =
      mod.category === "kitchen_wall" ||
      Boolean(mod.templateId?.includes("floating")) ||
      (String(mod.category) !== "complementary" &&
        mod.position.y >= 150 &&
        plinthH === 0 &&
        !hasLowerBaseSupportMod);

    if (isWallHungNoBase) {
      const volM3 =
        (mod.dimensions.width * mod.dimensions.height * mod.dimensions.depth) / 1_000_000_000;
      const estLoadedKg = roundGeometryMm(volM3 * 165);
      const maxHangerLocations = mod.bays.length + 1; // Sol dikme + ara dikmeler + sağ dikme
      const maxSafeKgForUprights = maxHangerLocations * 65;

      if (project.space.wallSubstrateType === "drywall_unreinforced") {
        addFinding({
          severity: "error",
          code: "ERR_DRYWALL_UNREINFORCED_HEAVY_HANG",
          message: `"${mod.name}" (tahmini dolu yük ~${estLoadedKg} kg) karkas desteksiz tek kat alçıpan duvara (drywall_unreinforced) güvenle asılamaz!`,
          targetId: mod.id,
          targetModuleId: mod.id,
          targetComponentId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          sourceId: "SRC_EN_14749_2022",
          ruleNature: "MANDATORY_SAFETY",
          suggestions: [
            "Duvar arkasına çelik/ahşap karkas takviyesi yapıp 'drywall_reinforced' seçin veya zemine oturan ayaklı modüle geçin.",
          ],
        });
      } else if (estLoadedKg > maxSafeKgForUprights) {
        addFinding({
          severity: "error",
          code: "ERR_WALL_CABINET_HANGER_OVERLOAD",
          message: `Duvara asılı "${mod.name}" tahmini dolu kütlesi (~${estLoadedKg} kg), mevcut ${maxHangerLocations} taşıyıcı dikmedeki askı kapasitesini (${maxSafeKgForUprights} kg) aşıyor; ara dikme + ek askı elemanı zorunludur!`,
          targetId: mod.id,
          targetModuleId: mod.id,
          targetComponentId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          sourceId: "SRC_EN_14749_2022",
          ruleNature: "MANDATORY_SAFETY",
          suggestions: [
            "Bölme sayısını artırarak orta taşıyıcı dikme ve 3./4. duvar askı elemanı ekleyin.",
            "Genişliği iki ayrı asma modüle bölün.",
          ],
        });
      } else if (estLoadedKg > 95 && !project.space.wallSubstrateType) {
        addFinding({
          severity: "warning",
          code: "CHK_WALL_SUBSTRATE_VERIFICATION_REQUIRED",
          message: `Ağır asma ünite "${mod.name}" (~${estLoadedKg} kg) için duvar taşıyıcı cinsi (betonarme/tuğla/destekli alçıpan) henüz doğrulanmadı.`,
          targetId: mod.id,
          targetModuleId: mod.id,
          targetComponentId: mod.id,
          blockingProduction: false,
          compatibilityStatus: "UNVERIFIED",
          sourceId: "SRC_EN_14749_2022",
          ruleNature: "VERIFICATION_REQUIRED",
          remediationProposals: [
            {
              id: `confirm_wall_concrete_${mod.id}`,
              label: "Duvar Cinsini Betonarme / Dolu Tuğla Olarak Doğrula",
              description: "Saha duvar taşıyıcısının EN 14749 askı yüküne uygun olduğunu kayıt altına alır.",
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              patchKind: "confirm_wall_substrate",
              patchPayload: { wallSubstrateType: "reinforced_concrete" },
            },
          ],
        });
      }
    }

    // 2g. Tesisat / Elektrik / Gaz Uçlarının Taşıyıcı Yan Panel veya Ara Dikme Kesitine Denk Gelmesi — 0°/90°/270°/Açılı OBB Uyumlu! (P2-01)
    const modPlace = calculateModulePlacement(mod);
    const cosM = Math.cos(modPlace.rotationYRad);
    const sinM = Math.sin(modPlace.rotationYRad);
    const localUprightOffsets: { label: string; uMm: number }[] = [
      { label: "Sol Yan Panel", uMm: T / 2 },
      { label: "Sağ Yan Panel", uMm: mod.dimensions.width - T / 2 },
    ];
    let accLocalU = T;
    for (let bi = 0; bi < mod.bays.length - 1; bi++) {
      accLocalU += bayWidths[bi] || 0;
      localUprightOffsets.push({
        label: `Ara Dikme #${bi + 1}`,
        uMm: accLocalU + T / 2,
      });
      accLocalU += T;
    }

    for (const obs of allObstacles) {
      if (obs.type !== "electrical" && obs.type !== "plumbing" && obs.type !== "gas_valve") {
        continue;
      }
      const oSpanW = Math.max(60, obs.dimensions.width || 80);
      const oSpanD = Math.max(60, obs.dimensions.depth || 80);
      const oCenterX = obs.position.x + oSpanW / 2;
      const oCenterZ = obs.position.z + Math.min(40, oSpanD / 2);
      const oMinY = obs.position.y;
      const oMaxY = obs.position.y + Math.max(60, obs.dimensions.height || 80);
      if (oMaxY <= mod.position.y || oMinY >= mod.position.y + mod.dimensions.height) continue;

      // Project obstacle center into module local coordinates (u along width 0..W, v along depth 0..D from rear face!)
      const dxWorld = oCenterX - modPlace.origin.x;
      const dzWorld = oCenterZ - modPlace.origin.z;
      const localU = dxWorld * cosM - dzWorld * sinM;
      const localV = dxWorld * sinM + dzWorld * cosM;

      // Obstacle must lie near the rear wall face of the module (-120mm .. +250mm) and within module width span
      if (localV < -120 || localV > 250 || localU < -40 || localU > mod.dimensions.width + 40) {
        continue;
      }

      const halfObsRadius = oSpanW / 2 + T / 2 + 8;
      for (const upPlane of localUprightOffsets) {
        if (Math.abs(localU - upPlane.uMm) <= halfObsRadius) {
          const hitWorldX = modPlace.origin.x + upPlane.uMm * cosM + 20 * sinM;
          const hitWorldZ = modPlace.origin.z - upPlane.uMm * sinM + 20 * cosM;
          addFinding({
            severity: "error",
            code: "ERR_MEP_OUTLET_BLOCKED_BY_UPRIGHT_PANEL",
            message: `Tesisat/Priz çakışması: "${obs.name}" (${obs.type}), "${mod.name}" modülünün "${upPlane.label}" taşıyıcı dikme kesitine denk geliyor!`,
            targetId: mod.id,
            targetModuleId: mod.id,
            targetComponentId: obs.id,
            blockingProduction: true,
            compatibilityStatus: "INCOMPATIBLE",
            ruleNature: "MANDATORY_SAFETY",
            worldPositionMm: {
              x: roundGeometryMm(hitWorldX),
              y: roundGeometryMm((oMinY + oMaxY) / 2),
              z: roundGeometryMm(hitWorldZ),
            },
            suggestions: [
              "Modülü veya bölme dikmesini tesisat ekseninden en az 45mm kaydırın.",
            ],
          });
        }
      }
    }

    // 2j. Suyolu / Damar Takibi Grubu (`grainGroupId`) Tek Plaka Şerit Uzunluğu Kontrolü (P2-02)
    const grainGroups = new Map<string, number>();
    mod.bays.forEach((b) => {
      b.drawers.forEach((d) => {
        if (!d.isHidden && d.grainGroupId) {
          grainGroups.set(d.grainGroupId, (grainGroups.get(d.grainGroupId) || 0) + d.height + 4);
        }
      });
    });
    grainGroups.forEach((totalStripMm, gid) => {
      if (totalStripMm > maxSheetLen) {
        addFinding({
          severity: "warning",
          code: "WARN_GRAIN_GROUP_EXCEEDS_SINGLE_SHEET",
          message: `"${mod.name}" suyolu damar grubu (${gid}) toplam kesim şeridi (${roundGeometryMm(
            totalStripMm
          )}mm), tek plaka net boyunu (${maxSheetLen}mm) aşıyor; kesintisiz damar takibi tek plakadan çıkamaz.`,
          targetId: mod.id,
          targetModuleId: mod.id,
          compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
          ruleNature: "ENGINEERING_VALIDITY",
          suggestions: [
            "Damar grubunu iki ayrı bölgeye ayırın veya 3660mm Jumbo kaplama levhası kullanın.",
          ],
        });
      }
    });

    // 2m. V7.4 Mimari Tavan Tipi Alt Kot Çakışması & Kapak Tavan Boşluğu Kontrolü
    if (project.space?.ceilingConfig?.enabled) {
      const W = mod.dimensions.width;
      const H = mod.dimensions.height;
      const D = mod.dimensions.depth;
      const rotRad = ((mod.rotation?.y || 0) * Math.PI) / 180;
      const cosR = Math.cos(rotRad);
      const sinR = Math.sin(rotRad);
      const toWorldXZ = (lx: number, lz: number) => ({
        x: mod.position.x + lx * cosR + lz * sinR,
        z: mod.position.z - lx * sinR + lz * cosR,
      });

      const rs = mod.carcass?.roofSlope;
      const rs2 = mod.carcass?.secondaryRoofSlope;
      const sc = mod.carcass?.slopedCeiling;
      type ActiveModSlope = { side: "left" | "right" | "rear"; kneeH: number; runMm: number };
      const activeModSlopes: ActiveModSlope[] = [];
      if (rs && rs.side && rs.side !== "none") {
        const kneeH = Math.max(400, Math.min(H - 20, rs.kneeWallHeightMm));
        const runMm = Math.max(150, Math.min(rs.side === "rear" ? D : W, rs.slopeRunMm));
        if (H - kneeH >= 20) activeModSlopes.push({ side: rs.side, kneeH, runMm });
      } else if (sc && sc.mode && sc.mode !== "none") {
        const side =
          sc.mode === "left_slope" ? "left" : sc.mode === "right_slope" ? "right" : "rear";
        const kneeH = Math.max(400, Math.min(H - 20, sc.kneeHeightMm));
        const rad = (Math.max(5, Math.min(75, sc.slopeAngleDeg || 35)) * Math.PI) / 180;
        const runMm = Math.max(
          150,
          Math.min(side === "rear" ? D : W, Math.round((H - kneeH) / Math.max(0.15, Math.tan(rad))))
        );
        if (H - kneeH >= 20) activeModSlopes.push({ side, kneeH, runMm });
      }
      if (rs2 && rs2.side && rs2.side !== "none") {
        const kneeH = Math.max(400, Math.min(H - 20, rs2.kneeWallHeightMm));
        const runMm = Math.max(150, Math.min(rs2.side === "rear" ? D : W, rs2.slopeRunMm));
        if (H - kneeH >= 20) activeModSlopes.push({ side: rs2.side, kneeH, runMm });
      }

      const evalModTopAtLocal = (lx: number, lz: number): number => {
        let minLocalH = H;
        for (const sl of activeModSlopes) {
          const rise = H - sl.kneeH;
          let hLocal = H;
          if (sl.side === "left") {
            hLocal = lx >= sl.runMm ? H : sl.kneeH + (Math.max(0, lx) / sl.runMm) * rise;
          } else if (sl.side === "right") {
            const distR = W - lx;
            hLocal = distR >= sl.runMm ? H : sl.kneeH + (Math.max(0, distR) / sl.runMm) * rise;
          } else {
            hLocal = lz >= sl.runMm ? H : sl.kneeH + (Math.max(0, lz) / sl.runMm) * rise;
          }
          if (hLocal < minLocalH) minLocalH = hLocal;
        }
        return mod.position.y + minLocalH;
      };

      const sampleLocalPts: [number, number][] = [
        [0, 0],
        [W, 0],
        [0, D],
        [W, D],
      ];
      for (const sl of activeModSlopes) {
        if (sl.side === "left" && sl.runMm > 5 && sl.runMm < W - 5) {
          sampleLocalPts.push([sl.runMm, 0], [sl.runMm, D]);
        } else if (sl.side === "right" && sl.runMm > 5 && sl.runMm < W - 5) {
          sampleLocalPts.push([W - sl.runMm, 0], [W - sl.runMm, D]);
        } else if (sl.side === "rear" && sl.runMm > 5 && sl.runMm < D - 5) {
          sampleLocalPts.push([0, sl.runMm], [W, sl.runMm]);
        }
      }

      let worstOvershoot = 0;
      let minGapMm = Infinity;
      let worstModTopY = mod.position.y + H;
      let worstCeilClear = computeEffectiveCeilingClearHeight(
        project.space,
        mod.position.x,
        W,
        mod.position.z,
        D
      );
      let tightestCeilClear = worstCeilClear;
      let worstWorldPt = toWorldXZ(W / 2, D / 2);

      for (const [lx, lz] of sampleLocalPts) {
        const wPt = toWorldXZ(lx, lz);
        const ptClear = computeEffectiveCeilingClearHeight(
          project.space,
          Math.max(0, wPt.x),
          1,
          Math.max(0, wPt.z),
          1
        );
        const ptModTop = evalModTopAtLocal(lx, lz);
        const gap = ptClear.minClearHeightMm - ptModTop;
        if (gap < minGapMm) {
          minGapMm = gap;
          tightestCeilClear = ptClear;
        }
        const overshoot = -gap;
        if (overshoot > worstOvershoot) {
          worstOvershoot = overshoot;
          worstModTopY = ptModTop;
          worstCeilClear = ptClear;
          worstWorldPt = wPt;
        }
      }

      const ceilClear = worstCeilClear;
      const modTopY = worstModTopY;
      if (worstOvershoot > 2.0) {
        addFinding({
          severity: "error",
          code: "ERR_CEILING_TYPE_COLLISION",
          message: `"${mod.name}" üst kotu (${roundGeometryMm(
            modTopY
          )}mm), seçilen tavan tipinin (${ceilClear.reasonLabel}) net alt kotunu (${roundGeometryMm(
            ceilClear.minClearHeightMm
          )}mm) aşıyor!`,
          targetId: mod.id,
          targetModuleId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          ruleNature: "ENGINEERING_VALIDITY",
          worldPositionMm: {
            x: worstWorldPt.x,
            y: ceilClear.minClearHeightMm,
            z: worstWorldPt.z,
          },
          remediationProposals: [
            {
              id: `fix_ceil_clamp_${mod.id}`,
              label: `Yüksekliği Tavan Alt Kotuna Uyarla (${Math.max(
                400,
                Math.floor(ceilClear.minClearHeightMm - mod.position.y - 20)
              )}mm)`,
              description: "Modül yüksekliğini net tavan alt kotundan 20mm montaj payı bırakacak şekilde düşürür.",
              requiresExplicitUserApproval: true,
              targetModuleId: mod.id,
              patchKind: "clamp_height_to_usable_sheet",
              patchPayload: {
                targetHeightMm: Math.max(
                  400,
                  Math.floor(ceilClear.minClearHeightMm - mod.position.y - 20)
                ),
              },
            },
          ],
        });
      } else if (
        String(mod.category) !== "complementary" &&
        minGapMm < 15 &&
        mod.bays.some((b) => b.door && b.door.type !== "open" && b.door.type !== "sliding")
      ) {
        addFinding({
          severity: "warning",
          code: "WARN_CEILING_DOOR_SWEEP_TIGHT",
          message: `"${mod.name}" ile ${tightestCeilClear.reasonLabel} arasındaki montaj/açılım boşluğu çok dar (${roundGeometryMm(
            minGapMm
          )}mm < 15mm); tavan terazisi eğriliğinde kapak sürtebilir.`,
          targetId: mod.id,
          targetModuleId: mod.id,
          compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
          ruleNature: "ENGINEERING_VALIDITY",
        });
      }
    }

    // 2n. V7.4 Çoklu Delik Sistemi Kapalıyken Hareketli Raf Seçimi Kontrolü
    if (mod.carcass.multiHoleMode === "none") {
      const hasAdjShelf = mod.bays.some((b) =>
        (b.shelves || []).some((s) => !s.isHidden && s.isAdjustable !== false)
      );
      if (hasAdjShelf) {
        addFinding({
          severity: "error",
          code: "ERR_ADJUSTABLE_SHELF_WITHOUT_PIN_HOLES",
          message: `"${mod.name}" modülünde Çoklu Delik Sistemi kapatılmış (Deliksiz) ancak hareketli raf bulunuyor; Ø5mm pim deliği olmadan hareketli raf taşınamaz!`,
          targetId: mod.id,
          targetModuleId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          ruleNature: "ENGINEERING_VALIDITY",
          suggestions: [
            "Çoklu delik modunu Tekli Raf Pimi, 3-lü Küme veya Tam Boy Sistem 32 olarak değiştirin ya da rafları sabit yapın.",
          ],
        });
      }
    }

    // 2l. Tip-B (`top_bottom_through`) Ağır Boy Dolap / Taş Tezgâh Alt Tabla Kesme Yükü Kontrolü (Şartname Bölüm 3)
    if (
      mod.carcass.carcassJoineryTopology === "top_bottom_through" &&
      (mod.carcass.plinthHeight ?? 80) > 0 &&
      (mod.dimensions.height >= 1900 ||
        mod.category === "kitchen_base" ||
        mod.category === "kitchen_tall" ||
        mod.category === "kitchen_island")
    ) {
      addFinding({
        severity: "warning",
        code: "CHK_TOP_BOTTOM_THROUGH_LEG_SHEAR",
        message: `"${mod.name}" modülünde Tip-B (Alt/Üst Tabla Tam Boy) birleşim seçili; ağır düşey yük altında yan dikme kesme kuvvetinin alt tablada sehim yaratmaması için ayar ayakları yan panel ekseninin tam altına basmalı veya Tip-A (Yanlar Tam Boy) tercih edilmelidir.`,
        targetId: mod.id,
        targetModuleId: mod.id,
        compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
        sourceId: "SRC_HAFELE_MINIFIX",
        ruleNature: "ENGINEERING_VALIDITY",
        remediationProposals: [
          {
            id: `switch_sides_through_${mod.id}`,
            label: "Tip-A (Yan Paneller Tam Boy) Konstrüksiyona Geç",
            description: "Düşey gövde ve tezgâh yükünü doğrudan yan dikmeler üzerinden baza ayaklarına aktarır.",
            requiresExplicitUserApproval: true,
            targetModuleId: mod.id,
            patchKind: "switch_topology_sides_through",
            patchPayload: { carcassJoineryTopology: "sides_through" },
          },
        ],
      });
    }

    // 2k. Islak Hacim (Banyo Lavabo / Mutfak Eviye) Neme Dayanıklı Gövde Malzemesi Kontrolü (P2-03)
    const isWetModule =
      isSinkModule(mod) ||
      Boolean(mod.templateId?.includes("bathroom")) ||
      mod.name.toLowerCase().includes("banyo") ||
      mod.name.toLowerCase().includes("lavabo");
    if (
      isWetModule &&
      (mod.carcass.bodyMaterialId === "mat_chipboard_raw" ||
        mod.carcass.bodyMaterialId === "mat_melamine_oak_raw")
    ) {
      addFinding({
        severity: "warning",
        code: "WARN_WET_ZONE_MOISTURE_BOARD_RECOMMENDED",
        message: `Islak hacim ünitesi "${mod.name}" gövdesinde neme dayanıksız ham yonga levha seçili; su buharı ve sızıntıya karşı MR-MDF / Lake / Kompakt gövde önerilir.`,
        targetId: mod.id,
        targetModuleId: mod.id,
        compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
        ruleNature: "ENGINEERING_VALIDITY",
        remediationProposals: [
          {
            id: `fix_wet_board_${mod.id}`,
            label: "Gövdeyi Neme Dayanıklı MDF Lake'ye Yükselt",
            description: "Islak hacimde şişme riskini önlemek için gövde malzemesini neme dayanıklı sınıfa geçirir.",
            requiresExplicitUserApproval: true,
            targetModuleId: mod.id,
            patchKind: "upgrade_wet_zone_board",
            patchPayload: { bodyMaterialId: "mat_lacquer_cream" },
          },
        ],
      });
    }
    moduleEngineeringSliceCache.set(modSliceKey, modFindings);
  }

  void addFinding;
}
