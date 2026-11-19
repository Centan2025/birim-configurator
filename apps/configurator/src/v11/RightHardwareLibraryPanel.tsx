"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Search,
  Star,
  Clock,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Eye,
  ExternalLink,
  Plus,
  Info,
  X,
  Wrench,
  ShieldAlert,
  Filter,
  Play,
  Trash2,
  Sparkles,
} from "lucide-react";
import {
  HARDWARE_PRODUCTION_STATUS_META,
  evaluateHardwareAfterModuleResize,
  evaluateHardwareMountPlacement,
  resolveHardwareProductionStatus,
  type HardwareProductionStatus,
  type ModuleInstance,
} from "@birim/core";
import {
  HARDWARE_CATEGORY_GROUPS,
  PROJECT_HARDWARE_PACKAGES,
  CORE_FACTORY_VERIFICATION_IDS,
  getAllHardwareProducts,
  getHardwareProductById,
  type HardwareCategoryGroupId,
  type HardwareProductRecord,
  type HardwareUsagePurpose,
} from "@birim/catalog";
import { useConfiguratorStore, type UserExperienceTier } from "../store/useConfiguratorStore";

const FAVORITES_STORAGE_KEY = "birim_hw_favorites_v1";
const RECENTS_STORAGE_KEY = "birim_hw_recents_v1";

const USAGE_PURPOSE_LABELS: Record<HardwareUsagePurpose, string> = {
  kitchen: "Mutfak",
  wardrobe: "Gardırop",
  handleless: "Kulpsuz",
  heavy_duty: "Ağır Yük",
  corner: "Köşe",
  interior_org: "İç Düzen",
  structural: "Gövde / Montaj",
  living: "Yaşam / TV",
};

type QuickScope = "all" | "compatible" | "favorites" | "recents";


function formatBrandLabel(rawName?: string): string {
  const n = (rawName || "").trim();
  if (!n) return "Birim";
  if (/blum/i.test(n)) return "Blum";
  if (/hettich/i.test(n)) return "Hettich";
  if (/h[aä]fele/i.test(n)) return "Häfele";
  if (/kesseb[oö]hmer/i.test(n)) return "Kesseböhmer";
  if (/vauth/i.test(n)) return "Vauth-Sagel";
  if (/samet/i.test(n)) return "Samet";
  if (/birim/i.test(n)) return "Birim";
  return n.split(" ")[0];
}

export interface RightHardwareLibraryPanelProps {
  activeModule: ModuleInstance;
  activeBayIndex: number;
  experienceTier: UserExperienceTier;
  onApplyHardware: (
    bayIndex: number,
    hardwareProductId: string,
    options?: { drawerId?: string; forceApply?: boolean }
  ) => { applied: boolean; messageTr: string };
  onOpenCustomHardwareModal?: () => void;
}

/**
 * Generates crisp inline SVG markup for both React cards and the floating 3D drag cursor ghost.
 */
