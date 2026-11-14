"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ModuleFamilyId, ModuleInstance } from "@birim/core";
import { V4_MODULE_FAMILIES, WARDROBE_TEMPLATES, type V4ModuleTemplateDefinition } from "@birim/catalog";
import { generateElevation2D, generateModuleGeometry } from "@birim/geometry";
import { V3IsometricModuleIcon } from "../V3IsometricModuleIcon";
import {
  applyValidatedDimensionsToModule,
  buildCategoryTreeGroups,
  CATALOG_CATEGORY_CHIPS,
  clampTemplateDimensions,
  cleanTemplateTitle,
  DEFAULT_FAVORITE_TEMPLATE_IDS,
  FAVORITE_TEMPLATES_STORAGE_KEY,
  filterCatalogTemplates,
  getCompatibleHardwareForTemplate,
  getDoorSystemLabelTr,
  getTemplateWidthRangeCm,
  loadStoredIdList,
  RECENT_TEMPLATES_STORAGE_KEY,
  saveStoredIdList,
  type CatalogFeatureFilter,
  type CatalogViewMode,
  type CatalogWidthFilter,
  type StudioSubCategoryId,
} from "./moduleLibraryUtils";

export interface ModuleLibraryPanelProps {
  templates: V4ModuleTemplateDefinition[];
  activeModule: ModuleInstance;
  catalogViewMode: CatalogViewMode;
  onChangeCatalogViewMode: (mode: CatalogViewMode) => void;
  catalogSearchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  leftSubCat: string;
  selectedV4Family: ModuleFamilyId;
  onSelectCategoryChip: (subCatId: StudioSubCategoryId, familyId: ModuleFamilyId) => void;
  catalogWidthFilter: CatalogWidthFilter;
  onChangeWidthFilter: (w: CatalogWidthFilter) => void;
  catalogFeatureFilter: CatalogFeatureFilter;
  onChangeFeatureFilter: (f: CatalogFeatureFilter) => void;
  showFavoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
  favoriteTemplateIds: string[];
  onSetFavoriteTemplateIds: React.Dispatch<React.SetStateAction<string[]>>;
  onApplyTemplate: (
    templateId: string,
    appendToProject?: boolean,
    customDimensions?: { width?: number; height?: number; depth?: number }
  ) => void;
  onDropTemplateWithSnap: (
    templateId: string,
    dropWorldXMm?: number,
    customDimensions?: { width?: number; height?: number; depth?: number }
  ) => { placedName: string; snappedX: number; snappedY: number; snapLabel: string } | null;
  onStartDragTemplate: (e: React.DragEvent<HTMLElement>, templateId: string) => void;
  onDragEndTemplate: () => void;
  onApplyReadyWardrobePreset: (templateId: string | undefined, bays: number) => void;
}

interface ModuleCardProps {
  template: V4ModuleTemplateDefinition;
  isSelected: boolean;
  isFavorite: boolean;
  isCompactCols: boolean;
  onOpenDetail: (tpl: V4ModuleTemplateDefinition) => void;
  onApply: (tplId: string) => void;
  onAppend: (tplId: string) => void;
  onToggleFavorite: (tplId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLElement>, tplId: string) => void;
  onDragEnd: () => void;
}

const ModuleCard = React.memo<ModuleCardProps>(
  ({
    template,
    isSelected,
    isFavorite,
    isCompactCols,
    onOpenDetail,
    onApply,
    onAppend,
    onToggleFavorite,
    onDragStart,
    onDragEnd,
  }) => {
    const cleanTitle = cleanTemplateTitle(template.name);
    const { minCm, maxCm } = getTemplateWidthRangeCm(template);

    return (
      <div
        role="button"
        tabIndex={0}
        draggable={true}
        onDragStart={(e) => onDragStart(e, template.templateId)}
        onDragEnd={onDragEnd}
        onClick={() => onOpenDetail(template)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenDetail(template);
          }
        }}
        title={`${cleanTitle} (${minCm}–${maxCm} cm) — Detaylar için tıklayın veya sahneye sürükleyin`}
        className={`group relative rounded-xl border p-2 flex flex-col items-center text-center justify-between gap-1 cursor-pointer select-none transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
          isSelected
            ? "bg-[#EEF3F8] border-[#2563EB] ring-1 ring-[#2563EB]/25"
            : "bg-white hover:bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1]"
        }`}
      >
        {/* Top Row: Favorite + Quick Actions */}
        <div className="w-full flex items-center justify-between gap-1 min-h-[20px]">
          <button
            type="button"
            data-testid={`v4-fav-toggle-${template.templateId}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(template.templateId);
            }}
            aria-label={isFavorite ? `${cleanTitle} favorilerden çıkar` : `${cleanTitle} favorilere ekle`}
            aria-pressed={isFavorite}
            title={isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle"}
            className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] transition-opacity motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
              isFavorite
                ? "text-amber-500 opacity-100"
                : "text-[#94A3B8] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-[#111827]"
            }`}
          >
            ★
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid={`v4-apply-tpl-${template.templateId}`}
              onClick={(e) => {
                e.stopPropagation();
                onApply(template.templateId);
              }}
              title="Aktif modüle uygula"
              className="px-1.5 py-0.5 rounded-md bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] text-[9px] font-semibold opacity-80 group-hover:opacity-100 transition-opacity motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
            >
              Uygula
            </button>
            <button
              type="button"
              data-testid={`v4-append-tpl-${template.templateId}`}
              onClick={(e) => {
                e.stopPropagation();
                onAppend(template.templateId);
              }}
              aria-label={`${cleanTitle} sahneye ekle`}
              title="Sahneye Yeni Modül Olarak Ekle (+)"
              className="w-5 h-5 rounded-md bg-[#111827] hover:bg-[#1E293B] text-white flex items-center justify-center text-xs font-bold opacity-85 group-hover:opacity-100 transition-opacity motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
            >
              +
            </button>
          </div>
        </div>

        {/* Proportional Isometric Preview */}
        <div className="w-full h-16 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9] flex items-center justify-center overflow-hidden">
          <V3IsometricModuleIcon
            template={template}
            size={isCompactCols ? "md" : "lg"}
            testId={`v4-tpl-visual-${template.templateId}`}
          />
        </div>

        {/* Compact Label + Width Range */}
        <div className="w-full min-w-0 pt-0.5">
          <div className="text-[11px] font-semibold text-[#111827] line-clamp-2 leading-tight min-h-[28px] flex items-center justify-center">
            {cleanTitle}
          </div>
          <div className="text-[10px] font-mono tabular-nums text-[#64748B] mt-0.5">
            {minCm === maxCm ? `${minCm} cm` : `${minCm}–${maxCm} cm`}
          </div>
        </div>
      </div>
    );
  }
);
ModuleCard.displayName = "ModuleCard";

