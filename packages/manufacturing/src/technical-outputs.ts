import { ManufacturingBOM, CutPiece } from "./types";
import {
  DesignProject,
  ModuleInstance,
  createDefaultWardrobeModule,
} from "@birim/core";

export interface AssemblyStep {
  stepNumber: number;
  title: string;
  description: string;
  requiredParts: string[];
  requiredHardware: string[];
  safetyNotes?: string;
}

export function generateAssemblyInstructions(
  project: DesignProject,
  bom: ManufacturingBOM
): AssemblyStep[] {
  const steps: AssemblyStep[] = [];

  steps.push({
    stepNumber: 1,
    title: "Saha Hazırlığı ve Baza Montajı",
    description:
      "Zemin terazisini su terazisi ile kontrol ediniz. Baza ayaklarını alt tablanın altına vidalayınız ve yükseklik ayarını yapınız.",
    requiredParts: ["Baza Ön", "Baza Arka"],
    requiredHardware: ["HW_LEVELING_FEET"],
    safetyNotes: "Zemin eğimi 5mm'den fazlaysa ayak ayarını teraziye göre sabitleyiniz.",
  });

  steps.push({
    stepNumber: 2,
    title: "Gövde Karkas Kurulumu (Minifix & Kavela)",
    description:
      "Sol yan paneli alt tablaya 90° açıyla yerleştirip minifix millerini kavelalar ile birlikte sıkınız. Ardından ara dikmeleri ve üst tablayı kilitleyiniz.",
    requiredParts: ["Sol Yan Panel", "Sağ Yan Panel", "Alt Panel", "Üst Panel", "Ara Dikmeler"],
    requiredHardware: ["HW_MINIFIX_SET", "HW_DOWEL_8X35"],
    safetyNotes: "Minifix kamlarını aşırı tork ile sıkmayınız, 180° tam kilitlenme yeterlidir.",
  });

  steps.push({
    stepNumber: 3,
    title: "Arkalık Montajı",
    description:
      "Gövde köşegenlerini metre ile ölçerek tam gönyede olduğunu doğrulayınız. 8mm arkalık panelini oluk yuvalarına kaydırıp sabitleyiniz.",
    requiredParts: ["Arkalık Paneli"],
    requiredHardware: [],
    safetyNotes: "Köşegen farkı 2mm'yi geçmemelidir.",
  });

  steps.push({
    stepNumber: 4,
    title: "İç Donanım ve Ray Montajı",
    description:
      "Tandembox çekmece raylarını System 32 deliklerine vidalayınız. Raf pimlerini ve askı borusu flanşlarını yerleştiriniz.",
    requiredParts: ["Raflar", "Çekmece Kasaları"],
    requiredHardware: ["HW_BLUM_TANDEM_BOX", "HW_SHELF_PIN", "HW_HANGING_RAIL"],
  });

  steps.push({
    stepNumber: 5,
    title: "Kapak ve Klapa Montajı & İnce Ayar",
    description:
      "Blum 110° menteşeleri kapaklara takıp gövde tabanlarına klipsleyiniz. Kapaklar arası 2mm çevre çalışma boşluğunu 3D menteşe vidasından ayarlayınız.",
    requiredParts: ["Kapaklar", "Çekmece Önleri"],
    requiredHardware: ["HW_BLUM_HINGE_110", "HW_HANDLE_BAR"],
  });

  return steps;
}

export function exportCutListToCSV(bom: ManufacturingBOM): string {
  const headers = [
    "Parca_ID",
    "Parca_Adi",
    "Modul",
    "Malzeme",
    "Boy_mm",
    "En_mm",
    "Net_Kesim_Boy_mm",
    "Net_Kesim_En_mm",
    "Kalinlik_mm",
    "Adet",
    "Bant_Kodu",
    "Ust_Bant",
    "Alt_Bant",
    "Sol_Bant",
    "Sag_Bant",
    "Damar_Yonu",
    "Alan_m2",
    "Bant_Metre",
    "Delik_Adedi",
  ];

  const rows = bom.cutList.map((p) => [
    p.id,
    `"${p.pieceName}"`,
    `"${p.moduleName}"`,
    `"${p.materialName}"`,
    p.lengthMm,
    p.widthMm,
    p.netCutLengthMm ?? p.lengthMm,
    p.netCutWidthMm ?? p.widthMm,
    p.thicknessMm,
    p.quantity,
    `"${p.edgeBandCode || ""}"`,
    p.edgeBanding.top ? "1" : "0",
    p.edgeBanding.bottom ? "1" : "0",
    p.edgeBanding.left ? "1" : "0",
    p.edgeBanding.right ? "1" : "0",
    p.grain,
    p.areaM2,
    p.edgeBandMeters,
    p.holes ? p.holes.length : 0,
  ]);

  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}

