import { DesignProject } from "../types";
import { autoNotchModulesAroundObstacles } from "../scene-objects-engine";
import { calculateBayWidths, calculateNetInnerHeight } from "../rules";
import { roundGeometryMm } from "../tolerance-policy";
import type { EngineeringValidationFinding, RemediationProposal } from "./stability-and-deflection";
import { evaluateUnifiedEngineeringModel } from "../engineering-validation-engine";

/**
 * Kullanıcı tarafından açıkça onaylanan tekil bir düzeltme önerisini (RemediationProposal)
 * sessiz yan etki yaratmadan projeye uygular ve yeni bir DesignProject kopyası döndürür (Bölüm 9).
 */
export function applyApprovedRemediationProposal(
  project: DesignProject,
  proposal: RemediationProposal
): DesignProject {
  const next: DesignProject = JSON.parse(JSON.stringify(project));
  const mod = next.modules.find((m) => m.id === proposal.targetModuleId);
  if (!mod) return next;

  switch (proposal.patchKind) {
    case "enable_wall_anchor": {
      if (proposal.patchPayload.wallAnchored) mod.carcass.wallAnchored = true;
      if (proposal.patchPayload.floorAnchored) mod.carcass.floorAnchored = true;
      break;
    }
    case "increase_module_depth": {
      const newD = Number(proposal.patchPayload.depth);
      if (Number.isFinite(newD) && newD >= 250) mod.dimensions.depth = newD;
      break;
    }
    case "add_internal_drawer_spacer": {
      const requestedSol = String(proposal.patchPayload?.internalDrawerHingeSolution || "");
      mod.carcass.internalDrawerHingeSolution =
        requestedSol === "blind_panel_filler" ? "blind_panel_filler" : "spacer_block_25mm";
      if (requestedSol === "blind_panel_filler") {
        const reqW = Number(proposal.patchPayload?.internalDrawerBlindWidthMm);
        if (Number.isFinite(reqW) && reqW >= 32 && reqW <= 100) {
          mod.carcass.internalDrawerBlindWidthMm = Math.round(reqW);
        }
      }
      break;
    }
    case "switch_hinge_155_zero": {
      const bIdx = proposal.targetBayIndex ?? 0;
      if (mod.bays[bIdx]?.door) {
        mod.bays[bIdx].door.hardwareProductId = "hw_blum_71b7550";
      }
      break;
    }
    case "switch_single_to_double_door": {
      const bIdx = proposal.targetBayIndex ?? 0;
      if (mod.bays[bIdx]?.door) {
        mod.bays[bIdx].door.type = "double";
        mod.bays[bIdx].door.doorSystemId = "hinged_double";
      }
      break;
    }
    case "enable_siphon_cutout": {
      const bIdx = proposal.targetBayIndex ?? 0;
      const drw = mod.bays[bIdx]?.drawers.find((d) => d.id === proposal.targetComponentId);
      if (drw) drw.hasSiphonCutout = true;
      break;
    }
    case "reduce_drawer_runner_nl": {
      const bIdx = proposal.targetBayIndex ?? 0;
      const drw = mod.bays[bIdx]?.drawers.find((d) => d.id === proposal.targetComponentId);
      const nl = Number(proposal.patchPayload.nominalLengthMm);
      if (drw && Number.isFinite(nl)) drw.nominalLengthMm = nl;
      break;
    }
    case "add_wall_filler_50mm": {
      const shiftX = Number(proposal.patchPayload.shiftXMm || 0);
      mod.position.x = Math.max(0, mod.position.x + shiftX);
      break;
    }
    case "increase_plinth_for_ventilation": {
      const ph = Number(proposal.patchPayload.plinthHeight);
      const dp = Number(proposal.patchPayload.depth);
      if (Number.isFinite(ph)) mod.carcass.plinthHeight = ph;
      if (Number.isFinite(dp)) mod.dimensions.depth = dp;
      break;
    }
    case "snap_stacked_to_support_or_floor": {
      const py = Number(proposal.patchPayload.positionY ?? 0);
      if (Number.isFinite(py)) mod.position.y = Math.max(0, py);
      break;
    }
    case "align_stacked_width_to_base": {
      const px = Number(proposal.patchPayload.positionX);
      const w = Number(proposal.patchPayload.width);
      if (Number.isFinite(px)) mod.position.x = px;
      if (Number.isFinite(w) && w >= 250) mod.dimensions.width = w;
      break;
    }
    case "expand_module_width": {
      const w = Number(proposal.patchPayload.width);
      if (Number.isFinite(w) && w >= 250) mod.dimensions.width = w;
      break;
    }
    case "switch_handle_to_knob": {
      const bIdx = proposal.targetBayIndex ?? 0;
      if (mod.bays[bIdx]?.door) {
        mod.bays[bIdx].door.handleCategory = "knob";
      }
      break;
    }
    case "clamp_height_to_usable_sheet": {
      const h = Number(proposal.patchPayload.height);
      if (Number.isFinite(h) && h >= 300) {
        mod.dimensions.height = h;
      }
      break;
    }
    case "clamp_width_to_usable_sheet": {
      const w = Number(proposal.patchPayload.width);
      if (Number.isFinite(w) && w >= 250) {
        const prevW = mod.dimensions.width || w;
        mod.dimensions.width = w;
        if (prevW > 0 && w !== prevW) {
          const ratio = w / prevW;
          for (const b of mod.bays) {
            if (typeof b.customWidth === "number" && b.customWidth > 0) {
              b.customWidth = Math.max(200, Math.round(b.customWidth * ratio));
            }
          }
        }
      }
      break;
    }
    case "upgrade_shelf_thickness_25mm": {
      const t = Number(proposal.patchPayload.thickness);
      if (Number.isFinite(t) && t >= 8) {
        if (proposal.patchPayload.applyToModule) {
          const matchGlass = Boolean(proposal.patchPayload.isGlass);
          for (const bay of mod.bays) {
            for (const shelf of bay.shelves) {
              if (Boolean(shelf.isGlass) === matchGlass && (shelf.thickness ?? 18) < t) {
                shelf.thickness = t;
              }
            }
          }
        } else {
          const bIdx = proposal.targetBayIndex ?? 0;
          const sh = mod.bays[bIdx]?.shelves.find((s) => s.id === proposal.targetComponentId);
          if (sh) sh.thickness = t;
        }
      }
      break;
    }
    case "increase_hinge_count": {
      const bIdx = proposal.targetBayIndex ?? 0;
      const hc = Number(proposal.patchPayload.hingeCount);
      if (mod.bays[bIdx]?.door && Number.isFinite(hc) && hc >= 2 && hc <= 5) {
        mod.bays[bIdx].door.hingeCount = hc;
      }
      break;
    }
    case "confirm_wall_substrate": {
      const sub = String(proposal.patchPayload.wallSubstrateType || "reinforced_concrete");
      next.space.wallSubstrateType = sub as NonNullable<DesignProject["space"]["wallSubstrateType"]>;
      break;
    }
    case "upgrade_wet_zone_board": {
      const matId = String(proposal.patchPayload.bodyMaterialId || "mat_lacquer_cream");
      mod.carcass.bodyMaterialId = matId;
      break;
    }
    case "switch_topology_sides_through": {
      mod.carcass.carcassJoineryTopology = "sides_through";
      break;
    }
    case "convert_mid_shelf_to_fixed": {
      const bIdx = proposal.targetBayIndex ?? 0;
      const targetId = String(proposal.patchPayload.shelfId || proposal.targetComponentId || "");
      const bay = mod.bays[bIdx];
      if (bay && bay.shelves.length > 0) {
        const sh = bay.shelves.find((s) => s.id === targetId) || bay.shelves[Math.floor(bay.shelves.length / 2)];
        if (sh) {
          sh.isAdjustable = false;
          sh.isFixed = true;
          sh.fixedConnectorType = sh.fixedConnectorType || "minifix_dowel";
        }
      }
      break;
    }
    case "convert_high_drawers_to_shelves": {
      const bIdx = proposal.targetBayIndex ?? 0;
      const bay = mod.bays[bIdx];
      if (bay) {
        const T = mod.carcass.panelThickness || 18;
        const plinth = mod.carcass.plinthHeight || 0;
        const sightlineMm = Number(proposal.patchPayload.maxSightlineWorldYMm || 1450);
        const netInnerH = Math.max(200, mod.dimensions.height - plinth - 2 * T);
        const keptDrawers = bay.drawers
          .filter((d) => mod.position.y + plinth + T + d.elevationY + d.height <= sightlineMm)
          .sort((a, b) => a.elevationY - b.elevationY);
        bay.drawers = keptDrawers;
        const lowerZoneTopLocalY =
          keptDrawers.length > 0
            ? Math.max(...keptDrawers.map((d) => d.elevationY + d.height))
            : 0;
        const upperSpanMm = netInnerH - lowerZoneTopLocalY;
        bay.shelves = (bay.shelves || []).filter((s) => s.elevationY < lowerZoneTopLocalY - 10);
        if (keptDrawers.length > 0 && upperSpanMm >= 180) {
          bay.shelves.push({
            id: `shf_erg_div_${mod.id}_${bIdx}`,
            bayIndex: bIdx,
            elevationY: Math.round(lowerZoneTopLocalY),
            isAdjustable: false,
            isFixed: true,
            fixedConnectorType: "minifix_dowel",
          });
        }
        const shelfCount = Math.max(1, Math.min(4, Math.floor(upperSpanMm / 340)));
        const stepMm = upperSpanMm / (shelfCount + 1);
        for (let si = 1; si <= shelfCount; si++) {
          const rawY = lowerZoneTopLocalY + si * stepMm;
          const snapped32Y = Math.min(netInnerH - 80, Math.max(lowerZoneTopLocalY + 96, Math.round(rawY / 32) * 32));
          if (!bay.shelves.some((s) => Math.abs(s.elevationY - snapped32Y) < 48)) {
            bay.shelves.push({
              id: `shf_erg_${mod.id}_${bIdx}_${si}`,
              bayIndex: bIdx,
              elevationY: snapped32Y,
              isAdjustable: true,
              isFixed: false,
            });
          }
        }
        if (!mod.isOpenFront && (!bay.door || bay.door.type === "open" || bay.door.doorSystemId === "open")) {
          const bayWidths = calculateBayWidths(mod);
          const bW = bayWidths[bIdx] || mod.dimensions.width - 2 * T;
          bay.door = {
            ...(bay.door || {
              id: `door_erg_${mod.id}_${bIdx}`,
              materialId: mod.carcass.bodyMaterialId,
              handleType: "bar",
            }),
            type: bW > 600 ? "double" : "single_left",
            doorSystemId: bW > 600 ? "hinged_double" : "hinged_single",
          };
        }
      }
      break;
    }
    case "switch_high_drawers_to_push_open": {
      const bIdx = proposal.targetBayIndex ?? 0;
      const bay = mod.bays[bIdx];
      if (bay) {
        if (bay.door) {
          bay.door.handleCategory = "handleless_plain";
          bay.door.handleProfileId = "hnd_none";
          bay.door.handleType = "push_to_open";
          bay.door.openingTechnology = "push_to_open";
        }
        bay.drawers.forEach((d) => {
          d.slideType = "push_to_open";
        });
      }
      break;
    }
    case "auto_notch_obstacles": {
      let seedEls: import("../types").ArchitecturalElement[] | undefined;
      if (typeof proposal.patchPayload?.obstaclesJson === "string") {
        try {
          seedEls = JSON.parse(proposal.patchPayload.obstaclesJson);
        } catch {
          seedEls = undefined;
        }
      }
      if ((!next.space.elements || next.space.elements.length === 0) && seedEls && seedEls.length > 0) {
        next.space.elements = seedEls;
      }
      const { updatedModules } = autoNotchModulesAroundObstacles(next, seedEls);
      next.modules = updatedModules;
      break;
    }
    case "resize_before_obstacle": {
      const reqW = Number(proposal.patchPayload?.width);
      if (Number.isFinite(reqW) && reqW >= 250) {
        mod.dimensions.width = Math.round(reqW);
      }
      const reqX = Number(proposal.patchPayload?.positionX);
      if (Number.isFinite(reqX) && reqX >= 0) {
        mod.position.x = Math.round(reqX);
      }
      break;
    }
  }

  next.version = (next.version || 1) + 1;
  next.updatedAt = new Date().toISOString();
  return next;
}

