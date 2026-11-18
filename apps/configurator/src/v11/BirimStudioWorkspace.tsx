"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  DEFAULT_MATERIALS,
  loadCustomStandardRules,
  type CustomStandardMetric,
  type CustomStandardRule,
  type DesignProject,
} from "@birim/core";
import { V5_SPECIALIZED_MODULE_TEMPLATES } from "@birim/catalog";
import { convertSceneObjectsToExportBoxes, generateModuleGeometry } from "@birim/geometry";
import {
  useV3Adapter,
  KITCHEN_ENGINEERING_RULE_REGISTRY,
  type EngineeringValidationFinding,
} from "../v3/adapter/useV3Adapter";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { V3ThreeViewport } from "../v3/components/V3ThreeViewport";
import type { CommandPaletteAction } from "../v3/components/workspace/CommandSearchModal";

import { StudioHeaderBar } from "./StudioHeaderBar";
import { LeftCatalogLauncher } from "./LeftCatalogLauncher";
import { RightParametricInspector } from "./RightParametricInspector";
import { ShowroomPresentationOverlay } from "./ShowroomPresentationOverlay";
import { BottomSceneDock } from "./BottomSceneDock";
import { OnObjectQuickToolbar, type Selected3DPartKind } from "./OnObjectQuickToolbar";
import type {
  V11CadSubMode,
  V11InspectorTab,
  V11LeftDrawerTab,
  V11WorkspaceMode,
} from "./v11Constants";

const V3CadViewport2D = dynamic(() => import("../v3/components/V3CadViewport2D"), { ssr: false });
const V3ProjectModal = dynamic(
  () => import("../v3/components/V3ProjectModal").then((m) => m.V3ProjectModal),
  { ssr: false }
);
const BomModal = dynamic(() => import("../components/BomModal"), { ssr: false });
const StoreErpModal = dynamic(() => import("../components/StoreErpModal"), { ssr: false });
const AssemblyDiagramModal = dynamic(
  () =>
    import("../v3/components/workspace/AssemblyDiagramModal").then(
      (m) => m.AssemblyDiagramModal
    ),
  { ssr: false }
);
const StudioRenderModal = dynamic(
  () => import("../v3/components/workspace/StudioRenderModal").then((m) => m.StudioRenderModal),
  { ssr: false }
);
const ArRoomPreviewModal = dynamic(
  () => import("../v3/components/workspace/ArRoomPreviewModal").then((m) => m.ArRoomPreviewModal),
  { ssr: false }
);
const RulesStandardsModal = dynamic(
  () =>
    import("../v3/components/workspace/RulesStandardsModal").then((m) => m.RulesStandardsModal),
  { ssr: false }
);
const SaasTenantStudioModal = dynamic(
  () =>
    import("../v3/components/workspace/SaasTenantStudioModal").then(
      (m) => m.SaasTenantStudioModal
    ),
  { ssr: false }
);
const CommandSearchModal = dynamic(
  () => import("../v3/components/workspace/CommandSearchModal").then((m) => m.CommandSearchModal),
  { ssr: false }
);
const KitchenIslandTableModal = dynamic(
  () =>
    import("../v3/components/workspace/KitchenIslandTableModal").then(
      (m) => m.KitchenIslandTableModal
    ),
  { ssr: false }
);
const CustomHardwareModal = dynamic(
  () =>
    import("../v3/components/workspace/CustomHardwareModal").then((m) => m.CustomHardwareModal),
  { ssr: false }
);
const MepCoordinationModal = dynamic(
  () =>
    import("../v3/components/workspace/MepCoordinationModal").then(
      (m) => m.MepCoordinationModal
    ),
  { ssr: false }
);
const SceneObjectAndModuleHubModal = dynamic(
  () =>
    import("../v3/components/workspace/SceneObjectAndModuleHubModal").then(
      (m) => m.SceneObjectAndModuleHubModal
    ),
  { ssr: false }
);
const GuidedSetupModal = dynamic(
  () => import("./GuidedSetupModal").then((m) => m.GuidedSetupModal),
  { ssr: false }
);
const QuoteSummaryModal = dynamic(
  () => import("./QuoteSummaryModal").then((m) => m.QuoteSummaryModal),
  { ssr: false }
);
const SectionPlaneMiniMap = dynamic(
  () => import("./SectionPlaneMiniMap").then((m) => m.SectionPlaneMiniMap),
  { ssr: false }
);
const PanelCutoutModal = dynamic(
  () => import("./PanelCutoutModal").then((m) => m.PanelCutoutModal),
  { ssr: false }
);

const EMPTY_SCENE_OBJECTS: NonNullable<DesignProject["sceneObjects"]> = [];
const EMPTY_FINDINGS: EngineeringValidationFinding[] = [];

export interface BirimStudioWorkspaceProps {
  initialMode?: "studio" | "plan" | "showroom";
}

