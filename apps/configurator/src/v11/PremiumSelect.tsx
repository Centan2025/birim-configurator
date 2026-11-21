"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface PremiumSelectOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
}

export interface PremiumSelectProps<T extends string = string> {
  value: T;
  options: ReadonlyArray<PremiumSelectOption<T>>;
  onChange: (value: T) => void;
  ariaLabel?: string;
  title?: string;
  direction?: "up" | "down";
  className?: string;
  menuWidthClass?: string;
}

/**
 * Premium frosted-glass dropdown replacing native browser <select> menus,
 * featuring elastic vertical stretch open & close transitions and Backdrop-Root-safe blur.
 */
export function PremiumSelect<T extends string = string>({
  value,
  options,
  onChange,
  ariaLabel,
  title,
  direction = "down",
  className = "",
  menuWidthClass = "min-w-[180px]",
}: PremiumSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [settled, setSettled] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setSettled(false);
      let raf2 = 0;
      let tSettle = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setVisible(true);
          tSettle = window.setTimeout(() => setSettled(true), 240);
        });
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
        if (tSettle) window.clearTimeout(tSettle);
      };
    }
    setSettled(false);
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), 190);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onOutside, { capture: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onOutside, { capture: true });
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeOpt = options.find((o) => o.value === value) || options[0];
  const isUp = direction === "up";
  const originClass = isUp ? "origin-bottom" : "origin-top";
  const posClass = isUp ? "bottom-full mb-2" : "top-full mt-2";

  const animClass =
    visible && settled
      ? ""
      : `${originClass} transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1.15,0.36,1)] ${
          visible
            ? "opacity-100 scale-y-100 scale-x-100 translate-y-0"
            : isUp
            ? "opacity-0 scale-y-[0.72] scale-x-[0.96] translate-y-2 pointer-events-none"
            : "opacity-0 scale-y-[0.72] scale-x-[0.96] -translate-y-2 pointer-events-none"
        }`;

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        title={title}
        onClick={() => setOpen((v) => !v)}
        className={`h-7 pl-3 pr-2 rounded-full bg-white/[0.12] hover:bg-white/[0.20] border transition inline-flex items-center gap-1.5 text-[11px] font-bold text-white cursor-pointer select-none ${
          open ? "border-[#38BDF8]/80 ring-2 ring-[#38BDF8]/25" : "border-white/20"
        }`}
      >
        <span className="truncate max-w-[120px]">{activeOpt?.label || ""}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-200 ${
            open ? "rotate-180 text-[#7DD3FC]" : ""
          }`}
        />
      </button>

      {mounted && (
        <div
          role="menu"
          className={`absolute left-0 ${posClass} z-[160] ${menuWidthClass} max-h-[280px] overflow-y-auto rounded-2xl p-1.5 border border-white/25 shadow-[0_22px_54px_rgba(0,0,0,0.58)] ${animClass}`}
          style={{
            backgroundColor: "rgba(32, 39, 52, 0.78)",
            backdropFilter: "blur(36px) saturate(195%) brightness(1.06)",
            WebkitBackdropFilter: "blur(36px) saturate(195%) brightness(1.06)",
          }}
        >
          {options.map((opt) => {
            const isSel = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                title={opt.hint}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full px-2.5 py-1.5 rounded-xl text-left text-[11.5px] font-semibold flex items-center justify-between gap-2 transition cursor-pointer ${
                  isSel
                    ? "bg-gradient-to-r from-[#0284C7] via-[#1D4ED8] to-[#1E3A8A] text-white shadow-[0_0_12px_rgba(29,78,216,0.45)]"
                    : "text-slate-200 hover:bg-white/12 hover:text-white"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSel && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
