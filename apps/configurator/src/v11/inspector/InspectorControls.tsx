"use client";
import React, { useState, useEffect, useRef } from "react";

import { ChevronDown, Check } from "lucide-react";

export const StudioToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  size?: "sm" | "md";
  testId?: string;
  title?: string;
}> = ({ checked, onChange, label, size = "md", testId, title }) => {
  const isSm = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      title={title}
      onClick={() => onChange(!checked)}
      className="birim-switch-wrapper inline-flex items-center gap-2 shrink-0 select-none cursor-pointer group bg-transparent border-0 p-0"
    >
      {label && (
        <span className="birim-switch-label text-[11px] font-semibold text-slate-200 group-hover:text-white bg-transparent">
          {label}
        </span>
      )}
      <span
        className={`birim-switch-track relative inline-flex items-center rounded-full border transition-colors duration-200 ${
          isSm ? "w-8 h-[18px] p-[1.5px]" : "w-10 h-[22px] p-[2px]"
        } ${
          checked
            ? "bg-gradient-to-br from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] border-[#7DD3FC]/60"
            : "bg-slate-600/80 border-white/25 group-hover:bg-slate-500/85"
        }`}
      >
        <span
          className={`birim-switch-knob rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isSm ? "w-3.5 h-3.5" : "w-4 h-4"
          } ${
            checked
              ? isSm
                ? "translate-x-[13px]"
                : "translate-x-[18px]"
              : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
};

export interface StudioSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export const StudioSelect: React.FC<{
  value: string | number;
  options: readonly StudioSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  size?: "sm" | "md";
  className?: string;
}> = ({ value, options, onChange, ariaLabel, size = "md", className = "" }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const strVal = String(value);
  const selected = options.find((o) => o.value === strVal) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isSm = size === "sm";
  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between rounded-xl border transition cursor-pointer text-left ${
          isSm ? "h-8 px-2 gap-1 text-[11px]" : "h-9 px-2.5 gap-1.5 text-xs"
        } font-semibold ${
          open
            ? "bg-white border-[#141413] text-[#141413] shadow-[0_0_0_2px_rgba(20,20,19,0.08)]"
            : "bg-[#FAF8F4] hover:bg-[#F3EFE6] border-[#DED8CC] text-[#141413]"
        }`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {selected?.icon}
          <span className="truncate">{selected?.label ?? strVal}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-[#78716C] transition-transform duration-150 ${
            open ? "rotate-180 text-[#141413]" : ""
          }`}
        />
      </button>
      {open && (
        <div className="absolute left-0 min-w-full w-max max-w-[260px] mt-1.5 z-50 rounded-2xl bg-white/98 backdrop-blur-xl border border-[#DFD9CE] shadow-[0_16px_40px_rgba(20,20,19,0.16)] p-1 max-h-56 overflow-y-auto">
          {options.map((opt) => {
            const isSel = opt.value === strVal;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                  isSel
                    ? "bg-[#141413] text-white"
                    : "text-[#141413] hover:bg-[#F5F2EA]"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </span>
                {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
