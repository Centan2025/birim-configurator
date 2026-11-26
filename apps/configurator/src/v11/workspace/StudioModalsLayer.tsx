"use client";


import React from "react";
import type {
  ArchitecturalElement,
  CustomStandardMetric,
  CustomStandardRule,
  DesignProject,
  DrawerConfig,
  HangingRailConfig,
  MaterialDefinition,
  ModuleFamilyId,
  ModuleInstance,
  RemediationProposal,
  SceneObjectInstance,
  WallDefinition,
  WallFreeGapSlot,
} from "@birim/core";
import type { ManufacturingBOM } from "@birim/manufacturing";
import type { PricingBreakdown } from "@birim/pricing";
import { KITCHEN_ENGINEERING_RULE_REGISTRY, type EngineeringValidationFinding } from "../../v3/adapter/useV3Adapter";
import type { GuidedWizardLayoutInput } from "../../v3/adapter/guidedWizardBuilder";
import type { DoorShowcaseMode } from "../../v3/adapter/doorShowcaseBuilder";
import type { CommandPaletteAction } from "../../v3/components/workspace/CommandSearchModal";
import type { V11WorkspaceMode } from "../v11Constants";
import { HardwareQuickSwapPopover, type HardwareSwapTarget } from "../HardwareQuickSwapPopover";
import { AnimatedModalPresence, AnimatedValuePresence } from "../AnimatedWindowPresence";

import type BomModalType from "../../components/BomModal";
import type StoreErpModalType from "../../components/StoreErpModal";
import type { CommandSearchModal as CommandSearchModalType } from "../../v3/components/workspace/CommandSearchModal";
import type { DoorSystemsShowcaseModal as DoorSystemsShowcaseModalType } from "../DoorSystemsShowcaseModal";
import type { V3ProjectModal as V3ProjectModalType } from "../../v3/components/V3ProjectModal";
import type { AssemblyDiagramModal as AssemblyDiagramModalType } from "../../v3/components/workspace/AssemblyDiagramModal";
import type { StudioRenderModal as StudioRenderModalType } from "../../v3/components/workspace/StudioRenderModal";
import type { ArRoomPreviewModal as ArRoomPreviewModalType } from "../../v3/components/workspace/ArRoomPreviewModal";
import type { RulesStandardsModal as RulesStandardsModalType } from "../../v3/components/workspace/RulesStandardsModal";
import type { SaasTenantStudioModal as SaasTenantStudioModalType } from "../../v3/components/workspace/SaasTenantStudioModal";
import type { KitchenIslandTableModal as KitchenIslandTableModalType } from "../../v3/components/workspace/KitchenIslandTableModal";
import type { CustomHardwareModal as CustomHardwareModalType } from "../../v3/components/workspace/CustomHardwareModal";
import type { MepCoordinationModal as MepCoordinationModalType } from "../../v3/components/workspace/MepCoordinationModal";
import type { SceneObjectAndModuleHubModal as SceneObjectAndModuleHubModalType } from "../../v3/components/workspace/SceneObjectAndModuleHubModal";
import type { GuidedSetupModal as GuidedSetupModalType } from "../GuidedSetupModal";
import type { QuoteSummaryModal as QuoteSummaryModalType } from "../QuoteSummaryModal";
import type { PanelCutoutModal as PanelCutoutModalType } from "../PanelCutoutModal";
import type { ProductionSheetStudioModal as ProductionSheetStudioModalType } from "../ProductionSheetStudioModal";

