import { ManufacturingBOM, CutPiece } from "./types";
import {
  DesignProject,
  ModuleInstance,
  calculateFourSpaceDimensions,
  calculateNetInnerHeight,
  createDefaultWardrobeModule,
  roundIntMm,
  roundMm,
} from "@birim/core";
import {
  DXF_AC1015_HEADER,
  DXF_AC1015_FOOTER,
  DXF_MODEL_SPACE_OWNER_HANDLE,
} from "./dxf-template";

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
  void project;
  void bom;
  return [
    {
      stepNumber: 1,
      title: "Saha Hazırlığı ve Baza Montajı",
      description:
        "Zemin terazisini su terazisi ile kontrol ediniz. Baza ayaklarını alt tablanın altına vidalayınız ve yükseklik ayarını yapınız.",
      requiredParts: ["Baza Ön", "Baza Arka"],
      requiredHardware: ["HW_LEVELING_FEET"],
      safetyNotes: "Zemin eğimi 5mm'den fazlaysa ayak ayarını teraziye göre sabitleyiniz.",
    },
    {
      stepNumber: 2,
      title: "Gövde Karkas Kurulumu (Minifix & Kavela)",
      description:
        "Sol yan paneli alt tablaya 90° açıyla yerleştirip minifix millerini kavelalar ile birlikte sıkınız. Ardından ara dikmeleri ve üst tablayı kilitleyiniz.",
      requiredParts: ["Sol Yan Panel", "Sağ Yan Panel", "Alt Panel", "Üst Panel", "Ara Dikmeler"],
      requiredHardware: ["HW_MINIFIX_SET", "HW_DOWEL_8X35"],
      safetyNotes:
        "Minifix kamlarını aşırı tork ile sıkmayınız, 180° tam kilitlenme yeterlidir.",
    },
    {
      stepNumber: 3,
      title: "Arkalık Montajı",
      description:
        "Gövde köşegenlerini metre ile ölçerek tam gönyede olduğunu doğrulayınız. 8mm arkalık panelini oluk yuvalarına kaydırıp sabitleyiniz.",
      requiredParts: ["Arkalık Paneli"],
      requiredHardware: [],
      safetyNotes: "Köşegen farkı 2mm'yi geçmemelidir.",
    },
    {
      stepNumber: 4,
      title: "İç Donanım ve Ray Montajı",
      description:
        "Tandembox çekmece raylarını System 32 deliklerine vidalayınız. Raf pimlerini ve askı borusu flanşlarını yerleştiriniz.",
      requiredParts: ["Raflar", "Çekmece Kasaları"],
      requiredHardware: ["HW_BLUM_TANDEM_BOX", "HW_SHELF_PIN", "HW_HANGING_RAIL"],
    },
    {
      stepNumber: 5,
      title: "Kapak ve Klapa Montajı & İnce Ayar",
      description:
        "Blum 110° menteşeleri kapaklara takıp gövde tabanlarına klipsleyiniz. Kapaklar arası 2mm çevre çalışma boşluğunu 3D menteşe vidasından ayarlayınız.",
      requiredParts: ["Kapaklar", "Çekmece Önleri"],
      requiredHardware: ["HW_BLUM_HINGE_110", "HW_HANDLE_BAR"],
    },
  ];
}

/**
 * Escapes CSV cell values against double-quote breakage, semicolon splitting,
 * and spreadsheet formula injection (=, +, -, @, \t, \r).
 */
