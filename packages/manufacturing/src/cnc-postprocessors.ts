import type { CutPiece } from "./types";

export interface CncKerfBendingInput {
  outerRadiusMm: number;
  bendAngleDeg: number;
  unfoldedArcLengthMm: number;
  kerfCount: number;
  kerfSpacingMm: number;
  slotDepthMm: number;
  skinRemainingMm: number;
}

export interface CncDrillOpInput {
  x: number;
  y: number;
  diameter: number;
  depth: number;
  face:
    | "top"
    | "bottom"
    | "front"
    | "back"
    | "left"
    | "right"
    | "edge_top"
    | "edge_bottom"
    | "edge_left"
    | "edge_right";
  type: string;
}

export interface CncCutoutInput {
  id: string;
  shape: "rect" | "circle" | "corner_notch";
  centerXMm: number;
  centerYMm: number;
  widthMm: number;
  heightMm: number;
  diameterMm?: number;
  cornerRadiusMm?: number;
  label: string;
}

export interface CncPieceInput {
  id: string;
  moduleId: string;
  moduleName: string;
  partRole: string;
  pieceName: string;
  thicknessMm: number;
  lengthMm: number;
  widthMm: number;
  netCutLengthMm?: number;
  netCutWidthMm?: number;
  rawOriginOffsetXMm?: number;
  rawOriginOffsetYMm?: number;
  /** Default "pre_banding_raw" shifts bore coordinates to raw pre-banded panel edges when netCut differs from nominal */
  boreReferenceMode?: "pre_banding_raw" | "post_banding_finished";
  mirrorInnerFaceX?: boolean;
  hasBackGroove?: boolean;
  backGrooveOffsetMm?: number;
  hasSinkOrHobCutout?: boolean;
  cutoutWidthMm?: number;
  cutoutDepthMm?: number;
  utilityCutouts?: CncCutoutInput[];
  /** True non-rectangular 2D outer contour [xMm, yMm][] (sloped ceiling trapezoids, capsule stadium tops/bottoms) */
  polygonContourMm?: [number, number][];
  /** Parametric CNC kerf-bending saw/router slot schedule for curved shells */
  kerfBendingMeta?: CncKerfBendingInput;
  drillingOperations: CncDrillOpInput[];
}

/**
 * Canonical CutPiece -> CncPieceInput mapper ensuring zero data loss between BOM/DXF and .MPR/.CIX/.XCS postprocessors.
 */
export function mapCutPieceToCncPieceInput(cp: CutPiece): CncPieceInput {
  return {
    id: cp.id,
    moduleId: cp.moduleId,
    moduleName: cp.moduleName,
    partRole: cp.componentRole,
    pieceName: cp.pieceName,
    thicknessMm: cp.thicknessMm,
    lengthMm: cp.lengthMm,
    widthMm: cp.widthMm,
    netCutLengthMm: cp.netCutLengthMm,
    netCutWidthMm: cp.netCutWidthMm,
    rawOriginOffsetXMm: cp.rawOriginOffsetXMm,
    rawOriginOffsetYMm: cp.rawOriginOffsetYMm,
    mirrorInnerFaceX: cp.mirrorInnerFaceX,
    hasBackGroove: cp.hasBackGroove,
    backGrooveOffsetMm: cp.backGrooveOffsetMm,
    hasSinkOrHobCutout: cp.hasSinkOrHobCutout,
    cutoutWidthMm: cp.cutoutWidthMm,
    cutoutDepthMm: cp.cutoutDepthMm,
    utilityCutouts: cp.utilityCutouts,
    polygonContourMm: cp.polygonContourMm,
    kerfBendingMeta: cp.kerfBendingMeta,
    drillingOperations: (cp.holes || []).map((h) => ({
      x: h.x,
      y: h.y,
      diameter: h.diameter,
      depth: h.depth,
      face:
        h.direction === "face_back"
          ? "bottom"
          : h.direction.startsWith("edge_")
          ? (h.direction as CncDrillOpInput["face"])
          : "top",
      type: h.purpose || "drill",
    })),
  };
}

export interface CncProgramFile {
  fileName: string;
  format: "homag_mpr" | "biesse_cix" | "scm_xcs";
  pieceId: string;
  pieceName: string;
  faceSetup: "TOP_SETUP_1" | "FLIP_BOTTOM_SETUP_2" | "UNIFIED_MULTI_SIDE";
  requiresOperatorFlip: boolean;
  operationsCount: number;
  content: string;
}