export interface StudioModalsLayerProps {
  ArRoomPreviewModal: React.ComponentType<React.ComponentProps<typeof ArRoomPreviewModalType>>;
  AssemblyDiagramModal: React.ComponentType<React.ComponentProps<typeof AssemblyDiagramModalType>>;
  BomModal: React.ComponentType<React.ComponentProps<typeof BomModalType>>;
  CommandSearchModal: React.ComponentType<React.ComponentProps<typeof CommandSearchModalType>>;
  CustomHardwareModal: React.ComponentType<React.ComponentProps<typeof CustomHardwareModalType>>;
  DoorSystemsShowcaseModal: React.ComponentType<React.ComponentProps<typeof DoorSystemsShowcaseModalType>>;
  GuidedSetupModal: React.ComponentType<React.ComponentProps<typeof GuidedSetupModalType>>;
  KitchenIslandTableModal: React.ComponentType<React.ComponentProps<typeof KitchenIslandTableModalType>>;
  MepCoordinationModal: React.ComponentType<React.ComponentProps<typeof MepCoordinationModalType>>;
  PanelCutoutModal: React.ComponentType<React.ComponentProps<typeof PanelCutoutModalType>>;
  ProductionSheetStudioModal: React.ComponentType<React.ComponentProps<typeof ProductionSheetStudioModalType>>;
  QuoteSummaryModal: React.ComponentType<React.ComponentProps<typeof QuoteSummaryModalType>>;
  RulesStandardsModal: React.ComponentType<React.ComponentProps<typeof RulesStandardsModalType>>;
  SaasTenantStudioModal: React.ComponentType<React.ComponentProps<typeof SaasTenantStudioModalType>>;
  SceneObjectAndModuleHubModal: React.ComponentType<React.ComponentProps<typeof SceneObjectAndModuleHubModalType>>;
  StoreErpModal: React.ComponentType<React.ComponentProps<typeof StoreErpModalType>>;
  StudioRenderModal: React.ComponentType<React.ComponentProps<typeof StudioRenderModalType>>;
  V3ProjectModal: React.ComponentType<React.ComponentProps<typeof V3ProjectModalType>>;
  activeBayIndex: number;
  activeModule: ModuleInstance | undefined;
  activeModuleIndex: number;
  activeTenantId: string;
  addCompositeAssemblyPreset: (presetId: string) => void;
  addCustomCapsuleModule: NonNullable<React.ComponentProps<typeof SceneObjectAndModuleHubModalType>["onCreateCapsuleModule"]>;
  addCustomSceneObject: (obj: SceneObjectInstance) => void;
  addKitchenIslandUnit: React.ComponentProps<typeof KitchenIslandTableModalType>["onAddIsland"];
  addOrUpdateAttachedTable: React.ComponentProps<typeof KitchenIslandTableModalType>["onAddOrUpdateAttachedTable"];
  addSceneObjectFromCatalog: (catalogId: string, cursorWorld?: { x?: number; z?: number; wallId?: string }) => SceneObjectInstance | null;
  allFindings: EngineeringValidationFinding[];
  allMaterials: MaterialDefinition[];
  appendModuleWithMultiWallSnap: (templateId: string, opts?: { wallId?: string; worldX?: number; worldZ?: number; insertBetween?: boolean }) => ModuleInstance | null;
  applyApprovedEngineeringFix: (proposal: RemediationProposal) => void;
  applyGuidedWizardLayout: (input: GuidedWizardLayoutInput) => void;
  arExportParts: React.ComponentProps<typeof ArRoomPreviewModalType>["parts"];
  arModalOpen: boolean;
  assemblyModalOpen: boolean;
  autoResolveCornerCollisions: () => void;
  blockingCount: number;
  bom: ManufacturingBOM;
  bomModalTab: "cutlist" | "nesting" | "cnc_mpr_cix" | "blum_bxf" | null;
  commandActions: CommandPaletteAction[];
  commandSearchOpen: boolean;
  copyDoorConfigToAllBays: (bayIdx: number) => void;
  customHardwareOpen: boolean;
  customStdRules: CustomStandardRule[];
  cutoutModalOpen: boolean;
  deleteCustomModuleTemplate: (templateId: string) => void;
  displayUnit: "cm" | "mm";
  doorShowcaseOpen: boolean;
  duplicateSceneObject: (id: string) => void;
  ergonomicProfileId: React.ComponentProps<typeof RulesStandardsModalType>["ergonomicProfileId"];
  fillWallGapWithParametricModule: (gap: WallFreeGapSlot, templateId?: string) => void;
  hardwareSwapTarget: HardwareSwapTarget | null;
  importRoomPlanLiDARJson: (rawJson: string) => { ok: boolean; summary: string };
  isInspectorOpen?: boolean;
  isShowroom: boolean;
  kitchenIslandOpen: boolean;
  loadDoorSystemsShowcase: (mode: DoorShowcaseMode) => void;
  mepModalOpen: boolean;
  newStdCategory: React.ComponentProps<typeof RulesStandardsModalType>["newStdCategory"];
  newStdMetric: CustomStandardMetric;
  newStdName: string;
  newStdRef: string;
  newStdSeverity: CustomStandardRule["severity"];
  newStdThreshold: number;
  pricing: PricingBreakdown;
  productionSheetModalOpen: boolean;
  project: DesignProject;
  projectModalOpen: boolean;
  quoteModalOpen: boolean;
  regionalErgonomicProfiles: React.ComponentProps<typeof RulesStandardsModalType>["regionalErgonomicProfiles"];
  removeSceneObject: (id: string) => void;
  rulesTab: React.ComponentProps<typeof RulesStandardsModalType>["rulesModalTab"];
  runAutoFillersAndCrown: () => { count: number; notes: string[] };
  runAutoNotchObstacles: () => { count: number; notes: string[] };
  saasModalOpen: boolean;
  saveActiveModuleAsCustomTemplate: (name: string, familyId: ModuleFamilyId) => string;
  sceneHubTab: "modules" | "capsule_curved" | "custom_glb" | "automation" | "appliances" | "furniture" | null;
  selectedSceneObjectId: string | null;
  setArModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAssemblyModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBayV4DoorConfig: (bayIdx: number, updates: Record<string, unknown>) => void;
  setBomModalTab: React.Dispatch<
    React.SetStateAction<"cutlist" | "nesting" | "cnc_mpr_cix" | "blum_bxf" | null>
  >;
  setCatalogBump: React.Dispatch<React.SetStateAction<number>>;
  setCommandSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCustomHardwareOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCustomStdRules: React.Dispatch<React.SetStateAction<CustomStandardRule[]>>;
  setCutoutModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDoorShowcaseOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setErgonomicProfileId: React.ComponentProps<typeof RulesStandardsModalType>["setErgonomicProfileId"];
  setHangingRailProfile: (
    bayIdx: number,
    railId: string,
    profileType: HangingRailConfig["profileType"]
  ) => void;
  setHardwareSwapTarget: React.Dispatch<React.SetStateAction<HardwareSwapTarget | null>>;
  setKitchenIslandOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMepModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setModuleUtilityCutouts: React.ComponentProps<typeof PanelCutoutModalType>["onChangeCutouts"];
  setNewStdCategory: React.ComponentProps<typeof RulesStandardsModalType>["setNewStdCategory"];
  setNewStdMetric: React.Dispatch<React.SetStateAction<CustomStandardMetric>>;
  setNewStdName: React.Dispatch<React.SetStateAction<string>>;
  setNewStdRef: React.Dispatch<React.SetStateAction<string>>;
  setNewStdSeverity: React.Dispatch<React.SetStateAction<CustomStandardRule["severity"]>>;
  setNewStdThreshold: React.Dispatch<React.SetStateAction<number>>;
  setProductionSheetModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProjectModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setQuoteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRulesTab: React.ComponentProps<typeof RulesStandardsModalType>["setRulesModalTab"];
  setSaasModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSceneHubTab: React.Dispatch<
    React.SetStateAction<
      "modules" | "capsule_curved" | "custom_glb" | "automation" | "appliances" | "furniture" | null
    >
  >;
  setSelectedSceneObjectId: (id: string | null) => void;
  setStandardsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setStoreErpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setStudioRenderOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setWizardModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showToast: (msg: string) => void;
  spaceObstacles: ArchitecturalElement[];
  spaceWalls: WallDefinition[];
  standardsModalOpen: boolean;
  storeErpOpen: boolean;
  studioRenderOpen: boolean;
  updateBayDrawerConfig: (bayIdx: number, drawerId: string, patch: Partial<DrawerConfig>) => void;
  updateSceneObject: (id: string, patch: Partial<SceneObjectInstance>) => void;
  wizardModalOpen: boolean;
  workspaceMode: V11WorkspaceMode;
}

