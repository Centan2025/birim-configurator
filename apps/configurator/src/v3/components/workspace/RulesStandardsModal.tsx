"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import {
  BIRIM_STANDARDS_CATALOG,
  CUSTOM_STANDARD_METRIC_OPTIONS,
  addCustomStandardRule,
  formatIssueHumanTitle,
  removeCustomStandardRule,
  toggleCustomStandardRule,
  type CustomStandardMetric,
  type CustomStandardRule,
  type RemediationProposal,
} from "@birim/core";
import { V3PremiumDropdown } from "../../design-system";
import { startZeroLagModalDrag } from "../../design-system/zeroLagDrag";

interface KitchenRuleItem {
  code: string;
  label: string;
  standardRef: string;
  verified: boolean;
}

interface UnifiedFindingItem {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  ruleNature?: string;
  worldPositionMm?: { x: number; y: number; z: number };
  remediationProposals?: RemediationProposal[];
}

interface RulesStandardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdminModal: () => void;
  tenantId: string;
  humanCompatStatusLabel: string;
  rulesModalTab: "audit" | "catalog" | "add_custom";
  setRulesModalTab: (tab: "audit" | "catalog" | "add_custom") => void;
  findings: UnifiedFindingItem[];
  ergonomicProfileId: "TR_RESIDENTIAL" | "EU_EN_STANDARD" | "ACCESSIBLE_EN17210";
  setErgonomicProfileId: (id: "TR_RESIDENTIAL" | "EU_EN_STANDARD" | "ACCESSIBLE_EN17210") => void;
  regionalErgonomicProfiles: Record<string, { id: string; name: string }>;
  applyApprovedEngineeringFix: (prop: RemediationProposal) => void;
  onShowBanner: (banner: { ok: boolean; text: string }) => void;
  customStdRules: CustomStandardRule[];
  setCustomStdRules: (rules: CustomStandardRule[]) => void;
  kitchenRuleRegistry: readonly KitchenRuleItem[];
  newStdName: string;
  setNewStdName: (v: string) => void;
  newStdRef: string;
  setNewStdRef: (v: string) => void;
  newStdMetric: CustomStandardMetric;
  setNewStdMetric: (m: CustomStandardMetric) => void;
  newStdThreshold: number;
  setNewStdThreshold: (n: number) => void;
  newStdCategory: CustomStandardRule["appliesToCategory"];
  setNewStdCategory: (c: CustomStandardRule["appliesToCategory"]) => void;
  newStdSeverity: "warning" | "error";
  setNewStdSeverity: (s: "warning" | "error") => void;
}