function sanitizeCncComment(raw: string): string {
  return String(raw || "")
    .replace(/[\r\n"\\<>]/g, " ")
    .trim();
}

function fmtNum(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function isOppositeFaceOp(face: CncDrillOpInput["face"]): boolean {
  return face === "bottom" || face === "back";
}

function isHorizontalEdgeOp(face: CncDrillOpInput["face"]): boolean {
  return (
    face === "edge_top" ||
    face === "edge_bottom" ||
    face === "edge_left" ||
    face === "edge_right" ||
    face === "left" ||
    face === "right"
  );
}

/**
 * Generates Homag WoodWOP 5.0 (.MPR) CNC program(s) for a cut piece.
 * Automatically splits double-sided parts (such as `carcass_divider`) into:
 *   1) `_SETUP1_TOP.mpr` (Primary Setup + Horizontal Edge Boring + Grooves + Pockets)
 *   2) `_SETUP2_FLIP_BOTTOM.mpr` (Mirrored LPY=B-x Flip Setup so stop-pins match!)
 */
function adjustOpToWorkpieceOrigin(
  op: CncDrillOpInput,
  piece: CncPieceInput
): { x: number; y: number } {
  const useRawPreBand =
    (piece.boreReferenceMode ?? "pre_banding_raw") === "pre_banding_raw" &&
    (piece.netCutLengthMm !== undefined || piece.netCutWidthMm !== undefined);
  const offX = useRawPreBand ? (piece.rawOriginOffsetXMm ?? 0) : 0;
  const offY = useRawPreBand ? (piece.rawOriginOffsetYMm ?? 0) : 0;
  return {
    x: op.x - offX,
    y: op.y - offY,
  };
}

export function generateHomagMprPrograms(piece: CncPieceInput): CncProgramFile[] {
  const L = piece.netCutLengthMm ?? piece.lengthMm;
  const B = piece.netCutWidthMm ?? piece.widthMm;
  const D = piece.thicknessMm || 18;

  const primaryVertOps = piece.drillingOperations.filter(
    (op) => !isOppositeFaceOp(op.face) && !isHorizontalEdgeOp(op.face)
  );
  const oppositeVertOps = piece.drillingOperations.filter((op) => isOppositeFaceOp(op.face));
  const horizOps = piece.drillingOperations.filter((op) => isHorizontalEdgeOp(op.face));
  const cutouts = [...(piece.utilityCutouts || [])];
  const hasExplicitSinkHobUtility = cutouts.some((c) => c.id.startsWith("cutout_"));

  if (piece.partRole === "countertop" && piece.hasSinkOrHobCutout && !hasExplicitSinkHobUtility) {
    cutouts.push({
      id: `${piece.id}_sink_cutout`,
      shape: "rect",
      centerXMm: B / 2,
      centerYMm: L / 2,
      widthMm: piece.cutoutDepthMm ?? Math.min(490, B - 110),
      heightMm: piece.cutoutWidthMm ?? Math.min(560, L - 120),
      cornerRadiusMm: 10,
      label: "Eviye / Ocak Kesimi",
    });
  }

  const requiresFlip = oppositeVertOps.length > 0;
  const safeSlug = `${piece.moduleId}_${piece.partRole}_${piece.id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const programs: CncProgramFile[] = [];

  const buildMprText = (
    vertOps: CncDrillOpInput[],
    includeHorizAndGroove: boolean,
    isFlipSetup: boolean
  ): { text: string; opCount: number } => {
    const lines: string[] = [
      "[H",
      'VERSION="4.0 Alpha"',
      'WW="5.0.22"',
      'OP="1"',
      'FM="1"',
      'GP="0"',
      'UP="0"',
      'DW="0"',
      'VIEW="NOMIRROR"',
      `KOM1="${sanitizeCncComment(piece.moduleName + " - " + piece.pieceName)}"`,
      `KOM2="${isFlipSetup ? "SETUP-2: PARCAYI X EKSENINDE CEVIRIN (FLIP)" : "SETUP-1: ANA YUZEY (TOP)"}"`,
      "",
      "[001",
      `LPX="${fmtNum(L)}"`,
      'KM="Parca Boyu (mm)"',
      `LPY="${fmtNum(B)}"`,
      'KM="Parca Eni (mm)"',
      `LPZ="${fmtNum(D)}"`,
      'KM="Parca Kalinligi (mm)"',
      "",
      "]",
      "$E0",
      "KP",
      "X=0.0",
      "Y=0.0",
      "Z=0.0",
      "KO=00",
      ".X=0.000000",
      ".Y=0.000000",
      ".Z=0.000000",
      ".KO=0",
      "",
    ];

    const polyPts =
      !isFlipSetup && piece.polygonContourMm && piece.polygonContourMm.length >= 3
        ? piece.polygonContourMm
        : null;
    if (polyPts) {
      const [p0x, p0y] = polyPts[0];
      lines.push(
        "$E1",
        "KP",
        `X=${fmtNum(p0y)}`,
        `Y=${fmtNum(p0x)}`,
        "Z=0.0",
        "KO=00",
        ""
      );
      for (let vi = 1; vi <= polyPts.length; vi++) {
        const [vx, vy] = polyPts[vi % polyPts.length];
        lines.push(
          "KL",
          `X=${fmtNum(vy)}`,
          `Y=${fmtNum(vx)}`,
          ""
        );
      }
    }

    let opCount = 0;

    for (const op of vertOps) {
      const adj = adjustOpToWorkpieceOrigin(op, piece);
      const mprX = Math.max(0, Math.min(L, adj.y));
      const rawY = Math.max(0, Math.min(B, adj.x));
      const mprY = isFlipSetup ? Math.max(0, B - rawY) : rawY;
      lines.push(
        "<102 \\BohrVert\\",
        `XA="${fmtNum(mprX)}"`,
        `YA="${fmtNum(mprY)}"`,
        'BM="LS"',
        `TI="${fmtNum(Math.min(D + 2, op.depth))}"`,
        `DU="${fmtNum(op.diameter)}"`,
        'AN="1"',
        'MI="0"',
        'S_="1"',
        `KM="${sanitizeCncComment(op.type)}"`,
        ""
      );
      opCount++;
    }

    if (includeHorizAndGroove) {
      for (const hop of horizOps) {
        const adjH = adjustOpToWorkpieceOrigin(hop, piece);
        const zCenter = fmtNum(D / 2);
        let xa = fmtNum(Math.max(0, Math.min(L, adjH.y)));
        let ya = fmtNum(Math.max(0, Math.min(B, adjH.x)));
        let bm = "XP";
        if (hop.face === "edge_bottom") {
          xa = "0.00";
          bm = "XP";
        } else if (hop.face === "edge_top") {
          xa = fmtNum(L);
          bm = "XM";
        } else if (hop.face === "edge_left" || hop.face === "left") {
          ya = "0.00";
          bm = "YP";
        } else if (hop.face === "edge_right" || hop.face === "right") {
          ya = fmtNum(B);
          bm = "YM";
        }

        lines.push(
          "<103 \\BohrHoriz\\",
          `XA="${xa}"`,
          `YA="${ya}"`,
          `ZA="${zCenter}"`,
          `BM="${bm}"`,
          `TI="${fmtNum(hop.depth)}"`,
          `DU="${fmtNum(hop.diameter)}"`,
          'AN="1"',
          'MI="0"',
          `KM="${sanitizeCncComment(hop.type + "_" + hop.face)}"`,
          ""
        );
        opCount++;
      }

      if (
        piece.hasBackGroove !== false &&
        (piece.partRole === "carcass_side" ||
          piece.partRole === "carcass_top" ||
          piece.partRole === "carcass_bottom")
      ) {
        const grooveOff = piece.backGrooveOffsetMm ?? 20;
        const grooveCenterY = piece.mirrorInnerFaceX
          ? grooveOff - 4
          : Math.max(8, B - grooveOff + 4);
        lines.push(
          "<109 \\Nut\\",
          'XA="0.00"',
          `YA="${fmtNum(grooveCenterY)}"`,
          `XE="${fmtNum(L)}"`,
          `YE="${fmtNum(grooveCenterY)}"`,
          'NB="8.50"',
          'RK="NOWRK"',
          'TI="8.50"',
          'MN="GL"',
          'KM="BACK_GROOVE_8MM"',
          ""
        );
        opCount++;
      }

      for (const co of cutouts) {
        const cx = Math.max(0, Math.min(L, co.centerYMm));
        const cy = Math.max(0, Math.min(B, co.centerXMm));
        const dia = co.diameterMm ?? co.widthMm;
        lines.push(
          "<112 \\Tasche\\",
          `XA="${fmtNum(cx)}"`,
          `YA="${fmtNum(cy)}"`,
          `LA="${fmtNum(co.shape === "circle" ? dia : co.heightMm)}"`,
          `BR="${fmtNum(co.shape === "circle" ? dia : co.widthMm)}"`,
          `RD="${fmtNum(co.shape === "circle" ? dia / 2 : co.cornerRadiusMm ?? 5)}"`,
          `TI="${fmtNum(D + 2)}"`,
          'T_="120"',
          `KM="${sanitizeCncComment(co.label)}"`,
          ""
        );
        opCount++;
      }

      if (polyPts) {
        lines.push(
          "<105 \\Konturfraesen\\",
          `EA="1:0"`,
          `EE="1:${polyPts.length}"`,
          'MDA="SEN"',
          'MDE="SEN_AB"',
          'STUFEN="0"',
          `Z_="${fmtNum(D + 1)}"`,
          'RK="WRKL"',
          'T_="120"',
          'KM="POLYGON_OUTER_CONTOUR"',
          ""
        );
        opCount++;
      }

      if (piece.kerfBendingMeta && piece.kerfBendingMeta.kerfCount > 0) {
        const km = piece.kerfBendingMeta;
        const slotDepth = Math.min(D - Math.max(1.2, km.skinRemainingMm || 2), km.slotDepthMm || D - 2);
        const startOffset = Math.max(2, km.kerfSpacingMm * 0.5);
        for (let ki = 0; ki < km.kerfCount; ki++) {
          const slotPos = Math.min(B - 2, startOffset + ki * km.kerfSpacingMm);
          lines.push(
            "<109 \\Nut\\",
            'XA="0.00"',
            `YA="${fmtNum(slotPos)}"`,
            `XE="${fmtNum(L)}"`,
            `YE="${fmtNum(slotPos)}"`,
            'NB="3.20"',
            'RK="NOWRK"',
            `TI="${fmtNum(slotDepth)}"`,
            'MN="GL"',
            `KM="CNC_KERF_BEND_SLOT_${ki + 1}_OF_${km.kerfCount}"`,
            ""
          );
          opCount++;
        }
      }
    }

    lines.push("!");
    return { text: lines.join("\r\n"), opCount };
  };

  const setup1 = buildMprText(primaryVertOps, true, false);
  programs.push({
    fileName: `${safeSlug}${requiresFlip ? "_SETUP1_TOP" : ""}.mpr`,
    format: "homag_mpr",
    pieceId: piece.id,
    pieceName: piece.pieceName,
    faceSetup: "TOP_SETUP_1",
    requiresOperatorFlip: requiresFlip,
    operationsCount: setup1.opCount,
    content: setup1.text,
  });

  if (requiresFlip) {
    const setup2 = buildMprText(oppositeVertOps, false, true);
    programs.push({
      fileName: `${safeSlug}_SETUP2_FLIP_BOTTOM.mpr`,
      format: "homag_mpr",
      pieceId: piece.id,
      pieceName: `${piece.pieceName} (Arka/Alt Yüzey Çevirme)`,
      faceSetup: "FLIP_BOTTOM_SETUP_2",
      requiresOperatorFlip: true,
      operationsCount: setup2.opCount,
      content: setup2.text,
    });
  }

  return programs;
}

/**
 * Generates a BiesseWorks (.CIX) multi-side parametric CNC macro file (`SIDE=0` top, `SIDE=5` bottom/flip, `SIDE=1..4` edges).
 */
export function generateBiesseCixProgram(piece: CncPieceInput): CncProgramFile {
  const LPX = piece.netCutLengthMm ?? piece.lengthMm;
  const LPY = piece.netCutWidthMm ?? piece.widthMm;
  const LPZ = piece.thicknessMm || 18;
  const safeSlug = `${piece.moduleId}_${piece.partRole}_${piece.id}`.replace(/[^a-zA-Z0-9_-]/g, "_");

  const lines: string[] = [
    "BEGIN ID CID3",
    "  REL= 5.0",
    "END ID",
    "",
    "BEGIN MAINDATA",
    `  LPX=${fmtNum(LPX)}`,
    `  LPY=${fmtNum(LPY)}`,
    `  LPZ=${fmtNum(LPZ)}`,
    '  ORLST="1"',
    "  SIMMETRY=1",
    "  TLCHK=0",
    `  CUSTSTR="${sanitizeCncComment(piece.moduleName + " | " + piece.pieceName)}"`,
    "END MAINDATA",
    "",
  ];

  let opIdx = 1;
  let hasBottomSide = false;

  for (const op of piece.drillingOperations) {
    const adj = adjustOpToWorkpieceOrigin(op, piece);
    const xVal = Math.max(0, Math.min(LPX, adj.y));
    const yVal = Math.max(0, Math.min(LPY, adj.x));

    if (isHorizontalEdgeOp(op.face)) {
      const cixSide =
        op.face === "edge_bottom"
          ? 1
          : op.face === "edge_top"
          ? 3
          : op.face === "edge_left" || op.face === "left"
          ? 4
          : 2;
      const edgeCoord = cixSide === 1 || cixSide === 3 ? yVal : xVal;
      lines.push(
        "BEGIN MACRO",
        "  NAME=BH",
        `  PARAM,NAME=ID,VALUE="BH_${opIdx++}"`,
        `  PARAM,NAME=SIDE,VALUE=${cixSide}`,
        '  PARAM,NAME=CRN,VALUE="1"',
        `  PARAM,NAME=X,VALUE=${fmtNum(edgeCoord)}`,
        `  PARAM,NAME=Y,VALUE=${fmtNum(LPZ / 2)}`,
        "  PARAM,NAME=Z,VALUE=0",
        `  PARAM,NAME=DP,VALUE=${fmtNum(op.depth)}`,
        `  PARAM,NAME=DIA,VALUE=${fmtNum(op.diameter)}`,
        "END MACRO",
        ""
      );
    } else {
      const isBottom = isOppositeFaceOp(op.face);
      if (isBottom) hasBottomSide = true;
      const sideCode = isBottom ? 5 : 0;
      const effY = isBottom ? Math.max(0, LPY - yVal) : yVal;
      lines.push(
        "BEGIN MACRO",
        "  NAME=BV",
        `  PARAM,NAME=ID,VALUE="BV_${opIdx++}"`,
        `  PARAM,NAME=SIDE,VALUE=${sideCode}`,
        '  PARAM,NAME=CRN,VALUE="1"',
        `  PARAM,NAME=X,VALUE=${fmtNum(xVal)}`,
        `  PARAM,NAME=Y,VALUE=${fmtNum(effY)}`,
        "  PARAM,NAME=Z,VALUE=0",
        `  PARAM,NAME=DP,VALUE=${fmtNum(Math.min(LPZ + 2, op.depth))}`,
        `  PARAM,NAME=DIA,VALUE=${fmtNum(op.diameter)}`,
        "END MACRO",
        ""
      );
    }
  }

  if (
    piece.hasBackGroove !== false &&
    (piece.partRole === "carcass_side" ||
      piece.partRole === "carcass_top" ||
      piece.partRole === "carcass_bottom")
  ) {
    const grooveOff = piece.backGrooveOffsetMm ?? 20;
    const grooveY = piece.mirrorInnerFaceX ? grooveOff - 4 : Math.max(8, LPY - grooveOff + 4);
    lines.push(
      "BEGIN MACRO",
      "  NAME=CUT_G",
      `  PARAM,NAME=ID,VALUE="GROOVE_${opIdx++}"`,
      "  PARAM,NAME=SIDE,VALUE=0",
      '  PARAM,NAME=CRN,VALUE="1"',
      "  PARAM,NAME=X,VALUE=0",
      `  PARAM,NAME=Y,VALUE=${fmtNum(grooveY)}`,
      `  PARAM,NAME=XE,VALUE=${fmtNum(LPX)}`,
      `  PARAM,NAME=YE,VALUE=${fmtNum(grooveY)}`,
      "  PARAM,NAME=DP,VALUE=8.50",
      "  PARAM,NAME=TH,VALUE=8.50",
      "END MACRO",
      ""
    );
  }

  const cixCutouts = [...(piece.utilityCutouts || [])];
  if (
    piece.partRole === "countertop" &&
    piece.hasSinkOrHobCutout &&
    !cixCutouts.some((c) => c.id.startsWith("cutout_"))
  ) {
    cixCutouts.push({
      id: `${piece.id}_sink_cutout`,
      shape: "rect",
      centerXMm: LPY / 2,
      centerYMm: LPX / 2,
      widthMm: piece.cutoutDepthMm ?? Math.min(490, LPY - 110),
      heightMm: piece.cutoutWidthMm ?? Math.min(560, LPX - 120),
      cornerRadiusMm: 10,
      label: "Eviye / Ocak Kesimi",
    });
  }

  for (const co of cixCutouts) {
    const cx = Math.max(0, Math.min(LPX, co.centerYMm));
    const cy = Math.max(0, Math.min(LPY, co.centerXMm));
    const dia = co.diameterMm ?? co.widthMm;
    lines.push(
      "BEGIN MACRO",
      "  NAME=POCKET",
      `  PARAM,NAME=ID,VALUE="PKT_${opIdx++}"`,
      "  PARAM,NAME=SIDE,VALUE=0",
      '  PARAM,NAME=CRN,VALUE="1"',
      `  PARAM,NAME=X,VALUE=${fmtNum(cx)}`,
      `  PARAM,NAME=Y,VALUE=${fmtNum(cy)}`,
      `  PARAM,NAME=LX,VALUE=${fmtNum(co.shape === "circle" ? dia : co.heightMm)}`,
      `  PARAM,NAME=LY,VALUE=${fmtNum(co.shape === "circle" ? dia : co.widthMm)}`,
      `  PARAM,NAME=DP,VALUE=${fmtNum(LPZ + 2)}`,
      `  PARAM,NAME=RAD,VALUE=${fmtNum(co.shape === "circle" ? dia / 2 : co.cornerRadiusMm ?? 5)}`,
      "END MACRO",
      ""
    );
  }

  if (piece.polygonContourMm && piece.polygonContourMm.length >= 3) {
    const poly = piece.polygonContourMm;
    const [sx, sy] = poly[0];
    lines.push(
      "BEGIN MACRO",
      "  NAME=GEO",
      '  PARAM,NAME=ID,VALUE="POLY_GEO_1"',
      "  PARAM,NAME=SIDE,VALUE=0",
      '  PARAM,NAME=CRN,VALUE="1"',
      "END MACRO",
      "",
      "BEGIN MACRO",
      "  NAME=START_POINT",
      `  PARAM,NAME=X,VALUE=${fmtNum(sy)}`,
      `  PARAM,NAME=Y,VALUE=${fmtNum(sx)}`,
      "END MACRO",
      ""
    );
    for (let vi = 1; vi <= poly.length; vi++) {
      const [vx, vy] = poly[vi % poly.length];
      lines.push(
        "BEGIN MACRO",
        "  NAME=LINE_EP",
        `  PARAM,NAME=XE,VALUE=${fmtNum(vy)}`,
        `  PARAM,NAME=YE,VALUE=${fmtNum(vx)}`,
        "END MACRO",
        ""
      );
    }
    lines.push(
      "BEGIN MACRO",
      "  NAME=ENDPATH",
      "END MACRO",
      "",
      "BEGIN MACRO",
      "  NAME=ROUTG",
      `  PARAM,NAME=ID,VALUE="ROUT_POLY_${opIdx++}"`,
      '  PARAM,NAME=GID,VALUE="POLY_GEO_1"',
      `  PARAM,NAME=DP,VALUE=${fmtNum(LPZ + 1)}`,
      "  PARAM,NAME=DIA,VALUE=12.00",
      "  PARAM,NAME=TRC,VALUE=1",
      "END MACRO",
      ""
    );
  }

  if (piece.kerfBendingMeta && piece.kerfBendingMeta.kerfCount > 0) {
    const km = piece.kerfBendingMeta;
    const slotDepth = Math.min(LPZ - Math.max(1.2, km.skinRemainingMm || 2), km.slotDepthMm || LPZ - 2);
    const startOffset = Math.max(2, km.kerfSpacingMm * 0.5);
    for (let ki = 0; ki < km.kerfCount; ki++) {
      const slotY = Math.min(LPY - 2, startOffset + ki * km.kerfSpacingMm);
      lines.push(
        "BEGIN MACRO",
        "  NAME=CUT_G",
        `  PARAM,NAME=ID,VALUE="KERF_SLOT_${ki + 1}"`,
        "  PARAM,NAME=SIDE,VALUE=0",
        '  PARAM,NAME=CRN,VALUE="1"',
        "  PARAM,NAME=X,VALUE=0",
        `  PARAM,NAME=Y,VALUE=${fmtNum(slotY)}`,
        `  PARAM,NAME=XE,VALUE=${fmtNum(LPX)}`,
        `  PARAM,NAME=YE,VALUE=${fmtNum(slotY)}`,
        `  PARAM,NAME=DP,VALUE=${fmtNum(slotDepth)}`,
        "  PARAM,NAME=TH,VALUE=3.20",
        "END MACRO",
        ""
      );
      opIdx++;
    }
  }

  return {
    fileName: `${safeSlug}.cix`,
    format: "biesse_cix",
    pieceId: piece.id,
    pieceName: piece.pieceName,
    faceSetup: "UNIFIED_MULTI_SIDE",
    requiresOperatorFlip: hasBottomSide,
    operationsCount: opIdx - 1,
    content: lines.join("\r\n"),
  };
}

export function generateProjectCncPostProcessorBundle(pieces: CncPieceInput[]): {
  homagMprFiles: CncProgramFile[];
  biesseCixFiles: CncProgramFile[];
  scmXcsFiles: CncProgramFile[];
  flipRequiredPieceIds: string[];
} {
  const homagMprFiles: CncProgramFile[] = [];
  const biesseCixFiles: CncProgramFile[] = [];
  const scmXcsFiles: CncProgramFile[] = [];
  const flipRequiredPieceIds: string[] = [];

  for (const p of pieces) {
    const mprs = generateHomagMprPrograms(p);
    homagMprFiles.push(...mprs);
    const cix = generateBiesseCixProgram(p);
    biesseCixFiles.push(cix);
    const xcs = generateScmXcsProgram(p);
    scmXcsFiles.push(xcs);
    if (cix.requiresOperatorFlip) {
      flipRequiredPieceIds.push(p.id);
    }
  }

  return { homagMprFiles, biesseCixFiles, scmXcsFiles, flipRequiredPieceIds };
}

/**
 * Generates SCM Maestro (.XCS) CNC macro script with pre-milling offset and G41/G42 tool radius compensation
 * for SCM Morbidelli / Accord 5-axis and nesting machining centers.
 */
export function generateScmXcsProgram(piece: CncPieceInput): CncProgramFile {
  const L = piece.netCutLengthMm ?? piece.lengthMm;
  const B = piece.netCutWidthMm ?? piece.widthMm;
  const D = piece.thicknessMm || 18;
  const safeName = sanitizeCncComment(piece.pieceName || piece.id);
  const lines: string[] = [
    `// Birim Configurator V6.2 — SCM Maestro .XCS Post-Processor`,
    `// Parca: ${safeName} (${piece.id}) | Modul: ${sanitizeCncComment(piece.moduleName)}`,
    `SetMachiningParameters("AD", 1, 10, 0, false);`,
    `CreateFinishedWorkpieceBox("${piece.id}", ${fmtNum(L)}, ${fmtNum(B)}, ${fmtNum(D)});`,
    `SetWorkpieceSetupPosition(0, 0, 0, 0);`,
  ];

  let opCount = 0;
  if (piece.polygonContourMm && piece.polygonContourMm.length >= 3) {
    const poly = piece.polygonContourMm;
    const [sx, sy] = poly[0];
    lines.push(`CreatePolyline("POLY_CONTOUR_${piece.id}", ${fmtNum(sy)}, ${fmtNum(sx)});`);
    for (let vi = 1; vi <= poly.length; vi++) {
      const [vx, vy] = poly[vi % poly.length];
      lines.push(`AddSegmentToPolyline(${fmtNum(vy)}, ${fmtNum(vx)});`);
    }
    lines.push(
      `CreateRoughFinishCut("POLYGON_SIZING_PASS", ${fmtNum(D + 0.5)}, "", TypeOfProcess.GeneralRouting, "E010", "-1", 1, -1, -1, -1, 0);`
    );
    opCount++;
  } else {
    // Standard rectangular perimeter sizing pass with left-hand tool radius compensation (ToolComp = 1 -> G41)
    lines.push(
      `CreatePolyline("PERIM_${piece.id}", 0, 0);`,
      `AddSegmentToPolyline(${fmtNum(L)}, 0);`,
      `AddSegmentToPolyline(${fmtNum(L)}, ${fmtNum(B)});`,
      `AddSegmentToPolyline(0, ${fmtNum(B)});`,
      `AddSegmentToPolyline(0, 0);`,
      `CreateRoughFinishCut("SIZING_PASS", ${fmtNum(D + 0.5)}, "", TypeOfProcess.GeneralRouting, "E010", "-1", 1, -1, -1, -1, 0);`
    );
    opCount++;
  }

  piece.drillingOperations.forEach((op, idx) => {
    const adj = adjustOpToWorkpieceOrigin(op, piece);
    // P0-01 Fix: Workpiece Box has X = L (lengthMm -> adj.y) and Y = B (widthMm -> adj.x), matching Homag .MPR & Biesse .CIX!
    const scmX = Math.max(0, Math.min(L, adj.y));
    const rawScmY = Math.max(0, Math.min(B, adj.x));
    if (isHorizontalEdgeOp(op.face)) {
      let edgeX = scmX;
      let edgeY = rawScmY;
      if (op.face === "edge_bottom") edgeX = 0;
      else if (op.face === "edge_top") edgeX = L;
      else if (op.face === "edge_left" || op.face === "left") edgeY = 0;
      else if (op.face === "edge_right" || op.face === "right") edgeY = B;
      lines.push(
        `CreateDrill("H_DRILL_${idx + 1}", ${fmtNum(edgeX)}, ${fmtNum(edgeY)}, ${fmtNum(D / 2)}, ${fmtNum(op.diameter)}, "", TypeOfProcess.Drilling, "-1", "-1", 0, -1, -1, "P");`
      );
    } else {
      const isOpp = isOppositeFaceOp(op.face);
      const effScmY = isOpp ? Math.max(0, B - rawScmY) : rawScmY;
      const sideFlag = isOpp ? 2 : 1;
      lines.push(
        `CreateDrill("V_DRILL_${idx + 1}", ${fmtNum(scmX)}, ${fmtNum(effScmY)}, ${fmtNum(Math.min(D + 2, op.depth))}, ${fmtNum(op.diameter)}, "", TypeOfProcess.Drilling, "-1", "-1", ${sideFlag}, -1, -1, "P");`
      );
    }
    opCount++;
  });

  if (
    piece.hasBackGroove &&
    (piece.partRole === "carcass_side" ||
      piece.partRole === "carcass_side_left" ||
      piece.partRole === "carcass_side_right" ||
      piece.partRole === "side_left" ||
      piece.partRole === "side_right" ||
      piece.partRole === "carcass_top" ||
      piece.partRole === "carcass_bottom")
  ) {
    const gOff = piece.backGrooveOffsetMm ?? 20;
    const grooveY = piece.mirrorInnerFaceX ? Math.max(4, gOff - 4) : Math.max(8, B - gOff + 4);
    lines.push(
      `CreateBladeCut("BACK_GROOVE_8_5MM", "GROOVE_SAW", TypeOfProcess.Groove, 0.00, ${fmtNum(grooveY)}, ${fmtNum(L)}, ${fmtNum(grooveY)}, 8.5, 8.5, 90, 0, true);`
    );
    opCount++;
  }

  if (piece.kerfBendingMeta && piece.kerfBendingMeta.kerfCount > 0) {
    const km = piece.kerfBendingMeta;
    const slotDepth = Math.min(D - Math.max(1.2, km.skinRemainingMm || 2), km.slotDepthMm || D - 2);
    const startOffset = Math.max(2, km.kerfSpacingMm * 0.5);
    for (let ki = 0; ki < km.kerfCount; ki++) {
      const slotPos = Math.min(B - 2, startOffset + ki * km.kerfSpacingMm);
      lines.push(
        `CreateBladeCut("KERF_SLOT_${ki + 1}", "KERF_SAW_3_2MM", TypeOfProcess.Groove, 0, ${fmtNum(slotPos)}, ${fmtNum(L)}, ${fmtNum(slotPos)}, 3.2, ${fmtNum(slotDepth)}, 90, 0, true);`
      );
      opCount++;
    }
  }

  return {
    fileName: `${piece.id}_SCM_MAESTRO.xcs`,
    format: "scm_xcs",
    pieceId: piece.id,
    pieceName: piece.pieceName,
    faceSetup: "UNIFIED_MULTI_SIDE",
    requiresOperatorFlip: piece.drillingOperations.some((op) => isOppositeFaceOp(op.face)),
    operationsCount: opCount,
    content: lines.join("\n"),
  };
}

