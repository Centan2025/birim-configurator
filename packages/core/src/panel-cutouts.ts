export type CutoutTargetPanel = "back" | "left_side" | "right_side" | "bottom";

export type UtilityCutoutKind =
  | "socket_single"
  | "socket_double"
  | "junction_box"
  | "cable_grommet"
  | "plumbing_pass"
  | "baseboard_notch";

export interface PanelCutoutConfig {
  id: string;
  targetPanel: CutoutTargetPanel;
  kind: UtilityCutoutKind;
  shape: "rect" | "circle" | "corner_notch";
  /** Center X in panel-local coordinates (mm from left/front edge) */
  centerXMm: number;
  /** Center Y in panel-local coordinates (mm from bottom edge) */
  centerYMm: number;
  widthMm: number;
  heightMm: number;
  diameterMm?: number;
  cornerRadiusMm?: number;
  label: string;
}

export interface UtilityCutoutPreset {
  kind: UtilityCutoutKind;
  label: string;
  shape: PanelCutoutConfig["shape"];
  defaultTargetPanel: CutoutTargetPanel;
  widthMm: number;
  heightMm: number;
  diameterMm?: number;
  cornerRadiusMm?: number;
  defaultYMm: number;
}

export const STANDARD_UTILITY_CUTOUT_PRESETS: UtilityCutoutPreset[] = [
  {
    kind: "socket_single",
    label: "Tekli Priz / Anahtar Boşaltması (82×82 mm)",
    shape: "rect",
    defaultTargetPanel: "back",
    widthMm: 82,
    heightMm: 82,
    cornerRadiusMm: 6,
    defaultYMm: 350,
  },
  {
    kind: "socket_double",
    label: "İkili Priz Kasası Boşaltması (154×82 mm)",
    shape: "rect",
    defaultTargetPanel: "back",
    widthMm: 154,
    heightMm: 82,
    cornerRadiusMm: 6,
    defaultYMm: 350,
  },
  {
    kind: "cable_grommet",
    label: "TV / LED Kablo Geçiş Buat Deliği (Ø60 mm)",
    shape: "circle",
    defaultTargetPanel: "back",
    widthMm: 60,
    heightMm: 60,
    diameterMm: 60,
    defaultYMm: 600,
  },
  {
    kind: "plumbing_pass",
    label: "Temiz / Pis Su Tesisat Geçişi (140×140 mm)",
    shape: "rect",
    defaultTargetPanel: "back",
    widthMm: 140,
    heightMm: 140,
    cornerRadiusMm: 10,
    defaultYMm: 480,
  },
  {
    kind: "baseboard_notch",
    label: "Duvar Süpürgelik Arka Çentiği (20×100 mm)",
    shape: "corner_notch",
    defaultTargetPanel: "left_side",
    widthMm: 20,
    heightMm: 100,
    cornerRadiusMm: 0,
    defaultYMm: 50,
  },
];

export interface CutoutValidationIssue {
  cutoutId: string;
  severity: "error" | "warning";
  message: string;
}

/**
 * Validates structural edge clearance (min 35mm on closed cutouts) and System 32 drilling row collisions.
 */