function sanitizeCsvCell(val: string | number | undefined | null): string {
  const raw = String(val ?? "");
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  const escaped = formulaSafe.replace(/"/g, '""');
  return `"${escaped}"`;
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
    sanitizeCsvCell(p.id),
    sanitizeCsvCell(p.pieceName),
    sanitizeCsvCell(p.moduleName),
    sanitizeCsvCell(p.materialName),
    p.lengthMm,
    p.widthMm,
    p.netCutLengthMm ?? p.lengthMm,
    p.netCutWidthMm ?? p.widthMm,
    p.thicknessMm,
    p.quantity,
    sanitizeCsvCell(p.edgeBandCode || ""),
    p.edgeBanding.top ? "1" : "0",
    p.edgeBanding.bottom ? "1" : "0",
    p.edgeBanding.left ? "1" : "0",
    p.edgeBanding.right ? "1" : "0",
    sanitizeCsvCell(p.grain),
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

class DxfWriter {
  private handle = 0x1000;
  private entities: string[] = [];

  nextHandle(): string {
    return (this.handle++).toString(16).toUpperCase();
  }

  addPolyline(layer: string, points: [number, number][], closed = true): void {
    const h = this.nextHandle();
    const lines = [
      "  0",
      "LWPOLYLINE",
      "  5",
      h,
      "330",
      DXF_MODEL_SPACE_OWNER_HANDLE,
      "100",
      "AcDbEntity",
      "  8",
      layer,
      "100",
      "AcDbPolyline",
      " 90",
      String(points.length),
      " 70",
      closed ? "1" : "0",
    ];
    for (const [x, y] of points) {
      lines.push(
        " 10",
        Number(x.toFixed(2)).toString(),
        " 20",
        Number(y.toFixed(2)).toString()
      );
    }
    this.entities.push(lines.join("\r\n") + "\r\n");
  }

  addRect(layer: string, x0: number, y0: number, w: number, h: number): void {
    const x1 = Number(x0.toFixed(2));
    const y1 = Number(y0.toFixed(2));
    const x2 = Number((x0 + w).toFixed(2));
    const y2 = Number((y0 + h).toFixed(2));
    this.addPolyline(
      layer,
      [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2],
      ],
      true
    );
  }

  addLine(layer: string, x1: number, y1: number, x2: number, y2: number): void {
    const h = this.nextHandle();
    const lines = [
      "  0",
      "LINE",
      "  5",
      h,
      "330",
      DXF_MODEL_SPACE_OWNER_HANDLE,
      "100",
      "AcDbEntity",
      "  8",
      layer,
      "100",
      "AcDbLine",
      " 10",
      Number(x1.toFixed(2)).toString(),
      " 20",
      Number(y1.toFixed(2)).toString(),
      " 30",
      "0.0",
      " 11",
      Number(x2.toFixed(2)).toString(),
      " 21",
      Number(y2.toFixed(2)).toString(),
      " 31",
      "0.0",
    ];
    this.entities.push(lines.join("\r\n") + "\r\n");
  }

  addCircle(layer: string, cx: number, cy: number, radius: number): void {
    const h = this.nextHandle();
    const lines = [
      "  0",
      "CIRCLE",
      "  5",
      h,
      "330",
      DXF_MODEL_SPACE_OWNER_HANDLE,
      "100",
      "AcDbEntity",
      "  8",
      layer,
      "100",
      "AcDbCircle",
      " 10",
      Number(cx.toFixed(2)).toString(),
      " 20",
      Number(cy.toFixed(2)).toString(),
      " 30",
      "0.0",
      " 40",
      Number(radius.toFixed(2)).toString(),
    ];
    this.entities.push(lines.join("\r\n") + "\r\n");
  }

  addText(
    layer: string,
    x: number,
    y: number,
    heightMm: number,
    text: string,
    rotationDeg = 0
  ): void {
    const clean = sanitizeAsciiDxfText(text);
    const h = this.nextHandle();
    const lines = [
      "  0",
      "TEXT",
      "  5",
      h,
      "330",
      DXF_MODEL_SPACE_OWNER_HANDLE,
      "100",
      "AcDbEntity",
      "  8",
      layer,
      "100",
      "AcDbText",
      " 10",
      Number(x.toFixed(2)).toString(),
      " 20",
      Number(y.toFixed(2)).toString(),
      " 30",
      "0.0",
      " 40",
      Number(heightMm.toFixed(2)).toString(),
      "  1",
      clean,
    ];
    if (rotationDeg !== 0) {
      lines.push(" 50", Number(rotationDeg.toFixed(2)).toString());
    }
    lines.push("100", "AcDbText");
    this.entities.push(lines.join("\r\n") + "\r\n");
  }

  toDxf(): string {
    const nextHex = (this.handle + 16).toString(16).toUpperCase();
    const header = DXF_AC1015_HEADER.replace(
      /\$HANDSEED\r?\n\s*5\r?\n[0-9A-Fa-f]+/,
      `$HANDSEED\r\n  5\r\n${nextHex}`
    );

    return header + this.entities.join("") + "  0\r\nENDSEC\r\n" + DXF_AC1015_FOOTER;
  }
}

function renderSinglePieceEntities(
  writer: DxfWriter,
  piece: CutPiece,
  offsetX: number,
  offsetY: number
): void {
  // Local coordinate system:
  // w = piece.widthMm (En — X-axis 0..w)
  // h = piece.lengthMm (Boy — Y-axis 0..h)
  const w = piece.widthMm;
  const h = piece.lengthMm;
  const netW = piece.netCutWidthMm ?? w;
  const netH = piece.netCutLengthMm ?? h;
  const eb = piece.edgeBanding;
  const ebT = eb?.thickness || 0;

  // 1. Finished panel perimeter rectangle (PANEL_CONTOUR)
  writer.addRect("PANEL_CONTOUR", offsetX, offsetY, w, h);

  // 2. Saw net-cut perimeter properly inset by left & bottom edge-banding thickness (NET_CUT_CONTOUR)
  if (netW !== w || netH !== h) {
    const insetLeft = eb?.left ? ebT : 0;
    const insetBottom = eb?.bottom ? ebT : 0;
    writer.addRect(
      "NET_CUT_CONTOUR",
      roundMm(offsetX + insetLeft, 2),
      roundMm(offsetY + insetBottom, 2),
      netW,
      netH
    );
  }

  // 3. Explicit CNC Sink / Cooktop Cut-out ONLY when piece.hasSinkOrHobCutout === true!
  if (piece.componentRole === "countertop" && piece.hasSinkOrHobCutout) {
    const cutLong = piece.cutoutWidthMm || Math.min(560, Math.max(w, h) - 120);
    const cutShort = piece.cutoutDepthMm || Math.min(480, Math.min(w, h) - 100);
    const cutW = w >= h ? cutLong : cutShort;
    const cutH = w >= h ? cutShort : cutLong;
    if (cutW > 100 && cutH > 100 && cutW < w - 40 && cutH < h - 40) {
      const cx0 = offsetX + Math.round((w - cutW) / 2);
      const cy0 = offsetY + Math.round((h - cutH) / 2);
      writer.addRect("CUTOUT_SINK_HOB", cx0, cy0, cutW, cutH);
    }
  }

  // 3b. Parametric Socket / Cable Grommet / Plumbing / Baseboard Notch Cutouts
  if (piece.utilityCutouts && piece.utilityCutouts.length > 0) {
    for (const co of piece.utilityCutouts) {
      const layerName = co.shape === "corner_notch" ? "NOTCH_BASEBOARD" : "CUTOUT_UTILITY";
      if (co.shape === "circle") {
        const rad = roundMm((co.diameterMm ?? co.widthMm) / 2, 2);
        writer.addCircle(layerName, roundMm(offsetX + co.centerXMm, 2), roundMm(offsetY + co.centerYMm, 2), rad);
      } else {
        const rx = roundMm(offsetX + Math.max(0, co.centerXMm - co.widthMm / 2), 2);
        const ry = roundMm(offsetY + Math.max(0, co.centerYMm - co.heightMm / 2), 2);
        writer.addRect(layerName, rx, ry, co.widthMm, co.heightMm);
      }
    }
  }

  // 4. 8mm back panel groove (BACK_GROOVE_8MM)
  // On ALL carcass panels (side_left, side_right, carcass_top, carcass_bottom),
  // X is depth (0..w) and Y is length/span (0..h), so the back groove ALWAYS runs along Y (0..h)!
  // - Left side / Top / Bottom: rear edge is at x = w -> groove spans [w - 20, w - 12]
  // - Mirrored Right side (mirrorInnerFaceX = true): rear edge is at x = 0 -> groove spans [12, 20]
  const grooveActive =
    piece.hasBackGroove !== undefined
      ? piece.hasBackGroove
      : piece.componentRole === "carcass_side_left" ||
        piece.componentRole === "carcass_side_right" ||
        piece.componentRole === "carcass_top" ||
        piece.componentRole === "carcass_bottom";

  if (grooveActive && w >= 100) {
    const grooveOffset = piece.backGrooveOffsetMm ?? 20;
    const grooveX = piece.mirrorInnerFaceX
      ? Math.max(8, grooveOffset - 8) // [12..20] from x = 0 rear edge
      : Math.max(12, w - grooveOffset); // [w - 20 .. w - 12] from x = w rear edge
    writer.addRect("BACK_GROOVE_8MM", offsetX + grooveX, offsetY, 8, h);
  }

  // 5. Part Name, ID, Net Cut Dimensions & Edge Banding Text Annotation (PART_LABELS)
  const isNarrow = w < 280 && h >= 400;
  const labelX = isNarrow ? offsetX + Math.max(16, w / 2 - 4) : offsetX + 18;
  const labelY = isNarrow ? offsetY + 40 : offsetY + Math.max(20, Math.min(h / 2, h - 35));
  const rotationDeg = isNarrow ? 90 : 0;
  writer.addText(
    "PART_LABELS",
    labelX,
    labelY,
    Math.min(20, Math.max(10, Math.round(Math.min(w, h) * 0.045))),
    `${piece.pieceName} [${piece.id}] - Net: ${netH}x${netW}x${piece.thicknessMm}mm`,
    rotationDeg
  );

  // 6. Drilling holes: SINGLE circle per hole on its dedicated CNC tool/face layer (zero duplicate circles!)
  if (piece.holes) {
    piece.holes.forEach((hole) => {
      const hx = roundMm(offsetX + hole.x, 2);
      const hy = roundMm(offsetY + hole.y, 2);
      const rad = roundMm(hole.diameter / 2, 2);

      if (hole.direction.startsWith("edge_")) {
        // Horizontal edge bore represented as an axis line into the panel edge on EDGE_DRILL_8MM
        const boreLen = Math.min(hole.depth || 30, Math.min(w, h) * 0.4);
        let x2 = hx;
        let y2 = hy;
        if (hole.direction === "edge_bottom") y2 = roundMm(hy + boreLen, 2);
        else if (hole.direction === "edge_top") y2 = roundMm(hy - boreLen, 2);
        else if (hole.direction === "edge_left") x2 = roundMm(hx + boreLen, 2);
        else if (hole.direction === "edge_right") x2 = roundMm(hx - boreLen, 2);
        writer.addLine("EDGE_DRILL_8MM", hx, hy, x2, y2);
        return;
      }

      const backSuffix = hole.direction === "face_back" ? "_BACK" : "";
      const toolLayer =
        hole.diameter >= 35
          ? `BORE_35MM${backSuffix}`
          : hole.diameter >= 15
          ? `CAM_15MM${backSuffix}`
          : hole.diameter >= 8
          ? `DRILL_8MM${backSuffix}`
          : `DRILL_5MM${backSuffix}`;

      writer.addCircle(toolLayer, hx, hy, rad);

      if (hole.purpose === "hinge_cup" || hole.purpose === "hinge_mount") {
        const r = rad + 4;
        writer.addLine("HARDWARE_AXIS", hx - r, hy, hx + r, hy);
        writer.addLine("HARDWARE_AXIS", hx, hy - r, hx, hy + r);
      }
    });
  }
}

export function generatePanelDXF(piece: CutPiece): string {
  const writer = new DxfWriter();
  renderSinglePieceEntities(writer, piece, 0, 0);
  return writer.toDxf();
}

export function exportAllPanelsDXF(bom: ManufacturingBOM): string {
  const writer = new DxfWriter();

  let cursorX = 0;
  let cursorY = 0;
  let rowMaxH = 0;

  bom.cutList.forEach((piece) => {
    const w = piece.widthMm;
    const h = piece.lengthMm;
    if (cursorX > 0 && cursorX + w > 5600) {
      cursorX = 0;
      cursorY += rowMaxH + 180;
      rowMaxH = 0;
    }

    renderSinglePieceEntities(writer, piece, cursorX, cursorY);

    cursorX += w + 140;
    if (h > rowMaxH) rowMaxH = h;
  });

  return writer.toDxf();
}

export function exportNestingSheetsDXF(bom: ManufacturingBOM): string {
  const writer = new DxfWriter();
  let sheetCursorY = 0;

  bom.nestingResults.forEach((nestRes) => {
    nestRes.sheets.forEach((sheet) => {
      const boardW = sheet.sheetDimension.lengthMm || 2800;
      const boardH = sheet.sheetDimension.widthMm || 2070;

      writer.addRect("SHEET_BORDER", 0, sheetCursorY, boardW, boardH);
      writer.addText(
        "PART_LABELS",
        20,
        sheetCursorY + boardH + 28,
        28,
        `PLAKA #${sheet.sheetIndex} (${nestRes.materialName}) - ${boardW}x${boardH}mm | Fire: %${sheet.wastePercent}`
      );

      sheet.placedPieces.forEach((placed) => {
        const px = placed.x;
        const py = sheetCursorY + placed.y;
        const pw = placed.width;
        const pl = placed.length;
        writer.addRect("NET_CUT_CONTOUR", px, py, pw, pl);
        writer.addText(
          "PART_LABELS",
          px + 12,
          py + Math.max(16, Math.min(pl / 2, pl - 20)),
          16,
          `${placed.pieceName} (${placed.width}x${placed.length}mm)`
        );
      });

      (sheet.usableRemnants || []).forEach((rem) => {
        writer.addRect(
          "USABLE_REMNANT",
          rem.x,
          sheetCursorY + rem.y,
          rem.width,
          rem.length
        );
      });

      sheetCursorY += boardH + 260;
    });
  });

  return writer.toDxf();
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

/**
 * Uses @birim/core's single source of truth (`calculateFourSpaceDimensions`)
 * so Blum engineering summary, BOM hinge counts, and CNC hole counts match 100%.
 */
export function calculateBlumEngineeringSummary(
  mod: ModuleInstance
): BlumCabinetEngineeringSummary {
  const fourSpace = calculateFourSpaceDimensions(mod);
  const KB = fourSpace.externalCarcass.widthMm;
  const KH = fourSpace.externalCarcass.heightMm;
  const KT = fourSpace.externalCarcass.depthMm;
  const T = mod.carcass.panelThickness || 18;
  const grooveOffset = mod.carcass.backPanelType === "grooved" ? 12 : 0;
  const fuge = mod.carcass.doorPerimeterGap || 2;

  const bayWidths = fourSpace.usableInternal.bayClearWidthsMm;
  const defaultBayLw = bayWidths[0] || Math.max(120, KB - 2 * T);
  const LH = fourSpace.usableInternal.netInnerHeightMm;
  const LT = fourSpace.usableInternal.netInnerDepthMm;

  const collisionWarnings: string[] = [];
  const doors: BlumDoorEngineeringMetric[] = [];
  const drawers: BlumDrawerCuttingSpec[] = [];

  mod.bays.forEach((bay, bIdx) => {
    const bayLw = bayWidths[bIdx] || defaultBayLw;
    const leafInfo = fourSpace.doorLeaves[bIdx];

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

    if (leafInfo && leafInfo.leafCount > 0) {
      const aventosLf = leafInfo.powerFactorLf;
      let recommendedAventosModel: string | null = null;
      if (bay.door.doorSystemId?.startsWith("lift_") || leafInfo.leafHeightMm <= 1040) {
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

      doors.push({
        bayIndex: bIdx,
        doorWidthMm: leafInfo.leafWidthMm,
        doorHeightMm: leafInfo.leafHeightMm,
        doorThicknessMm: leafInfo.leafThicknessMm,
        estimatedWeightKg: leafInfo.leafWeightKg,
        recommendedHingeCount:
          leafInfo.effectiveHingeCount || leafInfo.recommendedHingesPerLeaf,
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
        easystickSideHoleXCoordsMm: nl >= 450 ? [37, 165, 261, 389] : [37, 165, 229],
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

export function generateBlumBxfXml(project: DesignProject, bom: ManufacturingBOM): string {
  const esc = (s: string | number) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

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

  const unescapeXml = (val: string): string =>
    val
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

  const extractAttr = (tagPattern: RegExp, attrName: string): string | null => {
    const tagMatch = xmlContent.match(tagPattern);
    if (!tagMatch) return null;
    const attrRegex = new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, "i");
    const m = tagMatch[0].match(attrRegex);
    return m ? unescapeXml(m[1]) : null;
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

  const widthMm = Math.max(300, Math.min(3600, roundIntMm(Number(kbAttr) || 1200)));
  const heightMm = Math.max(350, Math.min(2800, roundIntMm(Number(khAttr) || 2200)));
  const depthMm = Math.max(250, Math.min(900, roundIntMm(Number(ktAttr) || 600)));

  const panelTAttr =
    extractAttr(/<Construction[^>]*>/i, "panelThicknessMm") ||
    (xmlContent.match(/<(?:SideWallThickness|PanelThickness)>(\d+)<\//i)?.[1] ?? null);
  const panelThicknessMm = [16, 18, 19, 22, 25].includes(Number(panelTAttr))
    ? Number(panelTAttr)
    : 18;

  const fugeAttr = extractAttr(/<Construction[^>]*>/i, "frontGapFugeMm");
  const frontGapMm = Number(fugeAttr) > 0 ? Number(fugeAttr) : 2;

  const rawCabName =
    extractAttr(/<Cabinet[^>]*>/i, "name") ||
    (xmlContent.match(/<(?:CabinetName|Commission)>([^<]+)<\//i)?.[1] ?? null);
  const cabName = rawCabName
    ? unescapeXml(rawCabName).slice(0, 120)
    : `Blum BXF Gövde (${widthMm}×${heightMm}×${depthMm})`;

  const frontMatches = xmlContent.match(/<Front\b[^>]*>/gi) || [];
  const drawerMatches = xmlContent.match(/<Drawer\b[^>]*>/gi) || [];
  const maxSafeBays = Math.max(1, Math.floor((widthMm - panelThicknessMm) / (150 + panelThicknessMm)));
  const bayCount = Math.max(
    1,
    Math.min(maxSafeBays, Math.min(6, frontMatches.length || Math.round(widthMm / 600)))
  );

  const hingeSku =
    extractAttr(/<Front[^>]*>/i, "hingeArticle") ||
    (xmlContent.includes("71B7550") ? "71B7550" : "71B3550");
  const runnerSku =
    extractAttr(/<Drawer[^>]*>/i, "article") ||
    (xmlContent.includes("750.") ? "750.5001S+770M" : "578.5001M+378M");

  const mod = createDefaultWardrobeModule(`mod_bxf_${Date.now()}`);
  mod.name = cabName;
  mod.category = heightMm <= 920 ? (depthMm <= 420 ? "kitchen_wall" : "kitchen_base") : "wardrobe";
  mod.dimensions = { width: widthMm, height: heightMm, depth: depthMm };
  mod.carcass.panelThickness = panelThicknessMm;
  mod.carcass.doorPerimeterGap = frontGapMm;
  if (heightMm <= 920 && depthMm <= 420) {
    mod.carcass.plinthHeight = 0;
  }

  const netH = Math.max(200, calculateNetInnerHeight(mod));
  const snap32 = (y: number) =>
    Math.max(64, Math.min(Math.max(96, netH - 64), Math.round(y / 32) * 32));
  const maxFitDrawers = Math.min(6, Math.floor((netH - 40) / 190));
  const drawerCount = Math.min(maxFitDrawers, drawerMatches.length);

  mod.bays = Array.from({ length: bayCount }, (_, bIdx) => {
    const shelves =
      netH >= 1100
        ? [
            {
              id: `${mod.id}_s_${bIdx}_1`,
              bayIndex: bIdx,
              elevationY: snap32(netH * 0.34),
              isAdjustable: true,
            },
            {
              id: `${mod.id}_s_${bIdx}_2`,
              bayIndex: bIdx,
              elevationY: snap32(netH * 0.68),
              isAdjustable: true,
            },
          ]
        : [
            {
              id: `${mod.id}_s_${bIdx}_1`,
              bayIndex: bIdx,
              elevationY: snap32(netH * 0.5),
              isAdjustable: true,
            },
          ];

    return {
      index: bIdx,
      shelves: bIdx === 0 && drawerCount > 0 && netH < 900 ? [] : shelves,
      hangingRails:
        netH >= 1400
          ? [
              {
                id: `${mod.id}_r_${bIdx}_1`,
                bayIndex: bIdx,
                elevationY: Math.max(160, netH - 220),
              },
            ]
          : [],
      drawers:
        bIdx === 0 && drawerCount > 0
          ? Array.from({ length: drawerCount }, (__, dIdx) => ({
              id: `${mod.id}_drw_${bIdx}_${dIdx}`,
              bayIndex: bIdx,
              elevationY: dIdx * 185,
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
    };
  });

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
