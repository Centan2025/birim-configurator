import { ManufacturingBOM, CutPiece } from "./types";
import {
  DesignProject,
  ModuleInstance,
  calculateFourSpaceDimensions,
  calculateNetInnerHeight,
  computeProjectGrainNeighborMap,
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
  safetyWarning?: string;
}

export function generateAssemblyInstructions(
  project: DesignProject,
  bom: ManufacturingBOM
): AssemblyStep[] {
  const ceilingH = project.space?.ceilingHeight || 2600;
  const steps: AssemblyStep[] = [];
  let stepNo = 1;

  // Check tilt-up diagonal clearance √(H² + D²) vs room ceiling height!
  const requiresUprightAssemblyMods = project.modules.filter((m) => {
    if (m.category === "complementary" || m.category === "kitchen_wall") return false;
    const diagMm = Math.hypot(m.dimensions.height, m.dimensions.depth);
    return diagMm + 25 > ceilingH;
  });

  const plinthParts = bom.cutList
    .filter((p) => p.componentRole === "plinth")
    .slice(0, 4)
    .map((p) => p.pieceName);
  steps.push({
    stepNumber: stepNo++,
    title: "Saha Röleve, Tesisat Ekseni ve Baza Terazisi",
    description:
      "Lazer terazi ile zemin eğimini ve arka duvar gönyesini kontrol ediniz. Baza kutusunu veya ayarlı ayakları teraziye alıp tesisat/priz noktalarının açıkta kaldığını doğrulayınız.",
    requiredParts: plinthParts.length > 0 ? plinthParts : ["Baza Ön", "Baza Yan Dönüşler"],
    requiredHardware: bom.hardwareList
      .filter((h) => h.category === "leg")
      .map((h) => h.sku)
      .slice(0, 3),
    safetyNotes:
      requiresUprightAssemblyMods.length > 0
        ? `DİKKAT (Tavan Kaldırma Engeli): ${requiresUprightAssemblyMods
            .map((m) => `"${m.name}" (√(H²+D²)=${Math.round(Math.hypot(m.dimensions.height, m.dimensions.depth))}mm > Tavan ${ceilingH}mm)`)
            .join(", ")} yerde toplanıp ayağa kaldırılamaz! Gövdeyi nihai konumunda DİK OLARAK kurunuz.`
        : "Zemin eğimi 5mm'den fazlaysa terazi ayaklarını yük aktarım dikmelerinin tam altında sabitleyiniz.",
  });

  const carcassParts = bom.cutList
    .filter((p) => p.componentRole.startsWith("carcass_") && p.componentRole !== "carcass_back")
    .slice(0, 6)
    .map((p) => p.pieceName);
  const hasMiter45 = project.modules.some((m) => m.carcass.carcassJoineryTopology === "miter_45");
  steps.push({
    stepNumber: stepNo++,
    title: hasMiter45
      ? "45° Gönye Karkas Kurulumu ve Köşe Birleştirme"
      : "Gövde Karkas Kurulumu (System 32 Eş-Eksenli Minifix & Kavela)",
    description: hasMiter45
      ? "45° pahlı gövde panellerini koruyucu bant üzerinde hizalayıp gönye bağlantı elemanlarını kilitleyiniz."
      : "Yan dikmeleri ve ara bölmeleri alt tablaya eş-eksenli kavela + minifix milleriyle birleştirip üst tabla/kayıtları 180° kilitleyiniz.",
    requiredParts:
      carcassParts.length > 0
        ? carcassParts
        : ["Sol Yan Panel", "Sağ Yan Panel", "Alt Panel", "Üst Panel"],
    requiredHardware: bom.hardwareList
      .filter((h) => h.category === "connector")
      .map((h) => h.sku),
    safetyNotes: "Minifix eksantrik kamlarını darbeli matkapla değil el torkuyla (max 180°) kilitleyiniz.",
  });

  const backParts = bom.cutList
    .filter((p) => p.componentRole === "carcass_back")
    .slice(0, 3)
    .map((p) => p.pieceName);
  if (backParts.length > 0) {
    steps.push({
      stepNumber: stepNo++,
      title: "Köşegen Gönye Doğrulaması ve Arkalık Montajı",
      description:
        "Sol-üst/sağ-alt ile sağ-üst/sol-alt köşegen ölçü farkının ≤ 1.5mm olduğunu doğruladıktan sonra arkalık panellerini 8.5mm oluk kanallarına sürünüz.",
      requiredParts: backParts,
      requiredHardware: [],
      safetyNotes: "Ankastre fırın/buzdolabı boy kulelerinde arka 50mm baca hava kanalını kesinlikle kapatmayınız.",
    });
  }

  // Inter-module M4 alignment & EN 14749 Wall Restraint Step!
  const hasWallHangerOrAntiTip = bom.hardwareList.some(
    (h) => h.sku.includes("EN14749") || h.sku.includes("ANTI_TIP") || h.sku.includes("CABINET_CONN_M4")
  );
  if (hasWallHangerOrAntiTip || project.modules.length > 1) {
    steps.push({
      stepNumber: stepNo++,
      title: "Modüller Arası Gövde Birleştirme ve EN 14749 Duvar Sabitleme",
      description:
        "Yan yana gelen modülleri ön cumbalardan işkenceyle sıfırlayıp Sistem 32 Ø5 deliklerinden M4×34mm kovanlı cıvatalarla birbirine bağlayınız. Üst dolapları ve devrilme riski taşıyan yüksek üniteleri duvar taşıyıcı cinsine uygun dübellerle duvara sabitleyiniz.",
      requiredParts: [],
      requiredHardware: bom.hardwareList
        .filter(
          (h) =>
            h.sku.includes("EN14749") ||
            h.sku.includes("ANTI_TIP") ||
            h.sku.includes("CABINET_CONN_M4") ||
            h.sku.includes("VENT_GRILLE")
        )
        .map((h) => h.sku),
      safetyNotes:
        "ZORUNLU GÜVENLİK (EN 14749): Duvar sabitlemesi tamamlanmadan çekmeceleri ve kapakları aynı anda açmayınız!",
    });
  }

  const grainNeighborMap = computeProjectGrainNeighborMap(project);
  const uniqueGrainParts = Array.from(
    new Map(
      Array.from(grainNeighborMap.values()).map((info) => [
        `${info.moduleId}:${info.componentId}`,
        info,
      ])
    ).values()
  ).sort(
    (a, b) =>
      a.grainGroupId.localeCompare(b.grainGroupId) || a.sequenceIndex - b.sequenceIndex
  );

  const grainSequenceSummary =
    uniqueGrainParts.length > 0
      ? ` DESEN TAKİBİ MONTAJ DİZİLİMİ: Termal parça etiketlerindeki [Sıra/Toplam] ve suyolu yön oklarına uyarak monte ediniz -> ${uniqueGrainParts
          .map(
            (g) =>
              `${g.shortSeqBadge} ${g.partShortLabel} (${g.arrowSymbol} ${g.compactNeighborTextTr})`
          )
          .join(" | ")}.`
      : "";

  const grainSafetyWarning =
    uniqueGrainParts.length > 0
      ? `DESEN TAKİBİ UYARISI: Eşit ölçülü alt/üst çekmece klapalarını veya sağ/sol kapakları birbirleriyle değiştirmeyiniz! Parça arkasındaki 100×50mm termal barkod etiketinde yer alan ${uniqueGrainParts[0].shortSeqBadge}..[${uniqueGrainParts[uniqueGrainParts.length - 1].totalInGroup}/${uniqueGrainParts[uniqueGrainParts.length - 1].totalInGroup}] sıra numarasını ve damar yönü okunu (${uniqueGrainParts[0].arrowSymbol}) doğrulayarak takınız.`
      : undefined;

  steps.push({
    stepNumber: stepNo++,
    title: "İç Donanım, Ray, Havalandırma Menfezi ve Kapak 3B Ayarı",
    description:
      "Çekmece raylarını ve menteşe tabanlarını Sistem 32 deliklerine monte ediniz. Ankastre cihaz bazalarına 200 cm² havalandırma menfezini takıp kapak 2mm çevre fugalarını 3B ayar vidalarıyla dengeleyiniz." +
      grainSequenceSummary,
    requiredParts: bom.cutList
      .filter((p) => p.componentRole.includes("door") || p.componentRole === "drawer_front" || p.componentRole === "shelf")
      .slice(0, 6)
      .map((p) => p.pieceName),
    requiredHardware: bom.hardwareList
      .filter((h) => h.category === "hinge" || h.category === "slide" || h.category === "handle")
      .map((h) => h.sku)
      .slice(0, 6),
    safetyNotes: grainSafetyWarning,
    safetyWarning: grainSafetyWarning,
  });

  return steps;
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

  const preMill = piece.preMillingMm ?? 0;
  const effEbDeduct = ebT - preMill;
  const insetLeft = eb?.left ? effEbDeduct : 0;
  const insetBottom = eb?.bottom ? effEbDeduct : 0;
  const outlineLayer = `OUTLINE_T${Math.round(piece.thicknessMm || 18)}`;

  // 1 & 1b. True Closed Polygon Contour (sloped ceiling trapezoid / capsule stadium) vs Standard Rectangular Panel
  if (piece.polygonContourMm && piece.polygonContourMm.length >= 3) {
    const shiftedPoly: [number, number][] = piece.polygonContourMm.map(([px, py]) => [
      roundMm(offsetX + px, 2),
      roundMm(offsetY + py, 2),
    ]);
    writer.addPolyline("PANEL_CONTOUR", shiftedPoly, true);
    writer.addPolyline(outlineLayer, shiftedPoly, true);
  } else {
    writer.addRect("PANEL_CONTOUR", offsetX, offsetY, w, h);
    writer.addRect(
      outlineLayer,
      roundMm(offsetX + insetLeft, 2),
      roundMm(offsetY + insetBottom, 2),
      netW,
      netH
    );
  }

  // 2. Saw net-cut perimeter properly inset/outset by signed edge-banding minus pre-milling (NET_CUT_CONTOUR)
  if (netW !== w || netH !== h) {
    writer.addRect(
      "NET_CUT_CONTOUR",
      roundMm(offsetX + insetLeft, 2),
      roundMm(offsetY + insetBottom, 2),
      netW,
      netH
    );
  }

  // 2a-miter. Angled attached table / 45° scarf joint bevel vector (`MITER_BEVEL_JOINT`)
  if (piece.miterBevelAngleDeg) {
    const bevelInset = Math.min(
      w * 0.45,
      Math.round(Math.abs(Math.tan((piece.miterBevelAngleDeg * Math.PI) / 180)) * piece.thicknessMm)
    );
    writer.addLine("MITER_BEVEL_JOINT", offsetX, offsetY + Math.max(8, bevelInset), offsetX + w, offsetY);
  }

  // 2b. Gola L/C Notches on front edge (`NOTCH_GOLA_L` / `NOTCH_GOLA_C`)
  if (piece.golaNotches && piece.golaNotches.length > 0) {
    for (const gn of piece.golaNotches) {
      const gx = piece.mirrorInnerFaceX
        ? roundMm(offsetX + w - gn.widthMm, 2)
        : offsetX;
      writer.addRect(
        gn.kind === "L_TOP" ? "NOTCH_GOLA_L" : "NOTCH_GOLA_C",
        gx,
        roundMm(offsetY + gn.yBottomMm, 2),
        gn.widthMm,
        gn.heightMm
      );
    }
  }

  // 2c. Under-Sink Drawer U-Shaped Siphon Cutout (`CUTOUT_SIPHON_U`)
  if (piece.siphonCutout) {
    const sw = Math.min(w - 40, piece.siphonCutout.widthMm);
    const sd = Math.min(h - 40, piece.siphonCutout.depthMm);
    if (sw > 40 && sd > 40) {
      writer.addRect(
        "CUTOUT_SIPHON_U",
        roundMm(offsetX + (w - sw) / 2, 2),
        roundMm(offsetY + h - sd, 2),
        sw,
        sd
      );
    }
  }

  const hasExplicitSinkHobCutouts = Boolean(
    piece.utilityCutouts?.some((c) => c.id.startsWith("cutout_sink_") || c.id.startsWith("cutout_hob_"))
  );

  // 3. Explicit CNC Sink / Cooktop Cut-out fallback when no per-module coordinate cutouts exist
  if (piece.componentRole === "countertop" && piece.hasSinkOrHobCutout && !hasExplicitSinkHobCutouts) {
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

  // 3b. Parametric Socket / Cable Grommet / Plumbing / Baseboard Notch / Multi-Sink-Hob Cutouts
  if (piece.utilityCutouts && piece.utilityCutouts.length > 0) {
    for (const co of piece.utilityCutouts) {
      const isSinkOrHob = co.id.startsWith("cutout_sink_") || co.id.startsWith("cutout_hob_");
      const layerName = isSinkOrHob
        ? "CUTOUT_SINK_HOB"
        : co.shape === "corner_notch"
        ? "NOTCH_BASEBOARD"
        : "CUTOUT_UTILITY";
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
    const grooveW = piece.backGrooveWidthMm ?? 8.5;
    const grooveOffset = piece.backGrooveOffsetMm ?? 20;
    const grooveX = piece.mirrorInnerFaceX
      ? Math.max(8, grooveOffset - grooveW)
      : Math.max(12, w - grooveOffset);
    writer.addRect("BACK_GROOVE_8MM", offsetX + grooveX, offsetY, grooveW, h);
    writer.addRect(`GROOVE_W${grooveW}_Z10`, offsetX + grooveX, offsetY, grooveW, h);
  }

  // 4a-bis. Rebated Back Panel Step Milling (`REBATE_BACK_8MM`) along rear inner edge
  if (
    piece.backPanelMode === "rebated" &&
    w >= 100 &&
    (piece.componentRole === "carcass_side_left" ||
      piece.componentRole === "carcass_side_right" ||
      piece.componentRole === "carcass_top" ||
      piece.componentRole === "carcass_bottom")
  ) {
    const rebateW = 10;
    const rx = piece.mirrorInnerFaceX ? 0 : w - rebateW;
    writer.addRect("REBATE_BACK_8MM", offsetX + rx, offsetY, rebateW, h);
  }

  // 4a-ter. Wooden Drawer 8mm Bottom Groove (`DRAWER_BOTTOM_GROOVE_8MM` & `GROOVE_W8.5_Z6`, 13mm from bottom edge!)
  if (piece.hasDrawerBottomGroove && w >= 55 && h >= 120) {
    const dgw = piece.drawerBottomGrooveWidthMm ?? 8.5;
    const dgd = piece.drawerBottomGrooveDepthMm ?? 6;
    const dgo = piece.drawerBottomGrooveOffsetMm ?? 13;
    const dgx = Math.min(w - dgw - 4, dgo);
    writer.addRect("DRAWER_BOTTOM_GROOVE_8MM", roundMm(offsetX + dgx, 2), offsetY, dgw, h);
    writer.addRect(`GROOVE_W${dgw}_Z${dgd}`, roundMm(offsetX + dgx, 2), offsetY, dgw, h);
  }

  // 4a-quater. Wall Cabinet Grooved Back Panel Top-Corner Hanger Cutouts (`NOTCH_WALL_HANGER`, 45x65mm)
  if (piece.wallHangerCornerNotches && w >= 200 && h >= 200) {
    const nw = piece.wallHangerCornerNotches.widthMm;
    const nh = piece.wallHangerCornerNotches.heightMm;
    // In carcass_back local coords: `h` = vertical height (Y: 0..h), `w` = horizontal width (X: 0..w)
    writer.addRect("NOTCH_WALL_HANGER", offsetX, roundMm(offsetY + h - nh, 2), nw, nh);
    writer.addRect("NOTCH_WALL_HANGER", roundMm(offsetX + w - nw, 2), roundMm(offsetY + h - nh, 2), nw, nh);
  }

  // 4a-quinquies. 45-Degree Miter Carcass Bevel Contour (`MITER_45_BEVEL`)
  if (
    piece.carcassJoineryTopology === "miter_45" &&
    (piece.componentRole === "carcass_side_left" ||
      piece.componentRole === "carcass_side_right" ||
      piece.componentRole === "carcass_top" ||
      piece.componentRole === "carcass_bottom")
  ) {
    writer.addRect("MITER_45_BEVEL", offsetX, offsetY, w, h);
  }

  // 4b. Recessed LED Profile CNC Groove (`GROOVE_W12_Z8`)
  if (piece.ledGrooveSpec?.enabled) {
    const lw = piece.ledGrooveSpec.widthMm || 12;
    const ld = piece.ledGrooveSpec.depthMm || 8;
    const lOff = piece.ledGrooveSpec.offsetFromFrontMm || 75;
    const lx = piece.mirrorInnerFaceX
      ? Math.max(8, w - lOff - lw / 2)
      : Math.min(w - lw - 8, lOff - lw / 2);
    writer.addRect(`GROOVE_W${lw}_Z${ld}`, roundMm(offsetX + lx, 2), offsetY, lw, h);
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
        const boreLen = Math.min(hole.depth || 34, Math.min(w, h) * 0.4);
        let x2 = hx;
        let y2 = hy;
        let sideCode = "LEFT";
        if (hole.direction === "edge_bottom") {
          y2 = roundMm(hy + boreLen, 2);
          sideCode = "LEFT";
        } else if (hole.direction === "edge_top") {
          y2 = roundMm(hy - boreLen, 2);
          sideCode = "RIGHT";
        } else if (hole.direction === "edge_left") {
          x2 = roundMm(hx + boreLen, 2);
          sideCode = "LEFT";
        } else if (hole.direction === "edge_right") {
          x2 = roundMm(hx - boreLen, 2);
          sideCode = "RIGHT";
        }
        const dInt = Math.round(hole.diameter || 8);
        const zInt = Math.round(hole.depth || 34);
        writer.addLine(`DRILL_H_${sideCode}_D${dInt}_Z${zInt}`, hx, hy, x2, y2);
        writer.addLine("EDGE_DRILL_8MM", hx, hy, x2, y2);
        return;
      }

      const isBackFace = hole.direction === "face_back";
      const dCode = Math.round(hole.diameter);
      const zCode = Math.round(hole.depth || 12);
      const camLayer = isBackFace
        ? `BACK_FACE_DRILL_V_D${dCode}_Z${zCode}`
        : `DRILL_V_D${dCode}_Z${zCode}`;
      writer.addCircle(camLayer, hx, hy, rad);

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

      const cutPieceById = new Map<string, CutPiece>(bom.cutList.map((cp) => [cp.id, cp]));
      sheet.placedPieces.forEach((placed) => {
        const px = placed.x;
        const py = sheetCursorY + placed.y;
        const pw = placed.width;   // X extent along 2800mm board length
        const pl = placed.length;  // Y extent along 2070mm board width
        const src = cutPieceById.get(placed.pieceId);
        const outlineLayer = `OUTLINE_T${Math.round(src?.thicknessMm || 18)}`;

        writer.addRect("NET_CUT_CONTOUR", px, py, pw, pl);
        writer.addRect(outlineLayer, px, py, pw, pl);

        // P1-04: Transform part-local raw coordinates (xRaw in 0..netW, yRaw in 0..netL) onto the nested sheet!
        // When unrotated (`!placed.isRotated`): pw == netCutLengthMm (yRaw -> sheet X), pl == netCutWidthMm (xRaw -> sheet Y)
        // When rotated (`placed.isRotated`): pw == netCutWidthMm (xRaw -> sheet X), pl == netCutLengthMm (yRaw -> sheet Y)
        if (src) {
          const netW = src.netCutWidthMm ?? src.widthMm;
          const netL = src.netCutLengthMm ?? src.lengthMm;
          const rawOffX = src.rawOriginOffsetXMm ?? 0;
          const rawOffY = src.rawOriginOffsetYMm ?? 0;
          const axesNormal = Math.abs(pw - netL) <= Math.abs(pw - netW);

          const mapLocalPointToSheet = (localFinishedX: number, localFinishedY: number): [number, number] => {
            const xRaw = Math.max(0, Math.min(netW, localFinishedX - rawOffX));
            const yRaw = Math.max(0, Math.min(netL, localFinishedY - rawOffY));
            if (axesNormal) {
              return [roundMm(px + yRaw, 2), roundMm(py + xRaw, 2)];
            }
            return [roundMm(px + xRaw, 2), roundMm(py + (netL - yRaw), 2)];
          };

          const mapLocalRectToSheet = (
            layer: string,
            rx0: number,
            ry0: number,
            rw: number,
            rh: number
          ) => {
            const [sx1, sy1] = mapLocalPointToSheet(rx0, ry0);
            const [sx2, sy2] = mapLocalPointToSheet(rx0 + rw, ry0 + rh);
            const minSX = Math.min(sx1, sx2);
            const minSY = Math.min(sy1, sy2);
            const spanSX = Math.max(0.5, Math.abs(sx2 - sx1));
            const spanSY = Math.max(0.5, Math.abs(sy2 - sy1));
            writer.addRect(layer, minSX, minSY, spanSX, spanSY);
          };

          // 1. Non-rectangular sloped/stadium contour inside nested bounding box
          if (src.polygonContourMm && src.polygonContourMm.length >= 3) {
            const nestedPoly = src.polygonContourMm.map(([lx, ly]) => mapLocalPointToSheet(lx, ly));
            writer.addPolyline(outlineLayer, nestedPoly, true);
          }

          // 2. 8.5mm Back Groove (`BACK_GROOVE_8MM` & `GROOVE_W8.5_Z10`)
          const grooveActive =
            src.hasBackGroove !== undefined
              ? src.hasBackGroove
              : src.componentRole === "carcass_side_left" ||
                src.componentRole === "carcass_side_right" ||
                src.componentRole === "carcass_top" ||
                src.componentRole === "carcass_bottom";
          if (grooveActive && src.widthMm >= 100) {
            const gw = src.backGrooveWidthMm ?? 8.5;
            const gOff = src.backGrooveOffsetMm ?? 20;
            const gx = src.mirrorInnerFaceX ? Math.max(8, gOff - gw) : Math.max(12, src.widthMm - gOff);
            mapLocalRectToSheet("BACK_GROOVE_8MM", gx, 0, gw, src.lengthMm);
            mapLocalRectToSheet(`GROOVE_W${gw}_Z10`, gx, 0, gw, src.lengthMm);
          }

          // 3. Wooden Drawer Bottom Groove (`DRAWER_BOTTOM_GROOVE_8MM`)
          if (src.hasDrawerBottomGroove && src.widthMm >= 55) {
            const dgw = src.drawerBottomGrooveWidthMm ?? 8.5;
            const dgd = src.drawerBottomGrooveDepthMm ?? 6;
            const dgo = src.drawerBottomGrooveOffsetMm ?? 13;
            mapLocalRectToSheet(`GROOVE_W${dgw}_Z${dgd}`, Math.min(src.widthMm - dgw - 4, dgo), 0, dgw, src.lengthMm);
          }

          // 4. Gola L/C Notches & Under-Sink Siphon U-Cutout
          src.golaNotches?.forEach((gn) => {
            const gx = src.mirrorInnerFaceX ? src.widthMm - gn.widthMm : 0;
            mapLocalRectToSheet(
              gn.kind === "L_TOP" ? "NOTCH_GOLA_L" : "NOTCH_GOLA_C",
              gx,
              gn.yBottomMm,
              gn.widthMm,
              gn.heightMm
            );
          });
          if (src.siphonCutout) {
            const sw = Math.min(src.widthMm - 40, src.siphonCutout.widthMm);
            const sd = Math.min(src.lengthMm - 40, src.siphonCutout.depthMm);
            if (sw > 40 && sd > 40) {
              mapLocalRectToSheet("CUTOUT_SIPHON_U", (src.widthMm - sw) / 2, src.lengthMm - sd, sw, sd);
            }
          }
          if (src.ledGrooveSpec?.enabled) {
            const lw = src.ledGrooveSpec.widthMm || 12;
            const ld = src.ledGrooveSpec.depthMm || 8;
            const lOff = src.ledGrooveSpec.offsetFromFrontMm || 75;
            const lx = src.mirrorInnerFaceX
              ? Math.max(8, src.widthMm - lOff - lw / 2)
              : Math.min(src.widthMm - lw - 8, lOff - lw / 2);
            mapLocalRectToSheet(`GROOVE_W${lw}_Z${ld}`, lx, 0, lw, src.lengthMm);
          }
          if (src.wallHangerCornerNotches && src.widthMm >= 200 && src.lengthMm >= 200) {
            const nw = src.wallHangerCornerNotches.widthMm;
            const nh = src.wallHangerCornerNotches.heightMm;
            mapLocalRectToSheet("NOTCH_WALL_HANGER", 0, src.lengthMm - nh, nw, nh);
            mapLocalRectToSheet("NOTCH_WALL_HANGER", src.widthMm - nw, src.lengthMm - nh, nw, nh);
          }

          // 5. Vertical CNC Drilling Operations (`DRILL_V_*`) & Secondary Pod-Flip Flag
          let hasOppositeFaceHoles = false;
          (src.holes || []).forEach((hole) => {
            if (hole.direction.startsWith("edge_")) return; // Horizontal edge boring happens on secondary point-to-point / horizontal aggregate
            if (hole.direction === "face_back" && src.componentRole === "carcass_divider") {
              hasOppositeFaceHoles = true;
              return;
            }
            const [hx, hy] = mapLocalPointToSheet(hole.x, hole.y);
            const zDepth = Math.round(hole.depth);
            const dLayer = `DRILL_V_D${Math.round(hole.diameter)}_Z${zDepth}`;
            writer.addCircle(dLayer, hx, hy, roundMm(hole.diameter / 2, 2));
          });
          if (hasOppositeFaceHoles) {
            writer.addText("REQUIRES_SECONDARY_POD_FLIP", px + 12, py + 8, 10, "FLIP_ARKA_YUZ_DELIK");
          }
        }

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