export const StudioModalsLayer: React.FC<StudioModalsLayerProps> = (props) => {
  const { ArRoomPreviewModal, AssemblyDiagramModal, BomModal, CommandSearchModal, CustomHardwareModal, DoorSystemsShowcaseModal, GuidedSetupModal, KitchenIslandTableModal, MepCoordinationModal, PanelCutoutModal, ProductionSheetStudioModal, QuoteSummaryModal, RulesStandardsModal, SaasTenantStudioModal, SceneObjectAndModuleHubModal, StoreErpModal, StudioRenderModal, V3ProjectModal, activeBayIndex, activeModule, activeModuleIndex, activeTenantId, addCompositeAssemblyPreset, addCustomCapsuleModule, addCustomSceneObject, addKitchenIslandUnit, addOrUpdateAttachedTable, addSceneObjectFromCatalog, allFindings, allMaterials, appendModuleWithMultiWallSnap, applyApprovedEngineeringFix, applyGuidedWizardLayout, arExportParts, arModalOpen, assemblyModalOpen, autoResolveCornerCollisions, blockingCount, bom, bomModalTab, commandActions, commandSearchOpen, copyDoorConfigToAllBays, customHardwareOpen, customStdRules, cutoutModalOpen, deleteCustomModuleTemplate, displayUnit, doorShowcaseOpen, duplicateSceneObject, ergonomicProfileId, fillWallGapWithParametricModule, hardwareSwapTarget, importRoomPlanLiDARJson, isInspectorOpen = true, isShowroom, kitchenIslandOpen, loadDoorSystemsShowcase, mepModalOpen, newStdCategory, newStdMetric, newStdName, newStdRef, newStdSeverity, newStdThreshold, pricing, productionSheetModalOpen, project, projectModalOpen, quoteModalOpen, regionalErgonomicProfiles, removeSceneObject, rulesTab, runAutoFillersAndCrown, runAutoNotchObstacles, saasModalOpen, saveActiveModuleAsCustomTemplate, sceneHubTab, selectedSceneObjectId, setArModalOpen, setAssemblyModalOpen, setBayV4DoorConfig, setBomModalTab, setCatalogBump, setCommandSearchOpen, setCustomHardwareOpen, setCustomStdRules, setCutoutModalOpen, setDoorShowcaseOpen, setErgonomicProfileId, setHangingRailProfile, setHardwareSwapTarget, setKitchenIslandOpen, setMepModalOpen, setModuleUtilityCutouts, setNewStdCategory, setNewStdMetric, setNewStdName, setNewStdRef, setNewStdSeverity, setNewStdThreshold, setProductionSheetModalOpen, setProjectModalOpen, setQuoteModalOpen, setRulesTab, setSaasModalOpen, setSceneHubTab, setSelectedSceneObjectId, setStandardsModalOpen, setStoreErpOpen, setStudioRenderOpen, setWizardModalOpen, showToast, spaceObstacles, spaceWalls, standardsModalOpen, storeErpOpen, studioRenderOpen, updateBayDrawerConfig, updateSceneObject, wizardModalOpen, workspaceMode } = props;
  return (
    <>
      <AnimatedModalPresence isOpen={projectModalOpen}>
        {(renderOpen) => (
          <V3ProjectModal isOpen={renderOpen} onClose={() => setProjectModalOpen(false)} />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={wizardModalOpen}>
        {(renderOpen) => (
          <GuidedSetupModal
            isOpen={renderOpen}
            project={project}
            materials={allMaterials}
            onClose={() => setWizardModalOpen(false)}
            onApply={(wiz) => {
              applyGuidedWizardLayout(wiz);
              showToast("Endüstriyel standartlara uygun yerleşim oluşturuldu.");
            }}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={quoteModalOpen}>
        {(renderOpen) => (
          <QuoteSummaryModal
            isOpen={renderOpen}
            project={project}
            materials={allMaterials}
            pricing={pricing}
            onClose={() => setQuoteModalOpen(false)}
            onOpenBomModal={(tab) => setBomModalTab(tab || "cutlist")}
            onOpenStoreErpModal={() => setStoreErpOpen(true)}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedValuePresence value={bomModalTab}>
        {(latchedBomTab) => (
          <BomModal
            isOpen={true}
            initialTab={latchedBomTab}
            onClose={() => setBomModalTab(null)}
          />
        )}
      </AnimatedValuePresence>

      <AnimatedModalPresence isOpen={storeErpOpen}>
        {(renderOpen) => (
          <StoreErpModal isOpen={renderOpen} onClose={() => setStoreErpOpen(false)} />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={assemblyModalOpen}>
        {(renderOpen) => (
          <AssemblyDiagramModal
            isOpen={renderOpen}
            project={project}
            bom={bom}
            activeModuleIndex={activeModuleIndex}
            onClose={() => setAssemblyModalOpen(false)}
          />
        )}
      </AnimatedModalPresence>

      <ProductionSheetStudioModal
        open={productionSheetModalOpen}
        onClose={() => setProductionSheetModalOpen(false)}
        project={project}
        bom={bom}
        spaceWalls={spaceWalls}
        spaceObstacles={spaceObstacles}
        initialUnit={displayUnit}
        onOpenBomModal={(tab) => setBomModalTab(tab || "cutlist")}
      />

      <AnimatedModalPresence isOpen={studioRenderOpen}>
        {(renderOpen) => (
          <StudioRenderModal
            isOpen={renderOpen}
            projectId={project.id}
            projectTitle={project.title}
            onClose={() => setStudioRenderOpen(false)}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={arModalOpen}>
        {(renderOpen) => (
          <ArRoomPreviewModal
            isOpen={renderOpen}
            onClose={() => setArModalOpen(false)}
            project={project}
            materials={allMaterials}
            parts={arExportParts}
            clientTotalEur={pricing?.totalWithVatEur || 0}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={standardsModalOpen}>
        {(renderOpen) => (
          <RulesStandardsModal
            isOpen={renderOpen}
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
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={saasModalOpen}>
        {(renderOpen) => (
          <SaasTenantStudioModal
            isOpen={renderOpen}
            onClose={() => setSaasModalOpen(false)}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={commandSearchOpen}>
        {(renderOpen) => (
          <CommandSearchModal
            isOpen={renderOpen}
            actions={commandActions}
            onClose={() => setCommandSearchOpen(false)}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={kitchenIslandOpen}>
        {(renderOpen) => (
          <KitchenIslandTableModal
            isOpen={renderOpen}
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
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={customHardwareOpen}>
        {(renderOpen) => (
          <CustomHardwareModal
            isOpen={renderOpen}
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
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={mepModalOpen}>
        {(renderOpen) => (
          <MepCoordinationModal
            isOpen={renderOpen}
            project={project}
            onClose={() => setMepModalOpen(false)}
          />
        )}
      </AnimatedModalPresence>

      <AnimatedModalPresence isOpen={Boolean(cutoutModalOpen && activeModule)}>
        {(renderOpen) =>
          activeModule ? (
            <PanelCutoutModal
              isOpen={renderOpen}
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
          ) : null
        }
      </AnimatedModalPresence>

      <AnimatedValuePresence value={sceneHubTab}>
        {(latchedHubTab) => (
          <SceneObjectAndModuleHubModal
            isOpen={true}
            initialTab={latchedHubTab}
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
      </AnimatedValuePresence>
      {workspaceMode === "3d" && !isShowroom && activeModule && hardwareSwapTarget && (
        <HardwareQuickSwapPopover
          target={hardwareSwapTarget}
          activeModule={activeModule}
          isInspectorOpen={isInspectorOpen}
          onApplyDoorHardware={(bayIndices, patch, msg) => {
            bayIndices.forEach((bIdx) => {
              setBayV4DoorConfig(bIdx, patch);
            });
            showToast(msg);
          }}
          onApplyDrawerHardware={(bayIndices, patch, msg) => {
            bayIndices.forEach((bIdx) => {
              const drws = activeModule.bays[bIdx]?.drawers || [];
              drws.forEach((d) => {
                updateBayDrawerConfig(bIdx, d.id, patch);
              });
            });
            showToast(msg);
          }}
          onApplyRailProfile={(bayIndices, profileType, msg) => {
            bayIndices.forEach((bIdx) => {
              const rails = activeModule.bays[bIdx]?.hangingRails || [];
              rails.forEach((r) => {
                setHangingRailProfile(bIdx, r.id, profileType);
              });
            });
            showToast(msg);
          }}
          onClose={() => setHardwareSwapTarget(null)}
        />
      )}
      <AnimatedModalPresence isOpen={doorShowcaseOpen}>
        {(renderOpen) => (
          <DoorSystemsShowcaseModal
            isOpen={renderOpen}
            onClose={() => setDoorShowcaseOpen(false)}
            onLoad3DShowcase={(mode) => {
              loadDoorSystemsShowcase(mode);
              showToast(
                mode === "kitchen_opening_systems"
                  ? "15 paralel mutfak kapak & açılım örneği 3B sahneye dizildi."
                  : "9 paralel kapak modeli & kesit örneği 3B sahneye dizildi."
              );
            }}
          />
        )}
      </AnimatedModalPresence>
    </>
  );
};
