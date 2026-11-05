import { ManufacturingBOM, CutPiece } from "./types";
import { DesignProject } from "@birim/core";

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

  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
}

/**
 * Generates an AutoCAD compatible 2D DXF contour ($INSUNITS = 4 mm) for a rectangular panel
 * with layered CNC drilling hole circles (`BORE_35MM`, `CAM_15MM`, `DRILL_8MM`, `DRILL_5MM`, `DRILLING`)
 * and optional back panel groove (`BACK_GROOVE_8MM`).
 */
export function generatePanelDXF(piece: CutPiece): string {
  const w = piece.lengthMm;
  const h = piece.widthMm;
  const netW = piece.netCutLengthMm ?? w;
  const netH = piece.netCutWidthMm ?? h;

  let dxf = `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nTABLES\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nENTITIES\n`;

  // Draw finished panel perimeter rectangle (PANEL_CONTOUR)
  dxf += `0\nLWPOLYLINE\n8\nPANEL_CONTOUR\n90\n4\n70\n1\n`;
  dxf += `10\n0.0\n20\n0.0\n`;
  dxf += `10\n${w}\n20\n0.0\n`;
  dxf += `10\n${w}\n20\n${h}\n`;
  dxf += `10\n0.0\n20\n${h}\n`;

  // Draw saw net-cut perimeter if edge banding deduction applies (NET_CUT_CONTOUR)
  if (netW !== w || netH !== h) {
    dxf += `0\nLWPOLYLINE\n8\nNET_CUT_CONTOUR\n90\n4\n70\n1\n`;
    dxf += `10\n0.0\n20\n0.0\n`;
    dxf += `10\n${netW}\n20\n0.0\n`;
    dxf += `10\n${netW}\n20\n${netH}\n`;
    dxf += `10\n0.0\n20\n${netH}\n`;
  }

  // Draw CNC Sink / Cooktop Cut-out (CUTOUT_SINK_HOB) on Countertop panels
  if (piece.componentRole === "countertop" && w >= 600 && h >= 550) {
    const cutW = Math.min(560, w - 120);
    const cutH = Math.min(480, h - 100);
    const cx0 = Math.round((w - cutW) / 2);
    const cy0 = Math.round((h - cutH) / 2);
    dxf += `0\nLWPOLYLINE\n8\nCUTOUT_SINK_HOB\n90\n4\n70\n1\n`;
    dxf += `10\n${cx0}\n20\n${cy0}\n`;
    dxf += `10\n${cx0 + cutW}\n20\n${cy0}\n`;
    dxf += `10\n${cx0 + cutW}\n20\n${cy0 + cutH}\n`;
    dxf += `10\n${cx0}\n20\n${cy0 + cutH}\n`;
  }

  // Draw 8mm back panel groove on carcass side/top/bottom panels
  if (
    piece.componentRole === "carcass_side_left" ||
    piece.componentRole === "carcass_side_right" ||
    piece.componentRole === "carcass_top" ||
    piece.componentRole === "carcass_bottom"
  ) {
    const grooveOffset = Math.max(12, h - 20);
    dxf += `0\nLWPOLYLINE\n8\nBACK_GROOVE_8MM\n90\n4\n70\n1\n`;
    dxf += `10\n0.0\n20\n${grooveOffset}\n`;
    dxf += `10\n${w}\n20\n${grooveOffset}\n`;
    dxf += `10\n${w}\n20\n${grooveOffset + 8}\n`;
    dxf += `10\n0.0\n20\n${grooveOffset + 8}\n`;
  }

  // Draw drilling holes on both generic DRILLING layer and tool-specific CNC layer
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
      dxf += `0\nCIRCLE\n8\nDRILLING\n10\n${hole.x}\n20\n${hole.y}\n30\n0.0\n40\n${
        hole.diameter / 2
      }\n`;
      dxf += `0\nCIRCLE\n8\n${toolLayer}\n10\n${hole.x}\n20\n${hole.y}\n30\n0.0\n40\n${
        hole.diameter / 2
      }\n`;
      // Add crosshair centerlines on HARDWARE_AXIS layer for 35mm hinge cups and hinge mounts
      if (hole.purpose === "hinge_cup" || hole.purpose === "hinge_mount") {
        const r = hole.diameter / 2 + 4;
        dxf += `0\nLINE\n8\nHARDWARE_AXIS\n10\n${hole.x - r}\n20\n${hole.y}\n11\n${hole.x + r}\n21\n${hole.y}\n`;
        dxf += `0\nLINE\n8\nHARDWARE_AXIS\n10\n${hole.x}\n20\n${hole.y - r}\n11\n${hole.x}\n21\n${hole.y + r}\n`;
      }
    });
  }

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
}

/**
 * Generates a combined multi-panel DXF layout of all panels in the BOM for rapid CAD inspection.
 */
export function exportAllPanelsDXF(bom: ManufacturingBOM): string {
  let dxf = `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nTABLES\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nENTITIES\n`;

  let cursorX = 0;
  let cursorY = 0;
  let rowMaxH = 0;

  bom.cutList.forEach((piece) => {
    const w = piece.lengthMm;
    const h = piece.widthMm;
    if (cursorX > 0 && cursorX + w > 6000) {
      cursorX = 0;
      cursorY += rowMaxH + 150;
      rowMaxH = 0;
    }

    dxf += `0\nLWPOLYLINE\n8\nPANEL_CONTOUR\n90\n4\n70\n1\n`;
    dxf += `10\n${cursorX}\n20\n${cursorY}\n`;
    dxf += `10\n${cursorX + w}\n20\n${cursorY}\n`;
    dxf += `10\n${cursorX + w}\n20\n${cursorY + h}\n`;
    dxf += `10\n${cursorX}\n20\n${cursorY + h}\n`;

    if (piece.holes) {
      piece.holes.forEach((hole) => {
        dxf += `0\nCIRCLE\n8\nDRILLING\n10\n${cursorX + hole.x}\n20\n${
          cursorY + hole.y
        }\n30\n0.0\n40\n${hole.diameter / 2}\n`;
      });
    }

    cursorX += w + 120;
    if (h > rowMaxH) rowMaxH = h;
  });

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
}