function sanitizeAsciiDxfText(input: string): string {
  return String(input || "")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7E]/g, " ");
}

function buildDxfHeaderAndLayerTables(): string {
  const layers: { name: string; color: number }[] = [
    { name: "0", color: 7 },
    { name: "PANEL_CONTOUR", color: 7 },
    { name: "NET_CUT_CONTOUR", color: 3 },
    { name: "BACK_GROOVE_8MM", color: 6 },
    { name: "CUTOUT_SINK_HOB", color: 1 },
    { name: "DRILLING", color: 4 },
    { name: "BORE_35MM", color: 1 },
    { name: "CAM_15MM", color: 2 },
    { name: "DRILL_8MM", color: 3 },
    { name: "DRILL_5MM", color: 5 },
    { name: "HARDWARE_AXIS", color: 8 },
    { name: "PART_LABELS", color: 2 },
    { name: "SHEET_BORDER", color: 8 },
  ];

  const lines: string[] = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1009",
    "9",
    "$INSUNITS",
    "70",
    "4",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "TABLES",
    "0",
    "TABLE",
    "2",
    "LTYPE",
    "70",
    "1",
    "0",
    "LTYPE",
    "2",
    "CONTINUOUS",
    "70",
    "0",
    "3",
    "Solid line",
    "72",
    "65",
    "73",
    "0",
    "40",
    "0.0",
    "0",
    "ENDTAB",
    "0",
    "TABLE",
    "2",
    "LAYER",
    "70",
    String(layers.length),
  ];

  for (const lay of layers) {
    lines.push(
      "0",
      "LAYER",
      "2",
      lay.name,
      "70",
      "0",
      "62",
      String(lay.color),
      "6",
      "CONTINUOUS"
    );
  }

  lines.push(
    "0",
    "ENDTAB",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "BLOCKS",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES"
  );

  return lines.join("\r\n") + "\r\n";
}

function dxfRectEntities(
  layer: string,
  x0: number,
  y0: number,
  w: number,
  h: number
): string {
  const x1 = Number(x0.toFixed(2));
  const y1 = Number(y0.toFixed(2));
  const x2 = Number((x0 + w).toFixed(2));
  const y2 = Number((y0 + h).toFixed(2));

  // Emit both LWPOLYLINE (for modern CAD/test parsers) AND 4 closed LINE segments (for strict R12 CNC postprocessors)
  const segments = [
    `0\r\nLWPOLYLINE\r\n8\r\n${layer}\r\n90\r\n4\r\n70\r\n1\r\n10\r\n${x1}\r\n20\r\n${y1}\r\n10\r\n${x2}\r\n20\r\n${y1}\r\n10\r\n${x2}\r\n20\r\n${y2}\r\n10\r\n${x1}\r\n20\r\n${y2}\r\n`,
    `0\r\nLINE\r\n8\r\n${layer}\r\n10\r\n${x1}\r\n20\r\n${y1}\r\n30\r\n0.0\r\n11\r\n${x2}\r\n21\r\n${y1}\r\n31\r\n0.0\r\n`,
    `0\r\nLINE\r\n8\r\n${layer}\r\n10\r\n${x2}\r\n20\r\n${y1}\r\n30\r\n0.0\r\n11\r\n${x2}\r\n21\r\n${y2}\r\n31\r\n0.0\r\n`,
    `0\r\nLINE\r\n8\r\n${layer}\r\n10\r\n${x2}\r\n20\r\n${y2}\r\n30\r\n0.0\r\n11\r\n${x1}\r\n21\r\n${y2}\r\n31\r\n0.0\r\n`,
    `0\r\nLINE\r\n8\r\n${layer}\r\n10\r\n${x1}\r\n20\r\n${y2}\r\n30\r\n0.0\r\n11\r\n${x1}\r\n21\r\n${y1}\r\n31\r\n0.0\r\n`,
  ];
  return segments.join("");
}

function dxfTextEntity(
  layer: string,
  x: number,
  y: number,
  heightMm: number,
  text: string
): string {
  const clean = sanitizeAsciiDxfText(text);
  return `0\r\nTEXT\r\n8\r\n${layer}\r\n10\r\n${Number(x.toFixed(2))}\r\n20\r\n${Number(
    y.toFixed(2)
  )}\r\n30\r\n0.0\r\n40\r\n${heightMm}\r\n1\r\n${clean}\r\n`;
}

