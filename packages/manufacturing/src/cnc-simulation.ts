import type { DesignProject, TenantMachineProfile } from "@birim/core";
import { roundMm } from "@birim/core";
import type { CutPiece, ManufacturingBOM } from "./types";
import { mapCutPieceToCncPieceInput, type CncPieceInput } from "./cnc-postprocessors";

export interface CncSimulationIssue {
  pieceId: string;
  partName: string;
  severity: "error" | "warning" | "info";
  code:
    | "Z_DEPTH_EXCEEDS_STOCK"
    | "WEB_BLOWOUT_RISK"
    | "VACUUM_POD_SMALL_PART"
    | "GROOVE_COLLISION"
    | "CLAMP_EDGE_PROXIMITY";
  messageTr: string;
  coordinateLabel?: string;
}

export interface CncPieceSimulationResult {
  pieceId: string;
  partCode: string;
  partName: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  drillCount: number;
  grooveCount: number;
  cutoutCount: number;
  golaNotchCount: number;
  toolChangeCount: number;
  rapidTravelMeters: number;
  estimatedCycleSeconds: number;
  passedSafetyChecks: boolean;
  issues: CncSimulationIssue[];
}

export interface CncProjectSimulationReport {
  projectId: string;
  machineFormat: "homag_mpr" | "biesse_cix" | "scm_xcs" | "iso_gcode";
  postProcessorCalibrationStatus: "UNVERIFIED_SIMULATION_ONLY" | "TENANT_MACHINE_VERIFIED";
  postProcessorDisclaimerTr: string;
  canSendToMachineDirectly: boolean;
  totalPanelsSimulated: number;
  machinedPanelsCount: number;
  totalDrillOps: number;
  totalGrooveAndNotchOps: number;
  totalEstimatedMinutes: number;
  blockingErrorCount: number;
  warningCount: number;
  pieces: CncPieceSimulationResult[];
}

/**
 * Pre-flight CNC verification and toolpath simulation engine.
 * Validates spindle Z-depths, minimum vacuum pod holding area, hole-to-hole web thickness,
 * groove intersections, and machine post-processor calibration status BEFORE any CNC export.
 */
