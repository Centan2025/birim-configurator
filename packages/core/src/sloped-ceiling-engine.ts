export type RoofSlopeSide = "none" | "left" | "right" | "rear";

export interface SlopedCeilingSpec {
  side: RoofSlopeSide;
  /** Height of the lower knee-wall edge in mm (e.g., 1400 mm) */
  kneeWallHeightMm: number;
  /** Horizontal distance from the sloped edge where full cabinet height begins (mm) */
  slopeRunMm: number;
}

export interface SlopedCabinetCutGeometry {
  isSloped: boolean;
  side: RoofSlopeSide;
  fullHeightMm: number;
  kneeWallHeightMm: number;
  slopeRunMm: number;
  slopeAngleDeg: number;
  slopedTopLengthMm: number;
  flatTopLengthMm: number;
  /** Returns maximum clear exterior height (mm) at a given horizontal X offset from cabinet left edge (0..widthMm). */
  getHeightAtXMm: (xMm: number) => number;
  /** 2D polygon vertices (in mm, origin bottom-left) for CNC / 2D elevation & 3D clipping */
  elevationPolygonMm: Array<{ x: number; y: number }>;
  warnings: string[];
}

/**
 * Computes exact parametric cutting geometry for attic / sloped-ceiling and stair-under cabinets.
 * Compatible with 2D elevation rendering, 3D beveled side/back panels, and CNC angled-cut BOMs.
 */
export function calculateSlopedCeilingGeometry(
  widthMm: number,
  heightMm: number,
  depthMm: number,
  spec?: SlopedCeilingSpec | null
): SlopedCabinetCutGeometry {
  const safeW = Math.max(200, Math.round(widthMm));
  const safeH = Math.max(400, Math.round(heightMm));
  const safeD = Math.max(200, Math.round(depthMm));

  if (!spec || spec.side === "none") {
    return {
      isSloped: false,
      side: "none",
      fullHeightMm: safeH,
      kneeWallHeightMm: safeH,
      slopeRunMm: 0,
      slopeAngleDeg: 0,
      slopedTopLengthMm: 0,
      flatTopLengthMm: safeW,
      getHeightAtXMm: () => safeH,
      elevationPolygonMm: [
        { x: 0, y: 0 },
        { x: safeW, y: 0 },
        { x: safeW, y: safeH },
        { x: 0, y: safeH },
      ],
      warnings: [],
    };
  }

  const kneeH = Math.max(400, Math.min(safeH - 120, Math.round(spec.kneeWallHeightMm)));
  const maxRun = spec.side === "rear" ? safeD : safeW;
  const runMm = Math.max(150, Math.min(maxRun, Math.round(spec.slopeRunMm)));
  const riseMm = safeH - kneeH;
  const slopeAngleDeg = Number(((Math.atan2(riseMm, runMm) * 180) / Math.PI).toFixed(1));
  const slopedTopLengthMm = Math.round(Math.hypot(runMm, riseMm));
  const flatTopLengthMm = Math.max(0, maxRun - runMm);
  const warnings: string[] = [];

  if (slopeAngleDeg > 60) {
    warnings.push(`Çatı eğim açısı (${slopeAngleDeg}°) 60° üzerinde; özel gönye CNC kesim aparatı gerekir.`);
  }
  if (kneeH < 900) {
    warnings.push(`Düşük duvar yüksekliği (${kneeH} mm) menteşeli standart kapak için dar; çekmece veya açılı kapak önerilir.`);
  }

  const getHeightAtXMm = (xMm: number): number => {
    const x = Math.max(0, Math.min(safeW, xMm));
    if (spec.side === "left") {
      if (x >= runMm) return safeH;
      return Math.round(kneeH + (x / runMm) * riseMm);
    }
    if (spec.side === "right") {
      const distFromRight = safeW - x;
      if (distFromRight >= runMm) return safeH;
      return Math.round(kneeH + (distFromRight / runMm) * riseMm);
    }
    return safeH;
  };

  let elevationPolygonMm: Array<{ x: number; y: number }>;
  if (spec.side === "left") {
    elevationPolygonMm = [
      { x: 0, y: 0 },
      { x: safeW, y: 0 },
      { x: safeW, y: safeH },
      ...(runMm < safeW ? [{ x: runMm, y: safeH }] : []),
      { x: 0, y: kneeH },
    ];
  } else if (spec.side === "right") {
    elevationPolygonMm = [
      { x: 0, y: 0 },
      { x: safeW, y: 0 },
      { x: safeW, y: kneeH },
      ...(runMm < safeW ? [{ x: safeW - runMm, y: safeH }] : []),
      { x: 0, y: safeH },
    ];
  } else {
    elevationPolygonMm = [
      { x: 0, y: 0 },
      { x: safeW, y: 0 },
      { x: safeW, y: safeH },
      { x: 0, y: safeH },
    ];
  }

  return {
    isSloped: true,
    side: spec.side,
    fullHeightMm: safeH,
    kneeWallHeightMm: kneeH,
    slopeRunMm: runMm,
    slopeAngleDeg,
    slopedTopLengthMm,
    flatTopLengthMm,
    getHeightAtXMm,
    elevationPolygonMm,
    warnings,
  };
}
