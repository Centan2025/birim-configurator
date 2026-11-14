import type { ModuleInstance } from "@birim/core";
import type { Rect2D } from "@birim/geometry";

export type ElevationDetailLevel = "clean" | "selected" | "technical";
export type ElevationDisplayUnit = "mm" | "cm";

const DETAIL_LEVEL_STORAGE_KEY = "birim_v4_elev_detail_level";
const DISPLAY_UNIT_STORAGE_KEY = "birim_v4_elev_display_unit";

export function loadElevationDetailLevel(): ElevationDetailLevel {
  if (typeof window === "undefined") return "selected";
  const saved = window.localStorage.getItem(DETAIL_LEVEL_STORAGE_KEY);
  if (saved === "clean" || saved === "selected" || saved === "technical") {
    return saved;
  }
  return "selected";
}

export function saveElevationDetailLevel(level: ElevationDetailLevel): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DETAIL_LEVEL_STORAGE_KEY, level);
  }
}

export function loadElevationDisplayUnit(): ElevationDisplayUnit {
  if (typeof window === "undefined") return "mm";
  const saved = window.localStorage.getItem(DISPLAY_UNIT_STORAGE_KEY);
  if (saved === "mm" || saved === "cm") {
    return saved;
  }
  return "mm";
}

export function saveElevationDisplayUnit(unit: ElevationDisplayUnit): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DISPLAY_UNIT_STORAGE_KEY, unit);
  }
}

/**
 * Formats a canonical millimeter value into the active display unit (`mm` or `cm`)
 * without mutating or rounding the underlying canonical model data.
 */
export function formatElevationValue(
  valueMm: number,
  unit: ElevationDisplayUnit,
  withUnitSuffix = true
): string {
  const safeMm = Number.isFinite(valueMm) ? valueMm : 0;
  if (unit === "cm") {
    const cmVal = +(safeMm / 10).toFixed(1);
    return withUnitSuffix ? `${cmVal} cm` : `${cmVal}`;
  }
  const mmVal = Math.round(safeMm);
  return withUnitSuffix ? `${mmVal} mm` : `${mmVal}`;
}

/**
 * Converts a numeric value from the active display unit back into canonical millimeters.
 */
export function toCanonicalMm(displayValue: number, unit: ElevationDisplayUnit): number {
  if (!Number.isFinite(displayValue)) return 0;
  return unit === "cm" ? Math.round(displayValue * 10) : Math.round(displayValue);
}

/**
 * Converts a canonical millimeter value to the numeric value shown in inputs.
 */
export function toDisplayUnitNumber(valueMm: number, unit: ElevationDisplayUnit): number {
  if (!Number.isFinite(valueMm)) return 0;
  return unit === "cm" ? +(valueMm / 10).toFixed(1) : Math.round(valueMm);
}

/**
 * Truncates long CAD labels so they fit within narrow bays or small modules without overlapping handles.
 */
