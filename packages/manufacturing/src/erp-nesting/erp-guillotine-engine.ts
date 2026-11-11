// ============================================================================
// packages/manufacturing/src/erp-nesting/erp-guillotine-engine.ts
// Birim ERP lib/nestingEngines/GuillotineEngine.ts birebir ebatlama motoru
// Ebatlama makineleri (Selco WNT 600, Holzma, Biesse) için şerit kesim,
// kesim sırası (CutSequence) ve operatör kesim reçetesi üretir.
// ============================================================================

import type {
  ErpNestingPartInput,
  ErpNestingSheetResult,
  ErpPlacementData,
  ErpCutSequence,
  ErpNestingOptimizationSettings,
  ErpGrainDirection,
  ErpRectData,
} from "./erp-nesting-types";
import { getErpPartColor } from "./erp-nesting-types";

export interface ErpSheetConfig {
  width: number;
  height: number;
  kerf: number;
  margin: number;
  grain_direction?: ErpGrainDirection | null;
}

interface PartToPack {
  originalIndex: number;
  instanceIndex: number;
  partId: string;
  label: string;
  width: number;
  height: number;
  canRotate: boolean;
  grainDirection: string;
  color: string;
  edgeL1?: string;
  edgeL2?: string;
  edgeW1?: string;
  edgeW2?: string;
  hasGroove?: boolean;
  grooveSide?: string;
  grooveOffset?: number;
  grooveWidth?: number;
  grooveDepth?: number;
}

interface GuillotineShelf {
  y: number;
  height: number;
  usedWidth: number;
}

interface GuillotineSheetState {
  index: number;
  placements: ErpPlacementData[];
  sequences: ErpCutSequence[];
  shelves: GuillotineShelf[];
  usedArea: number;
  cuttingInstructions: string[];
}

export class ErpGuillotineEngine {
  public static optimize(
    parts: ErpNestingPartInput[],
    width: number,
    height: number,
    kerf: number,
    margin: number,
    settings?: ErpNestingOptimizationSettings
  ): {
    sheets: ErpNestingSheetResult[];
    totalPartsPlaced: number;
    totalPartsRequested: number;
  } {
    const sheets = ErpGuillotineEngine.run(
      parts,
      { width, height, kerf, margin },
      settings
    );
    const totalPlaced = sheets.reduce((acc, s) => acc + s.placements.length, 0);
    const totalRequested = parts.reduce((acc, p) => acc + (p.quantity || 1), 0);
    return {
      sheets,
      totalPartsPlaced: totalPlaced,
      totalPartsRequested: totalRequested,
    };
  }

