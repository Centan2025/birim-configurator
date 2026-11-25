import { DesignProject } from "../types";
import { calculateBayWidths } from "../rules";
import { resolveCanonicalDrawerCuttingFormula } from "../v4-profiles";
import { roundCncCoordMm, roundGeometryMm } from "../tolerance-policy";
import type { EngineeringValidationFinding } from "./stability-and-deflection";

export function runStackedAndCustomVerificationAudits(
  project: DesignProject,
  addFinding: (f: EngineeringValidationFinding) => void
): void {
  // 3. Üst Üste İstiflenen Modüllerde (Stacked Modules) Yük Aktarımı, Konsol Taşma ve Taşıyıcı Dikme Hizası (Bölüm 3)
  for (const upper of project.modules) {
    if (
      upper.category === "complementary" ||
      upper.category === "kitchen_wall" ||
      upper.position.y <= 50
    ) {
      continue;
    }
    const uLeft = upper.position.x;
    const uRight = upper.position.x + upper.dimensions.width;
    const uFront = upper.position.z + upper.dimensions.depth;
    const uRear = upper.position.z;

    // Find floor/lower modules whose top surface meets upper.position.y (within ±20mm) and overlaps in X & Z
    const supportingBases = project.modules.filter((base) => {
      if (base.id === upper.id || base.category === "complementary") return false;
      const baseTopY = base.position.y + base.dimensions.height;
      if (Math.abs(baseTopY - upper.position.y) > 20) return false;
      const bLeft = base.position.x;
      const bRight = base.position.x + base.dimensions.width;
      const bRear = base.position.z;
      const bFront = base.position.z + base.dimensions.depth;
      return uLeft < bRight - 10 && uRight > bLeft + 10 && uRear < bFront - 20 && uFront > bRear + 20;
    });

    if (supportingBases.length === 0) {
      const hasWallSuspension =
        upper.carcass.wallAnchored === true ||
        Boolean(upper.carcass.wallSuspensionType && String(upper.carcass.wallSuspensionType) !== "none");
      if (!hasWallSuspension) {
        addFinding({
          severity: "error",
          code: "ERR_STACKED_MODULE_UNSUPPORTED_MIDAIR",
          message: `Üst modül "${upper.name}" (Y=${upper.position.y}mm) altında taşıyıcı alt modül olmadan ve duvar askı onayı bulunmadan havada duruyor!`,
          targetId: upper.id,
          targetModuleId: upper.id,
          targetComponentId: upper.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          sourceId: "SRC_EN_14749_2022",
          ruleNature: "MANDATORY_SAFETY",
          worldPositionMm: {
            x: roundGeometryMm(uLeft + upper.dimensions.width / 2),
            y: roundGeometryMm(upper.position.y),
            z: roundGeometryMm(uFront),
          },
          suggestions: [
            "Modülü altındaki taşıyıcı gövdenin üst kotuna oturtun veya zemine (Y=0) indirin.",
            "Duvara asılı ünite ise duvar taşıyıcı askı sistemini onaylayın.",
          ],
          remediationProposals: [
            {
              id: `fix_stack_drop_${upper.id}`,
              label: "Modülü Zemine (Y=0mm) İndir",
              description: "Havada kalan modülü zemin kotuna oturtarak yapısal mesnet sağlar.",
              requiresExplicitUserApproval: true,
              targetModuleId: upper.id,
              patchKind: "snap_stacked_to_support_or_floor",
              patchPayload: { positionY: 0 },
            },
          ],
        });
      }
    } else {
      const minSupportLeftX = Math.min(...supportingBases.map((b) => b.position.x));
      const maxSupportRightX = Math.max(
        ...supportingBases.map((b) => b.position.x + b.dimensions.width)
      );
      const maxSupportDepthZ = Math.max(
        ...supportingBases.map((b) => b.position.z + b.dimensions.depth)
      );

      const leftOverhangMm = roundCncCoordMm(minSupportLeftX - uLeft);
      const rightOverhangMm = roundCncCoordMm(uRight - maxSupportRightX);
      const frontOverhangMm = roundCncCoordMm(uFront - maxSupportDepthZ);

      if (leftOverhangMm > 25 || rightOverhangMm > 25 || frontOverhangMm > 35) {
        addFinding({
          severity: "error",
          code: "ERR_STACKED_MODULE_CANTILEVER_OVERHANG",
          message: `Üst üste bağlanan "${upper.name}" modülü alt taşıyıcı gövdeden desteksiz taşıyor (Sol taşma: ${Math.max(
            0,
            leftOverhangMm
          )}mm, Sağ taşma: ${Math.max(0, rightOverhangMm)}mm, Ön taşma: ${Math.max(
            0,
            frontOverhangMm
          )}mm). Yük aktarımı güvensiz!`,
          targetId: upper.id,
          targetModuleId: upper.id,
          targetComponentId: upper.id,
          blockingProduction: true,
          compatibilityStatus: "INCOMPATIBLE",
          sourceId: "SRC_EN_16122_2012",
          ruleNature: "MANDATORY_SAFETY",
          worldPositionMm: {
            x: roundGeometryMm(uLeft + upper.dimensions.width / 2),
            y: roundGeometryMm(upper.position.y),
            z: roundGeometryMm(uFront),
          },
          suggestions: [
            "Üst kutu genişliğini ve X hizasını alt taşıyıcı modül sınırlarına eşitleyin.",
          ],
          remediationProposals: [
            {
              id: `fix_stack_align_${upper.id}`,
              label: `Üst Modülü Alt Gövdeye Hizala (${maxSupportRightX - minSupportLeftX}mm)`,
              description:
                "Üst modülün X konumunu ve genişliğini alt taşıyıcı modül dikmeleriyle tam hizalar.",
              requiresExplicitUserApproval: true,
              targetModuleId: upper.id,
              patchKind: "align_stacked_width_to_base",
              patchPayload: {
                positionX: minSupportLeftX,
                width: maxSupportRightX - minSupportLeftX,
              },
            },
          ],
        });
      } else {
        // Check vertical load-bearing upright alignment: collect all vertical side/divider X planes of supporting base modules
        const baseLoadBearingPlanesX: number[] = [];
        for (const base of supportingBases) {
          const bT = base.carcass.panelThickness || 18;
          baseLoadBearingPlanesX.push(base.position.x + bT / 2);
          baseLoadBearingPlanesX.push(base.position.x + base.dimensions.width - bT / 2);
          const bBayWs = calculateBayWidths(base);
          let curX = base.position.x + bT;
          for (let bi = 0; bi < base.bays.length - 1; bi++) {
            curX += bBayWs[bi] || 0;
            baseLoadBearingPlanesX.push(curX + bT / 2);
            curX += bT;
          }
        }
        const uT = upper.carcass.panelThickness || 18;
        const upperLeftPlaneX = uLeft + uT / 2;
        const upperRightPlaneX = uRight - uT / 2;
        const leftAligned = baseLoadBearingPlanesX.some((px) => Math.abs(px - upperLeftPlaneX) <= 35);
        const rightAligned = baseLoadBearingPlanesX.some((px) => Math.abs(px - upperRightPlaneX) <= 35);

        if (!leftAligned || !rightAligned) {
          addFinding({
            severity: "warning",
            code: "WARN_STACKED_UPRIGHT_LOAD_PATH_OFFSET",
            message: `Üst modül "${upper.name}" yan dikmeleri alt modülün taşıyıcı yan/orta dikmeleriyle aynı düşey eksende değil; alt modül üst tablasında eğilme riski oluşur (25mm üst tabla veya orta dikme hizası önerilir).`,
            targetId: upper.id,
            targetModuleId: upper.id,
            targetComponentId: upper.id,
            compatibilityStatus: "COMPATIBLE_WITH_CONDITIONS",
            sourceId: "SRC_EN_16122_2012",
            ruleNature: "ENGINEERING_VALIDITY",
            worldPositionMm: {
              x: roundGeometryMm(!leftAligned ? upperLeftPlaneX : upperRightPlaneX),
              y: roundGeometryMm(upper.position.y),
              z: roundGeometryMm(uFront),
            },
            suggestions: [
              "Üst modül dikmelerini alt modül yan/ara dikme eksenlerine hizalayın.",
              "Alt modül üst tablasını 25mm kalınlığa yükseltin.",
            ],
          });
        }
      }
    }
  }

  // 4. Özel Malzeme ve Özel Donanımlarda Eksik Teknik Veri Koruması (`VERIFICATION_REQUIRED` — Bölüm 3, 6 & 7)
  const customMatMap = new Map((project.customMaterials || []).map((cm) => [cm.id, cm]));
  for (const mod of project.modules) {
    const usedMatIds = new Set<string>([
      mod.carcass.bodyMaterialId,
      mod.carcass.doorMaterialId,
      ...(mod.carcass.countertopMaterialId ? [mod.carcass.countertopMaterialId] : []),
      ...mod.bays.map((b) => b.door?.doorMaterialId).filter((x): x is string => Boolean(x)),
    ]);

    for (const matId of usedMatIds) {
      const cMat = customMatMap.get(matId);
      if (
        cMat &&
        (!cMat.densityKgPerM3 ||
          cMat.densityKgPerM3 <= 0 ||
          (!cMat.elasticModulusMpa && cMat.mechanicalDataVerified !== true))
      ) {
        addFinding({
          severity: "warning",
          code: "CHK_DATA_CUSTOM_MATERIAL_UNVERIFIED",
          message: `Özel tanımlı malzeme "${cMat.name}" (${cMat.id}) için doğrulanmış yoğunluk veya elastisite modülü (MPa) girilmemiş; kapak ağırlığı ve raf sehim hesabı tahmini değerle yapıldı, mühendislik doğrulaması gerektirir.`,
          targetId: mod.id,
          targetModuleId: mod.id,
          targetComponentId: mod.id,
          blockingProduction: true,
          compatibilityStatus: "UNVERIFIED",
          ruleNature: "VERIFICATION_REQUIRED",
          worldPositionMm: {
            x: roundGeometryMm(mod.position.x + mod.dimensions.width / 2),
            y: roundGeometryMm(mod.position.y + mod.dimensions.height / 2),
            z: roundGeometryMm(mod.position.z + mod.dimensions.depth),
          },
          suggestions: [
            "Malzeme üretici teknik föyünden gerçek yoğunluk (kg/m³) ve elastisite modülü (MPa) değerlerini girip doğrulayın.",
          ],
        });
      }
    }

    mod.bays.forEach((bay, bIdx) => {
      bay.drawers.forEach((drw) => {
        if (drw.hardwareProductId) {
          const cutSpec = resolveCanonicalDrawerCuttingFormula(
            drw.hardwareProductId,
            drw.boxSystemType
          );
          if (!cutSpec.isVerifiedCatalogFormula) {
            addFinding({
              severity: "warning",
              code: "CHK_DATA_CUSTOM_DRAWER_FORMULA_UNVERIFIED",
              message: `"${mod.name}" Bölme ${bIdx + 1} çekmecesinde seçilen özel donanım (${drw.hardwareProductId}) için doğrulanmış üretici kesim formülü bulunamadı; üretim öncesi numune doğrulaması zorunludur.`,
              targetId: drw.id,
              targetModuleId: mod.id,
              targetComponentId: drw.id,
              blockingProduction: true,
              compatibilityStatus: "UNVERIFIED",
              ruleNature: "VERIFICATION_REQUIRED",
              worldPositionMm: {
                x: roundGeometryMm(mod.position.x + mod.dimensions.width / 2),
                y: roundGeometryMm(mod.position.y + (mod.carcass.plinthHeight || 0) + drw.elevationY),
                z: roundGeometryMm(mod.position.z + mod.dimensions.depth),
              },
              suggestions: [
                "Üretici teknik dokümanındaki taban/sırt düşüm ölçülerini katalog kaydına işleyin veya doğrulanmış Blum/Hettich ray seçin.",
              ],
            });
          }
        }
      });
    });
  }

  // V102: Architectural Wall Skirting Board Intersection Detection (Duvar Süpürgeliği Çakışma Kontrolü)
  const skCfg = project.space?.skirtingConfig;
  const skEnabled = skCfg ? skCfg.enabled !== false : true;
  const skH = Math.max(0, skCfg?.heightMm ?? 114);
  const skT = Math.max(0, skCfg?.thicknessMm ?? 16);
  if (skEnabled && skH > 0 && skT > 0) {
    const walls = project.space?.walls || [];
    const mainWallLen = walls[0]?.length || 3600;
    project.modules.forEach((mod) => {
      if (mod.category === "complementary") return;
      const modBottomY = mod.position?.y || 0;
      if (modBottomY >= skH) return; // Wall-hung / upper cabinet clears skirting cleanly
      const rot = (((mod.rotation?.y || 0) % 360) + 360) % 360;
      let distToWall = 9999;
      if (rot < 10 || rot > 350) {
        distToWall = mod.position.z;
      } else if (Math.abs(rot - 90) <= 10) {
        distToWall = Math.min(Math.abs(mod.position.x), Math.abs(mainWallLen - mod.position.x));
      } else if (Math.abs(rot - 270) <= 10) {
        distToWall = Math.min(Math.abs(mod.position.x), Math.abs(mainWallLen - mod.position.x));
      } else if (Math.abs(rot - 180) <= 10) {
        const frontWall = walls.find((w) => (w.position?.z || 0) >= 1000);
        if (frontWall) distToWall = Math.abs(frontWall.position.z - mod.position.z);
      }
      const bbNotch = mod.carcass?.baseboardNotch;
      const bbCoversSkirting =
        Boolean(bbNotch?.enabled) &&
        (bbNotch?.heightMm ?? 0) >= skH - 1 &&
        (bbNotch?.depthMm ?? 0) >= skT - 1;
      if (bbCoversSkirting) return;

      if (distToWall < skT - 1) {
        const hasPartialNotch = Boolean(bbNotch?.enabled);
        addFinding({
          code: "WARN_WALL_SKIRTING_CLASH",
          severity: "warning",
          ruleNature: "ENGINEERING_VALIDITY",
          blockingProduction: false,
          targetModuleId: mod.id,
          message: hasPartialNotch
            ? `"${mod.name}" arka süpürgelik çentiği (${bbNotch?.heightMm}×${bbNotch?.depthMm} mm), duvar süpürgeliğinden (${skH}×${skT} mm) küçük kalıyor. Çentiği en az ${skH}×${skT} mm yapın.`
            : `"${mod.name}" arka alt kenarı duvar süpürgeliği (${skH} mm yüksek, ${skT} mm kalın) ile kesişiyor. Dolap arka duvara tam yanaşmak için süpürgelik kadar (+${skT} mm) öne alınmalı veya arka süpürgelik çentiği açılmalıdır.`,
          worldPositionMm: {
            x: roundGeometryMm(mod.position.x + mod.dimensions.width * 0.5),
            y: roundGeometryMm(Math.min(skH * 0.5, modBottomY + 50)),
            z: roundGeometryMm(mod.position.z + 18),
          },
          suggestions: [
            `Dolabı duvar süpürgeliği kalınlığı (+${skT} mm) kadar öne çekin`,
            "Oda ayarlarından duvar süpürgeliğini kapatın veya arka bazada süpürgelik kertmesi uygulayın",
          ],
        });
      }
    });
  }

}
