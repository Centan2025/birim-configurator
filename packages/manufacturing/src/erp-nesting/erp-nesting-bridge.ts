// ============================================================================
// packages/manufacturing/src/erp-nesting/erp-nesting-bridge.ts
// Birim Configurator (ManufacturingBOM / CutPiece) -> Birim Portal ERP Nesting
// %100 Birebir Veri, Ölçü, Kenar Bandı (U1/U2/K1/K2), Arkalık Kanalı,
// Suyolu/Lif Yönü ve Çoklu Levha İş Emri Köprüsü
// ============================================================================

import {
  DEFAULT_MATERIALS,
  roundMm,
  type DesignProject,
  type MaterialDefinition,
} from "@birim/core";
import type { CutPiece, ManufacturingBOM } from "../types";
import type {
  BirimErpNestingBoardJob,
  BirimErpNestingBuildOptions,
  BirimErpNestingExportBundle,
  BirimErpPartTraceMeta,
  ErpGrainDirection,
  ErpNestingOptimizationSettings,
  ErpNestingPart,
  ErpNestingPartInput,
  ErpNestingPlacement,
  ErpNestingProject,
  ErpNestingSheet,
  ErpNestingSheetInput,
} from "./erp-nesting-types";
import { getErpPartColor } from "./erp-nesting-types";
import {
  buildErpEdgeSummaryCode,
  formatErpMaterialTypeWithGrain,
  formatErpTapeByThickness,
  mapErpPartFromDb,
  parseErpSheetGrain,
  serializeErpEdgeBanding,
} from "./erp-serialization";
import {
  extractErpReclaimableRemnants,
  runErpNesting,
} from "./erp-nesting-algorithm";
import {
  generateErpFullGCode,
  generateErpSelcoCSV,
} from "./erp-exporters";

export interface ConvertedErpPieceRecord {
  partInput: ErpNestingPartInput;
  sourcePiece: CutPiece;
  crosswiseCanonicalized: boolean;
}

/**
 * Tek bir Configurator `CutPiece` nesnesini Birim ERP `NestingPartInput`
 * sözleşmesine dönüştürür.
 *
 * Koordinat & Kenar Sözleşmesi (ERP NestingCanvas2D & GuillotineEngine ile %100 uyumlu):
 * - Normal / Dikey Suyolu ("lengthwise" veya "none"):
 *   - `width_mm` = Parça Boyu (`netCutLengthMm ?? lengthMm`, plaka X=2800 eksenine paralel)
 *   - `height_mm` = Parça Eni (`netCutWidthMm ?? widthMm`, plaka Y=2100/2070 eksenine paralel)
 *   - `edgeL1` (U1 / Üst uzun kenar) = `edgeBanding.left`
 *   - `edgeL2` (U2 / Alt uzun kenar) = `edgeBanding.right`
 *   - `edgeW1` (K1 / Sol kısa kenar) = `edgeBanding.bottom`
 *   - `edgeW2` (K2 / Sağ kısa kenar) = `edgeBanding.top`
 *   - `grooveSide` = Normal parçada arka uzun kenar U2 ("Alt"), X-aynalanmış sağ yan dikmede U1 ("Üst")
 * - Yatay Suyolu ("crosswise"):
 *   - Ahşap damarının parçanın En (`widthMm`) kenarı boyunca akması istendiğinde,
 *     plaka damarı X=2800 ekseni boyunca olduğu için parça plaka koordinatlarında
 *     90° kanonikleştirilir (`width_mm = En`, `height_mm = Boy`, `grain_direction = "vertical"`,
 *     `can_rotate = false`). Böylece hem `GuillotineEngine` hem `MaxRects` hem de `NestingCanvas2D`
 *     sıfır lif uyarısıyla (`hasCrossGrainMismatch = false`) ve doğru U1/U2/K1/K2 kenarlarla keser.
 */