  public static run(
    parts: ErpNestingPartInput[],
    sheet: ErpSheetConfig,
    settings?: ErpNestingOptimizationSettings
  ): ErpNestingSheetResult[] {
    const margin = Number(settings?.edgeMargin ?? settings?.margin ?? sheet.margin);
    const useCommon = Boolean(settings?.useCommonCut ?? settings?.commonCut);
    const spacing = useCommon ? 0 : Number(settings?.partSpacing ?? settings?.spacing ?? 0);
    const kerf = useCommon ? 0 : Number(settings?.sawKerf ?? settings?.kerf ?? sheet.kerf);

    const sheetL = Number(sheet.width);
    const sheetW = Number(sheet.height);
    const usableL = sheetL - 2 * margin;
    const usableW = sheetW - 2 * margin;

    if (usableL <= 0 || usableW <= 0 || parts.length === 0) {
      return [];
    }

    const baseParts: PartToPack[] = [];
    let colorIdx = 0;
    const sheetGrain: ErpGrainDirection = sheet.grain_direction || "vertical";
    const sheetIsPlain = sheetGrain === "none";

    parts.forEach((p, pIdx) => {
      const qty = Math.max(1, p.quantity || 1);
      const col = getErpPartColor(colorIdx++);

      const effectivePartGrain: ErpGrainDirection = sheetIsPlain
        ? "none"
        : p.grain_direction || sheetGrain;
      const isGrainLocked = !sheetIsPlain && effectivePartGrain !== "none";
      const canRotate =
        !isGrainLocked &&
        Boolean(p.can_rotate) &&
        (settings?.allowRotation ?? settings?.rotationAllowed ?? true);

      for (let i = 0; i < qty; i++) {
        baseParts.push({
          originalIndex: pIdx,
          instanceIndex: i,
          partId: `part_${pIdx}_${i}`,
          label: p.part_label,
          width: p.width_mm,
          height: p.height_mm,
          canRotate,
          grainDirection: effectivePartGrain,
          color: col,
          edgeL1: p.edgeL1,
          edgeL2: p.edgeL2,
          edgeW1: p.edgeW1,
          edgeW2: p.edgeW2,
          hasGroove: p.hasGroove,
          grooveSide: p.grooveSide,
          grooveOffset: p.grooveOffset,
          grooveWidth: p.grooveWidth,
          grooveDepth: p.grooveDepth,
        });
      }
    });

    const heuristics: ((list: PartToPack[]) => PartToPack[])[] = [
      (list) => [...list].sort((a, b) => (b.height !== a.height ? b.height - a.height : b.width - a.width)),
      (list) => [...list].sort((a, b) => (b.width !== a.width ? b.width - a.width : b.height - a.height)),
      (list) => [...list].sort((a, b) => b.width * b.height - a.width * a.height),
      (list) => [...list].sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height)),
      (list) => [...list].sort((a, b) => b.width + b.height - (a.width + a.height)),
    ];

    let bestPacking: GuillotineSheetState[] | null = null;
    let minSheets = Infinity;
    let maxDensity = -1;

    for (const heuristic of heuristics) {
      const sorted = heuristic(baseParts);
      const packing = this.runPacking(
        sorted,
        sheetL,
        sheetW,
        usableL,
        usableW,
        spacing,
        margin,
        kerf,
        !sheetIsPlain && (settings?.grainRule ?? settings?.considerGrain ?? true)
      );

      if (packing.length > 0) {
        const totalUsed = packing.reduce((s, sh) => s + sh.usedArea, 0);
        const totalUsable = packing.length * sheetL * sheetW;
        const density = totalUsable > 0 ? totalUsed / totalUsable : 0;

        if (packing.length < minSheets || (packing.length === minSheets && density > maxDensity)) {
          minSheets = packing.length;
          maxDensity = density;
          bestPacking = packing;
        }
      }
    }

    if (!bestPacking) return [];

    const sheetTotalArea = sheetL * sheetW;
    return bestPacking.map((s) => {
      const placedArea = s.placements.reduce((sum, p) => sum + p.width * p.height, 0);
      const wasteMm2 = Math.max(0, sheetTotalArea - placedArea);
      const utilization =
        sheetTotalArea > 0 ? Math.round((placedArea / sheetTotalArea) * 10000) / 100 : 0;

      // Şerit sonu ve alt plaka boşluklarını free_rects olarak çıkar (Fire geri kazanımı ile tam uyum)
      const freeRects: ErpRectData[] = [];
      for (const shelf of s.shelves) {
        const tailX = shelf.usedWidth + kerf;
        const tailW = sheetL - margin - tailX;
        if (tailW >= 50 && shelf.height >= 50) {
          freeRects.push({
            x: Math.max(0, tailX - margin),
            y: Math.max(0, shelf.y - margin),
            width: Math.round(tailW),
            height: Math.round(shelf.height),
          });
        }
      }
      if (s.shelves.length > 0) {
        const lastShelf = s.shelves[s.shelves.length - 1];
        const bottomY = lastShelf.y + lastShelf.height + kerf;
        const bottomH = sheetW - margin - bottomY;
        if (usableL >= 50 && bottomH >= 50) {
          freeRects.push({
            x: 0,
            y: Math.max(0, bottomY - margin),
            width: Math.round(usableL),
            height: Math.round(bottomH),
          });
        }
      }

      return {
        sheet_index: s.index,
        placements: s.placements,
        utilization_percent: utilization,
        waste_mm2: wasteMm2,
        free_rects: freeRects,
        sequences: s.sequences,
        cuttingInstructions: s.cuttingInstructions,
        sheet_width: sheetL,
        sheet_height: sheetW,
      };
    });
  }

  private static runPacking(
    parts: PartToPack[],
    sheetL: number,
    sheetW: number,
    usableL: number,
    usableW: number,
    spacing: number,
    margin: number,
    kerf: number,
    grainRule: boolean
  ): GuillotineSheetState[] {
    const sheets: GuillotineSheetState[] = [];

    for (const part of parts) {
      let pLength = part.width;
      let pWidth = part.height;
      let canRotate = part.canRotate;
      let baseRotated = false;

      if (grainRule && part.grainDirection !== "none") {
        canRotate = false;
        if (part.grainDirection === "vertical") {
          pLength = part.width;
          pWidth = part.height;
          baseRotated = false;
        } else if (part.grainDirection === "horizontal") {
          pLength = part.height;
          pWidth = part.width;
          baseRotated = true;
        }
      }

      // Parça hiçbir yönde kullanılabilir plakaya sığmıyorsa atla (sonsuz/taşan plaka önleme)
      const fitsNormal = pLength <= usableL && pWidth <= usableW;
      const fitsRotated = canRotate && pWidth <= usableL && pLength <= usableW;
      if (!fitsNormal && !fitsRotated) {
        continue;
      }

      let placed = false;

      for (const sheet of sheets) {
        if (
          this.tryPlace(
            sheet,
            part,
            pLength,
            pWidth,
            canRotate,
            baseRotated,
            usableL,
            usableW,
            spacing,
            margin,
            kerf
          )
        ) {
          placed = true;
          break;
        }
      }

      if (!placed) {
        const newSheet: GuillotineSheetState = {
          index: sheets.length,
          placements: [],
          sequences: [],
          shelves: [],
          usedArea: 0,
          cuttingInstructions: [],
        };
        sheets.push(newSheet);

        this.tryPlace(
          newSheet,
          part,
          pLength,
          pWidth,
          canRotate,
          baseRotated,
          usableL,
          usableW,
          spacing,
          margin,
          kerf
        );
      }
    }

    const validSheets = sheets.filter((s) => s.placements.length > 0);
    for (let i = 0; i < validSheets.length; i++) {
      validSheets[i].index = i;
      this.generateCutSequences(validSheets[i], sheetL, sheetW, spacing, margin);
      this.generateInstructions(validSheets[i], sheetL, sheetW, margin, kerf);
    }

    return validSheets;
  }

  private static tryPlace(
    sheet: GuillotineSheetState,
    part: PartToPack,
    pLength: number,
    pWidth: number,
    canRotate: boolean,
    baseRotated: boolean,
    usableL: number,
    usableW: number,
    spacing: number,
    margin: number,
    kerf: number
  ): boolean {
    let bestShelf: GuillotineShelf | null = null;
    let bestRotated = false;
    let bestW = pLength;
    let bestH = pWidth;
    let minRemaining = Infinity;

    for (const shelf of sheet.shelves) {
      const reqW1 = shelf.usedWidth === margin ? pLength : spacing + kerf + pLength;
      if (shelf.usedWidth + reqW1 <= usableL + margin && pWidth <= shelf.height) {
        const rem = usableL + margin - (shelf.usedWidth + reqW1);
        if (rem < minRemaining) {
          minRemaining = rem;
          bestShelf = shelf;
          bestRotated = false;
          bestW = pLength;
          bestH = pWidth;
        }
      }

      if (canRotate && pLength !== pWidth) {
        const reqW2 = shelf.usedWidth === margin ? pWidth : spacing + kerf + pWidth;
        if (shelf.usedWidth + reqW2 <= usableL + margin && pLength <= shelf.height) {
          const rem = usableL + margin - (shelf.usedWidth + reqW2);
          if (rem < minRemaining) {
            minRemaining = rem;
            bestShelf = shelf;
            bestRotated = true;
            bestW = pWidth;
            bestH = pLength;
          }
        }
      }
    }

    if (bestShelf) {
      let placementX = bestShelf.usedWidth;
      if (bestShelf.usedWidth > margin) {
        placementX += spacing + kerf;
      }

      sheet.placements.push({
        part_id: part.partId,
        part_label: part.label,
        x: placementX,
        y: bestShelf.y,
        width: bestW,
        height: bestH,
        rotated: baseRotated || bestRotated,
        rotation: baseRotated || bestRotated ? 90 : 0,
        color: part.color,
        edgeL1: part.edgeL1,
        edgeL2: part.edgeL2,
        edgeW1: part.edgeW1,
        edgeW2: part.edgeW2,
        hasGroove: part.hasGroove,
        grooveSide: part.grooveSide,
        grooveOffset: part.grooveOffset,
        grooveWidth: part.grooveWidth,
        grooveDepth: part.grooveDepth,
        grain_direction: (part.grainDirection as ErpGrainDirection) || null,
        can_rotate: part.canRotate,
      });

      bestShelf.usedWidth = placementX + bestW;
      sheet.usedArea += bestW * bestH;
      return true;
    }

    let newShelfY = margin;
    if (sheet.shelves.length > 0) {
      const lastShelf = sheet.shelves[sheet.shelves.length - 1];
      newShelfY = lastShelf.y + lastShelf.height + spacing + kerf;
    }

    if (newShelfY + pWidth <= usableW + margin && pLength <= usableL) {
      const newShelf: GuillotineShelf = {
        y: newShelfY,
        height: pWidth,
        usedWidth: margin + pLength,
      };
      sheet.shelves.push(newShelf);
      sheet.placements.push({
        part_id: part.partId,
        part_label: part.label,
        x: margin,
        y: newShelfY,
        width: pLength,
        height: pWidth,
        rotated: baseRotated,
        rotation: baseRotated ? 90 : 0,
        color: part.color,
        edgeL1: part.edgeL1,
        edgeL2: part.edgeL2,
        edgeW1: part.edgeW1,
        edgeW2: part.edgeW2,
        hasGroove: part.hasGroove,
        grooveSide: part.grooveSide,
        grooveOffset: part.grooveOffset,
        grooveWidth: part.grooveWidth,
        grooveDepth: part.grooveDepth,
        grain_direction: (part.grainDirection as ErpGrainDirection) || null,
        can_rotate: part.canRotate,
      });
      sheet.usedArea += pLength * pWidth;
      return true;
    }

    if (
      canRotate &&
      pLength !== pWidth &&
      newShelfY + pLength <= usableW + margin &&
      pWidth <= usableL
    ) {
      const newShelf: GuillotineShelf = {
        y: newShelfY,
        height: pLength,
        usedWidth: margin + pWidth,
      };
      sheet.shelves.push(newShelf);
      sheet.placements.push({
        part_id: part.partId,
        part_label: part.label,
        x: margin,
        y: newShelfY,
        width: pWidth,
        height: pLength,
        rotated: true,
        rotation: 90,
        color: part.color,
        edgeL1: part.edgeL1,
        edgeL2: part.edgeL2,
        edgeW1: part.edgeW1,
        edgeW2: part.edgeW2,
        hasGroove: part.hasGroove,
        grooveSide: part.grooveSide,
        grooveOffset: part.grooveOffset,
        grooveWidth: part.grooveWidth,
        grooveDepth: part.grooveDepth,
        grain_direction: (part.grainDirection as ErpGrainDirection) || null,
        can_rotate: part.canRotate,
      });
      sheet.usedArea += pWidth * pLength;
      return true;
    }

    return false;
  }

  private static generateCutSequences(
    sheet: GuillotineSheetState,
    sheetL: number,
    _sheetW: number,
    spacing: number,
    _margin: number
  ): void {
    sheet.sequences = [];
    let step = 1;

    for (const shelf of sheet.shelves) {
      const ripY = shelf.y + shelf.height + spacing / 2;
      sheet.sequences.push({
        stepNumber: step++,
        x1: 0,
        y1: ripY,
        x2: sheetL,
        y2: ripY,
        type: "rip",
        description: `Boy Kesim (Y=${ripY.toFixed(0)}mm)`,
      });

      const shelfPlacements = sheet.placements.filter((p) => p.y === shelf.y);
      for (const pl of shelfPlacements) {
        const crossX = pl.x + pl.width + spacing / 2;
        sheet.sequences.push({
          stepNumber: step++,
          x1: crossX,
          y1: shelf.y,
          x2: crossX,
          y2: shelf.y + shelf.height,
          type: "cross",
          description: `En Kesim (X=${crossX.toFixed(0)}mm - ${pl.part_label})`,
        });
      }
    }
  }

  private static generateInstructions(
    sheet: GuillotineSheetState,
    sheetL: number,
    sheetW: number,
    margin: number,
    kerf: number
  ): void {
    const lines: string[] = [];
    lines.push(`PLAKA #${sheet.index + 1} - EBATLAMA KESİM REÇETESİ (GUILLOTINE)`);
    lines.push(
      `Plaka: ${sheetL} x ${sheetW} mm | Kenar Payı: ${margin} mm | Bıçak (Kerf): ${kerf} mm`
    );
    lines.push("------------------------------------------------------------");

    let step = 1;
    for (const shelf of sheet.shelves) {
      const ripY = shelf.y + shelf.height;
      lines.push(
        `${step++}. ADIM [BOYUNA KESİM]: Panel Y=${ripY.toFixed(0)} mm hizasından boydan boya kesilir.`
      );
      lines.push(`   -> Elde edilen şerit genişliği: ${shelf.height.toFixed(0)} mm`);

      const shelfParts = sheet.placements
        .filter((p) => p.y === shelf.y)
        .sort((a, b) => a.x - b.x);
      for (const p of shelfParts) {
        const crossX = p.x + p.width;
        lines.push(
          `   -> [ENİNE KESİM]: Şerit X=${crossX.toFixed(0)} mm kesilir -> Çıktı: "${p.part_label}" (${p.width}x${p.height} mm)`
        );
      }

      const remW = sheetL - margin - shelf.usedWidth;
      if (remW >= 200) {
        lines.push(
          `   -> [ARTIK ŞERİT]: ${remW.toFixed(0)} x ${shelf.height.toFixed(0)} mm kullanılabilir parça.`
        );
      }
    }

    sheet.cuttingInstructions = lines;
  }
}
