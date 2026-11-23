"use client";

import React, { useState, useMemo } from "react";
import {
  DesignProject,
  evaluateKitchenWorkTriangleAndErgonomics,
  findWallFreeGaps,
  ModuleFamilyId,
  SceneObjectAnchorMode,
  SceneObjectCategory,
  SceneObjectInstance,
  WallFreeGapSlot,
} from "@birim/core";
import {
  DEFAULT_MATERIALS,
} from "@birim/core";
import { computeCurvedKerfBendingSpec } from "@birim/manufacturing";
import {
  V4_MODULE_TEMPLATES,
  V5_COMPOSITE_ASSEMBLIES,
  V5_SCENE_OBJECT_CATALOG,
  registerDiscoveredSceneObjectCatalogItems,
  V5_SPECIALIZED_MODULE_TEMPLATES,
  type SceneObjectCatalogItem,
} from "@birim/catalog";
import {
  getBirimV5SupabaseMigrationSql,
  saveGlbAssetPersistent,
  SupabaseCloudPersistenceAdapter,
} from "@birim/integrations";
import { BirimLogo } from "../../design-system";
import { startZeroLagModalDrag } from "../../design-system/zeroLagDrag";
import { startSceneObjectSilhouetteDrag } from "../../engine/multiWallSnapAndBvhEngine";
import { startModuleSilhouetteDrag } from "../../adapter/useV3Adapter";
import { V3StudioModuleThumbnail } from "../V3StudioModuleThumbnail";
import SceneObjectThumbnail from "../SceneObjectThumbnail";
import {
  Box,
  Check,
  Cloud,
  Compass,
  Copy,
  Download,
  Layers,
  Plus,
  RotateCw,
  ScanLine,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";

interface SceneObjectAndModuleHubModalProps {
  isOpen: boolean;
  initialTab?: "modules" | "capsule_curved" | "appliances" | "furniture" | "custom_glb" | "automation";
  project: DesignProject;
  totalWithVatEur: number;
  selectedSceneObjectId: string | null;
  onSelectSceneObject: (id: string | null) => void;
  onAppendModule: (
    templateId: string,
    opts?: { wallId?: string; insertBetween?: boolean }
  ) => void;
  onFillWallGap: (gap: WallFreeGapSlot, templateId?: string) => void;
  onAddCompositeAssembly: (presetId: string) => void;
  onSaveActiveModuleAsTemplate: (name: string, familyId: ModuleFamilyId) => void;
  onDeleteCustomTemplate: (templateId: string) => void;
  onAddSceneObjectCatalog: (catalogId: string, commercialRole?: SceneObjectInstance["commercialRole"]) => void;
  onAddCustomSceneObject: (obj: SceneObjectInstance) => void;
  onUpdateSceneObject: (id: string, patch: Partial<SceneObjectInstance>) => void;
  onDuplicateSceneObject: (id: string) => void;
  onRemoveSceneObject: (id: string) => void;
  onAutoFillersAndCrown: () => { count: number; notes: string[] };
  onAutoNotchObstacles: () => { count: number; notes: string[] };
  onImportRoomPlanJson: (jsonText: string) => { ok: boolean; summary: string };
  onCreateCapsuleModule?: (spec: {
    kind: "capsule_bar" | "capsule_table";
    name?: string;
    widthMm: number;
    heightMm: number;
    depthMm: number;
    cornerRadiusMm?: number;
    tambourSlatPitchMm?: number;
    bodyMaterialId?: string;
    topMaterialId?: string;
  }) => void;
  onClose: () => void;
}

export const SceneObjectAndModuleHubModal: React.FC<SceneObjectAndModuleHubModalProps> = ({
  isOpen,
  initialTab = "modules",
  project,
  totalWithVatEur,
  selectedSceneObjectId,
  onSelectSceneObject,
  onAppendModule,
  onFillWallGap,
  onAddCompositeAssembly,
  onSaveActiveModuleAsTemplate,
  onDeleteCustomTemplate,
  onAddSceneObjectCatalog,
  onAddCustomSceneObject,
  onUpdateSceneObject,
  onDuplicateSceneObject,
  onRemoveSceneObject,
  onAutoFillersAndCrown,
  onAutoNotchObstacles,
  onImportRoomPlanJson,
  onCreateCapsuleModule,
  onClose,
}) => {
  const normalizeHubTab = (
    t: "modules" | "capsule_curved" | "appliances" | "furniture" | "custom_glb" | "automation"
  ): "modules" | "capsule_curved" | "custom_glb" | "automation" =>
    t === "appliances" || t === "furniture" ? "custom_glb" : t;
  const [tab, setTab] = useState<"modules" | "capsule_curved" | "custom_glb" | "automation">(
    () => normalizeHubTab(initialTab)
  );
  React.useEffect(() => {
    if (isOpen) setTab(normalizeHubTab(initialTab));
  }, [isOpen, initialTab]);
  const [capKind, setCapKind] = useState<"capsule_bar" | "capsule_table">("capsule_bar");
  const [capName, setCapName] = useState<string>("Birim Kapsül Tamburlu Bar Dolabı");
  const [capW, setCapW] = useState<number>(1200);
  const [capH, setCapH] = useState<number>(1150);
  const [capD, setCapD] = useState<number>(480);
  const [capR, setCapR] = useState<number>(240);
  const [capSlatPitch, setCapSlatPitch] = useState<number>(24);
  const [capBodyMat, setCapBodyMat] = useState<string>("mat_veneer_walnut");
  const [capTopMat, setCapTopMat] = useState<string>("mat_quartz_calacatta");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [, setLocalGlbScanTick] = useState(0);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch("/api/scene-objects/local-glbs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.items)) {
          const added = registerDiscoveredSceneObjectCatalogItems(data.items);
          if (added > 0) setLocalGlbScanTick((t) => t + 1);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);
  const [targetWallId, setTargetWallId] = useState<string>(
    project.space.walls?.[0]?.id || "wall_main"
  );
  const [insertBetweenMode, setInsertBetweenMode] = useState<boolean>(false);
  const [customTplName, setCustomTplName] = useState<string>("Birim Özel Modülüm");
  const [customTplFamily, setCustomTplFamily] = useState<ModuleFamilyId>("fam_wardrobe");
  const [modSearch, setModSearch] = useState<string>("");
  const [showStandardV4Modules, setShowStandardV4Modules] = useState<boolean>(false);

  // Custom GLB upload form state
  const [glbName, setGlbName] = useState<string>("Özel Tasarım 3D Obje (.GLB)");
  const [glbSku, setGlbSku] = useState<string>("BRM-3D-CUSTOM");
  const [glbW, setGlbW] = useState<number>(650);
  const [glbH, setGlbH] = useState<number>(820);
  const [glbD, setGlbD] = useState<number>(600);
  const [glbPriceEur, setGlbPriceEur] = useState<number>(0);
  const [glbAnchor, setGlbAnchor] = useState<SceneObjectAnchorMode>("free_floor");
  const [glbUrlDraft, setGlbUrlDraft] = useState<string>("");
  const [glbCommercialRole, setGlbCommercialRole] =
    useState<SceneObjectInstance["commercialRole"]>("quoted_product");

  const baseGaps = useMemo(() => (isOpen ? findWallFreeGaps(project, "base") : []), [isOpen, project]);
  const ergCheck = useMemo(
    () => (isOpen ? evaluateKitchenWorkTriangleAndErgonomics(project) : null),
    [isOpen, project]
  );

  const compositePreviews = useMemo(() => {
    const map = new Map<
      string,
      {
        modulesCount: number;
        objectsCount: number;
        previewItems: SceneObjectCatalogItem[];
      }
    >();
    for (const comp of V5_COMPOSITE_ASSEMBLIES) {
      try {
        const built = comp.buildItems(0);
        const seen = new Set<string>();
        const previewItems: SceneObjectCatalogItem[] = [];
        for (const so of built.sceneObjects) {
          if (seen.has(so.catalogId)) continue;
          const found = V5_SCENE_OBJECT_CATALOG.find((c) => c.catalogId === so.catalogId);
          if (found) {
            seen.add(so.catalogId);
            previewItems.push(found);
          }
          if (previewItems.length >= 3) break;
        }
        map.set(comp.presetId, {
          modulesCount: built.modules.length,
          objectsCount: built.sceneObjects.length,
          previewItems,
        });
      } catch {
        map.set(comp.presetId, { modulesCount: 0, objectsCount: 0, previewItems: [] });
      }
    }
    return map;
  }, []);

  if (!isOpen) return null;

  const sceneObjects = project.sceneObjects || [];
  const savedCustomTemplates = project.customModuleTemplates || [];

  const standardOnlyV4Modules = V4_MODULE_TEMPLATES.filter(
    (m) => !V5_SPECIALIZED_MODULE_TEMPLATES.some((s) => s.templateId === m.templateId)
  );
  const modulePool =
    showStandardV4Modules || modSearch.trim().length > 0
      ? [...V5_SPECIALIZED_MODULE_TEMPLATES, ...standardOnlyV4Modules]
      : V5_SPECIALIZED_MODULE_TEMPLATES;
  const filteredModules = modulePool
    .filter((t) => {
      if (!modSearch.trim()) return true;
      const q = modSearch.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    })
    .slice(0, 28);

  const applianceItems = V5_SCENE_OBJECT_CATALOG.filter(
    (i) => i.category === "appliance" || i.category === "plumbing_fixture"
  );
  const furnitureAndArchItems = V5_SCENE_OBJECT_CATALOG.filter(
    (i) =>
      i.category === "freestanding_furniture" ||
      i.category === "lighting_electronics" ||
      i.category === "architectural_prop" ||
      i.category === "custom_glb"
  );

  const handleUploadGlbFile = async (file: File) => {
    const assetKey = `glb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const syncRes = await saveGlbAssetPersistent(assetKey, file, file.name);
    const cleanName = glbName.trim() || file.name.replace(/\.(glb|gltf)$/i, "");
    const newObj: SceneObjectInstance = {
      id: `sobj_${Date.now()}`,
      catalogId: "custom_uploaded_glb",
      sku: glbSku.trim() || "CUSTOM-GLB",
      name: cleanName,
      brand: "Özel 3D Model",
      category: "custom_glb",
      anchorMode: glbAnchor,
      visualKind: "custom_glb_mesh",
      position: { x: 650, y: glbAnchor === "ceiling" ? 1850 : 0, z: glbAnchor === "free_floor" ? 1300 : 0 },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { width: glbW, height: glbH, depth: glbD },
      scaleFactor: 1,
      glbUrl: syncRes.publicUrl,
      localAssetKey: assetKey,
      commercialRole: glbPriceEur > 0 ? glbCommercialRole : "decor_only",
      unitPriceEur: Math.max(0, Number(glbPriceEur) || 0),
      quantity: 1,
    };
    onAddCustomSceneObject(newObj);
    setStatusMsg(
      `"${cleanName}" (${glbW}×${glbH}×${glbD}mm) sahneye eklendi ve ${
        syncRes.mode === "supabase_cloud" ? "Cloudflare R2 buluta" : "kalıcı IndexedDB depoya"
      } kaydedildi.`
    );
  };

  const handleAddUrlGlb = () => {
    if (!glbUrlDraft.trim()) return;
    const newObj: SceneObjectInstance = {
      id: `sobj_url_${Date.now()}`,
      catalogId: "custom_url_glb",
      sku: glbSku.trim() || "URL-GLB",
      name: glbName.trim() || "Uzak .GLB Modeli",
      brand: "Harici 3D URL",
      category: "custom_glb",
      anchorMode: glbAnchor,
      visualKind: "custom_glb_mesh",
      position: { x: 700, y: 0, z: glbAnchor === "free_floor" ? 1350 : 0 },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { width: glbW, height: glbH, depth: glbD },
      scaleFactor: 1,
      glbUrl: glbUrlDraft.trim(),
      commercialRole: glbPriceEur > 0 ? glbCommercialRole : "decor_only",
      unitPriceEur: Math.max(0, Number(glbPriceEur) || 0),
      quantity: 1,
    };
    onAddCustomSceneObject(newObj);
    setGlbUrlDraft("");
    setStatusMsg(`Harici .GLB modeli (${newObj.name}) sahneye yerleştirildi.`);
  };

  const renderCatalogCard = (item: SceneObjectCatalogItem) => (
    <div
      key={item.catalogId}
      draggable={true}
      onDragStart={(e) => startSceneObjectSilhouetteDrag(e, item.catalogId)}
      className="group p-3 rounded-2xl bg-white/85 hover:bg-white border border-slate-200/90 flex flex-col justify-between gap-2 shadow-2xs transition"
    >
      <div className="space-y-1.5">
        <div
          style={{
            background: "linear-gradient(180deg, #888d96 0%, #7c818a 68%, #676c75 100%)",
          }}
          className="relative w-full h-[144px] rounded-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-14px_24px_rgba(0,0,0,0.42)] flex items-center justify-center overflow-hidden pointer-events-none"
        >
          <SceneObjectThumbnail
            item={item}
            className="w-full h-full object-contain p-1.5 transition-transform duration-300 ease-out group-hover:scale-[1.06] drop-shadow-[0_10px_14px_rgba(0,0,0,0.38)]"
          />
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/55 text-[9.5px] font-mono font-bold text-white/95 backdrop-blur-xs">
            {item.sku}
          </span>
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-emerald-950/75 text-[10px] font-bold text-emerald-300 backdrop-blur-xs">
            {item.unitPriceEur > 0 ? `€${item.unitPriceEur}` : "Rölöve / Dekor"}
          </span>
        </div>
        <div className="font-bold text-xs text-[#141413] leading-snug">{item.name}</div>
        <div className="text-[10.5px] text-slate-500 line-clamp-2">{item.description}</div>
        <div className="text-[10px] font-mono text-slate-600">
          {item.defaultDimensions.width} × {item.defaultDimensions.height} ×{" "}
          {item.defaultDimensions.depth} mm • {item.brand}
        </div>
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          data-testid={`v5-add-scene-obj-${item.catalogId}`}
          onClick={() => {
            onAddSceneObjectCatalog(item.catalogId);
            setStatusMsg(`"${item.name}" akıllı yüzey mıknatıslanmasıyla sahneye eklendi.`);
          }}
          className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#141413] hover:bg-slate-800 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Sahneye Ekle</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      data-testid="v5-scene-object-module-hub-modal"
      onClick={onClose}
      className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-0 md:p-5"
    >
      <div
        data-draggable-shell="v5-hub-modal"
        onClick={(e) => e.stopPropagation()}
        className="birim-ice-modal rounded-[28px] max-md:rounded-none max-md:h-[100dvh] max-md:max-h-[100dvh] max-w-5xl w-full max-h-[92dvh] flex flex-col overflow-hidden text-[#141413]"
      >
        {/* Header */}
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          className="px-3.5 sm:px-5 py-3 birim-ice-shell-header flex flex-nowrap items-center justify-between gap-2 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <BirimLogo className="h-4 sm:h-5 w-auto text-[#141413] shrink-0" />
            <div className="h-4 w-px bg-slate-900/15 shrink-0 hidden sm:block" />
            <div className="min-w-0 flex-1 overflow-hidden pr-2">
              <h2 className="text-xs sm:text-sm font-extrabold text-[#141413] truncate">
                {tab === "capsule_curved"
                  ? "Kapsül Bar & Masa Stüdyosu"
                  : tab === "custom_glb"
                  ? "Özel .GLB Model Yükle"
                  : tab === "automation"
                  ? "Otomasyon, Kertme & LiDAR"
                  : "Boşluk Doldur & Özel Modüller"}
              </h2>
              <p className="text-[10.5px] sm:text-[11px] text-slate-600 truncate">
                {tab === "capsule_curved"
                  ? "Parametrik kavisli tambur kapak, stadyum masa ve canlı CNC Kerf hesabı"
                  : tab === "custom_glb"
                  ? `Kendi 3B .GLB modellerinizi sahneye ekleyin • Sahne Objesi: ${sceneObjects.length}`
                  : tab === "automation"
                  ? "Otomatik kör/taç, engel kertme ve RoomPlan LiDAR içe aktarma"
                  : `Duvar boşluğu doldurma ve özel üniteler • Modül: ${project.modules.length}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="w-8 h-8 rounded-xl birim-ice-btn flex items-center justify-center text-slate-700 hover:text-slate-950 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>


        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F8F7F4] text-xs">
          {statusMsg && (
            <div className="px-3.5 py-2.5 rounded-2xl bg-emerald-950 text-emerald-100 font-semibold flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{statusMsg}</span>
              </span>
              <button
                type="button"
                onClick={() => setStatusMsg(null)}
                className="text-emerald-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB: PARAMETRIC CAPSULE BAR CABINET & STADIUM TABLE BUILDER */}
          {tab === "capsule_curved" && (() => {
            const effR = Math.max(40, Math.min(Math.floor(capD / 2), capR));
            const kerfPreview = computeCurvedKerfBendingSpec(effR, 180, 18, 3.2, 2.5);
            const bodyHex = DEFAULT_MATERIALS.find((m) => m.id === capBodyMat)?.colorHex || "#5c4033";
            const topHex = DEFAULT_MATERIALS.find((m) => m.id === capTopMat)?.colorHex || "#f3f4f6";
            const elevMaxW = 210;
            const elevMaxH = 112;
            const elevScale = Math.min(elevMaxW / Math.max(capW, 600), elevMaxH / Math.max(capH, 450));
            const drawW = Math.max(90, Math.round(capW * elevScale));
            const drawH = Math.max(42, Math.round(capH * elevScale));
            const drawX = Math.round((280 - drawW) / 2);
            const drawY = Math.round(132 - drawH);
            const planMaxW = 210;
            const planMaxD = 92;
            const planScale = Math.min(planMaxW / Math.max(capW, 600), planMaxD / Math.max(capD, 360));
            const planW = Math.max(96, Math.round(capW * planScale));
            const planD = Math.max(36, Math.round(capD * planScale));
            const planR = Math.min(planD / 2, Math.max(6, Math.round(effR * planScale)));
            const planX = Math.round((280 - planW) / 2);
            const planY = Math.round((148 - planD) / 2);
            const slatCount = Math.max(8, Math.min(34, Math.round(drawW / Math.max(4.5, (capSlatPitch || 24) * elevScale * 1.4))));
            return (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#141413]">
                        Parametrik Kapsül (Stadyum Form) Bar Dolabı &amp; Masa Üreticisi
                      </h3>
                      <p className="text-[11px] text-slate-600">
                        Gerçek 3D kapsül ekstrüzyon, açılır/kapanır kavisli çıtalı tambur kapak ve otomatik CNC Kerf-Bending açınım &amp; BOM hesabı
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCapKind("capsule_bar");
                          setCapName("Birim Kapsül Tamburlu Bar Dolabı");
                          setCapW(1200);
                          setCapH(1150);
                          setCapD(480);
                          setCapR(240);
                          setCapTopMat("mat_quartz_calacatta");
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${
                          capKind === "capsule_bar"
                            ? "bg-[#141413] text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        🍸 Kapsül Tamburlu Bar Dolabı
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCapKind("capsule_table");
                          setCapName("Birim Kapsül Tasarım Masa");
                          setCapW(2200);
                          setCapH(750);
                          setCapD(1000);
                          setCapR(500);
                          setCapTopMat("mat_veneer_walnut");
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${
                          capKind === "capsule_table"
                            ? "bg-[#141413] text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        🍽️ Kapsül (Stadyum) Masa
                      </button>
                    </div>
                  </div>

                  {/* Live 2-View Parametric Capsule Elevation & Stadium Plan Drawing */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div
                      style={{
                        background: "linear-gradient(180deg, #888d96 0%, #7c818a 68%, #676c75 100%)",
                      }}
                      className="rounded-xl border border-white/15 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-14px_24px_rgba(0,0,0,0.42)]"
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-white/90 mb-1">
                        <span>Ön Görünüş (Gerçek Oran)</span>
                        <span className="font-mono text-amber-200">{capW} × {capH} mm</span>
                      </div>
                      <svg viewBox="0 0 280 152" className="w-full h-[142px]" aria-label="Kapsül ön görünüş çizimi">
                        <defs>
                          <linearGradient id="capCylShade" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#000" stopOpacity="0.34" />
                            <stop offset="16%" stopColor="#fff" stopOpacity="0.14" />
                            <stop offset="50%" stopColor="#fff" stopOpacity="0.02" />
                            <stop offset="84%" stopColor="#000" stopOpacity="0.12" />
                            <stop offset="100%" stopColor="#000" stopOpacity="0.38" />
                          </linearGradient>
                        </defs>
                        {/* Floor baseline */}
                        <line x1="18" y1="133" x2="262" y2="133" stroke="#e2e8f0" strokeOpacity="0.45" strokeWidth="1" />
                        {capKind === "capsule_bar" ? (
                          <g>
                            {/* Plinth / Recessed base */}
                            <rect x={drawX + 10} y={132 - 8} width={Math.max(20, drawW - 20)} height="8" rx="2" fill="#1e293b" />
                            {/* Main curved capsule carcass */}
                            <rect x={drawX} y={drawY + 7} width={drawW} height={Math.max(18, drawH - 15)} rx="6" fill={bodyHex} stroke="#0f172a" strokeOpacity="0.45" strokeWidth="1" />
                            {/* Tambour vertical slats */}
                            {Array.from({ length: slatCount }).map((_, idx) => {
                              const sx = drawX + ((idx + 1) / (slatCount + 1)) * drawW;
                              return (
                                <line
                                  key={idx}
                                  x1={sx}
                                  y1={drawY + 8}
                                  x2={sx}
                                  y2={132 - 9}
                                  stroke="#0f172a"
                                  strokeOpacity="0.28"
                                  strokeWidth="1"
                                />
                              );
                            })}
                            {/* Cylindrical shading overlay */}
                            <rect x={drawX} y={drawY + 7} width={drawW} height={Math.max(18, drawH - 15)} rx="6" fill="url(#capCylShade)" />
                            {/* Top stone/countertop slab */}
                            <rect x={drawX - 2} y={drawY} width={drawW + 4} height="8" rx="3" fill={topHex} stroke="#0f172a" strokeOpacity="0.45" strokeWidth="1" />
                            {/* Warm LED under-lip accent */}
                            <line x1={drawX + 8} y1={drawY + 9} x2={drawX + drawW - 8} y2={drawY + 9} stroke="#fde68a" strokeOpacity="0.75" strokeWidth="1.5" />
                          </g>
                        ) : (
                          <g>
                            {/* Twin fluted cylindrical legs */}
                            {[drawX + drawW * 0.24, drawX + drawW * 0.76].map((cx, i) => {
                              const legW = Math.max(18, Math.min(34, drawW * 0.16));
                              const lx = cx - legW / 2;
                              return (
                                <g key={i}>
                                  <rect x={lx} y={drawY + 9} width={legW} height={Math.max(20, drawH - 9)} rx="3" fill={bodyHex} stroke="#0f172a" strokeOpacity="0.45" strokeWidth="1" />
                                  {[0.25, 0.5, 0.75].map((f, j) => (
                                    <line key={j} x1={lx + legW * f} y1={drawY + 10} x2={lx + legW * f} y2={132} stroke="#0f172a" strokeOpacity="0.32" strokeWidth="1" />
                                  ))}
                                  <rect x={lx} y={drawY + 9} width={legW} height={Math.max(20, drawH - 9)} rx="3" fill="url(#capCylShade)" />
                                </g>
                              );
                            })}
                            {/* Swiss-Edge chamfered stadium tabletop */}
                            <polygon
                              points={`${drawX},${drawY} ${drawX + drawW},${drawY} ${drawX + drawW - 5},${drawY + 9} ${drawX + 5},${drawY + 9}`}
                              fill={topHex}
                              stroke="#0f172a"
                              strokeOpacity="0.5"
                              strokeWidth="1"
                            />
                          </g>
                        )}
                        {/* Dimension lines */}
                        <line x1={drawX} y1="144" x2={drawX + drawW} y2="144" stroke="#f8fafc" strokeWidth="1" strokeDasharray="2 2" />
                        <text x="140" y="142" textAnchor="middle" fill="#f8fafc" fontSize="9" fontFamily="monospace" fontWeight="700">
                          W = {capW} mm
                        </text>
                        <text x={Math.max(16, drawX - 6)} y={drawY + drawH / 2} textAnchor="end" fill="#fde68a" fontSize="8.5" fontFamily="monospace" fontWeight="700">
                          H:{capH}
                        </text>
                      </svg>
                    </div>

                    <div
                      style={{
                        background: "linear-gradient(180deg, #888d96 0%, #7c818a 68%, #676c75 100%)",
                      }}
                      className="rounded-xl border border-white/15 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-14px_24px_rgba(0,0,0,0.42)]"
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-white/90 mb-1">
                        <span>Üst Plan (Stadyum / Kerf Kavis)</span>
                        <span className="font-mono text-sky-200">D={capD}mm • R={effR}mm</span>
                      </div>
                      <svg viewBox="0 0 280 152" className="w-full h-[142px]" aria-label="Kapsül üst plan çizimi">
                        {/* Subtle CAD grid */}
                        <line x1="140" y1="10" x2="140" y2="142" stroke="#ffffff" strokeOpacity="0.16" strokeDasharray="3 3" />
                        <line x1="18" y1="74" x2="262" y2="74" stroke="#ffffff" strokeOpacity="0.16" strokeDasharray="3 3" />
                        {/* Outer stadium contour */}
                        <rect
                          x={planX}
                          y={planY}
                          width={planW}
                          height={planD}
                          rx={planR}
                          ry={planR}
                          fill={topHex}
                          fillOpacity="0.92"
                          stroke="#0f172a"
                          strokeWidth="1.5"
                        />
                        {/* Inner 18mm kerf-bent shell contour */}
                        <rect
                          x={planX + 5}
                          y={planY + 5}
                          width={Math.max(20, planW - 10)}
                          height={Math.max(12, planD - 10)}
                          rx={Math.max(3, planR - 4)}
                          ry={Math.max(3, planR - 4)}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="1.2"
                          strokeDasharray="3 2"
                        />
                        {/* Twin legs footprint for capsule_table */}
                        {capKind === "capsule_table" && (
                          <g>
                            <circle cx={planX + planW * 0.24} cy={planY + planD / 2} r={Math.max(7, planD * 0.22)} fill={bodyHex} fillOpacity="0.55" stroke="#0f172a" strokeDasharray="2 2" />
                            <circle cx={planX + planW * 0.76} cy={planY + planD / 2} r={Math.max(7, planD * 0.22)} fill={bodyHex} fillOpacity="0.55" stroke="#0f172a" strokeDasharray="2 2" />
                          </g>
                        )}
                        {/* Radius callout arrow on right arc */}
                        <line
                          x1={planX + planW - planR}
                          y1={planY + planD / 2}
                          x2={planX + planW}
                          y2={planY + planD / 2}
                          stroke="#0284c7"
                          strokeWidth="1.5"
                        />
                        <circle cx={planX + planW - planR} cy={planY + planD / 2} r="2.2" fill="#0284c7" />
                        <text x="140" y="140" textAnchor="middle" fill="#f8fafc" fontSize="9" fontFamily="monospace" fontWeight="700">
                          R={effR}mm • 180° Kavis: {kerfPreview.unfoldedArcLengthMm}mm ({kerfPreview.kerfCount} kerf)
                        </text>
                      </svg>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                    <label className="space-y-1 sm:col-span-2">
                      <span className="font-bold text-slate-700">Ünite / Model Adı</span>
                      <input
                        type="text"
                        value={capName}
                        onChange={(e) => setCapName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="font-bold text-slate-700">Genişlik W (mm)</span>
                      <input
                        type="number" inputMode="decimal"
                        value={capW}
                        min={700}
                        max={3400}
                        step={50}
                        onChange={(e) => setCapW(Number(e.target.value) || 1200)}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="font-bold text-slate-700">Yükseklik H (mm)</span>
                      <input
                        type="number" inputMode="decimal"
                        value={capH}
                        min={450}
                        max={2200}
                        step={10}
                        onChange={(e) => setCapH(Number(e.target.value) || 750)}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="font-bold text-slate-700">Derinlik D (mm)</span>
                      <input
                        type="number" inputMode="decimal"
                        value={capD}
                        min={360}
                        max={1200}
                        step={20}
                        onChange={(e) => {
                          const nextD = Number(e.target.value) || 480;
                          setCapD(nextD);
                          setCapR(Math.floor(nextD / 2));
                        }}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="font-bold text-slate-700">
                        Kapsül Uç Yarıçapı R (Maks {Math.floor(capD / 2)}mm = Tam Kapsül)
                      </span>
                      <input
                        type="number" inputMode="decimal"
                        value={effR}
                        min={40}
                        max={Math.floor(capD / 2)}
                        step={10}
                        onChange={(e) => setCapR(Number(e.target.value) || 240)}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="font-bold text-slate-700">Gövde / Tambur Yüzeyi</span>
                      <select
                        value={capBodyMat}
                        onChange={(e) => setCapBodyMat(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                      >
                        {DEFAULT_MATERIALS.slice(0, 18).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="font-bold text-slate-700">Üst Tabla Yüzeyi</span>
                      <select
                        value={capTopMat}
                        onChange={(e) => setCapTopMat(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                      >
                        {DEFAULT_MATERIALS.slice(0, 18).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Live CNC Kerf-Bending Manufacturing Readout */}
                  <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-amber-950">
                    <div className="space-y-0.5">
                      <div className="font-extrabold">
                        📐 Canlı CNC Kerf-Bending &amp; Kavisli Üretim Hesabı (18mm Levha • 3.2mm Testere Çentiği)
                      </div>
                      <div className="font-mono">
                        180° Kavis Açınım Boyu: <b>{kerfPreview.unfoldedArcLengthMm} mm</b> • Kerf Derinliği:{" "}
                        <b>{kerfPreview.kerfDepthMm} mm</b> (Kalan Esnek Et: <b>{kerfPreview.uncutSkinMm} mm</b>) •{" "}
                        <b>{kerfPreview.kerfCount} çentik</b> @ <b>{kerfPreview.kerfSpacingMm} mm</b> adım
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid="v5-create-capsule-module-btn"
                      onClick={() => {
                        if (onCreateCapsuleModule) {
                          onCreateCapsuleModule({
                            kind: capKind,
                            name: capName,
                            widthMm: capW,
                            heightMm: capH,
                            depthMm: capD,
                            cornerRadiusMm: effR,
                            tambourSlatPitchMm: capSlatPitch,
                            bodyMaterialId: capBodyMat,
                            topMaterialId: capTopMat,
                          });
                          setStatusMsg(
                            `"${capName}" (${capW}×${capH}×${capD}mm, R=${effR}mm) 3D kapsül geometrisi ve CNC Kerf-Bending kesim listesiyle sahneye eklendi!`
                          );
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-[#141413] hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Üretim Modülü Olarak Sahneye Ekle</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB 1: MODULES, FIT-TO-GAP, COMPOSITE SETS & CUSTOM TEMPLATES */}
          {tab === "modules" && (
            <div className="space-y-5">
              {/* Target Wall + Insert-Between Bar */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-700">Hedef Duvar:</span>
                  <select
                    value={targetWallId}
                    onChange={(e) => setTargetWallId(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-bold text-[#141413]"
                  >
                    {(project.space.walls || []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.length}mm • {w.rotationY}°)
                      </option>
                    ))}
                  </select>

                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 font-semibold text-amber-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={insertBetweenMode}
                      onChange={(e) => setInsertBetweenMode(e.target.checked)}
                    />
                    <span>Araya Ekle &amp; Komşu Modülleri Kaydır (Insert &amp; Reflow)</span>
                  </label>
                </div>

                <input
                  type="text"
                  value={modSearch}
                  onChange={(e) => setModSearch(e.target.value)}
                  placeholder="TV ünitesi, banyo, vestiyer, mutfak ara..."
                  className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 w-64 font-medium"
                />
              </div>

              {/* Fit-to-Gap Automatic Free Span Cards */}
              {baseGaps.length > 0 && (
                <div className="space-y-2">
                  <div className="font-extrabold text-slate-800">
                    Kalan Duvar Boşluklarını Otomatik Doldur (Fit-to-Gap)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {baseGaps.map((gap) => {
                      const wallLen =
                        project.space.walls?.find((w) => w.id === gap.wallId)?.length ||
                        Math.max(gap.endAlongMm, 2400);
                      const gx = Math.max(2, Math.min(96, (gap.startAlongMm / wallLen) * 100));
                      const gw = Math.max(4, Math.min(100 - gx, (gap.widthMm / wallLen) * 100));
                      return (
                      <div
                        key={gap.id}
                        className="p-3 rounded-2xl bg-white border border-sky-200 flex flex-col justify-between gap-2"
                      >
                        <svg viewBox="0 0 100 24" className="w-full h-7 rounded-lg bg-slate-900/5 border border-slate-200/80" aria-label="Duvar boşluk planı">
                          <rect x="2" y="6" width="96" height="12" rx="2" fill="#cbd5e1" />
                          <rect x={gx} y="5" width={gw} height="14" rx="1.5" fill="#0ea5e9" fillOpacity="0.28" stroke="#0284c7" strokeWidth="1" strokeDasharray="2 1.5" />
                          <text x={Math.min(86, Math.max(14, gx + gw / 2))} y="14.5" textAnchor="middle" fill="#0369a1" fontSize="6.5" fontFamily="monospace" fontWeight="700">
                            {gap.widthMm}mm
                          </text>
                        </svg>
                        <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#141413]">{gap.wallName}</div>
                          <div className="text-[11px] font-mono text-slate-600">
                            X:{gap.startAlongMm}..{gap.endAlongMm}mm ({gap.widthMm} mm boş)
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onFillWallGap(gap);
                            setStatusMsg(
                              `${gap.wallName} üzerindeki ${gap.widthMm}mm boşluğa tam ölçülü parametrik modül üretildi.`
                            );
                          }}
                          className="px-3 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                        >
                          {gap.widthMm <= 180 ? "Kör Panel At" : `${gap.widthMm}mm Modül Sığdır`}
                        </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Multi-Module Composite Assemblies */}
              <div className="space-y-2">
                <div className="font-extrabold text-slate-800">
                  Hazır Çoklu Modül + Cihaz Kombinasyon Grupları (Tek Tıkla Sahneye Kur)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {V5_COMPOSITE_ASSEMBLIES.map((comp) => {
                    const preview = compositePreviews.get(comp.presetId);
                    return (
                    <div
                      key={comp.presetId}
                      className="group p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between gap-2"
                    >
                      <div className="space-y-1.5">
                        <div
                          style={{
                            background: "linear-gradient(180deg, #888d96 0%, #7c818a 68%, #676c75 100%)",
                          }}
                          className="relative w-full h-[116px] rounded-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-14px_24px_rgba(0,0,0,0.42)] flex items-center justify-center gap-1 px-2 overflow-hidden pointer-events-none"
                        >
                          {preview && preview.previewItems.length > 0 ? (
                            preview.previewItems.map((pi) => (
                              <div key={pi.catalogId} className="flex-1 h-full flex items-center justify-center min-w-0">
                                <SceneObjectThumbnail
                                  item={pi}
                                  className="w-full h-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.06] drop-shadow-[0_8px_10px_rgba(0,0,0,0.35)]"
                                />
                              </div>
                            ))
                          ) : (
                            <Layers className="w-8 h-8 text-white/60" />
                          )}
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-400/95 text-slate-950 text-[9.5px] font-extrabold shadow-xs">
                            {comp.badge}
                          </span>
                        </div>
                        <div className="font-bold text-xs text-[#141413]">{comp.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{comp.description}</div>
                      </div>
                      <button
                        type="button"
                        data-testid={`v5-add-composite-${comp.presetId}`}
                        onClick={() => {
                          onAddCompositeAssembly(comp.presetId);
                          setStatusMsg(`"${comp.name}" modülleri ve 3D cihazlarıyla birlikte sahneye eklendi.`);
                        }}
                        className="w-full py-1.5 px-3 rounded-xl bg-[#141413] hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer"
                      >
                        + Kombinasyonu Sahneye Ekle
                      </button>
                    </div>
                    );
                  })}
                </div>
              </div>

              {/* Save Current Active Module as Reusable Custom Template */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                <div className="font-extrabold text-slate-800">
                  Seçili Aktif Dolabı Kendi Özel Modül Şablonum Olarak Kaydet
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={customTplName}
                    onChange={(e) => setCustomTplName(e.target.value)}
                    placeholder="Örn: Birim Özel Kahve & Bar Ünitesi 140cm"
                    className="flex-1 min-w-[200px] px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                  />
                  <select
                    value={customTplFamily}
                    onChange={(e) => setCustomTplFamily(e.target.value as ModuleFamilyId)}
                    className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                  >
                    <option value="fam_wardrobe">Gardırop / TV / Kitaplık</option>
                    <option value="fam_kitchen_base">Mutfak / Banyo Alt</option>
                    <option value="fam_kitchen_wall">Mutfak Üst</option>
                    <option value="fam_kitchen_tall">Boy &amp; Cihaz Kulesi</option>
                  </select>
                  <button
                    type="button"
                    data-testid="v5-save-custom-module-template-btn"
                    onClick={() => {
                      onSaveActiveModuleAsTemplate(customTplName, customTplFamily);
                      setStatusMsg(`"${customTplName}" özel şablon kütüphanenize kaydedildi.`);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                  >
                    Şablon Olarak Kaydet
                  </button>
                </div>

                {savedCustomTemplates.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {savedCustomTemplates.map((ct) => (
                      <div
                        key={ct.templateId}
                        className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <svg
                            viewBox="0 0 44 36"
                            className="w-11 h-9 rounded-lg bg-slate-800/90 border border-emerald-300/60 shrink-0 p-1"
                            aria-hidden="true"
                          >
                            {(() => {
                              const s = Math.min(34 / Math.max(ct.baseDimensions.width, 300), 26 / Math.max(ct.baseDimensions.height, 300));
                              const rw = Math.max(10, Math.round(ct.baseDimensions.width * s));
                              const rh = Math.max(8, Math.round(ct.baseDimensions.height * s));
                              const rx = (44 - rw) / 2;
                              const ry = 32 - rh;
                              return (
                                <g>
                                  <rect x={rx} y={ry} width={rw} height={rh} rx="1.5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1" />
                                  <line x1={rx + rw / 2} y1={ry} x2={rx + rw / 2} y2={ry + rh} stroke="#475569" strokeWidth="0.8" />
                                </g>
                              );
                            })()}
                          </svg>
                          <div className="min-w-0">
                            <div className="font-bold truncate">{ct.name}</div>
                            <div className="text-[10px] font-mono text-slate-600">
                              {ct.baseDimensions.width}×{ct.baseDimensions.height}×
                              {ct.baseDimensions.depth} mm
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              onAppendModule(ct.templateId, {
                                wallId: targetWallId,
                                insertBetween: insertBetweenMode,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-[#141413] text-white text-[10.5px] font-bold cursor-pointer"
                          >
                            + Ekle
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCustomTemplate(ct.templateId)}
                            className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Specialized V5 Module Grid (with optional toggle for standard V4 modules) */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-extrabold text-slate-800">
                    Özel Mimari Üretim Modülleri (TV Ünitesi, Kitaplık, Banyo, Vestiyer, Çamaşır &amp; Kapsül)
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStandardV4Modules((v) => !v)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                      showStandardV4Modules
                        ? "bg-[#141413] text-white border-[#141413]"
                        : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
                    }`}
                  >
                    {showStandardV4Modules
                      ? "Sadece Özel V5 Modülleri Göster"
                      : `Standart Dolapları da Göster (+${standardOnlyV4Modules.length})`}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {filteredModules.map((m) => (
                    <div
                      key={m.templateId}
                      draggable={true}
                      onDragStart={(e) => startModuleSilhouetteDrag(e, m.templateId)}
                      className="group p-3 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs hover:shadow-sm transition"
                    >
                      <div>
                        <V3StudioModuleThumbnail template={m} />
                        <div className="font-bold text-xs text-[#141413]">{m.name}</div>
                        <div className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-2">
                          {m.description}
                        </div>
                        <div className="text-[10px] font-mono text-slate-600 mt-1">
                          {m.defaultDimensions.width} × {m.defaultDimensions.height} ×{" "}
                          {m.defaultDimensions.depth} mm
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onAppendModule(m.templateId, {
                            wallId: targetWallId,
                            insertBetween: insertBetweenMode,
                          });
                          setStatusMsg(`"${m.name}" seçili duvara yeni modül olarak eklendi.`);
                        }}
                        className="w-full py-1.5 px-2.5 rounded-xl bg-[#141413] hover:bg-slate-800 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Yeni Modül Olarak Ekle</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPLIANCES & PLUMBING FIXTURES */}
          {false && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-600">
                Eviye ve indüksiyon ocaklar tezgâh üstüne otomatik kilitlenip CNC kesim ve su/elektrik MEP noktalarını üretir; fırın/mikrodalga boy kulesi nişine oturur; solo buzdolabı ve bulaşık makinesi duvar sırasına hizalanır.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {applianceItems.map(renderCatalogCard)}
              </div>
            </div>
          )}

          {/* TAB 3: BIRIM FURNITURE, LIGHTING, ELECTRONICS & ARCHITECTURAL OBSTACLES */}
          {false && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-600">
                Birim yemek masası, sandalye, bar taburesi, modüler kanepe, yatak, sarkıt aydınlatma, 65&quot; OLED TV ve gerçek saha engellerini (kapı açılım yayı, pencere, petek, kombi, kolon) sahneye ekleyin.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {furnitureAndArchItems.map(renderCatalogCard)}
              </div>
            </div>
          )}

          {/* TAB 4: CUSTOM .GLB UPLOAD & ACTIVE SCENE OBJECTS INSPECTOR */}
          {tab === "custom_glb" && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-extrabold text-sm text-[#141413]">
                      Dışarıdan Özel 3D Model (`.GLB` / `.GLTF`) Yükle veya URL Bağla
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Canlı 3B zarf ölçüsü ve yüzey mıknatıslanma önizlemesi
                    </div>
                  </div>
                  <div
                    style={{
                      background: "linear-gradient(180deg, #888d96 0%, #7c818a 68%, #676c75 100%)",
                    }}
                    className="rounded-xl border border-white/15 px-3 py-1.5 flex items-center gap-3 shrink-0"
                  >
                    <svg viewBox="0 0 88 58" className="w-[82px] h-[52px]" aria-hidden="true">
                      {/* Anchor reference plane */}
                      {glbAnchor === "ceiling" ? (
                        <line x1="8" y1="7" x2="80" y2="7" stroke="#38bdf8" strokeWidth="2" />
                      ) : glbAnchor === "wall_base" || glbAnchor === "wall_elevated" ? (
                        <line x1="12" y1="6" x2="12" y2="52" stroke="#38bdf8" strokeWidth="2" />
                      ) : (
                        <line x1="8" y1="51" x2="80" y2="51" stroke="#38bdf8" strokeWidth="2" />
                      )}
                      {/* Isometric bounding cube */}
                      <polygon points="44,13 68,23 44,33 20,23" fill="#e2e8f0" fillOpacity="0.9" stroke="#0f172a" strokeWidth="1" />
                      <polygon points="20,23 44,33 44,49 20,39" fill="#cbd5e1" fillOpacity="0.9" stroke="#0f172a" strokeWidth="1" />
                      <polygon points="68,23 44,33 44,49 68,39" fill="#94a3b8" fillOpacity="0.9" stroke="#0f172a" strokeWidth="1" />
                    </svg>
                    <div className="text-[10px] font-mono text-white/95 leading-tight">
                      <div className="font-bold text-amber-200">{glbW} × {glbH} × {glbD} mm</div>
                      <div className="text-sky-200">{glbAnchor}</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label className="space-y-1 block">
                    <span className="font-bold text-slate-700">Obje / Ürün Adı</span>
                    <input
                      type="text"
                      value={glbName}
                      onChange={(e) => setGlbName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="font-bold text-slate-700">Stok Kodu (SKU)</span>
                    <input
                      type="text"
                      value={glbSku}
                      onChange={(e) => setGlbSku(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="font-bold text-slate-700">Yüzey Mıknatıslanma Tipi</span>
                    <select
                      value={glbAnchor}
                      onChange={(e) => setGlbAnchor(e.target.value as SceneObjectAnchorMode)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-semibold"
                    >
                      <option value="free_floor">Zemin Üstü Serbest (Masa/Koltuk/Bitki)</option>
                      <option value="wall_base">Duvara Yaslı Taban (Cihaz/Ayna)</option>
                      <option value="wall_elevated">Duvara Askılı (Tablo/TV/Aplik)</option>
                      <option value="countertop_cutout">Tezgâh / Konsol Üstü</option>
                      <option value="ceiling">Tavana Askılı (Sarkıt Avize)</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <label className="space-y-1 block">
                    <span className="font-bold text-slate-700">Genişlik W (mm)</span>
                    <input
                      type="number" inputMode="decimal"
                      min={50}
                      max={6000}
                      value={glbW}
                      onChange={(e) => setGlbW(Number(e.target.value) || 600)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="font-bold text-slate-700">Yükseklik H (mm)</span>
                    <input
                      type="number" inputMode="decimal"
                      min={10}
                      max={4000}
                      value={glbH}
                      onChange={(e) => setGlbH(Number(e.target.value) || 800)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="font-bold text-slate-700">Derinlik D (mm)</span>
                    <input
                      type="number" inputMode="decimal"
                      min={20}
                      max={6000}
                      value={glbD}
                      onChange={(e) => setGlbD(Number(e.target.value) || 600)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="font-bold text-slate-700">Teklif Fiyatı (€)</span>
                    <input
                      type="number" inputMode="decimal"
                      min={0}
                      step={10}
                      value={glbPriceEur}
                      onChange={(e) => setGlbPriceEur(Number(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label className="px-4 py-2 rounded-xl bg-[#141413] hover:bg-slate-800 text-white font-bold inline-flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4 text-emerald-300" />
                    <span>Bilgisayardan .GLB / .GLTF Dosyası Seç (Kalıcı Kayıt)</span>
                    <input
                      type="file"
                      accept=".glb,.gltf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUploadGlbFile(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>

                  <div className="flex-1 min-w-[240px] flex items-center gap-1.5">
                    <input
                      type="url"
                      value={glbUrlDraft}
                      onChange={(e) => setGlbUrlDraft(e.target.value)}
                      placeholder="veya doğrudan https://.../model.glb URL yapıştırın"
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300"
                    />
                    <button
                      type="button"
                      onClick={handleAddUrlGlb}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-950 text-white font-bold cursor-pointer"
                    >
                      URL Ekle
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Scene Objects Table & Live Transform Controls */}
              <div className="space-y-2">
                <div className="font-extrabold text-slate-800">
                  Sahnedeki Cihaz, Mobilya ve 3D Objeler ({sceneObjects.length})
                </div>
                {sceneObjects.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-slate-500">
                    Henüz sahneye cihaz veya serbest 3D obje eklenmedi. Yukarıdan `.GLB` yükleyebilir veya Cihazlar / Birim Mobilya sekmelerinden ekleyebilirsiniz.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sceneObjects.map((so) => {
                      const isSel = selectedSceneObjectId === so.id;
                      return (
                        <div
                          key={so.id}
                          onClick={() => onSelectSceneObject(so.id)}
                          className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 transition cursor-pointer ${
                            isSel
                              ? "bg-sky-50 border-sky-500 ring-1 ring-sky-500"
                              : "bg-white border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-[210px]">
                            <div
                              style={{
                                background: "linear-gradient(180deg, #888d96 0%, #676c75 100%)",
                              }}
                              className="w-14 h-12 rounded-xl border border-white/15 flex items-center justify-center overflow-hidden shrink-0 pointer-events-none"
                            >
                              {V5_SCENE_OBJECT_CATALOG.some((c) => c.catalogId === so.catalogId) ? (
                                <SceneObjectThumbnail
                                  item={{
                                    catalogId: so.catalogId,
                                    name: so.name,
                                    primaryColorHex:
                                      V5_SCENE_OBJECT_CATALOG.find((c) => c.catalogId === so.catalogId)
                                        ?.primaryColorHex || "#94a3b8",
                                  }}
                                  className="w-full h-full object-contain p-0.5"
                                />
                              ) : (
                                <Box className="w-5 h-5 text-white/85" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-[#141413]">{so.name}</div>
                              <div className="text-[10.5px] font-mono text-slate-500">
                                [{so.sku}] {so.dimensions.width}×{so.dimensions.height}×
                                {so.dimensions.depth}mm •{" "}
                                {so.commercialRole === "quoted_product" && so.unitPriceEur > 0
                                  ? `Teklifte: €${so.unitPriceEur}`
                                  : "Dekor / Müşteri"}
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex flex-wrap items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <label className="flex items-center gap-1 text-[10.5px] font-mono">
                              <span>X:</span>
                              <input
                                type="number" inputMode="decimal"
                                step={50}
                                value={so.position.x}
                                onChange={(e) =>
                                  onUpdateSceneObject(so.id, {
                                    position: { ...so.position, x: Number(e.target.value) || 0 },
                                  })
                                }
                                className="w-18 px-2 py-1 rounded-lg bg-slate-50 border border-slate-300 font-bold"
                              />
                            </label>
                            <label className="flex items-center gap-1 text-[10.5px] font-mono">
                              <span>Y:</span>
                              <input
                                type="number" inputMode="decimal"
                                step={50}
                                value={so.position.y}
                                onChange={(e) =>
                                  onUpdateSceneObject(so.id, {
                                    position: { ...so.position, y: Number(e.target.value) || 0 },
                                  })
                                }
                                className="w-18 px-2 py-1 rounded-lg bg-slate-50 border border-slate-300 font-bold"
                              />
                            </label>
                            <label className="flex items-center gap-1 text-[10.5px] font-mono">
                              <span>Z:</span>
                              <input
                                type="number" inputMode="decimal"
                                step={50}
                                value={so.position.z}
                                onChange={(e) =>
                                  onUpdateSceneObject(so.id, {
                                    position: { ...so.position, z: Number(e.target.value) || 0 },
                                  })
                                }
                                className="w-18 px-2 py-1 rounded-lg bg-slate-50 border border-slate-300 font-bold"
                              />
                            </label>
                            <button
                              type="button"
                              title="45° Döndür"
                              onClick={() =>
                                onUpdateSceneObject(so.id, {
                                  rotation: {
                                    ...so.rotation,
                                    y: ((so.rotation?.y || 0) + 45) % 360,
                                  },
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCw className="w-3 h-3" />
                              <span>{so.rotation?.y || 0}°</span>
                            </button>
                            <button
                              type="button"
                              title="Çoğalt"
                              onClick={() => onDuplicateSceneObject(so.id)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Sil"
                              onClick={() => onRemoveSceneObject(so.id)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: AUTO-FILLERS, OBSTACLE NOTCHING, LIDAR IMPORT, WORK TRIANGLE & CLOUD SYNC */}
          {tab === "automation" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="font-extrabold text-sm text-[#141413]">
                  Otomatik Duvar Kör Parça, Tavan Alın/Taç &amp; Kolon Kertme
                </div>
                <p className="text-[11px] text-slate-600">
                  Duvar sonlarındaki 18–180mm boşluklara otomatik tesviye/kör paneli, dolap üstü ile tavan arasına alın kapaması, üst dolap altına LED ışık bandı ve çakışan kolon/borulara CNC karkas kertmesi uygular.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    data-testid="v5-auto-fillers-crown-btn"
                    onClick={() => {
                      const res = onAutoFillersAndCrown();
                      setStatusMsg(
                        res.count > 0
                          ? `${res.count} adet otomatik kör parça / tavan alın kapaması / LED ışık bandı üretildi.`
                          : "Mevcut dizilimde açıkta kalan 18–180mm duvar veya tavan boşluğu bulunmadı."
                      );
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#141413] hover:bg-slate-800 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Otomatik Kör Panel + Tavan Alın + Işık Bandı Üret</span>
                  </button>

                  <button
                    type="button"
                    data-testid="v5-auto-notch-obstacles-btn"
                    onClick={() => {
                      const res = onAutoNotchObstacles();
                      setStatusMsg(
                        res.count > 0
                          ? `${res.count} adet kolon/boru/priz çakışması için otomatik CNC karkas kertmesi açıldı.`
                          : "Modüllerle çakışan kolon, kiriş veya tesisat engeli tespit edilmedi."
                      );
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-950 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Wrench className="w-4 h-4 text-sky-300" />
                    <span>Kolon / Kiriş / Boru Etrafına Otomatik Karkas Kertme Uygula</span>
                  </button>
                </div>
              </div>

              {/* Apple LiDAR RoomPlan JSON Importer */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="font-extrabold text-sm text-[#141413] flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-emerald-700" />
                  <span>iPhone / iPad LiDAR RoomPlan 3D Rölöve (.JSON) İçe Aktar</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Apple RoomPlan taramasından alınan `.json` dosyasındaki duvarları, kapıları, pencereleri ve tespit edilen cihazları 1:1 milimetre ölçeğinde sahneye kurar.
                </p>
                <label className="w-full py-2.5 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold flex items-center justify-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>RoomPlan Tarama (.JSON) Dosyası Yükle</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const txt = await f.text();
                        const res = onImportRoomPlanJson(txt);
                        setStatusMsg(res.summary);
                      }
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              {/* Work Triangle & Ergonomics Report */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-extrabold text-sm text-[#141413]">
                    NKBA Mutfak Çalışma Üçgeni &amp; Ergonomi Denetimi
                  </div>
                  <svg viewBox="0 0 96 52" className="w-24 h-12 shrink-0 rounded-lg bg-slate-900/5 border border-slate-200/80" aria-hidden="true">
                    <polygon
                      points="48,9 16,42 80,42"
                      fill={ergCheck?.report.isComplete ? (ergCheck.report.perimeterPassed ? "#10b981" : "#f59e0b") : "#94a3b8"}
                      fillOpacity="0.18"
                      stroke={ergCheck?.report.isComplete ? (ergCheck.report.perimeterPassed ? "#059669" : "#d97706") : "#64748b"}
                      strokeWidth="1.5"
                      strokeDasharray={ergCheck?.report.isComplete ? undefined : "3 2"}
                    />
                    <circle cx="48" cy="9" r="3" fill="#0f172a" />
                    <circle cx="16" cy="42" r="3" fill="#0284c7" />
                    <circle cx="80" cy="42" r="3" fill="#ea580c" />
                  </svg>
                </div>
                {ergCheck?.report.isComplete ? (
                  <div className="space-y-1.5">
                    <div className="font-mono text-xs font-bold">
                      Toplam Üçgen Çevresi: {ergCheck.report.perimeterMm} mm{" "}
                      <span
                        className={
                          ergCheck.report.perimeterPassed ? "text-emerald-700" : "text-amber-700"
                        }
                      >
                        ({ergCheck.report.perimeterPassed ? "İdeal 3600–7900mm" : "Aralık Dışı"})
                      </span>
                    </div>
                    {ergCheck.report.legs.map((leg) => (
                      <div
                        key={`${leg.fromLabel}-${leg.toLabel}`}
                        className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100"
                      >
                        <span>
                          {leg.fromLabel} ↔ {leg.toLabel}
                        </span>
                        <span className="font-mono font-bold">{leg.distanceMm} mm</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Buzdolabı, Eviye ve Ocak üçlüsü sahneye eklendiğinde çalışma üçgeni mesafeleri otomatik hesaplanır.
                  </p>
                )}
              </div>

              {/* Supabase + Cloudflare R2 Cloud Sync & Migration SQL */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="font-extrabold text-sm text-[#141413] flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-sky-700" />
                  <span>Birim Portal Supabase + Cloudflare R2 Bulut Senkronizasyonu</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Projeyi, özel modül şablonlarını ve sahne objelerini `configurator_projects` tablosuna senkronize eder veya RLS SQL şemasını indirir.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const adapter = new SupabaseCloudPersistenceAdapter({
                        branchId: project.branchId,
                      });
                      const res = await adapter.upsertProject(project, totalWithVatEur);
                      setStatusMsg(
                        res.mode === "supabase_cloud"
                          ? "Proje doğrudan Supabase PostgreSQL veritabanına kaydedildi."
                          : "Proje çevrimdışı IndexedDB bulut önbelleğine kaydedildi (.env Supabase değişkenleri tanımlandığında otomatik buluta yazar)."
                      );
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold cursor-pointer"
                  >
                    Buluta Senkronize Et
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const sql = getBirimV5SupabaseMigrationSql();
                      const blob = new Blob([sql], { type: "text/sql;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "birim_configurator_v5_supabase_migration.sql";
                      document.body.appendChild(a);
                      a.click();
                      setTimeout(() => {
                        if (a.parentNode) a.parentNode.removeChild(a);
                        URL.revokeObjectURL(url);
                      }, 500);
                    }}
                    className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Supabase SQL</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