export function validatePanelCutouts(
  moduleDims: { width: number; height: number; depth: number },
  panelThicknessMm: number,
  cutouts: PanelCutoutConfig[]
): CutoutValidationIssue[] {
  const issues: CutoutValidationIssue[] = [];
  const minEdgeMarginMm = 35;

  for (const c of cutouts) {
    const panelW =
      c.targetPanel === "back"
        ? Math.max(100, moduleDims.width - 2 * panelThicknessMm + 16)
        : c.targetPanel === "bottom"
        ? Math.max(100, moduleDims.width - 2 * panelThicknessMm)
        : moduleDims.depth;
    const panelH =
      c.targetPanel === "bottom" ? moduleDims.depth : moduleDims.height;

    const halfW = (c.shape === "circle" ? c.diameterMm ?? c.widthMm : c.widthMm) / 2;
    const halfH = (c.shape === "circle" ? c.diameterMm ?? c.heightMm : c.heightMm) / 2;

    if (c.shape === "corner_notch") {
      if (c.widthMm > 60 || c.heightMm > 220) {
        issues.push({
          cutoutId: c.id,
          severity: "warning",
          message: `${c.label}: Süpürgelik çentiği (${c.widthMm}×${c.heightMm} mm) yan panel taşıyıcı kesitini zayıflatabilir (önerilen maks. 60×220 mm).`,
        });
      }
      continue;
    }

    const leftClear = c.centerXMm - halfW;
    const rightClear = panelW - (c.centerXMm + halfW);
    const botClear = c.centerYMm - halfH;
    const topClear = panelH - (c.centerYMm + halfH);

    if (
      leftClear < minEdgeMarginMm ||
      rightClear < minEdgeMarginMm ||
      botClear < minEdgeMarginMm ||
      topClear < minEdgeMarginMm
    ) {
      issues.push({
        cutoutId: c.id,
        severity: "error",
        message: `${c.label}: CNC boşaltma panel kenarına ${minEdgeMarginMm} mm'den fazla yaklaşıyor; taşıyıcı köprü kırılma riski var.`,
      });
    }

    if (
      (c.targetPanel === "left_side" || c.targetPanel === "right_side") &&
      c.centerXMm - halfW <= 45 &&
      c.centerXMm + halfW >= 29
    ) {
      issues.push({
        cutoutId: c.id,
        severity: "warning",
        message: `${c.label}: Yan panel boşaltması 37 mm System 32 raf/menteşe delik aksı ile kesişiyor.`,
      });
    }
  }

  return issues;
}

/**
 * Automatically derives rear panel CNC cutouts when a cabinet sits in front of a wall plumbing/socket element.
 */
export function detectWallUtilityCutoutsForModule(
  mod: {
    id: string;
    position: { x: number; y: number; z: number };
    dimensions: { width: number; height: number; depth: number };
    carcass: { panelThickness: number; plinthHeight: number };
  },
  obstacles: Array<{
    id: string;
    type: string;
    name?: string;
    position: { x: number; y: number; z: number };
    dimensions: { width: number; height: number; depth: number };
  }>
): PanelCutoutConfig[] {
  const T = mod.carcass.panelThickness || 18;
  const generated: PanelCutoutConfig[] = [];

  for (const obs of obstacles) {
    if (obs.type !== "plumbing" && obs.type !== "socket" && obs.type !== "electrical") continue;
    // Must sit near rear wall (z <= 120mm) and overlap module X & Y bounds
    if (Math.abs(obs.position.z - mod.position.z) > 140) continue;

    const overlapX0 = Math.max(mod.position.x + T + 35, obs.position.x);
    const overlapX1 = Math.min(
      mod.position.x + mod.dimensions.width - T - 35,
      obs.position.x + obs.dimensions.width
    );
    const overlapY0 = Math.max(mod.position.y + mod.carcass.plinthHeight + T + 35, obs.position.y);
    const overlapY1 = Math.min(
      mod.position.y + mod.dimensions.height - T - 35,
      obs.position.y + obs.dimensions.height
    );

    if (overlapX1 - overlapX0 >= 30 && overlapY1 - overlapY0 >= 30) {
      const localCenterX = Math.round((overlapX0 + overlapX1) / 2 - (mod.position.x + T - 8));
      const localCenterY = Math.round(
        (overlapY0 + overlapY1) / 2 - (mod.position.y + mod.carcass.plinthHeight + T - 8)
      );
      const isPlumbing = obs.type === "plumbing";
      generated.push({
        id: `auto_cutout_${mod.id}_${obs.id}`,
        targetPanel: "back",
        kind: isPlumbing ? "plumbing_pass" : "socket_double",
        shape: "rect",
        centerXMm: localCenterX,
        centerYMm: localCenterY,
        widthMm: Math.min(260, Math.max(82, Math.round(overlapX1 - overlapX0 + 20))),
        heightMm: Math.min(260, Math.max(82, Math.round(overlapY1 - overlapY0 + 20))),
        cornerRadiusMm: 8,
        label: obs.name || (isPlumbing ? "Otomatik Tesisat Boşaltması" : "Otomatik Priz Boşaltması"),
      });
    }
  }

  return generated;
}
