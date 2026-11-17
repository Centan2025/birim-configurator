"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Check,
  Code2,
  Copy,
  Cpu,
  Lock,
  Receipt,
  ShieldCheck,
  Sliders,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  PLAN_ENTITLEMENTS_MATRIX,
  buildTenantEmbedSdkSnippet,
  buildTenantScopedStorageKey,
  checkTenantEntitlement,
  hasTenantPermission,
  type BackPanelMountingMode,
  type CncMachineFormatId,
  type ConnectorSystemType,
  type SaasRoleId,
} from "@birim/core";
import { useConfiguratorStore } from "../../../store/useConfiguratorStore";
import { V3PremiumDropdown } from "../../design-system";
import { BirimLogo } from "../../design-system";

interface SaasTenantStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_OPTIONS: { id: SaasRoleId; label: string; summary: string }[] = [
  { id: "org_owner", label: "Firma Sahibi (Owner)", summary: "Tüm konstrüksiyon, fiyat, CNC, ERP ve abonelik yetkileri açık." },
  { id: "production_lead", label: "Üretim & CAM Müdürü", summary: "BOM, plaka nesting, CNC post-processor ve ERP üretim emri yetkili." },
  { id: "architect", label: "İç Mimar / Tasarımcı", summary: "3B/2B tasarım, özel şablon, BOM ve teklif oluşturma yetkili." },
  { id: "sales_rep", label: "Mağaza Satış Temsilcisi", summary: "Tasarım ve iskontolu müşteri teklifi oluşturur; CNC/maliyet kapalı." },
  { id: "dealer_admin", label: "Bayi Yöneticisi (B2B)", summary: "Bayi iskontolu net alım fiyatını görür ve sipariş onayı gönderir." },
  { id: "readonly_viewer", label: "Salt-Okunur İzleyici", summary: "Yalnızca sahne ve ölçü inceleme yetkisi; düzenleme/ihraç kapalı." },
];

