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

export function generateAssemblyInstructions(project: DesignProject, bom: ManufacturingBOM): AssemblyStep[] {
  const steps: AssemblyStep[] = [];

  steps.push({
    stepNumber: 1,
    title: "Saha Hazırlığı ve Baza Montajı",
    description: "Zemin terazisini su terazisi ile kontrol ediniz. Baza ayaklarını alt tablanın altına vidalayınız ve yükseklik ayarını yapınız.",
    requiredParts: ["Baza Ön", "Baza Arka"],
    requiredHardware: ["HW_LEVELING_FEET"],
    safetyNotes: "Zemin eğimi 5mm'den fazlaysa ayak ayarını teraziye göre sabitleyiniz.",
  });

  steps.push({
    stepNumber: 2,
    title: "Gövde Karkas Kurulumu (Minifix & Kavela)",
    description: "Sol yan paneli alt tablaya 90° açıyla yerleştirip minifix millerini kavelalar ile birlikte sıkınız. Ardından ara dikmeleri ve üst tablayı kilitleyiniz.",
    requiredParts: ["Sol Yan Panel", "Sağ Yan Panel", "Alt Panel", "Üst Panel", "Ara Dikmeler"],
    requiredHardware: ["HW_MINIFIX_SET", "HW_DOWEL_8X35"],
    safetyNotes: "Minifix kamlarını aşırı tork ile sıkmayınız, 180° tam kilitlenme yeterlidir.",
  });

  steps.push({
    stepNumber: 3,
    title: "Arkalık Montajı",
    description: "Gövde köşegenlerini metre ile ölçerek tam gönyede olduğunu doğrulayınız. 8mm arkalık panelini oluk yuvalarına kaydırıp sabitleyiniz.",
    requiredParts: ["Arkalık Paneli"],
    requiredHardware: [],
    safetyNotes: "Köşegen farkı 2mm'yi geçmemelidir.",
  });

  steps.push({
    stepNumber: 4,
    title: "İç Donanım ve Ray Montajı",
    description: "Tandembox çekmece raylarını System 32 deliklerine vidalayınız. Raf pimlerini ve askı borusu flanşlarını yerleştiriniz.",
    requiredParts: ["Raflar", "Çekmece Kasaları"],
    requiredHardware: ["HW_BLUM_TANDEM_BOX", "HW_SHELF_PIN", "HW_HANGING_RAIL"],
  });

  steps.push({
    stepNumber: 5,
    title: "Kapak ve Klapa Montajı & İnce Ayar",
    description: "Blum 110° menteşeleri kapaklara takıp gövde tabanlarına klipsleyiniz. Kapaklar arası 2mm çevre çalışma boşluğunu 3D menteşe vidasından ayarlayınız.",
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
    "Kalinlik_mm",
    "Adet",
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
    p.thicknessMm,
    p.quantity,
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
 * Generates an AutoCAD compatible 2D DXF contour for a rectangular panel with drilling hole circles.
 */
export function generatePanelDXF(piece: CutPiece): string {
  const w = piece.lengthMm;
  const h = piece.widthMm;

  let dxf = `0\nSECTION\n2\nHEADER\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nTABLES\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nENTITIES\n`;

  // Draw panel perimeter rectangle (LWPOLYLINE)
  dxf += `0\nLWPOLYLINE\n8\nPANEL_CONTOUR\n90\n4\n70\n1\n`;
  dxf += `10\n0.0\n20\n0.0\n`;
  dxf += `10\n${w}\n20\n0.0\n`;
  dxf += `10\n${w}\n20\n${h}\n`;
  dxf += `10\n0.0\n20\n${h}\n`;

  // Draw drilling holes
  if (piece.holes) {
    piece.holes.forEach((hole) => {
      dxf += `0\nCIRCLE\n8\nDRILLING\n10\n${hole.x}\n20\n${hole.y}\n30\n0.0\n40\n${hole.diameter / 2}\n`;
    });
  }

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
}
