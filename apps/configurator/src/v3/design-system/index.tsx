"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, AlertCircle, Info, Sparkles } from "lucide-react";

// ---------------------------------------------------------------------------
// 1. DESIGN SYSTEM TOKENS (Warm, Bright, High-Readability Architectural Light Theme)
// ---------------------------------------------------------------------------
export const V3_TOKENS = {
  colors: {
    canvasWarm: "#F7F6F2",
    surfacePrimary: "#FFFFFF",
    surfaceSecondary: "#F8F7F4",
    surfaceMuted: "#F1EFEA",
    borderSubtle: "#E4E2DA",
    borderFocus: "#D97706",
    textPrimary: "#18181B",
    textSecondary: "#3F3F46",
    textMuted: "#71717A",
    accentPrimary: "#D97706",
    accentHover: "#B45309",
    accentSoft: "#FFFBEB",
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
// 2. OFFICIAL BİRİM® BRAND LOGO (Authentic B1R1M® Geometric Wordmark from birim-store)
// ---------------------------------------------------------------------------
export const V3BrandBadge: React.FC<{ subtitle?: string; dark?: boolean }> = ({
  subtitle = "V4.1",
  dark = false,
}) => (
  <div className="flex items-center gap-2.5 select-none">
    <div className="flex items-center gap-2">
      {/* Authentic Official BİRİM® Geometric Wordmark (Angled Bevels + Split '1' Stems) */}
      <svg
        viewBox="0 0 236 46"
        className={`h-6 w-auto shrink-0 ${dark ? "text-white" : "text-stone-950"}`}
        aria-label="BİRİM Logo"
        role="img"
      >
        {/* B: Angled top-left chamfer + bold double-counter geometric block */}
        <path
          fill="currentColor"
          d="M2 14 L15 5 H46 C54 5 59 9 59 15 C59 19 56 22 51 23.5 C57 25 60 28.5 60 34 C60 40.5 54.5 44 46 44 H2 Z M16 14 V20 H41 C43.5 20 45 18.8 45 17 C45 15.2 43.5 14 41 14 Z M16 28 V35 H42 C44.5 35 46 33.6 46 31.5 C46 29.4 44.5 28 42 28 Z"
        />
        {/* 1st I ('1' shape with angled top bevel & horizontal split notch on left) */}
        <path
          fill="currentColor"
          d="M65 14 L79 5 V44 H65 V27 H73 V22.5 H65 Z"
        />
        {/* R: Angled top-left chamfer + wide geometric loop + bold vertical/angled leg */}
        <path
          fill="currentColor"
          d="M84 14 L98 5 H129 C137.5 5 143 9.5 143 16.5 C143 22 139.5 25.5 133.5 27 C138.5 28.2 141.5 31.5 142.5 37 L143.5 44 H128.5 L127.5 36.5 C126.8 32.5 124.5 31 119.5 31 H99 V44 H84 Z M99 14 V22 H123.5 C126.5 22 128.5 20.3 128.5 18 C128.5 15.7 126.5 14 123.5 14 Z"
        />
        {/* 2nd I ('1' shape with angled top bevel & horizontal split notch on left) */}
        <path
          fill="currentColor"
          d="M148 14 L162 5 V44 H148 V27 H156 V22.5 H148 Z"
        />
        {/* M: Angled top-left chamfer + deep center V-chevron + bold right pillar */}
        <path
          fill="currentColor"
          d="M167 14 L181 5 H188 L201.5 25 L215 5 H229 V44 H215 V22 L201.5 41 H199.5 L181 22 V44 H167 Z"
        />
        {/* Registered Trademark ® */}
        <circle cx="230" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <text
          x="230"
          y="9.2"
          textAnchor="middle"
          fill="currentColor"
          fontSize="6.2"
          fontWeight="800"
          fontFamily="sans-serif"
        >
          R
        </text>
      </svg>

      <span
        className={`text-[11px] px-2 py-0.5 rounded-md font-mono font-bold border ${
          dark
            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
            : "bg-amber-100 text-amber-900 border-amber-300"
        }`}
      >
        {subtitle}
      </span>
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
          : "bg-stone-100 border-stone-300 text-stone-800"
      }`}
    >
      {routes.map((r) => {
        const active = pathname === r.href;
        return (
          <Link
            key={r.href}
            href={r.href}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              active
                ? "bg-amber-600 text-white shadow-sm"
                : dark
                ? "text-stone-300 hover:text-white"
                : "text-stone-700 hover:text-stone-950"
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
// 4. BUTTONS (Touch-friendly, High-Contrast Light Architectural Style)
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
      ? "min-h-[44px] px-4 py-2.5 text-xs font-bold rounded-xl"
      : size === "sm"
      ? "min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-lg"
      : "min-h-[38px] px-3.5 py-2 text-xs font-bold rounded-xl";

  const variantCls = active
    ? "bg-amber-600 text-white border border-amber-700 shadow-sm"
    : variant === "primary"
    ? "bg-stone-900 hover:bg-stone-800 text-white border border-stone-950 shadow-sm"
    : variant === "outline"
    ? "bg-white hover:bg-stone-100 text-stone-900 border border-stone-300 shadow-2xs"
    : variant === "danger"
    ? "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
    : variant === "ghost"
    ? "bg-transparent hover:bg-stone-200/70 text-stone-800"
    : "bg-stone-100 hover:bg-stone-200 text-stone-900 border border-stone-300";

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
// 5. DIMENSION INPUT WITH TOUCH STEPPERS & QUICK PRESETS (Readable Light Card)
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
    <div className="p-3 rounded-xl bg-[#F8F7F4] border border-stone-200/90 space-y-2.5 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 font-mono text-xs font-extrabold flex items-center justify-center">
            {code}
          </span>
          <span className="text-xs font-bold text-stone-900">{label}</span>
        </div>

        {/* Touch Stepper + Direct Input */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid={`${testIdPrefix}-minus`}
            onClick={() => onChange(clamp(value - step))}
            className="w-8 h-8 rounded-lg bg-white hover:bg-amber-50 border border-stone-300 text-stone-900 font-extrabold text-base flex items-center justify-center transition cursor-pointer shadow-2xs"
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
              className="w-20 h-8 px-2 bg-white border border-stone-300 rounded-lg text-center font-mono text-xs font-extrabold text-stone-950 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <button
            type="button"
            data-testid={`${testIdPrefix}-plus`}
            onClick={() => onChange(clamp(value + step))}
            className="w-8 h-8 rounded-lg bg-white hover:bg-amber-50 border border-stone-300 text-stone-900 font-extrabold text-base flex items-center justify-center transition cursor-pointer shadow-2xs"
            title={`+${step} mm`}
          >
            +
          </button>
          <span className="text-[11px] font-mono font-semibold text-stone-600 ml-0.5">mm</span>
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
              className={`flex-1 min-w-[46px] py-1.5 px-2 rounded-lg font-mono text-[11px] font-bold transition cursor-pointer ${
                isSelected
                  ? "bg-amber-600 text-white border border-amber-700 shadow-xs"
                  : "bg-white hover:bg-stone-100 text-stone-700 hover:text-stone-950 border border-stone-200"
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
        className="w-full accent-amber-600 h-2 bg-stone-200 rounded-lg cursor-pointer"
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 6. MATERIAL SWATCH CARD (High-Contrast Light Card)
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
  category,
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
        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
          selected
            ? "bg-amber-50 border-amber-600 text-stone-950 ring-2 ring-amber-500/20"
            : "bg-white hover:bg-stone-50 border-stone-200 text-stone-800"
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
                  ? "text-stone-950"
                  : "text-white"
              }`}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-stone-900 truncate">{name}</div>
          <div className="text-[11px] font-mono text-stone-600">€{costPerM2}/m²</div>
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
          ? "bg-amber-50/95 border-amber-600 text-stone-950 ring-2 ring-amber-500/20 shadow-xs"
          : "bg-white hover:bg-stone-50 border-stone-200/90 text-stone-800"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="w-8 h-8 rounded-lg border border-stone-300 shadow-inner shrink-0 flex items-center justify-center"
          style={{ backgroundColor: colorHex }}
        >
          {selected && (
            <Check
              className={`w-4 h-4 ${
                colorHex.toLowerCase() === "#f3f4f6" || colorHex.toLowerCase() === "#ede8d0"
                  ? "text-stone-950"
                  : "text-white"
              }`}
            />
          )}
        </span>
        <div className="truncate">
          <div className="text-xs font-bold text-stone-900 truncate">{name}</div>
          <div className="text-[11px] text-stone-600 truncate">
            {category || "18mm Kalibrasyonlu Plaka"}
          </div>
        </div>
      </div>
      <span className="font-mono text-xs font-extrabold text-amber-800 shrink-0 ml-2">
        €{costPerM2}
      </span>
    </button>
  );
};

// ---------------------------------------------------------------------------
// 7. COLLAPSIBLE ACCORDION SECTION (Bright, Hierarchical Light Card)
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
    <div className="border border-stone-200/95 rounded-2xl bg-white overflow-hidden shadow-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between bg-[#F4F2EC] hover:bg-[#EBE8DF] transition cursor-pointer"
      >
        <span className="text-xs font-extrabold uppercase tracking-wide text-stone-900">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-lg bg-white text-amber-900 border border-stone-300 shadow-2xs">
              {badge}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-stone-700 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      {open && <div className="p-3.5 space-y-3 border-t border-stone-200/80">{children}</div>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 8. STATUS & VALIDATION BANNER (High-Contrast Light Banner)
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
      ? "bg-amber-50 border-amber-300 text-amber-950"
      : type === "success"
      ? "bg-emerald-50 border-emerald-300 text-emerald-950"
      : "bg-stone-100 border-stone-300 text-stone-900";

  return (
    <div className={`p-3 rounded-xl border text-xs space-y-2 ${styles}`}>
      <div className="flex items-start gap-2">
        {type === "warning" ? (
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        ) : type === "success" ? (
          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        ) : (
          <Info className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
        )}
        <div className="space-y-0.5 flex-1">
          <div className="font-bold">{title}</div>
          <p className="text-[11px] leading-relaxed">{message}</p>
        </div>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