function getHardwareSvgInnerMarkup(
  familyId: HardwareCategoryGroupId,
  showCallout = false
): string {
  switch (familyId) {
    case "fam_hinge_concealed":
      return `
        <rect x="6" y="10" width="12" height="52" rx="2" fill="#E7DEC8" stroke="#8C6D46" stroke-width="1.4"/>
        <circle cx="34" cy="36" r="15" fill="#F1EFEA" stroke="#1C1917" stroke-width="1.8"/>
        <circle cx="34" cy="36" r="8" fill="#E2DDD3" stroke="#78716C" stroke-dasharray="2.5 2"/>
        <circle cx="25" cy="19" r="2.6" fill="#2563EB"/>
        <circle cx="25" cy="53" r="2.6" fill="#2563EB"/>
        <rect x="47" y="29" width="40" height="14" rx="3.5" fill="#D6D3CD" stroke="#1C1917" stroke-width="1.8"/>
        <rect x="74" y="18" width="18" height="36" rx="2.5" fill="#C4BFAF" stroke="#44403C" stroke-width="1.5"/>
        <circle cx="83" cy="24" r="2.2" fill="#2563EB"/>
        <circle cx="83" cy="48" r="2.2" fill="#2563EB"/>
        ${showCallout ? '<text x="12" y="70" font-size="7" fill="#57534E" font-family="monospace">Ø35 tas • 45×9.5 / TH52 • 37/32 mm</text>' : ""}
      `;
    case "fam_hinge_plate":
      return `
        <path d="M40 12 H72 V26 H88 V46 H72 V60 H40 V46 H24 V26 H40 Z" fill="#E7E5E0" stroke="#1C1917" stroke-width="1.8"/>
        <circle cx="56" cy="20" r="3.4" fill="#2563EB"/>
        <circle cx="56" cy="52" r="3.4" fill="#2563EB"/>
        <line x1="36" y1="36" x2="76" y2="36" stroke="#78716C" stroke-width="1.6"/>
        <circle cx="56" cy="36" r="4.5" fill="#FAF8F4" stroke="#44403C" stroke-width="1.5"/>
        ${showCallout ? '<text x="20" y="71" font-size="7" fill="#57534E" font-family="monospace">System 32 (37×32 mm) Haç Tabla</text>' : ""}
      `;
    case "fam_runner_concealed":
    case "fam_drawer_box":
      return `
        <polygon points="12,26 36,12 98,12 74,26" fill="#F5EFE6" stroke="#78716C" stroke-width="1.5"/>
        <rect x="12" y="26" width="62" height="28" rx="2" fill="#E6D8C3" stroke="#1C1917" stroke-width="1.8"/>
        <polygon points="74,26 98,12 98,40 74,54" fill="#CBB89D" stroke="#1C1917" stroke-width="1.8"/>
        <rect x="34" y="37" width="18" height="4" rx="2" fill="#1C1917"/>
        <line x1="14" y1="59" x2="96" y2="45" stroke="#2563EB" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="24" cy="57" r="2.8" fill="#1E40AF"/>
        <circle cx="84" cy="47" r="2.8" fill="#1E40AF"/>
        ${showCallout ? '<text x="14" y="71" font-size="7" fill="#57534E" font-family="monospace">NL 270–650 mm • Tam Açılım Ray</text>' : ""}
      `;
    case "fam_lift_system":
      return `
        <rect x="16" y="18" width="76" height="42" rx="2.5" fill="#FAF8F4" stroke="#A8A29E" stroke-width="1.5"/>
        <line x1="20" y1="20" x2="90" y2="8" stroke="#1C1917" stroke-width="3.2" stroke-linecap="round"/>
        <rect x="22" y="24" width="16" height="10" rx="2.5" fill="#2563EB"/>
        <line x1="36" y1="29" x2="62" y2="14" stroke="#2563EB" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M84 36 C92 28, 92 18, 86 12" stroke="#059669" stroke-width="1.8" stroke-dasharray="3 2" fill="none"/>
        ${showCallout ? '<text x="18" y="71" font-size="7" fill="#57534E" font-family="monospace">LF = KH × Kapak Ağırlığı</text>' : ""}
      `;
    case "fam_sliding_system":
    case "fam_pocket_system":
      return `
        <rect x="10" y="10" width="92" height="5" rx="2" fill="#1C1917"/>
        <rect x="14" y="16" width="42" height="44" rx="2.5" fill="#E6D8C3" stroke="#1C1917" stroke-width="1.8"/>
        <rect x="48" y="20" width="46" height="40" rx="2.5" fill="#CFC0A8" stroke="#57534E" stroke-width="1.6"/>
        <path d="M26 38 H66 M60 33 L66 38 L60 43" stroke="#2563EB" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        ${showCallout ? '<text x="14" y="71" font-size="7" fill="#57534E" font-family="monospace">Üst/Alt Raylı Sürgü / Pocket</text>' : ""}
      `;
    case "fam_push_soft_close":
      return `
        <rect x="14" y="26" width="46" height="18" rx="5" fill="#E5E1D8" stroke="#1C1917" stroke-width="1.8"/>
        <rect x="60" y="30" width="22" height="10" rx="3" fill="#2563EB"/>
        <rect x="86" y="14" width="8" height="44" rx="2" fill="#D6C7B2" stroke="#57534E" stroke-width="1.5"/>
        <path d="M68 20 L80 20" stroke="#059669" stroke-width="2" stroke-linecap="round"/>
        ${showCallout ? '<text x="16" y="71" font-size="7" fill="#57534E" font-family="monospace">2.0–2.6 mm Bas-Aç Boşluğu</text>' : ""}
      `;
    case "fam_kitchen_acc":
    case "fam_wardrobe_acc":
      return `
        <rect x="18" y="10" width="76" height="50" rx="3.5" fill="#FAF8F4" stroke="#78716C" stroke-width="1.6"/>
        <line x1="28" y1="14" x2="28" y2="56" stroke="#1C1917" stroke-width="2.6"/>
        <path d="M28 24 C46 16, 70 16, 86 24 L82 32 C68 26, 46 26, 28 32 Z" fill="#DBEAFE" stroke="#2563EB" stroke-width="1.6"/>
        <path d="M28 42 C46 34, 70 34, 86 42 L82 50 C68 44, 46 44, 28 50 Z" fill="#DBEAFE" stroke="#2563EB" stroke-width="1.6"/>
        ${showCallout ? '<text x="16" y="71" font-size="7" fill="#57534E" font-family="monospace">Dolap İçi Kiler / Düzenleyici</text>' : ""}
      `;
    case "fam_connector":
    case "fam_shelf_support":
      return `
        <circle cx="36" cy="36" r="15" fill="#E7E5E0" stroke="#1C1917" stroke-width="1.8"/>
        <path d="M30 36 H42 M36 30 V42" stroke="#57534E" stroke-width="2"/>
        <line x1="51" y1="36" x2="88" y2="36" stroke="#2563EB" stroke-width="4" stroke-linecap="round"/>
        <circle cx="88" cy="36" r="4.8" fill="#1E40AF"/>
        ${showCallout ? '<text x="16" y="71" font-size="7" fill="#57534E" font-family="monospace">Ø15 Minifix / Ø20 Rafix / Ø5 Pim</text>' : ""}
      `;
    case "fam_plinth_leg":
    default:
      return `
        <rect x="16" y="12" width="80" height="10" rx="2" fill="#E6D8C3" stroke="#8C6D46" stroke-width="1.6"/>
        <rect x="46" y="22" width="20" height="28" rx="2.5" fill="#D6D3CD" stroke="#1C1917" stroke-width="1.8"/>
        <rect x="34" y="50" width="44" height="9" rx="2.5" fill="#1C1917"/>
        <path d="M74 28 V44" stroke="#2563EB" stroke-width="1.8" stroke-dasharray="2 2"/>
        ${showCallout ? '<text x="18" y="71" font-size="7" fill="#57534E" font-family="monospace">Ayarlı Baza Ayağı / Askı</text>' : ""}
      `;
  }
}

function renderHardwareSchematicSvg(
  familyId: HardwareCategoryGroupId,
  variant: "grid" | "list" | "detail"
) {
  const cls =
    variant === "detail"
      ? "w-full h-40"
      : variant === "list"
      ? "w-24 h-16 shrink-0"
      : "w-full h-24";
  return (
    <svg
      viewBox="0 0 112 74"
      className={cls}
      fill="none"
      dangerouslySetInnerHTML={{
        __html: getHardwareSvgInnerMarkup(familyId, variant === "detail"),
      }}
    />
  );
}

/**
 * Starts pointer-based 3D hardware drag with a rich visual SVG drawing card under the cursor.
 */
function startHardware3DDrag(
  e: React.PointerEvent<HTMLElement>,
  item: HardwareProductRecord,
  canMount: boolean,
  onClickFallback: () => void
) {
  if (e.button !== 0) return;
  const startX = e.clientX;
  const startY = e.clientY;
  let dragging = false;
  let ghostEl: HTMLDivElement | null = null;

  const ensureGhost = () => {
    if (ghostEl || typeof document === "undefined") return;
    const el = document.createElement("div");
    el.setAttribute("data-testid", "live-hardware-cursor-ghost");
    el.style.position = "fixed";
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.pointerEvents = "none";
    el.style.zIndex = "99999";
    el.style.background = "transparent";
    el.style.filter = canMount
      ? "drop-shadow(0 12px 20px rgba(20, 20, 19, 0.32))"
      : "drop-shadow(0 10px 18px rgba(220, 38, 38, 0.42))";
    el.style.willChange = "transform";
    el.innerHTML = `<svg viewBox="0 0 112 74" width="144" height="96" fill="none">${getHardwareSvgInnerMarkup(item.familyId, false)}</svg>`;
    document.body.appendChild(el);
    ghostEl = el;
  };

  const onMove = (ev: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
      dragging = true;
      document.body.dataset.birimUiDragging = "1";
      document.body.style.cursor = canMount ? "grabbing" : "not-allowed";
      ensureGhost();
    }
    if (ghostEl) {
      ghostEl.style.transform = `translate3d(${Math.round(ev.clientX - 73)}px, ${Math.round(ev.clientY - 54)}px, 0)`;
    }
    window.dispatchEvent(
      new CustomEvent("birim:live-hardware-move", {
        detail: {
          hardwareId: item.id,
          sku: item.sku,
          name: item.name,
          familyId: item.familyId,
          canMount,
          clientX: ev.clientX,
          clientY: ev.clientY,
        },
      })
    );
  };

  const cleanup = () => {
    if (ghostEl) {
      ghostEl.remove();
      ghostEl = null;
    }
    delete document.body.dataset.birimUiDragging;
    document.body.style.cursor = "";
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKeyDown);
  };

  const onCancel = () => {
    cleanup();
    if (dragging) {
      window.dispatchEvent(new CustomEvent("birim:live-hardware-cancel"));
    }
  };

  const onKeyDown = (ke: KeyboardEvent) => {
    if (ke.key === "Escape") onCancel();
  };

  const onUp = (ev: PointerEvent) => {
    const wasDragging = dragging;
    cleanup();
    if (!wasDragging) {
      onClickFallback();
      return;
    }
    window.dispatchEvent(
      new CustomEvent("birim:live-hardware-drop", {
        detail: {
          hardwareId: item.id,
          sku: item.sku,
          name: item.name,
          familyId: item.familyId,
          clientX: ev.clientX,
          clientY: ev.clientY,
        },
      })
    );
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKeyDown);
}

