"use client";

import React, { useEffect, useRef } from "react";

export interface CadContextMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface CadContextMenuSection {
  title?: string;
  items: CadContextMenuItem[];
}

export interface CadContextMenuState {
  x: number;
  y: number;
  headerTitle: string;
  headerSubtitle?: string;
  sections: CadContextMenuSection[];
}

interface CadContextMenu2DProps {
  menu: CadContextMenuState | null;
  onClose: () => void;
}

export const CadContextMenu2D: React.FC<CadContextMenu2DProps> = ({ menu, onClose }) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const estW = 248;
  const estH = 380;
  const left = Math.max(12, Math.min(menu.x, vw - estW - 12));
  const top = Math.max(12, Math.min(menu.y, vh - estH - 12));

  return (
    <div
      ref={menuRef}
      data-testid="cad-2d-context-menu"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 w-[248px] max-h-[75vh] overflow-y-auto rounded-2xl bg-[#FAF8F4]/98 backdrop-blur-2xl border border-[#DFD9CE] shadow-[0_20px_50px_rgba(20,20,19,0.18)] p-1.5 text-xs text-[#141413] select-none"
    >
      <div className="px-2.5 py-1.5 border-b border-[#E6E1D6] mb-1">
        <div className="font-bold text-[12px] text-[#141413] truncate">{menu.headerTitle}</div>
        {menu.headerSubtitle && (
          <div className="text-[10.5px] font-mono text-[#78716C] truncate">
            {menu.headerSubtitle}
          </div>
        )}
      </div>

      {menu.sections.map((sec, sIdx) => (
        <div key={`sec_${sIdx}`} className={sIdx > 0 ? "mt-1 pt-1 border-t border-[#E6E1D6]" : ""}>
          {sec.title && (
            <div className="px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wider text-[#8C7A6B]">
              {sec.title}
            </div>
          )}
          {sec.items.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                item.onClick();
                onClose();
              }}
              className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-left text-[11.5px] font-medium transition ${
                item.disabled
                  ? "opacity-40 cursor-not-allowed text-[#78716C]"
                  : item.danger
                  ? "text-red-700 hover:bg-red-50 cursor-pointer"
                  : "text-[#1C1917] hover:bg-[#EFECE4] cursor-pointer"
              }`}
            >
              <span className="truncate">{item.label}</span>
              {item.shortcut && (
                <span className="text-[10px] font-mono text-[#8C7A6B] shrink-0">
                  {item.shortcut}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};
