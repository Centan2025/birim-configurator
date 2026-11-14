import { CutPiece } from "./types";
import { roundMm } from "@birim/core";
import {
  runErpNesting,
  extractErpReclaimableRemnants,
  convertCutPieceToErpPartInput,
  parseErpSheetGrain,
  type ErpCutSequence,
  type ErpPlacementData,
} from "./erp-nesting";

export interface SheetDimension {
  name: string;
  lengthMm: number; // e.g. 2800 mm (X-axis along board grain)
  widthMm: number; // e.g. 2070 or 2100 mm (Y-axis across board grain)
  trimCutMm: number; // e.g. 15 mm perimeter trim
  kerfMm: number; // e.g. 4 mm saw blade thickness
}

export const STANDARD_SHEET_2800x2070: SheetDimension = {
  name: "Standart Ham/Melamin Levha 2800x2070",
  lengthMm: 2800,
  widthMm: 2070,
  trimCutMm: 15,
  kerfMm: 4.0,
};

export const STANDARD_ERP_SHEET_2800x2100: SheetDimension = {
  name: "Birim ERP Standart Levha 2800x2100",
  lengthMm: 2800,
  widthMm: 2100,
  trimCutMm: 15,
  kerfMm: 4.0,
};

export interface PlacedPiece {
  pieceId: string;
  pieceName: string;
  materialName: string;
  x: number;
  y: number;
  width: number; // X extent, along sheet length (2800mm grain axis)
  length: number; // Y extent, along sheet width (2070/2100mm cross-grain axis)
  isRotated: boolean;
  edgeL1?: string;
  edgeL2?: string;
  edgeW1?: string;
  edgeW2?: string;
  hasGroove?: boolean;
  grooveSide?: string;
  grooveOffset?: number;
  grainDirection?: "horizontal" | "vertical" | "none" | null;
  color?: string;
  polygonContourMm?: [number, number][];
}

export interface UsableRemnantRect {
  x: number;
  y: number;
  width: number;
  length: number;
  areaM2: number;
}

export interface OptimizedSheet {
  sheetIndex: number;
  materialId: string;
  materialName: string;
  sheetDimension: SheetDimension;
  placedPieces: PlacedPiece[];
  usableRemnants?: UsableRemnantRect[];
  usableRemnantAreaM2?: number;
  netUsedAreaM2: number;
  totalSheetAreaM2: number;
  wasteAreaM2: number;
  wastePercent: number;
  algorithm?: string;
  sequences?: ErpCutSequence[];
  cuttingInstructions?: string[];
  erpPlacements?: ErpPlacementData[];
}

export interface NestingOptimizationResult {
  materialId: string;
  materialName: string;
  thicknessMm?: number;
  algorithm?: string;
  sheets: OptimizedSheet[];
  unplacedPieces: CutPiece[];
  totalSheetsCount: number;
  totalNetAreaM2: number;
  totalGrossAreaM2: number;
  overallWastePercent: number;
}

const nestingCache = new Map<string, NestingOptimizationResult[]>();

function computeNestingKey(
  pieces: CutPiece[],
  sheetConfig: SheetDimension,
  algorithm: "Auto" | "Guillotine" | "MaxRects"
): string {
  return JSON.stringify([sheetConfig, algorithm, pieces]);
}

/**
 * Birim ERP Nesting Motoru Tabanlı Plaka Yerleşim Optimizasyonu.
 * Konfigüratör içindeki BOM, fiyatlandırma ve plaka özetlerinin Birim ERP'deki
 * `runNesting` (`Auto` / `Guillotine` / `MaxRects`) ve `extractReclaimableRemnants`
 * motoruyla %100 aynı sonucu üretmesini sağlar.
 */