export function simulateCncPostProcessorBundle(
  project: DesignProject,
  bom: ManufacturingBOM,
  machineProfile?: Partial<TenantMachineProfile> & { postProcessorCalibratedOnMachine?: boolean }
): CncProjectSimulationReport {
  const format = machineProfile?.cncFormat || "biesse_cix";
  const isCalibrated = Boolean(machineProfile?.postProcessorCalibratedOnMachine);

  const pieceResults: CncPieceSimulationResult[] = [];
  let totalDrills = 0;
  let totalGrooves = 0;
  let totalSeconds = 0;
  let blockingErrors = 0;
  let warnings = 0;

  for (const cp of bom.cutList) {
    const cncPiece: CncPieceInput = mapCutPieceToCncPieceInput(cp);
    const partLabel = cp.pieceName || cp.id;
    const issues: CncSimulationIssue[] = [];
    const T = cp.thicknessMm || 18;
    const L = cp.netCutLengthMm ?? cp.lengthMm;
    const W = cp.netCutWidthMm ?? cp.widthMm;

    // 1. Small part vacuum pod / gripper suction check
    if (L < 140 || W < 80) {
      issues.push({
        pieceId: cp.id,
        partName: partLabel,
        severity: L < 70 || W < 70 ? "error" : "warning",
        code: "VACUUM_POD_SMALL_PART",
        messageTr:
          L < 70 || W < 70
            ? `Parça ölçüsü (${Math.round(L)}×${Math.round(W)} mm) 70 mm minimum testere kıskaç ve CNC vakum papucu sınırının altında.`
            : `Dar parça (${Math.round(L)}×${Math.round(W)} mm): Tekli vakum papucu tutuşu zayıf kalabilir; mekanik dayama veya nesting köprüsü kullanın.`,
      });
    }

    const drills = cncPiece.drillingOperations || [];
    const usedDiameters = new Set<number>();

    // 2. Spindle Z-depth & edge proximity validation
    for (let i = 0; i < drills.length; i++) {
      const d = drills[i];
      usedDiameters.add(d.diameter);
      const isThrough = d.depth >= T - 0.1;

      if (!isThrough && d.depth > T - 1.2 && (d.face === "top" || d.face === "bottom")) {
        issues.push({
          pieceId: cp.id,
          partName: partLabel,
          severity: "warning",
          code: "Z_DEPTH_EXCEEDS_STOCK",
          messageTr: `Kör delik derinliği (${d.depth} mm), ${T} mm panel kalınlığında alt yüzeye çok yakın (kalan et: ${roundMm(
            T - d.depth,
            1
          )} mm).`,
          coordinateLabel: `X=${roundMm(d.x, 1)}, Y=${roundMm(d.y, 1)}, Ø${d.diameter}`,
        });
      }

      if (d.face === "top" || d.face === "bottom") {
        const minEdgeDist = Math.min(d.x, L - d.x, d.y, W - d.y) - d.diameter / 2;
        if (minEdgeDist < 2.0) {
          issues.push({
            pieceId: cp.id,
            partName: partLabel,
            severity: minEdgeDist < -0.5 ? "error" : "warning",
            code: "CLAMP_EDGE_PROXIMITY",
            messageTr: `Delik kenara çok yakın (${roundMm(minEdgeDist, 1)} mm et kalınlığı); kenar çatlaması kontrol edilmeli.`,
            coordinateLabel: `X=${roundMm(d.x, 1)}, Y=${roundMm(d.y, 1)}, Ø${d.diameter}`,
          });
        }
      }

      // 3. Pairwise same-face hole web blowout check
      for (let j = i + 1; j < drills.length; j++) {
        const d2 = drills[j];
        if (d.face !== d2.face) continue;
        const dist = Math.hypot(d.x - d2.x, d.y - d2.y);
        const clearWeb = dist - (d.diameter + d2.diameter) / 2;
        if (clearWeb < 1.5 && dist > 0.5) {
          issues.push({
            pieceId: cp.id,
            partName: partLabel,
            severity: clearWeb < -0.2 ? "error" : "warning",
            code: "WEB_BLOWOUT_RISK",
            messageTr: `İki delik arası net et kalınlığı (${roundMm(clearWeb, 1)} mm) 1.5 mm sınırının altında.`,
            coordinateLabel: `(${roundMm(d.x, 1)}, ${roundMm(d.y, 1)}) ↔ (${roundMm(d2.x, 1)}, ${roundMm(d2.y, 1)})`,
          });
          break;
        }
      }
    }

    // 4. Groove depth check
    let grooveOps = 0;
    if (cp.hasBackGroove) {
      grooveOps += 1;
      usedDiameters.add(cp.backGrooveWidthMm || 8.5);
    }
    if (cp.ledGrooveSpec?.enabled) {
      grooveOps += 1;
      usedDiameters.add(cp.ledGrooveSpec.widthMm || 12);
      if ((cp.ledGrooveSpec.depthMm || 8) > T * 0.65) {
        issues.push({
          pieceId: cp.id,
          partName: partLabel,
          severity: "error",
          code: "GROOVE_COLLISION",
          messageTr: `LED kanal derinliği (${cp.ledGrooveSpec.depthMm} mm) panel kalınlığının %65'ini aşıyor.`,
        });
      }
    }
    const golaCount = cp.golaNotches?.length || 0;
    const cutoutCount = (cp.utilityCutouts?.length || 0) + (cp.hasSinkOrHobCutout ? 1 : 0);
    if (golaCount > 0 || cutoutCount > 0) {
      usedDiameters.add(12);
    }

    // 5. Rapid travel & cycle time estimation
    let rapidMm = 0;
    let curX = 0;
    let curY = 0;
    for (const d of drills) {
      rapidMm += Math.hypot(d.x - curX, d.y - curY);
      curX = d.x;
      curY = d.y;
    }
    const rapidMeters = roundMm(rapidMm / 1000, 2);
    const toolChanges = Math.max(drills.length > 0 || grooveOps > 0 ? 1 : 0, usedDiameters.size);
    const hasOps = drills.length > 0 || grooveOps > 0 || golaCount > 0 || cutoutCount > 0;
    const cycleSec = hasOps
      ? roundMm(
          6.0 +
            drills.length * 0.85 +
            grooveOps * 4.5 +
            golaCount * 5.2 +
            cutoutCount * 9.5 +
            toolChanges * 3.2 +
            rapidMeters * 0.45,
          1
        )
      : 0;

    const pieceErrs = issues.filter((x) => x.severity === "error").length;
    const pieceWarns = issues.filter((x) => x.severity === "warning").length;
    blockingErrors += pieceErrs;
    warnings += pieceWarns;
    totalDrills += drills.length;
    totalGrooves += grooveOps + golaCount + cutoutCount;
    totalSeconds += cycleSec * (cp.quantity || 1);

    pieceResults.push({
      pieceId: cp.id,
      partCode: cp.id,
      partName: partLabel,
      lengthMm: roundMm(L, 1),
      widthMm: roundMm(W, 1),
      thicknessMm: T,
      drillCount: drills.length,
      grooveCount: grooveOps,
      cutoutCount,
      golaNotchCount: golaCount,
      toolChangeCount: toolChanges,
      rapidTravelMeters: rapidMeters,
      estimatedCycleSeconds: cycleSec,
      passedSafetyChecks: pieceErrs === 0,
      issues,
    });
  }

  return {
    projectId: project.id,
    machineFormat: format,
    postProcessorCalibrationStatus: isCalibrated
      ? "TENANT_MACHINE_VERIFIED"
      : "UNVERIFIED_SIMULATION_ONLY",
    postProcessorDisclaimerTr: isCalibrated
      ? "Firma makine profili ve fiziksel deneme kesimi onaylıdır."
      : "DOĞRULAMA GEREKLİ: Makineye özel post-processor eksen yönü, takım magazini ve vakum papucu ofsetleri fiziksel deneme kesimiyle doğrulanmadan doğrudan seri üretime gönderilmemelidir.",
    canSendToMachineDirectly: isCalibrated && blockingErrors === 0,
    totalPanelsSimulated: bom.cutList.length,
    machinedPanelsCount: pieceResults.filter(
      (p) => p.drillCount > 0 || p.grooveCount > 0 || p.golaNotchCount > 0 || p.cutoutCount > 0
    ).length,
    totalDrillOps: totalDrills,
    totalGrooveAndNotchOps: totalGrooves,
    totalEstimatedMinutes: roundMm(totalSeconds / 60, 1),
    blockingErrorCount: blockingErrors,
    warningCount: warnings,
    pieces: pieceResults,
  };
}

