"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, AlertCircle, Info, Sparkles } from "lucide-react";

// ---------------------------------------------------------------------------
// 1. DESIGN SYSTEM TOKENS
// ---------------------------------------------------------------------------
export const V3_TOKENS = {
  colors: {
    canvasWarm: "#F7F6F2",
    surfacePrimary: "#FFFFFF",
    surfaceSecondary: "#F3F2EE",
    surfaceMuted: "#EAE8E1",
    borderSubtle: "#E4E2DA",
    borderFocus: "#C27838",
    textPrimary: "#18181B",
    textSecondary: "#52525B",
    textMuted: "#71717A",
    accentPrimary: "#B86B2B", // Warm Architectural Bronze / Terracotta
    accentHover: "#9E581F",
    accentSoft: "#FDF6EF",
    statusSuccess: "#15803D",
    statusWarning: "#B45309",
    statusError: "#B91C1C",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
  },
  touchTargetMin: "44px",
} as const;

// ---------------------------------------------------------------------------
// 2. BRAND HEADER LOGO (Preserves authentic Birim 'B' Emblem)
// ---------------------------------------------------------------------------
export const V3BrandBadge: React.FC<{ subtitle?: string; dark?: boolean }> = ({
  subtitle = "V3.0",
  dark = false,
}) => (
  <div className="flex items-center gap-2.5 select-none">
    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center font-black text-slate-950 text-base shadow-sm shrink-0">
      B
    </div>
    <div className="leading-tight">
      <div className="flex items-center gap-1.5">
        <span
          className={`text-sm font-bold tracking-tight ${
            dark ? "text-white" : "text-stone-900"
          }`}
        >
          BİRİM
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
            dark
              ? "bg-amber-500/20 text-amber-300"
              : "bg-amber-900/10 text-amber-800"
          }`}
        >
          {subtitle}
        </span>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// 3. PROTOTYPE ROUTE SWITCHER PILL (Allows instant switching across V3 routes)
// ---------------------------------------------------------------------------
export const V3PrototypeSwitcher: React.FC<{ dark?: boolean }> = ({ dark = false }) => {
  const pathname = usePathname();
  const routes = [
    { href: "/v3/studio", label: "Studio", desc: "Minimal 3D" },
    { href: "/v3/plan", label: "Plan", desc: "2D CAD & Mekân" },
    { href: "/v3/showroom", label: "Showroom", desc: "Sunum Modu" },
  ];

  return (
    <nav
      aria-label="V3 Prototip Seçici"
      className={`inline-flex items-center p-1 rounded-xl border text-xs ${
        dark
          ? "bg-stone-900/80 border-stone-700/80 text-stone-300 backdrop-blur-md"
          : "bg-stone-200/75 border-stone-300/80 text-stone-700"
      }`}
    >
      {routes.map((r) => {
        const active = pathname === r.href;
        return (
          <Link
            key={r.href}
            href={r.href}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              active
                ? dark
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-white text-stone-900 shadow-sm border border-stone-200/80"
                : dark
                ? "text-stone-400 hover:text-white"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <span>{r.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

// ---------------------------------------------------------------------------
// 4. BUTTONS (Touch-friendly min 40-44px height options)
// ---------------------------------------------------------------------------
interface V3ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "touch";
  active?: boolean;
}

export const V3Button: React.FC<V3ButtonProps> = ({
  variant = "secondary",
  size = "md",
  active = false,
  className = "",
  children,
  ...props
}) => {
  const sizeCls =
    size === "touch"
      ? "min-h-[44px] px-4 py-2.5 text-xs font-semibold rounded-xl"
      : size === "sm"
      ? "min-h-[32px] px-2.5 py-1 text-xs font-medium rounded-lg"
      : "min-h-[38px] px-3.5 py-2 text-xs font-semibold rounded-xl";

  const variantCls = active
    ? "bg-amber-700 text-white border border-amber-800 shadow-sm"
    : variant === "primary"
    ? "bg-stone-900 hover:bg-stone-800 text-white border border-stone-900 shadow-sm"
    : variant === "outline"
    ? "bg-white hover:bg-stone-50 text-stone-800 border border-stone-300"
    : variant === "danger"
    ? "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
    : variant === "ghost"
    ? "bg-transparent hover:bg-stone-200/60 text-stone-700"
    : "bg-stone-100 hover:bg-stone-200/80 text-stone-800 border border-stone-200/80";

  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${sizeCls} ${variantCls} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// ---------------------------------------------------------------------------
// 5. DIMENSION INPUT WITH TOUCH STEPPERS & QUICK PRESETS
// ---------------------------------------------------------------------------
interface V3DimensionControlProps {
  label: string;
  code: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  presets: number[];
  onChange: (val: number) => void;
  testIdPrefix?: string;
}

export const V3DimensionControl: React.FC<V3DimensionControlProps> = ({
  label,
  code,
  value,
  min,
  max,
  step = 50,
  presets,
  onChange,
  testIdPrefix = "dim",
}) => {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  return (
    <div className="p-3 rounded-xl bg-stone-50/90 border border-stone-200/90 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-stone-200/80 text-stone-700 font-mono text-[11px] font-bold flex items-center justify-center">
            {code}
          </span>
          <span className="text-xs font-semibold text-stone-800">{label}</span>
        </div>

        {/* Touch Stepper + Direct Input */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid={`${testIdPrefix}-minus`}
            onClick={() => onChange(clamp(value - step))}
            className="w-8 h-8 rounded-lg bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 font-bold text-sm flex items-center justify-center transition cursor-pointer"
            title={`-${step} mm`}
          >
            −
          </button>
          <div className="relative flex items-center">
            <input
              type="number"
              data-testid={`${testIdPrefix}-input`}
              min={min}
              max={max}
              step={10}
              value={value}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                if (!Number.isNaN(parsed) && parsed >= min) {
                  onChange(clamp(parsed));
                }
              }}
              className="w-20 h-8 px-2 bg-white border border-stone-300 rounded-lg text-center font-mono text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-700"
            />
          </div>
          <button
            type="button"
            data-testid={`${testIdPrefix}-plus`}
            onClick={() => onChange(clamp(value + step))}
            className="w-8 h-8 rounded-lg bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 font-bold text-sm flex items-center justify-center transition cursor-pointer"
            title={`+${step} mm`}
          >
            +
          </button>
          <span className="text-[11px] font-mono text-stone-500 ml-0.5">mm</span>
        </div>
      </div>

      {/* Preset Pills */}
      <div className="flex items-center gap-1 flex-wrap">
        {presets.map((p) => {
          const isSelected = value === p;
          return (
            <button
              key={p}
              type="button"
              data-testid={`${testIdPrefix}-preset-${p}`}
              onClick={() => onChange(p)}
              className={`flex-1 min-w-[48px] py-1.5 px-2 rounded-lg font-mono text-[11px] font-semibold transition cursor-pointer ${
                isSelected
                  ? "bg-amber-700 text-white shadow-xs"
                  : "bg-white hover:bg-stone-100 text-stone-600 border border-stone-200"
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Smooth Slider */}
      <input
        type="range"
        data-testid={`${testIdPrefix}-slider`}
        min={min}
        max={max}
        step={50}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-700 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 6. MATERIAL SWATCH CARD
