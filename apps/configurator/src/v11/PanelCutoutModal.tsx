"use client";

import React, { useMemo } from "react";
import { X, Scissors } from "lucide-react";
import type { ArchitecturalElement, ModuleInstance, PanelCutoutConfig } from "@birim/core";
import {
  mapCutPieceToCncPieceInput,
  type ManufacturingBOM,
} from "@birim/manufacturing";
import { PanelCutoutInspector } from "../v3/components/workspace/PanelCutoutInspector";

export interface PanelCutoutModalProps {
  isOpen: boolean;
  activeModule: ModuleInstance;
  allModules: ModuleInstance[];
  roomObstacles: ArchitecturalElement[];
  bom: ManufacturingBOM;
  canExportProduction: boolean;
  onChangeCutouts: (nextCutouts: PanelCutoutConfig[]) => void;
  onAutoResolveCornerCollisions: () => void;
  onClose: () => void;
}

export const PanelCutoutModal: React.FC<PanelCutoutModalProps> = React.memo(
  ({
    isOpen,
    activeModule,
    allModules,
    roomObstacles,
    bom,
    canExportProduction,
    onChangeCutouts,
    onAutoResolveCornerCollisions,
    onClose,
  }) => {
    const mappedObstacles = useMemo(
      () =>
        (roomObstacles || []).map((o) => ({
          id: o.id,
          type: o.type,
          name: o.name || o.type,
          position: {
            x: o.position?.x ?? 0,
            y: o.position?.y ?? 0,
            z: o.position?.z ?? 0,
          },
          dimensions: {
            width: o.dimensions?.width ?? 300,
            height: o.dimensions?.height ?? 300,
            depth: o.dimensions?.depth ?? 150,
          },
        })),
      [roomObstacles]
    );

    const cncPieces = useMemo(
      () => (bom?.cutList || []).map((cp) => mapCutPieceToCncPieceInput(cp)),
      [bom]
    );

    if (!isOpen) return null;

    return (
      <div
        data-testid="v11-panel-cutout-modal"
        className="fixed inset-0 z-[154] bg-[#141413]/50 backdrop-blur-xs flex items-center justify-center p-0 md:p-5"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[90dvh] flex flex-col birim-ice-modal rounded-[28px] max-md:rounded-none max-md:h-[100dvh] max-md:max-h-[100dvh] overflow-hidden text-[#141413]"
        >
          <div className="px-6 py-4 birim-ice-shell-header flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-2xl bg-[#141413] text-[#D6C7B2] flex items-center justify-center">
                <Scissors className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold">
                  Panel Kertme, Priz / Su Borusu Kesimi ve Köşe Çakışma Çözücü
                </h2>
                <p className="text-[11px] text-[#78716C]">
                  {activeModule.name} üzerinde elektrik prizi, tesisat borusu ve kolon kertmeleri
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-[#EFECE4] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 max-h-[75dvh] overflow-y-auto">
            <PanelCutoutInspector
              activeModule={activeModule as any}
              allModules={allModules as any}
              roomObstacles={mappedObstacles}
              bomCutPieces={cncPieces}
              canExportProduction={canExportProduction}
              onChangeCutouts={onChangeCutouts}
              onAutoResolveCornerCollisions={onAutoResolveCornerCollisions}
            />
          </div>
        </div>
      </div>
    );
  }
);

PanelCutoutModal.displayName = "PanelCutoutModal";