/**
 * Generates an interactive-ready 2D SVG toolpath simulation diagram for a single `CutPiece`,
 * displaying panel bounds, rapid spindle travel vectors, color-coded drill diameters,
 * back/LED grooves, and Gola notches.
 */
export function generateCncToolpathSimulationSvg(piece: CutPiece): string {
  const cnc = mapCutPieceToCncPieceInput(piece);
  const L = Math.max(100, piece.netCutLengthMm ?? piece.lengthMm);
  const W = Math.max(80, piece.netCutWidthMm ?? piece.widthMm);
  const pad = 48;
  const vbW = L + pad * 2;
  const vbH = W + pad * 2;

  const drills = cnc.drillingOperations || [];
  const pathPoints: string[] = [`${pad},${pad + W}`];
  for (const d of drills) {
    const sx = pad + Math.min(L, Math.max(0, d.x));
    const sy = pad + W - Math.min(W, Math.max(0, d.y));
    pathPoints.push(`${roundMm(sx, 1)},${roundMm(sy, 1)}`);
  }

  const grooveRects: string[] = [];
  if (piece.hasBackGroove) {
    const gOff = piece.backGrooveOffsetMm || 18;
    const gW = piece.backGrooveWidthMm || 8.5;
    const gy = pad + W - gOff - gW;
    grooveRects.push(
      `<rect x="${pad}" y="${roundMm(gy, 1)}" width="${L}" height="${gW}" fill="rgba(217,119,6,0.24)" stroke="#d97706" stroke-width="1.5" />`
    );
  }
  if (piece.ledGrooveSpec?.enabled) {
    const ly = pad + (piece.ledGrooveSpec.offsetFromFrontMm || 75);
    const lw = piece.ledGrooveSpec.widthMm || 12;
    grooveRects.push(
      `<rect x="${pad}" y="${roundMm(ly, 1)}" width="${L}" height="${lw}" fill="rgba(14,165,233,0.22)" stroke="#0284c7" stroke-width="1.5" />`
    );
  }

  const golaRects = (piece.golaNotches || []).map((gn) => {
    const gx = pad + Math.min(L - gn.heightMm, Math.max(0, gn.yBottomMm));
    return `<rect x="${roundMm(gx, 1)}" y="${pad}" width="${gn.heightMm}" height="${gn.widthMm}" fill="rgba(220,38,38,0.2)" stroke="#dc2626" stroke-width="2" />`;
  });

  const drillCircles = drills.map((d, idx) => {
    const sx = pad + Math.min(L, Math.max(0, d.x));
    const sy = pad + W - Math.min(W, Math.max(0, d.y));
    const r = Math.max(3, d.diameter / 2);
    const isThrough = d.depth >= (piece.thicknessMm || 18) - 0.1;
    const color = d.diameter >= 30 ? "#7c3aed" : d.diameter >= 14 ? "#dc2626" : isThrough ? "#059669" : "#2563eb";
    return `<g><circle cx="${roundMm(sx, 1)}" cy="${roundMm(sy, 1)}" r="${roundMm(r, 1)}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="1.8" /><title>#${
      idx + 1
    } Ø${d.diameter}mm Z=${d.depth}mm (${d.face})</title></g>`;
  });

  const rapidPolyline =
    pathPoints.length > 1
      ? `<polyline points="${pathPoints.join(" ")}" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 4" />`
      : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" role="img" aria-label="CNC Takım Yolu Simülasyonu">`,
    `<rect x="0" y="0" width="${vbW}" height="${vbH}" fill="#f8fafc" rx="10" />`,
    `<rect x="${pad}" y="${pad}" width="${L}" height="${W}" fill="#ffffff" stroke="#0f172a" stroke-width="2.5" />`,
    ...grooveRects,
    ...golaRects,
    rapidPolyline,
    ...drillCircles,
    `<circle cx="${pad}" cy="${pad + W}" r="5" fill="#ef4444" />`,
    `<text x="${pad + 8}" y="${pad + W + 18}" font-family="monospace" font-size="13" fill="#334155">Orijin (0,0) • ${Math.round(
      L
    )}×${Math.round(W)}×${piece.thicknessMm} mm • ${drills.length} Delik</text>`,
    `</svg>`,
  ].join("");
}