export class ProductionGateBlockedError extends Error {
  public readonly blockingErrors: EngineeringValidationFinding[];

  constructor(message: string, blockingErrors: EngineeringValidationFinding[]) {
    super(message);
    this.name = "ProductionGateBlockedError";
    this.blockingErrors = blockingErrors;
  }
}

/**
 * Üretim Çıkış Kapısı (P0-02):
 * Fiziksel olarak hatalı, çakışmalı, devrilme riskli veya donanım açısından uyumsuz
 * tasarımların CNC, DXF, OptiCut CSV veya ERP üretim emrine dönüşmesini engeller.
 */
export function assertProductionExportAllowed(
  project: DesignProject,
  options?: { requireFactorySampleVerification?: boolean }
): ReturnType<typeof evaluateUnifiedEngineeringModel> {
  const report = evaluateUnifiedEngineeringModel(project);
  if (!report.canExportToCncAndSaw) {
    const summary = report.blockingSafetyAndEngineeringErrors
      .slice(0, 4)
      .map((e) => `[${e.code}] ${e.message}`)
      .join(" | ");
    throw new ProductionGateBlockedError(
      `ÜRETİM ENGELİ: Tasarımda ${report.blockingSafetyAndEngineeringErrors.length} adet kritik mühendislik/güvenlik hatası bulunuyor ve üretime aktarılamaz. Detay: ${summary}`,
      report.blockingSafetyAndEngineeringErrors
    );
  }
  if (options?.requireFactorySampleVerification && !report.canApproveFinalErpRelease) {
    const vSummary = report.verificationRequiredFindings
      .slice(0, 3)
      .map((e) => `[${e.code}] ${e.message}`)
      .join(" | ");
    throw new ProductionGateBlockedError(
      `DOĞRULAMA BEKLİYOR: Tasarımda doğrulanmamış teknik kaynak veya fabrika numune onayı eksikliği var. Detay: ${vSummary}`,
      report.verificationRequiredFindings
    );
  }
  return report;
}