function renderSinglePieceEntitiesAtOffset(
  piece: CutPiece,
  offsetX: number,
  offsetY: number
): string {
  const w = piece.lengthMm;
  const h = piece.widthMm;
  const netW = piece.netCutLengthMm ?? w;
  const netH = piece.netCutWidthMm ?? h;

  let dxf = "";

  // 1. Finished panel perimeter rectangle (PANEL_CONTOUR)
  dxf += dxfRectEntities("PANEL_CONTOUR", offsetX, offsetY, w, h);

  // 2. Saw net-cut perimeter if edge banding deduction applies (NET_CUT_CONTOUR)
  if (netW !== w || netH !== h) {
    dxf += dxfRectEntities("NET_CUT_CONTOUR", offsetX, offsetY, netW, netH);
  }

  // 3. CNC Sink / Cooktop Cut-out (CUTOUT_SINK_HOB) on Countertop panels
  if (piece.componentRole === "countertop" && w >= 600 && h >= 550) {
    const cutW = Math.min(560, w - 120);
    const cutH = Math.min(480, h - 100);
    const cx0 = offsetX + Math.round((w - cutW) / 2);
    const cy0 = offsetY + Math.round((h - cutH) / 2);
    dxf += dxfRectEntities("CUTOUT_SINK_HOB", cx0, cy0, cutW, cutH);
  }

  // 4. 8mm back panel groove on carcass side/top/bottom panels (BACK_GROOVE_8MM)
  if (
    piece.componentRole === "carcass_side_left" ||
    piece.componentRole === "carcass_side_right" ||
    piece.componentRole === "carcass_top" ||
    piece.componentRole === "carcass_bottom"
  ) {
    const grooveOffset = Math.max(12, h - 20);
    dxf += dxfRectEntities(
      "BACK_GROOVE_8MM",
      offsetX,
      offsetY + grooveOffset,
      w,
      8
    );
  }

  // 5. Part Name, ID, Net Cut Dimensions & Edge Banding Text Annotation (PART_LABELS)
  const labelY = offsetY + Math.max(20, Math.min(h / 2, h - 35));
  dxf += dxfTextEntity(
    "PART_LABELS",
    offsetX + 18,
    labelY,
    Math.min(22, Math.max(10, Math.round(h * 0.045))),
    `${piece.pieceName} [${piece.id}] - Bitmis: ${w}x${h}x${piece.thicknessMm}mm | Net Kesim: ${netW}x${netH}mm`
  );

  // 6. Drilling holes on both generic DRILLING layer and tool-specific CNC layer
  if (piece.holes) {
    piece.holes.forEach((hole) => {
      const toolLayer =
        hole.diameter >= 35
          ? "BORE_35MM"
          : hole.diameter >= 15
          ? "CAM_15MM"
          : hole.diameter >= 8
          ? "DRILL_8MM"
          : "DRILL_5MM";
      const hx = Number((offsetX + hole.x).toFixed(2));
      const hy = Number((offsetY + hole.y).toFixed(2));
      const rad = Number((hole.diameter / 2).toFixed(2));

      dxf += `0\r\nCIRCLE\r\n8\r\nDRILLING\r\n10\r\n${hx}\r\n20\r\n${hy}\r\n30\r\n0.0\r\n40\r\n${rad}\r\n`;
      dxf += `0\r\nCIRCLE\r\n8\r\n${toolLayer}\r\n10\r\n${hx}\r\n20\r\n${hy}\r\n30\r\n0.0\r\n40\r\n${rad}\r\n`;

      if (hole.purpose === "hinge_cup" || hole.purpose === "hinge_mount") {
        const r = rad + 4;
        dxf += `0\r\nLINE\r\n8\r\nHARDWARE_AXIS\r\n10\r\n${hx - r}\r\n20\r\n${hy}\r\n30\r\n0.0\r\n11\r\n${hx + r}\r\n21\r\n${hy}\r\n31\r\n0.0\r\n`;
        dxf += `0\r\nLINE\r\n8\r\nHARDWARE_AXIS\r\n10\r\n${hx}\r\n20\r\n${hy - r}\r\n30\r\n0.0\r\n11\r\n${hx}\r\n21\r\n${hy + r}\r\n31\r\n0.0\r\n`;
      }
    });
  }

  return dxf;
}

/**
 * Generates an AutoCAD R12/LT2 & CNC compatible 2D DXF contour ($INSUNITS = 4 mm) for a single panel
 * with layered CNC drilling hole circles (`BORE_35MM`, `CAM_15MM`, `DRILL_8MM`, `DRILL_5MM`, `DRILLING`),
 * net saw-cut contour (`NET_CUT_CONTOUR`), back groove (`BACK_GROOVE_8MM`), and part label (`PART_LABELS`).
 */
export function generatePanelDXF(piece: CutPiece): string {
  let dxf = buildDxfHeaderAndLayerTables();
  dxf += renderSinglePieceEntitiesAtOffset(piece, 0, 0);
  dxf += "0\r\nENDSEC\r\n0\r\nEOF\r\n";
  return dxf;
}

/**
 * Generates a combined multi-panel DXF cutlist & CNC drilling layout of all panels in the BOM.
 */