export function convertCutPieceToErpPartInput(
  piece: CutPiece,
  options?: {
    useNetCutDimensions?: boolean;
    materialCode?: string | null;
    sheetHasGrain?: boolean;
  }
): ConvertedErpPieceRecord {
  const useNet = options?.useNetCutDimensions !== false;
  const rawLength = roundMm(
    useNet ? piece.netCutLengthMm ?? piece.lengthMm : piece.lengthMm,
    2
  );
  const rawWidth = roundMm(
    useNet ? piece.netCutWidthMm ?? piece.widthMm : piece.widthMm,
    2
  );

  const eb = piece.edgeBanding;
  const tapeL_left = formatErpTapeByThickness(eb.left, eb.thickness);
  const tapeL_right = formatErpTapeByThickness(eb.right, eb.thickness);
  const tapeW_bottom = formatErpTapeByThickness(eb.bottom, eb.thickness);
  const tapeW_top = formatErpTapeByThickness(eb.top, eb.thickness);

  const baseHasGroove = Boolean(piece.hasBackGroove);
  const baseGrooveSide = piece.mirrorInnerFaceX ? "Üst" : "Alt";
  const grooveOffset = roundMm(piece.backGrooveOffsetMm ?? 20, 1);
  const grooveWidth = 8.5;
  const grooveDepth = 8;

  const isCrosswise = piece.grain === "crosswise";
  let width_mm = rawLength;
  let height_mm = rawWidth;
  let edgeL1 = tapeL_left;
  let edgeL2 = tapeL_right;
  let edgeW1 = tapeW_bottom;
  let edgeW2 = tapeW_top;
  let grooveSide = baseGrooveSide;
  let grain_direction: ErpGrainDirection = "none";
  let can_rotate = true;

  if (piece.grain === "lengthwise") {
    grain_direction = "vertical";
    can_rotate = false;
  } else if (isCrosswise) {
    // 90° Kanonikleştirme: En kenarı (damar yönü) -> plaka X=2800 (width_mm) eksenine yerleşir
    width_mm = rawWidth;
    height_mm = rawLength;
    edgeL1 = tapeW_bottom;
    edgeL2 = tapeW_top;
    edgeW1 = tapeL_right;
    edgeW2 = tapeL_left;
    grooveSide = piece.mirrorInnerFaceX ? "Sağ" : "Sol";
    grain_direction = "vertical";
    can_rotate = false;
  } else {
    // Düz/Desensiz parça ("none")
    grain_direction = "none";
    can_rotate = true;
  }

  // Desen takibi grubundaki parçalar kesinlikle döndürülemez ve sıra numarası operatör etiketine basılır
  if (piece.grainGroupId) {
    grain_direction = "vertical";
    can_rotate = false;
  }

  // Modül adı + Parça adı + Desen Takibi Sıra Kodu birleşimi
  const cleanMod = (piece.moduleName || "").trim();
  const cleanName = (piece.pieceName || piece.id).trim();
  const baseLabel =
    cleanMod && !cleanName.toLowerCase().includes(cleanMod.toLowerCase())
      ? `${cleanMod} - ${cleanName}`
      : cleanName;
  const part_label = piece.grainGroupId
    ? `${baseLabel} [DT:${piece.grainSequenceLabel || piece.grainGroupId}]`
    : baseLabel;

  const summary = buildErpEdgeSummaryCode({ edgeL1, edgeL2, edgeW1, edgeW2 });

  const partInput: ErpNestingPartInput = {
    part_label,
    width_mm,
    height_mm,
    quantity: Math.max(1, piece.quantity || 1),
    can_rotate,
    grain_direction,
    edge_banding: serializeErpEdgeBanding({
      edge_banding: summary || null,
      edgeL1,
      edgeL2,
      edgeW1,
      edgeW2,
      hasGroove: baseHasGroove,
      grooveSide: baseHasGroove ? grooveSide : undefined,
      grooveOffset: baseHasGroove ? grooveOffset : undefined,
      grooveWidth: baseHasGroove ? grooveWidth : undefined,
      grooveDepth: baseHasGroove ? grooveDepth : undefined,
    }),
    edgeL1,
    edgeL2,
    edgeW1,
    edgeW2,
    hasGroove: baseHasGroove,
    grooveSide: baseHasGroove ? grooveSide : undefined,
    grooveOffset: baseHasGroove ? grooveOffset : undefined,
    grooveWidth: baseHasGroove ? grooveWidth : undefined,
    grooveDepth: baseHasGroove ? grooveDepth : undefined,
    material_code: options?.materialCode ?? piece.materialId ?? null,
  };

  return {
    partInput,
    sourcePiece: piece,
    crosswiseCanonicalized: isCrosswise,
  };
}