export const SaasTenantStudioModal: React.FC<SaasTenantStudioModalProps> = ({
  isOpen,
  onClose,
}) => {
  const activeTenantProfile = useConfiguratorStore((s) => s.activeTenantProfile);
  const activeTenantRole = useConfiguratorStore((s) => s.activeTenantRole);
  const availableTenants = useConfiguratorStore((s) => s.availableTenants);
  const switchActiveTenant = useConfiguratorStore((s) => s.switchActiveTenant);
  const setActiveTenantRole = useConfiguratorStore((s) => s.setActiveTenantRole);
  const updateActiveTenantProfile = useConfiguratorStore((s) => s.updateActiveTenantProfile);
  const bom = useConfiguratorStore((s) => s.bom);
  const pricing = useConfiguratorStore((s) => s.pricing);

  const [activeTab, setActiveTab] = useState<"tenants" | "construction" | "pricing" | "entitlements">("tenants");
  const [copiedSdk, setCopiedSdk] = useState(false);

  const entitlements = PLAN_ENTITLEMENTS_MATRIX[activeTenantProfile.planId];
  const canManageSettings = hasTenantPermission(activeTenantRole, "tenant:manage_settings");

  const cabineoHoleCount = useMemo(
    () =>
      bom.cutList.reduce(
        (sum, p) =>
          sum + (p.holes || []).filter((h) => h.purpose === "cabineo_pocket").length,
        0
      ),
    [bom.cutList]
  );

  const embedSnippet = useMemo(
    () => buildTenantEmbedSdkSnippet(activeTenantProfile),
    [activeTenantProfile]
  );

  if (!isOpen) return null;

  return (
    <div
      data-testid="saas-tenant-studio-modal"
      className="fixed inset-0 z-[155] bg-[#141413]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] birim-ice-modal rounded-[28px] flex flex-col overflow-hidden text-[#141413]">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-[#EFECE5] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#141413] text-[#FAF9F6] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-[#E5D3B8]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight truncate">Firma Ayarları</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-600/12 text-emerald-800">
                  {entitlements.planNameTr}
                </span>
              </div>
              <p className="text-[11px] text-[#57534E] truncate">
                {activeTenantProfile.brand.legalName} • {activeTenantRole}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/${activeTenantProfile.slug}/admin`}
              className="h-8 px-3 rounded-xl bg-[#FAF9F6] border border-[#DED8CC] hover:bg-[#EFECE5] text-[11px] font-bold inline-flex items-center"
            >
              Firma Admin Paneli
            </Link>
            <Link
              href="/onboarding"
              className="h-8 px-3 rounded-xl bg-[#141413] text-white text-[11px] font-bold hidden sm:inline-flex items-center"
            >
              + Yeni Firma Kur
            </Link>
            <button
              type="button"
              data-testid="close-saas-tenant-studio-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-[#EFECE5] flex items-center justify-center text-[#57534E] hover:text-[#141413] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 pb-2 bg-[#FAF9F6] border-b border-[#EFECE5] flex flex-wrap items-center gap-1.5">
          {[
            { id: "tenants" as const, label: "1. Organizasyon & Rol Geçişi", Icon: Users },
            { id: "construction" as const, label: "2. Konstrüksiyon & CNC Makine", Icon: Cpu },
            { id: "pricing" as const, label: "3. Fiyat, Marj & Bayi Politikası", Icon: Receipt },
            { id: "entitlements" as const, label: "4. Paket Yetkileri & Embed SDK", Icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.Icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`saas-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`h-8 px-3.5 rounded-2xl text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer ${
                  active
                    ? "bg-[#141413] text-[#FAF9F6] shadow-xs"
                    : "bg-white border border-[#E4DFD5] text-[#44403C] hover:bg-[#EFECE5]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === "tenants" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {availableTenants.map((tenant, idx) => {
                  const isSelected = tenant.tenantId === activeTenantProfile.tenantId;
                  const planInfo = PLAN_ENTITLEMENTS_MATRIX[tenant.planId];
                  return (
                    <button
                      key={tenant.tenantId}
                      type="button"
                      data-testid={`switch-tenant-${tenant.slug}`}
                      onClick={() => switchActiveTenant(tenant.tenantId)}
                      className={`text-left p-4 rounded-2xl border transition flex flex-col justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? "bg-white border-2 border-[#141413] shadow-md"
                          : "bg-white/75 border-[#E4DFD5] hover:border-[#8C7A6B]"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#F5F3EE] text-[#44403C]">
                            TENANT #{idx + 1} • {tenant.planId.toUpperCase()}
                          </span>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                              <Check className="w-3.5 h-3.5" /> Aktif
                            </span>
                          )}
                        </div>
                        <div className="pt-1">
                          {tenant.brand.logoVariant === "birim_authentic" ? (
                            <BirimLogo className="h-4 w-auto" />
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <span
                                className="w-4 h-4 rounded-sm inline-flex items-center justify-center text-[10px] font-black text-white"
                                style={{ backgroundColor: tenant.brand.accentColorHex }}
                              >
                                {tenant.brand.displayName.slice(0, 1)}
                              </span>
                              <span className="text-sm font-black tracking-tight">
                                {tenant.brand.displayName}
                              </span>
                            </div>
                          )}
                          <div className="text-[11px] text-[#57534E] mt-1 font-medium">
                            {tenant.brand.legalName}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#EFECE5] space-y-1 text-[11px] text-[#44403C]">
                        <div>
                          Gövde: <strong>{tenant.construction.defaultCarcassThicknessMm}mm</strong> • Arkalık: <strong>{tenant.construction.defaultBackThicknessMm}mm</strong>
                        </div>
                        <div>
                          Bağlantı: <strong>{tenant.construction.connectorSystem}</strong>
                        </div>
                        <div>
                          CNC / Para: <strong>{tenant.machine.primaryCncFormat.toUpperCase()}</strong> • <strong>{tenant.pricing.currency}</strong>
                        </div>
                        <div className="text-[10px] text-[#78716C]">
                          Yetki: {planInfo.allowCncExport ? "3B + BOM + CNC + ERP" : "3B + 2B + BOM (CNC Kilitli)"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Role Simulator */}
              <div className="bg-white rounded-2xl border border-[#E4DFD5] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#141413]">
                    Firma İçi RBAC Rol Simülatörü (Yetki &amp; Fiyat Görünürlük Testi)
                  </div>
                  <span className="text-[11px] font-mono text-[#57534E]">
                    İzole Depolama Anahtarı: {activeTenantProfile.slug === "birim" ? "birim_saved_projects" : buildTenantScopedStorageKey(activeTenantProfile.tenantId, "saved_projects")}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map((r) => {
                    const active = activeTenantRole === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        data-testid={`select-saas-role-${r.id}`}
                        onClick={() => setActiveTenantRole(r.id)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          active
                            ? "bg-[#141413] text-white border-[#141413]"
                            : "bg-[#FAF9F6] text-[#141413] border-[#E4DFD5] hover:bg-[#EFECE5]"
                        }`}
                      >
                        <div className="text-xs font-bold">{r.label}</div>
                        <div className={`text-[10px] mt-0.5 ${active ? "text-stone-300" : "text-[#57534E]"}`}>
                          {r.summary}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "construction" && (
            <div className="bg-white rounded-2xl border border-[#E4DFD5] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#57534E]">
                    Kodsuz Konstrüksiyon &amp; CNC Makine Profili ({activeTenantProfile.brand.displayName})
                  </h3>
                  <p className="text-xs text-[#44403C] mt-0.5">
                    Değişiklikler anında aktif sahnedeki modüllerin kesim listesine, plaka fire hesabına ve CNC delik motoruna uygulanır.
                  </p>
                </div>
                {!canManageSettings && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-900 text-[11px] font-semibold">
                    <Lock className="w-3.5 h-3.5" /> Salt-Okunur Rol
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="font-semibold text-[#44403C] block">Gövde Kalınlığı</span>
                  <V3PremiumDropdown
                    variant="popover"
                    size="sm"
                    disabled={!canManageSettings}
                    value={String(activeTenantProfile.construction.defaultCarcassThicknessMm)}
                    onChange={(val) =>
                      updateActiveTenantProfile({
                        construction: {
                          ...activeTenantProfile.construction,
                          defaultCarcassThicknessMm: Number(val),
                        },
                      })
                    }
                    options={[16, 18, 19, 22, 25].map((mm) => ({
                      value: String(mm),
                      label: `${mm} mm`,
                    }))}
                  />
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-[#44403C] block">Arkalık Montajı</span>
                  <V3PremiumDropdown
                    variant="popover"
                    size="sm"
                    disabled={!canManageSettings}
                    value={activeTenantProfile.construction.backPanelMounting}
                    onChange={(val) => {
                      const mode = val as BackPanelMountingMode;
                      updateActiveTenantProfile({
                        construction: {
                          ...activeTenantProfile.construction,
                          backPanelMounting: mode,
                          defaultBackThicknessMm: mode === "surface_nailed_4mm" ? 4 : 8,
                        },
                      });
                    }}
                    options={[
                      { value: "grooved_8mm", label: "8mm Kanal Geçmeli" },
                      { value: "rabbeted_8mm", label: "8mm Lambalı" },
                      { value: "surface_nailed_4mm", label: "4mm HDF Çivili" },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-[#44403C] block">Bağlantı Sistemi</span>
                  <V3PremiumDropdown
                    variant="popover"
                    size="sm"
                    disabled={!canManageSettings}
                    value={activeTenantProfile.construction.connectorSystem}
                    onChange={(val) =>
                      updateActiveTenantProfile({
                        construction: {
                          ...activeTenantProfile.construction,
                          connectorSystem: val as ConnectorSystemType,
                        },
                      })
                    }
                    options={[
                      { value: "minifix_dowel", label: "Minifiks Ø15 + Kavela" },
                      { value: "lamello_cabineo", label: "Lamello Cabineo" },
                      { value: "confirmat", label: "Konfirmat Ø7x50" },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-[#44403C] block">CNC Post-Processor</span>
                  <V3PremiumDropdown
                    variant="popover"
                    size="sm"
                    disabled={!canManageSettings}
                    value={activeTenantProfile.machine.primaryCncFormat}
                    onChange={(val) =>
                      updateActiveTenantProfile({
                        machine: {
                          ...activeTenantProfile.machine,
                          primaryCncFormat: val as CncMachineFormatId,
                        },
                      })
                    }
                    options={[
                      { value: "homag_mpr", label: "Homag (.MPR)" },
                      { value: "biesse_cix", label: "Biesse (.CIX)" },
                      { value: "scm_xcs", label: "SCM (.XCS)" },
                      { value: "iso_gcode", label: "ISO G-Code (.NC)" },
                    ]}
                  />
                </div>

                <label className="space-y-1">
                  <span className="font-semibold text-[#44403C]">Testere Ağız Payı / Kerf (mm)</span>
                  <input
                    type="number"
                    step="0.2"
                    min="2.0"
                    max="6.0"
                    disabled={!canManageSettings}
                    value={activeTenantProfile.construction.sawKerfMm}
                    onChange={(e) =>
                      updateActiveTenantProfile({
                        construction: {
                          ...activeTenantProfile.construction,
                          sawKerfMm: Math.max(2, Math.min(6, Number(e.target.value) || 4)),
                        },
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-[#DED8CC] bg-[#FAF9F6] font-mono font-semibold"
                  />
                </label>

                <div className="p-3 rounded-xl bg-[#F5F3EE] border border-[#E4DFD5] flex flex-col justify-center">
                  <div className="text-[10px] font-bold uppercase text-[#78716C]">Canlı Üretim Çıktısı Özeti</div>
                  <div className="text-xs font-bold text-[#141413] mt-0.5">
                    {bom.cutList.length} Parça • {bom.summary.totalDrillingHolesCount} CNC Delik
                  </div>
                  <div className="text-[11px] text-[#57534E]">
                    Cabineo Cep Sayısı: <strong>{cabineoHoleCount}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "pricing" && (
            <div className="bg-white rounded-2xl border border-[#E4DFD5] p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#57534E]">
                Firma Bazlı Fiyatlandırma, Hedef Marj &amp; B2B Bayi İskonto Politikası
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <label className="space-y-1">
                  <span className="font-semibold text-[#44403C]">Teklif Para Birimi</span>
                  <select
                    disabled={!canManageSettings}
                    value={activeTenantProfile.pricing.currency}
                    onChange={(e) =>
                      updateActiveTenantProfile({
                        pricing: {
                          ...activeTenantProfile.pricing,
                          currency: e.target.value as "EUR" | "TRY",
                        },
                        brand: {
                          ...activeTenantProfile.brand,
                          defaultCurrency: e.target.value as "EUR" | "TRY",
                        },
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-[#DED8CC] bg-[#FAF9F6] font-semibold"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="TRY">TRY (₺)</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="font-semibold text-[#44403C]">Hedef Marj (%)</span>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    disabled={!canManageSettings}
                    value={activeTenantProfile.pricing.targetMarginPercent}
                    onChange={(e) =>
                      updateActiveTenantProfile({
                        pricing: {
                          ...activeTenantProfile.pricing,
                          targetMarginPercent: Math.max(0, Number(e.target.value) || 0),
                        },
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-[#DED8CC] bg-[#FAF9F6] font-mono font-semibold"
                  />
                </label>

                <label className="space-y-1">
                  <span className="font-semibold text-[#44403C]">B2B Bayi İskontosu (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    disabled={!canManageSettings}
                    value={activeTenantProfile.pricing.dealerDiscountPercent}
                    onChange={(e) =>
                      updateActiveTenantProfile({
                        pricing: {
                          ...activeTenantProfile.pricing,
                          dealerDiscountPercent: Math.max(0, Math.min(60, Number(e.target.value) || 0)),
                        },
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-[#DED8CC] bg-[#FAF9F6] font-mono font-semibold"
                  />
                </label>

                <label className="space-y-1">
                  <span className="font-semibold text-[#44403C]">EUR / TRY Kur Çarpanı</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    disabled={!canManageSettings}
                    value={activeTenantProfile.pricing.eurTryExchangeRate}
                    onChange={(e) =>
                      updateActiveTenantProfile({
                        pricing: {
                          ...activeTenantProfile.pricing,
                          eurTryExchangeRate: Math.max(1, Number(e.target.value) || 41.8),
                        },
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-[#DED8CC] bg-[#FAF9F6] font-mono font-semibold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E4DFD5]">
                  <div className="text-[10px] font-bold uppercase text-[#78716C]">Perakende KDV Dahil (EUR)</div>
                  <div className="text-base font-mono font-extrabold text-[#141413] mt-0.5">
                    € {pricing.totalWithVatEur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E4DFD5]">
                  <div className="text-[10px] font-bold uppercase text-[#78716C]">Perakende KDV Dahil (TRY)</div>
                  <div className="text-base font-mono font-extrabold text-[#141413] mt-0.5">
                    ₺ {Math.round(pricing.totalWithVatTry).toLocaleString("tr-TR")}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-600/10 border border-emerald-600/25">
                  <div className="text-[10px] font-bold uppercase text-emerald-900">
                    B2B Bayi Net Fiyatı (-%{pricing.dealerDiscountPercent ?? activeTenantProfile.pricing.dealerDiscountPercent})
                  </div>
                  <div className="text-base font-mono font-extrabold text-emerald-950 mt-0.5">
                    ₺ {(pricing.dealerNetWithVatTry ?? Math.round(pricing.totalWithVatTry)).toLocaleString("tr-TR")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "entitlements" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[#E4DFD5] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#57534E]">
                    Aktif Abonelik Paketi Yetki Matrisi ({entitlements.planNameTr})
                  </h3>
                  <span className="text-xs font-mono font-bold text-[#141413]">
                    Teklif Öneki: {activeTenantProfile.brand.quoteCodePrefix}-XXXXXX
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  {[
                    { key: "allowBomExport" as const, label: "BOM & Kesim Listesi" },
                    { key: "allowCncExport" as const, label: "CNC (.MPR/.CIX/.XCS)" },
                    { key: "allowErpIntegration" as const, label: "Canlı ERP / Webhook" },
                    { key: "allowCustomTemplates" as const, label: "Özel Modül Şablonu" },
                    { key: "allowWhiteLabelEmbed" as const, label: "White-Label Embed SDK" },
                    { key: "allowDealerHierarchy" as const, label: "Çok Şube & Bayi Ağı" },
                  ].map((f) => {
                    const res = checkTenantEntitlement(activeTenantProfile, f.key);
                    return (
                      <div
                        key={f.key}
                        className={`p-2.5 rounded-xl border flex items-center justify-between ${
                          res.allowed
                            ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                            : "bg-stone-100 border-stone-200 text-stone-500"
                        }`}
                      >
                        <span className="font-semibold">{f.label}</span>
                        {res.allowed ? (
                          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E4DFD5] p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#141413]">
                    <Code2 className="w-4 h-4 text-[#8C7A6B]" />
                    <span>E-Ticaret &amp; Bayi Sitesi White-Label Embed Kodu</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        void navigator.clipboard.writeText(embedSnippet);
                      }
                      setCopiedSdk(true);
                      setTimeout(() => setCopiedSdk(false), 1800);
                    }}
                    className="h-7 px-3 rounded-xl bg-[#141413] text-white text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedSdk ? "Kopyalandı" : "Kodu Kopyala"}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-[#141413] text-[#FAF9F6] text-[11px] font-mono overflow-x-auto">
                  {embedSnippet}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