interface ModuleListRowProps {
  template: V4ModuleTemplateDefinition;
  isSelected: boolean;
  isFavorite: boolean;
  onOpenDetail: (tpl: V4ModuleTemplateDefinition) => void;
  onApply: (tplId: string) => void;
  onAppend: (tplId: string) => void;
  onToggleFavorite: (tplId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLElement>, tplId: string) => void;
  onDragEnd: () => void;
}

const ModuleListRow = React.memo<ModuleListRowProps>(
  ({
    template,
    isSelected,
    isFavorite,
    onOpenDetail,
    onApply,
    onAppend,
    onToggleFavorite,
    onDragStart,
    onDragEnd,
  }) => {
    const cleanTitle = cleanTemplateTitle(template.name);
    const { minCm, maxCm } = getTemplateWidthRangeCm(template);

    return (
      <div
        role="button"
        tabIndex={0}
        draggable={true}
        onDragStart={(e) => onDragStart(e, template.templateId)}
        onDragEnd={onDragEnd}
        onClick={() => onOpenDetail(template)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenDetail(template);
          }
        }}
        title={`${cleanTitle} — ${template.description}`}
        className={`group px-2 py-1.5 rounded-xl border flex items-center gap-2 cursor-pointer select-none transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
          isSelected
            ? "bg-[#EEF3F8] border-[#2563EB] ring-1 ring-[#2563EB]/25"
            : "bg-white hover:bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1]"
        }`}
      >
        <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0">
          <V3IsometricModuleIcon
            template={template}
            size="sm"
            testId={`v4-tpl-visual-${template.templateId}`}
          />
        </div>

        <div className="flex-1 min-w-0 text-left">
          <div className="text-[11px] font-semibold text-[#111827] truncate" title={cleanTitle}>
            {cleanTitle}
          </div>
          <div className="text-[10px] font-mono tabular-nums text-[#64748B] truncate">
            {template.defaultDimensions.width}×{template.defaultDimensions.height}×{template.defaultDimensions.depth} mm
            <span className="text-[#94A3B8]"> • {minCm === maxCm ? `${minCm}cm` : `${minCm}–${maxCm}cm`}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid={`v4-fav-toggle-${template.templateId}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(template.templateId);
            }}
            aria-label={isFavorite ? `${cleanTitle} favorilerden çıkar` : `${cleanTitle} favorilere ekle`}
            aria-pressed={isFavorite}
            className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
              isFavorite ? "text-amber-500" : "text-[#CBD5E1] hover:text-[#475569]"
            }`}
          >
            ★
          </button>
          <button
            type="button"
            data-testid={`v4-apply-tpl-${template.templateId}`}
            onClick={(e) => {
              e.stopPropagation();
              onApply(template.templateId);
            }}
            title="Aktif modüle uygula"
            className="px-2 py-1 rounded-md bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] border border-[#E2E8F0] text-[10px] font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          >
            Uygula
          </button>
          <button
            type="button"
            data-testid={`v4-append-tpl-${template.templateId}`}
            onClick={(e) => {
              e.stopPropagation();
              onAppend(template.templateId);
            }}
            title="Sahneye Yeni Modül Olarak Ekle"
            className="px-2 py-1 rounded-md bg-[#111827] hover:bg-[#1E293B] text-white text-[10px] font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          >
            + Ekle
          </button>
        </div>
      </div>
    );
  }
);
ModuleListRow.displayName = "ModuleListRow";