/**
 * Tüm projeyi (ManufacturingBOM) malzeme + kalınlık gruplarına ayırarak
 * Birim ERP Nesting altyapısına (%100 DB ve API uyumlu) hazır iş emirleri paketine dönüştürür.
 */
export function buildBirimErpNestingBundle(
  project: Pick<DesignProject, "id" | "title" | "version" | "branchId">,
  bom: ManufacturingBOM,
  materialsMap: Map<string, MaterialDefinition> = new Map(
    DEFAULT_MATERIALS.map((m) => [m.id, m])
  ),
  options?: BirimErpNestingBuildOptions
): BirimErpNestingExportBundle {
  const nowIso = new Date().toISOString();
  const year = new Date().getFullYear();
  const orgId = options?.organizationId || project.branchId || "org_birim_fabrika";
  const createdBy = options?.createdBy || "birim-configurator";
  const orderRef = options?.orderRef || `${project.id}_v${project.version}`;

  const sheetWidthMm = options?.sheetWidthMm ?? 2800;
  const sheetHeightMm = options?.sheetHeightMm ?? 2100;
  const kerfMm = options?.kerfMm ?? 4;
  const edgeMarginMm = options?.edgeMarginMm ?? 15;
  const partSpacingMm = options?.partSpacingMm ?? 0;
  const algorithm = options?.algorithm ?? "Auto";
  const useCommonCut = Boolean(options?.useCommonCut);
  const useNetCutDimensions = options?.useNetCutDimensions !== false;
  const aggregateIdenticalParts = options?.aggregateIdenticalParts !== false;
  const minRemnantWidthMm = options?.minRemnantWidthMm ?? 400;
  const minRemnantHeightMm = options?.minRemnantHeightMm ?? 400;

  const optimizationSettings: ErpNestingOptimizationSettings = {
    algorithm,
    sawKerf: kerfMm,
    kerf: kerfMm,
    edgeMargin: edgeMarginMm,
    margin: edgeMarginMm,
    partSpacing: partSpacingMm,
    spacing: partSpacingMm,
    useCommonCut,
    commonCut: useCommonCut,
    rotationAllowed: true,
    allowRotation: true,
    grainRule: true,
    considerGrain: true,
    minRemnantWidth: minRemnantWidthMm,
  };

  // Malzeme + Kalınlık bazında grupla (ERP'de her NestingProject tek bir NestingSheet tipine bağlanır)
  const boardGroups = new Map<string, CutPiece[]>();
  for (const piece of bom.cutList || []) {
    const key = `${piece.materialId}::${piece.thicknessMm}`;
    const arr = boardGroups.get(key) || [];
    arr.push(piece);
    boardGroups.set(key, arr);
  }

  const jobs: BirimErpNestingBoardJob[] = [];
  let groupIdx = 0;

  boardGroups.forEach((groupPieces, groupKey) => {
    groupIdx++;
    const sample = groupPieces[0];
    const matDef = materialsMap.get(sample.materialId);
    const thicknessMm = sample.thicknessMm || matDef?.thickness || 18;

    const inferredGrain: ErpGrainDirection = matDef
      ? matDef.hasGrain
        ? "vertical"
        : "none"
      : groupPieces.some((p) => p.grain !== "none")
      ? "vertical"
      : parseErpSheetGrain(sample.materialName).grainDirection;

    const materialCode = matDef?.decorCode
      ? `${matDef.brand ? `${matDef.brand}-` : ""}${matDef.decorCode}-${thicknessMm}MM`
      : `${sample.materialId.toUpperCase()}-${thicknessMm}MM`;

    const sheetAreaM2 = (sheetWidthMm * sheetHeightMm) / 1_000_000;
    const sheetCost =
      matDef?.costPerM2 && matDef.costPerM2 > 0
        ? roundMm(matDef.costPerM2 * sheetAreaM2, 2)
        : null;

    const sheetName = `${sample.materialName} (${sheetWidthMm}x${sheetHeightMm}x${thicknessMm}mm)`;
    const formattedMaterialType = formatErpMaterialTypeWithGrain(
      `${sample.materialName} ${thicknessMm}mm`,
      inferredGrain
    );

    const sheetId = `erp_sheet_${sample.materialId}_${thicknessMm}mm`;
    const projectId = `erp_nst_${project.id}_g${groupIdx}`;
    const projectNo = `NST-${year}-${String(groupIdx).padStart(4, "0")}`;

    const sheetInput: ErpNestingSheetInput = {
      name: sheetName,
      material_type: formattedMaterialType,
      width_mm: sheetWidthMm,
      height_mm: sheetHeightMm,
      thickness_mm: thicknessMm,
      kerf_mm: kerfMm,
      edge_margin_mm: edgeMarginMm,
      cost_per_sheet: sheetCost,
      grain_direction: inferredGrain,
    };

    const sheetRecord: ErpNestingSheet = {
      id: sheetId,
      organization_id: orgId,
      name: sheetName,
      material_type: sample.materialName,
      width_mm: sheetWidthMm,
      height_mm: sheetHeightMm,
      thickness_mm: thicknessMm,
      kerf_mm: kerfMm,
      edge_margin_mm: edgeMarginMm,
      cost_per_sheet: sheetCost,
      grain_direction: inferredGrain,
      is_active: true,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Parçaları dönüştür ve isteğe bağlı olarak birebir aynı ölçü/bant/kanal parçaları quantity altında birleştir
    const convertedList = groupPieces.map((cp) =>
      convertCutPieceToErpPartInput(cp, {
        useNetCutDimensions,
        materialCode,
        sheetHasGrain: inferredGrain !== "none",
      })
    );

    const partInputs: ErpNestingPartInput[] = [];
    const partTraceability: BirimErpPartTraceMeta[] = [];

    if (aggregateIdenticalParts) {
      const aggMap = new Map<
        string,
        {
          input: ErpNestingPartInput;
          trace: BirimErpPartTraceMeta;
        }
      >();

      for (const conv of convertedList) {
        const p = conv.partInput;
        // Desen takibi (`grainGroupId`) olan parçaları asla rastgele adet altında birleştirme; her biri kendi sıra koordinatını korur!
        const sig = conv.sourcePiece.grainGroupId
          ? `GRAIN_UNIQUE_${conv.sourcePiece.id}`
          : [
              p.part_label,
              p.width_mm,
              p.height_mm,
              p.can_rotate ? "1" : "0",
              p.grain_direction || "none",
              p.edge_banding || "",
              p.material_code || "",
            ].join("|");

        const existing = aggMap.get(sig);
        if (existing) {
          existing.input.quantity += p.quantity;
          existing.trace.source_piece_ids.push(conv.sourcePiece.id);
          if (!existing.trace.module_ids.includes(conv.sourcePiece.moduleId)) {
            existing.trace.module_ids.push(conv.sourcePiece.moduleId);
          }
          if (!existing.trace.module_names.includes(conv.sourcePiece.moduleName)) {
            existing.trace.module_names.push(conv.sourcePiece.moduleName);
          }
          existing.trace.drilling_holes_count += conv.sourcePiece.holes?.length || 0;
        } else {
          const erpPartId = `${projectId}_part_${aggMap.size + 1}`;
          aggMap.set(sig, {
            input: { ...p },
            trace: {
              erp_part_id: erpPartId,
              part_label: p.part_label,
              source_piece_ids: [conv.sourcePiece.id],
              module_ids: [conv.sourcePiece.moduleId],
              module_names: [conv.sourcePiece.moduleName],
              component_role: conv.sourcePiece.componentRole,
              nominal_length_mm: conv.sourcePiece.lengthMm,
              nominal_width_mm: conv.sourcePiece.widthMm,
              net_cut_length_mm:
                conv.sourcePiece.netCutLengthMm ?? conv.sourcePiece.lengthMm,
              net_cut_width_mm:
                conv.sourcePiece.netCutWidthMm ?? conv.sourcePiece.widthMm,
              crosswise_canonicalized: conv.crosswiseCanonicalized,
              drilling_holes_count: conv.sourcePiece.holes?.length || 0,
            },
          });
        }
      }

      aggMap.forEach(({ input, trace }) => {
        partInputs.push(input);
        partTraceability.push(trace);
      });
    } else {
      convertedList.forEach((conv, idx) => {
        const erpPartId = `${projectId}_part_${idx + 1}`;
        partInputs.push(conv.partInput);
        partTraceability.push({
          erp_part_id: erpPartId,
          part_label: conv.partInput.part_label,
          source_piece_ids: [conv.sourcePiece.id],
          module_ids: [conv.sourcePiece.moduleId],
          module_names: [conv.sourcePiece.moduleName],
          component_role: conv.sourcePiece.componentRole,
          nominal_length_mm: conv.sourcePiece.lengthMm,
          nominal_width_mm: conv.sourcePiece.widthMm,
          net_cut_length_mm:
            conv.sourcePiece.netCutLengthMm ?? conv.sourcePiece.lengthMm,
          net_cut_width_mm:
            conv.sourcePiece.netCutWidthMm ?? conv.sourcePiece.widthMm,
          crosswise_canonicalized: conv.crosswiseCanonicalized,
          drilling_holes_count: conv.sourcePiece.holes?.length || 0,
        });
      });
    }

    // DB satır formatında `nesting_parts` kayıtları
    const partRecords: ErpNestingPart[] = partInputs.map((p, idx) =>
      mapErpPartFromDb({
        id: partTraceability[idx]?.erp_part_id || `${projectId}_part_${idx + 1}`,
        project_id: projectId,
        part_label: p.part_label,
        width_mm: p.width_mm,
        height_mm: p.height_mm,
        quantity: p.quantity,
        can_rotate: p.can_rotate,
        grain_direction: p.grain_direction,
        edge_banding: p.edge_banding,
        edgeL1: p.edgeL1,
        edgeL2: p.edgeL2,
        edgeW1: p.edgeW1,
        edgeW2: p.edgeW2,
        hasGroove: p.hasGroove,
        grooveSide: p.grooveSide,
        grooveOffset: p.grooveOffset,
        grooveWidth: p.grooveWidth,
        grooveDepth: p.grooveDepth,
        material_code: p.material_code,
        color: getErpPartColor(idx),
        priority: 0,
        created_at: nowIso,
      })
    );

    // Birebir ERP Nesting Algoritmasını Çalıştır
    const optimizationResult = runErpNesting(
      partInputs,
      {
        width: sheetWidthMm,
        height: sheetHeightMm,
        kerf: kerfMm,
        margin: edgeMarginMm,
        grain_direction: inferredGrain,
      },
      optimizationSettings
    );

    // DB satır formatında `nesting_placements` kayıtları (`part_i_q` veya `part-i-q` -> `partRecords[i].id`)
    const placementRecords: ErpNestingPlacement[] = [];
    optimizationResult.sheets.forEach((sh) => {
      sh.placements.forEach((pl, plIdx) => {
        const idxMatch = pl.part_id.match(/^part[_-](\d+)[_-](\d+)$/);
        const origIdx = idxMatch ? Number(idxMatch[1]) : 0;
        const matchedPart = partRecords[origIdx] || partRecords[0];
        placementRecords.push({
          id: `${projectId}_pl_${sh.sheet_index}_${plIdx}`,
          project_id: projectId,
          part_id: matchedPart ? matchedPart.id : pl.part_id,
          sheet_index: sh.sheet_index,
          x_mm: pl.x,
          y_mm: pl.y,
          placed_width_mm: pl.width,
          placed_height_mm: pl.height,
          is_rotated: Boolean(pl.rotated),
          rotation: pl.rotation ?? (pl.rotated ? 90 : 0),
          hasCollision: Boolean(pl.hasCollision),
          created_at: nowIso,
          part: matchedPart,
        });
      });
    });

    // Fire Geri Kazanımı (Reclaimable Remnants >= 400x400 mm)
    const sheetAreaMm2 = sheetWidthMm * sheetHeightMm;
    const reclaimableRemnants = optimizationResult.sheets.flatMap((sh) =>
      extractErpReclaimableRemnants(sh, {
        minWidthMm: minRemnantWidthMm,
        minHeightMm: minRemnantHeightMm,
        sheetCost,
        sheetAreaMm2,
      })
    );

    const projectName = `${project.title} — ${sample.materialName} (${thicknessMm}mm)`;
    const notes = `Birim Configurator v${project.version} otomatik üretim emri (${
      useNetCutDimensions ? "Bant düşülmüş net kesim ölçüleri" : "Bitmiş anma ölçüleri"
    })`;

    const projectRecord: ErpNestingProject = {
      id: projectId,
      organization_id: orgId,
      project_no: projectNo,
      name: projectName,
      status: optimizationResult.sheets.length > 0 ? "optimized" : "draft",
      sheet_id: sheetId,
      source_type: "production_order",
      source_ref: orderRef,
      created_by: createdBy,
      optimization_data: optimizationResult,
      total_sheets_used: optimizationResult.sheets.length,
      utilization_percent: optimizationResult.overall_utilization,
      waste_area_mm2: optimizationResult.total_waste_mm2,
      notes,
      created_at: nowIso,
      updated_at: nowIso,
      sheet: sheetRecord,
      parts: partRecords,
      placements: placementRecords,
    };

    const selcoCsv = generateErpSelcoCSV(projectRecord, partRecords);
    const cncGcode =
      optimizationResult.sheets.length > 0
        ? generateErpFullGCode(optimizationResult.sheets, sheetRecord)
        : "";

    jobs.push({
      job_index: groupIdx,
      group_key: groupKey,
      material_id: sample.materialId,
      material_name: sample.materialName,
      material_code: materialCode,
      thickness_mm: thicknessMm,
      sheet_input: sheetInput,
      sheet_record: sheetRecord,
      project_record: projectRecord,
      part_inputs: partInputs,
      part_records: partRecords,
      placement_records: placementRecords,
      optimization_result: optimizationResult,
      reclaimable_remnants: reclaimableRemnants,
      part_traceability: partTraceability,
      selco_csv: selcoCsv,
      cnc_gcode: cncGcode,
      api_requests: {
        post_sheet: {
          endpoint: "/api/nesting/sheets",
          method: "POST",
          body: sheetInput,
        },
        post_project: {
          endpoint: "/api/nesting",
          method: "POST",
          body: {
            name: projectName,
            sheet_id: sheetId,
            source_type: "production_order",
            source_ref: orderRef,
            notes,
          },
        },
        post_parts: {
          endpoint: `/api/nesting/${projectId}/parts`,
          method: "POST",
          body: { parts: partInputs },
        },
        post_optimize: {
          endpoint: `/api/nesting/${projectId}/optimize`,
          method: "POST",
          body: { settings: optimizationSettings },
        },
      },
    });
  });

  // Genel Özet Metrikleri
  const totalSheetsUsed = jobs.reduce(
    (s, j) => s + j.optimization_result.sheets.length,
    0
  );
  const totalPartsRequested = jobs.reduce(
    (s, j) => s + j.optimization_result.total_parts_requested,
    0
  );
  const totalPartsPlaced = jobs.reduce(
    (s, j) => s + j.optimization_result.total_parts_placed,
    0
  );
  const totalWasteMm2 = jobs.reduce(
    (s, j) => s + j.optimization_result.total_waste_mm2,
    0
  );
  const totalUsedMm2 = jobs.reduce(
    (s, j) =>
      s +
      j.optimization_result.sheets.reduce(
        (shSum, sh) =>
          shSum + sh.placements.reduce((pSum, pl) => pSum + pl.width * pl.height, 0),
        0
      ),
    0
  );
  const totalGrossMm2 = totalSheetsUsed * sheetWidthMm * sheetHeightMm;
  const overallUtilPercent =
    totalGrossMm2 > 0
      ? Math.round((totalUsedMm2 / totalGrossMm2) * 10000) / 100
      : 0;

  const allRemnants = jobs.flatMap((j) => j.reclaimable_remnants);
  const reclaimAreaM2 =
    Math.round(
      (allRemnants.reduce((s, r) => s + r.area_mm2, 0) / 1_000_000) * 1000
    ) / 1000;

  // Birleştirilmiş Selco WNT 600 CSV (Tek başlık altında tüm malzeme grupları)
  const combinedSelcoLines: string[] = [
    "Label;Qty;Length;Width;Material;Grain;EdgeL1;EdgeL2;EdgeW1;EdgeW2",
  ];
  for (const j of jobs) {
    const rows = j.selco_csv.split(/\r?\n/).slice(1).filter(Boolean);
    combinedSelcoLines.push(...rows);
  }

  const combinedCncGcode = jobs
    .filter((j) => j.cnc_gcode.length > 0)
    .map(
      (j) =>
        `; ############################################################\n` +
        `; GRUP ${j.job_index}: ${j.material_name} (${j.thickness_mm}mm) - ${j.project_record.project_no}\n` +
        `; ############################################################\n` +
        j.cnc_gcode
    )
    .join("\n\n");

  return {
    schema_version: "birim-erp-nesting/v1.0",
    generated_at: nowIso,
    source_system: "birim-configurator",
    source_project_id: project.id,
    source_project_title: project.title,
    source_project_version: project.version,
    organization_id: orgId,
    order_ref: orderRef,
    dimension_basis: useNetCutDimensions ? "net_cut_mm" : "nominal_finished_mm",
    settings: {
      ...optimizationSettings,
      sheet_width_mm: sheetWidthMm,
      sheet_height_mm: sheetHeightMm,
    },
    summary: {
      board_groups_count: jobs.length,
      total_sheets_used: totalSheetsUsed,
      total_parts_requested: totalPartsRequested,
      total_parts_placed: totalPartsPlaced,
      unplaced_parts_count: Math.max(0, totalPartsRequested - totalPartsPlaced),
      overall_utilization_percent: overallUtilPercent,
      total_waste_m2: Math.round((totalWasteMm2 / 1_000_000) * 1000) / 1000,
      reclaimable_remnants_count: allRemnants.length,
      reclaimable_remnants_area_m2: reclaimAreaM2,
    },
    jobs,
    combined_selco_csv: combinedSelcoLines.join("\r\n"),
    combined_cnc_gcode: combinedCncGcode,
  };
}