export const RightHardwareLibraryPanel: React.FC<RightHardwareLibraryPanelProps> = React.memo(({
  activeModule,
  activeBayIndex,
  experienceTier,
  onApplyHardware,
  onOpenCustomHardwareModal,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [quickScope, setQuickScope] = useState<QuickScope>("all");
  const [selectedCategory, setSelectedCategory] = useState<HardwareCategoryGroupId | "all">("all");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all");
  const [selectedPurpose, setSelectedPurpose] = useState<HardwareUsagePurpose | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<HardwareProductionStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showPackages, setShowPackages] = useState(experienceTier === "simple");
  const [showFactoryChecklist, setShowFactoryChecklist] = useState(false);

  // Contextual bay hint: detect active bay doors/drawers so user sees relevant families first
  const activeBay = activeModule.bays[activeBayIndex];
  const bayContextHint = useMemo(() => {
    const hasDrawers = (activeBay?.drawers || []).some((d) => !d.isHidden);
    const hasDoor = Boolean(activeBay?.door && activeBay.door.type !== "open");
    const isLift = Boolean(activeBay?.door?.type?.startsWith("lift"));
    const isSliding = Boolean(activeBay?.door?.type?.startsWith("sliding"));
    if (isLift) return { labelTr: "Kalkar Kapak Önerileri", familyId: "fam_lift_system" as HardwareCategoryGroupId };
    if (isSliding) return { labelTr: "Sürgü Sistemi Önerileri", familyId: "fam_sliding_system" as HardwareCategoryGroupId };
    if (hasDrawers) return { labelTr: "Çekmece Ray & Kasa Önerileri", familyId: "fam_drawer_box" as HardwareCategoryGroupId };
    if (hasDoor) return { labelTr: "Menteşe & Tabla Önerileri", familyId: "fam_hinge_concealed" as HardwareCategoryGroupId };
    return { labelTr: "Dolap İçi Aksesuar Önerileri", familyId: "fam_kitchen_acc" as HardwareCategoryGroupId };
  }, [activeBay]);

  // Strictly lazy project-wide package price deltas (zero cost when collapsed!)
  const packagePreviews = useMemo(() => {
    if (!showPackages) return [];
    const st = useConfiguratorStore.getState();
    return PROJECT_HARDWARE_PACKAGES.map((pkg) => ({
      pkg,
      preview: st.previewHardwarePackageDelta ? st.previewHardwarePackageDelta(pkg.id) : null,
    }));
  }, [activeModule.id, activeModule.dimensions.width, activeModule.dimensions.height, activeModule.bays.length, showPackages]);

  // Listen to 3D clicked part for automatic contextual hardware focus
  useEffect(() => {
    const on3DPartSelected = (ev: Event) => {
      const kind = (ev as CustomEvent<{ partKind?: string }>).detail?.partKind;
      if (kind === "door") setSelectedCategory("fam_hinge_concealed");
      else if (kind === "drawer") setSelectedCategory("fam_drawer_box");
      else if (kind === "shelf") setSelectedCategory("fam_connector");
    };
    window.addEventListener("birim:3d-part-selected", on3DPartSelected);
    return () => window.removeEventListener("birim:3d-part-selected", on3DPartSelected);
  }, []);

  // Installed hardware summary for active bay
  const installedBayHardware = useMemo(() => {
    const list: Array<{
      key: string;
      slotLabel: string;
      targetKind: "door" | "drawer" | "special_fitting";
      targetId?: string;
      familyId: HardwareCategoryGroupId;
      hw: HardwareProductRecord | undefined;
    }> = [];
    if (activeBay?.door && activeBay.door.type !== "open") {
      const hw = getHardwareProductById(activeBay.door.hardwareProductId || "hw_blum_71b3550");
      list.push({
        key: `door_${activeBay.door.id}`,
        slotLabel: "Kapak",
        targetKind: "door",
        targetId: activeBay.door.id,
        familyId: (hw?.familyId || "fam_hinge_concealed") as HardwareCategoryGroupId,
        hw,
      });
    }
    (activeBay?.drawers || []).forEach((d, idx) => {
      if (d.isHidden) return;
      const hw = getHardwareProductById(d.hardwareProductId || "hw_blum_tandembox_m30");
      list.push({
        key: `drw_${d.id}`,
        slotLabel: `Çekmece #${idx + 1}`,
        targetKind: "drawer",
        targetId: d.id,
        familyId: (hw?.familyId || "fam_drawer_box") as HardwareCategoryGroupId,
        hw,
      });
    });
    (activeBay?.specialFittings || []).forEach((sf) => {
      if (sf.isHidden) return;
      const hw = getHardwareProductById(sf.hardwareProductId);
      list.push({
        key: `sf_${sf.id}`,
        slotLabel: "Aksesuar",
        targetKind: "special_fitting",
        targetId: sf.id,
        familyId: (hw?.familyId || "fam_kitchen_acc") as HardwareCategoryGroupId,
        hw,
      });
    });
    return list;
  }, [activeBay]);

  // Automatic Companion & Safety Wizard Suggestions
  const smartCompanionPrompts = useMemo(() => {
    const prompts: Array<{
      id: string;
      titleTr: string;
      actionLabelTr: string;
      onRun: () => void;
    }> = [];
    const hasInternalDrw = (activeBay?.drawers || []).some((d) => d.isInternal && !d.isHidden);
    const doorHwId = activeBay?.door?.hardwareProductId || "hw_blum_71b3550";
    if (
      hasInternalDrw &&
      activeBay?.door &&
      activeBay.door.type !== "open" &&
      !doorHwId.includes("71b7550") &&
      !doorHwId.includes("9099540")
    ) {
      prompts.push({
        id: "prompt_155_zero",
        titleTr: "İç çekmece algılandı: 110° menteşe çekmece çıkışını engelleyebilir.",
        actionLabelTr: "155° Sıfır Çıkıntıya (71B7550) Yükselt",
        onRun: () => {
          const res = onApplyHardware(activeBayIndex, "hw_blum_71b7550");
          setFeedbackBanner({ tone: res.applied ? "ok" : "error", text: res.messageTr });
        },
      });
    }
    if (activeModule.dimensions.height >= 1800 && !activeModule.carcass.wallAnchored) {
      const isSimpleMode = experienceTier === "simple";
      prompts.push({
        id: "prompt_en14749_tip",
        titleTr: isSimpleMode
          ? `Güvenlik: ${Math.round(activeModule.dimensions.height / 10)} cm yükseklik için duvar sabitleme önerilir.`
          : `Modül yüksekliği ${Math.round(activeModule.dimensions.height)} mm: EN 14749 duvar sabitleme braketi önerilir.`,
        actionLabelTr: isSimpleMode ? "Duvar Sabitleme Ekle" : "EN 14749 Braketi Ekle",
        onRun: () => {
          const res = onApplyHardware(activeBayIndex, "hw_en14749_anti_tip");
          setFeedbackBanner({ tone: res.applied ? "ok" : "error", text: res.messageTr });
        },
      });
    }
    return prompts;
  }, [activeBay, activeBayIndex, activeModule.dimensions.height, activeModule.carcass.wallAnchored, onApplyHardware]);

  const doorOpenAngle = useConfiguratorStore((s) => s.doorOpenAngleDeg);
  const drawerOpenMm = useConfiguratorStore((s) => s.drawerOpenMm);
  const isKinematicOpen = doorOpenAngle > 5 || drawerOpenMm > 5;

  const coreFactoryProducts = useMemo(
    () =>
      CORE_FACTORY_VERIFICATION_IDS.map((id) => getHardwareProductById(id)).filter(
        (x): x is HardwareProductRecord => Boolean(x)
      ),
    []
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    try {
      const rawFav = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (rawFav) setFavorites(JSON.parse(rawFav));
      const rawRec = localStorage.getItem(RECENTS_STORAGE_KEY);
      if (rawRec) setRecents(JSON.parse(rawRec));
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev].slice(0, 24);
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const recordRecent = useCallback((id: string) => {
    setRecents((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 12);
      try {
        localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const allProducts = useMemo(() => getAllHardwareProducts(), []);

  const manufacturers = useMemo(() => {
    const map = new Map<string, string>();
    allProducts.forEach((p) => map.set(p.manufacturerId, p.manufacturerName));
    return Array.from(map.entries());
  }, [allProducts]);

  const structuralEvalKey = `${activeModule.id}|${activeModule.dimensions.width}x${activeModule.dimensions.height}x${activeModule.dimensions.depth}|${activeModule.carcass.doorThickness || 18}|b${activeBayIndex}|${activeBay?.door?.type || "open"}|${(activeBay?.drawers || []).length}|${(activeBay?.drawers || []).some((d) => d.isInternal)}`;
  const evaluationMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateHardwareMountPlacement>>();
    allProducts.forEach((p) => {
      map.set(p.id, evaluateHardwareMountPlacement(activeModule, p, activeBayIndex));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts, structuralEvalKey]);

  const resizeReport = useMemo(
    () =>
      evaluateHardwareAfterModuleResize(
        activeModule,
        getHardwareProductById,
        allProducts
      ),
    [activeModule, allProducts]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allProducts.filter((p) => {
      const status = resolveHardwareProductionStatus(p);
      if (quickScope === "compatible" && !evaluationMap.get(p.id)?.canMount) return false;
      if (quickScope === "favorites" && !favorites.includes(p.id)) return false;
      if (quickScope === "recents" && !recents.includes(p.id)) return false;
      if (selectedCategory !== "all" && p.familyId !== selectedCategory) return false;
      if (selectedManufacturer !== "all" && p.manufacturerId !== selectedManufacturer) return false;
      if (selectedPurpose !== "all" && !(p.usagePurposes || []).includes(selectedPurpose)) return false;
      if (selectedStatus !== "all" && status !== selectedStatus) return false;
      if (q) {
        const hay = `${p.name} ${p.sku} ${p.manufacturerName} ${p.series || ""} ${p.descriptionTr || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    allProducts,
    searchQuery,
    quickScope,
    favorites,
    recents,
    selectedCategory,
    selectedManufacturer,
    selectedPurpose,
    selectedStatus,
    evaluationMap,
  ]);

  const groupedProducts = useMemo(() => {
    return HARDWARE_CATEGORY_GROUPS.map((cat) => ({
      category: cat,
      items: filteredProducts.filter((p) => p.familyId === cat.id),
    })).filter((g) => g.items.length > 0);
  }, [filteredProducts]);

  const handleApplyClick = useCallback(
    (item: HardwareProductRecord, forceApply = false) => {
      const res = onApplyHardware(activeBayIndex, item.id, { forceApply });
      if (res.applied) {
        recordRecent(item.id);
        setFeedbackBanner({ tone: "ok", text: res.messageTr });
      } else {
        setFeedbackBanner({ tone: "error", text: res.messageTr });
      }
      setTimeout(() => setFeedbackBanner(null), 4500);
    },
    [activeBayIndex, onApplyHardware, recordRecent]
  );

  const selectedDetailItem = useMemo(
    () => (selectedDetailId ? allProducts.find((p) => p.id === selectedDetailId) || null : null),
    [allProducts, selectedDetailId]
  );

  const selectedDetailEval = selectedDetailItem ? evaluationMap.get(selectedDetailItem.id) : undefined;

  const activeFilterCount =
    (selectedManufacturer !== "all" ? 1 : 0) +
    (selectedPurpose !== "all" ? 1 : 0) +
    (selectedStatus !== "all" ? 1 : 0);

  const statusBadge = (status: HardwareProductionStatus) => {
    const meta = HARDWARE_PRODUCTION_STATUS_META[status];
    if (status === "production_ready") {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-2.5 h-2.5" />
          {meta.shortLabelTr}
        </span>
      );
    }
    if (status === "review_required") {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-2.5 h-2.5" />
          {meta.shortLabelTr}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-stone-100 text-stone-600 border border-stone-300">
        <Eye className="w-2.5 h-2.5" />
        {meta.shortLabelTr}
      </span>
    );
  };

  const renderProductCard = (item: HardwareProductRecord) => {
    const ev = evaluationMap.get(item.id);
    const status = resolveHardwareProductionStatus(item);
    const isFav = favorites.includes(item.id);
    const canMount = ev?.canMount ?? true;

    if (viewMode === "list") {
      return (
        <div
          key={item.id}
          data-testid={`v11-hw-card-${item.id}`}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            startHardware3DDrag(e, item, canMount, () => setSelectedDetailId(item.id));
          }}
          className={`rounded-2xl border p-2 flex items-center gap-2.5 transition select-none cursor-grab active:cursor-grabbing ${
            selectedDetailId === item.id
              ? "border-[#141413] bg-[#FAF8F4] ring-1 ring-[#141413]"
              : canMount
              ? "border-[#E6E1D6] bg-white hover:border-[#8C7A6B]"
              : "border-red-200 bg-red-50/30 hover:border-red-400"
          }`}
        >
          <div className="rounded-xl bg-[#FAF8F4] border border-[#ECE7DD] p-1 shrink-0">
            {renderHardwareSchematicSvg(item.familyId, "list")}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="text-[10px] font-bold uppercase text-[#8C7A6B] truncate">
              {formatBrandLabel(item.manufacturerName)} • {item.sku}
            </div>
            <div className="text-[11.5px] font-semibold text-[#141413] leading-snug line-clamp-2">
              {item.name}
            </div>
            <div className="flex items-center flex-wrap gap-1">
              {statusBadge(status)}
              <span className="text-[10px] font-mono text-[#78716C]">{item.loadCapacityKg} kg</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => toggleFavorite(item.id)}
                aria-label={isFav ? "Favorilerden çıkar" : "Favorilere ekle"}
                className="w-6 h-6 rounded-lg hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
              >
                <Star className={`w-3 h-3 ${isFav ? "fill-amber-500 text-amber-500" : "text-[#A8A29E]"}`} />
              </button>
              <button
                type="button"
                onClick={() => setSelectedDetailId(item.id)}
                aria-label={`${item.name} teknik detay`}
                className="w-6 h-6 rounded-lg hover:bg-[#EFECE4] flex items-center justify-center text-[#57534E] cursor-pointer"
              >
                <Info className="w-3 h-3" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleApplyClick(item)}
              className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer ${
                canMount ? "bg-[#141413] text-white hover:bg-[#292524]" : "bg-red-100 text-red-800 hover:bg-red-200"
              }`}
            >
              <Plus className="w-3 h-3" />
              <span>{canMount ? "Ekle" : "Neden?"}</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        data-testid={`v11-hw-card-${item.id}`}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          startHardware3DDrag(e, item, canMount, () => setSelectedDetailId(item.id));
        }}
        className={`rounded-2xl border overflow-hidden transition select-none cursor-grab active:cursor-grabbing flex flex-col justify-between ${
          selectedDetailId === item.id
            ? "border-[#141413] bg-[#FAF8F4] ring-1 ring-[#141413]"
            : canMount
            ? "border-[#E6E1D6] bg-white hover:border-[#8C7A6B] hover:shadow-sm"
            : "border-red-200 bg-red-50/20 hover:border-red-400"
        }`}
      >
        {/* Büyük Görsel Önizleme Sahnesi */}
        <div className="relative bg-[#FAF8F4] border-b border-[#ECE7DD] px-2 pt-7 pb-2">
          <div className="absolute top-1.5 left-1.5">{statusBadge(status)}</div>
          <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => toggleFavorite(item.id)}
              aria-label={isFav ? "Favorilerden çıkar" : "Favorilere ekle"}
              className="w-6 h-6 rounded-lg bg-white/85 hover:bg-white border border-[#E6E1D6] flex items-center justify-center cursor-pointer"
            >
              <Star className={`w-3 h-3 ${isFav ? "fill-amber-500 text-amber-500" : "text-[#A8A29E]"}`} />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDetailId(item.id)}
              aria-label={`${item.name} teknik detay`}
              className="w-6 h-6 rounded-lg bg-white/85 hover:bg-white border border-[#E6E1D6] flex items-center justify-center text-[#57534E] cursor-pointer"
            >
              <Info className="w-3 h-3" />
            </button>
          </div>
          {renderHardwareSchematicSvg(item.familyId, "grid")}
        </div>

        {/* Kompakt Bilgi & Aksiyon Alt Alanı */}
        <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1 text-[10px] font-bold uppercase text-[#8C7A6B]">
              <span className="truncate">{formatBrandLabel(item.manufacturerName)} • {item.sku}</span>
              <span className="font-mono text-[#78716C] shrink-0">{item.loadCapacityKg} kg</span>
            </div>
            <div className="text-[11px] font-semibold text-[#141413] leading-snug line-clamp-2 mt-0.5">
              {item.name}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleApplyClick(item)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleApplyClick(item);
              }
            }}
            aria-label={`${item.name} ürününü Bölme ${activeBayIndex + 1} üzerine ekle`}
            className={`w-full py-1.5 rounded-xl text-[10.5px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
              canMount
                ? "bg-[#141413] text-white hover:bg-[#292524]"
                : "bg-red-100 text-red-800 hover:bg-red-200"
            }`}
          >
            <Plus className="w-3 h-3" />
            <span>{canMount ? `Bölme ${activeBayIndex + 1}'e Ekle` : "Uyumsuzluk Nedeni"}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2.5 min-w-0 max-w-full overflow-x-hidden" data-testid="v11-hardware-library-panel" role="region" aria-label="Akıllı Donanım Kütüphanesi">
      {/* Ölçü değişikliği sonrası uyumsuz donanım uyarıları */}
      {!resizeReport.allCompatible && (
        <div
          data-testid="v11-hardware-resize-alert"
          className="rounded-2xl bg-red-50/90 border border-red-200 p-3 space-y-2"
        >
          <div className="flex items-center gap-1.5 text-red-800 font-bold text-[11.5px]">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Ölçü Uyumsuzluğu ({resizeReport.incompatibleCount} donanım)</span>
          </div>
          {resizeReport.findings.map((f, idx) => (
            <div key={`${f.targetId}_${idx}`} className="rounded-xl bg-white/90 border border-red-100 p-2 space-y-1 text-[11px]">
              <div className="font-semibold text-[#141413]">
                Bölme {f.bayIndex + 1} • {f.currentHardwareName}
              </div>
              <p className="text-red-700">{f.reasonTr}</p>
              <p className="text-[#57534E]">
                <span className="font-semibold">Çözüm:</span> {f.solutionTr}
              </p>
              {f.suggestedAlternatives.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {f.suggestedAlternatives.map((alt) => (
                    <button
                      key={alt.hardwareId}
                      type="button"
                      onClick={() => {
                        const res = onApplyHardware(f.bayIndex, alt.hardwareId);
                        setFeedbackBanner({ tone: res.applied ? "ok" : "error", text: res.messageTr });
                      }}
                      className="px-2 py-1 rounded-lg bg-[#141413] text-white text-[10px] font-semibold hover:bg-[#292524] transition cursor-pointer"
                    >
                      Onayla & Değiştir: {alt.sku}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Geri bildirim bandı */}
      {feedbackBanner && (
        <div
          role="status"
          data-testid="v11-hardware-feedback"
          className={`rounded-xl px-3 py-2 text-[11px] font-medium border ${
            feedbackBanner.tone === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {feedbackBanner.text}
        </div>
      )}

      {/* Aktif Bölmede Ne Takılı? + Canlı 3D Aç/Kapa Testi & Boşluklar */}
      <div className="rounded-2xl bg-white border border-[#E6E1D6] p-2.5 space-y-2" data-testid="v11-installed-bay-hardware-bar">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-[#141413]">
            Bölme {activeBayIndex + 1} • Takılı Donanımlar ({installedBayHardware.length})
          </span>
          <button
            type="button"
            data-testid="v11-kinematic-preview-btn"
            onClick={() => useConfiguratorStore.getState().toggleDoorOpen(true)}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer ${
              isKinematicOpen
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-[#141413] text-white hover:bg-[#292524]"
            }`}
            title="3D sahnede kapak ve çekmeceleri canlı aç/kapa"
          >
            <Play className="w-2.5 h-2.5" />
            <span>{isKinematicOpen ? "3D Kapat" : "3D Aç/Kapa Testi"}</span>
          </button>
        </div>

        {/* Milimetrik Boşluk Göstergesi (Yalnızca Üretim seviyesi) */}
        {experienceTier === "factory" && (
        <div className="flex flex-wrap gap-1 text-[9.5px] font-mono text-[#57534E]">
          <span className="px-1.5 py-0.5 rounded-md bg-[#FAF8F4] border border-[#E6E1D6]">
            Kapak Payı: {activeModule.carcass.doorPerimeterGap ?? 2} mm
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-[#FAF8F4] border border-[#E6E1D6]">
            Arka Ray Payı: 15 mm
          </span>
          {activeBay?.door?.openingTechnology === "push_to_open" && (
            <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800">
              Bas-Aç Boşluğu: 2.5 mm
            </span>
          )}
        </div>
        )}

        {experienceTier === "simple" ? (
          <p className="text-[10.5px] text-[#78716C]">
            Donanım kalitesi seçili pakete göre otomatik ayarlanır. 3B Aç/Kapa testiyle kapak ve çekmeceleri deneyebilirsiniz.
          </p>
        ) : installedBayHardware.length === 0 ? (
          <p className="text-[10.5px] text-[#78716C]">Bu bölmede henüz özel donanım atanmamış.</p>
        ) : (
          <div className="space-y-1">
            {installedBayHardware.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-xl bg-[#FAF8F4] border border-[#ECE7DD] text-[10.5px]"
              >
                <div className="min-w-0">
                  <span className="font-bold text-[#141413]">{row.slotLabel}:</span>{" "}
                  <span className="text-[#57534E] truncate">
                    {row.hw
                      ? experienceTier === "factory"
                        ? `${formatBrandLabel(row.hw.manufacturerName)} • ${row.hw.sku}`
                        : `${formatBrandLabel(row.hw.manufacturerName)} ${row.hw.series || row.hw.nameTr}`
                      : "Standart"}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(row.familyId);
                      setQuickScope("compatible");
                    }}
                    className="px-1.5 py-0.5 rounded-md bg-white border border-[#DFD9CE] text-[9.5px] font-semibold text-[#141413] hover:border-[#141413] cursor-pointer"
                  >
                    Değiştir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const res = useConfiguratorStore
                        .getState()
                        .removeHardwareFromBay(activeBayIndex, row.targetKind, row.targetId);
                      setFeedbackBanner({ tone: res.removed ? "ok" : "error", text: res.messageTr });
                      setTimeout(() => setFeedbackBanner(null), 3500);
                    }}
                    aria-label={`${row.slotLabel} donanımını sök`}
                    className="w-5 h-5 rounded-md hover:bg-red-50 text-[#78716C] hover:text-red-600 flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Otomatik Kardeş Parça & Güvenlik Eşleştirme Sihirbazı */}
      {smartCompanionPrompts.length > 0 && (
        <div className="space-y-1.5" data-testid="v11-smart-companion-wizard">
          {smartCompanionPrompts.map((pr) => (
            <div
              key={pr.id}
              className="rounded-xl bg-amber-50/90 border border-amber-200 p-2.5 space-y-1.5 text-[10.5px]"
            >
              <div className="flex items-start gap-1.5 text-amber-900 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{pr.titleTr}</span>
              </div>
              <button
                type="button"
                onClick={pr.onRun}
                className="px-2.5 py-1 rounded-lg bg-[#141413] text-white text-[10px] font-semibold hover:bg-[#292524] cursor-pointer"
              >
                {pr.actionLabelTr}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 0. Proje Geneli Donanım Paketi & Anlık Fiyat Farkı (Müşteri / Satıcı Aracı) */}
      <div className="rounded-2xl bg-white border border-[#E6E1D6] overflow-hidden" data-testid="v11-hardware-packages-box">
        <button
          type="button"
          onClick={() => setShowPackages((v) => !v)}
          aria-expanded={showPackages}
          className="w-full px-3 py-2 flex items-center justify-between bg-[#F5F2EA]/80 hover:bg-[#EFECE4] transition cursor-pointer"
        >
          <span className="text-[11px] font-bold text-[#141413]">
            Proje Donanım Paketi & Fiyat Farkı
          </span>
          <span className="text-[10px] font-semibold text-[#8C7A6B]">
            {showPackages ? "Gizle" : "4 Paket"}
          </span>
        </button>
        {showPackages && (
          <div className="p-2 grid grid-cols-2 gap-1.5">
            {packagePreviews.map(({ pkg, preview }) => {
              const delta = preview?.deltaEur ?? 0;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  data-testid={`v11-hw-pkg-${pkg.id}`}
                  onClick={() => {
                    const res = useConfiguratorStore.getState().applyHardwarePackageToProject(pkg.id);
                    setFeedbackBanner({ tone: res.applied ? "ok" : "error", text: res.messageTr });
                    setTimeout(() => setFeedbackBanner(null), 4500);
                  }}
                  className="text-left p-2 rounded-xl border border-[#E6E1D6] bg-[#FAF8F4] hover:border-[#141413] hover:bg-white transition cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9.5px] font-bold uppercase text-[#8C7A6B]">{pkg.tierLabelTr}</span>
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        delta > 0 ? "text-amber-700" : delta < 0 ? "text-emerald-700" : "text-[#78716C]"
                      }`}
                    >
                      {delta === 0 ? "Mevcut" : `${delta > 0 ? "+" : ""}€${delta}`}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-[#141413] leading-tight">{pkg.nameTr}</div>
                  <div className="text-[9.5px] text-[#57534E] line-clamp-2 leading-snug">{pkg.taglineTr}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bağlamsal Bölme Önerisi (Tek Tıkla İlgili Aileye Git) */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#F5F2EA] border border-[#E6E1D6] text-[10.5px]">
        <span className="text-[#57534E] truncate">
          <span className="font-bold text-[#141413]">Bölme {activeBayIndex + 1}:</span> {bayContextHint.labelTr}
        </span>
        <button
          type="button"
          onClick={() => {
            setSelectedCategory(bayContextHint.familyId);
            setQuickScope("compatible");
          }}
          className="px-2 py-0.5 rounded-lg bg-[#141413] text-white text-[10px] font-semibold shrink-0 hover:bg-[#292524] cursor-pointer"
        >
          Filtrele
        </button>
      </div>

      {/* Üretim Modu: Fabrika Çekirdek 10 SKU Onay Takibi */}
      {experienceTier === "factory" && (
        <div className="rounded-2xl bg-white border border-[#E6E1D6] overflow-hidden" data-testid="v11-factory-core-checklist">
          <button
            type="button"
            onClick={() => setShowFactoryChecklist((v) => !v)}
            className="w-full px-3 py-2 flex items-center justify-between bg-emerald-50/70 hover:bg-emerald-50 transition cursor-pointer"
          >
            <span className="text-[11px] font-bold text-emerald-900">
              Fabrika Çekirdek 10 SKU Doğrulama Listesi
            </span>
            <span className="text-[10px] font-semibold text-emerald-700">
              {showFactoryChecklist ? "Gizle" : `${coreFactoryProducts.length} SKU`}
            </span>
          </button>
          {showFactoryChecklist && (
            <div className="p-2 space-y-1 max-h-48 overflow-y-auto text-[10.5px]">
              {coreFactoryProducts.map((cp) => (
                <div key={cp.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-[#FAF8F4] border border-[#ECE7DD]">
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-[#141413]">{cp.sku}</span>
                    <span className="text-[#57534E] ml-1.5 truncate">{cp.name}</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold shrink-0 ${
                      cp.verification.physicalFactorySampleTested
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {cp.verification.physicalFactorySampleTested ? "Numune OK" : "CNC Bekliyor"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 1. Üst Arama + Filtre + Görünüm Çubuğu */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Blum, 71B3550, Sensys, ray, kiler..."
            aria-label="Donanım ara"
            data-testid="v11-hardware-search-input"
            className="w-full pl-8 pr-7 py-2 rounded-xl bg-white border border-[#DFD9CE] text-[11.5px] focus:outline-none focus:border-[#141413]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Aramayı temizle"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#141413] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          data-testid="v11-hardware-filter-toggle"
          className={`h-8 px-2.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition ${
            showFilters || activeFilterCount > 0
              ? "bg-[#141413] text-white border-[#141413]"
              : "bg-white text-[#57534E] border-[#DFD9CE] hover:border-[#141413]"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>{activeFilterCount > 0 ? `Filtre (${activeFilterCount})` : "Filtre"}</span>
        </button>
        <div className="inline-flex rounded-xl bg-[#ECE7DD] p-0.5 border border-[#DFD9CE]">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-label="Izgara görünümü"
            data-testid="v11-hardware-view-grid"
            className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${
              viewMode === "grid" ? "bg-white text-[#141413] shadow-2xs" : "text-[#57534E]"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-label="Liste görünümü"
            data-testid="v11-hardware-view-list"
            className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${
              viewMode === "list" ? "bg-white text-[#141413] shadow-2xs" : "text-[#57534E]"
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Tek Birleştirilmiş Hızlı Kapsam + Kategori Seçici */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#ECE7DD]/80 border border-[#DFD9CE]">
        {(
          [
            { id: "all", label: `Tümü (${allProducts.length})` },
            { id: "compatible", label: `Bölme ${activeBayIndex + 1}` },
            { id: "favorites", label: `Favori (${favorites.length})` },
            { id: "recents", label: `Son (${recents.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setQuickScope(tab.id)}
            className={`py-1.5 px-1 rounded-lg text-[10.5px] font-semibold transition cursor-pointer truncate ${
              quickScope === tab.id
                ? "bg-white text-[#141413] shadow-2xs"
                : "text-[#57534E] hover:text-[#141413]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Gelişmiş Filtre Kutusu */}
      {showFilters && (
        <div className="rounded-2xl bg-white border border-[#E6E1D6] p-3 space-y-2.5 text-[11px]">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-[#78716C]">Üretici</span>
              <select
                value={selectedManufacturer}
                onChange={(e) => setSelectedManufacturer(e.target.value)}
                className="w-full rounded-lg border border-[#DFD9CE] bg-[#FAF8F4] px-2 py-1.5 text-[11px]"
              >
                <option value="all">Tüm Üreticiler</option>
                {manufacturers.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-[#78716C]">Kullanım Amacı</span>
              <select
                value={selectedPurpose}
                onChange={(e) => setSelectedPurpose(e.target.value as HardwareUsagePurpose | "all")}
                className="w-full rounded-lg border border-[#DFD9CE] bg-[#FAF8F4] px-2 py-1.5 text-[11px]"
              >
                <option value="all">Tümü</option>
                {(Object.keys(USAGE_PURPOSE_LABELS) as HardwareUsagePurpose[]).map((k) => (
                  <option key={k} value={k}>
                    {USAGE_PURPOSE_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", "production_ready", "review_required", "visual_only"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`px-2 py-1 rounded-full text-[10px] font-semibold border cursor-pointer transition ${
                  selectedStatus === st
                    ? "bg-[#141413] text-white border-[#141413]"
                    : "bg-[#FAF8F4] text-[#57534E] border-[#DFD9CE]"
                }`}
              >
                {st === "all" ? "Tüm Durumlar" : HARDWARE_PRODUCTION_STATUS_META[st].shortLabelTr}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kategori Filtre Çipleri */}
      <div className="flex flex-wrap gap-1 w-full min-w-0" data-testid="v11-hardware-category-bar">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold whitespace-nowrap border cursor-pointer transition ${
            selectedCategory === "all"
              ? "bg-[#141413] text-white border-[#141413]"
              : "bg-white text-[#57534E] border-[#DFD9CE] hover:border-[#141413]"
          }`}
        >
          Tüm Kategoriler
        </button>
        {HARDWARE_CATEGORY_GROUPS.filter((cat) => {
          if (showAllCategories || experienceTier === "factory") return true;
          const isWardrobeMod =
            activeModule.category === "wardrobe" ||
            /gard[ıi]rop|giyinme|vestiyer/i.test(activeModule.name || "");
          // Menteşe ve tabla Kapak sekmesine aittir; gardıropta Mutfak Kiler / Kalkar / Pocket varsayılan gizlenir
          if (cat.id === "fam_hinge_concealed" || cat.id === "fam_hinge_plate") return false;
          if (
            isWardrobeMod &&
            (cat.id === "fam_kitchen_acc" ||
              cat.id === "fam_lift_system" ||
              cat.id === "fam_pocket_system")
          ) {
            return false;
          }
          return true;
        }).map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold whitespace-nowrap border cursor-pointer transition ${
              selectedCategory === cat.id
                ? "bg-[#141413] text-white border-[#141413]"
                : "bg-white text-[#57534E] border-[#DFD9CE] hover:border-[#141413]"
            }`}
          >
            {cat.shortLabelTr}
          </button>
        ))}
        {experienceTier !== "factory" && (
          <button
            type="button"
            onClick={() => setShowAllCategories((v) => !v)}
            className="px-2 py-1 rounded-full text-[10px] font-semibold text-[#78716C] hover:text-[#141413] border border-dashed border-[#D6CFC2] cursor-pointer"
          >
            {showAllCategories ? "Bağlama Daralt" : "+ Menteşe / Diğerleri"}
          </button>
        )}
      </div>

      {/* Seçili Ürün Teknik Çizim & Detay Kartı */}
      {selectedDetailItem && selectedDetailEval && (
        <div
          data-testid="v11-hardware-detail-card"
          className="rounded-2xl bg-white border-2 border-[#141413] p-3 space-y-2.5 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B]">
                  {selectedDetailItem.manufacturerName} • {selectedDetailItem.series || "Standart"}
                </span>
                {statusBadge(selectedDetailEval.productionStatus)}
              </div>
              <h3 className="text-[12.5px] font-bold text-[#141413] mt-0.5">{selectedDetailItem.name}</h3>
              <p className="text-[10.5px] font-mono text-[#78716C]">
                SKU: {selectedDetailItem.sku} • Yük: {selectedDetailItem.loadCapacityKg} kg • €{selectedDetailItem.unitPriceEur}/{selectedDetailItem.unit}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDetailId(null)}
              aria-label="Detayı kapat"
              className="w-6 h-6 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="rounded-xl bg-[#FAF8F4] border border-[#E6E1D6] p-2.5">
            {renderHardwareSchematicSvg(selectedDetailItem.familyId, "detail")}
            {selectedDetailItem.technicalDrawingNotesTr && (
              <p className="text-[10.5px] text-[#57534E] mt-1 font-mono leading-snug">
                {selectedDetailItem.technicalDrawingNotesTr}
              </p>
            )}
          </div>

          {selectedDetailItem.descriptionTr && (
            <p className="text-[11px] text-[#44403C] leading-relaxed">{selectedDetailItem.descriptionTr}</p>
          )}

          <div
            className={`rounded-xl p-2 border text-[11px] space-y-1 ${
              selectedDetailEval.canMount
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                : "bg-red-50/80 border-red-200 text-red-900"
            }`}
          >
            <div className="font-bold flex items-center gap-1.5">
              {selectedDetailEval.canMount ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
              )}
              <span>{selectedDetailEval.summaryTr}</span>
            </div>
            {selectedDetailEval.issues.map((iss, idx) => (
              <div key={idx} className="text-[10.5px] leading-snug">
                <span className="font-semibold">{iss.severity === "error" ? "Neden:" : "Not:"}</span> {iss.reasonTr}{" "}
                <span className="font-semibold">Çözüm:</span> {iss.solutionTr}
              </div>
            ))}
            {experienceTier !== "simple" && selectedDetailEval.mountPoints.length > 0 && (
              <div className="pt-1 border-t border-black/10 text-[10px] font-mono">
                Montaj: {selectedDetailEval.mountPoints.length} nokta ({selectedDetailEval.targetSurface})
                {selectedDetailEval.recommendedNominalLengthMm ? ` • NL ${selectedDetailEval.recommendedNominalLengthMm} mm` : ""}
                {selectedDetailEval.computedPowerFactorLf ? ` • LF ${selectedDetailEval.computedPowerFactorLf}` : ""}
              </div>
            )}
          </div>

          {selectedDetailEval.requiredCompanions.length > 0 && (
            <div className="rounded-xl bg-[#FAF8F4] border border-[#E6E1D6] p-2 text-[10.5px]">
              <div className="font-bold text-[#141413] mb-1">Zorunlu / Önerilen Eşlikçi Parçalar:</div>
              {selectedDetailEval.requiredCompanions.map((c) => (
                <div key={c.sku} className="flex items-center justify-between text-[#57534E]">
                  <span>• {c.nameTr}</span>
                  <span className="font-mono text-[10px]">{c.sku}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {selectedDetailItem.officialSourceUrl ? (
              <a
                href={selectedDetailItem.officialSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-blue-700 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Resmi Teknik Katalog</span>
              </a>
            ) : (
              <span className="text-[10px] text-[#78716C]">Resmi teknik kaynak doğrulanmadı</span>
            )}
            <button
              type="button"
              onClick={() => handleApplyClick(selectedDetailItem)}
              data-testid="v11-hardware-detail-apply-btn"
              className="px-3 py-1.5 rounded-xl bg-[#141413] text-white text-[11px] font-semibold hover:bg-[#292524] flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Bölme {activeBayIndex + 1}&apos;e Ekle</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Ürün Listesi (Tek kategori seçiliyse doğrudan büyük kartlar; Tümü seçiliyse akordeon gruplar) */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#E6E1D6] p-5 text-center text-[11.5px] text-[#78716C]">
          Bu kritere uygun donanım bulunamadı.
        </div>
      ) : selectedCategory !== "all" || quickScope !== "all" || searchQuery.trim() ? (
        <div className={viewMode === "grid" ? "grid grid-cols-2 gap-2.5" : "space-y-2"}>
          {filteredProducts.map(renderProductCard)}
        </div>
      ) : (
        <div className="space-y-2.5">
          {groupedProducts.map(({ category, items }) => {
            const isCollapsed = Boolean(collapsedGroups[category.id]);
            return (
              <div key={category.id} className="rounded-2xl bg-white/85 border border-[#E6E1D6] overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedGroups((prev) => ({ ...prev, [category.id]: !prev[category.id] }))
                  }
                  aria-expanded={!isCollapsed}
                  className="w-full px-3 py-2 flex items-center justify-between bg-[#F5F2EA]/75 hover:bg-[#EFECE4] transition cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-[#57534E]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[#57534E]" />
                    )}
                    <span className="text-[11.5px] font-bold text-[#141413] truncate">
                      {category.labelTr}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white text-[#78716C] border border-[#DFD9CE]">
                      {items.length}
                    </span>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className={viewMode === "grid" ? "p-2.5 grid grid-cols-2 gap-2.5" : "p-2.5 space-y-2"}>
                    {items.map(renderProductCard)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Özel Donanım Tanımlama */}
      {onOpenCustomHardwareModal && (
        <button
          type="button"
          onClick={onOpenCustomHardwareModal}
          className="w-full py-2 px-3 rounded-xl border border-dashed border-[#C7BFB0] text-[#57534E] hover:border-[#141413] hover:text-[#141413] text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Özel / Proje Donanımı Tanımla</span>
        </button>
      )}
    </div>
  );
});
RightHardwareLibraryPanel.displayName = "RightHardwareLibraryPanel";