export const BirimStudioWorkspace: React.FC<BirimStudioWorkspaceProps> = ({
  initialMode = "studio",
}) => {
  const {
    project,
    activeModule,
    activeModuleIndex,
    activeBayIndex,
    pricing,
    bom,
    canUndo,
    canRedo,
    undo,
    redo,
    doorOpenAngleDeg,
    setDoorOpenAngleDeg,
    explodedFactor,
    setExplodedFactor,
    cncXrayMode,
    toggleCncXrayMode,
    v4ModuleTemplates,
    handleProfiles,
    spaceObstacles,
    spaceWalls,
    unifiedEngineeringReport,
    ergonomicProfileId,
    setErgonomicProfileId,
    regionalErgonomicProfiles,
    applyApprovedEngineeringFix,
    setActiveModuleIndex,
    setActiveBayIndex,
    setDimensions,
    setPlinthHeight,
    splitBayIntoTwo,
    equalizeBaysAndShelves,
    removeBayAt,
    setBayCustomWidth,
    applyBayInteriorPreset,
    addShelf,
    addFixedShelf,
    setShelfMountType,
    removeShelf,
    setShelfElevation,
    setShelfThickness,
    addDrawer,
    addInternalDrawer,
    setDrawerPlacement,
    removeDrawer,
    addHangingRail,
    setHangingRailElevation,
    setHangingRailProfile,
    removeHangingRail,
    addSpecialFitting,
    removeSpecialFitting,
    addSubDivider,
    setSubDividerPlacement,
    removeSubDivider,
    removeSelectedInteriorComponent,
    selectedComponentId,
    setBayDoorType,
    setModuleSlidingMountingType,
    setBayV4DoorConfig,
    copyDoorConfigToAllBays,
    copyBayInteriorToAllBays,
    mirrorModuleBaysLeftRight,
    updateCarcassConfig,
    applyMaterialByTargetScope,
    addCustomMaterialToProject,
    toggleModuleLedLighting,
    applyV4Template,
    dropV4TemplateWithSnap,
    duplicateActiveModule,
    addStackedTopModule,
    rotateActiveModule90,
    removeActiveModule,
    removeModuleAt,
    fillWallGapWithParametricModule,
    setRoomDimensions,
    setFacadeGrainContinuity,
    beginHistoryTransaction,
    commitHistoryTransaction,
    addSpaceObstacle,
    removeSpaceObstacle,
    applyGuidedWizardLayout,
    addKitchenIslandUnit,
    addOrUpdateAttachedTable,
    loadLinearKitchen,
    loadLKitchen,
    loadUKitchen,
    selectedSceneObjectId,
    setSelectedSceneObjectId,
    appendModuleWithMultiWallSnap,
    addCompositeAssemblyPreset,
    saveActiveModuleAsCustomTemplate,
    deleteCustomModuleTemplate,
    addSceneObjectFromCatalog,
    addCustomSceneObject,
    updateSceneObject,
    duplicateSceneObject,
    removeSceneObject,
    addCustomCapsuleModule,
    runAutoFillersAndCrown,
    runAutoNotchObstacles,
    importRoomPlanLiDARJson,
    setModuleUtilityCutouts,
    autoResolveCornerCollisions,
  } = useV3Adapter();

  const experienceTier = useConfiguratorStore((s) => s.userExperienceTier);
  const displayUnit = useConfiguratorStore((s) => s.displayUnit);
  const setDisplayUnit = useConfiguratorStore((s) => s.setDisplayUnit);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("birim_elev_unit");
      if (saved === "mm" || saved === "cm") {
        setDisplayUnit(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, [setDisplayUnit]);
  const setExperienceTier = useConfiguratorStore((s) => s.setUserExperienceTier);
  const viewportRenderStyle = useConfiguratorStore((s) => s.viewportRenderStyle);
  const setViewportRenderStyle = useConfiguratorStore((s) => s.setViewportRenderStyle);
  const activeTenantId = useConfiguratorStore((s) => s.activeTenantId);
  const updateCeilingConfig = useConfiguratorStore((s) => s.updateCeilingConfig);

  const [workspaceMode, setWorkspaceMode] = useState<V11WorkspaceMode>(() =>
    initialMode === "plan" ? "plan" : initialMode === "showroom" ? "showroom" : "3d"
  );
  const [cadSubMode, setCadSubMode] = useState<V11CadSubMode>("elevation");
  const [split2DViewMode, setSplit2DViewMode] = useState<"elevation" | "plan" | "section">("elevation");
  const [splitRatio3D, setSplitRatio3D] = useState<number>(50);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [sectionAxis2D, setSectionAxis2D] = useState<"X" | "Z">("X");
  const [sectionRatio2D, setSectionRatio2D] = useState<number>(0.5);

  const [leftDrawer, setLeftDrawer] = useState<V11LeftDrawerTab>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [inspectorTab, setInspectorTab] = useState<V11InspectorTab>("interior");
  const [showDimensions3D, setShowDimensions3D] = useState<boolean>(true);
  const [doorsHidden3D, setDoorsHidden3D] = useState<boolean>(false);
  const [showInteriorProps3D, setShowInteriorProps3D] = useState<boolean>(true);
  const [toastText, setToastText] = useState<string | null>(null);
  const [selected3DContextLabel, setSelected3DContextLabel] = useState<string | null>(null);
  const [selected3DPartKind, setSelected3DPartKind] = useState<Selected3DPartKind>("bay");
  const [selected3DCompId, setSelected3DCompId] = useState<string | null>(null);
  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(false);
  const [uiFontScale, setUiFontScale] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const raw = Number(window.localStorage.getItem("birim_ui_font_scale") || "1");
    return Number.isFinite(raw) && raw >= 0.9 && raw <= 1.25 ? raw : 1;
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.fontSize = `${Math.round(16 * uiFontScale)}px`;
    try {
      window.localStorage.setItem("birim_ui_font_scale", String(uiFontScale));
    } catch {}
  }, [uiFontScale]);

  // Lazy-mounted modal states
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [wizardModalOpen, setWizardModalOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [bomModalTab, setBomModalTab] = useState<
    null | "cutlist" | "nesting" | "cnc_mpr_cix" | "blum_bxf"
  >(null);
  const [storeErpOpen, setStoreErpOpen] = useState(false);
  const [assemblyModalOpen, setAssemblyModalOpen] = useState(false);
  const [studioRenderOpen, setStudioRenderOpen] = useState(false);
  const [arModalOpen, setArModalOpen] = useState(false);
  const [standardsModalOpen, setStandardsModalOpen] = useState(false);
  const [saasModalOpen, setSaasModalOpen] = useState(false);
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);
  const [kitchenIslandOpen, setKitchenIslandOpen] = useState(false);
  const [customHardwareOpen, setCustomHardwareOpen] = useState(false);
  const [mepModalOpen, setMepModalOpen] = useState(false);
  const [cutoutModalOpen, setCutoutModalOpen] = useState(false);
  const [sceneHubTab, setSceneHubTab] = useState<
    null | "modules" | "capsule_curved" | "appliances" | "furniture" | "custom_glb" | "automation"
  >(null);
  const [, setCatalogBump] = useState(0);

  // Standards modal local states
  const [rulesTab, setRulesTab] = useState<"audit" | "catalog" | "add_custom">("audit");
  const [customStdRules, setCustomStdRules] = useState<CustomStandardRule[]>(() =>
    typeof window !== "undefined" ? loadCustomStandardRules() : []
  );
  const [newStdName, setNewStdName] = useState("");
  const [newStdRef, setNewStdRef] = useState("Özel Fabrika Kuralı");
  const [newStdMetric, setNewStdMetric] = useState<CustomStandardMetric>("max_shelf_span_18mm");
  const [newStdThreshold, setNewStdThreshold] = useState(850);
  const [newStdCategory, setNewStdCategory] =
    useState<CustomStandardRule["appliesToCategory"]>("all");
  const [newStdSeverity, setNewStdSeverity] = useState<"warning" | "error">("warning");


  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncViewport = () => {
      setIsCompactViewport(window.innerWidth < 768);
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const handleChangeLeftDrawer = useCallback((nextDrawer: V11LeftDrawerTab) => {
    setLeftDrawer(nextDrawer);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        setToastText((prev) => (prev === msg ? null : prev));
      }, 2400);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBay3D = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{ bayIndex?: number; moduleIndex?: number; role?: string; componentId?: string }>
      ).detail;
      if (typeof detail?.moduleIndex === "number" && detail.moduleIndex >= 0) {
        setActiveModuleIndex(detail.moduleIndex);
      }
      const bIdx = typeof detail?.bayIndex === "number" ? detail.bayIndex : 0;
      setActiveBayIndex(bIdx);
      setSelected3DCompId(detail?.componentId || null);
      const r = detail?.role || "";
      const partKind: Selected3DPartKind = r.includes("sub_divider")
        ? "sub_divider"
        : r.includes("shelf")
        ? "shelf"
        : r.includes("drawer")
        ? "drawer"
        : r.includes("rail")
        ? "rail"
        : "bay";
      const roleTr =
        partKind === "sub_divider"
          ? "Raf Arası Dikme"
          : partKind === "shelf"
          ? "Raf"
          : partKind === "drawer"
          ? "Çekmece"
          : partKind === "rail"
          ? "Askı Borusu"
          : "Bölme İçi";
      setSelected3DPartKind(partKind);
      setSelected3DContextLabel(`${bIdx + 1}. Bölme • ${roleTr}`);
      setInspectorTab("interior");
      setIsInspectorOpen(true);
    };
    const onDoor3D = (ev: Event) => {
      const detail = (ev as CustomEvent<{ bayIndex?: number; componentId?: string }>).detail;
      const bIdx = typeof detail?.bayIndex === "number" ? detail.bayIndex : 0;
      setActiveBayIndex(bIdx);
      setSelected3DCompId(detail?.componentId || null);
      setSelected3DPartKind("door");
      setSelected3DContextLabel(`${bIdx + 1}. Bölme • Kapak`);
      setInspectorTab("doors");
      setIsInspectorOpen(true);
    };
    const onMat3D = () => {
      setSelected3DPartKind("door");
      setSelected3DContextLabel("Yüzey & Kartela");
      setInspectorTab("materials");
      setIsInspectorOpen(true);
    };
    const onClear3DSelection = () => {
      setSelected3DContextLabel(null);
      setSelected3DCompId(null);
    };
    const onOpenStudioRender = () => setStudioRenderOpen(true);
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandSearchOpen((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          undo();
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener("birim:select-bay-3d", onBay3D);
    window.addEventListener("birim:select-door-3d", onDoor3D);
    window.addEventListener("birim:select-material-part-3d", onMat3D);
    window.addEventListener("birim:clear-3d-selection", onClear3DSelection);
    window.addEventListener("birim:open-studio-render-modal", onOpenStudioRender);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("birim:select-bay-3d", onBay3D);
      window.removeEventListener("birim:select-door-3d", onDoor3D);
      window.removeEventListener("birim:select-material-part-3d", onMat3D);
      window.removeEventListener("birim:clear-3d-selection", onClear3DSelection);
      window.removeEventListener("birim:open-studio-render-modal", onOpenStudioRender);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [setActiveBayIndex, undo, redo]);

  // Combine V5 specialized templates (TV Bench, Capsule Table, Capsule Bar, Bookcase, Vestiyer, Vanity) + V4 templates + user custom templates
  const combinedTemplates = useMemo(() => {
    const customAsDefs = (project.customModuleTemplates || []).map((ct) => ({
      templateId: ct.templateId,
      familyId: ct.familyId,
      category: ct.serializedModuleSnapshot.category,
      name: ct.name,
      description: "Kaydedilmiş özel modül şablonu",
      defaultDimensions: ct.serializedModuleSnapshot.dimensions,
      dimensionLimits: { minW: 300, maxW: 3600, minH: 350, maxH: 2900, minD: 280, maxD: 950 },
      defaultDoorSystemId: "hinged_double" as const,
      compatibleDoorSystems: ["hinged_single", "hinged_double", "sliding_top_hung", "open"] as any,
      createInstance: (id: string, customName?: string) => {
        const cl = JSON.parse(JSON.stringify(ct.serializedModuleSnapshot));
        cl.id = id;
        if (customName) cl.name = customName;
        return cl;
      },
    }));
    const v5Ids = new Set(V5_SPECIALIZED_MODULE_TEMPLATES.map((t) => t.templateId));
    return [
      ...customAsDefs,
      ...V5_SPECIALIZED_MODULE_TEMPLATES,
      ...v4ModuleTemplates.filter((t) => !v5Ids.has(t.templateId)),
    ];
  }, [v4ModuleTemplates, project.customModuleTemplates]);

  const allMaterials = useMemo(
    () => [...DEFAULT_MATERIALS, ...(project.customMaterials || [])],
    [project.customMaterials]
  );

  const wallWidthMm = spaceWalls?.[0]?.length || project.space?.walls?.[0]?.length || 3600;
  const ceilingHeightMm = spaceWalls?.[0]?.height || project.space?.ceilingHeight || 2600;

  const allFindings = useMemo(() => {
    if (!unifiedEngineeringReport) return EMPTY_FINDINGS;
    if (Array.isArray(unifiedEngineeringReport.findings)) {
      return unifiedEngineeringReport.findings;
    }
    return [
      ...(Array.isArray(unifiedEngineeringReport.blockingSafetyAndEngineeringErrors)
        ? unifiedEngineeringReport.blockingSafetyAndEngineeringErrors
        : []),
      ...(Array.isArray(unifiedEngineeringReport.verificationRequiredFindings)
        ? unifiedEngineeringReport.verificationRequiredFindings
        : []),
      ...(Array.isArray(unifiedEngineeringReport.ergonomicAdvisories)
        ? unifiedEngineeringReport.ergonomicAdvisories
        : []),
    ];
  }, [unifiedEngineeringReport]);

  const blockingCount = Array.isArray(
    unifiedEngineeringReport?.blockingSafetyAndEngineeringErrors
  )
    ? unifiedEngineeringReport.blockingSafetyAndEngineeringErrors.length
    : 0;

  // NEVER call window.dispatchEvent inside a setState(prev => ...) reducer!
  const handleToggleDoorsHidden = useCallback(() => {
    const next = !doorsHidden3D;
    setDoorsHidden3D(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("birim:set-doors-hidden", { detail: next }));
    }
  }, [doorsHidden3D]);

  const handleToggleInteriorProps = useCallback(() => {
    const next = !showInteriorProps3D;
    setShowInteriorProps3D(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("birim:toggle-interior-props", { detail: { visible: next } })
      );
    }
  }, [showInteriorProps3D]);

  const handleFillRemainingWallGap = useCallback(() => {
    const mainMods = project.modules.filter((m) => m.category !== "complementary");
    const maxRight = mainMods.reduce(
      (acc, m) => Math.max(acc, m.position.x + m.dimensions.width),
      0
    );
    const gapW = Math.round(wallWidthMm - maxRight);
    if (gapW < 350) {
      showToast("Duvar üzerinde tamamlanacak yeterli boşluk kalmadı.");
      return;
    }
    fillWallGapWithParametricModule({
      id: `gap_${maxRight}`,
      wallId: spaceWalls?.[0]?.id || "wall_north",
      wallName: "Ana Duvar",
      zone: "base",
      startAlongMm: maxRight,
      endAlongMm: wallWidthMm,
      widthMm: gapW,
      targetElevationY: 0,
      worldOriginX: maxRight,
      worldOriginZ: 0,
      moduleRotationYDeg: 0,
    });
    showToast(`${Math.round(gapW / 10)} cm boşluk yeni modülle tamamlandı.`);
  }, [project.modules, wallWidthMm, spaceWalls, fillWallGapWithParametricModule, showToast]);

  const commandActions = useMemo<CommandPaletteAction[]>(
    () => [
      {
        id: "open_catalog",
        labelTr: "Ürün, Modül, TV Bench ve Masa Kataloğunu Aç",
        categoryTr: "Tasarım",
        keywords: "modül ekle gardırop mutfak tv bench konsol masa kütüphane",
        onExecute: () => setLeftDrawer("catalog"),
      },
      {
        id: "open_island",
        labelTr: "Şelale Mutfak Adası ve Açılı Yemek/Bar Masası Ekle",
        categoryTr: "Mutfak",
        keywords: "ada mutfak şelale masa bar taburesi",
        onExecute: () => setKitchenIslandOpen(true),
      },
      {
        id: "open_capsule",
        labelTr: "Kapsül Stadyum Yemek Masası & Tamburlu Konsol Tasarla",
        categoryTr: "Özel Ürün",
        keywords: "kapsül oval masa konsol bar glb 3d",
        onExecute: () => setSceneHubTab("capsule_curved"),
      },
      {
        id: "open_wizard",
        labelTr: "Hızlı Oda & Dolap Kurulum Sihirbazı",
        categoryTr: "Tasarım",
        keywords: "sihirbaz otomatik kurulum oda",
        onExecute: () => setWizardModalOpen(true),
      },
      {
        id: "open_section_2d",
        labelTr: "Görsel Planlı 2B A-A Yan Kesit Ekranını Aç",
        categoryTr: "Teknik Çizim",
        keywords: "kesit plan aa bb 2d",
        onExecute: () => {
          setWorkspaceMode("2d");
          setCadSubMode("section");
        },
      },
      {
        id: "open_mep",
        labelTr: "Elektrik ve Sıhhi Tesisat (MEP) Koordinasyon Planı",
        categoryTr: "Mühendislik",
        keywords: "tesisat elektrik su priz boru mep dxf",
        onExecute: () => setMepModalOpen(true),
      },
      {
        id: "open_cutout",
        labelTr: "Panel Kertme ve Priz / Boru CNC Kesimi",
        categoryTr: "Mühendislik",
        keywords: "kertme priz boru kolon kesim cnc",
        onExecute: () => setCutoutModalOpen(true),
      },
      {
        id: "open_bom",
        labelTr: "Kesim Listesi, Plaka Nesting, CNC (.MPR/.CIX) ve Blum BXF",
        categoryTr: "Üretim",
        keywords: "bom kesim nesting cnc dxf mpr cix blum bxf plaka",
        onExecute: () => setBomModalTab("cutlist"),
      },
      {
        id: "open_erp",
        labelTr: "Birim Store & Portal ERP Sipariş Aktarımı",
        categoryTr: "Üretim",
        keywords: "erp mağaza store sipariş portal",
        onExecute: () => setStoreErpOpen(true),
      },
      {
        id: "open_quote",
        labelTr: "Müşteri Fiyat Teklifi ve Görselli PDF",
        categoryTr: "Satış",
        keywords: "fiyat teklif pdf iskonto",
        onExecute: () => setQuoteModalOpen(true),
      },
    ],
    []
  );

  const arExportParts = useMemo(() => {
    if (!arModalOpen) return [];
    const boxes = project.modules.flatMap((mod) => {
      const geom = generateModuleGeometry(mod, { doorOpenAngleDeg: 0 });
      return geom.components.map((c) => ({
        id: `${mod.id}_${c.id}`,
        name: c.label,
        role: c.role,
        moduleId: mod.id,
        moduleName: mod.name,
        positionMm: {
          x: mod.position.x + c.position.x,
          y: mod.position.y + c.position.y,
          z: mod.position.z + c.position.z,
        },
        dimensionsMm: {
          width: c.dimensions.width,
          height: c.dimensions.height,
          depth: c.dimensions.depth,
        },
        materialId: c.materialId,
      }));
    });
    const sceneBoxes = convertSceneObjectsToExportBoxes(project.sceneObjects || []);
    return [...boxes, ...sceneBoxes];
  }, [arModalOpen, project.modules, project.sceneObjects]);

  const stageSafeInsets = useMemo(
    () => ({
      topPx: 74,
      bottomPx: 76,
      leftPx: leftDrawer ? 480 : 76,
      rightPx: workspaceMode === "showroom" ? 24 : isInspectorOpen ? 444 : 64,
    }),
    [leftDrawer, workspaceMode, isInspectorOpen]
  );

  const isShowroom = workspaceMode === "showroom";
  const show3DCanvas =
    workspaceMode === "3d" ||
    workspaceMode === "showroom" ||
    (workspaceMode === "2d" && cadSubMode === "split");

  // Map SectionPlaneMiniMap axis ("X" = A-A vertical cut along width, "Z" = B-B longitudinal cut along depth)
  // to V3CadViewport2D's internal convention ("Z" = A-A cut along width, "X" = B-B cut along depth)
  const cadExternalSectionDir: "Z" | "X" = sectionAxis2D === "X" ? "Z" : "X";

  const stableSceneObjects = project.sceneObjects || EMPTY_SCENE_OBJECTS;

  const latestRef = useRef({
    project,
    activeModule,
    isShowroom,
    showToast,
    applyApprovedEngineeringFix,
    setActiveModuleIndex,
    setActiveBayIndex,
    applyV4Template,
    dropV4TemplateWithSnap,
    addCompositeAssemblyPreset,
    addSceneObjectFromCatalog,
    updateSceneObject,
    duplicateActiveModule,
    addStackedTopModule,
    loadLinearKitchen,
    loadLKitchen,
    loadUKitchen,
    setFacadeGrainContinuity,
    runAutoFillersAndCrown,
    saveActiveModuleAsCustomTemplate,
    addCustomMaterialToProject,
    setBayCustomWidth,
    addInternalDrawer,
    setDrawerPlacement,
    addSubDivider,
    applyMaterialByTargetScope,
    toggleModuleLedLighting,
    rotateActiveModule90,
    setDoorOpenAngleDeg,
  });
  latestRef.current = {
    project,
    activeModule,
    isShowroom,
    showToast,
    applyApprovedEngineeringFix,
    setActiveModuleIndex,
    setActiveBayIndex,
    applyV4Template,
    dropV4TemplateWithSnap,
    addCompositeAssemblyPreset,
    addSceneObjectFromCatalog,
    updateSceneObject,
    duplicateActiveModule,
    addStackedTopModule,
    loadLinearKitchen,
    loadLKitchen,
    loadUKitchen,
    setFacadeGrainContinuity,
    runAutoFillersAndCrown,
    saveActiveModuleAsCustomTemplate,
    addCustomMaterialToProject,
    setBayCustomWidth,
    addInternalDrawer,
    setDrawerPlacement,
    addSubDivider,
    applyMaterialByTargetScope,
    toggleModuleLedLighting,
    rotateActiveModule90,
    setDoorOpenAngleDeg,
  };

  // Memoized callbacks so React.memo on StudioHeaderBar, LeftCatalogLauncher,
  // RightParametricInspector & BottomSceneDock stays intact during 60fps animations
  const handleApplyFindingFix = useCallback((prop: Parameters<typeof applyApprovedEngineeringFix>[0]) => {
    latestRef.current.applyApprovedEngineeringFix(prop);
    latestRef.current.showToast("Önerilen iyileştirme uygulandı.");
  }, []);

  const handleFocusFinding = useCallback((fd: EngineeringValidationFinding) => {
    const mIdx = latestRef.current.project.modules.findIndex((m) => m.id === fd.targetModuleId);
    if (mIdx >= 0) latestRef.current.setActiveModuleIndex(mIdx);
    const bMatch = String(fd.targetId || "").match(/bay_(\d+)/);
    if (bMatch) latestRef.current.setActiveBayIndex(Number(bMatch[1]));
    setInspectorTab(
      fd.code.includes("DOOR") || fd.code.includes("HINGE") || fd.code.includes("HANDLE")
        ? "doors"
        : "interior"
    );
    setIsInspectorOpen(true);
  }, []);

  const handleOpenProjectModal = useCallback(() => setProjectModalOpen(true), []);
  const handleOpenWizardModal = useCallback(() => setWizardModalOpen(true), []);
  const handleOpenCommandSearch = useCallback(() => setCommandSearchOpen(true), []);
  const handleOpenQuoteModal = useCallback(() => setQuoteModalOpen(true), []);
  const handleOpenBomModal = useCallback(
    (tab?: "cutlist" | "nesting" | "cnc_mpr_cix" | "blum_bxf") => setBomModalTab(tab || "cutlist"),
    []
  );
  const handleOpenAssemblyModal = useCallback(() => setAssemblyModalOpen(true), []);
  const handleOpenStudioRenderModal = useCallback(() => setStudioRenderOpen(true), []);
  const handleOpenArModal = useCallback(() => setArModalOpen(true), []);
  const handleOpenStoreErpModal = useCallback(() => setStoreErpOpen(true), []);
  const handleOpenStandardsModal = useCallback(() => setStandardsModalOpen(true), []);
  const handleOpenSaasModal = useCallback(() => setSaasModalOpen(true), []);
  const handleOpenMepModal = useCallback(() => setMepModalOpen(true), []);
  const handleOpenCutoutModal = useCallback(() => setCutoutModalOpen(true), []);
  const handleOpenSceneHubCapsule = useCallback(() => setSceneHubTab("capsule_curved"), []);

  const handleToggleDimensions3D = useCallback(() => setShowDimensions3D((v) => !v), []);
  const handleRequest2DElevation = useCallback(() => {
    setWorkspaceMode("2d");
    setCadSubMode("elevation");
  }, []);

  const handleExternalSectionChange = useCallback((dir: "Z" | "X", r: number) => {
    setSectionAxis2D(dir === "Z" ? "X" : "Z");
    setSectionRatio2D(r);
  }, []);

  const handleApplyTemplateToActive = useCallback((tplId: string) => {
    latestRef.current.applyV4Template(tplId);
    latestRef.current.showToast("Ürün şablonu uygulandı.");
  }, []);

  const handleAppendTemplateAdjacent = useCallback((tplId: string) => {
    latestRef.current.dropV4TemplateWithSnap(tplId);
    latestRef.current.showToast("Yeni ürün yanına eklendi.");
  }, []);

  const handleAddCompositeAssembly = useCallback((presetId: string) => {
    latestRef.current.addCompositeAssemblyPreset(presetId);
    latestRef.current.showToast("Hazır set sahneye eklendi.");
  }, []);

  const handleAddSceneObject = useCallback((catalogId: string) => {
    latestRef.current.addSceneObjectFromCatalog(catalogId);
    latestRef.current.showToast("3B eşya sahneye yerleştirildi.");
  }, []);

  const handleRotateSceneObject = useCallback((id: string) => {
    const cur = (latestRef.current.project.sceneObjects || []).find((o) => o.id === id);
    if (cur) {
      latestRef.current.updateSceneObject(id, {
        rotation: {
          x: cur.rotation?.x ?? 0,
          y: ((cur.rotation?.y ?? 0) + 90) % 360,
          z: cur.rotation?.z ?? 0,
        },
      });
    }
  }, []);

  const handleDuplicateActiveModule = useCallback(() => {
    latestRef.current.duplicateActiveModule();
    latestRef.current.showToast("Modül yanına kopyalandı.");
  }, []);

  const handleAddStackedTopModule = useCallback(() => {
    latestRef.current.addStackedTopModule();
    latestRef.current.showToast("Üst yüklük modülü eklendi.");
  }, []);

  const handleLoadKitchenPreset = useCallback((kind: "linear" | "l" | "u") => {
    if (kind === "linear") latestRef.current.loadLinearKitchen();
    else if (kind === "l") latestRef.current.loadLKitchen();
    else latestRef.current.loadUKitchen();
    latestRef.current.showToast("Hazır mutfak yerleşimi yüklendi.");
  }, []);

  const handleOpenKitchenIslandModal = useCallback(() => setKitchenIslandOpen(true), []);
  const handleToggleInspectorOpen = useCallback(() => setIsInspectorOpen((v) => !v), []);

  const handleQuickNavigateStep = useCallback((step: "dimensions" | "interior" | "showroom") => {
    if (step === "showroom") {
      setWorkspaceMode("showroom");
      return;
    }
    setWorkspaceMode("3d");
    setInspectorTab(step);
    setIsInspectorOpen(true);
  }, []);

  const handleCycleBayDoorType = useCallback((bIdx: number) => {
    const cur = latestRef.current.activeModule?.bays[bIdx]?.door?.type || "double";
    const order: Array<"double" | "single_left" | "single_right" | "open"> = [
      "double",
      "single_left",
      "single_right",
      "open",
    ];
    const next = order[(order.indexOf(cur as any) + 1) % order.length];
    setBayDoorType(bIdx, next);
  }, [setBayDoorType]);
  const handleToggleFacadeGrainContinuity = useCallback((enabled: boolean) => {
    latestRef.current.setFacadeGrainContinuity(enabled);
    latestRef.current.showToast(
      enabled ? "Cephe ahşap desen takibi açıldı." : "Cephe ahşap desen takibi kapatıldı."
    );
  }, []);

  const handleRunAutoFillersAndCrown = useCallback(() => {
    const res = latestRef.current.runAutoFillersAndCrown();
    latestRef.current.showToast(
      res.count > 0
        ? `${res.count} adet bitiş/taç parçası eklendi.`
        : "Mevcut yerleşim için ek bitiş parçası gerekmiyor."
    );
  }, []);

  const handleSaveModuleAsTemplate = useCallback((name: string) => {
    latestRef.current.saveActiveModuleAsCustomTemplate(
      name,
      latestRef.current.activeModule?.moduleFamilyId || "fam_wardrobe"
    );
    latestRef.current.showToast("Modül özel şablon olarak kütüphaneye kaydedildi.");
  }, []);

  const handleAddCustomMaterial = useCallback(
    (matInput: Parameters<typeof addCustomMaterialToProject>[0]) => {
      latestRef.current.addCustomMaterialToProject(matInput);
      latestRef.current.showToast(`"${matInput.name}" kartelaya eklendi.`);
    },
    []
  );

  const handleSetBayCustomWidth = useCallback(
    (bIdx: number, w: number | null) => latestRef.current.setBayCustomWidth(bIdx, w, true),
    []
  );
  const handleAddInternalDrawer = useCallback(
    (bIdx: number) => latestRef.current.addInternalDrawer(bIdx, 140),
    []
  );
  const handleAddSubDivider = useCallback(
    (bIdx: number) => latestRef.current.addSubDivider(bIdx),
    []
  );
  const handleApplyMaterialScope = useCallback(
    (scope: Parameters<typeof applyMaterialByTargetScope>[0], matId: string) =>
      latestRef.current.applyMaterialByTargetScope(scope, matId),
    []
  );
  const handleToggleModuleLed = useCallback(
    (
      enabled: boolean,
      opts?: Parameters<typeof latestRef.current.toggleModuleLedLighting>[1]
    ) => latestRef.current.toggleModuleLedLighting(enabled, opts),
    []
  );
  const handleRotateActiveModule90 = useCallback(
    () => latestRef.current.rotateActiveModule90(90),
    []
  );
  const handleOpenCustomHardwareModal = useCallback(() => setCustomHardwareOpen(true), []);

  const handleChangeDoorAngle = useCallback(
    (deg: number, animated = false) => latestRef.current.setDoorOpenAngleDeg(deg, animated),
    []
  );
  const handleToggleDockDimensions = useCallback(() => {
    setShowDimensions3D((v) => !v);
  }, []);

  const studioSafeInsets2DSplit = useMemo(
    () => ({ topPx: 112, bottomPx: 24, leftPx: 16, rightPx: isInspectorOpen ? 392 : 64 }),
    [isInspectorOpen]
  );
  const studioSafeInsets2DFull = useMemo(
    () => ({
      topPx: 112,
      bottomPx: 24,
      leftPx: leftDrawer ? 480 : 76,
      rightPx: isInspectorOpen ? 392 : 64,
    }),
    [leftDrawer, isInspectorOpen]
  );
  const studioSafeInsetsPlan = useMemo(
    () => ({
      topPx: 76,
      bottomPx: 24,
      leftPx: leftDrawer ? 480 : 76,
      rightPx: isInspectorOpen ? 392 : 64,
    }),
    [leftDrawer, isInspectorOpen]
  );

      const selectedPartQuickToolbar =
        workspaceMode === "3d" && !isShowroom && activeModule && selected3DContextLabel ? (
          <OnObjectQuickToolbar
            activeModule={activeModule}
            activeBayIndex={activeBayIndex}
            selectedPartKind={selected3DPartKind}
            selectedComponentId={selected3DCompId || selectedComponentId}
            selectedContextLabel={selected3DContextLabel}
            displayUnit={displayUnit}
            placementMode={isInspectorOpen ? "docked" : "stage"}
            leftSafePx={leftDrawer ? 424 : 76}
            hasGuidedStepStrip={experienceTier === "simple"}
            materials={allMaterials}
            isInspectorOpen={isInspectorOpen}
            onAddShelf={addShelf}
            onAddDrawerOrInternal={(bIdx) =>
              activeModule.bays.some((b) => b.door?.type === "sliding")
                ? handleAddInternalDrawer(bIdx)
                : addDrawer(bIdx)
            }
            onAddHangingRail={addHangingRail}
            onAddSubDivider={handleAddSubDivider}
            onCycleDoorType={handleCycleBayDoorType}
            onSetDoorProfile={(bIdx, profile, isGlass) =>
              setBayV4DoorConfig(bIdx, { crossSectionProfile: profile, isGlassFramed: isGlass })
            }
            onRemoveBayDoor={(bIdx) => {
              setBayDoorType(bIdx, "open");
              setSelected3DContextLabel(null);
            }}
            onQuickApplyDoorMaterial={(matId) => handleApplyMaterialScope("doors", matId)}
            onToggleShelfMount={(bIdx, shId) => {
              const sh = activeModule.bays[bIdx]?.shelves.find((s) => s.id === shId);
              if (!sh) return;
              const isFixedNow = sh.isAdjustable === false || Boolean(sh.isFixed);
              setShelfMountType(bIdx, shId, isFixedNow, sh.fixedConnectorType || "minifix_dowel");
            }}
            onSetShelfThickness={(bIdx, shId, thick) => setShelfThickness(bIdx, shId, thick)}
            onShiftShelfElevation={(bIdx, shId, deltaMm) => {
              const sh = activeModule.bays[bIdx]?.shelves.find((s) => s.id === shId);
              if (!sh) return;
              setShelfElevation(bIdx, shId, Math.max(32, sh.elevationY + deltaMm));
            }}
            onMoveSubDividerToInterval={(bIdx, subId, botY, height) =>
              setSubDividerPlacement(bIdx, subId, {
                elevationY: botY,
                height,
                targetMidY: Math.round(botY + height / 2),
              })
            }
            onCenterSubDividerX={(bIdx, subId, bayClearW) =>
              setSubDividerPlacement(bIdx, subId, {
                offsetX: Math.round((bayClearW - (activeModule.carcass.panelThickness || 18)) / 2),
              })
            }
            onShiftRailElevation={(bIdx, railId, deltaMm) => {
              const rl = activeModule.bays[bIdx]?.hangingRails.find((r) => r.id === railId);
              if (!rl) return;
              setHangingRailElevation(bIdx, railId, Math.max(160, rl.elevationY + deltaMm));
            }}
            onDeleteSelectedPart={() => {
              removeSelectedInteriorComponent();
              setSelected3DContextLabel(null);
            }}
            onOpenInspectorDetails={() => {
              setIsInspectorOpen(true);
              if (isCompactViewport) setLeftDrawer(null);
            }}
            onDismiss={() => setSelected3DContextLabel(null)}
          />
        ) : null;

  return (
    <main
      data-testid="v11-birim-studio-workspace"
      className="relative w-screen h-screen overflow-hidden bg-[#ECE8E0] text-[#141413] select-none"
    >
      {/* 1. ÜST MİMARİ BAŞLIK ÇUBUĞU */}
      <StudioHeaderBar
        projectTitle={project.title}
        workspaceMode={workspaceMode}
        onChangeWorkspaceMode={setWorkspaceMode}
        cadSubMode={cadSubMode}
        onChangeCadSubMode={setCadSubMode}
        split2DViewMode={split2DViewMode}
        onChangeSplit2DViewMode={setSplit2DViewMode}
        experienceTier={experienceTier}
        onChangeExperienceTier={setExperienceTier}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        totalPriceEur={pricing?.totalWithVatEur || 0}
        blockingIssueCount={blockingCount}
        engineeringFindings={allFindings}
        onApplyFindingFix={handleApplyFindingFix}
        onFocusFinding={handleFocusFinding}
        onOpenProjectModal={handleOpenProjectModal}
        onOpenWizardModal={handleOpenWizardModal}
        onOpenCommandSearch={handleOpenCommandSearch}
        onOpenQuoteModal={handleOpenQuoteModal}
        onOpenBomModal={handleOpenBomModal}
        onOpenAssemblyModal={handleOpenAssemblyModal}
        onOpenStudioRenderModal={handleOpenStudioRenderModal}
        onOpenArModal={handleOpenArModal}
        onOpenStoreErpModal={handleOpenStoreErpModal}
        onOpenStandardsModal={handleOpenStandardsModal}
        onOpenSaasModal={handleOpenSaasModal}
        onOpenMepModal={handleOpenMepModal}
        onOpenCutoutModal={handleOpenCutoutModal}
        onOpenSceneHubModal={handleOpenSceneHubCapsule}
        isReadOnlyCustomer={initialMode === "showroom"}
        displayUnit={displayUnit}
        onChangeDisplayUnit={setDisplayUnit}
        uiFontScale={uiFontScale}
        onChangeUiFontScale={setUiFontScale}
        activeInspectorTab={inspectorTab}
        onQuickNavigateStep={handleQuickNavigateStep}
      />

      {/* 2. ANA ÇALIŞMA SAHNESİ — WebGL kanvası sekme geçişlerinde ASLA sökülmez (paused={!show3DCanvas} ile 0ms anlık geçiş) */}
      <div ref={splitContainerRef} className="w-full h-full flex">
        <div
          style={
            workspaceMode === "2d" && cadSubMode === "split" && show3DCanvas
              ? { width: `${splitRatio3D}%` }
              : undefined
          }
          className={
            !show3DCanvas
              ? "hidden"
              : workspaceMode === "2d" && cadSubMode === "split"
              ? "h-full relative shrink-0 min-w-0"
              : "w-full h-full relative"
          }
        >
          <V3ThreeViewport
            paused={!show3DCanvas}
            theme="warm-light"
            showGrid={!isShowroom}
            showInCanvasHud={!isShowroom}
            minimalChrome={true}
            showDimensions={showDimensions3D}
            isRightInspectorOpen={!isShowroom && isInspectorOpen}
            stageSafeInsets={stageSafeInsets}
            onToggleDimensions={handleToggleDimensions3D}
            onRequest2DElevation={handleRequest2DElevation}
          />
        </div>

        {workspaceMode === "2d" && cadSubMode === "split" && show3DCanvas && (
          <div
            role="separator"
            aria-orientation="vertical"
            title="3B / 2B ekran genişliğini sürükleyerek ayarlayın (Çift tıkla: %50 / %50)"
            onDoubleClick={() => setSplitRatio3D(50)}
            onPointerDown={(e) => {
              e.preventDefault();
              const container = splitContainerRef.current;
              if (!container) return;
              document.body.style.userSelect = "none";
              document.body.style.cursor = "col-resize";
              const onMove = (ev: PointerEvent) => {
                const rect = container.getBoundingClientRect();
                if (rect.width <= 0) return;
                const pct = ((ev.clientX - rect.left) / rect.width) * 100;
                setSplitRatio3D(Math.max(22, Math.min(78, Math.round(pct * 10) / 10)));
              };
              const onUp = () => {
                document.body.style.userSelect = "";
                document.body.style.cursor = "";
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                window.removeEventListener("pointercancel", onUp);
              };
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
              window.addEventListener("pointercancel", onUp);
            }}
            className="w-3 sm:w-2 h-full shrink-0 cursor-col-resize touch-none relative z-30 flex items-center justify-center group bg-[#E6E0D3]/60 hover:bg-[#1C1917]/15 transition-colors select-none"
          >
            <span className="w-1 h-10 rounded-full bg-[#A8A29E] group-hover:bg-[#1C1917] transition-colors" />
          </div>
        )}

        {workspaceMode === "2d" && (() => {
          const effective2DMode =
            cadSubMode === "section"
              ? "section"
              : cadSubMode === "split"
              ? split2DViewMode
              : "elevation";
          return (
          <div
            style={
              cadSubMode === "split"
                ? { width: `calc(${100 - splitRatio3D}% - 8px)` }
                : undefined
            }
            className={
              cadSubMode === "split"
                ? "h-full relative flex-1 min-w-0"
                : "w-full h-full relative"
            }
          >
            <V3CadViewport2D
              mode={effective2DMode}
              interactivePlan={effective2DMode === "plan"}
              externalSectionDirection={cadExternalSectionDir}
              externalSectionRatio={sectionRatio2D}
              onExternalSectionChange={handleExternalSectionChange}
              hideLegacySectionBar={true}
              studioSafeInsets={
                cadSubMode === "split"
                  ? studioSafeInsets2DSplit
                  : studioSafeInsets2DFull
              }
            />

            {/* 2B KESİT MODUNDA DOĞRUDAN GÖRSEL ÜST PLAN KESİT SEÇİCİSİ */}
            {effective2DMode === "section" && activeModule && (
              <div
                style={
                  cadSubMode === "split"
                    ? undefined
                    : { left: leftDrawer ? "488px" : "80px" }
                }
                className={
                  cadSubMode === "split"
                    ? "absolute top-[156px] left-4 z-20 w-[290px]"
                    : "fixed top-[168px] z-20 w-[312px] transition-[left] duration-200"
                }
              >
                <SectionPlaneMiniMap
                  activeModule={activeModule}
                  axis={sectionAxis2D}
                  ratio={sectionRatio2D}
                  onChangeAxis={setSectionAxis2D}
                  onChangeRatio={setSectionRatio2D}
                />
              </div>
            )}
          </div>
          );
        })()}

        {workspaceMode === "plan" && (
          <div className="w-full h-full relative">
            <V3CadViewport2D
              mode="plan"
              interactivePlan={true}
              studioSafeInsets={studioSafeInsetsPlan}
            />
          </div>
        )}
      </div>

      {/* 3. SOL ÜRÜN, MODÜL, ADA, MASA VE 3B EŞYA BAŞLATICI */}
      {!isShowroom && (
        <LeftCatalogLauncher
          activeDrawer={leftDrawer}
          onChangeDrawer={handleChangeLeftDrawer}
          templates={combinedTemplates}
          modules={project.modules}
          sceneObjects={stableSceneObjects}
          activeModuleIndex={activeModuleIndex}
          wallWidthMm={wallWidthMm}
          ceilingHeightMm={ceilingHeightMm}
          obstacles={spaceObstacles}
          onApplyTemplateToActive={handleApplyTemplateToActive}
          onAppendTemplateAdjacent={handleAppendTemplateAdjacent}
          onAddCompositeAssembly={handleAddCompositeAssembly}
          onAddSceneObject={handleAddSceneObject}
          onRotateSceneObject={handleRotateSceneObject}
          onRemoveSceneObject={removeSceneObject}
          onSelectModuleIndex={setActiveModuleIndex}
          onDuplicateActiveModule={handleDuplicateActiveModule}
          onAddStackedTopModule={handleAddStackedTopModule}
          onFillRemainingWallGap={handleFillRemainingWallGap}
          onRemoveModuleAt={removeModuleAt}
          onSetRoomDimensions={setRoomDimensions}
          onAddSpaceObstacle={addSpaceObstacle}
          onRemoveSpaceObstacle={removeSpaceObstacle}
          onLoadKitchenPreset={handleLoadKitchenPreset}
          onOpenWizardModal={handleOpenWizardModal}
          onOpenKitchenIslandModal={handleOpenKitchenIslandModal}
          onOpenCapsuleAndGlbHub={setSceneHubTab}
        />
      )}

      {/* 4. SAĞ PARAMETRİK KONTROL PANELİ */}
      {!isShowroom && activeModule && (
        <RightParametricInspector
          selectedPartSlot={isInspectorOpen ? selectedPartQuickToolbar : null}
          isOpen={isInspectorOpen}
          onToggleOpen={handleToggleInspectorOpen}
          activeTab={inspectorTab}
          onChangeTab={setInspectorTab}
          experienceTier={experienceTier}
          onChangeExperienceTier={setExperienceTier}
          modules={project.modules}
          activeModule={activeModule}
          activeModuleIndex={activeModuleIndex}
          activeBayIndex={activeBayIndex}
          materials={allMaterials}
          handleProfiles={handleProfiles}
          engineeringFindings={allFindings}
          facadeGrainContinuity={
            Boolean(project.facadeGrainContinuity) ||
            activeModule.carcass.grainContinuityMode === "facade_continuous"
          }
          onToggleFacadeGrainContinuity={handleToggleFacadeGrainContinuity}
          onRunAutoFillersAndCrown={handleRunAutoFillersAndCrown}
          onOpenCutoutModal={handleOpenCutoutModal}
          onSaveModuleAsTemplate={handleSaveModuleAsTemplate}
          onAddCustomMaterial={handleAddCustomMaterial}
          onSelectModuleIndex={setActiveModuleIndex}
          onSelectBayIndex={setActiveBayIndex}
          onSetDimensions={setDimensions}
          onBeginSliderDrag={beginHistoryTransaction}
          onCommitSliderDrag={commitHistoryTransaction}
          onSetPlinthHeight={setPlinthHeight}
          onSplitBayIntoTwo={splitBayIntoTwo}
          onEqualizeBaysAndShelves={equalizeBaysAndShelves}
          onRemoveBayAt={removeBayAt}
          onSetBayCustomWidth={handleSetBayCustomWidth}
          onApplyBayPreset={applyBayInteriorPreset}
          onAddShelf={addShelf}
          onAddFixedShelf={addFixedShelf}
          onSetShelfMountType={setShelfMountType}
          onRemoveShelf={removeShelf}
          onSetShelfElevation={setShelfElevation}
          onSetShelfThickness={setShelfThickness}
          onAddDrawer={addDrawer}
          onAddInternalDrawer={handleAddInternalDrawer}
          onSetDrawerPlacement={setDrawerPlacement}
          onRemoveDrawer={removeDrawer}
          onAddHangingRail={addHangingRail}
          onRemoveHangingRail={removeHangingRail}
          onSetHangingRailProfile={setHangingRailProfile}
          onAddSpecialFitting={addSpecialFitting}
          onRemoveSpecialFitting={removeSpecialFitting}
          onAddSubDivider={handleAddSubDivider}
          onSetSubDividerPlacement={setSubDividerPlacement}
          onRemoveSubDivider={removeSubDivider}
          onSetBayDoorType={setBayDoorType}
          onSetSlidingMountingType={setModuleSlidingMountingType}
          onSetBayV4DoorConfig={setBayV4DoorConfig}
          onCopyDoorToAllBays={copyDoorConfigToAllBays}
          onCopyBayInteriorToAllBays={copyBayInteriorToAllBays}
          onMirrorModuleBays={mirrorModuleBaysLeftRight}
          onUpdateCarcassConfig={updateCarcassConfig}
          onApplyMaterialScope={handleApplyMaterialScope}
          onToggleModuleLed={handleToggleModuleLed}
          onApplyApprovedFix={handleApplyFindingFix}
          onDuplicateActiveModule={duplicateActiveModule}
          onAddStackedTopModule={addStackedTopModule}
          onRotateActiveModule90={handleRotateActiveModule90}
          onRemoveActiveModule={removeActiveModule}
          onOpenCustomHardwareModal={handleOpenCustomHardwareModal}
        />
      )}

      {/* 4B. Sağ Denetçi Kapalıyken Sahne Ortası Taşmayan Seçili Parça Kartı */}
      {!isInspectorOpen && selectedPartQuickToolbar}

      {/* 5. TEK BİRLEŞİK ALT SAHNE KAPSÜLÜ */}
      {(workspaceMode === "3d" || workspaceMode === "showroom") && (
        <BottomSceneDock
          activeModule={activeModule}
          doorOpenAngleDeg={doorOpenAngleDeg}
          onChangeDoorAngle={handleChangeDoorAngle}
          doorsHidden={doorsHidden3D}
          onToggleDoorsHidden={handleToggleDoorsHidden}
          showDimensions={showDimensions3D}
          onToggleDimensions={handleToggleDockDimensions}
          showInteriorProps={showInteriorProps3D}
          onToggleInteriorProps={handleToggleInteriorProps}
          renderStyle={viewportRenderStyle}
          onChangeRenderStyle={setViewportRenderStyle}
          cncXrayMode={cncXrayMode}
          onToggleCncXray={toggleCncXrayMode}
          explodedFactor={explodedFactor}
          onChangeExplodedFactor={setExplodedFactor}
          isSimpleTier={experienceTier === "simple"}
          projectId={project.id}
          isShowroom={isShowroom}
        />
      )}

      {isShowroom && (
        <ShowroomPresentationOverlay
          project={project}
          modules={project.modules}
          activeModuleIndex={activeModuleIndex}
          materials={allMaterials}
          totalPriceWithVatEur={pricing?.totalWithVatEur || 0}
          doorOpenAngleDeg={doorOpenAngleDeg}
          onSelectModuleIndex={setActiveModuleIndex}
          onChangeDoorAngle={handleChangeDoorAngle}
          onOpenQuoteModal={handleOpenQuoteModal}
          onOpenStudioRenderModal={handleOpenStudioRenderModal}
          onOpenArModal={handleOpenArModal}
          onApplyMaterialScope={handleApplyMaterialScope}
        />
      )}

      {toastText && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#141413] text-white text-xs font-medium shadow-lg pointer-events-none">
          {toastText}
        </div>
      )}

      {/* 6. YALNIZCA AÇILDIĞINDA YÜKLENEN MODALLAR */}
      {projectModalOpen && (
        <V3ProjectModal isOpen={projectModalOpen} onClose={() => setProjectModalOpen(false)} />
      )}

      {wizardModalOpen && (
        <GuidedSetupModal
          isOpen={wizardModalOpen}
          project={project}
          materials={allMaterials}
          onClose={() => setWizardModalOpen(false)}
          onApply={(wiz) => {
            applyGuidedWizardLayout(wiz);
            showToast("Endüstriyel standartlara uygun yerleşim oluşturuldu.");
          }}
        />
      )}

      {quoteModalOpen && (
        <QuoteSummaryModal
          isOpen={quoteModalOpen}
          project={project}
          materials={allMaterials}
          pricing={pricing}
          onClose={() => setQuoteModalOpen(false)}
          onOpenBomModal={(tab) => setBomModalTab(tab || "cutlist")}
          onOpenStoreErpModal={() => setStoreErpOpen(true)}
        />
      )}

      {bomModalTab !== null && (
        <BomModal
          isOpen={true}
          initialTab={bomModalTab}
          onClose={() => setBomModalTab(null)}
        />
      )}

      {storeErpOpen && (
        <StoreErpModal isOpen={storeErpOpen} onClose={() => setStoreErpOpen(false)} />
      )}

      {assemblyModalOpen && (
        <AssemblyDiagramModal
          isOpen={assemblyModalOpen}
          project={project}
          bom={bom}
          activeModuleIndex={activeModuleIndex}
          onClose={() => setAssemblyModalOpen(false)}
        />
      )}

      {studioRenderOpen && (
        <StudioRenderModal
          isOpen={studioRenderOpen}
          projectId={project.id}
          projectTitle={project.title}
          onClose={() => setStudioRenderOpen(false)}
        />
      )}

      {arModalOpen && (
        <ArRoomPreviewModal
          isOpen={arModalOpen}
          onClose={() => setArModalOpen(false)}
          project={project}
          materials={allMaterials}
          parts={arExportParts}
          clientTotalEur={pricing?.totalWithVatEur || 0}
        />
      )}

      {standardsModalOpen && (
        <RulesStandardsModal
          isOpen={standardsModalOpen}
          onClose={() => setStandardsModalOpen(false)}
          onOpenAdminModal={() => {
            setStandardsModalOpen(false);
            setSaasModalOpen(true);
          }}
          tenantId={activeTenantId}
          humanCompatStatusLabel={
            blockingCount === 0 ? "Üretime Hazır" : `${blockingCount} Kontrol Noktası`
          }
          rulesModalTab={rulesTab}
          setRulesModalTab={setRulesTab}
          findings={allFindings}
          ergonomicProfileId={ergonomicProfileId}
          setErgonomicProfileId={setErgonomicProfileId}
          regionalErgonomicProfiles={regionalErgonomicProfiles}
          applyApprovedEngineeringFix={applyApprovedEngineeringFix}
          onShowBanner={(b) => showToast(b.text)}
          customStdRules={customStdRules}
          setCustomStdRules={setCustomStdRules}
          kitchenRuleRegistry={KITCHEN_ENGINEERING_RULE_REGISTRY}
          newStdName={newStdName}
          setNewStdName={setNewStdName}
          newStdRef={newStdRef}
          setNewStdRef={setNewStdRef}
          newStdMetric={newStdMetric}
          setNewStdMetric={setNewStdMetric}
          newStdThreshold={newStdThreshold}
          setNewStdThreshold={setNewStdThreshold}
          newStdCategory={newStdCategory}
          setNewStdCategory={setNewStdCategory}
          newStdSeverity={newStdSeverity}
          setNewStdSeverity={setNewStdSeverity}
        />
      )}

      {saasModalOpen && (
        <SaasTenantStudioModal
          isOpen={saasModalOpen}
          onClose={() => setSaasModalOpen(false)}
        />
      )}

      {commandSearchOpen && (
        <CommandSearchModal
          isOpen={commandSearchOpen}
          actions={commandActions}
          onClose={() => setCommandSearchOpen(false)}
        />
      )}

      {kitchenIslandOpen && (
        <KitchenIslandTableModal
          isOpen={kitchenIslandOpen}
          project={project}
          materials={allMaterials}
          activeModuleIndex={activeModuleIndex}
          onAddIsland={(spec) => {
            addKitchenIslandUnit(spec);
            setKitchenIslandOpen(false);
            showToast("Şelale ada mutfak sahneye eklendi.");
          }}
          onAddOrUpdateAttachedTable={(spec) => {
            addOrUpdateAttachedTable(spec);
            setKitchenIslandOpen(false);
            showToast("Açılı masa bağlantısı eklendi.");
          }}
          onClose={() => setKitchenIslandOpen(false)}
        />
      )}

      {customHardwareOpen && (
        <CustomHardwareModal
          isOpen={customHardwareOpen}
          onClose={() => setCustomHardwareOpen(false)}
          onApplyHandleToActiveBay={(spec) => {
            setBayV4DoorConfig(activeBayIndex, {
              handleCategory: spec.handleCategory,
              handleProfileId: spec.handleProfileId,
              handleLengthMm: spec.handleLengthMm,
              handleMaterialId: spec.handleMaterialId,
            });
          }}
          onApplyHandleToAllBays={(spec) => {
            setBayV4DoorConfig(activeBayIndex, {
              handleCategory: spec.handleCategory,
              handleProfileId: spec.handleProfileId,
              handleLengthMm: spec.handleLengthMm,
              handleMaterialId: spec.handleMaterialId,
            });
            copyDoorConfigToAllBays(activeBayIndex);
          }}
          onCatalogChanged={() => setCatalogBump((n) => n + 1)}
        />
      )}

      {mepModalOpen && (
        <MepCoordinationModal
          isOpen={mepModalOpen}
          project={project}
          onClose={() => setMepModalOpen(false)}
        />
      )}

      {cutoutModalOpen && activeModule && (
        <PanelCutoutModal
          isOpen={cutoutModalOpen}
          activeModule={activeModule}
          allModules={project.modules}
          roomObstacles={spaceObstacles}
          bom={bom}
          canExportProduction={blockingCount === 0}
          onChangeCutouts={(nextCutouts) => {
            setModuleUtilityCutouts(nextCutouts);
            showToast("Panel kertme ayarları güncellendi.");
          }}
          onAutoResolveCornerCollisions={() => {
            autoResolveCornerCollisions();
            showToast("Köşe çakışmaları otomatik çözüldü.");
          }}
          onClose={() => setCutoutModalOpen(false)}
        />
      )}

      {sceneHubTab !== null && (
        <SceneObjectAndModuleHubModal
          isOpen={true}
          initialTab={sceneHubTab}
          project={project}
          totalWithVatEur={pricing?.totalWithVatEur || 0}
          selectedSceneObjectId={selectedSceneObjectId}
          onSelectSceneObject={setSelectedSceneObjectId}
          onAppendModule={(tplId, opts) => appendModuleWithMultiWallSnap(tplId, opts)}
          onFillWallGap={(gap, tplId) => fillWallGapWithParametricModule(gap, tplId)}
          onAddCompositeAssembly={addCompositeAssemblyPreset}
          onSaveActiveModuleAsTemplate={saveActiveModuleAsCustomTemplate}
          onDeleteCustomTemplate={deleteCustomModuleTemplate}
          onAddSceneObjectCatalog={(catId) =>
            addSceneObjectFromCatalog(catId, undefined)
          }
          onAddCustomSceneObject={addCustomSceneObject}
          onUpdateSceneObject={updateSceneObject}
          onDuplicateSceneObject={duplicateSceneObject}
          onRemoveSceneObject={removeSceneObject}
          onAutoFillersAndCrown={runAutoFillersAndCrown}
          onAutoNotchObstacles={runAutoNotchObstacles}
          onImportRoomPlanJson={importRoomPlanLiDARJson}
          onCreateCapsuleModule={(spec) => {
            addCustomCapsuleModule(spec);
            showToast("Özel kapsül ünite oluşturuldu.");
          }}
          onClose={() => setSceneHubTab(null)}
        />
      )}
    </main>
  );
};

export default BirimStudioWorkspace;