export function exportAllPanelsDXF(bom: ManufacturingBOM): string {
  let dxf = buildDxfHeaderAndLayerTables();

  let cursorX = 0;
  let cursorY = 0;
  let rowMaxH = 0;

  bom.cutList.forEach((piece) => {
    const w = piece.lengthMm;
    const h = piece.widthMm;
    if (cursorX > 0 && cursorX + w > 5600) {
      cursorX = 0;
      cursorY += rowMaxH + 180;
      rowMaxH = 0;
    }

    dxf += renderSinglePieceEntitiesAtOffset(piece, cursorX, cursorY);

    cursorX += w + 140;
    if (h > rowMaxH) rowMaxH = h;
  });

  dxf += "0\r\nENDSEC\r\n0\r\nEOF\r\n";
  return dxf;
}

/**
 * Generates a 2D Sheet Nesting Cut-Layout DXF (2800x2070mm raw boards with guillotine cut parts)
 * so the beam saw / panel sizing operator can open the exact board cutting layout in AutoCAD/CAD-CAM.
 */
export function exportNestingSheetsDXF(bom: ManufacturingBOM): string {
  let dxf = buildDxfHeaderAndLayerTables();
  let sheetCursorY = 0;

  bom.nestingResults.forEach((nestRes) => {
    nestRes.sheets.forEach((sheet) => {
      const boardW = 2800;
      const boardH = 2070;

      // Raw 2800x2070 sheet border
      dxf += dxfRectEntities("SHEET_BORDER", 0, sheetCursorY, boardW, boardH);
      dxf += dxfTextEntity(
        "PART_LABELS",
        20,
        sheetCursorY + boardH + 28,
        28,
        `PLAKA #${sheet.sheetIndex} (${nestRes.materialName}) - 2800x2070mm | Fire: %${sheet.wastePercent}`
      );

      sheet.placedPieces.forEach((placed) => {
        const px = placed.x;
        const py = sheetCursorY + placed.y;
        const pw = placed.width;
        const pl = placed.length;
        dxf += dxfRectEntities("PANEL_CONTOUR", px, py, pw, pl);
        dxf += dxfTextEntity(
          "PART_LABELS",
          px + 12,
          py + Math.max(16, Math.min(pl / 2, pl - 20)),
          16,
          `${placed.pieceName} (${placed.length}x${placed.width}mm)`
        );
      });

      sheetCursorY += boardH + 260;
    });
  });

  dxf += "0\r\nENDSEC\r\n0\r\nEOF\r\n";
  return dxf;
}

// ============================================================================
// BLUM CABINET CONFIGURATOR (E-SERVICES) & BXF / EASYSTICK ADAPTER
// ============================================================================

export interface BlumDoorEngineeringMetric {
  bayIndex: number;
  doorWidthMm: number;
  doorHeightMm: number;
  doorThicknessMm: number;
  estimatedWeightKg: number;
  recommendedHingeCount: number;
  hingeSku: string;
  hingeName: string;
  mountingPlateSku: string;
  cupDrillingPattern: string;
  aventosPowerFactorLf: number;
  recommendedAventosModel: string | null;
  hasInternalDrawerZeroProtrusionNeed: boolean;
}

export interface BlumDrawerCuttingSpec {
  drawerId: string;
  bayIndex: number;
  systemName: string;
  runnerSku: string;
  nominalLengthNlMm: number;
  netInnerWidthLwMm: number;
  woodenBottomWidthMm: number;
  woodenBottomDepthMm: number;
  woodenBackWidthMm: number;
  woodenBackHeightMm: number;
  easystickSideHoleXCoordsMm: number[];
  easystickElevationYMm: number;
}

export interface BlumCabinetEngineeringSummary {
  moduleId: string;
  moduleName: string;
  outerDimensions: { KB: number; KH: number; KT: number };
  innerDimensions: { LW: number; LH: number; LT: number };
  panelThicknessMm: number;
  backPanelGrooveOffsetMm: number;
  frontGapFugeMm: number;
  collisionFree: boolean;
  collisionWarnings: string[];
  doors: BlumDoorEngineeringMetric[];
  drawers: BlumDrawerCuttingSpec[];
}

