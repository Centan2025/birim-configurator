"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  DEFAULT_MATERIALS,
  loadCustomStandardRules,
  type CustomStandardMetric,
  type CustomStandardRule,
} from "@birim/core";
import { V5_SPECIALIZED_MODULE_TEMPLATES } from "@birim/catalog";
import { convertSceneObjectsToExportBoxes, generateModuleGeometry } from "@birim/geometry";
import { useV3Adapter, KITCHEN_ENGINEERING_RULE_REGISTRY } from "../v3/adapter/useV3Adapter";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { V3ThreeViewport } from "../v3/components/V3ThreeViewport";
import { V3CadViewport2D } from "../v3/components/V3CadViewport2D";
import { V3ProjectModal } from "../v3/components/V3ProjectModal";
import BomModal from "../components/BomModal";
import StoreErpModal from "../components/StoreErpModal";
import { AssemblyDiagramModal } from "../v3/components/workspace/AssemblyDiagramModal";
import { StudioRenderModal } from "../v3/components/workspace/StudioRenderModal";
import { ArRoomPreviewModal } from "../v3/components/workspace/ArRoomPreviewModal";
import { RulesStandardsModal } from "../v3/components/workspace/RulesStandardsModal";
import { SaasTenantStudioModal } from "../v3/components/workspace/SaasTenantStudioModal";
import {
  CommandSearchModal,
  type CommandPaletteAction,
} from "../v3/components/workspace/CommandSearchModal";
import { KitchenIslandTableModal } from "../v3/components/workspace/KitchenIslandTableModal";
import { CustomHardwareModal } from "../v3/components/workspace/CustomHardwareModal";
import { MepCoordinationModal } from "../v3/components/workspace/MepCoordinationModal";
import { SceneObjectAndModuleHubModal } from "../v3/components/workspace/SceneObjectAndModuleHubModal";

