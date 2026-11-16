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
  const [tab, setTab] = useState<"modules" | "capsule_curved" | "appliances" | "furniture" | "custom_glb" | "automation">(
    initialTab
  );
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
  const [targetWallId, setTargetWallId] = useState<string>(
    project.space.walls?.[0]?.id || "wall_main"
  );
  const [insertBetweenMode, setInsertBetweenMode] = useState<boolean>(false);
  const [customTplName, setCustomTplName] = useState<string>("Birim Özel Modülüm");
  const [customTplFamily, setCustomTplFamily] = useState<ModuleFamilyId>("fam_wardrobe");
  const [modSearch, setModSearch] = useState<string>("");

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

  if (!isOpen) return null;

  const sceneObjects = project.sceneObjects || [];
  const savedCustomTemplates = project.customModuleTemplates || [];

  const filteredModules = [
    ...V5_SPECIALIZED_MODULE_TEMPLATES,
    ...V4_MODULE_TEMPLATES.filter(
      (m) => !V5_SPECIALIZED_MODULE_TEMPLATES.some((s) => s.templateId === m.templateId)
    ),
  ]
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
      className="p-3 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/90 flex flex-col justify-between gap-2 shadow-2xs transition"
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono font-bold text-slate-700">
            {item.sku}
          </span>
          <span className="text-[10.5px] font-bold text-emerald-800">
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
      className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-3 sm:p-5"
    >
      <div
        data-draggable-shell="v5-hub-modal"
        onClick={(e) => e.stopPropagation()}
        className="birim-ice-modal rounded-[28px] max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-[#141413]"
      >
        {/* Header */}
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          className="px-5 py-3.5 birim-ice-shell-header flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <BirimLogo className="h-5 w-auto text-[#141413] shrink-0" />
            <div className="h-4 w-px bg-slate-900/15 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-[#141413] truncate">
                Birim V5 — Çoklu Modül, Cihaz, Mobilya &amp; Özel 3D Obje (.GLB) Merkezi
              </h2>
              <p className="text-[11px] text-slate-600 truncate">
                Sahnedeki Modül: {project.modules.length} adet • Sahne Objesi / Cihaz:{" "}
                {sceneObjects.length} adet • Kartları sahneye sürükleyebilir veya tek tıkla ekleyebilirsiniz
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl birim-ice-btn flex items-center justify-center text-slate-700 hover:text-slate-950 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 py-2.5 bg-white/55 border-b border-slate-200/80 flex flex-wrap items-center gap-1.5">
          {[
            { id: "modules" as const, label: "1. Modül & Boşluk Doldur", icon: Layers },
            { id: "capsule_curved" as const, label: "✨ Kapsül Bar Dolabı & Masa", icon: Sparkles },
            { id: "appliances" as const, label: "2. Cihazlar & Eviye", icon: Sparkles },
            { id: "furniture" as const, label: "3. Birim Mobilya, Işık & Yapı", icon: Compass },
            {
              id: "custom_glb" as const,
              label: `4. Özel .GLB Yükle & Sahne (${sceneObjects.length})`,
              icon: Box,
            },
            { id: "automation" as const, label: "5. Kör/Taç, Kertme, LiDAR & Bulut", icon: Wrench },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`v5-hub-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                  active
                    ? "bg-[#141413] text-white shadow-xs"
                    : "bg-white/80 hover:bg-white text-slate-700 border border-slate-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
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
                        type="number"
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
                        type="number"
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
                        type="number"
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
                        type="number"
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
                    {baseGaps.map((gap) => (
                      <div
                        key={gap.id}
                        className="p-3 rounded-2xl bg-white border border-sky-200 flex items-center justify-between gap-2"
                      >
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
                    ))}
                  </div>
                </div>
              )}

              {/* Multi-Module Composite Assemblies */}
              <div className="space-y-2">
                <div className="font-extrabold text-slate-800">
                  Hazır Çoklu Modül + Cihaz Kombinasyon Grupları (Tek Tıkla Sahneye Kur)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {V5_COMPOSITE_ASSEMBLIES.map((comp) => (
                    <div
                      key={comp.presetId}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between gap-2"
                    >
                      <div>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                          {comp.badge}
                        </span>
                        <div className="font-bold text-xs mt-1 text-[#141413]">{comp.name}</div>
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
                  ))}
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
                        <div className="min-w-0">
                          <div className="font-bold truncate">{ct.name}</div>
                          <div className="text-[10px] font-mono text-slate-600">
                            {ct.baseDimensions.width}×{ct.baseDimensions.height}×
                            {ct.baseDimensions.depth} mm
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

              {/* Specialized + V4 Module Grid */}
              <div className="space-y-2">
                <div className="font-extrabold text-slate-800">
                  Yeni Modül Ekle (TV Ünitesi, Kitaplık, Banyo, Vestiyer, Çamaşır Kulesi, Mutfak &amp; Gardırop)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {filteredModules.map((m) => (
                    <div
                      key={m.templateId}
                      draggable={true}
                      onDragStart={(e) => startModuleSilhouetteDrag(e, m.templateId)}
                      className="p-3 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between gap-2"
                    >
                      <div>
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
          {tab === "appliances" && (
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
          {tab === "furniture" && (
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
                <div className="font-extrabold text-sm text-[#141413]">
                  Dışarıdan Özel 3D Model (`.GLB` / `.GLTF`) Yükle veya URL Bağla
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
                      type="number"
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
                      type="number"
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
                      type="number"
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
                      type="number"
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
                          <div className="min-w-[180px]">
                            <div className="font-bold text-[#141413]">{so.name}</div>
                            <div className="text-[10.5px] font-mono text-slate-500">
                              [{so.sku}] {so.dimensions.width}×{so.dimensions.height}×
                              {so.dimensions.depth}mm •{" "}
                              {so.commercialRole === "quoted_product" && so.unitPriceEur > 0
                                ? `Teklifte: €${so.unitPriceEur}`
                                : "Dekor / Müşteri"}
                            </div>
                          </div>

                          <div
                            className="flex flex-wrap items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <label className="flex items-center gap-1 text-[10.5px] font-mono">
                              <span>X:</span>
                              <input
                                type="number"
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
                                type="number"
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
                                type="number"
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
                <div className="font-extrabold text-sm text-[#141413]">
                  NKBA Mutfak Çalışma Üçgeni &amp; Ergonomi Denetimi
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