export const ModuleLibraryPanel: React.FC<ModuleLibraryPanelProps> = ({
  templates,
  activeModule,
  catalogViewMode,
  onChangeCatalogViewMode,
  catalogSearchQuery,
  onChangeSearchQuery,
  leftSubCat,
  selectedV4Family,
  onSelectCategoryChip,
  catalogWidthFilter,
  onChangeWidthFilter,
  catalogFeatureFilter,
  onChangeFeatureFilter,
  showFavoritesOnly,
  onToggleFavoritesOnly,
  favoriteTemplateIds,
  onSetFavoriteTemplateIds,
  onApplyTemplate,
  onDropTemplateWithSnap,
  onStartDragTemplate,
  onDragEndTemplate,
  onApplyReadyWardrobePreset,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastAddTsRef = useRef<number>(0);

  const [useThreeColumns, setUseThreeColumns] = useState<boolean>(false);
  const [showFilterBar, setShowFilterBar] = useState<boolean>(false);
  const [recentTemplateIds, setRecentTemplateIds] = useState<string[]>([]);
  const [detailTemplate, setDetailTemplate] = useState<V4ModuleTemplateDefinition | null>(null);
  const [previewMode, setPreviewMode] = useState<"isometric" | "elevation">("isometric");
  const [dimWidth, setDimWidth] = useState<number>(800);
  const [dimHeight, setDimHeight] = useState<number>(720);
  const [dimDepth, setDimDepth] = useState<number>(580);
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({
    fam_wardrobe: true,
    fam_kitchen_base: true,
  });
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [showReadyPresets, setShowReadyPresets] = useState<boolean>(true);

  // Hydrate favorites & recent templates from localStorage safely after mount
  useEffect(() => {
    const storedFavs = loadStoredIdList(FAVORITE_TEMPLATES_STORAGE_KEY, DEFAULT_FAVORITE_TEMPLATE_IDS);
    onSetFavoriteTemplateIds(storedFavs);
    const storedRecent = loadStoredIdList(RECENT_TEMPLATES_STORAGE_KEY, []);
    setRecentTemplateIds(storedRecent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Responsive column count via ResizeObserver on the actual panel container
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const updateCols = (w: number) => setUseThreeColumns(w >= 340);
    updateCols(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateCols(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escape key closes detail view
  useEffect(() => {
    if (!detailTemplate) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDetailTemplate(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailTemplate]);

  const showFeedback = useCallback((msg: string) => {
    setFeedbackToast(msg);
  }, []);

  useEffect(() => {
    if (!feedbackToast) return;
    const t = setTimeout(() => setFeedbackToast(null), 2400);
    return () => clearTimeout(t);
  }, [feedbackToast]);

  const recordRecentTemplate = useCallback((tplId: string) => {
    setRecentTemplateIds((prev) => {
      const next = [tplId, ...prev.filter((id) => id !== tplId)].slice(0, 6);
      saveStoredIdList(RECENT_TEMPLATES_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(
    (tplId: string) => {
      onSetFavoriteTemplateIds((prev) => {
        const next = prev.includes(tplId) ? prev.filter((id) => id !== tplId) : [...prev, tplId];
        saveStoredIdList(FAVORITE_TEMPLATES_STORAGE_KEY, next);
        return next;
      });
    },
    [onSetFavoriteTemplateIds]
  );

  const openDetail = useCallback((tpl: V4ModuleTemplateDefinition) => {
    setDetailTemplate(tpl);
    setPreviewMode("isometric");
    setDimWidth(tpl.defaultDimensions.width);
    setDimHeight(tpl.defaultDimensions.height);
    setDimDepth(tpl.defaultDimensions.depth);
  }, []);

  const guardedAddToScene = useCallback(
    (tplId: string, customDims?: { width?: number; height?: number; depth?: number }) => {
      const now = Date.now();
      if (now - lastAddTsRef.current < 320) return;
      lastAddTsRef.current = now;

      const res = onDropTemplateWithSnap(tplId, undefined, customDims);
      recordRecentTemplate(tplId);
      if (res) {
        showFeedback(`✓ ${res.placedName} sahneye eklendi`);
      } else {
        showFeedback("✓ Modül sahneye eklendi");
      }
    },
    [onDropTemplateWithSnap, recordRecentTemplate, showFeedback]
  );

  const guardedApplyToActive = useCallback(
    (tplId: string, customDims?: { width?: number; height?: number; depth?: number }) => {
      const now = Date.now();
      if (now - lastAddTsRef.current < 320) return;
      lastAddTsRef.current = now;

      onApplyTemplate(tplId, false, customDims);
      recordRecentTemplate(tplId);
      showFeedback("✓ Aktif modül güncellendi");
    },
    [onApplyTemplate, recordRecentTemplate, showFeedback]
  );

  const filteredTemplates = useMemo(
    () =>
      filterCatalogTemplates(templates, {
        subCat: (leftSubCat as StudioSubCategoryId) || "tumu",
        selectedFamily: selectedV4Family,
        searchQuery: catalogSearchQuery,
        widthFilter: catalogWidthFilter,
        featureFilter: catalogFeatureFilter,
        showFavoritesOnly,
        favoriteIds: favoriteTemplateIds,
        ignoreSubCategory: catalogViewMode === "category",
      }),
    [
      templates,
      leftSubCat,
      selectedV4Family,
      catalogSearchQuery,
      catalogWidthFilter,
      catalogFeatureFilter,
      showFavoritesOnly,
      favoriteTemplateIds,
      catalogViewMode,
    ]
  );

  const globalSearchMatchCount = useMemo(() => {
    if (!catalogSearchQuery.trim() || leftSubCat === "tumu" || catalogViewMode === "category") {
      return 0;
    }
    return filterCatalogTemplates(templates, {
      subCat: "tumu",
      selectedFamily: selectedV4Family,
      searchQuery: catalogSearchQuery,
      widthFilter: catalogWidthFilter,
      featureFilter: catalogFeatureFilter,
      showFavoritesOnly,
      favoriteIds: favoriteTemplateIds,
      ignoreSubCategory: true,
    }).length;
  }, [
    templates,
    catalogSearchQuery,
    leftSubCat,
    catalogViewMode,
    selectedV4Family,
    catalogWidthFilter,
    catalogFeatureFilter,
    showFavoritesOnly,
    favoriteTemplateIds,
  ]);

  const categoryTreeGroups = useMemo(
    () => buildCategoryTreeGroups(filteredTemplates),
    [filteredTemplates]
  );

  const recentTemplates = useMemo(
    () =>
      recentTemplateIds
        .map((id) => templates.find((t) => t.templateId === id))
        .filter((t): t is V4ModuleTemplateDefinition => Boolean(t)),
    [recentTemplateIds, templates]
  );

  const activeFilterCount =
    (catalogWidthFilter !== "all" ? 1 : 0) +
    (catalogFeatureFilter !== "all" ? 1 : 0) +
    (showFavoritesOnly ? 1 : 0);

  // Detail preview validation & 2D elevation data
  const detailValidation = useMemo(() => {
    if (!detailTemplate) return null;
    return clampTemplateDimensions(detailTemplate, {
      width: dimWidth,
      height: dimHeight,
      depth: dimDepth,
    });
  }, [detailTemplate, dimWidth, dimHeight, dimDepth]);

  const detailPreviewModule = useMemo(() => {
    if (!detailTemplate || !detailValidation) return null;
    const base = detailTemplate.createInstance("preview_detail");
    return applyValidatedDimensionsToModule(base, detailTemplate, {
      width: detailValidation.width,
      height: detailValidation.height,
      depth: detailValidation.depth,
    });
  }, [detailTemplate, detailValidation]);

  const detailElevation2D = useMemo(() => {
    if (!detailPreviewModule || previewMode !== "elevation") return null;
    try {
      const breakdown = generateModuleGeometry(detailPreviewModule);
      return generateElevation2D(breakdown);
    } catch {
      return null;
    }
  }, [detailPreviewModule, previewMode]);

  const detailHardware = useMemo(() => {
    if (!detailTemplate) return null;
    return getCompatibleHardwareForTemplate(detailTemplate);
  }, [detailTemplate]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white relative">
      {/* Feedback Toast */}
      {feedbackToast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="v4-catalog-feedback-toast"
          className="mx-3 mt-2 px-3 py-1.5 rounded-lg bg-[#111827] text-white text-[11px] font-medium flex items-center justify-between shadow-sm"
        >
          <span className="truncate">{feedbackToast}</span>
        </div>
      )}

      {/* DETAIL VIEW MODE (Replaces list area without closing library) */}
      {detailTemplate && detailValidation && detailPreviewModule ? (
        <div data-testid="v4-module-detail-panel" className="flex-1 flex flex-col min-h-0">
          {/* Sticky Detail Header */}
          <div className="px-3.5 py-2.5 border-b border-[#E2E8F0] flex items-center justify-between gap-2 bg-[#F8FAFC] shrink-0">
            <button
              type="button"
              data-testid="v4-detail-back-btn"
              onClick={() => setDetailTemplate(null)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[11px] font-semibold text-[#111827] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
            >
              ← Kütüphane
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => toggleFavorite(detailTemplate.templateId)}
                aria-label="Favori durumunu değiştir"
                className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs cursor-pointer ${
                  favoriteTemplateIds.includes(detailTemplate.templateId)
                    ? "bg-amber-50 border-amber-300 text-amber-500"
                    : "bg-white border-[#CBD5E1] text-[#94A3B8] hover:text-[#111827]"
                }`}
              >
                ★
              </button>
              <button
                type="button"
                onClick={() => setDetailTemplate(null)}
                aria-label="Detayı kapat"
                className="w-7 h-7 rounded-lg bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#475569] text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Scrollable Detail Content */}
          <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3">
            {/* Title & Description */}
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#475569] text-[10px] font-semibold">
                  {(
                    V4_MODULE_FAMILIES.find((f) => f.id === detailTemplate.familyId)?.name ||
                    "Modül"
                  ).replace(/^[A-F]\.\s*/, "")}
                </span>
                {detailTemplate.requiresFactoryValidation && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                    Fabrika Onayı Gerekli
                  </span>
                )}
                {detailTemplate.isFixedWidth && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                    Sabit Genişlik
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-[#111827] mt-1 leading-snug">
                {cleanTemplateTitle(detailTemplate.name)}
              </h3>
              <p className="text-[11px] text-[#475569] mt-0.5 leading-relaxed">
                {detailTemplate.description}
              </p>
            </div>

            {/* Preview Box (Draggable + Isometric / 2D Elevation Toggle) */}
            <div
              draggable={true}
              onDragStart={(e) => onStartDragTemplate(e, detailTemplate.templateId)}
              onDragEnd={onDragEndTemplate}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing"
              title="Sahneye sürükleyip bırakabilirsiniz"
            >
              <div className="w-full flex items-center justify-between">
                <span className="text-[10px] font-medium text-[#64748B]">
                  Önizleme (Sürüklenebilir)
                </span>
                <div className="inline-flex rounded-md bg-white border border-[#E2E8F0] p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("isometric")}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                      previewMode === "isometric"
                        ? "bg-[#EEF3F8] text-[#111827]"
                        : "text-[#64748B] hover:text-[#111827]"
                    }`}
                  >
                    3D İzometrik
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("elevation")}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                      previewMode === "elevation"
                        ? "bg-[#EEF3F8] text-[#111827]"
                        : "text-[#64748B] hover:text-[#111827]"
                    }`}
                  >
                    2D Cephe
                  </button>
                </div>
              </div>

              {previewMode === "elevation" && detailElevation2D ? (
                <div className="w-full h-40 flex items-center justify-center bg-white rounded-lg border border-[#E2E8F0] p-2">
                  <svg
                    viewBox={`${detailElevation2D.viewBox.x} ${detailElevation2D.viewBox.y} ${detailElevation2D.viewBox.width} ${detailElevation2D.viewBox.height}`}
                    className="w-full h-full max-h-36"
                  >
                    {detailElevation2D.elements.map((el) => (
                      <rect
                        key={el.id}
                        x={el.x}
                        y={el.y}
                        width={el.width}
                        height={el.height}
                        fill={el.role === "door" || el.role === "drawer_front" ? "#F8FAFC" : "#FFFFFF"}
                        stroke="#334155"
                        strokeWidth={Math.max(4, detailElevation2D.viewBox.width * 0.004)}
                      />
                    ))}
                  </svg>
                </div>
              ) : (
                <div className="w-full h-40 flex items-center justify-center bg-white rounded-lg border border-[#E2E8F0]">
                  <V3IsometricModuleIcon module={detailPreviewModule} size="2xl" />
                </div>
              )}

              <div className="text-[11px] font-mono tabular-nums text-[#334155] font-semibold">
                {detailValidation.width} × {detailValidation.height} × {detailValidation.depth} mm
              </div>
            </div>

            {/* Parametric Dimensions (Validated against dimensionLimits) */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#111827]">Parametrik Ölçüler (mm)</span>
                <button
                  type="button"
                  onClick={() => {
                    setDimWidth(detailTemplate.defaultDimensions.width);
                    setDimHeight(detailTemplate.defaultDimensions.height);
                    setDimDepth(detailTemplate.defaultDimensions.depth);
                  }}
                  className="text-[10px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Varsayılana Sıfırla
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-[#475569] mb-0.5">
                    Genişlik (G)
                  </label>
                  <input
                    type="number"
                    data-testid="v4-detail-width-input"
                    value={dimWidth}
                    disabled={Boolean(detailTemplate.isFixedWidth)}
                    min={detailTemplate.dimensionLimits.minW}
                    max={detailTemplate.dimensionLimits.maxW}
                    step={10}
                    onChange={(e) => setDimWidth(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-xs font-mono tabular-nums text-[#111827] disabled:bg-[#F1F5F9] disabled:text-[#64748B]"
                  />
                  <span className="block text-[9px] font-mono text-[#64748B] mt-0.5">
                    {detailTemplate.dimensionLimits.minW}–{detailTemplate.dimensionLimits.maxW}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#475569] mb-0.5">
                    Yükseklik (Y)
                  </label>
                  <input
                    type="number"
                    data-testid="v4-detail-height-input"
                    value={dimHeight}
                    min={detailTemplate.dimensionLimits.minH}
                    max={detailTemplate.dimensionLimits.maxH}
                    step={10}
                    onChange={(e) => setDimHeight(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-xs font-mono tabular-nums text-[#111827]"
                  />
                  <span className="block text-[9px] font-mono text-[#64748B] mt-0.5">
                    {detailTemplate.dimensionLimits.minH}–{detailTemplate.dimensionLimits.maxH}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#475569] mb-0.5">
                    Derinlik (D)
                  </label>
                  <input
                    type="number"
                    data-testid="v4-detail-depth-input"
                    value={dimDepth}
                    min={detailTemplate.dimensionLimits.minD}
                    max={detailTemplate.dimensionLimits.maxD}
                    step={10}
                    onChange={(e) => setDimDepth(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-xs font-mono tabular-nums text-[#111827]"
                  />
                  <span className="block text-[9px] font-mono text-[#64748B] mt-0.5">
                    {detailTemplate.dimensionLimits.minD}–{detailTemplate.dimensionLimits.maxD}
                  </span>
                </div>
              </div>

              {detailValidation.warnings.length > 0 && (
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-800 space-y-0.5">
                  {detailValidation.warnings.map((w) => (
                    <div key={w}>• {w}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Technical Specs & Compatible Hardware */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B]">Kapak Sistemi</span>
                <span className="font-semibold text-[#111827] text-right">
                  {getDoorSystemLabelTr(detailTemplate.defaultDoorSystemId)}
                </span>
              </div>
              {detailHardware?.primary && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#64748B]">Varsayılan Donanım</span>
                  <span className="font-semibold text-[#111827] text-right truncate max-w-[190px]">
                    {detailHardware.primary.manufacturerName} {detailHardware.primary.name}
                  </span>
                </div>
              )}
              {detailHardware && detailHardware.alternatives.length > 0 && (
                <div className="pt-1 border-t border-[#E2E8F0]">
                  <span className="text-[10px] font-semibold text-[#64748B] block mb-1">
                    Uyumlu Donanımlar
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {detailHardware.alternatives.map((hw) => (
                      <span
                        key={hw.id}
                        className="px-1.5 py-0.5 rounded bg-white border border-[#E2E8F0] text-[10px] text-[#334155]"
                      >
                        {hw.manufacturerName} {hw.sku}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Detail Action Footer */}
          <div className="px-3.5 py-2.5 border-t border-[#E2E8F0] bg-white grid grid-cols-2 gap-2 shrink-0">
            <button
              type="button"
              data-testid="v4-detail-apply-active"
              onClick={() =>
                guardedApplyToActive(detailTemplate.templateId, {
                  width: detailValidation.width,
                  height: detailValidation.height,
                  depth: detailValidation.depth,
                })
              }
              className="py-2 px-2.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] border border-[#CBD5E1] text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
            >
              Aktif Modüle Uygula
            </button>
            <button
              type="button"
              data-testid="v4-detail-add-to-scene"
              onClick={() =>
                guardedAddToScene(detailTemplate.templateId, {
                  width: detailValidation.width,
                  height: detailValidation.height,
                  depth: detailValidation.depth,
                })
              }
              className="py-2 px-2.5 rounded-xl bg-[#111827] hover:bg-[#1E293B] text-white text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
            >
              + Sahneye Ekle
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* PINNED HEADER: Title + 3-Way View Switcher */}
          <div className="px-3.5 pt-3 pb-2 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-sm font-bold text-[#111827] truncate">Modül Kütüphanesi</h2>
              <span className="px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] text-[10px] font-mono tabular-nums font-semibold">
                {filteredTemplates.length}
              </span>
            </div>

            <div
              role="group"
              aria-label="Görünüm Modu"
              className="inline-flex items-center p-0.5 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] shrink-0"
            >
              <button
                type="button"
                data-testid="catalog-view-grid"
                aria-pressed={catalogViewMode === "grid"}
                onClick={() => onChangeCatalogViewMode("grid")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                  catalogViewMode === "grid"
                    ? "bg-white text-[#111827] border border-[#CBD5E1] shadow-2xs"
                    : "text-[#64748B] hover:text-[#111827]"
                }`}
              >
                ⊞ Kart
              </button>
              <button
                type="button"
                data-testid="catalog-view-list"
                aria-pressed={catalogViewMode === "list"}
                onClick={() => onChangeCatalogViewMode("list")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                  catalogViewMode === "list"
                    ? "bg-white text-[#111827] border border-[#CBD5E1] shadow-2xs"
                    : "text-[#64748B] hover:text-[#111827]"
                }`}
              >
                ☰ Liste
              </button>
              <button
                type="button"
                data-testid="catalog-view-category"
                aria-pressed={catalogViewMode === "category"}
                onClick={() => onChangeCatalogViewMode("category")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                  catalogViewMode === "category"
                    ? "bg-white text-[#111827] border border-[#CBD5E1] shadow-2xs"
                    : "text-[#64748B] hover:text-[#111827]"
                }`}
              >
                ◫ Kategori
              </button>
            </div>
          </div>

          {/* PINNED SEARCH + FILTER + FAVORITES BAR */}
          <div className="px-3.5 pb-2 flex items-center gap-1.5 shrink-0">
            <div className="relative flex-1 flex items-center">
              <svg
                className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                data-testid="v4-catalog-search-input"
                value={catalogSearchQuery}
                onChange={(e) => onChangeSearchQuery(e.target.value)}
                placeholder="Modül, ölçü (800), çekmece ara..."
                aria-label="Modül kütüphanesinde ara"
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-medium text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:bg-white"
              />
              {catalogSearchQuery && (
                <button
                  type="button"
                  onClick={() => onChangeSearchQuery("")}
                  aria-label="Aramayı temizle"
                  className="absolute right-2 text-[#94A3B8] hover:text-[#111827] text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              data-testid="catalog-filter-favorites"
              onClick={onToggleFavoritesOnly}
              aria-pressed={showFavoritesOnly}
              title="Yalnızca Favori Modüller"
              className={`h-8 px-2 rounded-lg border flex items-center justify-center gap-1 shrink-0 text-[11px] font-semibold transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                showFavoritesOnly
                  ? "bg-amber-50 text-amber-700 border-amber-300"
                  : "bg-white hover:bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]"
              }`}
            >
              <span>★</span>
            </button>

            <button
              type="button"
              data-testid="catalog-filter-panel-toggle"
              onClick={() => setShowFilterBar((v) => !v)}
              aria-expanded={showFilterBar}
              title="Ölçü ve Özellik Filtreleri"
              className={`h-8 px-2 rounded-lg border flex items-center justify-center gap-1 shrink-0 text-[11px] font-semibold transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                showFilterBar || activeFilterCount > 0
                  ? "bg-[#EEF3F8] text-[#111827] border-[#2563EB]"
                  : "bg-white hover:bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]"
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="text-[10px] font-mono">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {/* Expandable Filter Controls (Width & Feature) */}
          {showFilterBar && (
            <div className="px-3.5 py-2 border-y border-[#E2E8F0] bg-[#F8FAFC] space-y-1.5 shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                <span className="text-[10px] font-semibold text-[#64748B] shrink-0 mr-1">Genişlik:</span>
                {(
                  [
                    { id: "all", label: "Tümü" },
                    { id: "narrow", label: "≤60 cm" },
                    { id: "medium", label: "65–100 cm" },
                    { id: "wide", label: "100+ cm" },
                  ] as const
                ).map((wf) => (
                  <button
                    key={wf.id}
                    type="button"
                    onClick={() => onChangeWidthFilter(wf.id)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 cursor-pointer border ${
                      catalogWidthFilter === wf.id
                        ? "bg-white text-[#111827] border-[#2563EB]"
                        : "bg-transparent text-[#475569] border-transparent hover:bg-white/80"
                    }`}
                  >
                    {wf.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 overflow-x-auto">
                <span className="text-[10px] font-semibold text-[#64748B] shrink-0 mr-1">Özellik:</span>
                {(
                  [
                    { id: "all", label: "Tümü" },
                    { id: "sliding", label: "Sürgülü" },
                    { id: "drawer", label: "Çekmeceli" },
                    { id: "open", label: "Açık / Raf" },
                  ] as const
                ).map((ff) => (
                  <button
                    key={ff.id}
                    type="button"
                    onClick={() => onChangeFeatureFilter(ff.id)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 cursor-pointer border ${
                      catalogFeatureFilter === ff.id
                        ? "bg-white text-[#111827] border-[#2563EB]"
                        : "bg-transparent text-[#475569] border-transparent hover:bg-white/80"
                    }`}
                  >
                    {ff.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PINNED WRAPPED CATEGORY CHIPS (Fits without horizontal scroll) */}
          {catalogViewMode !== "category" && (
            <div className="px-3.5 py-2 border-y border-[#E2E8F0] bg-[#F8FAFC] shrink-0">
              <div className="flex flex-wrap items-center gap-1">
                {CATALOG_CATEGORY_CHIPS.map((cat) => {
                  const isSelected = leftSubCat === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      data-testid={cat.testId}
                      aria-pressed={isSelected}
                      onClick={() => onSelectCategoryChip(cat.id, cat.familyId)}
                      className={`px-2 py-0.5 rounded-full text-[10.5px] shrink-0 transition-colors motion-reduce:transition-none cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                        isSelected
                          ? "bg-[#111827] text-white border-[#111827] font-semibold"
                          : "bg-white hover:bg-[#F1F5F9] text-[#475569] border-[#E2E8F0] font-medium"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SCROLLABLE MODULE CONTENT AREA */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3.5 py-2.5 space-y-3">
            {/* Recent Modules Quick Strip */}
            {recentTemplates.length > 0 && !catalogSearchQuery && !showFavoritesOnly && (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                  Son Kullanılanlar
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {recentTemplates.map((rt) => (
                    <button
                      key={`recent_${rt.templateId}`}
                      type="button"
                      onClick={() => openDetail(rt)}
                      className="px-2 py-1 rounded-lg bg-[#F8FAFC] hover:bg-[#EEF3F8] border border-[#E2E8F0] text-[10px] font-medium text-[#111827] shrink-0 max-w-[140px] truncate cursor-pointer"
                      title={`${cleanTemplateTitle(rt.name)} — Detayı aç`}
                    >
                      {cleanTemplateTitle(rt.name)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State with Global Search Fallback */}
            {filteredTemplates.length === 0 ? (
              <div className="py-8 px-3 text-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] space-y-2">
                <div className="text-xs font-semibold text-[#334155]">
                  Seçili filtrelerle eşleşen modül bulunamadı.
                </div>
                {globalSearchMatchCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectCategoryChip("tumu", "fam_wardrobe")}
                    className="px-3 py-1.5 rounded-lg bg-[#111827] text-white text-[11px] font-semibold cursor-pointer"
                  >
                    Tüm kategorilerde {globalSearchMatchCount} sonuç göster
                  </button>
                )}
              </div>
            ) : catalogViewMode === "category" ? (
              /* VIEW C: CATEGORY-FOCUSED DISCOVERY */
              <div data-testid="v4-template-list" className="space-y-2">
                {categoryTreeGroups.map((group) => {
                  const isOpen =
                    Boolean(catalogSearchQuery.trim()) ||
                    Boolean(expandedFamilies[group.familyId]);
                  return (
                    <div
                      key={group.familyId}
                      className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden"
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setExpandedFamilies((prev) => ({
                            ...prev,
                            [group.familyId]: !isOpen,
                          }))
                        }
                        className="w-full px-3 py-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] flex items-center justify-between gap-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-white border border-[#E2E8F0] text-[10px] font-mono font-bold text-[#334155] flex items-center justify-center shrink-0">
                            {group.familyCode}
                          </span>
                          <span className="text-xs font-bold text-[#111827] truncate">
                            {group.familyName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono text-[#64748B]">
                            {group.templates.length}
                          </span>
                          <span className="text-xs text-[#64748B]">{isOpen ? "▾" : "▸"}</span>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="p-2.5 space-y-3 border-t border-[#E2E8F0]">
                          {group.subcategories.map((sub) => (
                            <div key={sub.label} className="space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] font-semibold text-[#64748B] px-0.5">
                                <span>{sub.label}</span>
                                <span className="font-mono">{sub.templates.length}</span>
                              </div>
                              <div
                                className={
                                  useThreeColumns
                                    ? "grid grid-cols-3 gap-1.5"
                                    : "grid grid-cols-2 gap-1.5"
                                }
                              >
                                {sub.templates.map((vt) => (
                                  <ModuleCard
                                    key={vt.templateId}
                                    template={vt}
                                    isSelected={activeModule.templateId === vt.templateId}
                                    isFavorite={favoriteTemplateIds.includes(vt.templateId)}
                                    isCompactCols={useThreeColumns}
                                    onOpenDetail={openDetail}
                                    onApply={guardedApplyToActive}
                                    onAppend={guardedAddToScene}
                                    onToggleFavorite={toggleFavorite}
                                    onDragStart={onStartDragTemplate}
                                    onDragEnd={onDragEndTemplate}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : catalogViewMode === "list" ? (
              /* VIEW B: COMPACT TECHNICAL LIST */
              <div data-testid="v4-template-list" className="flex flex-col gap-1.5">
                {filteredTemplates.map((vt) => (
                  <ModuleListRow
                    key={vt.templateId}
                    template={vt}
                    isSelected={activeModule.templateId === vt.templateId}
                    isFavorite={favoriteTemplateIds.includes(vt.templateId)}
                    onOpenDetail={openDetail}
                    onApply={guardedApplyToActive}
                    onAppend={guardedAddToScene}
                    onToggleFavorite={toggleFavorite}
                    onDragStart={onStartDragTemplate}
                    onDragEnd={onDragEndTemplate}
                  />
                ))}
              </div>
            ) : (
              /* VIEW A: COMPACT VISUAL CARDS (DEFAULT) */
              <div
                data-testid="v4-template-list"
                className={useThreeColumns ? "grid grid-cols-3 gap-1.5" : "grid grid-cols-2 gap-2"}
              >
                {filteredTemplates.map((vt, idx) => (
                  <ModuleCard
                    key={vt.templateId}
                    template={vt}
                    isSelected={
                      activeModule.templateId === vt.templateId ||
                      (idx === 0 && !activeModule.templateId)
                    }
                    isFavorite={favoriteTemplateIds.includes(vt.templateId)}
                    isCompactCols={useThreeColumns}
                    onOpenDetail={openDetail}
                    onApply={guardedApplyToActive}
                    onAppend={guardedAddToScene}
                    onToggleFavorite={toggleFavorite}
                    onDragStart={onStartDragTemplate}
                    onDragEnd={onDragEndTemplate}
                  />
                ))}
              </div>
            )}

            {/* Hazır Şablonlar Section (Preserved) */}
            <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
              <button
                type="button"
                onClick={() => setShowReadyPresets((v) => !v)}
                className="w-full flex items-center justify-between text-xs font-bold text-[#111827] cursor-pointer"
              >
                <span>{showReadyPresets ? "⌄" : "▸"} Hazır Şablonlar</span>
                <span className="text-[10px] font-normal text-[#64748B]">İç Düzenli</span>
              </button>
              {showReadyPresets && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      tpl: WARDROBE_TEMPLATES[1] || WARDROBE_TEMPLATES[0],
                      title: "Giyinme Dolabı",
                      sub: "(3 Bölme)",
                      bays: 3,
                    },
                    {
                      tpl: WARDROBE_TEMPLATES[0],
                      title: "Elbise Dolabı",
                      sub: "(2 Bölme)",
                      bays: 2,
                    },
                  ].map((item, sIdx) => {
                    const isSelPreset = activeModule.bays.length === item.bays;
                    return (
                      <button
                        key={item.title}
                        type="button"
                        data-testid={`studio-ready-wardrobe-${sIdx}`}
                        onClick={() => onApplyReadyWardrobePreset(item.tpl?.templateId, item.bays)}
                        className={`p-2 rounded-xl border flex flex-col items-center text-center gap-1 transition-colors motion-reduce:transition-none cursor-pointer ${
                          isSelPreset
                            ? "bg-[#EEF3F8] border-[#2563EB] text-[#111827]"
                            : "bg-white hover:bg-[#F8FAFC] border-[#E2E8F0] text-[#111827]"
                        }`}
                      >
                        <V3IsometricModuleIcon
                          widthMm={item.bays * 600}
                          heightMm={2200}
                          depthMm={600}
                          bayCount={item.bays}
                          hasDrawers={true}
                          isOpenFront={true}
                          size="md"
                        />
                        <div className="text-[11px] font-bold text-[#111827] leading-tight">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-[#475569] leading-none">{item.sub}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