export function calculateBlumEngineeringSummary(
  mod: ModuleInstance
): BlumCabinetEngineeringSummary {
  const KB = mod.dimensions.width;
  const KH = mod.dimensions.height;
  const KT = mod.dimensions.depth;
  const T = mod.carcass.panelThickness || 18;
  const backT = mod.carcass.backPanelThickness || 8;
  const grooveOffset = mod.carcass.backPanelType === "grooved" ? 10 : 0;
  const plinthH = mod.carcass.plinthHeight || 0;
  const fuge = mod.carcass.doorPerimeterGap || 2;

  const dividerCount = Math.max(0, mod.bays.length - 1);
  const totalInnerW = Math.max(150, KB - 2 * T - dividerCount * T);
  const defaultBayLw = Math.round(totalInnerW / Math.max(1, mod.bays.length));
  const LH = Math.max(150, KH - plinthH - 2 * T);
  const LT = Math.max(150, KT - backT - grooveOffset);

  const collisionWarnings: string[] = [];
  const doors: BlumDoorEngineeringMetric[] = [];
  const drawers: BlumDrawerCuttingSpec[] = [];

  const doorT = mod.carcass.doorThickness || 18;
  const densityKgPerM3 =
    mod.carcass.doorMaterialId.includes("glass") ||
    mod.carcass.doorMaterialId.includes("mirror")
      ? 920
      : mod.carcass.doorMaterialId.includes("lacquer")
      ? 760
      : 720;

  mod.bays.forEach((bay, bIdx) => {
    const bayLw = bay.customWidth || defaultBayLw;
    const isDouble =
      bay.door.type === "double" ||
      bay.door.type === "inset_double" ||
      bay.door.doorSystemId === "hinged_double";
    const leafCount =
      bay.door.type === "open" || bay.door.doorSystemId === "open"
        ? 0
        : isDouble
        ? 2
        : 1;
    const leafW =
      leafCount === 2
        ? Math.round((bayLw + T - fuge * 2) / 2)
        : Math.max(150, bayLw + T - fuge * 2);
    const leafH = Math.max(200, KH - plinthH - fuge * 2);

    const volumeM3 = (leafW / 1000) * (leafH / 1000) * (doorT / 1000);
    const weightKg = Number((volumeM3 * densityKgPerM3 + 0.35).toFixed(2));

    let recHinges = 2;
    if (leafH > 2400 || weightKg > 22) recHinges = 5;
    else if (leafH > 1900 || weightKg > 15) recHinges = 4;
    else if (leafH > 1000 || weightKg > 8) recHinges = 3;

    const hasInternalDrawer = bay.drawers.some((d) => d.isInternal);
    const curHingeId = bay.door.hardwareProductId || "hw_blum_71b3550";
    const uses155 = curHingeId === "hw_blum_71b7550" || hasInternalDrawer;

    if (
      hasInternalDrawer &&
      curHingeId !== "hw_blum_71b7550" &&
      bay.door.type !== "open" &&
      !bay.door.doorSystemId?.startsWith("sliding")
    ) {
      collisionWarnings.push(
        `Bölme ${bIdx + 1}: İç çekmece mevcut; kapak çakışmasını önlemek için Blum 155° Sıfır Çıkıntı menteşe [71B7550] önerilir.`
      );
    }

    const aventosLf = Math.round(leafH * weightKg);
    let recommendedAventosModel: string | null = null;
    if (bay.door.doorSystemId?.startsWith("lift_") || leafH <= 1040) {
      if (aventosLf <= 2600) {
        recommendedAventosModel = "AVENTOS HK top 22K2300 (LF 420–2600)";
      } else if (aventosLf <= 5350) {
        recommendedAventosModel = "AVENTOS HF top 22F2510 (LF 2700–5350)";
      } else if (aventosLf <= 9000) {
        recommendedAventosModel = "AVENTOS HF top 22F2510 Çift Güç Ünitesi (LF 5350–9000)";
      } else if (aventosLf <= 13500) {
        recommendedAventosModel = "AVENTOS HF top 22F2800 Ağır Kapak (LF 9000–13500)";
      } else {
        recommendedAventosModel = "LF Sınırı Aşıldı (>13500) — Menteşeli Kapak Önerilir";
        if (bay.door.doorSystemId?.startsWith("lift_")) {
          collisionWarnings.push(
            `Bölme ${bIdx + 1}: AVENTOS Güç Faktörü (LF = ${aventosLf}) maksimum 13500 sınırını aşıyor.`
          );
        }
      }
    }

    if (leafCount > 0) {
      doors.push({
        bayIndex: bIdx,
        doorWidthMm: leafW,
        doorHeightMm: leafH,
        doorThicknessMm: doorT,
        estimatedWeightKg: weightKg,
        recommendedHingeCount: recHinges,
        hingeSku: uses155 ? "71B7550" : "71B3550",
        hingeName: uses155
          ? "Blum CLIP top BLUMOTION 155° Sıfır Çıkıntı"
          : "Blum CLIP top BLUMOTION 110°",
        mountingPlateSku: "173H7100",
        cupDrillingPattern: uses155
          ? "Ø35×11.7 mm + 2×Ø8 mm (45×9.5 mm) • Tab: 5 mm"
          : "Ø35×13.0 mm + 2×Ø8 mm (45×9.5 mm) • Tab: 4.5 mm",
        aventosPowerFactorLf: aventosLf,
        recommendedAventosModel,
        hasInternalDrawerZeroProtrusionNeed: hasInternalDrawer,
      });
    }

    bay.drawers.forEach((drw) => {
      const nl =
        drw.nominalLengthMm ||
        Math.min(600, Math.max(270, Math.floor((LT - 10) / 50) * 50));
      if (nl + 3 > LT) {
        collisionWarnings.push(
          `Bölme ${bIdx + 1} Çekmece (${drw.id}): Ray boyu (NL=${nl}mm) + 3mm boşluk net iç derinliği (LT=${LT}mm) aşıyor.`
        );
      }

      const hwId = drw.hardwareProductId || "hw_blum_tandembox_m30";
      const isLegrabox = hwId.includes("legrabox");
      const isMovento = hwId.includes("movento");

      const woodenBottomWidthMm = isMovento ? bayLw - 42 : bayLw - 75;
      const woodenBottomDepthMm = isLegrabox || isMovento ? nl - 10 : nl - 24;
      const woodenBackWidthMm = isMovento ? bayLw - 42 : bayLw - 87;
      const woodenBackHeightMm = Math.max(68, drw.height - 46);

      drawers.push({
        drawerId: drw.id,
        bayIndex: bIdx,
        systemName: isLegrabox
          ? "Blum LEGRABOX pure (40 kg)"
          : isMovento
          ? "Blum MOVENTO 760H (40 kg)"
          : "Blum TANDEMBOX antaro (30 kg)",
        runnerSku: isLegrabox
          ? "750.5001S+770M"
          : isMovento
          ? "760H5000S"
          : "578.5001M+378M",
        nominalLengthNlMm: nl,
        netInnerWidthLwMm: bayLw,
        woodenBottomWidthMm: Math.max(120, woodenBottomWidthMm),
        woodenBottomDepthMm: Math.max(200, woodenBottomDepthMm),
        woodenBackWidthMm: Math.max(120, woodenBackWidthMm),
        woodenBackHeightMm,
        easystickSideHoleXCoordsMm:
          nl >= 450 ? [37, 165, 261, 389] : [37, 165, 229],
        easystickElevationYMm: drw.elevationY + 37,
      });
    });
  });

  return {
    moduleId: mod.id,
    moduleName: mod.name,
    outerDimensions: { KB, KH, KT },
    innerDimensions: { LW: defaultBayLw, LH, LT },
    panelThicknessMm: T,
    backPanelGrooveOffsetMm: grooveOffset,
    frontGapFugeMm: fuge,
    collisionFree: collisionWarnings.length === 0,
    collisionWarnings,
    doors,
    drawers,
  };
}