// ---------------------------------------------------------------------------
interface V3MaterialSwatchProps {
  id: string;
  name: string;
  colorHex: string;
  costPerM2: number;
  category: string;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
  testId?: string;
}

export const V3MaterialSwatch: React.FC<V3MaterialSwatchProps> = ({
  name,
  colorHex,
  costPerM2,
  selected,
  onSelect,
  compact = false,
  testId,
}) => {
  if (compact) {
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={onSelect}
        className={`flex items-center gap-2 p-2 rounded-xl border text-left transition cursor-pointer ${
          selected
            ? "bg-amber-50/90 border-amber-700 text-stone-900 ring-2 ring-amber-700/20"
            : "bg-white hover:bg-stone-50 border-stone-200 text-stone-700"
        }`}
      >
        <span
          className="w-6 h-6 rounded-full border border-stone-300 shadow-inner shrink-0 flex items-center justify-center"
          style={{ backgroundColor: colorHex }}
        >
          {selected && (
            <Check
              className={`w-3.5 h-3.5 ${
                colorHex.toLowerCase() === "#f3f4f6" || colorHex.toLowerCase() === "#ede8d0"
                  ? "text-stone-900"
                  : "text-white"
              }`}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate">{name}</div>
          <div className="text-[10px] font-mono text-stone-500">€{costPerM2}/m²</div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onSelect}
      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition cursor-pointer ${
        selected
          ? "bg-amber-50/90 border-amber-700 text-stone-900 shadow-xs"
          : "bg-white hover:bg-stone-50 border-stone-200/90 text-stone-700"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="w-7 h-7 rounded-lg border border-stone-300 shadow-inner shrink-0 flex items-center justify-center"
          style={{ backgroundColor: colorHex }}
        >
          {selected && (
            <Check
              className={`w-4 h-4 ${
                colorHex.toLowerCase() === "#f3f4f6" || colorHex.toLowerCase() === "#ede8d0"
                  ? "text-stone-900"
                  : "text-white"
              }`}
            />
          )}
        </span>
        <div className="truncate">
          <div className="text-xs font-semibold text-stone-900 truncate">{name}</div>
          <div className="text-[10px] text-stone-500">18mm Kalibrasyonlu Plaka</div>
        </div>
      </div>
      <span className="font-mono text-xs font-semibold text-stone-600 shrink-0 ml-2">
        €{costPerM2}
      </span>
    </button>
  );
};

// ---------------------------------------------------------------------------
// 7. COLLAPSIBLE ACCORDION SECTION
// ---------------------------------------------------------------------------
interface V3SectionProps {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const V3CollapsibleSection: React.FC<V3SectionProps> = ({
  title,
  badge,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border border-stone-200/90 rounded-2xl bg-white overflow-hidden shadow-2xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between bg-stone-50/60 hover:bg-stone-100/60 transition cursor-pointer"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-stone-200/80 text-stone-700">
              {badge}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-stone-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      {open && <div className="p-3.5 space-y-3 border-t border-stone-100">{children}</div>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 8. STATUS & VALIDATION BANNER
// ---------------------------------------------------------------------------
export const V3AlertBanner: React.FC<{
  type: "warning" | "info" | "success";
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ type, title, message, actionLabel, onAction }) => {
  const styles =
    type === "warning"
      ? "bg-amber-50 border-amber-300 text-amber-900"
      : type === "success"
      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
      : "bg-stone-100 border-stone-300 text-stone-800";

  return (
    <div className={`p-3 rounded-xl border text-xs space-y-2 ${styles}`}>
      <div className="flex items-start gap-2">
        {type === "warning" ? (
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        ) : type === "success" ? (
          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        ) : (
          <Info className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
        )}
        <div className="space-y-0.5 flex-1">
          <div className="font-bold">{title}</div>
          <p className="text-[11px] leading-relaxed opacity-90">{message}</p>
        </div>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="w-full py-1.5 px-3 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs transition cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
