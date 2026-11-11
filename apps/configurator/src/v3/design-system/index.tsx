"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, AlertCircle, Info, Sparkles } from "lucide-react";
import { useConfiguratorStore } from "../../store/useConfiguratorStore";

// ---------------------------------------------------------------------------
// 1. DESIGN SYSTEM TOKENS (Warm Cashmere & Espresso Monochrome Architectural Theme)
// ---------------------------------------------------------------------------
export const V3_TOKENS = {
  colors: {
    canvasWarm: "#F5F3EE",
    surfacePrimary: "#FFFFFF",
    surfaceSecondary: "#FAF9F6",
    surfaceMuted: "#EFECE5",
    borderSubtle: "#E4DFD5",
    borderFocus: "#141413",
    textPrimary: "#141413",
    textSecondary: "#44403C",
    textMuted: "#78716C",
    accentPrimary: "#141413",
    accentHover: "#292524",
    accentSoft: "#F5F3EE",
    accentBronze: "#8C7A6B",
    statusSuccess: "#2E6F40",
    statusWarning: "#8C5A2B",
    statusError: "#9E2A2B",
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
  subtitle = "V4.2",
  dark = false,
}) => (
  <div className="flex items-center gap-2.5 select-none">
    <div className="flex items-center gap-2">
      <svg
        viewBox="0 0 236 46"
        className={`h-6 w-auto shrink-0 ${dark ? "text-white" : "text-[#1C1917]"}`}
        aria-label="BİRİM Logo"
        role="img"
      >
        <path
          fill="currentColor"
          d="M2 14 L15 5 H46 C54 5 59 9 59 15 C59 19 56 22 51 23.5 C57 25 60 28.5 60 34 C60 40.5 54.5 44 46 44 H2 Z M16 14 V20 H41 C43.5 20 45 18.8 45 17 C45 15.2 43.5 14 41 14 Z M16 28 V35 H42 C44.5 35 46 33.6 46 31.5 C46 29.4 44.5 28 42 28 Z"
        />
        <path fill="currentColor" d="M65 14 L79 5 V44 H65 V27 H73 V22.5 H65 Z" />
        <path
          fill="currentColor"
          d="M84 14 L98 5 H129 C137.5 5 143 9.5 143 16.5 C143 22 139.5 25.5 133.5 27 C138.5 28.2 141.5 31.5 142.5 37 L143.5 44 H128.5 L127.5 36.5 C126.8 32.5 124.5 31 119.5 31 H99 V44 H84 Z M99 14 V22 H123.5 C126.5 22 128.5 20.3 128.5 18 C128.5 15.7 126.5 14 123.5 14 Z"
        />
        <path fill="currentColor" d="M148 14 L162 5 V44 H148 V27 H156 V22.5 H148 Z" />
        <path
          fill="currentColor"
          d="M167 14 L181 5 H188 L201.5 25 L215 5 H229 V44 H215 V22 L201.5 41 H199.5 L181 22 V44 H167 Z"
        />
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
        className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold border ${
          dark
            ? "bg-stone-800 text-stone-200 border-stone-700"
            : "bg-[#F1F5F9] text-[#44403C] border-[#CBD5E1]"
        }`}
      >
        {subtitle}
      </span>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// 3. PROTOTYPE ROUTE SWITCHER PILL
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
          : "birim-ice-pill text-[#44403C]"
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
                ? "bg-[#EEF3F8] text-[#1C1917] border border-[#CBD5E1] shadow-xs"
                : dark
                ? "text-stone-300 hover:text-white"
                : "text-[#57534E] hover:text-[#1C1917]"
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
// 4. BUTTONS (Warm Cashmere & Espresso Monochrome Style)
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
      ? "min-h-[42px] px-4 py-2 text-xs font-bold rounded-xl"
      : size === "sm"
      ? "min-h-[32px] px-2.5 py-1 text-xs font-semibold rounded-lg"
      : "min-h-[36px] px-3.5 py-1.5 text-xs font-bold rounded-xl";

  const variantCls = active
    ? "birim-ice-btn-active"
    : variant === "primary"
    ? "birim-ice-btn-active hover:opacity-95"
    : variant === "outline"
    ? "birim-ice-btn text-[#1C1917]"
    : variant === "danger"
    ? "bg-rose-500/15 hover:bg-rose-500/25 backdrop-blur-md text-[#9E2A2B] border border-rose-300/60"
    : variant === "ghost"
    ? "bg-transparent hover:bg-white/55 text-[#44403C]"
    : "birim-ice-btn text-[#1C1917]";

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
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  const [draftText, setDraftText] = React.useState<string>(String(value));
  const [isFocused, setIsFocused] = React.useState<boolean>(false);
  const [rangeHint, setRangeHint] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isFocused) {
      setDraftText(String(value));
    }
  }, [value, isFocused]);

  const commitDraft = (rawStr: string) => {
    const trimmed = rawStr.trim();
    if (!trimmed) {
      setDraftText(String(value));
      setRangeHint(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraftText(String(value));
      setRangeHint(null);
      return;
    }
    if (parsed < min || parsed > max) {
      const clamped = clamp(parsed);
      setRangeHint(`Üretim sınırı ${min}–${max} mm (${clamped} mm uygulandı)`);
      setDraftText(String(clamped));
      onChange(clamped);
      return;
    }
    setRangeHint(null);
    const rounded = clamp(parsed);
    setDraftText(String(rounded));
    onChange(rounded);
  };

  return (
    <div className="p-3 rounded-2xl bg-white/44 backdrop-blur-2xl border border-white/85 shadow-2xs space-y-2.5 transition-colors hover:bg-white/60">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-lg bg-[#F5F3EE] border border-[#DED8CC] text-[#141413] font-mono text-xs font-bold flex items-center justify-center shrink-0">
            {code}
          </span>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-[#141413] block truncate">{label}</span>
            <span className="text-[10px] text-[#78716C] block">
              {(value / 10).toFixed(value % 10 === 0 ? 0 : 1)} cm
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid={`${testIdPrefix}-minus`}
            onClick={() => {
              setRangeHint(null);
              onChange(clamp(value - step));
            }}
            className="w-7 h-7 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] text-[#141413] font-bold text-sm flex items-center justify-center transition cursor-pointer"
            title={`-${step} mm`}
          >
            −
          </button>
          <input
            type="number"
            data-testid={`${testIdPrefix}-input`}
            min={min}
            max={max}
            step={10}
            value={isFocused ? draftText : value}
            onFocus={() => {
              setIsFocused(true);
              setDraftText(String(value));
            }}
            onChange={(e) => {
              const raw = e.target.value;
              setDraftText(raw);
              const parsed = Number(raw);
              if (raw.trim() !== "" && Number.isFinite(parsed)) {
                if (parsed >= min && parsed <= max) {
                  setRangeHint(null);
                  onChange(Math.round(parsed));
                } else {
                  setRangeHint(`Geçerli aralık: ${min} – ${max} mm`);
                }
              }
            }}
            onBlur={(e) => {
              setIsFocused(false);
              commitDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setIsFocused(false);
                setDraftText(String(value));
                setRangeHint(null);
              }
            }}
            className={`w-18 h-7 px-1.5 bg-white border rounded-lg text-center font-mono text-xs font-bold text-[#141413] focus:outline-none ${
              rangeHint
                ? "border-amber-500 ring-1 ring-amber-400/40"
                : "border-[#DED8CC] focus:border-[#141413]"
            }`}
          />
          <button
            type="button"
            data-testid={`${testIdPrefix}-plus`}
            onClick={() => {
              setRangeHint(null);
              onChange(clamp(value + step));
            }}
            className="w-7 h-7 rounded-lg bg-[#FAF9F6] hover:bg-[#EFECE5] border border-[#DED8CC] text-[#141413] font-bold text-sm flex items-center justify-center transition cursor-pointer"
            title={`+${step} mm`}
          >
            +
          </button>
          <span className="text-[10px] font-mono font-medium text-[#78716C]">mm</span>
        </div>
      </div>

      {rangeHint && (
        <div
          role="status"
          className="text-[10px] font-medium text-[#8C5A2B] bg-[#FDF8F2] border border-[#EAD5BE] rounded-lg px-2 py-1"
        >
          {rangeHint}
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {presets.map((p) => {
          const isSelected = value === p;
          return (
            <button
              key={p}
              type="button"
              data-testid={`${testIdPrefix}-preset-${p}`}
              onClick={() => {
                setRangeHint(null);
                onChange(p);
              }}
              className={`flex-1 min-w-[44px] py-1 px-1.5 rounded-lg font-mono text-[10px] font-semibold transition cursor-pointer ${
                isSelected
                  ? "bg-[#141413] text-white border border-[#141413]"
                  : "bg-[#FAF9F6] hover:bg-[#EFECE5] text-[#44403C] border border-[#E4DFD5]"
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      <input
        type="range"
        data-testid={`${testIdPrefix}-slider`}
        min={min}
        max={max}
        step={50}
        value={value}
        onPointerDown={() => {
          useConfiguratorStore.getState().beginHistoryTransaction();
        }}
        onPointerUp={() => {
          useConfiguratorStore.getState().commitHistoryTransaction();
        }}
        onPointerCancel={() => {
          useConfiguratorStore.getState().commitHistoryTransaction();
        }}
        onChange={(e) => {
          setRangeHint(null);
          onChange(Number(e.target.value));
        }}
        className="w-full accent-[#141413] h-1.5 bg-[#E4DFD5] rounded-lg cursor-pointer"
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
        className={`flex items-center gap-2 p-2 rounded-xl border text-left transition cursor-pointer ${
          selected
            ? "bg-[#F8FAFC] border-[#2C2A29] text-[#1C1917] ring-1 ring-[#2C2A29]"
            : "bg-white hover:bg-[#FFFFFF] border-[#E2E8F0] text-[#44403C]"
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
          <div className="text-[13px] font-bold text-[#111827] truncate">{name}</div>
          <div className="text-[10px] font-mono text-[#78716C]">€{costPerM2}/m²</div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onSelect}
      className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition cursor-pointer ${
        selected
          ? "bg-[#F8FAFC] border-[#2C2A29] text-[#1C1917] ring-1 ring-[#2C2A29] shadow-2xs"
          : "bg-white hover:bg-[#FFFFFF] border-[#E2E8F0] text-[#44403C]"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="w-7 h-7 rounded-lg border border-stone-300 shadow-inner shrink-0 flex items-center justify-center"
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
        <div className="truncate">
          <div className="text-[13px] font-bold text-[#111827] truncate">{name}</div>
          <div className="text-xs text-[#475569] truncate">
            {category || "18mm Kalibrasyonlu Plaka"}
          </div>
        </div>
      </div>
      <span className="font-mono text-xs font-bold text-[#44403C] shrink-0 ml-2">
        €{costPerM2}
      </span>
    </button>
  );
};

// ---------------------------------------------------------------------------
// 7. ANIMATED STRETCH-DOWN COLLAPSIBLE ACCORDION SECTION
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
    <div className="border border-[#E2E8F0] rounded-2xl bg-white overflow-hidden shadow-2xs transition-all">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between bg-[#F8FAFC] hover:bg-[#EFECE4] transition cursor-pointer"
      >
        <span className="text-sm font-bold tracking-tight text-[#111827]">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white text-[#44403C] border border-[#CBD5E1]">
              {badge}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-[#57534E] transition-transform duration-300 ease-out ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-3 space-y-2.5 border-t border-[#E2E8F0]">{children}</div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 8. PREMIUM STRETCH-DOWN DROPDOWN MENU (Smooth vertical stretch animation)
// ---------------------------------------------------------------------------
export interface V3PremiumDropdownOption {
  value: string;
  label: string;
  sub?: string;
  subLabel?: string;
  badge?: string;
  colorHex?: string;
  icon?: React.ReactNode;
}

function renderAutoOptionVisual(opt?: V3PremiumDropdownOption) {
  if (!opt) return null;
  if (opt.icon) return <span className="shrink-0 text-[#2563EB]">{opt.icon}</span>;
  const v = (opt.value || "").toLowerCase();
  const lbl = (opt.label || "").toLowerCase();

  // Auto color swatch for materials
  const matColorMap: Record<string, string> = {
    mat_melamine_white: "#F8FAFC",
    mat_melamine_cashmere: "#DFD7CC",
    mat_mdf_anthracite: "#334155",
    mat_wood_natural_oak: "#C8A476",
    mat_wood_smoked_walnut: "#5C4028",
    mat_lacquer_sage: "#849B87",
    mat_lacquer_sand: "#E2D9C8",
    mat_glass_bronze: "#785A46",
    mat_mirror_silver: "#CBD5E1",
    mat_neolith_calacatta_luxe: "#F4F1EA",
  };
  const hex = opt.colorHex || matColorMap[v];
  if (hex || v.startsWith("mat_")) {
    return (
      <span
        className="w-5 h-5 rounded-lg border border-slate-300 shadow-inner shrink-0 inline-block"
        style={{ backgroundColor: hex || "#E2E8F0" }}
      />
    );
  }
  if (v.includes("blum") || lbl.includes("blum")) {
    return (
      <span className="px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200 text-[#FF5500] font-black text-[9px] shrink-0">
        blum
      </span>
    );
  }
  if (v.includes("hafele") || lbl.includes("häfele") || lbl.includes("loox")) {
    return (
      <span className="px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-[#DC2626] font-extrabold text-[9px] shrink-0">
        HÄF
      </span>
    );
  }
  return (
    <span className="w-5 h-5 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M9 12h6" />
      </svg>
    </span>
  );
}

export const V3PremiumDropdown: React.FC<{
  label?: string;
  placeholder?: string;
  value: string;
  options: V3PremiumDropdownOption[];
  onChange: (value: string) => void;
  testId?: string;
}> = ({ label, placeholder, value, options, onChange, testId }) => {
  const [open, setOpen] = React.useState(false);
  const selectedOpt = options.find((o) => o.value === value) || options[0];

  return (
    <div
      data-testid={testId ? `${testId}-wrapper` : undefined}
      className="rounded-2xl border border-white/85 bg-white/55 backdrop-blur-2xl overflow-hidden shadow-xs hover:border-blue-400 transition-all duration-200"
    >
      {/* Hidden native select for automated test compatibility */}
      {testId && (
        <select
          aria-label={label || "Seçim Menüsü"}
          data-testid={testId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        >
          {options.map((o, oIdx) => (
            <option key={`${o.value}_${oIdx}`} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full min-h-[40px] px-3 py-2 flex items-center justify-between gap-2 bg-gradient-to-b from-white to-slate-50/70 hover:from-blue-50/40 hover:to-blue-50/20 text-left transition-all duration-150 cursor-pointer active:scale-[0.99]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {renderAutoOptionVisual(selectedOpt)}
          <div className="min-w-0">
            {label && (
              <span className="text-[11px] font-semibold text-[#475569] block leading-tight mb-0.5">
                {label}
              </span>
            )}
            <span className="text-xs font-extrabold text-[#111827] truncate block">
              {selectedOpt?.label || placeholder || value}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedOpt?.badge && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80">
              {selectedOpt.badge}
            </span>
          )}
          <span className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#334155] transition-transform duration-300 ease-out ${
                open ? "rotate-180 text-blue-600" : ""
              }`}
            />
          </span>
        </div>
      </button>

      {/* Smooth Stretch-Down Options Drawer */}
      <div
        className={`grid transition-[grid-template-rows,opacity,transform] duration-250 ease-out origin-top ${
          open
            ? "grid-rows-[1fr] opacity-100 scale-y-100"
            : "grid-rows-[0fr] opacity-0 scale-y-95 pointer-events-none"
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-1.5 space-y-1 border-t border-slate-200/80 bg-white/95 backdrop-blur-xl max-h-64 overflow-y-auto">
            {options.map((opt, optIdx) => {
              const isSel = opt.value === value;
              const subTxt = opt.sub || opt.subLabel;
              return (
                <button
                  key={`${opt.value}_${optIdx}`}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between gap-2 transition-all duration-150 cursor-pointer ${
                    isSel
                      ? "bg-blue-50/90 text-blue-950 border border-blue-400 shadow-2xs"
                      : "hover:bg-slate-100/80 text-[#111827] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {renderAutoOptionVisual(opt)}
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{opt.label}</div>
                      {subTxt && (
                        <div
                          className={`text-[10px] truncate ${
                            isSel ? "text-blue-700" : "text-[#64748B]"
                          }`}
                        >
                          {subTxt}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.badge && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                          isSel
                            ? "bg-blue-600 text-white font-bold"
                            : "bg-[#F1F5F9] text-[#475569]"
                        }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                    {isSel && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 9. STATUS & VALIDATION BANNER
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
      ? "bg-[#FAF6F0] border-[#E5D5C0] text-[#5C3A1E]"
      : type === "success"
      ? "bg-[#F2F7F4] border-[#C5DDD0] text-[#1E462E]"
      : "bg-[#F8FAFC] border-[#CBD5E1] text-[#2C2A29]";

  return (
    <div className={`p-3 rounded-xl border text-xs space-y-2 ${styles}`}>
      <div className="flex items-start gap-2">
        {type === "warning" ? (
          <AlertCircle className="w-4 h-4 text-[#8C5A2B] shrink-0 mt-0.5" />
        ) : type === "success" ? (
          <Sparkles className="w-4 h-4 text-[#2E6F40] shrink-0 mt-0.5" />
        ) : (
          <Info className="w-4 h-4 text-[#57534E] shrink-0 mt-0.5" />
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
          className="w-full py-1.5 px-3 rounded-lg bg-[#EEF3F8] hover:bg-[#E4ECF4] text-[#1C1917] border border-[#CBD5E1] font-bold text-xs transition cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
