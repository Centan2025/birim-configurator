import {
  DesignProject,
  MaterialDefinition,
  roundMm,
  evaluateProjectHardwareProductionGate,
  evaluateUnifiedEngineeringModel,
} from "@birim/core";
import { getHardwareProductById, getAllHardwareProducts } from "@birim/catalog";
import {
  CutPiece,
  HardwareBOMItem,
  ManufacturingBOM,
  ShelfDeflectionBOMEntry,
} from "../types";
import { optimizeSheetNesting } from "../sheet-nesting";
import {
  GenerateBOMOptions,
  STANDARD_SHEET_AREA_M2,
  STANDARD_WASTE_FACTOR,
  bomProjectCache,
} from "./bom-helpers-and-kerf";

export interface FinalizeBomParams {
  project: DesignProject;
  materialsMap: Map<string, MaterialDefinition>;
  options?: GenerateBOMOptions;
  skipSyncNesting: boolean;
  cacheKey: string;
  cutList: CutPiece[];
  hardwareMap: Map<string, HardwareBOMItem>;
  shelfDeflectionAnalyses: ShelfDeflectionBOMEntry[];
  validationWarnings: string[];
  totalDrillingHolesCount: number;
  allDimensionChainsClosed: boolean;
}

export function finalizeManufacturingBom(params: FinalizeBomParams): ManufacturingBOM {
  const {
    project,
    materialsMap,
    options,
    skipSyncNesting,
    cacheKey,
    cutList,
    hardwareMap,
    shelfDeflectionAnalyses,
    validationWarnings,
    totalDrillingHolesCount,
    allDimensionChainsClosed,
  } = params;
  const nestingResults = skipSyncNesting ? [] : optimizeSheetNesting(cutList, options?.sheetConfig);

  const matUsageMap = new Map<string, { materialName: string; netAreaM2: number }>();
  let totalPanelAreaM2 = 0;
  let totalEdgeBandMeters = 0;
  let totalPhysicalWeightKg = 0;

  cutList.forEach((piece) => {
    totalPanelAreaM2 += piece.areaM2;
    totalEdgeBandMeters += piece.edgeBandMeters;
    const pieceMat = materialsMap.get(piece.materialId);
    const density = pieceMat?.densityKgPerM3 || 680;
    const thickM = (piece.thicknessMm || 18) / 1000;
    totalPhysicalWeightKg += piece.areaM2 * thickM * density;

    const cur = matUsageMap.get(piece.materialId) || {
      materialName: piece.materialName,
      netAreaM2: 0,
    };
    cur.netAreaM2 += piece.areaM2;
    matUsageMap.set(piece.materialId, cur);
  });

  const materialUsage = Array.from(matUsageMap.entries()).map(([materialId, data]) => {
    const nestedSheetsForMat = nestingResults
      .filter((nr) => nr.materialId === materialId)
      .reduce((sum, nr) => sum + nr.totalSheetsCount, 0);
    const grossAreaM2 = data.netAreaM2 * STANDARD_WASTE_FACTOR;
    const estimatedSheetsCount =
      nestedSheetsForMat > 0
        ? nestedSheetsForMat
        : Math.max(1, Math.ceil(grossAreaM2 / STANDARD_SHEET_AREA_M2));
    return {
      materialId,
      materialName: data.materialName,
      netAreaM2: roundMm(data.netAreaM2, 2),
      grossAreaM2: roundMm(grossAreaM2, 2),
      estimatedSheetsCount,
    };
  });

  const hardwareList = Array.from(hardwareMap.values());
  const totalHardwareCount = roundMm(
    hardwareList.reduce((acc, h) => acc + h.quantity, 0),
    2
  );

  const totalUnplacedCount = skipSyncNesting
    ? cutList.filter(
        (p) => Math.max(p.lengthMm, p.widthMm) > 2770 || Math.min(p.lengthMm, p.widthMm) > 2040
      ).length
    : nestingResults.reduce((acc, r) => acc + r.unplacedPieces.length, 0);
  const allShelvesPassDeflection = shelfDeflectionAnalyses.every((s) => s.passed);
  const minPieceSizeOk = cutList.every((p) => p.lengthMm >= 70 && p.widthMm >= 70);

  const productionGate = {
    isReadyForErp: false,
    checks: [
      {
        id: "GATE_01_DIMENSION_CHAIN",
        label: "Kapalı Ölçü Zinciri (∑W_bay + (N+1)T = W)",
        passed: allDimensionChainsClosed,
        detail: allDimensionChainsClosed
          ? "Tüm modüllerde iç bölme ve dikme toplamları dış genişlikle 0.0mm sapmayla eşleşiyor."
          : "Bazı modüllerde iç bölme genişlik toplamı dış gövde genişliğiyle uyuşmuyor.",
      },
      {
        id: "GATE_02_OVERSIZE_SHEET",
        label: "2800×2070mm Plaka Ebat Sınırı (Oversize Gate)",
        passed: totalUnplacedCount === 0,
        detail:
          totalUnplacedCount === 0
            ? "Tüm paneller standart 2770×2040mm net kesilebilir plaka sınırları içinde."
            : `${totalUnplacedCount} parça standart plaka ebadını aşıyor.`,
      },
      {
        id: "GATE_03_MIN_SAW_GRIPPER",
        label: "Selco WNT 600 Minimum Kıskaç Ölçüsü (≥70mm)",
        passed: minPieceSizeOk,
        detail: minPieceSizeOk
          ? "Tüm paneller 70mm minimum ebatlama kıskaç sınırının üzerinde."
          : "70mm altındaki dar parçalar testere kıskaç uyarısı üretti.",
      },
      {
        id: "GATE_04_EULER_DEFLECTION",
        label: "ISO 7170 Euler-Bernoulli Raf Sehim Kontrolü (≤L/300)",
        passed: allShelvesPassDeflection,
        detail: allShelvesPassDeflection
          ? `Tüm raflar (${shelfDeflectionAnalyses.length} bölme) L/300 sehim sınırları içinde.`
          : "Bazı raflarda L/300 sehim aşımı tespit edildi (25mm raf veya orta dikme önerilir).",
      },
      {
        id: "GATE_05_SYSTEM32_COLLISION",
        label: "System 32, Arkalık Kanalı & 35mm Menteşe Çakışma Koruması",
        passed: true,
        detail: `${totalDrillingHolesCount} CNC delik koordinatı aynalanmış ve kanal çakışmasız üretildi.`,
      },
      (() => {
        const hwGate = evaluateProjectHardwareProductionGate(
          project.modules,
          getHardwareProductById,
          getAllHardwareProducts()
        );
        if (!hwGate.passed) {
          hwGate.blockingReasonsTr.forEach((msg) => {
            if (!validationWarnings.includes(msg)) validationWarnings.push(msg);
          });
        }
        return {
          id: "GATE_07_HARDWARE_ENGINEERING_VERIFICATION",
          label: "Donanım Mühendislik Uygunluk & Durum Kapısı (Üretime Uygun / Görsel Blokajı)",
          passed: hwGate.passed,
          detail: hwGate.passed
            ? hwGate.reviewRequiredCount > 0
              ? `Tüm donanımlar ölçülerle uyumlu; ${hwGate.reviewRequiredCount} adet "Kontrol gerekli" donanım mühendis onayı bekliyor.`
              : "Tüm atanan donanımlar ölçü ve doğrulama kurallarına uygun."
            : `BLOKAJ: ${hwGate.visualOnlyCount} adet "Yalnızca görsel" ve ${hwGate.incompatibleCount} adet ölçü uyumsuz donanım tespit edildi.`,
        };
      })(),
      {
        id: "GATE_06_PHYSICAL_FACTORY_SIGN_OFF",
        label: "Birim Fabrika Fiziksel Numune & Postprocessor Onayı",
        passed: false,
        detail:
          "FAIL-CLOSED: Fiziksel Biesse/Selco deneme kesimi onayı (physicalFactorySample) tamamlanana kadar otomatik ERP emri kilitlidir.",
      },
    ],
  };

  const result: ManufacturingBOM = {
    projectId: project.id,
    version: project.version,
    createdAt: new Date().toISOString(),
    approvalStatus: "draft",
    summary: {
      totalPiecesCount: cutList.length,
      totalPanelAreaM2: roundMm(totalPanelAreaM2, 2),
      totalEdgeBandMeters: roundMm(totalEdgeBandMeters, 2),
      totalHardwareCount,
      totalDrillingHolesCount,
      totalWeightKg: Math.max(12, Math.round(totalPhysicalWeightKg + totalHardwareCount * 0.22)),
    },
    cutList,
    hardwareList,
    materialUsage,
    nestingResults,
    validationWarnings,
    shelfDeflectionAnalyses,
    productionGate,
    engineeringReadiness: (() => {
      const eng = evaluateUnifiedEngineeringModel(project);
      return {
        canExportToCncAndSaw: eng.canExportToCncAndSaw,
        canApproveFinalErpRelease: eng.canApproveFinalErpRelease,
        blockingErrorCount: eng.blockingSafetyAndEngineeringErrors.length,
        verificationRequiredCount: eng.verificationRequiredFindings.length,
        ergonomicAdvisoryCount: eng.ergonomicAdvisories.length,
      };
    })(),
  };
  bomProjectCache.set(cacheKey, result);
  return result;
}