export function generateBlumBxfXml(
  project: DesignProject,
  bom: ManufacturingBOM
): string {
  const esc = (s: string | number) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const cabinetSummaries = project.modules
    .filter((m) => m.category !== "complementary")
    .map((m) => calculateBlumEngineeringSummary(m));

  const xmlLines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<BlumBxfDocument version="2.0" generator="Birim Konfigurator V4 (Blum E-SERVICES Compatible)" created="${new Date().toISOString()}">`,
    `  <Project id="${esc(project.id)}" title="${esc(project.title)}" version="${project.version}">`,
    `    <Space mainWallLengthMm="${project.space.walls[0]?.length || 3600}" ceilingHeightMm="${project.space.ceilingHeight || 2700}" />`,
    `    <Cabinets count="${cabinetSummaries.length}">`,
  ];

  cabinetSummaries.forEach((cab, idx) => {
    const modPieces = bom.cutList.filter((p) => p.moduleId === cab.moduleId);
    xmlLines.push(
      `      <Cabinet index="${idx + 1}" id="${esc(cab.moduleId)}" name="${esc(cab.moduleName)}" collisionFree="${cab.collisionFree}">`,
      `        <OuterDimensions KB="${cab.outerDimensions.KB}" KH="${cab.outerDimensions.KH}" KT="${cab.outerDimensions.KT}" unit="mm" />`,
      `        <InnerDimensions LW="${cab.innerDimensions.LW}" LH="${cab.innerDimensions.LH}" LT="${cab.innerDimensions.LT}" unit="mm" />`,
      `        <Construction panelThicknessMm="${cab.panelThicknessMm}" backGrooveOffsetMm="${cab.backPanelGrooveOffsetMm}" frontGapFugeMm="${cab.frontGapFugeMm}" />`,
      `        <Fronts count="${cab.doors.length}">`
    );

    cab.doors.forEach((d) => {
      xmlLines.push(
        `          <Front bayIndex="${d.bayIndex + 1}" widthMm="${d.doorWidthMm}" heightMm="${d.doorHeightMm}" thicknessMm="${d.doorThicknessMm}" weightKg="${d.estimatedWeightKg}" hingeCount="${d.recommendedHingeCount}" hingeArticle="${esc(d.hingeSku)}" mountingPlateArticle="${esc(d.mountingPlateSku)}" powerFactorLF="${d.aventosPowerFactorLf}" aventosRecommendation="${esc(d.recommendedAventosModel || "N/A")}" />`
      );
    });

    xmlLines.push(`        </Fronts>`);
    xmlLines.push(`        <DrawerSystems count="${cab.drawers.length}">`);

    cab.drawers.forEach((drw) => {
      xmlLines.push(
        `          <Drawer id="${esc(drw.drawerId)}" bayIndex="${drw.bayIndex + 1}" system="${esc(drw.systemName)}" article="${esc(drw.runnerSku)}" nominalLengthNL="${drw.nominalLengthNlMm}" innerWidthLW="${drw.netInnerWidthLwMm}">`,
        `            <WoodenCutting bottomWidthMm="${drw.woodenBottomWidthMm}" bottomDepthMm="${drw.woodenBottomDepthMm}" backWidthMm="${drw.woodenBackWidthMm}" backHeightMm="${drw.woodenBackHeightMm}" />`,
        `            <EasystickRuler elevationYMm="${drw.easystickElevationYMm}" holeXPositionsMm="${drw.easystickSideHoleXCoordsMm.join(",")}" />`,
        `          </Drawer>`
      );
    });

    xmlLines.push(`        </DrawerSystems>`);
    xmlLines.push(`        <WoodenParts count="${modPieces.length}">`);

    modPieces.forEach((p: CutPiece) => {
      xmlLines.push(
        `          <Part id="${esc(p.id)}" name="${esc(p.pieceName)}" role="${esc(p.componentRole || "panel")}" lengthMm="${p.lengthMm}" widthMm="${p.widthMm}" netCutLengthMm="${p.netCutLengthMm ?? p.lengthMm}" netCutWidthMm="${p.netCutWidthMm ?? p.widthMm}" thicknessMm="${p.thicknessMm}" material="${esc(p.materialName)}">`,
        `            <EdgeBanding top="${p.edgeBanding.top ? 1 : 0}" bottom="${p.edgeBanding.bottom ? 1 : 0}" left="${p.edgeBanding.left ? 1 : 0}" right="${p.edgeBanding.right ? 1 : 0}" />`,
        `            <EasystickDrillings count="${p.holes?.length || 0}">`
      );
      (p.holes || []).forEach((h) => {
        xmlLines.push(
          `              <Hole id="${esc(h.id)}" x="${h.x}" y="${h.y}" diameter="${h.diameter}" depth="${h.depth}" face="${esc(h.direction)}" purpose="${esc(h.purpose)}" />`
        );
      });
      xmlLines.push(`            </EasystickDrillings>`);
      xmlLines.push(`          </Part>`);
    });

    xmlLines.push(`        </WoodenParts>`);
    xmlLines.push(`      </Cabinet>`);
  });

  xmlLines.push(`    </Cabinets>`);
  xmlLines.push(`    <BlumOrderList count="${bom.hardwareList.length}">`);
  bom.hardwareList.forEach((hw) => {
    xmlLines.push(
      `      <OrderItem sku="${esc(hw.sku)}" description="${esc(hw.name)}" quantity="${hw.quantity}" unit="${esc(hw.unit)}" unitPriceEur="${hw.unitPrice.toFixed(2)}" totalPriceEur="${hw.totalPrice.toFixed(2)}" />`
    );
  });
  xmlLines.push(`    </BlumOrderList>`);
  xmlLines.push(`  </Project>`);
  xmlLines.push(`</BlumBxfDocument>`);

  return xmlLines.join("\r\n");
}

export function parseBlumBxfXml(xmlContent: string): {
  name: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  panelThicknessMm: number;
  frontGapMm: number;
  bayCount: number;
  drawerCount: number;
  hingeSku: string;
  runnerSku: string;
  createdModule: ModuleInstance;
} | null {
  if (!xmlContent || typeof xmlContent !== "string") return null;

  const extractAttr = (tagPattern: RegExp, attrName: string): string | null => {
    const tagMatch = xmlContent.match(tagPattern);
    if (!tagMatch) return null;
    const attrRegex = new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, "i");
    const m = tagMatch[0].match(attrRegex);
    return m ? m[1] : null;
  };

  const kbAttr =
    extractAttr(/<OuterDimensions[^>]*>/i, "KB") ||
    extractAttr(/<Cabinet[^>]*>/i, "width") ||
    (xmlContent.match(/<(?:CorpusWidth|Width|KB)>(\d+(?:\.\d+)?)<\//i)?.[1] ?? null);
  const khAttr =
    extractAttr(/<OuterDimensions[^>]*>/i, "KH") ||
    extractAttr(/<Cabinet[^>]*>/i, "height") ||
    (xmlContent.match(/<(?:CorpusHeight|Height|KH)>(\d+(?:\.\d+)?)<\//i)?.[1] ?? null);
  const ktAttr =
    extractAttr(/<OuterDimensions[^>]*>/i, "KT") ||
    extractAttr(/<Cabinet[^>]*>/i, "depth") ||
    (xmlContent.match(/<(?:CorpusDepth|Depth|KT)>(\d+(?:\.\d+)?)<\//i)?.[1] ?? null);

  const widthMm = Math.max(300, Math.min(3600, Math.round(Number(kbAttr) || 1200)));
  const heightMm = Math.max(350, Math.min(2800, Math.round(Number(khAttr) || 2200)));
  const depthMm = Math.max(250, Math.min(900, Math.round(Number(ktAttr) || 600)));

  const panelTAttr =
    extractAttr(/<Construction[^>]*>/i, "panelThicknessMm") ||
    (xmlContent.match(/<(?:SideWallThickness|PanelThickness)>(\d+)<\//i)?.[1] ?? null);
  const panelThicknessMm = [16, 18, 19, 22, 25].includes(Number(panelTAttr))
    ? Number(panelTAttr)
    : 18;

  const fugeAttr = extractAttr(/<Construction[^>]*>/i, "frontGapFugeMm");
  const frontGapMm = Number(fugeAttr) > 0 ? Number(fugeAttr) : 2;

  const cabName =
    extractAttr(/<Cabinet[^>]*>/i, "name") ||
    (xmlContent.match(/<(?:CabinetName|Commission)>([^<]+)<\//i)?.[1] ?? null) ||
    `Blum BXF Gövde (${widthMm}×${heightMm}×${depthMm})`;

  const frontMatches = xmlContent.match(/<Front\b[^>]*>/gi) || [];
  const drawerMatches = xmlContent.match(/<Drawer\b[^>]*>/gi) || [];
  const bayCount = Math.max(1, Math.min(6, frontMatches.length || Math.round(widthMm / 600)));
  const drawerCount = Math.min(6, drawerMatches.length);

  const hingeSku =
    extractAttr(/<Front[^>]*>/i, "hingeArticle") ||
    (xmlContent.includes("71B7550") ? "71B7550" : "71B3550");
  const runnerSku =
    extractAttr(/<Drawer[^>]*>/i, "article") ||
    (xmlContent.includes("750.") ? "750.5001S+770M" : "578.5001M+378M");

  const mod = createDefaultWardrobeModule(`mod_bxf_${Date.now()}`);
  mod.name = cabName;
  mod.dimensions = { width: widthMm, height: heightMm, depth: depthMm };
  mod.carcass.panelThickness = panelThicknessMm;
  mod.carcass.doorPerimeterGap = frontGapMm;

  mod.bays = Array.from({ length: bayCount }, (_, bIdx) => ({
    index: bIdx,
    shelves: [
      { id: `${mod.id}_s_${bIdx}_1`, bayIndex: bIdx, elevationY: 500, isAdjustable: true },
      { id: `${mod.id}_s_${bIdx}_2`, bayIndex: bIdx, elevationY: 1400, isAdjustable: true },
    ],
    hangingRails:
      heightMm >= 1600
        ? [{ id: `${mod.id}_r_${bIdx}_1`, bayIndex: bIdx, elevationY: heightMm - 320 }]
        : [],
    drawers:
      bIdx === 0 && drawerCount > 0
        ? Array.from({ length: drawerCount }, (__, dIdx) => ({
            id: `${mod.id}_drw_${bIdx}_${dIdx}`,
            bayIndex: bIdx,
            elevationY: dIdx * 200,
            height: 180,
            slideType: "soft_close" as const,
            hardwareProductId: runnerSku.startsWith("750")
              ? "hw_blum_legrabox_m40"
              : "hw_blum_tandembox_m30",
          }))
        : [],
    specialFittings: [],
    door: {
      id: `${mod.id}_door_${bIdx}`,
      bayIndex: bIdx,
      type: widthMm / bayCount >= 750 ? "double" : "single_left",
      doorSystemId: widthMm / bayCount >= 750 ? "hinged_double" : "hinged_single",
      hardwareProductId: hingeSku === "71B7550" ? "hw_blum_71b7550" : "hw_blum_71b3550",
      softClose: true,
    },
  }));

  return {
    name: cabName,
    widthMm,
    heightMm,
    depthMm,
    panelThicknessMm,
    frontGapMm,
    bayCount,
    drawerCount,
    hingeSku,
    runnerSku,
    createdModule: mod,
  };
}