export const RulesStandardsModal: React.FC<RulesStandardsModalProps> = ({
  isOpen,
  onClose,
  onOpenAdminModal,
  tenantId,
  humanCompatStatusLabel,
  rulesModalTab,
  setRulesModalTab,
  findings,
  ergonomicProfileId,
  setErgonomicProfileId,
  regionalErgonomicProfiles,
  applyApprovedEngineeringFix,
  onShowBanner,
  customStdRules,
  setCustomStdRules,
  kitchenRuleRegistry,
  newStdName,
  setNewStdName,
  newStdRef,
  setNewStdRef,
  newStdMetric,
  setNewStdMetric,
  newStdThreshold,
  setNewStdThreshold,
  newStdCategory,
  setNewStdCategory,
  newStdSeverity,
  setNewStdSeverity,
}) => {
  if (!isOpen) return null;

  return (
    <div
      data-testid="v3-engineering-modal"
      onClick={onClose}
      className="fixed inset-0 z-[153] flex items-center justify-center bg-[#141413]/50 backdrop-blur-xs p-0 md:p-5"
    >
      <div
        data-draggable-shell="rules"
        onClick={(e) => e.stopPropagation()}
        className="birim-ice-modal rounded-[28px] max-md:rounded-none max-md:h-[100dvh] max-md:max-h-[100dvh] max-w-3xl w-full overflow-hidden text-stone-900"
      >
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          title="Taşımak için sürükleyin"
          className="px-5 py-4 birim-ice-shell-header flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#141413]" />
            <div>
              <h2 className="text-sm font-bold text-[#111827]">
                Kalite Kontrol ({humanCompatStatusLabel})
              </h2>
              <p className="text-[11px] text-[#475569]">
                Ölçü, standart ve uyumluluk kuralları
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdminModal();
              }}
              className="px-2.5 py-1 rounded-xl birim-ice-btn text-[11px] font-bold text-[#141413] cursor-pointer"
              title="B1 Modül Şablon ve Donanım Kütüphanesi Yönetimi"
            >
              B1 Kütüphane
            </button>
            <button
              type="button"
              data-testid="v3-engineering-modal-close"
              onClick={onClose}
              className="px-2 py-1 rounded text-stone-500 hover:text-stone-900 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-5 pt-3 pb-2 border-b border-stone-200/80 flex flex-wrap items-center gap-1.5 bg-white/50">
          {[
            { id: "audit" as const, label: `1. Proje Denetimi (${findings.length})` },
            {
              id: "catalog" as const,
              label: `2. Aktif Standartlar (${BIRIM_STANDARDS_CATALOG.length + customStdRules.length})`,
            },
            { id: "add_custom" as const, label: "3. + Yeni Standart / Kural Ekle" },
          ].map((tb) => (
            <button
              key={tb.id}
              type="button"
              data-testid={`standards-modal-tab-${tb.id}`}
              onClick={() => setRulesModalTab(tb.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                rulesModalTab === tb.id
                  ? "birim-ice-charcoal-pill"
                  : "birim-ice-btn text-[#44403C] hover:text-[#141413]"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4 max-h-[72dvh] overflow-y-auto text-xs">
          {rulesModalTab === "audit" && (
            <>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-stone-900 text-[11px] uppercase tracking-wider">
                    Bölgesel Ergonomi ve Erişilebilirlik Profili
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Zorunlu güvenlik kuralları sabit tutulur; raf erişim ve geçiş koridoru sınırları seçili profile göre denetlenir.
                  </div>
                </div>
                <select
                  data-testid="v3-ergonomic-profile-select"
                  value={ergonomicProfileId}
                  onChange={(e) =>
                    setErgonomicProfileId(
                      e.target.value as "TR_RESIDENTIAL" | "EU_EN_STANDARD" | "ACCESSIBLE_EN17210"
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-900 font-semibold text-xs"
                >
                  {Object.values(regionalErgonomicProfiles).map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.name}
                    </option>
                  ))}
                </select>
              </div>

              {findings.length === 0 ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-extrabold text-sm">
                      ✓ Tüm Modüller Aktif Standartlara %100 Uygun
                    </div>
                    <div className="text-[11px] text-emerald-800 mt-0.5">
                      EN 14749 devrilme güvenliği, EN 16122 raf sehimi, Sistem 32 delik düzeni ve üretim sınırlarında hiçbir uyumsuzluk bulunmadı.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="font-bold text-stone-700 uppercase tracking-wider text-[11px]">
                    Tespit Edilen Standart Kontrolleri ({findings.length})
                  </div>
                  {findings.map((iss, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border space-y-1.5 ${
                        iss.severity === "error"
                          ? "bg-red-50 border-red-200 text-red-900"
                          : "bg-[#F8FAFC] border-[#CBD5E1] text-[#111827]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-[#111827]">
                          {formatIssueHumanTitle(iss.code, "studio")}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#EEF3F8] border border-[#CBD5E1] text-[10px] font-bold text-[#111827] shrink-0">
                          {iss.ruleNature === "MANDATORY_SAFETY"
                            ? "Zorunlu Güvenlik Engeli"
                            : iss.ruleNature === "ENGINEERING_VALIDITY" && iss.severity === "error"
                              ? "Mühendislik / Üretim Engeli"
                              : iss.ruleNature === "VERIFICATION_REQUIRED"
                                ? "Doğrulama Gerektirir"
                                : "Ergonomi Önerisi"}
                        </span>
                      </div>
                      <div className="text-[#334155]">{iss.message}</div>
                      {iss.worldPositionMm && (
                        <div className="font-mono text-[10px] text-stone-500">
                          Sahne Konumu: X={iss.worldPositionMm.x} • Y={iss.worldPositionMm.y} • Z={iss.worldPositionMm.z} mm
                        </div>
                      )}
                      {iss.remediationProposals && iss.remediationProposals.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {iss.remediationProposals.map((prop) => (
                            <button
                              key={prop.id}
                              type="button"
                              onClick={() => {
                                applyApprovedEngineeringFix(prop);
                                onShowBanner({
                                  ok: true,
                                  text: `✓ Onaylı düzeltme uygulandı: ${prop.label}`,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer transition"
                            >
                              ✓ Onayla ve Uygula: {prop.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {rulesModalTab === "catalog" && (
            <div className="space-y-4">
              {customStdRules.length > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                    Organizasyona Özel Eklenen Standartlar ({customStdRules.length})
                  </div>
                  {customStdRules.map((cr) => (
                    <div
                      key={cr.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200"
                    >
                      <div>
                        <div className="font-bold text-stone-900">
                          {cr.name}{" "}
                          <span className="font-mono text-[10px] text-stone-500">
                            ({cr.standardRef})
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-600">
                          Kategori: {cr.category} • Sınır: {cr.operator === "max" ? "≤" : "≥"}{" "}
                          <b>{cr.thresholdMm} mm</b> • Seviye:{" "}
                          {cr.severity === "error" ? "Üretim Engeli" : "Uyarı"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCustomStdRules(toggleCustomStandardRule(cr.id, tenantId))}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                            cr.enabled ? "bg-emerald-700 text-white" : "bg-stone-200 text-stone-600"
                          }`}
                        >
                          {cr.enabled ? "Aktif" : "Pasif"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomStdRules(removeCustomStandardRule(cr.id, tenantId))}
                          className="px-2 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 text-[10px] font-bold cursor-pointer"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <div className="font-bold text-stone-700 uppercase tracking-wider text-[11px]">
                  Yerleşik Uluslararası &amp; Fabrika Standartları ({BIRIM_STANDARDS_CATALOG.length})
                </div>
                {BIRIM_STANDARDS_CATALOG.map((std) => (
                  <div
                    key={std.id}
                    className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-stone-900">
                        {std.category} — {std.title}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                        {std.standardRef}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-700">{std.thresholdSummary}</div>
                    <div className="font-mono text-[10px] text-stone-400">
                      Kaynak Kod: {std.codeLocation}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="font-bold text-stone-700 uppercase tracking-wider text-[11px]">
                  Mutfak &amp; Mekânsal Yerleşim Kuralları ({kitchenRuleRegistry.length})
                </div>
                {kitchenRuleRegistry.map((rule) => (
                  <div
                    key={rule.code}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200"
                  >
                    <div>
                      <div className="font-bold text-stone-900">{rule.label}</div>
                      <div className="text-[11px] text-stone-500">{rule.standardRef}</div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                        rule.verified
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-[#57534E]"
                      }`}
                    >
                      {rule.verified ? "AKTİF STANDART" : "SAHA KONTROLÜ"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rulesModalTab === "add_custom" && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
              <div>
                <div className="font-extrabold text-stone-900 text-sm">
                  Yeni Özel Standart / Üretim Kuralı Tanımla
                </div>
                <div className="text-[11px] text-stone-600 mt-0.5">
                  Eklediğiniz standart yalnızca aktif organizasyon hafızasına kaydedilir ve sahnedeki modüllerde anında denetlenir.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="space-y-1 block">
                  <span className="font-bold text-[11px] text-stone-700">Standart Başlığı</span>
                  <input
                    type="text"
                    data-testid="custom-std-name-input"
                    value={newStdName}
                    onChange={(e) => setNewStdName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-stone-300 font-semibold text-xs"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="font-bold text-[11px] text-stone-700">Referans Kodu</span>
                  <input
                    type="text"
                    data-testid="custom-std-ref-input"
                    value={newStdRef}
                    onChange={(e) => setNewStdRef(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-stone-300 font-mono text-xs"
                  />
                </label>
                <div className="space-y-1 block">
                  <span className="font-bold text-[11px] text-stone-700 block">Denetlenecek Parametre</span>
                  <V3PremiumDropdown
                    variant="popover"
                    size="sm"
                    testId="custom-std-metric-select"
                    value={newStdMetric}
                    onChange={(val) => {
                      const m = val as CustomStandardMetric;
                      setNewStdMetric(m);
                      const meta = CUSTOM_STANDARD_METRIC_OPTIONS.find((x) => x.metric === m);
                      if (meta) setNewStdThreshold(meta.defaultThresholdMm);
                    }}
                    options={CUSTOM_STANDARD_METRIC_OPTIONS.map((opt) => ({
                      value: opt.metric,
                      label: opt.label,
                    }))}
                  />
                </div>
                <label className="space-y-1 block">
                  <span className="font-bold text-[11px] text-stone-700">Sınır Değer (mm)</span>
                  <input
                    type="number" inputMode="decimal"
                    data-testid="custom-std-threshold-input"
                    min={10}
                    max={3600}
                    step={5}
                    value={newStdThreshold}
                    onChange={(e) => setNewStdThreshold(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-stone-300 font-mono font-bold text-xs"
                  />
                </label>
                <div className="space-y-1 block">
                  <span className="font-bold text-[11px] text-stone-700 block">Modül Grubu</span>
                  <V3PremiumDropdown
                    variant="popover"
                    size="sm"
                    value={newStdCategory}
                    onChange={(val) =>
                      setNewStdCategory(val as CustomStandardRule["appliesToCategory"])
                    }
                    options={[
                      { value: "all", label: "Tüm Modüller" },
                      { value: "wardrobe", label: "Gardırop & Giyinme Odası" },
                      { value: "kitchen_base", label: "Mutfak Alt Dolapları" },
                      { value: "kitchen_wall", label: "Mutfak Üst Dolapları" },
                      { value: "kitchen_tall", label: "Boy ve Cihaz Dolapları" },
                    ]}
                  />
                </div>
                <div className="space-y-1 block">
                  <span className="font-bold text-[11px] text-stone-700 block">Kural Seviyesi</span>
                  <V3PremiumDropdown
                    variant="popover"
                    size="sm"
                    value={newStdSeverity}
                    onChange={(val) => setNewStdSeverity(val as "warning" | "error")}
                    options={[
                      { value: "warning", label: "Tasarım Uyarısı (Esnek)" },
                      { value: "error", label: "Zorunlu Üretim Engeli" },
                    ]}
                  />
                </div>
              </div>

              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  data-testid="custom-std-save-btn"
                  onClick={() => {
                    const meta = CUSTOM_STANDARD_METRIC_OPTIONS.find(
                      (x) => x.metric === newStdMetric
                    );
                    const nextList = addCustomStandardRule(
                      {
                        name: newStdName.trim() || "Özel Standart",
                        standardRef: newStdRef.trim() || "STD-CUSTOM",
                        category: "Gövde & Karkas",
                        metric: newStdMetric,
                        operator: meta?.defaultOperator || "max",
                        thresholdMm: Math.max(10, Math.round(newStdThreshold)),
                        appliesToCategory: newStdCategory,
                        severity: newStdSeverity,
                        enabled: true,
                      },
                      tenantId
                    );
                    setCustomStdRules(nextList);
                    setRulesModalTab("catalog");
                    onShowBanner({
                      ok: true,
                      text: `✓ Yeni standart eklendi: ${newStdName.trim()} (${newStdThreshold} mm)`,
                    });
                  }}
                  className="px-4 py-2 rounded-xl birim-ice-charcoal-pill font-bold text-xs cursor-pointer"
                >
                  + Standardı Kaydet ve Uygula
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