import { StudioHeaderBar } from "./StudioHeaderBar";
import { LeftCatalogLauncher } from "./LeftCatalogLauncher";
import { RightParametricInspector } from "./RightParametricInspector";
import { BottomSceneDock } from "./BottomSceneDock";
import { GuidedSetupModal } from "./GuidedSetupModal";
import { QuoteSummaryModal } from "./QuoteSummaryModal";
import { SectionPlaneMiniMap } from "./SectionPlaneMiniMap";
import { PanelCutoutModal } from "./PanelCutoutModal";
import type {
  V11CadSubMode,
  V11InspectorTab,
  V11LeftDrawerTab,
  V11WorkspaceMode,
} from "./v11Constants";

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
    removeShelf,
    setShelfElevation,
    setShelfThickness,
    addDrawer,
    addInternalDrawer,
    removeDrawer,
    addHangingRail,
    removeHangingRail,
    addSpecialFitting,
    removeSpecialFitting,
    addSubDivider,
    removeSubDivider,
    setBayDoorType,
    setModuleSlidingMountingType,
    setBayV4DoorConfig,
    copyDoorConfigToAllBays,
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
  const setExperienceTier = useConfiguratorStore((s) => s.setUserExperienceTier);
  const viewportRenderStyle = useConfiguratorStore((s) => s.viewportRenderStyle);
  const setViewportRenderStyle = useConfiguratorStore((s) => s.setViewportRenderStyle);
  const activeTenantId = useConfiguratorStore((s) => s.activeTenantId);

  const [workspaceMode, setWorkspaceMode] = useState<V11WorkspaceMode>(() =>
    initialMode === "plan" ? "plan" : initialMode === "showroom" ? "showroom" : "3d"
  );
  const [cadSubMode, setCadSubMode] = useState<V11CadSubMode>("elevation");
  const [sectionAxis2D, setSectionAxis2D] = useState<"X" | "Z">("X");
  const [sectionRatio2D, setSectionRatio2D] = useState<number>(0.5);

  const [leftDrawer, setLeftDrawer] = useState<V11LeftDrawerTab>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [inspectorTab, setInspectorTab] = useState<V11InspectorTab>("interior");
  const [showDimensions3D, setShowDimensions3D] = useState<boolean>(true);
  const [doorsHidden3D, setDoorsHidden3D] = useState<boolean>(false);
  const [showInteriorProps3D, setShowInteriorProps3D] = useState<boolean>(true);
  const [toastText, setToastText] = useState<string | null>(null);

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
      const detail = (ev as CustomEvent<{ bayIndex?: number }>).detail;
      if (typeof detail?.bayIndex === "number") {
        setActiveBayIndex(detail.bayIndex);
      }
      setInspectorTab("interior");
      setIsInspectorOpen(true);
    };
    const onDoor3D = (ev: Event) => {
      const detail = (ev as CustomEvent<{ bayIndex?: number }>).detail;
      if (typeof detail?.bayIndex === "number") {
        setActiveBayIndex(detail.bayIndex);
      }
      setInspectorTab("doors");
      setIsInspectorOpen(true);
    };
    const onMat3D = () => {
      setInspectorTab("materials");
      setIsInspectorOpen(true);
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
    window.addEventListener("birim:open-studio-render-modal", onOpenStudioRender);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("birim:select-bay-3d", onBay3D);
      window.removeEventListener("birim:select-door-3d", onDoor3D);
      window.removeEventListener("birim:select-material-part-3d", onMat3D);
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

  const wallWidthMm = spaceWalls?.[0]?.length || project.room?.width || 3600;
  const ceilingHeightMm = spaceWalls?.[0]?.height || project.room?.height || 2600;

  const allFindings = useMemo(() => {
    if (!unifiedEngineeringReport) return [];
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
        width: c.dimensions.width,
        height: c.dimensions.height,
        depth: c.dimensions.depth,
        x: mod.position.x + c.position.x,
        y: mod.position.y + c.position.y,
        z: mod.position.z + c.position.z,
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
      rightPx: workspaceMode === "showroom" ? 24 : isInspectorOpen ? 392 : 64,
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
        experienceTier={experienceTier}
        onChangeExperienceTier={setExperienceTier}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        totalPriceEur={pricing?.totalWithVatEur || 0}
        blockingIssueCount={blockingCount}
        onOpenProjectModal={() => setProjectModalOpen(true)}
        onOpenWizardModal={() => setWizardModalOpen(true)}
        onOpenCommandSearch={() => setCommandSearchOpen(true)}
        onOpenQuoteModal={() => setQuoteModalOpen(true)}
        onOpenBomModal={(tab) => setBomModalTab(tab || "cutlist")}
        onOpenAssemblyModal={() => setAssemblyModalOpen(true)}
        onOpenStudioRenderModal={() => setStudioRenderOpen(true)}
        onOpenArModal={() => setArModalOpen(true)}
        onOpenStoreErpModal={() => setStoreErpOpen(true)}
        onOpenStandardsModal={() => setStandardsModalOpen(true)}
        onOpenSaasModal={() => setSaasModalOpen(true)}
        onOpenMepModal={() => setMepModalOpen(true)}
        onOpenCutoutModal={() => setCutoutModalOpen(true)}
        onOpenSceneHubModal={() => setSceneHubTab("capsule_curved")}
      />

      {/* 2. ANA ÇALIŞMA SAHNESİ */}
      <div className="w-full h-full flex">
        {show3DCanvas && (
          <div
            className={
              workspaceMode === "2d" && cadSubMode === "split"
                ? "w-1/2 h-full border-r border-[#D8D2C5] relative"
                : "w-full h-full relative"
            }
          >
            <V3ThreeViewport
              paused={false}
              theme="warm-light"
              showGrid={!isShowroom}
              showInCanvasHud={!isShowroom}
              minimalChrome={true}
              showDimensions={isShowroom ? false : showDimensions3D}
              isRightInspectorOpen={!isShowroom && isInspectorOpen}
              stageSafeInsets={stageSafeInsets}
              onToggleDimensions={() => setShowDimensions3D((v) => !v)}
              onRequest2DElevation={() => {
                setWorkspaceMode("2d");
                setCadSubMode("elevation");
              }}
            />
          </div>
        )}

        {workspaceMode === "2d" && (
          <div
            className={
              cadSubMode === "split" ? "w-1/2 h-full relative" : "w-full h-full relative"
            }
          >
            <V3CadViewport2D
              mode={cadSubMode === "section" ? "section" : "elevation"}
              externalSectionDirection={cadExternalSectionDir}
              externalSectionRatio={sectionRatio2D}
              onExternalSectionChange={(dir, r) => {
                setSectionAxis2D(dir === "Z" ? "X" : "Z");
                setSectionRatio2D(r);
              }}
              hideLegacySectionBar={true}
              studioSafeInsets={
                cadSubMode === "split"
                  ? { topPx: 112, bottomPx: 24, leftPx: 16, rightPx: isInspectorOpen ? 392 : 64 }
                  : {
                      topPx: 112,
                      bottomPx: 24,
                      leftPx: leftDrawer ? 480 : 76,
                      rightPx: isInspectorOpen ? 392 : 64,
                    }
              }
            />

            {/* 2B KESİT MODUNDA DOĞRUDAN GÖRSEL ÜST PLAN KESİT SEÇİCİSİ */}
            {cadSubMode === "section" && activeModule && (
              <div
                style={{ left: leftDrawer ? "488px" : "80px" }}
                className="fixed top-[168px] z-20 w-[312px] transition-[left] duration-200"
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
        )}

        {workspaceMode === "plan" && (
          <div className="w-full h-full relative">
            <V3CadViewport2D
              mode="plan"
              interactivePlan={true}
              studioSafeInsets={{
                topPx: 76,
                bottomPx: 24,
                leftPx: leftDrawer ? 480 : 76,
                rightPx: isInspectorOpen ? 392 : 64,
              }}
            />
          </div>
        )}
      </div>

      {/* 3. SOL ÜRÜN, MODÜL, ADA, MASA VE 3B EŞYA BAŞLATICI */}
      {!isShowroom && (
        <LeftCatalogLauncher
          activeDrawer={leftDrawer}
          onChangeDrawer={setLeftDrawer}
          templates={combinedTemplates}
          modules={project.modules}
          sceneObjects={project.sceneObjects || []}
          activeModuleIndex={activeModuleIndex}
          wallWidthMm={wallWidthMm}
          ceilingHeightMm={ceilingHeightMm}
          obstacles={spaceObstacles}
          onApplyTemplateToActive={(tplId) => {
            applyV4Template(tplId);
            showToast("Ürün şablonu uygulandı.");
          }}
          onAppendTemplateAdjacent={(tplId) => {
            dropV4TemplateWithSnap(tplId);
            showToast("Yeni ürün yanına eklendi.");
          }}
          onAddCompositeAssembly={(presetId) => {
            addCompositeAssemblyPreset(presetId);
            showToast("Hazır set sahneye eklendi.");
          }}
          onAddSceneObject={(catalogId) => {
            addSceneObjectFromCatalog(catalogId);
            showToast("3B eşya sahneye yerleştirildi.");
          }}
          onRotateSceneObject={(id) => {
            const cur = (project.sceneObjects || []).find((o) => o.id === id);
            if (cur) {
              updateSceneObject(id, {
                rotationYDeg: ((cur.rotationYDeg || 0) + 90) % 360,
              });
            }
          }}
          onRemoveSceneObject={removeSceneObject}
          onSelectModuleIndex={setActiveModuleIndex}
          onDuplicateActiveModule={() => {
            duplicateActiveModule();
            showToast("Modül yanına kopyalandı.");
          }}
          onAddStackedTopModule={() => {
            addStackedTopModule();
            showToast("Üst yüklük modülü eklendi.");
          }}
          onFillRemainingWallGap={handleFillRemainingWallGap}
          onRemoveModuleAt={removeModuleAt}
          onSetRoomDimensions={setRoomDimensions}
          onAddSpaceObstacle={addSpaceObstacle}
          onRemoveSpaceObstacle={removeSpaceObstacle}
          onLoadKitchenPreset={(kind) => {
            if (kind === "linear") loadLinearKitchen();
            else if (kind === "l") loadLKitchen();
            else loadUKitchen();
            showToast("Hazır mutfak yerleşimi yüklendi.");
          }}
          onOpenWizardModal={() => setWizardModalOpen(true)}
          onOpenKitchenIslandModal={() => setKitchenIslandOpen(true)}
          onOpenCapsuleAndGlbHub={(tab) => setSceneHubTab(tab)}
        />
      )}

      {/* 4. SAĞ PARAMETRİK KONTROL PANELİ */}
      {!isShowroom && activeModule && (
        <RightParametricInspector
          isOpen={isInspectorOpen}
          onToggleOpen={() => setIsInspectorOpen((v) => !v)}
          activeTab={inspectorTab}
          onChangeTab={setInspectorTab}
          experienceTier={experienceTier}
          modules={project.modules}
          activeModule={activeModule}
          activeModuleIndex={activeModuleIndex}
          activeBayIndex={activeBayIndex}
          materials={allMaterials}
          handleProfiles={handleProfiles}
          engineeringFindings={allFindings}
          facadeGrainContinuity={
            activeModule.carcass.grainContinuityMode === "continuous_facade"
          }
          onToggleFacadeGrainContinuity={(enabled) => {
            setFacadeGrainContinuity(enabled);
            showToast(
              enabled
                ? "Cephe ahşap desen takibi açıldı."
                : "Cephe ahşap desen takibi kapatıldı."
            );
          }}
          onRunAutoFillersAndCrown={() => {
            const res = runAutoFillersAndCrown();
            showToast(
              res.count > 0
                ? `${res.count} adet bitiş/taç parçası eklendi.`
                : "Mevcut yerleşim için ek bitiş parçası gerekmiyor."
            );
          }}
          onOpenCutoutModal={() => setCutoutModalOpen(true)}
          onSaveModuleAsTemplate={(name) => {
            saveActiveModuleAsCustomTemplate(
              name,
              activeModule.moduleFamilyId || "fam_wardrobe"
            );
            showToast("Modül özel şablon olarak kütüphaneye kaydedildi.");
          }}
          onAddCustomMaterial={(matInput) => {
            addCustomMaterialToProject(matInput);
            showToast(`"${matInput.name}" kartelaya eklendi.`);
          }}
          onSelectModuleIndex={setActiveModuleIndex}
          onSelectBayIndex={setActiveBayIndex}
          onSetDimensions={setDimensions}
          onSetPlinthHeight={setPlinthHeight}
          onSplitBayIntoTwo={splitBayIntoTwo}
          onEqualizeBaysAndShelves={equalizeBaysAndShelves}
          onRemoveBayAt={removeBayAt}
          onSetBayCustomWidth={(bIdx, w) => setBayCustomWidth(bIdx, w, true)}
          onApplyBayPreset={applyBayInteriorPreset}
          onAddShelf={addShelf}
          onRemoveShelf={removeShelf}
          onSetShelfElevation={setShelfElevation}
          onSetShelfThickness={setShelfThickness}
          onAddDrawer={addDrawer}
          onAddInternalDrawer={(bIdx) => addInternalDrawer(bIdx, 140)}
          onRemoveDrawer={removeDrawer}
          onAddHangingRail={addHangingRail}
          onRemoveHangingRail={removeHangingRail}
          onAddSpecialFitting={addSpecialFitting}
          onRemoveSpecialFitting={removeSpecialFitting}
          onAddSubDivider={(bIdx) => addSubDivider(bIdx)}
          onRemoveSubDivider={removeSubDivider}
          onSetBayDoorType={setBayDoorType}
          onSetSlidingMountingType={setModuleSlidingMountingType}
          onSetBayV4DoorConfig={setBayV4DoorConfig}
          onCopyDoorToAllBays={copyDoorConfigToAllBays}
          onUpdateCarcassConfig={updateCarcassConfig}
          onApplyMaterialScope={(scope, matId) => {
            applyMaterialByTargetScope(scope, matId);
          }}
          onToggleModuleLed={(enabled, opts) =>
            toggleModuleLedLighting(enabled, { colorTempK: opts?.colorTempK })
          }
          onApplyApprovedFix={(prop) => {
            applyApprovedEngineeringFix(prop);
            showToast("Önerilen iyileştirme uygulandı.");
          }}
          onDuplicateActiveModule={duplicateActiveModule}
          onAddStackedTopModule={addStackedTopModule}
          onRotateActiveModule90={() => rotateActiveModule90(90)}
          onRemoveActiveModule={removeActiveModule}
          onOpenCustomHardwareModal={() => setCustomHardwareOpen(true)}
        />
      )}

      {/* 5. TEK BİRLEŞİK ALT SAHNE KAPSÜLÜ */}
      {(workspaceMode === "3d" || workspaceMode === "showroom") && (
        <BottomSceneDock
          activeModule={activeModule}
          doorOpenAngleDeg={doorOpenAngleDeg}
          onChangeDoorAngle={(deg) => setDoorOpenAngleDeg(deg, true)}
          doorsHidden={doorsHidden3D}
          onToggleDoorsHidden={handleToggleDoorsHidden}
          showDimensions={isShowroom ? false : showDimensions3D}
          onToggleDimensions={() => {
            if (isShowroom) setWorkspaceMode("3d");
            setShowDimensions3D((v) => !v);
          }}
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
          onAddSceneObjectCatalog={(catId, role) =>
            addSceneObjectFromCatalog(catId, undefined, role)
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
