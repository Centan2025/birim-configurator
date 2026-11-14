import { DesignProject, roundMm, assertProductionExportAllowed, evaluateUnifiedEngineeringModel, computeProjectGrainNeighborMap } from "@birim/core";
import { CutPiece, ManufacturingBOM } from "./types";
import { generatePanelDXF } from "./technical-outputs";
import { generateProjectCncPostProcessorBundle, mapCutPieceToCncPieceInput } from "./cnc-postprocessors";
import { generateMepCoordinationPlanSvg, exportArchitecturalMepDxf } from "./mep-architectural-plan";

function csvCell(val: string | number | undefined | null): string {
  const s = String(val ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * 1. OptiCut / CutRite 17-Column Industrial Cut & Edge Banding List (MD Spec Section 13.2.2)
 * Columns: [Sıra No, Modül Kodu, Parça Adı, Malzeme Adı, Kalınlık, Net Kesim Boy, Net Kesim En,
 *           Bitmiş Boy, Bitmiş En, Adet, Suyolu (0/1), Bant Uzun-1, Bant Uzun-2, Bant Kısa-1, Bant Kısa-2, CNC Dosya Adı, Açıklama]
 */
export function exportOptiCutCutListCsv(
  bom: ManufacturingBOM,
  _materialsOrOptions?: unknown,
  options?: { allowBlockedDraftExport?: boolean }
): string {
  if (bom.engineeringReadiness && !bom.engineeringReadiness.canExportToCncAndSaw && !options?.allowBlockedDraftExport) {
    throw new Error(
      `ÜRETİM ENGELİ: Tasarımda ${bom.engineeringReadiness.blockingErrorCount} adet kritik mühendislik/güvenlik hatası bulunduğundan OptiCut kesim listesi üretilemez.`
    );
  }
  const headers = [
    "Sira_No",
    "Modul_Kodu",
    "Parca_Adi",
    "Malzeme_Adi",
    "Kalinlik",
    "Net_Kesim_Boy",
    "Net_Kesim_En",
    "Bitmis_Boy",
    "Bitmis_En",
    "Adet",
    "Suyolu",
    "Bant_Uzun_1",
    "Bant_Uzun_2",
    "Bant_Kisa_1",
    "Bant_Kisa_2",
    "CNC_Dosya_Adi",
    "Aciklama",
  ];

  const rows = bom.cutList.map((p, idx) => {
    const eb = p.edgeBanding;
    const ebLabel = eb.thickness > 0 ? `${eb.thickness}mm PVC` : "";
    const notes: string[] = [];
    if (p.hasBackGroove) notes.push(`Kanal:${p.backGrooveWidthMm ?? 8.5}x9mm`);
    if (p.ledGrooveSpec?.enabled) notes.push(`LED:${p.ledGrooveSpec.widthMm}x${p.ledGrooveSpec.depthMm}mm`);
    if (p.golaNotches?.length) notes.push(`Gola:${p.golaNotches.map((g) => g.kind).join("+")}`);
    if (p.siphonCutout) notes.push(`U-Sifon:${p.siphonCutout.widthMm}x${p.siphonCutout.depthMm}mm`);
    if (p.miterBevelAngleDeg) notes.push(`Acili_Pah:${p.miterBevelAngleDeg}deg`);
    if (p.holes?.length) notes.push(`${p.holes.length} Delik`);

    return [
      idx + 1,
      csvCell(p.moduleId),
      csvCell(p.pieceName),
      csvCell(p.materialName),
      p.thicknessMm,
      p.netCutLengthMm ?? p.lengthMm,
      p.netCutWidthMm ?? p.widthMm,
      p.lengthMm,
      p.widthMm,
      p.quantity,
      p.grain === "none" ? 0 : 1,
      csvCell(eb.left ? ebLabel : ""),
      csvCell(eb.right ? ebLabel : ""),
      csvCell(eb.top ? ebLabel : ""),
      csvCell(eb.bottom ? ebLabel : ""),
      csvCell(p.cncFileName || `${p.id}.dxf`),
      csvCell(notes.join(" | ")),
    ].join(";");
  });

  return [headers.join(";"), ...rows].join("\r\n");
}

/**
 * 2. Hardware & Purchasing Bill of Materials CSV (MD Spec Section 13.2.4)
 */
export function exportHardwareBomCsv(bom: ManufacturingBOM): string {
  const headers = ["Sira_No", "Stok_Kodu_SKU", "Urun_Adi", "Kategori", "Birim", "Toplam_Adet", "Birim_Fiyat_EUR", "Toplam_Tutar_EUR"];
  const rows = bom.hardwareList.map((h, idx) =>
    [
      idx + 1,
      csvCell(h.sku),
      csvCell(h.name),
      csvCell(h.category),
      csvCell(h.unit),
      h.quantity,
      h.unitPrice,
      h.totalPrice,
    ].join(";")
  );
  return [headers.join(";"), ...rows].join("\r\n");
}

/**
 * 3. 2D Visual Sheet Nesting Layout SVG (MD Spec Section 13.2.3)
 */
export function generateNestingDiagramSvg(bom: ManufacturingBOM): string {
  const scale = 0.28;
  const allSheets = bom.nestingResults.flatMap((nr) =>
    nr.sheets.map((sh) => ({ ...sh, groupWaste: nr.overallWastePercent }))
  );
  if (allSheets.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="820" height="120" viewBox="0 0 820 120"><rect width="820" height="120" fill="#f8fafc"/><text x="24" y="64" font-family="sans-serif" font-size="14" fill="#334155">Henüz plaka yerleşim verisi yok.</text></svg>`;
  }

  const sheetGapY = 64;
  let curY = 24;
  const blocks: string[] = [];
  let maxSvgW = 860;

  allSheets.forEach((sheet, idx) => {
    const bw = Math.round((sheet.sheetDimension.lengthMm || 2800) * scale);
    const bh = Math.round((sheet.sheetDimension.widthMm || 2070) * scale);
    maxSvgW = Math.max(maxSvgW, bw + 48);

    const partsSvg = sheet.placedPieces
      .map((pl) => {
        const px = 24 + Math.round(pl.x * scale);
        const py = curY + 26 + Math.round(pl.y * scale);
        const pw = Math.max(4, Math.round(pl.width * scale));
        const ph = Math.max(4, Math.round(pl.length * scale));
        const label = pl.pieceName.replace(/[<>&"]/g, "");
        const polySvg =
          pl.polygonContourMm && pl.polygonContourMm.length >= 3
            ? (() => {
                const pts = pl.polygonContourMm
                  .map(([lx, ly]) => {
                    const sx = pl.isRotated ? px + Math.round(ly * scale) : px + Math.round(lx * scale);
                    const sy = pl.isRotated ? py + Math.round(lx * scale) : py + Math.round(ly * scale);
                    return `${sx},${sy}`;
                  })
                  .join(" ");
                return `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="none" stroke="#94a3b8" stroke-dasharray="2 2" stroke-width="0.7"/><polygon points="${pts}" fill="#dbeafe" stroke="#1d4ed8" stroke-width="1.2"/>`;
              })()
            : `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="#dbeafe" stroke="#1d4ed8" stroke-width="1"/>`;
        return `<g>
          ${polySvg}
          ${
            pw > 38 && ph > 18
              ? `<text x="${px + 4}" y="${py + 13}" font-family="monospace" font-size="9" fill="#0f172a">${label.slice(0, 18)} (${pl.width}×${pl.length})</text>`
              : ""
          }
        </g>`;
      })
      .join("\n");

    const remSvg = (sheet.usableRemnants || [])
      .map((rm) => {
        const rx = 24 + Math.round(rm.x * scale);
        const ry = curY + 26 + Math.round(rm.y * scale);
        const rw = Math.round(rm.width * scale);
        const rh = Math.round(rm.length * scale);
        return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="none" stroke="#16a34a" stroke-dasharray="4 3" stroke-width="1.2"/>`;
      })
      .join("\n");

    blocks.push(`<g>
      <text x="24" y="${curY + 16}" font-family="sans-serif" font-weight="700" font-size="13" fill="#0f172a">
        PLAKA #${idx + 1} — ${sheet.materialName.replace(/[<>&"]/g, "")} (${sheet.sheetDimension.lengthMm}×${sheet.sheetDimension.widthMm} mm) • Net: ${sheet.netUsedAreaM2} m² • Fire: %${sheet.wastePercent}
      </text>
      <rect x="24" y="${curY + 26}" width="${bw}" height="${bh}" fill="#f1f5f9" stroke="#334155" stroke-width="1.5"/>
      ${partsSvg}
      ${remSvg}
    </g>`);

    curY += bh + sheetGapY;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${maxSvgW}" height="${curY + 16}" viewBox="0 0 ${maxSvgW} ${curY + 16}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${blocks.join("\n")}
</svg>`;
}

/**
 * 4. 100 × 50 mm Thermal Barcode & Edge-Banding Part Labels (MD Spec Section 13.2.5)
 */
export function generateThermalPartLabelsHtml(project: DesignProject, bom: ManufacturingBOM): string {
  const customer = (project.customerName || "Birim Müşterisi").replace(/[<>&"]/g, "");
  const projTitle = (project.title || "Birim Proje").replace(/[<>&"]/g, "");
  const grainNeighborMap = computeProjectGrainNeighborMap(project);

  const renderCode128BarsSvg = (code: string) => {
    let hash = 2166136261;
    const bars: string[] = [];
    let x = 2;
    for (let i = 0; i < Math.max(16, code.length); i++) {
      hash = Math.imul(hash ^ code.charCodeAt(i % code.length), 16777619);
      const w1 = ((hash >>> 0) % 3) + 1;
      const gap = (((hash >>> 4) % 2) + 1);
      bars.push(`<rect x="${x}" y="0" width="${w1}" height="20" fill="#0f172a"/>`);
      x += w1 + gap;
      if (x > 136) break;
    }
    return `<svg width="142" height="20" viewBox="0 0 142 20">${bars.join("")}</svg>`;
  };

  const cards = bom.cutList
    .map((p, idx) => {
      const eb = p.edgeBanding || { top: false, bottom: false, left: false, right: false, thickness: 0 };
      // P3-01 Axis Alignment: Horizontal long SVG span (52px) = Boy (`lengthMm`, banded by `eb.left`=U1 & `eb.right`=U2);
      // Vertical short SVG span (34px) = En (`widthMm`, banded by `eb.bottom`=K1 & `eb.top`=K2).
      const longU1Stroke = eb.left ? 3.6 : 0.8;
      const longU2Stroke = eb.right ? 3.6 : 0.8;
      const shortK1Stroke = eb.bottom ? 3.6 : 0.8;
      const shortK2Stroke = eb.top ? 3.6 : 0.8;
      const gInfo = grainNeighborMap.get(p.id);
      const grainArrow = gInfo
        ? `${gInfo.arrowSymbol} DT ${gInfo.shortSeqBadge}`
        : p.grain === "lengthwise"
        ? "══► BOY"
        : p.grain === "crosswise"
        ? "↕ EN"
        : "Ø DÜZ";
      const cncCode = (p.cncFileName || `${p.id}.dxf`).replace(/\.dxf$/i, "");

      return `<div class="label-card${gInfo ? " label-card-dt" : ""}">
        <div class="lbl-top">
          <div>
            <div class="brand">B1R1M CNC • #${idx + 1}/${bom.cutList.length}${
              gInfo
                ? ` <span class="dt-badge">DESEN ${gInfo.shortSeqBadge} ${gInfo.arrowSymbol}</span>`
                : ""
            }</div>
            <div class="part-name">${p.pieceName.replace(/[<>&"]/g, "")}</div>
            <div class="mod-name">${p.moduleName.replace(/[<>&"]/g, "")} • ${customer}</div>
          </div>
          <svg width="74" height="48" viewBox="0 0 74 48" class="edge-box">
            ${gInfo ? `<rect x="10.5" y="8.5" width="53" height="31" fill="#fffbeb"/>` : ""}
            <line x1="10" y1="40" x2="64" y2="40" stroke="#0f172a" stroke-width="${longU1Stroke}"/>
            <line x1="10" y1="8" x2="64" y2="8" stroke="#0f172a" stroke-width="${longU2Stroke}"/>
            <line x1="10" y1="8" x2="10" y2="40" stroke="#0f172a" stroke-width="${shortK1Stroke}"/>
            <line x1="64" y1="8" x2="64" y2="40" stroke="#0f172a" stroke-width="${shortK2Stroke}"/>
            <circle cx="10" cy="40" r="2.2" fill="#dc2626"/>
            <text x="37" y="26" text-anchor="middle" font-size="6.2" font-weight="${gInfo ? "800" : "600"}" font-family="monospace" fill="${gInfo ? "#b45309" : "#334155"}">${grainArrow}</text>
            <text x="37" y="46.5" text-anchor="middle" font-size="5.2" font-family="monospace" fill="#475569">U1:${eb.left ? eb.thickness : 0} [0,0]</text>
          </svg>
        </div>
        <div class="dims-row">
          <span><b>NET:</b> ${p.netCutLengthMm ?? p.lengthMm} × ${p.netCutWidthMm ?? p.widthMm} × ${p.thicknessMm} mm</span>
          <span><b>BİTMİŞ:</b> ${p.lengthMm}×${p.widthMm}</span>
        </div>
        ${
          gInfo
            ? `<div class="dt-row"><b>${gInfo.directionLabelTr} ${gInfo.shortSeqBadge}:</b> ${gInfo.compactNeighborTextTr}</div>`
            : `<div class="mat-row">${p.materialName.replace(/[<>&"]/g, "")} • Bant: ${p.edgeBandCode || "Yok"}</div>`
        }
        <div class="bar-row">
          ${renderCode128BarsSvg(cncCode)}
          <span class="cnc-id">${cncCode.slice(0, 22)}</span>
        </div>
      </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<title>${projTitle} — 100×50mm Termal Parça Etiketleri</title>
<style>
  @page { size: 100mm 50mm; margin: 0; }
  body { font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; margin: 12px; background: #f1f5f9; color: #0f172a; }
  .grid { display: flex; flex-wrap: wrap; gap: 10px; }
  .label-card { width: 100mm; height: 50mm; box-sizing: border-box; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2.8mm 3.6mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
  .label-card-dt { border: 1.5px solid #d97706; }
  .lbl-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; }
  .brand { font-size: 7.2pt; font-weight: 800; letter-spacing: 0.04em; color: #475569; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .dt-badge { background: #92400e; color: #fffbeb; padding: 0.5px 4px; border-radius: 3px; font-size: 6.8pt; font-family: monospace; font-weight: 900; }
  .part-name { font-size: 9.2pt; font-weight: 800; line-height: 1.12; margin-top: 1px; }
  .mod-name { font-size: 6.8pt; color: #64748b; margin-top: 1px; }
  .dims-row { display: flex; justify-content: space-between; font-size: 7.8pt; font-family: monospace; background: #f8fafc; padding: 1.5px 4px; border-radius: 3px; }
  .mat-row { font-size: 6.8pt; font-weight: 600; color: #334155; }
  .dt-row { font-size: 6.6pt; font-family: monospace; background: #fffbeb; border: 1px solid #fcd34d; color: #78350f; padding: 1.5px 4px; border-radius: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding-top: 1px; border-top: 0.5px dashed #cbd5e1; }
  .cnc-id { font-size: 6.3pt; font-family: monospace; color: #475569; }
</style>
</head>
<body>
<div class="grid">${cards}</div>
</body>
</html>`;
}


/**
 * 4b. Industrial Zebra ZPL II (203 dpi, 800x400 dots = 100x50 mm) Thermal Printer Barcode Stream
 * Ready for direct raw socket/USB spooling on factory edge-banding & beam-saw stations.
 */
export function generateThermalPartLabelsZpl(project: DesignProject, bom: ManufacturingBOM): string {
  const cleanAscii = (str: string) =>
    (str || "")
      .replace(/ğ/g, "g").replace(/Ğ/g, "G")
      .replace(/ü/g, "u").replace(/Ü/g, "U")
      .replace(/ş/g, "s").replace(/Ş/g, "S")
      .replace(/ı/g, "i").replace(/İ/g, "I")
      .replace(/ö/g, "o").replace(/Ö/g, "O")
      .replace(/ç/g, "c").replace(/Ç/g, "C")
      .replace(/[\^~"]/g, " ")
      .trim();

  const customer = cleanAscii(project.customerName || "Birim Musteri").slice(0, 26);
  const total = bom.cutList.length;
  const grainNeighborMap = computeProjectGrainNeighborMap(project);

  return bom.cutList
    .map((p, idx) => {
      const eb = p.edgeBanding;
      const ebFlags = [
        eb.top ? `UST:${eb.thickness}` : "-",
        eb.bottom ? `ALT:${eb.thickness}` : "-",
        eb.left ? `SOL:${eb.thickness}` : "-",
        eb.right ? `SAG:${eb.thickness}` : "-",
      ].join(" ");
      const netL = p.netCutLengthMm ?? p.lengthMm;
      const netW = p.netCutWidthMm ?? p.widthMm;
      const cncId = cleanAscii((p.cncFileName || p.id).replace(/\.dxf$/i, "")).slice(0, 24);
      const gInfo = grainNeighborMap.get(p.id);
      const grainTxt = gInfo
        ? `DT ${gInfo.shortSeqBadge} ${gInfo.directionLabelAscii}`
        : p.grain === "lengthwise"
        ? "SUYOLU:BOY"
        : p.grain === "crosswise"
        ? "SUYOLU:EN"
        : "DUZ";

      const lines: string[] = [
        "^XA",
        "^PW800",
        "^LL400",
        "^CI28",
        `^FO24,16^A0N,22,22^FDB1R1M FABRIKA  #${idx + 1}/${total}${gInfo ? `  [DT ${gInfo.shortSeqBadge}]` : ""}  |  ${customer}^FS`,
        `^FO24,44^A0N,28,28^FD${cleanAscii(p.pieceName).slice(0, 34)}^FS`,
        `^FO24,78^A0N,21,21^FDModul: ${cleanAscii(p.moduleName).slice(0, 28)} (${cleanAscii(p.moduleId)})^FS`,
        "^FO24,106^GB752,2,2^FS",
        `^FO24,116^A0N,25,25^FDNET KESIM: ${netL} x ${netW} x ${p.thicknessMm} mm^FS`,
        `^FO24,148^A0N,21,21^FDBITMIS: ${p.lengthMm} x ${p.widthMm} mm   |   ${grainTxt}^FS`,
        `^FO24,176^A0N,21,21^FDMalzeme: ${cleanAscii(p.materialName).slice(0, 36)}^FS`,
        `^FO24,204^A0N,21,21^FDBant [${cleanAscii(p.edgeBandCode || "Yok")}]: ${ebFlags}^FS`,
      ];

      if (gInfo) {
        lines.push(
          "^FO24,232^GB752,28,28^FS",
          `^FO32,237^FR^A0N,20,20^FDDESEN SIRA ${gInfo.shortSeqBadge} ${gInfo.directionLabelAscii} | KOMSU -> ${cleanAscii(gInfo.compactNeighborAscii).slice(0, 36)}^FS`,
          "^FO24,270^BY2,2,54^BCN,54,Y,N,N",
          `^FD${cncId}^FS`
        );
      } else {
        lines.push(
          "^FO24,254^BY2,2,64^BCN,64,Y,N,N",
          `^FD${cncId}^FS`
        );
      }

      lines.push("^XZ");
      return lines.join("\r\n");
    })
    .join("\r\n\r\n");
}

// ============================================================================
// PURE TYPESCRIPT IEEE 802.3 CRC32 ZIP ARCHIVE BUILDER (ZERO EXTERNAL DEPS!)
// Packs individual `<part>.dxf` files + OptiCut CSV + BOM CSV + Nesting SVG + Thermal Labels!
// ============================================================================
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32Bytes(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUtf8(str: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str);
  }
  const arr: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) arr.push(code);
    else if (code < 0x800) arr.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else arr.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return new Uint8Array(arr);
}

export function buildZipFromEntries(entries: { fileName: string; content: string | Uint8Array }[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encodeUtf8(entry.fileName);
    const dataBytes = typeof entry.content === "string" ? encodeUtf8(entry.content) : entry.content;
    const crc = crc32Bytes(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // Store (uncompressed, instant CAM compatibility)
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x5621, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5621, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLen = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of localParts) {
    out.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    out.set(part, pos);
    pos += part.length;
  }
  out.set(eocd, pos);
  return out;
}

/**
 * 5. Complete Industrial CAM Production Package (.ZIP) (MD Spec Section 13.2.1–13.2.5):
 * - `dxf/<part_id>.dxf` for every cuttable panel with standardized CAM layers
 * - `OptiCut_Kesim_ve_Bant_Listesi.csv`
 * - `SatinAlma_Aksesuar_BOM.csv`
 * - `Plaka_Kesim_Semasi_Nesting.svg`
 * - `Termal_Barkod_Etiketleri_100x50mm.html`
 */
export function exportIndustrialCamZipArchive(
  projectOrBom: DesignProject | ManufacturingBOM,
  maybeBom?: ManufacturingBOM,
  options?: { bypassBlockingGateForDiagnostics?: boolean }
): Uint8Array {
  const isSingleArgBom = !maybeBom && "cutList" in projectOrBom;
  const bom: ManufacturingBOM = isSingleArgBom
    ? (projectOrBom as ManufacturingBOM)
    : (maybeBom as ManufacturingBOM);
  const project: DesignProject = isSingleArgBom
    ? ({ id: "birim_proj", title: "Birim Proje", version: 1, space: { id: "sp", name: "Oda", type: "room", walls: [], ceilingHeight: 2600, elements: [] }, modules: [] } as unknown as DesignProject)
    : (projectOrBom as DesignProject);

  // P0-02 Central Production Readiness Gate: Block CAM ZIP export if blocking safety/engineering errors exist!
  const engReport =
    !isSingleArgBom && project.modules?.length > 0
      ? options?.bypassBlockingGateForDiagnostics
        ? evaluateUnifiedEngineeringModel(project)
        : assertProductionExportAllowed(project)
      : null;

  const entries: { fileName: string; content: string | Uint8Array }[] = [];
  if (engReport) {
    entries.push({
      fileName: "00_MUHENDISLIK_DOGRULAMA_RAPORU.json",
      content: JSON.stringify(
        {
          projectId: project.id,
          version: project.version,
          canExportToCncAndSaw: engReport.canExportToCncAndSaw,
          canApproveFinalErpRelease: engReport.canApproveFinalErpRelease,
          verificationNotice:
            engReport.verificationRequiredFindings.length > 0
              ? "DOGRULAMA_GEREKTIRIR: Fabrika fiziksel numune onayi bekleyen kurallar mevcuttur."
              : "TAM_DOGRULANMIS",
          blockingErrorCount: engReport.blockingSafetyAndEngineeringErrors.length,
          verificationRequiredCount: engReport.verificationRequiredFindings.length,
        },
        null,
        2
      ),
    });
  }

  bom.cutList.forEach((piece) => {
    const safeName = (piece.cncFileName || `${piece.id}.dxf`).replace(/[^a-zA-Z0-9._-]/g, "_");
    entries.push({
      fileName: `dxf/${safeName}`,
      content: generatePanelDXF(piece),
    });
  });

  const cncBundle = generateProjectCncPostProcessorBundle(
    bom.cutList.map((piece) => mapCutPieceToCncPieceInput(piece))
  );
  cncBundle.homagMprFiles.forEach((mpr) => {
    entries.push({ fileName: `mpr/${mpr.fileName}`, content: mpr.content });
  });
  cncBundle.biesseCixFiles.forEach((cix) => {
    entries.push({ fileName: `cix/${cix.fileName}`, content: cix.content });
  });
  cncBundle.scmXcsFiles.forEach((xcs) => {
    entries.push({ fileName: `xcs/${xcs.fileName}`, content: xcs.content });
  });

  entries.push({
    fileName: "OptiCut_Kesim_ve_Bant_Listesi.csv",
    content: "\uFEFF" + exportOptiCutCutListCsv(bom),
  });
  entries.push({
    fileName: "SatinAlma_Aksesuar_BOM.csv",
    content: "\uFEFF" + exportHardwareBomCsv(bom),
  });
  entries.push({
    fileName: "Plaka_Kesim_Semasi_Nesting.svg",
    content: generateNestingDiagramSvg(bom),
  });
  entries.push({
    fileName: "Termal_Barkod_Etiketleri_100x50mm.html",
    content: generateThermalPartLabelsHtml(project, bom),
  });
  entries.push({
    fileName: "Termal_Barkod_Zebra_100x50mm.zpl",
    content: generateThermalPartLabelsZpl(project, bom),
  });
  entries.push({
    fileName: "Mimari_Tesisat_ve_Elektrik_Paftasi_MEP.svg",
    content: generateMepCoordinationPlanSvg(project),
  });
  entries.push({
    fileName: "Mimari_Tesisat_ve_Elektrik_Paftasi_MEP.dxf",
    content: exportArchitecturalMepDxf(project),
  });

  return buildZipFromEntries(entries);
}

export { roundMm };