export function optimizeSheetNesting(
  pieces: CutPiece[],
  sheetConfig: SheetDimension = STANDARD_SHEET_2800x2070,
  algorithm: "Auto" | "Guillotine" | "MaxRects" = "Auto"
): NestingOptimizationResult[] {
  if (!pieces || pieces.length === 0) return [];

  const cacheKey = computeNestingKey(pieces, sheetConfig, algorithm);
  const cached = nestingCache.get(cacheKey);
  if (cached) return cached;

  const materialGroups = new Map<string, CutPiece[]>();
  pieces.forEach((p) => {
    const groupKey = `${p.materialId}::${p.thicknessMm}`;
    const list = materialGroups.get(groupKey) || [];
    list.push(p);
    materialGroups.set(groupKey, list);
  });

  const results: NestingOptimizationResult[] = [];
  const fullSheetAreaM2 =
    (sheetConfig.lengthMm * sheetConfig.widthMm) / 1_000_000;
  const usableW = sheetConfig.lengthMm - 2 * sheetConfig.trimCutMm;
  const usableH = sheetConfig.widthMm - 2 * sheetConfig.trimCutMm;

  materialGroups.forEach((matPieces) => {
    const matId = matPieces[0].materialId;
    const matName = matPieces[0]?.materialName || "Bilinmeyen Malzeme";
    const thicknessMm = matPieces[0]?.thicknessMm || 18;
    const sheetGrain = matPieces.some((p) => p.grain !== "none")
      ? "vertical"
      : parseErpSheetGrain(matName).grainDirection;

    const fitPieces: CutPiece[] = [];
    const unplaced: CutPiece[] = [];

    matPieces.forEach((p) => {
      const netL = p.netCutLengthMm ?? p.lengthMm;
      const netW = p.netCutWidthMm ?? p.widthMm;
      const isCross = p.grain === "crosswise";
      const reqW = isCross ? netW : netL;
      const reqH = isCross ? netL : netW;
      const canRot = p.grain === "none";

      const fitsNormal = reqW <= usableW && reqH <= usableH;
      const fitsRot = canRot && reqH <= usableW && reqW <= usableH;
      if (!fitsNormal && !fitsRot) {
        unplaced.push(p);
      } else {
        fitPieces.push(p);
      }
    });

    // P2-02 (V7.1): True Composite Grain Strip Packing & Coordinate Unpacking!
    // Group pieces sharing `grainGroupId` (qty === 1) into an indivisible composite block separated by exact `kerfMm`
    // so guillotine / MaxRects NEVER scatters grain-matched drawer fronts or doors across different sheets!
    const rawConverted = fitPieces.map((cp) =>
      convertCutPieceToErpPartInput(cp, {
        useNetCutDimensions: true,
        materialCode: `${matId.toUpperCase()}-${thicknessMm}MM`,
        sheetHasGrain: sheetGrain !== "none",
      })
    );

    interface NestingSlotEntry {
      partInput: typeof rawConverted[number]["partInput"];
      members: Array<{
        conv: typeof rawConverted[number];
        dxMm: number;
        dyMm: number;
      }>;
    }

    const grainBuckets = new Map<string, typeof rawConverted>();
    const standaloneConvs: typeof rawConverted = [];
    for (const rc of rawConverted) {
      const gid = rc.sourcePiece.grainGroupId;
      if (gid && (rc.sourcePiece.quantity || 1) === 1) {
        const list = grainBuckets.get(gid) || [];
        list.push(rc);
        grainBuckets.set(gid, list);
      } else {
        standaloneConvs.push(rc);
      }
    }

    const slotEntries: NestingSlotEntry[] = [];
    grainBuckets.forEach((groupList, gid) => {
      const sorted = [...groupList].sort(
        (a, b) =>
          (a.sourcePiece.grainOffsetXMm ?? 0) - (b.sourcePiece.grainOffsetXMm ?? 0) ||
          (a.sourcePiece.grainOffsetYMm ?? 0) - (b.sourcePiece.grainOffsetYMm ?? 0) ||
          a.sourcePiece.id.localeCompare(b.sourcePiece.id)
      );
      if (sorted.length < 2) {
        sorted.forEach((c) => slotEntries.push({ partInput: c.partInput, members: [{ conv: c, dxMm: 0, dyMm: 0 }] }));
        return;
      }
      const hasExplicit2dOffsets = sorted.every(
        (s) => typeof s.sourcePiece.grainOffsetXMm === "number" && typeof s.sourcePiece.grainOffsetYMm === "number"
      );
      const members: NestingSlotEntry["members"] = [];
      let blockW = 0;
      let blockH = 0;

      if (hasExplicit2dOffsets) {
        // 2D Cephe / Modül Desen Takibi Haritası: Plaka X ekseni damar yönüdür (2800mm)
        // 2mm kapak fugası < 4mm testere kerf payı olduğu için komşu parçalar arasında en az kerfMm boşluk garanti edilir.
        const rawMapped = sorted.map((c) => {
          const w = c.partInput.width_mm;
          const h = c.partInput.height_mm;
          const offX = c.sourcePiece.grainOffsetXMm ?? 0;
          const offY = c.sourcePiece.grainOffsetYMm ?? 0;
          const rawDx = c.crosswiseCanonicalized ? offX : offY;
          const rawDy = c.crosswiseCanonicalized ? offY : offX;
          return { conv: c, w, h, rawDx, rawDy, dxMm: rawDx, dyMm: rawDy };
        });
        // X ekseninde (damar boyu) çakışma / eksik kerf düzeltmesi
        rawMapped.sort((a, b) => a.rawDx - b.rawDx || a.rawDy - b.rawDy);
        for (let i = 0; i < rawMapped.length; i++) {
          for (let j = 0; j < i; j++) {
            const prev = rawMapped[j];
            const cur = rawMapped[i];
            const yOverlap = cur.dyMm < prev.dyMm + prev.h - 0.5 && prev.dyMm < cur.dyMm + cur.h - 0.5;
            if (yOverlap && cur.dxMm < prev.dxMm + prev.w + sheetConfig.kerfMm) {
              cur.dxMm = roundMm(prev.dxMm + prev.w + sheetConfig.kerfMm, 2);
            }
          }
        }
        // Y ekseninde (damar eni) çakışma / eksik kerf düzeltmesi
        rawMapped.sort((a, b) => a.rawDy - b.rawDy || a.dxMm - b.dxMm);
        for (let i = 0; i < rawMapped.length; i++) {
          for (let j = 0; j < i; j++) {
            const prev = rawMapped[j];
            const cur = rawMapped[i];
            const xOverlap = cur.dxMm < prev.dxMm + prev.w - 0.5 && prev.dxMm < cur.dxMm + cur.w - 0.5;
            if (xOverlap && cur.dyMm < prev.dyMm + prev.h + sheetConfig.kerfMm) {
              cur.dyMm = roundMm(prev.dyMm + prev.h + sheetConfig.kerfMm, 2);
            }
          }
        }
        for (const rm of rawMapped) {
          members.push({ conv: rm.conv, dxMm: roundMm(rm.dxMm, 2), dyMm: roundMm(rm.dyMm, 2) });
          blockW = Math.max(blockW, roundMm(rm.dxMm + rm.w, 2));
          blockH = Math.max(blockH, roundMm(rm.dyMm + rm.h, 2));
        }
      } else {
        const stackAlongX = sorted.every((s) => s.crosswiseCanonicalized);
        let cursor = 0;
        let maxOrtho = 0;
        for (let idx = 0; idx < sorted.length; idx++) {
          const c = sorted[idx];
          const w = c.partInput.width_mm;
          const h = c.partInput.height_mm;
          if (stackAlongX) {
            members.push({ conv: c, dxMm: roundMm(cursor, 2), dyMm: 0 });
            cursor += w + (idx < sorted.length - 1 ? sheetConfig.kerfMm : 0);
            if (h > maxOrtho) maxOrtho = h;
          } else {
            members.push({ conv: c, dxMm: 0, dyMm: roundMm(cursor, 2) });
            cursor += h + (idx < sorted.length - 1 ? sheetConfig.kerfMm : 0);
            if (w > maxOrtho) maxOrtho = w;
          }
        }
        blockW = roundMm(stackAlongX ? cursor : maxOrtho, 2);
        blockH = roundMm(stackAlongX ? maxOrtho : cursor, 2);
      }
      if (blockW <= usableW && blockH <= usableH) {
        const sampleInput = sorted[0].partInput;
        slotEntries.push({
          partInput: {
            ...sampleInput,
            part_label: `SUYOLU_GRUP_${gid}`,
            width_mm: blockW,
            height_mm: blockH,
            quantity: 1,
            can_rotate: false,
            grain_direction: "vertical",
          },
          members,
        });
      } else {
        // Strip exceeds single usable sheet; fall back to individual placement (validation engine already emits WARN_GRAIN_GROUP_EXCEEDS_SINGLE_SHEET)
        sorted.forEach((c) => slotEntries.push({ partInput: c.partInput, members: [{ conv: c, dxMm: 0, dyMm: 0 }] }));
      }
    });

    standaloneConvs.forEach((c) => {
      slotEntries.push({ partInput: c.partInput, members: [{ conv: c, dxMm: 0, dyMm: 0 }] });
    });

    const erpRes = runErpNesting(
      slotEntries.map((s) => s.partInput),
      {
        width: sheetConfig.lengthMm,
        height: sheetConfig.widthMm,
        kerf: sheetConfig.kerfMm,
        margin: sheetConfig.trimCutMm,
        grain_direction: sheetGrain,
      },
      {
        algorithm,
        sawKerf: sheetConfig.kerfMm,
        kerf: sheetConfig.kerfMm,
        edgeMargin: sheetConfig.trimCutMm,
        margin: sheetConfig.trimCutMm,
        allowRotation: true,
        rotationAllowed: true,
        considerGrain: true,
        grainRule: true,
      }
    );

    let totalNetM2 = 0;
    const sheets: OptimizedSheet[] = erpRes.sheets.map((erpSheet, sIdx) => {
      const placedPieces: PlacedPiece[] = [];
      for (const pl of erpSheet.placements) {
        const idxMatch = pl.part_id.match(/^part[_-](\d+)[_-](\d+)$/);
        const origIdx = idxMatch ? Number(idxMatch[1]) : 0;
        const slot = slotEntries[origIdx];
        if (slot && slot.members.length > 1) {
          for (const m of slot.members) {
            const src = m.conv.sourcePiece;
            const pIn = m.conv.partInput;
            const crossCanon = m.conv.crosswiseCanonicalized;
            placedPieces.push({
              pieceId: src.id,
              pieceName: src.pieceName,
              materialName: matName,
              x: roundMm(pl.x + m.dxMm, 1),
              y: roundMm(pl.y + m.dyMm, 1),
              width: roundMm(pIn.width_mm, 1),
              length: roundMm(pIn.height_mm, 1),
              isRotated: crossCanon ? true : false,
              edgeL1: pIn.edgeL1,
              edgeL2: pIn.edgeL2,
              edgeW1: pIn.edgeW1,
              edgeW2: pIn.edgeW2,
              hasGroove: pIn.hasGroove,
              grooveSide: pIn.grooveSide,
              grooveOffset: pIn.grooveOffset,
              grainDirection: pIn.grain_direction,
              color: pl.color,
              polygonContourMm: src.polygonContourMm,
            });
          }
        } else {
          const singleMember = slot?.members[0];
          const src = singleMember?.conv.sourcePiece;
          const crossCanon = singleMember?.conv.crosswiseCanonicalized ?? false;
          placedPieces.push({
            pieceId: src ? src.id : pl.part_id,
            pieceName: src ? src.pieceName : pl.part_label,
            materialName: matName,
            x: roundMm(pl.x, 1),
            y: roundMm(pl.y, 1),
            width: roundMm(pl.width, 1),
            length: roundMm(pl.height, 1),
            isRotated: crossCanon ? !pl.rotated : Boolean(pl.rotated),
            edgeL1: pl.edgeL1,
            edgeL2: pl.edgeL2,
            edgeW1: pl.edgeW1,
            edgeW2: pl.edgeW2,
            hasGroove: pl.hasGroove,
            grooveSide: pl.grooveSide,
            grooveOffset: pl.grooveOffset,
            grainDirection: pl.grain_direction,
            color: pl.color,
            polygonContourMm: src?.polygonContourMm,
          });
        }
      }

      const netUsedM2 = roundMm(
        placedPieces.reduce((s, p) => s + (p.width * p.length) / 1_000_000, 0),
        3
      );
      totalNetM2 += netUsedM2;
      const wasteAreaM2 = roundMm(Math.max(0, fullSheetAreaM2 - netUsedM2), 3);
      const wastePercent = roundMm((wasteAreaM2 / fullSheetAreaM2) * 100, 1);

      const erpRemnants = extractErpReclaimableRemnants(erpSheet, {
        minWidthMm: 400,
        minHeightMm: 400,
        sheetAreaMm2: sheetConfig.lengthMm * sheetConfig.widthMm,
      });
      const usableRemnants: UsableRemnantRect[] = erpRemnants.map((rm) => ({
        x: Math.ceil(sheetConfig.trimCutMm + rm.x_mm - 1e-6),
        y: Math.ceil(sheetConfig.trimCutMm + rm.y_mm - 1e-6),
        width: Math.max(0, Math.floor(rm.width_mm + 1e-6)),
        length: Math.max(0, Math.floor(rm.height_mm + 1e-6)),
        areaM2: roundMm(rm.area_mm2 / 1_000_000, 3),
      }));

      return {
        sheetIndex: sIdx + 1,
        materialId: matId,
        materialName: matName,
        sheetDimension: sheetConfig,
        placedPieces,
        usableRemnants,
        usableRemnantAreaM2: roundMm(
          usableRemnants.reduce((acc, r) => acc + r.areaM2, 0),
          3
        ),
        netUsedAreaM2: netUsedM2,
        totalSheetAreaM2: roundMm(fullSheetAreaM2, 3),
        wasteAreaM2,
        wastePercent,
        algorithm: erpRes.algorithm,
        sequences: erpSheet.sequences,
        cuttingInstructions: erpSheet.cuttingInstructions,
        erpPlacements: erpSheet.placements,
      };
    });

    const totalGrossM2 = roundMm(sheets.length * fullSheetAreaM2, 3);
    const overallWastePercent =
      totalGrossM2 > 0
        ? roundMm(((totalGrossM2 - totalNetM2) / totalGrossM2) * 100, 1)
        : 0;

    results.push({
      materialId: matId,
      materialName: matName,
      thicknessMm,
      algorithm: erpRes.algorithm,
      sheets,
      unplacedPieces: unplaced,
      totalSheetsCount: sheets.length,
      totalNetAreaM2: roundMm(totalNetM2, 3),
      totalGrossAreaM2: totalGrossM2,
      overallWastePercent,
    });
  });

  if (nestingCache.size >= 32) {
    const oldestKey = nestingCache.keys().next().value;
    if (oldestKey) nestingCache.delete(oldestKey);
  }
  nestingCache.set(cacheKey, results);

  return results;
}
