import { DEFAULT_MATERIALS, type DesignProject, type MaterialDefinition } from "@birim/core";
import { generateBOMForProject } from "./bom-generator";
import {
  optimizeSheetNesting,
  STANDARD_SHEET_2800x2070,
  type NestingOptimizationResult,
  type SheetDimension,
} from "./sheet-nesting";
import type { CutPiece } from "./types";

export interface BatchProjectNestingEntry {
  project: DesignProject;
  /** Örneğin aynı tipteki 10 veya 25 dairenin toplu kesimi için çarpan (varsayılan: 1). */
  unitMultiplier?: number;
  unitLabelPrefix?: string;
}

export interface MultiProjectBatchNestingSummary {
  totalApartmentOrUnitCount: number;
  totalPooledCutPiecesCount: number;
  separateTotalSheetsCount: number;
  combinedTotalSheetsCount: number;
  savedSheetsCount: number;
  separateAverageWastePercent: number;
  combinedAverageWastePercent: number;
  wasteReductionPoints: number;
  estimatedSavedBoardCostEur: number;
  combinedNestingResults: NestingOptimizationResult[];
}

/**
 * KesApp / Endüstriyel Seri Üretim Esinli Çoklu Proje & Çoklu Daire Plaka Optimizasyonu:
 * Birden fazla dairenin (ör. 5, 10, 25 dairelik konut projesi) veya farklı odaların
 * (Mutfak + Giyinme Odası + Vestiyer) kesim parçalarını ünite/daire etiketlerini koruyarak
 * tek bir ortak kesim havuzunda (2800x2070 / 2800x2100) optimize eder ve kazanılan net plaka
 * adedini ile EUR malzeme tasarrufunu hesaplar.
 */
export function optimizeMultiProjectBatchNesting(
  entries: ReadonlyArray<BatchProjectNestingEntry>,
  options?: {
    sheetConfig?: SheetDimension;
    materialsMap?: Map<string, MaterialDefinition>;
  }
): MultiProjectBatchNestingSummary {
  const sheetConfig = options?.sheetConfig || STANDARD_SHEET_2800x2070;
  const matMap =
    options?.materialsMap || new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
  const sheetAreaM2 = (sheetConfig.lengthMm * sheetConfig.widthMm) / 1_000_000;

  if (!entries || entries.length === 0) {
    return {
      totalApartmentOrUnitCount: 0,
      totalPooledCutPiecesCount: 0,
      separateTotalSheetsCount: 0,
      combinedTotalSheetsCount: 0,
      savedSheetsCount: 0,
      separateAverageWastePercent: 0,
      combinedAverageWastePercent: 0,
      wasteReductionPoints: 0,
      estimatedSavedBoardCostEur: 0,
      combinedNestingResults: [],
    };
  }

  let totalUnits = 0;
  let separateSheets = 0;
  let separateGrossM2 = 0;
  let separateNetM2 = 0;
  const pooledCutPieces: CutPiece[] = [];
  const separateSheetsByMaterial = new Map<string, number>();

  entries.forEach((entry, entryIdx) => {
    const mult = Math.max(1, Math.min(200, Math.round(entry.unitMultiplier ?? 1)));
    totalUnits += mult;

    const singleBom = generateBOMForProject(entry.project, matMap, {
      sheetConfig,
    });
    const singleSheetsCount = singleBom.nestingResults.reduce(
      (acc, r) => acc + r.totalSheetsCount,
      0
    );
    separateSheets += singleSheetsCount * mult;

    for (const r of singleBom.nestingResults) {
      separateGrossM2 += r.totalGrossAreaM2 * mult;
      separateNetM2 += r.totalNetAreaM2 * mult;
      separateSheetsByMaterial.set(
        r.materialId,
        (separateSheetsByMaterial.get(r.materialId) || 0) + r.totalSheetsCount * mult
      );
    }

    const prefixBase =
      entry.unitLabelPrefix?.trim() ||
      entry.project.title?.trim().slice(0, 22) ||
      `Proje-${entryIdx + 1}`;

    for (const cp of singleBom.cutList) {
      pooledCutPieces.push({
        ...cp,
        id: `batch_e${entryIdx}_${cp.id}`,
        pieceName: `[${prefixBase}${mult > 1 ? ` ×${mult}` : ""}] ${cp.pieceName}`,
        quantity: cp.quantity * mult,
        areaM2: Number((cp.areaM2 * mult).toFixed(4)),
        edgeBandMeters: Number((cp.edgeBandMeters * mult).toFixed(3)),
      });
    }
  });

  const combinedResults = optimizeSheetNesting(pooledCutPieces, sheetConfig);
  const combinedSheets = combinedResults.reduce((acc, r) => acc + r.totalSheetsCount, 0);
  const combinedGrossM2 = combinedResults.reduce((acc, r) => acc + r.totalGrossAreaM2, 0);
  const combinedNetM2 = combinedResults.reduce((acc, r) => acc + r.totalNetAreaM2, 0);

  const separateAvgWaste =
    separateGrossM2 > 0
      ? Number((((separateGrossM2 - separateNetM2) / separateGrossM2) * 100).toFixed(1))
      : 0;
  const combinedAvgWaste =
    combinedGrossM2 > 0
      ? Number((((combinedGrossM2 - combinedNetM2) / combinedGrossM2) * 100).toFixed(1))
      : 0;

  let savedEur = 0;
  for (const r of combinedResults) {
    const sepCount = separateSheetsByMaterial.get(r.materialId) || r.totalSheetsCount;
    const savedForMat = Math.max(0, sepCount - r.totalSheetsCount);
    if (savedForMat > 0) {
      const matDef = matMap.get(r.materialId);
      const costPerM2 = matDef?.costPerM2 ?? 18;
      savedEur += savedForMat * sheetAreaM2 * costPerM2;
    }
  }

  const savedSheetsCount = Math.max(0, separateSheets - combinedSheets);
  const totalPieceInstances = pooledCutPieces.reduce((acc, p) => acc + p.quantity, 0);

  return {
    totalApartmentOrUnitCount: totalUnits,
    totalPooledCutPiecesCount: totalPieceInstances,
    separateTotalSheetsCount: separateSheets,
    combinedTotalSheetsCount: combinedSheets,
    savedSheetsCount,
    separateAverageWastePercent: separateAvgWaste,
    combinedAverageWastePercent: combinedAvgWaste,
    wasteReductionPoints: Number(Math.max(0, separateAvgWaste - combinedAvgWaste).toFixed(1)),
    estimatedSavedBoardCostEur: Number(savedEur.toFixed(2)),
    combinedNestingResults: combinedResults,
  };
}
