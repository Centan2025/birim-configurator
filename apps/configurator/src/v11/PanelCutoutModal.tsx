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
          name: o.label || (o as any).name || o.type,
          position: {
            x: o.x ?? (o as any).position?.x ?? 0,
            y: o.y ?? (o as any).position?.y ?? 0,
            z: (o as any).position?.z ?? 0,
          },
          dimensions: {
            width: o.width ?? (o as any).dimensions?.width ?? 300,
            height: o.height ?? (o as any).dimensions?.height ?? 300,
            depth: o.depth ?? (o as any).dimensions?.depth ?? 150,
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
        className="fixed inset-0 z-50 bg-[#141413]/45 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl rounded-3xl bg-[#FAF8F4] border border-[#DFD9CE] shadow-[0_28px_80px_rgba(20,20,19,0.25)] overflow-hidden text-[#141413]"
        >
          <div className="px-6 py-4 border-b border-[#E6E1D6] flex items-center justify-between">
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

          <div className="p-5 max-h-[75vh] overflow-y-auto">
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