export function truncateCadLabel(
  text: string,
  availableWidthMm: number,
  approxCharWidthMm = 13
): string {
  if (!text) return "";
  const maxChars = Math.max(4, Math.floor(availableWidthMm / Math.max(6, approxCharWidthMm)));
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(3, maxChars - 1))}…`;
}

export interface ElevationLabelVisibility {
  showModuleBanner: boolean;
  showNeighborHeader: boolean;
  showDimensionLines: boolean;
  showResizeHandles: boolean;
  showInteriorItemLabel: boolean;
  showHardwareLabel: boolean;
  showDividerBadge: boolean;
  showPlinthLabel: boolean;
}

/**
 * Centralizes visibility rules for the 3-level elevation detail system:
 * - `clean`: Geometry + essential module borders only; hides passive labels, Blum tags, and resize handles.
 * - `selected` (default): Highlights the active/selected/hovered item; reduces noise on unselected/neighbor modules.
 * - `technical`: Exposes all engineering dimensions, elevations, hardware coordinates, and references.
 */
export function resolveElevationLabelVisibility(
  level: ElevationDetailLevel,
  opts: {
    isActiveModule: boolean;
    isSelected: boolean;
    isHovered: boolean;
    isDragging: boolean;
    hasInteriorSelection: boolean;
  }
): ElevationLabelVisibility {
  const { isActiveModule, isSelected, isHovered, isDragging, hasInteriorSelection } = opts;

  if (level === "clean") {
    return {
      showModuleBanner: isActiveModule,
      showNeighborHeader: false,
      showDimensionLines: false,
      showResizeHandles: isDragging,
      showInteriorItemLabel: isSelected || isDragging || isHovered,
      showHardwareLabel: isSelected || isHovered,
      showDividerBadge: isSelected || isDragging,
      showPlinthLabel: false,
    };
  }

  if (level === "technical") {
    return {
      showModuleBanner: true,
      showNeighborHeader: true,
      showDimensionLines: true,
      showResizeHandles: isActiveModule,
      showInteriorItemLabel: true,
      showHardwareLabel: true,
      showDividerBadge: true,
      showPlinthLabel: true,
    };
  }

  // Default: "selected"
  return {
    showModuleBanner: isActiveModule,
    showNeighborHeader: isHovered,
    showDimensionLines: isActiveModule,
    showResizeHandles: isActiveModule && !hasInteriorSelection,
    showInteriorItemLabel: isSelected || isDragging || isHovered,
    showHardwareLabel: isSelected || isHovered,
    showDividerBadge: isSelected || isDragging || isHovered,
    showPlinthLabel: isActiveModule && !hasInteriorSelection,
  };
}

export type ElevationSelectedKind =
  | "module"
  | "shelf"
  | "drawer"
  | "rail"
  | "hinge"
  | "special_fitting"
  | "divider"
  | "sub_divider"
  | "other_part";

export interface ElevationSelectedContext {
  kind: ElevationSelectedKind;
  title: string;
  subtitle: string;
  moduleId: string;
  moduleName: string;
  moduleIndex: number;
  bayIndex?: number;
  targetId?: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  elevationYMm?: number;
  positionXMm: number;
  positionYMm: number;
  hardwareBrand?: string;
  canDelete: boolean;
}

/**
 * Resolves rich contextual metadata for the currently selected 2D Elevation object
 * (shelf, drawer, hanging rail, Blum hinge, special fitting, divider, or active module).
 */
export function resolveSelectedElevationContext(
  activeModule: ModuleInstance | undefined,
  activeModuleIndex: number,
  selectedComponentId: string | null,
  elements: Rect2D[]
): ElevationSelectedContext | null {
  if (!activeModule || activeModule.id === "empty_scene_placeholder") return null;

  const base = {
    moduleId: activeModule.id,
    moduleName: activeModule.name,
    moduleIndex: activeModuleIndex,
    positionXMm: activeModule.position.x,
    positionYMm: activeModule.position.y,
  };

  if (!selectedComponentId) {
    return {
      ...base,
      kind: "module",
      title: activeModule.name,
      subtitle: `${activeModule.bays.length} Bölme`,
      widthMm: activeModule.dimensions.width,
      heightMm: activeModule.dimensions.height,
      depthMm: activeModule.dimensions.depth,
      canDelete: false,
    };
  }

  for (let bIdx = 0; bIdx < activeModule.bays.length; bIdx++) {
    const bay = activeModule.bays[bIdx];

    const bayWidthMm =
      bay.customWidth ?? Math.round(activeModule.dimensions.width / activeModule.bays.length);

    const shelfIdx = bay.shelves.findIndex(
      (s, idx) => s.id === selectedComponentId || `${activeModule.id}_bay_${bIdx}_shelf_${idx}` === selectedComponentId
    );
    if (shelfIdx >= 0) {
      const shelf = bay.shelves[shelfIdx];
      return {
        ...base,
        kind: "shelf",
        title: `Raf (Bölme ${bIdx + 1})`,
        subtitle: `Kalınlık ${shelf.thickness ?? activeModule.carcass.panelThickness} mm`,
        bayIndex: bIdx,
        targetId: shelf.id,
        widthMm: bayWidthMm,
        heightMm: shelf.thickness ?? activeModule.carcass.panelThickness,
        depthMm: activeModule.dimensions.depth,
        elevationYMm: shelf.elevationY,
        canDelete: true,
      };
    }

    const drawer = bay.drawers.find(
      (d) => selectedComponentId === d.id || selectedComponentId.startsWith(`${d.id}_`)
    );
    if (drawer) {
      return {
        ...base,
        kind: "drawer",
        title: `Çekmece (Bölme ${bIdx + 1})`,
        subtitle: drawer.slideType || "Frenli Ray",
        bayIndex: bIdx,
        targetId: drawer.id,
        widthMm: bayWidthMm,
        heightMm: drawer.height,
        depthMm: activeModule.dimensions.depth,
        elevationYMm: drawer.elevationY,
        hardwareBrand: drawer.slideType,
        canDelete: true,
      };
    }

    const railIdx = bay.hangingRails.findIndex(
      (r, idx) => r.id === selectedComponentId || `${activeModule.id}_bay_${bIdx}_rail_${idx}` === selectedComponentId
    );
    if (railIdx >= 0) {
      const rail = bay.hangingRails[railIdx];
      return {
        ...base,
        kind: "rail",
        title: `Askılık Borusu (Bölme ${bIdx + 1})`,
        subtitle: "Ø25 mm Krom Askı",
        bayIndex: bIdx,
        targetId: rail.id,
        widthMm: bayWidthMm,
        heightMm: 25,
        depthMm: activeModule.dimensions.depth,
        elevationYMm: rail.elevationY,
        canDelete: true,
      };
    }

    const fitIdx = (bay.specialFittings || []).findIndex(
      (f, idx) => f.id === selectedComponentId || `${activeModule.id}_bay_${bIdx}_fit_${idx}` === selectedComponentId
    );
    if (fitIdx >= 0) {
      const fit = bay.specialFittings![fitIdx];
      const matchedFitEl = elements.find((el) => el.id === selectedComponentId);
      return {
        ...base,
        kind: "special_fitting",
        title: matchedFitEl?.label || "Özel Donanım",
        subtitle: fit.type || "Donanım",
        bayIndex: bIdx,
        targetId: fit.id,
        widthMm: bayWidthMm,
        heightMm: fit.height || 150,
        depthMm: activeModule.dimensions.depth,
        elevationYMm: fit.elevationY,
        hardwareBrand: fit.type,
        canDelete: true,
      };
    }

    const subDivIdx = (bay.subDividers || []).findIndex(
      (sd, idx) => sd.id === selectedComponentId || `${activeModule.id}_bay_${bIdx}_subdiv_${idx}` === selectedComponentId
    );
    if (subDivIdx >= 0) {
      const sd = bay.subDividers![subDivIdx];
      return {
        ...base,
        kind: "sub_divider",
        title: `Raf Dikmesi (Bölme ${bIdx + 1})`,
        subtitle: `Ofset X: ${sd.offsetX} mm`,
        bayIndex: bIdx,
        targetId: sd.id,
        widthMm: sd.thickness ?? activeModule.carcass.panelThickness,
        heightMm: sd.height,
        depthMm: activeModule.dimensions.depth,
        elevationYMm: sd.elevationY,
        canDelete: true,
      };
    }
  }

  const matchedEl = elements.find((el) => el.id === selectedComponentId);
  if (matchedEl?.role === "door_hinge") {
    const brand = matchedEl.label.includes("Hettich")
      ? "Hettich"
      : matchedEl.label.includes("Salice")
      ? "Salice"
      : "Blum";
    const yMatch = matchedEl.label.match(/Y:(\d+)mm/);
    return {
      ...base,
      kind: "hinge",
      title: `${brand} Menteşe`,
      subtitle: matchedEl.label,
      widthMm: Math.round(matchedEl.width),
      heightMm: Math.round(matchedEl.height),
      depthMm: activeModule.dimensions.depth,
      elevationYMm: yMatch ? Number(yMatch[1]) : undefined,
      hardwareBrand: brand,
      canDelete: false,
    };
  }

  if (matchedEl?.role === "carcass_divider") {
    return {
      ...base,
      kind: "divider",
      title: "Ana Dikme",
      subtitle: matchedEl.label,
      widthMm: Math.round(matchedEl.width),
      heightMm: Math.round(matchedEl.height),
      depthMm: activeModule.dimensions.depth,
      canDelete: false,
    };
  }

  return {
    ...base,
    kind: matchedEl ? "other_part" : "module",
    title: matchedEl ? matchedEl.label : activeModule.name,
    subtitle: matchedEl ? matchedEl.role : `${activeModule.bays.length} Bölme`,
    widthMm: matchedEl ? Math.round(matchedEl.width) : activeModule.dimensions.width,
    heightMm: matchedEl ? Math.round(matchedEl.height) : activeModule.dimensions.height,
    depthMm: activeModule.dimensions.depth,
    canDelete: false,
  };
}
