"use client";

import React, { useState } from "react";
import { formatIssueHumanTitle } from "@birim/core";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import {
  X,
  Download,
  AlertTriangle,
  FileCode,
  ListOrdered,
  Cpu,
  ShieldAlert,
  ShieldCheck,
  FileSpreadsheet,
  Tag,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  Code2,
  PanelRightOpen,
  PanelRightClose,
  Copy,
  Printer,
  Package,
  Check,
} from "lucide-react";
import { DEFAULT_MATERIALS, evaluateUnifiedEngineeringModel, buildHardwareCertificationSummary, exportHardwareCertificationCsv, type RemediationProposal } from "@birim/core";
import { V4_HARDWARE_CATALOG } from "@birim/catalog";
import { BirimLogo, V3PremiumDropdown } from "../v3/design-system";
import { startZeroLagModalDrag } from "../v3/design-system/zeroLagDrag";
import {
  exportCutListToCSV,
  buildBirimErpNestingBundle,
  adjustErpGrooveSideForRotation,
  generateAssemblyInstructions,
  generateSelcoExportPackage,
  generatePanelDXF,
  exportAllPanelsDXF,
  exportNestingSheetsDXF,
  exportIndustrialCamZipArchive,
  exportOptiCutCutListCsv,
  exportHardwareBomCsv,
  generateNestingDiagramSvg,
  generateThermalPartLabelsHtml,
  generateThermalPartLabelsZpl,
  exportArchitecturalMepDxf,
  generateBlumBxfXml,
  calculateBlumEngineeringSummary,
  generateProjectCncPostProcessorBundle,
  mapCutPieceToCncPieceInput,
  simulateCncPostProcessorBundle,
  generateCncToolpathSimulationSvg,
  type CncPieceInput,
  CutPiece,
} from "@birim/manufacturing";

interface BomModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?:
    | "cutlist"
    | "hardware"
    | "nesting"
    | "validation"
    | "assembly"
    | "selco"
    | "cnc_mpr_cix"
    | "quote"
    | "blum_bxf";
}

function escapeHtml(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function countActiveBands(eb: CutPiece["edgeBanding"]): number {
  return (eb.top ? 1 : 0) + (eb.bottom ? 1 : 0) + (eb.left ? 1 : 0) + (eb.right ? 1 : 0);
}

function getPieceDxfLayers(p: CutPiece): string[] {
  const layers = ["PANEL_CONTOUR", "NET_CUT_CONTOUR"];
  if (p.hasBackGroove) layers.push("BACK_GROOVE_8MM");
  if (p.tambourTrackGrooveSpec) layers.push("TAMBOUR_TRACK_W8_5_Z7_5");
  if (p.kerfBendingMeta) layers.push("KERF_SLOTS");
  if (p.holes && p.holes.length > 0) {
    if (p.holes.some((h) => h.purpose === "minifix_cam" || h.purpose === "minifix_bolt")) {
      layers.push("MINIFIX_D15");
    }
    if (p.holes.some((h) => h.purpose === "dowel")) {
      layers.push("DOWEL_D8");
    }
    if (p.holes.some((h) => h.purpose === "hinge_cup" || h.purpose === "hinge_mount")) {
      layers.push("HINGE_D35");
    }
    if (p.holes.length >= 6) {
      layers.push("SYSTEM_32_HOLES");
    }
  }
  return layers;
}

const MiniEdgeBandSvg: React.FC<{ edgeBanding: CutPiece["edgeBanding"] }> = ({ edgeBanding }) => {
  const activeCount = countActiveBands(edgeBanding);
  const strokeColor = activeCount === 4 ? "#D97706" : "#2563EB";
  const labels: string[] = [];
  if (edgeBanding.top) labels.push("Üst");
  if (edgeBanding.bottom) labels.push("Alt");
  if (edgeBanding.left) labels.push("Sol");
  if (edgeBanding.right) labels.push("Sağ");

  return (
    <svg
      width="22"
      height="16"
      viewBox="0 0 22 16"
      className="shrink-0"
      aria-label={labels.length ? `Bantlı Kenarlar: ${labels.join(", ")}` : "Bantsız"}
    >
      <rect
        x="2"
        y="2"
        width="18"
        height="12"
        rx="1.2"
        fill="#F5F2EA"
        stroke="#CBD5E1"
        strokeWidth="1"
      />
      {edgeBanding.top && (
        <line x1="2" y1="2" x2="20" y2="2" stroke={strokeColor} strokeWidth="2.3" strokeLinecap="round" />
      )}
      {edgeBanding.bottom && (
        <line x1="2" y1="14" x2="20" y2="14" stroke={strokeColor} strokeWidth="2.3" strokeLinecap="round" />
      )}
      {edgeBanding.left && (
        <line x1="2" y1="2" x2="2" y2="14" stroke={strokeColor} strokeWidth="2.3" strokeLinecap="round" />
      )}
      {edgeBanding.right && (
        <line x1="20" y1="2" x2="20" y2="14" stroke={strokeColor} strokeWidth="2.3" strokeLinecap="round" />
      )}
    </svg>
  );
};

const CutPieceBlueprintSvg: React.FC<{
  piece: CutPiece;
  layers: { bant: boolean; cnc: boolean; olcu: boolean };
}> = ({ piece, layers }) => {
  const boxW = 196;
  const boxH = 114;
  const boy = Math.max(1, piece.lengthMm);
  const en = Math.max(1, piece.widthMm);
  const ratio = boy / en;
  let w: number;
  let h: number;
  if (ratio >= boxW / boxH) {
    w = boxW;
    h = Math.max(36, boxW / ratio);
  } else {
    h = boxH;
    w = Math.max(54, boxH * ratio);
  }
  const x = (300 - w) / 2;
  const y = (196 - h) / 2;
  const eb = piece.edgeBanding;
  const bandCount = countActiveBands(eb);
  const bandColor = bandCount === 4 ? "#F59E0B" : "#3B82F6";
  const bandText = bandCount === 4 ? "#FDE68A" : "#93C5FD";
  const netL = piece.netCutLengthMm ?? piece.lengthMm;
  const netW = piece.netCutWidthMm ?? piece.widthMm;
  const topY = y - (eb.top && layers.bant ? 22 : 13);
  const rightX = x + w + (eb.right && layers.bant ? 28 : 13);
  const botY = y + h + (eb.bottom && layers.bant ? 24 : 15);

  return (
    <svg
      viewBox="0 0 300 196"
      className="w-full h-[196px] rounded-xl bg-[#0F131A] border border-slate-800/80 shadow-inner"
      aria-label={`${piece.pieceName} 2D teknik çizim`}
    >
      <defs>
        <pattern id="bomEngGrid" width="15" height="15" patternUnits="userSpaceOnUse">
          <path d="M 15 0 L 0 0 0 15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect width="300" height="196" fill="url(#bomEngGrid)" />
      {/* Finished contour */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1"
      />
      {/* Net cut contour */}
      <rect
        x={x + 2.5}
        y={y + 2.5}
        width={Math.max(4, w - 5)}
        height={Math.max(4, h - 5)}
        fill="none"
        stroke="rgba(52,211,153,0.32)"
        strokeWidth="0.7"
        strokeDasharray="2.5 2.5"
      />

      {/* Edge banding layer */}
      {layers.bant && (
        <g>
          {eb.top && (
            <>
              <line x1={x} y1={y} x2={x + w} y2={y} stroke={bandColor} strokeWidth="3" />
              <rect x={x + w / 2 - 11} y={y - 11} width="22" height="10" rx="2.5" fill="#0F131A" stroke={bandColor} strokeWidth="0.75" />
              <text x={x + w / 2} y={y - 3.5} textAnchor="middle" fill={bandText} fontFamily="monospace" fontSize="7.5">Ü</text>
            </>
          )}
          {eb.bottom && (
            <>
              <line x1={x} y1={y + h} x2={x + w} y2={y + h} stroke={bandColor} strokeWidth="3" />
              <rect x={x + w / 2 - 11} y={y + h + 2} width="22" height="10" rx="2.5" fill="#0F131A" stroke={bandColor} strokeWidth="0.75" />
              <text x={x + w / 2} y={y + h + 9.5} textAnchor="middle" fill={bandText} fontFamily="monospace" fontSize="7.5">A</text>
            </>
          )}
          {eb.left && (
            <>
              <line x1={x} y1={y} x2={x} y2={y + h} stroke={bandColor} strokeWidth="3" />
              <rect x={x - 18} y={y + h / 2 - 5} width="15" height="10" rx="2.5" fill="#0F131A" stroke={bandColor} strokeWidth="0.75" />
              <text x={x - 10.5} y={y + h / 2 + 2.5} textAnchor="middle" fill={bandText} fontFamily="monospace" fontSize="7.5">S</text>
            </>
          )}
          {eb.right && (
            <>
              <line x1={x + w} y1={y} x2={x + w} y2={y + h} stroke={bandColor} strokeWidth="3" />
              <rect x={x + w + 3} y={y + h / 2 - 5} width="17" height="10" rx="2.5" fill="#0F131A" stroke={bandColor} strokeWidth="0.75" />
              <text x={x + w + 11.5} y={y + h / 2 + 2.5} textAnchor="middle" fill={bandText} fontFamily="monospace" fontSize="7.5">Sa</text>
            </>
          )}
        </g>
      )}

      {/* CNC holes, back groove & kerf layer */}
      {layers.cnc && (
        <g>
          {piece.hasBackGroove && (
            <line
              x1={x + 3}
              y1={y + h - 8}
              x2={x + w - 3}
              y2={y + h - 8}
              stroke="#F59E0B"
              strokeWidth="1.5"
              strokeDasharray="3.5 2.5"
              opacity="0.85"
            />
          )}
          {piece.kerfBendingMeta &&
            Array.from({ length: Math.min(18, Math.max(6, piece.kerfBendingMeta.kerfCount)) }).map((_, ki, arr) => {
              const kx = x + 6 + (ki / Math.max(1, arr.length - 1)) * (w - 12);
              return (
                <line
                  key={ki}
                  x1={kx}
                  y1={y + 4}
                  x2={kx}
                  y2={y + h - 4}
                  stroke="#F59E0B"
                  strokeOpacity="0.45"
                  strokeWidth="0.8"
                />
              );
            })}
          {(piece.holes || []).slice(0, 48).map((hole, hi) => {
            const normX = Math.max(0.04, Math.min(0.96, hole.y / boy));
            const normY = Math.max(0.06, Math.min(0.94, hole.x / en));
            const hx = x + normX * w;
            const hy = y + normY * h;
            const isCamOrCup = hole.purpose === "minifix_cam" || hole.purpose === "hinge_cup";
            return (
              <circle
                key={hole.id || hi}
                cx={hx}
                cy={hy}
                r={isCamOrCup ? 3.1 : 1.9}
                fill={isCamOrCup ? "rgba(245,158,11,0.22)" : "#38BDF8"}
                stroke={isCamOrCup ? "#F59E0B" : "#E0F2FE"}
                strokeWidth={isCamOrCup ? 1.1 : 0.5}
              />
            );
          })}
        </g>
      )}

      {/* Dimension lines */}
      {layers.olcu && (
        <g>
          <line x1={x} y1={topY} x2={x + w} y2={topY} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
          <line x1={x} y1={topY - 2.5} x2={x} y2={topY + 2.5} stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
          <line x1={x + w} y1={topY - 2.5} x2={x + w} y2={topY + 2.5} stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
          <text x={x + w / 2} y={topY - 4} textAnchor="middle" fill="#E2E8F0" fontFamily="monospace" fontSize="8.5">
            {piece.lengthMm} mm
          </text>

          <line x1={rightX} y1={y} x2={rightX} y2={y + h} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
          <line x1={rightX - 2.5} y1={y} x2={rightX + 2.5} y2={y} stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
          <line x1={rightX - 2.5} y1={y + h} x2={rightX + 2.5} y2={y + h} stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
          <text x={rightX + 5} y={y + h / 2 + 3} textAnchor="start" fill="#E2E8F0" fontFamily="monospace" fontSize="8">
            {piece.widthMm}
          </text>

          <text x={x + w / 2} y={Math.min(191, botY + 5)} textAnchor="middle" fill="#34D399" fontFamily="monospace" fontSize="7.5">
            NET: {netL} × {netW} mm
          </text>
        </g>
      )}

      <text x={x + w / 2} y={y + h / 2 + 2.5} textAnchor="middle" fill="rgba(255,255,255,0.22)" fontFamily="monospace" fontSize="7.5">
        {piece.grain && piece.grain !== "none" ? "↔ DESEN" : "SERBEST"}
      </text>
    </svg>
  );
};

export default function BomModal(props: BomModalProps) {
  if (!props.isOpen) return null;
  return <BomModalInner {...props} />;
}

function BomModalInner({ isOpen, onClose, initialTab = "cutlist" }: BomModalProps) {
  const [activeTab, setActiveTab] = useState<
    | "cutlist"
    | "hardware"
    | "nesting"
    | "validation"
    | "assembly"
    | "selco"
    | "cnc_mpr_cix"
    | "quote"
    | "blum_bxf"
  >(initialTab);
  const [exportStatusBanner, setExportStatusBanner] = useState<string | null>(null);
  const [erpAlgorithm, setErpAlgorithm] = useState<"Auto" | "Guillotine" | "MaxRects">("Auto");
  const [erpSheetHeight, setErpSheetHeight] = useState<2100 | 2070>(2100);
  const [erpKerf, setErpKerf] = useState<number>(4);
  const [erpMargin, setErpMargin] = useState<number>(15);
  const [erpUseNetCut, setErpUseNetCut] = useState<boolean>(true);
  const [erpCommonCut, setErpCommonCut] = useState<boolean>(false);
  const [showCutSequences, setShowCutSequences] = useState<boolean>(true);
  const [showErpContractPreview, setShowErpContractPreview] = useState<boolean>(false);
  const [selectedSimulatedPieceId, setSelectedSimulatedPieceId] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [cutSearch, setCutSearch] = useState<string>("");
  const [cutFilter, setCutFilter] = useState<"all" | "band4" | "cnc" | "shelf" | "plinth">("all");
  const [showTechIds, setShowTechIds] = useState<boolean>(false);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1200 : true
  );
  const [selectedCutPieceId, setSelectedCutPieceId] = useState<string | null>(null);
  const [checkedCutIds, setCheckedCutIds] = useState<Set<string>>(() => new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [blueprintLayers, setBlueprintLayers] = useState({ bant: true, cnc: true, olcu: true });
  const [labelPreviewPiece, setLabelPreviewPiece] = useState<CutPiece | null>(null);
  const tabGroupRef = React.useRef<HTMLDivElement | null>(null);
  const tabBtnRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [tabIndicator, setTabIndicator] = useState<{ left: number; top: number; width: number; height: number; ready: boolean }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const filterGroupRef = React.useRef<HTMLDivElement | null>(null);
  const filterBtnRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [filterIndicator, setFilterIndicator] = useState<{ left: number; top: number; width: number; height: number; ready: boolean }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });



  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (labelPreviewPiece) {
          setLabelPreviewPiece(null);
          return;
        }
        if (exportMenuOpen) {
          setExportMenuOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, exportMenuOpen, labelPreviewPiece]);

  const bom = useConfiguratorStore((s) => s.bom);
  const project = useConfiguratorStore((s) => s.project);
  const pricing = useConfiguratorStore((s) => s.pricing);

  React.useLayoutEffect(() => {
    if (!isOpen) return;
    const syncTabs = () => {
      const btn = tabBtnRefs.current[activeTab];
      if (btn) {
        setTabIndicator({
          left: btn.offsetLeft,
          top: btn.offsetTop,
          width: btn.offsetWidth,
          height: btn.offsetHeight,
          ready: true,
        });
      }
    };
    const syncFilters = () => {
      const btn = filterBtnRefs.current[cutFilter];
      if (btn) {
        setFilterIndicator({
          left: btn.offsetLeft,
          top: btn.offsetTop,
          width: btn.offsetWidth,
          height: btn.offsetHeight,
          ready: true,
        });
      }
    };
    syncTabs();
    syncFilters();
    const raf = requestAnimationFrame(() => {
      syncTabs();
      syncFilters();
    });
    window.addEventListener("resize", syncTabs);
    window.addEventListener("resize", syncFilters);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", syncTabs);
      window.removeEventListener("resize", syncFilters);
    };
  }, [isOpen, activeTab, cutFilter, bom.cutList.length, bom.hardwareList.length]);

  const erpNestingBundle = React.useMemo(() => {
    if (!isOpen) return null;
    const matMap = new Map(
      [...DEFAULT_MATERIALS, ...(project.customMaterials || [])].map((m) => [m.id, m])
    );
    return buildBirimErpNestingBundle(project, bom, matMap, {
      organizationId: project.branchId || "org_birim_fabrika",
      orderRef: `${project.id}_v${project.version}`,
      sheetWidthMm: 2800,
      sheetHeightMm: erpSheetHeight,
      kerfMm: erpKerf,
      edgeMarginMm: erpMargin,
      algorithm: erpAlgorithm,
      useCommonCut: erpCommonCut,
      useNetCutDimensions: erpUseNetCut,
    });
  }, [
    isOpen,
    project,
    bom,
    erpSheetHeight,
    erpKerf,
    erpMargin,
    erpAlgorithm,
    erpCommonCut,
    erpUseNetCut,
  ]);

  const blumBxfXml = React.useMemo(
    () => (isOpen && activeTab === "blum_bxf" ? generateBlumBxfXml(project, bom) : ""),
    [isOpen, activeTab, project, bom]
  );
  const blumCabinetSummaries = React.useMemo(
    () =>
      isOpen && activeTab === "blum_bxf"
        ? project.modules
            .filter((m) => m.category !== "complementary")
            .map((m) => calculateBlumEngineeringSummary(m))
        : [],
    [isOpen, activeTab, project.modules]
  );

  if (!isOpen) return null;

  const downloadCustomerQuoteHtml = () => {
    const safeTitle = escapeHtml(project.title);
    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>Birim Mobilya - Müşteri Teklif ve Teknik Sunum Föyü (${safeTitle})</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1c1917; margin: 32px; background: #fafaf9; }
  .header { display: flex; justify-content: space-between; border-bottom: 3px solid #b45309; padding-bottom: 16px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 24px; background: #fff; }
  th, td { border: 1px solid #d6d3d1; padding: 10px 12px; text-align: left; font-size: 13px; }
  th { background: #f5f5f4; font-weight: 700; }
  .total-box { background: #1c1917; color: #fff; padding: 18px 24px; border-radius: 12px; text-align: right; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0;font-size:22px;">BİRİM MOBİLYA — MÜŞTERİ TEKLİF & TEKNİK SUNUM FÖYÜ</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#57534e;">Proje: ${safeTitle} • Versiyon: v${escapeHtml(project.version)} • Tarih: ${new Date().toLocaleDateString("tr-TR")}</p>
    </div>
    <div style="text-align:right;font-size:13px;">
      <strong>Toplam Modül:</strong> ${project.modules.length} Adet<br/>
      <strong>Toplam Panel Alanı:</strong> ${bom.summary.totalPanelAreaM2} m²
    </div>
  </div>
  <h3>1. Modül ve Malzeme Özeti</h3>
  <table>
    <thead><tr><th>#</th><th>Modül Adı</th><th>Ölçüler (G×Y×D)</th><th>Gövde Malzemesi</th><th>Kapak Malzemesi</th></tr></thead>
    <tbody>
      ${project.modules.map((m, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.dimensions.width)}×${escapeHtml(m.dimensions.height)}×${escapeHtml(m.dimensions.depth)} mm</td><td>${escapeHtml(m.carcass.bodyMaterialId)}</td><td>${escapeHtml(m.carcass.doorMaterialId)}</td></tr>`).join("")}
    </tbody>
  </table>
  <h3>2. Dünya Markaları Donanım, Aksesuar ve LED Aydınlatma Listesi</h3>
  <table>
    <thead><tr><th>Katalog Kodu (SKU)</th><th>Donanım / Aksesuar Açıklaması</th><th>Miktar</th><th>Birim Fiyat (€)</th><th>Toplam (€)</th></tr></thead>
    <tbody>
      ${bom.hardwareList.map((h) => `<tr><td><code>${escapeHtml(h.sku)}</code></td><td>${escapeHtml(h.name)}</td><td>${escapeHtml(h.quantity)} ${escapeHtml(h.unit)}</td><td>€${(h.unitPrice ?? 0).toFixed(2)}</td><td>€${(h.totalPrice ?? 0).toFixed(2)}</td></tr>`).join("")}
    </tbody>
  </table>
  <div class="total-box">
    <div style="font-size:13px;color:#d6d3d1;">KDV Dahil Genel Toplam Teklif Tutarı</div>
    <div style="font-size:26px;font-weight:900;color:#fbbf24;">€${(pricing.totalWithVatEur ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} (${(pricing.totalWithVatTry ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL)</div>
  </div>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Musteri_Teklif_Foyu_${project.id}_v${project.version}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    setExportStatusBanner(`${filename} indirildi`);
    setTimeout(() => setExportStatusBanner(null), 3500);
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  };

  const engGate = evaluateUnifiedEngineeringModel(project);

  const checkGateBeforeProductionExport = (formatLabel: string): boolean => {
    if (!engGate.canExportToCncAndSaw) {
      const firstErr = engGate.blockingSafetyAndEngineeringErrors[0];
      setExportStatusBanner(
        `ÜRETİM KİLİTLİ (${formatLabel}): [${firstErr?.code || "ENGEL"}] ${
          firstErr?.message || "Kritik mühendislik/güvenlik hatasını çözmeden üretim dosyası indirilemez."
        }`
      );
      return false;
    }
    return true;
  };

  const handleApplyApprovedFixInModal = (proposal: RemediationProposal) => {
    useConfiguratorStore.getState().applyApprovedEngineeringFix(proposal);
    setExportStatusBanner(`Onaylı düzeltme uygulandı (BOM & Fiyat güncellendi): ${proposal.label}`);
  };

  const downloadCamZipArchive = () => {
    if (!checkGateBeforeProductionExport("CAM ZIP")) return;
    const zipBytes = exportIndustrialCamZipArchive(project, bom);
    const blob = new Blob([zipBytes as unknown as BlobPart], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CAM_DXF_Paketi_${project.id}_v${project.version}.zip`;
    document.body.appendChild(a);
    a.click();
    setExportStatusBanner(`CAM_DXF_Paketi_${project.id}_v${project.version}.zip indirildi`);
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatusBanner(null);
    }, 2500);
  };

  const downloadOptiCutCsv = () => {
    if (!checkGateBeforeProductionExport("OptiCut CSV")) return;
    const matMap = new Map(
      [...DEFAULT_MATERIALS, ...(project.customMaterials || [])].map((m) => [m.id, m])
    );
    const csvOut = exportOptiCutCutListCsv(bom, matMap);
    downloadFile(
      csvOut,
      `OptiCut_17Sutun_Kesim_${project.id}_v${project.version}.csv`,
      "text/csv;charset=utf-8"
    );
  };

  const downloadHardwareBomCsv = () => {
    const csvOut = exportHardwareBomCsv(bom);
    downloadFile(
      csvOut,
      `Donanim_BOM_${project.id}_v${project.version}.csv`,
      "text/csv;charset=utf-8"
    );
  };

  const downloadHardwareCertificationCsv = () => {
    const summary = buildHardwareCertificationSummary(V4_HARDWARE_CATALOG, project);
    const csvOut = exportHardwareCertificationCsv(summary);
    downloadFile(
      csvOut,
      `Fabrika_Donanim_Sertifikasyon_${project.id}_v${project.version}.csv`,
      "text/csv;charset=utf-8"
    );
    setExportStatusBanner(
      `56 donanım fabrika sertifikasyon listesi indirildi (${summary.productionReadyCount} hazır · ${summary.reviewRequiredCount} onay bekliyor).`
    );
  };

  const printBomOrNestingSheet = (mode: "nesting" | "bom") => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const dateStr = new Date().toLocaleDateString("tr-TR");
    if (mode === "nesting") {
      const sheetSvgs = Array.from(
        document.querySelectorAll('[data-testid^="bom-nesting-svg-sheet-"]')
      );
      const svgBlocks =
        sheetSvgs.length > 0
          ? sheetSvgs
              .map((el, i) => {
                const clone = el.cloneNode(true) as SVGSVGElement;
                clone.setAttribute("style", "width:100%;height:auto;max-height:155mm;display:block;background:#FFFFFF;");
                return `<div class="sheet-block"><h4>Plaka #${i + 1} Yerleşim Şeması</h4>${new XMLSerializer().serializeToString(clone)}</div>`;
              })
              .join("")
          : `<div class="sheet-block">${generateNestingDiagramSvg(bom)}</div>`;
      const utilPct = erpNestingBundle ? erpNestingBundle.summary.overall_utilization_percent : "-";
      const totalSheets = erpNestingBundle
        ? erpNestingBundle.summary.total_sheets_used
        : bom.nestingResults.reduce((s, r) => s + r.totalSheetsCount, 0);
      const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>Birim 2D Plaka Nesting — ${project.title}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: -apple-system, Segoe UI, sans-serif; margin: 0; padding: 14px; color: #0F172A; background: #FFFFFF; }
          .hdr { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #0F172A; padding-bottom:8px; margin-bottom:12px; }
          .sheet-block { page-break-inside: avoid; border:1px solid #CBD5E1; border-radius:10px; padding:10px; margin-bottom:14px; background:#FFFFFF; }
          h4 { margin: 0 0 6px; font-size: 13px; color: #0F172A; }
        </style></head><body>
        <div class="hdr">
          <div><div style="font-size:18px;font-weight:900;">BİRİM® 2D PLAKA NESTİNG &amp; KESİM YERLEŞİM PAFTASI</div>
          <div style="font-size:11px;color:#475569;">${project.title} • Toplam Plaka: ${totalSheets} Adet • Verimlilik: %${utilPct} • Tarih: ${dateStr}</div></div>
        </div>
        ${svgBlocks}
        <script>window.onload=()=>setTimeout(()=>window.print(),280);</script></body></html>`;
      const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const cutRows = bom.cutList
      .map(
        (c, idx) =>
          `<tr><td>${idx + 1}</td><td><b>${c.pieceName}</b></td><td>${c.materialId}</td><td style="text-align:right">${Math.round(c.lengthMm)}×${Math.round(c.widthMm)}×${c.thicknessMm}</td><td style="text-align:right">${c.quantity}</td></tr>`
      )
      .join("");
    const hwRows = bom.hardwareList
      .map(
        (h) =>
          `<tr><td><code>${h.sku}</code></td><td>${h.name}</td><td style="text-align:right"><b>${h.quantity} ${h.unit}</b></td></tr>`
      )
      .join("");
    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>Birim Kesim & Hırdavat Listesi — ${project.title}</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        body { font-family: -apple-system, Segoe UI, sans-serif; margin: 0; padding: 14px; color: #0F172A; background: #FFFFFF; }
        .hdr { display:flex; justify-content:space-between; border-bottom:2px solid #0F172A; padding-bottom:8px; margin-bottom:12px; }
        table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:14px; }
        th, td { border:1px solid #CBD5E1; padding:5px 7px; text-align:left; }
        th { background:#F1F5F9; font-weight:800; }
      </style></head><body>
      <div class="hdr">
        <div><div style="font-size:18px;font-weight:900;">BİRİM® KESİM LİSTESİ (BOM) &amp; HIRDAVAT FÖYÜ</div>
        <div style="font-size:11px;color:#475569;">${project.title} • Toplam Parça: ${bom.cutList.length} • Tarih: ${dateStr}</div></div>
      </div>
      <h3 style="font-size:14px;margin:0 0 6px;">Net Kesim Parça Listesi</h3>
      <table><thead><tr><th>#</th><th>Parça Adı</th><th>Malzeme</th><th style="text-align:right">Ölçü (mm)</th><th style="text-align:right">Adet</th></tr></thead><tbody>${cutRows}</tbody></table>
      <h3 style="font-size:14px;margin:0 0 6px;">Hırdavat &amp; Bağlantı Elemanları</h3>
      <table><thead><tr><th>SKU</th><th>Donanım</th><th style="text-align:right">Miktar</th></tr></thead><tbody>${hwRows}</tbody></table>
      <script>window.onload=()=>setTimeout(()=>window.print(),260);</script></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadNestingSvg = () => {
    const svgOut = generateNestingDiagramSvg(bom);
    downloadFile(
      svgOut,
      `Plaka_Nesting_${project.id}_v${project.version}.svg`,
      "image/svg+xml;charset=utf-8"
    );
  };

  const downloadThermalLabelsHtml = () => {
    if (!checkGateBeforeProductionExport("Termal Etiket HTML")) return;
    const htmlOut = generateThermalPartLabelsHtml(project, bom);
    downloadFile(
      htmlOut,
      `Termal_Barkod_Etiketler_100x50_${project.id}_v${project.version}.html`,
      "text/html;charset=utf-8"
    );
  };

  const downloadThermalLabelsZpl = () => {
    if (!checkGateBeforeProductionExport("Zebra ZPL Etiket")) return;
    const zplOut = generateThermalPartLabelsZpl(project, bom);
    downloadFile(
      zplOut,
      `Termal_Zebra_Barkod_100x50_${project.id}_v${project.version}.zpl`,
      "text/plain;charset=utf-8"
    );
  };

  const downloadArchitectMepDxf = () => {
    const dxfOut = exportArchitecturalMepDxf(project);
    downloadFile(
      dxfOut,
      `Santiye_MEP_Tesisat_Paftasi_${project.id}_v${project.version}.dxf`,
      "application/dxf"
    );
  };

  const downloadBlumBxf = () => {
    if (!checkGateBeforeProductionExport("Blum BXF XML")) return;
    const xmlOut = blumBxfXml || generateBlumBxfXml(project, bom);
    downloadFile(
      xmlOut,
      `Blum_Easystick_${project.id}_v${project.version}.bxf`,
      "application/xml;charset=utf-8"
    );
  };

  const downloadErpNestingJson = () => {
    if (!checkGateBeforeProductionExport("ERP Nesting JSON")) return;
    if (!erpNestingBundle) return;
    downloadFile(
      JSON.stringify(erpNestingBundle, null, 2),
      `Birim_ERP_Nesting_${project.id}_v${project.version}.json`,
      "application/json;charset=utf-8"
    );
  };

  const downloadErpSelcoCsv = () => {
    if (!checkGateBeforeProductionExport("ERP Selco CSV")) return;
    if (!erpNestingBundle) return;
    downloadFile(
      erpNestingBundle.combined_selco_csv,
      `NST_${project.id}_SELCO_WNT600.csv`,
      "text/csv;charset=utf-8"
    );
  };

  const downloadErpCncGCode = () => {
    if (!checkGateBeforeProductionExport("ERP CNC G-Code")) return;
    if (!erpNestingBundle) return;
    downloadFile(
      erpNestingBundle.combined_cnc_gcode,
      `NST_${project.id}_all.nc`,
      "text/plain;charset=utf-8"
    );
  };

  const downloadJson = () => {
    downloadFile(
      JSON.stringify(bom, null, 2),
      `BOM_${project.id}_v${project.version}.json`,
      "application/json;charset=utf-8"
    );
  };

  const downloadCsv = () => {
    if (!checkGateBeforeProductionExport("Kesim CSV")) return;
    const csvContent = exportCutListToCSV(bom);
    downloadFile(
      csvContent,
      `Kesim_Listesi_${project.id}_v${project.version}.csv`,
      "text/csv;charset=utf-8"
    );
  };

  const downloadPieceDXF = (piece: CutPiece) => {
    if (!checkGateBeforeProductionExport(`Tekil Parça DXF (${piece.id})`)) return;
    const dxfContent = generatePanelDXF(piece);
    downloadFile(dxfContent, `${piece.id}.dxf`, "application/dxf;charset=utf-8");
  };

  const downloadSampleDXF = () => {
    const piece = bom.cutList[0];
    if (!piece) return;
    downloadPieceDXF(piece);
  };

  const downloadAllPanelsDXF = () => {
    if (!checkGateBeforeProductionExport("Tüm Paneller DXF")) return;
    if (!bom.cutList.length) return;
    const dxfContent = exportAllPanelsDXF(bom);
    downloadFile(
      dxfContent,
      `Tum_Paneller_CNC_${project.id}_v${project.version}.dxf`,
      "application/dxf;charset=utf-8"
    );
  };

  const downloadNestingSheetsDXF = () => {
    if (!checkGateBeforeProductionExport("Plaka Nesting DXF")) return;
    const dxfContent = exportNestingSheetsDXF(bom);
    downloadFile(
      dxfContent,
      `Plaka_Yerlesim_Kesim_Semasi_2800x2070_${project.id}_v${project.version}.dxf`,
      "application/dxf;charset=utf-8"
    );
  };

  const assemblySteps = generateAssemblyInstructions(project, bom);
  const selcoPackage = bom.nestingResults[0]
    ? generateSelcoExportPackage(bom.nestingResults[0].sheets)
    : null;
  const gateChecks = bom.productionGate?.checks || [];
  const shelfDeflections = bom.shelfDeflectionAnalyses || [];
  const totalHardwareEur = bom.hardwareList.reduce((acc, h) => acc + (h.totalPrice ?? 0), 0);

  const filteredCutList = bom.cutList.filter((p) => {
    const q = cutSearch.trim().toLowerCase();
    if (
      q &&
      !p.pieceName.toLowerCase().includes(q) &&
      !p.id.toLowerCase().includes(q) &&
      !p.moduleName.toLowerCase().includes(q) &&
      !p.materialName.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (cutFilter === "band4") return countActiveBands(p.edgeBanding) === 4;
    if (cutFilter === "cnc") return (p.holes?.length || 0) > 0 || Boolean(p.hasBackGroove || p.kerfBendingMeta || p.tambourTrackGrooveSpec);
    if (cutFilter === "shelf") return /raf|shelf/i.test(p.pieceName) || /shelf/i.test(p.componentRole);
    if (cutFilter === "plinth") return /baza|plinth/i.test(p.pieceName) || /plinth/i.test(p.componentRole);
    return true;
  });

  const groupedCutMap = new Map<string, { key: string; moduleName: string; materialName: string; thicknessMm: number; pieces: CutPiece[] }>();
  for (const p of filteredCutList) {
    const gk = `${p.moduleName}__${p.materialName}__${p.thicknessMm}`;
    let grp = groupedCutMap.get(gk);
    if (!grp) {
      grp = { key: gk, moduleName: p.moduleName, materialName: p.materialName, thicknessMm: p.thicknessMm, pieces: [] };
      groupedCutMap.set(gk, grp);
    }
    grp.pieces.push(p);
  }
  const groupedCutList = Array.from(groupedCutMap.values());

  const activeCutPiece =
    filteredCutList.find((p) => p.id === selectedCutPieceId) ||
    bom.cutList.find((p) => p.id === selectedCutPieceId) ||
    filteredCutList[0] ||
    bom.cutList[0] ||
    null;

  const navigateCutPiece = (dir: -1 | 1) => {
    const list = filteredCutList.length > 0 ? filteredCutList : bom.cutList;
    if (!list.length) return;
    const curIdx = activeCutPiece ? list.findIndex((p) => p.id === activeCutPiece.id) : -1;
    const nextIdx = curIdx === -1 ? 0 : (curIdx + dir + list.length) % list.length;
    setSelectedCutPieceId(list[nextIdx].id);
    if (!inspectorOpen) setInspectorOpen(true);
  };

  const toggleCutRowChecked = (id: string) => {
    setCheckedCutIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisibleChecked = (checked: boolean) => {
    setCheckedCutIds((prev) => {
      const next = new Set(prev);
      for (const p of filteredCutList) {
        if (checked) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  };

  const toggleGroupCollapsed = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const copyPieceId = (id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(id).catch(() => {});
    }
    setExportStatusBanner(`Teknik kod kopyalandı: ${id}`);
    setTimeout(() => setExportStatusBanner(null), 2400);
  };

  const downloadSelectedPiecesDxf = () => {
    const selected = bom.cutList.filter((p) => checkedCutIds.has(p.id));
    if (!selected.length) return;
    if (selected.length === 1) {
      downloadPieceDXF(selected[0]);
      return;
    }
    if (!checkGateBeforeProductionExport(`Seçili Parçalar DXF (${selected.length})`)) return;
    selected.slice(0, 6).forEach((p, i) => {
      setTimeout(() => downloadPieceDXF(p), i * 180);
    });
    if (selected.length > 6) {
      downloadAllPanelsDXF();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[155] flex items-center justify-center bg-[#141413]/52 backdrop-blur-xs p-0 md:p-5"
    >
      <div
        data-draggable-shell="bom"
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col w-full max-w-6xl h-[91dvh] birim-ice-modal rounded-[28px] max-md:rounded-none max-md:h-[100dvh] max-md:max-h-[100dvh] overflow-hidden text-[#141413]"
      >
        {/* Row 1: Refined Single Command Header + 3-Column Export Mega-Popover */}
        <div
          onPointerDown={(e) => startZeroLagModalDrag(e)}
          title="Pencereyi taşımak için basılı tutup sürükleyin"
          className="px-4 sm:px-5 py-3 birim-ice-shell-header flex flex-wrap items-center justify-between gap-2.5 cursor-grab active:cursor-grabbing select-none relative z-30"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <BirimLogo className="h-4 sm:h-5 w-auto text-[#141413] shrink-0" />
            <div className="h-5 w-px bg-[#141413]/15 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-extrabold text-[#141413] tracking-tight leading-tight">
                  <span className="hidden sm:inline">BOM &amp; İmalat Portalı</span><span className="sm:hidden">BOM &amp; CNC</span>
                </h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border whitespace-nowrap shrink-0 ${
                    bom.approvalStatus === "production_approved"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "bg-amber-50 border-amber-300 text-amber-900"
                  }`}
                >
                  v{project.version} •{" "}
                  {bom.approvalStatus === "production_approved" ? "ONAYLI" : "TASLAK"}
                </span>
                {exportStatusBanner && (
                  <span className="hidden xl:inline text-[10.5px] px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 font-semibold truncate max-w-[220px]">
                    ✓ {exportStatusBanner}
                  </span>
                )}
              </div>
              <div className="text-[11px] font-medium text-[#57534E] truncate mt-0.5">
                {project.title}
              </div>
            </div>
          </div>

          {/* Right: Unified Command Pill Group + Close */}
          <div
            className="flex items-center gap-2 shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="inline-flex items-center p-1 gap-1 rounded-2xl bg-black/15 border border-white/15 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]">
            {/* 1. Categorized "Dışa Aktar ▾" 3-Column Mega-Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExportMenuOpen((v) => !v);
                }}
                data-testid="bom-export-menu-btn"
                className="h-8 px-2.5 sm:px-3 rounded-xl birim-ice-btn text-xs font-bold text-[#141413] inline-flex items-center gap-1.5 cursor-pointer"
                title="16 farklı kesim, CAD, etiket ve makine çıktı formatı"
              >
                <Download className="w-3.5 h-3.5 text-[#57534E]" />
                <span className="hidden sm:inline">Dışa Aktar</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#78716C] transition-transform duration-150 ${
                    exportMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {exportMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="fixed sm:absolute right-3 sm:right-0 top-[56px] sm:top-full sm:mt-2 w-[calc(100vw-24px)] sm:w-[680px] max-h-[78dvh] overflow-y-auto bg-[#FAF8F4]/98 backdrop-blur-xl border border-[#D6CFC2] rounded-2xl shadow-2xl p-3.5 sm:p-4 z-50 text-[#141413]"
                >
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#E5DFD3]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#141413]">
                        Dışa Aktarma &amp; Makine Çıktıları
                      </span>
                      <span className="text-[10px] font-mono text-[#78716C]">16 format</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#57534E] px-2 py-0.5 rounded bg-white border border-[#E5DFD3]">
                      AC1015 / mm
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Col 1: Kesim & Liste */}
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C] px-2 mb-1.5">
                        Kesim &amp; Liste
                      </div>
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadOptiCutCsv(); }}
                          data-testid="bom-download-opticut-csv-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">OptiCut CSV</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-teal-700 font-bold">CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadCsv(); }}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">Standart Kesim CSV</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-emerald-700 font-bold">CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadHardwareBomCsv(); }}
                          data-testid="bom-download-hw-csv-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">Hırdavat CSV</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-sky-700 font-bold">CSV</span>
                        </button>
                        <button
                          type="button"
                          data-testid="download-hardware-cert-csv-btn"
                          onClick={() => { setExportMenuOpen(false); downloadHardwareCertificationCsv(); }}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-bold text-blue-800 truncate">56 Donanım Sertifikasyon</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold">CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadJson(); }}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#44403C] truncate">Ham Üretim BOM</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-[#78716C] font-bold">JSON</span>
                        </button>
                      </div>
                    </div>

                    {/* Col 2: CAD & Plaka */}
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C] px-2 mb-1.5">
                        CAD &amp; Plaka
                      </div>
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadAllPanelsDXF(); }}
                          data-testid="bom-download-all-dxf-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-bold text-indigo-800 truncate">Tüm Parçalar DXF ({bom.cutList.length})</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">DXF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadNestingSheetsDXF(); }}
                          data-testid="bom-download-nesting-dxf-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">2800×2070 Plaka Şeması</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-purple-700 font-bold">DXF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadNestingSvg(); }}
                          data-testid="bom-download-nesting-svg-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">Plaka Nest Şeması</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-fuchsia-700 font-bold">SVG</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadSampleDXF(); }}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#44403C] truncate">Örnek Tekil Parça</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-blue-700 font-bold">1×DXF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadArchitectMepDxf(); }}
                          data-testid="bom-download-mep-dxf-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">Şantiye MEP Tesisat</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-amber-700 font-bold">DXF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); printBomOrNestingSheet(activeTab === "nesting" ? "nesting" : "bom"); }}
                          data-testid="bom-print-active-sheet-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-bold text-blue-700 truncate">Aktif Ekranı Yazdır</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold">A4</span>
                        </button>
                      </div>
                    </div>

                    {/* Col 3: Etiket & Makine Köprüsü */}
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C] px-2 mb-1.5">
                        Etiket &amp; Makine Köprüsü
                      </div>
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadThermalLabelsHtml(); }}
                          data-testid="bom-download-thermal-labels-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">Termal Etiket 100×50</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-orange-700 font-bold">HTML</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadThermalLabelsZpl(); }}
                          data-testid="bom-download-zpl-labels-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-semibold text-[#141413] truncate">Zebra Barkod Akışı</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E5DFD3] text-stone-700 font-bold">ZPL</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadBlumBxf(); }}
                          data-testid="bom-download-bxf-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-bold text-amber-800 truncate">Blum EASYSTICK</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold">BXF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExportMenuOpen(false); downloadCustomerQuoteHtml(); }}
                          data-testid="bom-download-quote-btn"
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#EFECE4] flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <span className="text-xs font-bold text-emerald-800 truncate">Müşteri Teklif Föyü</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">HTML</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Subtle ERP Button */}
            <button
              type="button"
              onClick={downloadErpNestingJson}
              data-testid="bom-download-erp-nesting-json-btn"
              className="h-8 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              title="Birim Portal ERP Nesting modülüyle %100 uyumlu JSON paketini indir"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>ERP</span>
            </button>

            {/* 3. Primary CAM .ZIP Button */}
            <button
              type="button"
              onClick={downloadCamZipArchive}
              data-testid="bom-download-cam-zip-btn"
              className="h-8 px-3 rounded-xl birim-ice-charcoal-pill shadow-[0_4px_14px_rgba(37,99,235,0.42)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              title="Her parça için ayrı endüstriyel katmanlı CNC .DXF dosyaları içeren .ZIP paketini indir"
            >
              <Package className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">CAM .ZIP</span><span className="sm:hidden">ZIP</span>
            </button>

            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              title="Kapat"
              className="w-8 h-8 rounded-full birim-ice-btn flex items-center justify-center text-[#57534E] hover:text-[#141413] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Engineering Safety / Verification Gate Banners (if any) */}
        {(!engGate.canExportToCncAndSaw ||
          engGate.verificationRequiredFindings.some((f) => f.remediationProposals?.length)) && (
          <div className="px-5 py-2.5 bg-[#F8F5EE] border-b border-[#E5DFD3] space-y-2 text-xs">
            {!engGate.canExportToCncAndSaw && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-300 text-red-950 space-y-2">
                <div className="font-bold text-red-900">
                  Üretim Onay Kapısı Kilitli — {engGate.blockingSafetyAndEngineeringErrors.length} Kritik Mühendislik / Güvenlik Engeli
                </div>
                {engGate.blockingSafetyAndEngineeringErrors.slice(0, 3).map((err) => (
                  <div
                    key={`${err.code}_${err.targetId}`}
                    className="p-2.5 rounded-xl bg-white border border-red-200 space-y-1.5"
                  >
                    <div>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-900 font-bold mr-1.5">
                        {err.ruleNature === "MANDATORY_SAFETY" ? "ZORUNLU GÜVENLİK" : "MÜHENDİSLİK"} •{" "}
                        {formatIssueHumanTitle(err.code, "studio")}
                      </span>
                      <span>{err.message}</span>
                    </div>
                    {err.remediationProposals && err.remediationProposals.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {err.remediationProposals.map((prop) => (
                          <button
                            key={prop.id}
                            type="button"
                            onClick={() => handleApplyApprovedFixInModal(prop)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-[11px] cursor-pointer transition"
                          >
                            Onayla ve Uygula: {prop.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {engGate.canExportToCncAndSaw &&
              engGate.verificationRequiredFindings.some((f) => f.remediationProposals?.length) && (
                <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1.5">
                  {engGate.verificationRequiredFindings
                    .filter((f) => f.remediationProposals?.length)
                    .slice(0, 2)
                    .map((vf) => (
                      <div
                        key={`${vf.code}_${vf.targetId}`}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span>
                          [{formatIssueHumanTitle(vf.code, "studio")}] {vf.message}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {vf.remediationProposals!.map((prop) => (
                            <button
                              key={prop.id}
                              type="button"
                              onClick={() => handleApplyApprovedFixInModal(prop)}
                              className="px-2.5 py-1 rounded-lg bg-[#141413] hover:bg-stone-800 text-white font-bold text-[11px] cursor-pointer transition"
                            >
                              {prop.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
          </div>
        )}

        {/* Modern Mini Info Panels (5 Tactile KPI Cards) */}
        <div className="px-3.5 sm:px-5 py-2.5 bg-[#F5F2EA] border-b border-[#E5DFD3]">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <div className="px-3 py-2 rounded-xl bg-white/90 border border-[#E5DFD3] shadow-2xs flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-slate-500/15 border border-slate-400/25 flex items-center justify-center shrink-0">
                <Package className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#78716C] truncate">
                  Toplam Parça
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-mono text-sm font-extrabold text-[#141413] tabular-nums leading-none">
                    {bom.summary.totalPiecesCount}
                  </span>
                  <span className="text-[10px] text-[#78716C]">adet</span>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-white/90 border border-[#E5DFD3] shadow-2xs flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#78716C] truncate">
                  Net Panel Alanı
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-mono text-sm font-extrabold text-amber-800 tabular-nums leading-none">
                    {bom.summary.totalPanelAreaM2}
                  </span>
                  <span className="text-[10px] text-[#78716C]">m²</span>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-white/90 border border-[#E5DFD3] shadow-2xs flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shrink-0">
                <Tag className="w-3.5 h-3.5 text-sky-500" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#78716C] truncate">
                  Kenar Bandı
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-mono text-sm font-extrabold text-blue-800 tabular-nums leading-none">
                    {bom.summary.totalEdgeBandMeters}
                  </span>
                  <span className="text-[10px] text-[#78716C]">mt</span>
                </div>
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-white/90 border border-[#E5DFD3] shadow-2xs flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <ListOrdered className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#78716C] truncate">
                  Hırdavat &amp; Ray
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-mono text-sm font-extrabold text-emerald-800 tabular-nums leading-none">
                    {bom.summary.totalHardwareCount}
                  </span>
                  <span className="text-[10px] text-[#78716C]">adet</span>
                </div>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl bg-white/90 border border-[#E5DFD3] shadow-2xs flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shrink-0">
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#78716C] truncate">
                  CNC Delik
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-mono text-sm font-extrabold text-sky-400 tabular-nums leading-none">
                    {bom.summary.totalDrillingHolesCount}
                  </span>
                  <span className="text-[10px] text-[#78716C]">işlem</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: Grouped Segmented Track with Smooth Sliding Active Pill */}
        <div className="px-3.5 sm:px-5 py-2 bg-white/85 border-b border-[#E5DFD3]">
          <div
            ref={tabGroupRef}
            className="relative inline-flex flex-wrap items-center p-1 gap-1 rounded-2xl bg-black/15 border border-white/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)] text-[11.5px] max-w-full"
          >
            {tabIndicator.ready && (
              <span
                aria-hidden="true"
                style={{
                  transform: `translate3d(${tabIndicator.left}px, ${tabIndicator.top}px, 0)`,
                  width: `${tabIndicator.width}px`,
                  height: `${tabIndicator.height}px`,
                  transition:
                    "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), width 260ms cubic-bezier(0.22, 1, 0.36, 1), height 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
                className="pointer-events-none absolute left-0 top-0 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#2563EB] shadow-[0_6px_18px_rgba(37,99,235,0.52),inset_0_1px_0_rgba(255,255,255,0.28)] z-0"
              />
            )}
            {(
              [
                { id: "cutlist", label: "Kesim & CNC", count: bom.cutList.length, testId: undefined, icon: null },
                { id: "hardware", label: "Hırdavat", count: bom.hardwareList.length, testId: undefined, icon: null },
                {
                  id: "nesting",
                  label: "2D Nesting",
                  count: erpNestingBundle
                    ? erpNestingBundle.summary.total_sheets_used
                    : bom.nestingResults.reduce((s, r) => s + r.totalSheetsCount, 0),
                  testId: undefined,
                  icon: null,
                },
                { id: "validation", label: "Doğrulama", count: gateChecks.length, testId: "bom-tab-validation", icon: "shield" },
                { id: "assembly", label: "Montaj", count: assemblySteps.length, testId: undefined, icon: "list" },
                { id: "quote", label: "Teklif Föyü", count: null, testId: "bom-tab-quote", icon: null },
                { id: "blum_bxf", label: "Blum BXF", count: null, testId: "bom-tab-blum-bxf", icon: null },
                { id: "selco", label: "Selco", count: null, testId: undefined, icon: "cpu" },
                { id: "cnc_mpr_cix", label: "CNC .MPR/.CIX", count: null, testId: "bom-tab-cnc-mpr-cix", icon: "cpu" },
              ] as const
            ).map((t) => {
              const isAct = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabBtnRefs.current[t.id] = el;
                  }}
                  type="button"
                  data-testid={t.testId}
                  onClick={() => setActiveTab(t.id)}
                  className={`relative z-10 px-2.5 py-1.5 rounded-xl transition-colors duration-200 cursor-pointer shrink-0 inline-flex items-center gap-1.5 ${
                    isAct
                      ? "text-white font-bold"
                      : "text-[#57534E] hover:text-[#141413] font-semibold"
                  }`}
                >
                  {t.icon === "shield" && <ShieldCheck className="w-3.5 h-3.5" />}
                  {t.icon === "list" && <ListOrdered className="w-3.5 h-3.5" />}
                  {t.icon === "cpu" && <Cpu className="w-3.5 h-3.5" />}
                  <span>{t.label}</span>
                  {t.count !== null && (
                    <span
                      className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] tabular-nums ${
                        isAct ? "bg-white/20 text-white" : "bg-black/10 text-inherit"
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-5 bg-[#FAF8F4] text-xs">
          {/* TAB 1: CUT LIST & DRILLING — Master-Detail Engineering Workspace */}
          {activeTab === "cutlist" && (
            <div
              onClick={() => exportMenuOpen && setExportMenuOpen(false)}
              className="flex flex-col xl:flex-row gap-4 items-start"
            >
              {/* LEFT / MAIN: Toolbar + Bulk Action Bar + Grouped Cut-List Table */}
              <div className="flex-1 min-w-0 w-full space-y-3">
                {/* Streamlined Single-Row Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                    <div className="relative w-full sm:w-52">
                      <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={cutSearch}
                        onChange={(e) => setCutSearch(e.target.value)}
                        placeholder="Parça veya malzeme ara..."
                        className="w-full h-8 pl-8 pr-2.5 rounded-xl bg-white border border-[#DED8CC] text-xs text-[#141413] placeholder-[#A8A29E] focus:outline-none focus:border-[#141413] transition"
                      />
                    </div>

                    <div
                      ref={filterGroupRef}
                      className="relative inline-flex items-center p-1 gap-0.5 rounded-2xl bg-black/15 border border-white/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)] overflow-x-auto max-w-full"
                    >
                      {filterIndicator.ready && (
                        <span
                          aria-hidden="true"
                          style={{
                            transform: `translate3d(${filterIndicator.left}px, ${filterIndicator.top}px, 0)`,
                            width: `${filterIndicator.width}px`,
                            height: `${filterIndicator.height}px`,
                            transition:
                              "transform 240ms cubic-bezier(0.22, 1, 0.36, 1), width 240ms cubic-bezier(0.22, 1, 0.36, 1)",
                          }}
                          className="pointer-events-none absolute left-0 top-0 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#2563EB] shadow-[0_4px_14px_rgba(37,99,235,0.48),inset_0_1px_0_rgba(255,255,255,0.28)] z-0"
                        />
                      )}
                      {(
                        [
                          { id: "all", label: "Tümü" },
                          { id: "band4", label: "4 Kenar Bantlı" },
                          { id: "cnc", label: "CNC'li" },
                          { id: "shelf", label: "Raflar" },
                          { id: "plinth", label: "Baza" },
                        ] as const
                      ).map((f) => {
                        const active = cutFilter === f.id;
                        return (
                          <button
                            key={f.id}
                            ref={(el) => {
                              filterBtnRefs.current[f.id] = el;
                            }}
                            type="button"
                            onClick={() => setCutFilter(f.id)}
                            className={`relative z-10 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors duration-200 cursor-pointer whitespace-nowrap ${
                              active
                                ? "text-white"
                                : "text-[#57534E] hover:text-[#141413]"
                            }`}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="inline-flex items-center p-1 gap-1 rounded-2xl bg-black/15 border border-white/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)]">
                    <button
                      type="button"
                      onClick={() => setShowTechIds((v) => !v)}
                      className={`h-7 px-2.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                        showTechIds
                          ? "bg-gradient-to-r from-[#0284C7] to-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.45)]"
                          : "text-[#57534E] hover:text-[#141413]"
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Teknik Kodlar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInspectorOpen((v) => !v)}
                      className={`h-7 px-2.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                        inspectorOpen
                          ? "bg-gradient-to-r from-[#0284C7] to-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.45)]"
                          : "text-[#57534E] hover:text-[#141413]"
                      }`}
                      title="2D Teknik Çizim İnceleme Panelini Aç/Kapat"
                    >
                      {inspectorOpen ? (
                        <PanelRightClose className="w-3.5 h-3.5" />
                      ) : (
                        <PanelRightOpen className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">2D İnceleme</span>
                    </button>
                  </div>
                </div>

                {/* Contextual Multi-Select Bulk Action Bar */}
                {checkedCutIds.size > 0 && (
                  <div className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-blue-700 text-white font-mono text-[11px] font-bold flex items-center justify-center">
                        {checkedCutIds.size}
                      </span>
                      <span className="text-blue-950 font-bold">{checkedCutIds.size} parça seçildi</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={downloadSelectedPiecesDxf}
                        className="px-2.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Seçili DXF İndir</span>
                      </button>
                      <button
                        type="button"
                        onClick={downloadThermalLabelsHtml}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100 border border-blue-200 text-blue-950 text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Printer className="w-3 h-3" />
                        <span>100×50 Etiket</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckedCutIds(new Set())}
                        className="px-2 py-1 rounded-lg text-[#57534E] hover:text-[#141413] text-[11px] font-semibold cursor-pointer"
                      >
                        Temizle
                      </button>
                    </div>
                  </div>
                )}

                {/* Grouped & Scannable Cut-List Table */}
                <div className="bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs overflow-hidden">
                  {groupedCutList.length === 0 ? (
                    <div className="py-10 text-center text-[#78716C] text-xs">
                      Arama veya filtre kriterine uygun kesim parçası bulunamadı.
                    </div>
                  ) : (
                    groupedCutList.map((grp, gIdx) => {
                      const isCollapsed = collapsedGroups.has(grp.key);
                      const grpArea = grp.pieces.reduce((s, p) => s + (p.areaM2 || 0), 0);
                      const grpBand = grp.pieces.reduce((s, p) => s + (p.edgeBandMeters || 0), 0);
                      const allGrpChecked = grp.pieces.every((p) => checkedCutIds.has(p.id));
                      return (
                        <div key={grp.key} className={gIdx > 0 ? "border-t border-[#E5DFD3]" : ""}>
                          {/* Collapsible Module + Material Group Header */}
                          <div
                            onClick={() => toggleGroupCollapsed(grp.key)}
                            className="px-4 py-2.5 bg-[#F5F2EA] hover:bg-[#EFECE4] border-b border-[#E5DFD3] flex flex-wrap items-center justify-between gap-2 cursor-pointer transition"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                              )}
                              <span className="font-bold text-[#141413] truncate">{grp.moduleName}</span>
                              <span className="text-[#A8A29E]">•</span>
                              <span className="text-[#57534E] font-medium truncate">{grp.materialName}</span>
                              <span className="text-[#A8A29E]">•</span>
                              <span className="font-mono text-[11px] font-bold text-[#141413]">
                                {grp.thicknessMm}mm
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] font-mono text-[#57534E] tabular-nums">
                              <span>{grp.pieces.length} parça</span>
                              <span>•</span>
                              <span>{grpArea.toFixed(2)} m²</span>
                              <span>•</span>
                              <span className="text-amber-800 font-bold">{grpBand.toFixed(2)} mt</span>
                            </div>
                          </div>

                          {!isCollapsed && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead className="bg-[#FAF8F4] text-[#78716C] uppercase tracking-wider text-[10px] border-b border-[#ECE7DC]">
                                  <tr>
                                    <th className="py-2 pl-3.5 pr-2 w-8">
                                      <input
                                        type="checkbox"
                                        checked={allGrpChecked}
                                        onChange={(e) => toggleAllVisibleChecked(e.target.checked)}
                                        className="rounded border-stone-300 accent-[#141413] cursor-pointer"
                                      />
                                    </th>
                                    <th className="py-2 px-2 font-bold">Parça Adı / İşlem</th>
                                    <th className="py-2 px-2 text-right font-bold">Bitmiş (mm)</th>
                                    <th className="py-2 px-2 text-right font-bold">Testere Net (mm)</th>
                                    <th className="py-2 px-2.5 font-bold">Bant</th>
                                    <th className="py-2 px-2 text-right font-bold">CNC</th>
                                    <th className="py-2 px-2 text-right font-bold">Alan (m²)</th>
                                    <th className="py-2 pl-1.5 pr-3 w-10 text-right font-bold">DXF</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#ECE7DC] text-[11.5px]">
                                  {grp.pieces.map((p, idx) => {
                                    const isSel = activeCutPiece?.id === p.id;
                                    const isChk = checkedCutIds.has(p.id);
                                    const bandCount = countActiveBands(p.edgeBanding);
                                    const holeCount = p.holes?.length || 0;
                                    return (
                                      <tr
                                        key={p.id}
                                        onClick={() => {
                                          setSelectedCutPieceId(p.id);
                                          if (!inspectorOpen) setInspectorOpen(true);
                                        }}
                                        className={`group cursor-pointer transition-colors ${
                                          isSel ? "bg-blue-50/75" : "hover:bg-[#FAF7F1]"
                                        }`}
                                      >
                                        <td
                                          className="py-2.5 pl-3.5 pr-2 relative"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {isSel && (
                                            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-700 rounded-r" />
                                          )}
                                          <input
                                            type="checkbox"
                                            checked={isChk}
                                            onChange={() => toggleCutRowChecked(p.id)}
                                            className="rounded border-stone-300 accent-[#141413] cursor-pointer"
                                          />
                                        </td>
                                        <td className="py-2.5 px-2">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-[10px] text-[#A8A29E] tabular-nums">
                                              {String(idx + 1).padStart(2, "0")}
                                            </span>
                                            <span className="font-bold text-[#141413]">{p.pieceName}</span>
                                          </div>
                                          {(showTechIds ||
                                            p.tambourTrackGrooveSpec ||
                                            p.kerfBendingMeta ||
                                            p.hasBackGroove ||
                                            (p.polygonContourMm && p.polygonContourMm.length > 4)) && (
                                            <div className="flex flex-wrap items-center gap-1 mt-0.5 pl-5">
                                              {showTechIds && (
                                                <span className="text-[10px] text-[#78716C] font-mono">{p.id}</span>
                                              )}
                                              {p.tambourTrackGrooveSpec && (
                                                <span className="px-1.5 py-0.2 rounded bg-sky-100 border border-sky-300 text-sky-900 text-[9.5px] font-bold">
                                                  Tambur Ray {p.tambourTrackGrooveSpec.widthMm}×{p.tambourTrackGrooveSpec.depthMm}mm
                                                </span>
                                              )}
                                              {p.kerfBendingMeta && (
                                                <span className="px-1.5 py-0.2 rounded bg-amber-100 border border-amber-300 text-amber-950 text-[9.5px] font-bold">
                                                  CNC Kerf R{p.kerfBendingMeta.outerRadiusMm} ({p.kerfBendingMeta.kerfCount} çentik)
                                                </span>
                                              )}
                                              {p.polygonContourMm && p.polygonContourMm.length > 4 && !p.tambourTrackGrooveSpec && (
                                                <span className="px-1.5 py-0.2 rounded bg-purple-100 border border-purple-300 text-purple-900 text-[9.5px] font-bold">
                                                  5-Eksen Kontur
                                                </span>
                                              )}
                                              {p.hasBackGroove && (
                                                <span className="px-1.5 py-0.2 rounded bg-stone-100 border border-stone-300 text-stone-700 text-[9.5px] font-semibold">
                                                  8mm Kanal
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono font-bold text-[#141413] tabular-nums whitespace-nowrap">
                                          {p.lengthMm} × {p.widthMm}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-800 tabular-nums whitespace-nowrap">
                                          {p.netCutLengthMm ?? p.lengthMm} × {p.netCutWidthMm ?? p.widthMm}
                                        </td>
                                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                                          <div className="flex items-center gap-2">
                                            <MiniEdgeBandSvg edgeBanding={p.edgeBanding} />
                                            <span
                                              className={`font-mono text-[10.5px] font-bold ${
                                                bandCount === 4 ? "text-amber-800" : "text-[#57534E]"
                                              }`}
                                            >
                                              {p.edgeBandCode || (bandCount > 0 ? `${bandCount}K` : "—")}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                                          {holeCount > 0 ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800">
                                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                              {holeCount}
                                            </span>
                                          ) : (
                                            <span className="text-[#A8A29E]">—</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono text-[#57534E] tabular-nums whitespace-nowrap">
                                          {p.areaM2}
                                        </td>
                                        <td
                                          className="py-2.5 pl-1.5 pr-3 text-right"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => downloadPieceDXF(p)}
                                            className="p-1.5 rounded-lg text-[#57534E] hover:text-white hover:bg-[#141413] transition cursor-pointer"
                                            title={`${p.pieceName} için katmanlı AutoCAD DXF indir`}
                                          >
                                            <FileCode className="w-3.5 h-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Clean Table Totals Footer */}
                  <div className="px-4 py-2.5 bg-[#F4F0E8] border-t border-[#E5DFD3] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="text-[#78716C] font-medium">
                      Satıra tıklayarak sağdaki 2D teknik çizimde delik, kanal ve bant detaylarını inceleyin
                    </span>
                    <div className="font-mono font-bold tabular-nums text-[#141413] flex items-center gap-2.5">
                      <span>{bom.summary.totalPiecesCount} Parça</span>
                      <span className="text-[#A8A29E]">•</span>
                      <span className="text-blue-800">{bom.summary.totalEdgeBandMeters} mt Bant</span>
                      <span className="text-[#A8A29E]">•</span>
                      <span className="text-amber-900">{bom.summary.totalPanelAreaM2} m² Alan</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: 2D TECHNICAL BLUEPRINT INSPECTOR (340px on xl, full width below) */}
              {inspectorOpen && activeCutPiece && (
                <aside className="w-full xl:w-[340px] shrink-0 bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs overflow-hidden flex flex-col">
                  {/* Inspector Header */}
                  <div className="px-4 py-3 bg-[#F5F2EA] border-b border-[#E5DFD3] space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider text-blue-800">
                        Parça #{String(Math.max(1, bom.cutList.findIndex((x) => x.id === activeCutPiece.id) + 1)).padStart(2, "0")} / {bom.cutList.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => navigateCutPiece(-1)}
                          className="w-6 h-6 rounded-lg bg-white border border-[#DED8CC] text-[#57534E] hover:text-[#141413] flex items-center justify-center cursor-pointer"
                          title="Önceki parça"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateCutPiece(1)}
                          className="w-6 h-6 rounded-lg bg-white border border-[#DED8CC] text-[#57534E] hover:text-[#141413] flex items-center justify-center cursor-pointer"
                          title="Sonraki parça"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectorOpen(false)}
                          className="w-6 h-6 rounded-lg bg-white border border-[#DED8CC] text-[#57534E] hover:text-[#141413] flex items-center justify-center cursor-pointer ml-0.5"
                          title="Paneli gizle"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-[13px] font-extrabold text-[#141413] leading-snug">
                      {activeCutPiece.pieceName}
                    </h3>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-[#78716C] truncate">
                        {activeCutPiece.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyPieceId(activeCutPiece.id)}
                        className="text-[#78716C] hover:text-blue-700 transition shrink-0 cursor-pointer"
                        title="Teknik kodu kopyala"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Blueprint SVG Canvas + 3 Layer Toggles */}
                  <div className="p-4 space-y-3.5">
                    <div>
                      <CutPieceBlueprintSvg piece={activeCutPiece} layers={blueprintLayers} />
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { key: "bant", label: "Bant", dot: "bg-amber-500" },
                            { key: "cnc", label: "CNC", dot: "bg-blue-500" },
                            { key: "olcu", label: "Ölçü", dot: "bg-emerald-500" },
                          ] as const
                        ).map((ly) => {
                          const on = blueprintLayers[ly.key];
                          return (
                            <button
                              key={ly.key}
                              type="button"
                              onClick={() =>
                                setBlueprintLayers((prev) => ({ ...prev, [ly.key]: !prev[ly.key] }))
                              }
                              className={`h-7 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                                on
                                  ? "bg-[#141413] text-white border-[#141413]"
                                  : "bg-[#FAF8F4] text-[#78716C] border-[#DED8CC] hover:text-[#141413]"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${on ? ly.dot : "bg-stone-400"}`} />
                              <span>{ly.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2-Column Technical Spec Grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-2.5 border-t border-[#ECE7DC] text-xs">
                      <div>
                        <div className="text-[10px] text-[#78716C] font-semibold">Bitmiş Ölçü</div>
                        <div className="font-mono font-bold text-[#141413] tabular-nums mt-0.5">
                          {activeCutPiece.lengthMm} × {activeCutPiece.widthMm} mm
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#78716C] font-semibold">Testere Net</div>
                        <div className="font-mono font-bold text-emerald-800 tabular-nums mt-0.5">
                          {activeCutPiece.netCutLengthMm ?? activeCutPiece.lengthMm} × {activeCutPiece.netCutWidthMm ?? activeCutPiece.widthMm} mm
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#78716C] font-semibold">Kalınlık</div>
                        <div className="font-mono font-bold text-[#141413] mt-0.5">
                          {activeCutPiece.thicknessMm} mm
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#78716C] font-semibold">Alan</div>
                        <div className="font-mono font-bold text-[#141413] tabular-nums mt-0.5">
                          {activeCutPiece.areaM2} m²
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#78716C] font-semibold">Kenar Bandı</div>
                        <div className="font-mono font-bold text-amber-800 mt-0.5">
                          {activeCutPiece.edgeBandCode || `${countActiveBands(activeCutPiece.edgeBanding)} Kenar`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#78716C] font-semibold">CNC Operasyon</div>
                        <div className="font-bold text-blue-800 mt-0.5">
                          {(activeCutPiece.holes?.length || 0) > 0
                            ? `${activeCutPiece.holes!.length} Delik`
                            : activeCutPiece.hasBackGroove
                            ? "8mm Kanal"
                            : "İşlem Yok"}
                        </div>
                      </div>
                    </div>

                    {/* Active DXF Layers */}
                    <div className="pt-2.5 border-t border-[#ECE7DC]">
                      <div className="text-[10px] text-[#78716C] font-semibold mb-1.5">
                        Aktif DXF Katmanları (AC1015)
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {getPieceDxfLayers(activeCutPiece).map((ly) => (
                          <span
                            key={ly}
                            className="px-1.5 py-0.5 rounded bg-[#F5F2EA] border border-[#E5DFD3] font-mono text-[9.5px] font-semibold text-[#44403C]"
                          >
                            {ly}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 2 Crisp Bottom Actions */}
                  <div className="p-3 border-t border-[#E5DFD3] bg-[#F5F2EA] grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => downloadPieceDXF(activeCutPiece)}
                      className="h-8 rounded-xl bg-[#141413] hover:bg-stone-800 text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-300" />
                      <span>DXF İndir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabelPreviewPiece(activeCutPiece)}
                      className="h-8 rounded-xl bg-white hover:bg-[#EFECE4] border border-[#DED8CC] text-xs font-bold text-[#141413] inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Tag className="w-3.5 h-3.5 text-orange-700" />
                      <span>100×50 Etiket</span>
                    </button>
                  </div>
                </aside>
              )}
            </div>
          )}

          {/* TAB 2: HARDWARE */}
          {activeTab === "hardware" && (
            <div className="bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#F4F0E8] text-[#57534E] uppercase tracking-wider text-[10.5px] border-b border-[#E5DFD3]">
                    <tr>
                      <th className="p-3 font-bold">SKU</th>
                      <th className="p-3 font-bold">Hırdavat &amp; Mekanizma Tanımı</th>
                      <th className="p-3 font-bold">Kategori</th>
                      <th className="p-3 text-right font-bold">Miktar</th>
                      <th className="p-3 text-right font-bold">Birim Fiyat (€)</th>
                      <th className="p-3 text-right font-bold">Toplam (€)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE7DC] font-mono text-[11.5px]">
                    {bom.hardwareList.map((hw) => (
                      <tr key={hw.sku} className="hover:bg-[#FAF7F1] transition-colors">
                        <td className="p-3 text-[#57534E] font-semibold">{hw.sku}</td>
                        <td className="p-3 font-sans font-bold text-[#141413]">{hw.name}</td>
                        <td className="p-3 font-sans text-[#57534E]">{hw.category}</td>
                        <td className="p-3 text-right text-emerald-800 font-bold">
                          {hw.quantity} {hw.unit}
                        </td>
                        <td className="p-3 text-right text-[#44403C]">
                          {(hw.unitPrice ?? 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-[#141413] font-extrabold">
                          {(hw.totalPrice ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#F4F0E8] border-t border-[#E5DFD3] font-mono text-xs font-extrabold text-[#141413]">
                    <tr>
                      <td className="p-3 font-sans" colSpan={3}>
                        TOPLAM DONANIM &amp; HIRDAVAT PAKETİ ({bom.hardwareList.length} Kalem)
                      </td>
                      <td className="p-3 text-right text-emerald-800">
                        {bom.summary.totalHardwareCount} birim
                      </td>
                      <td className="p-3" />
                      <td className="p-3 text-right text-amber-900">
                        €{totalHardwareEur.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: BIRIM PORTAL ERP 2D NESTING ENGINE & EXPORTER */}
          {activeTab === "nesting" && erpNestingBundle && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#141413] flex items-center gap-2">
                      <BirimLogo className="h-4 w-auto text-[#141413]" />
                      <span>Portal ERP — CNC Panel Nesting &amp; Kesim Motoru</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 font-mono text-[10px]">
                        {erpNestingBundle.schema_version}
                      </span>
                    </h3>
                    <p className="text-[#57534E] mt-0.5">
                      ERP <code>nesting_projects</code>, <code>nesting_sheets</code>,{" "}
                      <code>nesting_parts</code> (U1/U2/K1/K2 PVC + Arkalık Kanalı JSON) ve{" "}
                      <code>nesting_placements</code> ile birebir aynı algoritma ve şema
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => printBomOrNestingSheet("nesting")}
                      data-testid="bom-print-nesting-a4-btn"
                      className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>🖨 Plaka Yerleşimini Yazdır (A4)</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadErpNestingJson}
                      className="px-3 py-1.5 rounded-xl bg-[#141413] hover:bg-stone-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-300" />
                      ERP (.json)
                    </button>
                    <button
                      type="button"
                      onClick={downloadErpSelcoCsv}
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      ERP Selco WNT 600 (.csv)
                    </button>
                    <button
                      type="button"
                      onClick={downloadErpCncGCode}
                      className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      ERP CNC G-Code (.nc)
                    </button>
                  </div>
                </div>

                {/* Interactive ERP Optimization Parameters */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 pt-2.5 border-t border-[#ECE7DC]">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#78716C] uppercase font-bold block">
                      Algoritma
                    </span>
                    <V3PremiumDropdown
                      variant="popover"
                      size="sm"
                      value={erpAlgorithm}
                      onChange={(val) =>
                        setErpAlgorithm(val as "Auto" | "Guillotine" | "MaxRects")
                      }
                      options={[
                        { value: "Auto", label: "Auto (ERP)" },
                        { value: "Guillotine", label: "Guillotine" },
                        { value: "MaxRects", label: "MaxRects (CNC)" },
                      ]}
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-[#78716C] uppercase font-bold block">
                      Plaka Ebadı
                    </span>
                    <V3PremiumDropdown
                      variant="popover"
                      size="sm"
                      value={String(erpSheetHeight)}
                      onChange={(val) => setErpSheetHeight(Number(val) as 2100 | 2070)}
                      options={[
                        { value: "2100", label: "2800 × 2100 mm" },
                        { value: "2070", label: "2800 × 2070 mm" },
                      ]}
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-[#78716C] uppercase font-bold block">
                      Bıçak Payı (Kerf)
                    </span>
                    <V3PremiumDropdown
                      variant="popover"
                      size="sm"
                      value={String(erpKerf)}
                      onChange={(val) => setErpKerf(Number(val))}
                      options={[
                        { value: "4", label: "4.0 mm (ERP)" },
                        { value: "4.4", label: "4.4 mm (Selco)" },
                        { value: "3.5", label: "3.5 mm" },
                        { value: "6", label: "6.0 mm (Freze)" },
                      ]}
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-[#78716C] uppercase font-bold block">
                      Kenar Tıraş
                    </span>
                    <V3PremiumDropdown
                      variant="popover"
                      size="sm"
                      value={String(erpMargin)}
                      onChange={(val) => setErpMargin(Number(val))}
                      options={[
                        { value: "15", label: "15 mm" },
                        { value: "10", label: "10 mm (ERP)" },
                        { value: "20", label: "20 mm" },
                      ]}
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-[#78716C] uppercase font-bold block">
                      Ölçü Bazı
                    </span>
                    <V3PremiumDropdown
                      variant="popover"
                      size="sm"
                      value={erpUseNetCut ? "net" : "nominal"}
                      onChange={(val) => setErpUseNetCut(val === "net")}
                      options={[
                        { value: "net", label: "Net Kesim" },
                        { value: "nominal", label: "Anma Ölçü" },
                      ]}
                    />
                  </div>

                  <div className="flex flex-col justify-end gap-1.5">
                    <label className="flex items-center gap-1.5 text-[#44403C] font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={erpCommonCut}
                        onChange={(e) => setErpCommonCut(e.target.checked)}
                        className="rounded border-[#C7BCAE]"
                      />
                      <span>Ortak Kesim (Kerf=0)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[#44403C] font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showCutSequences}
                        onChange={(e) => setShowCutSequences(e.target.checked)}
                        className="rounded border-[#C7BCAE]"
                      />
                      <span>Kesim Sırası Çizgileri</span>
                    </label>
                  </div>
                </div>

                {/* Live ERP Summary KPIs + Color Legend */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[#ECE7DC] text-[11px]">
                  <div className="flex flex-wrap items-center gap-4 font-mono text-[#44403C]">
                    <span>
                      İş Emri Grubu:{" "}
                      <strong className="text-[#141413]">
                        {erpNestingBundle.summary.board_groups_count}
                      </strong>
                    </span>
                    <span>
                      Toplam Plaka:{" "}
                      <strong className="text-amber-800">
                        {erpNestingBundle.summary.total_sheets_used} adet
                      </strong>
                    </span>
                    <span>
                      Yerleşen Parça:{" "}
                      <strong className="text-emerald-800">
                        {erpNestingBundle.summary.total_parts_placed}/
                        {erpNestingBundle.summary.total_parts_requested}
                      </strong>
                    </span>
                    <span>
                      Genel Verim:{" "}
                      <strong className="text-indigo-800">
                        %{erpNestingBundle.summary.overall_utilization_percent}
                      </strong>
                    </span>
                    <span>
                      Artık Plaka (≥400×400):{" "}
                      <strong className="text-cyan-800">
                        {erpNestingBundle.summary.reclaimable_remnants_count} adet (
                        {erpNestingBundle.summary.reclaimable_remnants_area_m2} m²)
                      </strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[10.5px] font-semibold">
                    <span className="inline-flex items-center gap-1 text-rose-800">
                      <span className="w-2.5 h-1.5 bg-rose-500 inline-block rounded" /> 2.0mm PVC
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-800">
                      <span className="w-2.5 h-1.5 bg-amber-500 inline-block rounded" /> 1.0mm PVC
                    </span>
                    <span className="inline-flex items-center gap-1 text-cyan-800">
                      <span className="w-2.5 h-1.5 bg-cyan-500 inline-block rounded" /> 0.4mm PVC
                    </span>
                    <span className="inline-flex items-center gap-1 text-sky-800">
                      <span className="w-3 border-b-2 border-dashed border-sky-600 inline-block" />{" "}
                      Arkalık Kanalı
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowErpContractPreview((v) => !v)}
                      className="px-2.5 py-1 rounded-lg bg-[#F5F2EA] hover:bg-[#EAE5D9] text-[#141413] border border-[#D8D1C4] font-bold cursor-pointer"
                    >
                      {showErpContractPreview ? "JSON Sözleşmeyi Gizle" : "ERP API / DB Önizleme"}
                    </button>
                  </div>
                </div>
              </div>

              {showErpContractPreview && (
                <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-[#141413]">
                      Canlı Birim ERP API &amp; Supabase <code>nesting_parts</code> /{" "}
                      <code>nesting_projects</code> JSON Sözleşmesi
                    </span>
                    <span className="text-[10px] font-mono text-[#78716C]">
                      POST /api/nesting/sheets → POST /api/nesting → POST /api/nesting/:id/parts →
                      POST /api/nesting/:id/optimize
                    </span>
                  </div>
                  <pre className="max-h-60 overflow-auto p-3 rounded-xl bg-[#1E1D1B] text-[#F5F2EA] text-[10.5px] font-mono">
                    {JSON.stringify(
                      erpNestingBundle.jobs.map((j) => ({
                        project_no: j.project_record.project_no,
                        source_type: j.project_record.source_type,
                        source_ref: j.project_record.source_ref,
                        sheet_input: j.sheet_input,
                        parts_count: j.part_inputs.length,
                        sample_parts: j.part_inputs.slice(0, 4),
                        sheets_used: j.optimization_result.sheets.length,
                        algorithm_selected: j.optimization_result.algorithm,
                        utilization_percent: j.optimization_result.overall_utilization,
                      })),
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}

              {/* Render Each Material/Thickness ERP Nesting Job */}
              {erpNestingBundle.jobs.map((job) => {
                const sheetW = job.sheet_record.width_mm;
                const sheetH = job.sheet_record.height_mm;
                const margin = job.sheet_record.edge_margin_mm;
                const getBandColor = (tape?: string) => {
                  if (!tape) return null;
                  const cl = tape.toLowerCase();
                  if (cl.includes("2")) return "#F43F5E";
                  if (cl.includes("1")) return "#F59E0B";
                  if (cl.includes("0.4")) return "#06B6D4";
                  return "#10B981";
                };

                return (
                  <div
                    key={job.group_key}
                    className="space-y-3.5 p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECE7DC] pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#141413] text-amber-300 font-mono font-bold text-[11px]">
                          {job.project_record.project_no}
                        </span>
                        <h3 className="font-extrabold text-[#141413] text-sm">
                          {job.material_name} ({job.thickness_mm}mm)
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-[#F4F0E8] border border-[#E5DFD3] text-[#57534E] font-mono text-[10px]">
                          {job.sheet_input.material_type}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs font-mono text-[#57534E]">
                        <span>
                          Algoritma:{" "}
                          <strong className="text-indigo-800">
                            {job.optimization_result.algorithm}
                          </strong>
                        </span>
                        <span>
                          Plaka:{" "}
                          <strong className="text-amber-800">
                            {job.optimization_result.sheets.length} adet
                          </strong>
                        </span>
                        <span>
                          Parça:{" "}
                          <strong className="text-[#141413]">
                            {job.optimization_result.total_parts_placed}/
                            {job.optimization_result.total_parts_requested}
                          </strong>
                        </span>
                        <span>
                          Doluluk:{" "}
                          <strong className="text-emerald-800">
                            %{job.optimization_result.overall_utilization}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {job.optimization_result.sheets.map((sheet) => {
                        const sheetRemnants = job.reclaimable_remnants.filter(
                          (rm) => rm.sheet_index === sheet.sheet_index
                        );
                        const globalSvgIdx = sheet.sheet_index + 1;
                        return (
                          <div
                            key={sheet.sheet_index}
                            className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#E5DFD3] space-y-2.5"
                          >
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-[#141413]">
                                Plaka #{sheet.sheet_index + 1} ({sheetW}×{sheetH} mm)
                              </span>
                              <div className="flex items-center gap-3 font-mono text-[11px] font-bold">
                                {sheetRemnants.length > 0 && (
                                  <span className="text-cyan-800">
                                    Artık: {sheetRemnants.length} adet
                                  </span>
                                )}
                                <span className="text-emerald-800">
                                  Verim: %{sheet.utilization_percent}
                                </span>
                              </div>
                            </div>

                            {/* High-contrast CNC Sheet Blueprint Canvas */}
                            <div className="relative w-full bg-[#0F172A] border border-slate-700 rounded-xl overflow-hidden p-1.5">
                              <svg
                                data-testid={`bom-nesting-svg-sheet-${globalSvgIdx}`}
                                viewBox={`-110 -85 ${sheetW + 200} ${sheetH + 160}`}
                                className="w-full h-auto block select-none"
                              >
                                <defs>
                                  <pattern
                                    id={`waste_hatch_${job.job_index}_${sheet.sheet_index}`}
                                    width="40"
                                    height="40"
                                    patternTransform="rotate(45 0 0)"
                                    patternUnits="userSpaceOnUse"
                                  >
                                    <line
                                      x1="0"
                                      y1="0"
                                      x2="0"
                                      y2="40"
                                      stroke="#334155"
                                      strokeWidth="6"
                                    />
                                  </pattern>
                                </defs>

                                <rect
                                  x={0}
                                  y={0}
                                  width={sheetW}
                                  height={sheetH}
                                  fill={`url(#waste_hatch_${job.job_index}_${sheet.sheet_index})`}
                                  stroke="#64748B"
                                  strokeWidth="8"
                                />
                                <rect
                                  x={margin}
                                  y={margin}
                                  width={sheetW - 2 * margin}
                                  height={sheetH - 2 * margin}
                                  fill="#0F172A"
                                  stroke="#475569"
                                  strokeWidth="4"
                                  strokeDasharray="24 14"
                                />

                                <line
                                  x1={0}
                                  y1={-32}
                                  x2={sheetW}
                                  y2={-32}
                                  stroke="#94A3B8"
                                  strokeWidth="4"
                                />
                                {[0, 700, 1400, 2100, sheetW].map((tx) => (
                                  <g key={`rx_${tx}`}>
                                    <line
                                      x1={tx}
                                      y1={-48}
                                      x2={tx}
                                      y2={-16}
                                      stroke="#94A3B8"
                                      strokeWidth="4"
                                    />
                                    <text
                                      x={tx}
                                      y={-54}
                                      textAnchor="middle"
                                      fill="#CBD5E1"
                                      fontSize="40"
                                      fontWeight="800"
                                      fontFamily="monospace"
                                    >
                                      {tx}
                                    </text>
                                  </g>
                                ))}

                                <line
                                  x1={-32}
                                  y1={0}
                                  x2={-32}
                                  y2={sheetH}
                                  stroke="#94A3B8"
                                  strokeWidth="4"
                                />
                                {[0, 500, 1000, 1500, sheetH].map((ty) => (
                                  <g key={`ry_${ty}`}>
                                    <line
                                      x1={-48}
                                      y1={ty}
                                      x2={-16}
                                      y2={ty}
                                      stroke="#94A3B8"
                                      strokeWidth="4"
                                    />
                                    <text
                                      x={-56}
                                      y={ty + 14}
                                      textAnchor="end"
                                      fill="#CBD5E1"
                                      fontSize="38"
                                      fontWeight="800"
                                      fontFamily="monospace"
                                    >
                                      {ty}
                                    </text>
                                  </g>
                                ))}

                                {sheetRemnants.map((rm) => (
                                  <g key={`rem_${rm.remnant_index}`}>
                                    <rect
                                      x={margin + rm.x_mm}
                                      y={margin + rm.y_mm}
                                      width={rm.width_mm}
                                      height={rm.height_mm}
                                      fill="rgba(16, 185, 129, 0.14)"
                                      stroke="#10B981"
                                      strokeWidth="5"
                                      strokeDasharray="18 10"
                                    />
                                    {rm.width_mm >= 400 && rm.height_mm >= 350 && (
                                      <text
                                        x={margin + rm.x_mm + rm.width_mm / 2}
                                        y={margin + rm.y_mm + rm.height_mm / 2}
                                        textAnchor="middle"
                                        fill="#6EE7B7"
                                        fontSize="36"
                                        fontWeight="800"
                                        fontFamily="monospace"
                                      >
                                        {`ARTIK ${Math.round(rm.width_mm)}×${Math.round(rm.height_mm)}`}
                                      </text>
                                    )}
                                  </g>
                                ))}

                                {sheet.placements.map((pl) => {
                                  const pw = Math.max(40, pl.width);
                                  const ph = Math.max(40, pl.height);
                                  const cx = pl.x + pw / 2;
                                  const cy = pl.y + ph / 2;
                                  const rot = (pl.rotation || (pl.rotated ? 90 : 0)) % 360;
                                  const cU1 = getBandColor(pl.edgeL1);
                                  const cU2 = getBandColor(pl.edgeL2);
                                  const cK1 = getBandColor(pl.edgeW1);
                                  const cK2 = getBandColor(pl.edgeW2);
                                  const visEdges =
                                    rot === 90
                                      ? { top: cK1, bottom: cK2, left: cU2, right: cU1 }
                                      : rot === 180
                                      ? { top: cU2, bottom: cU1, left: cK2, right: cK1 }
                                      : rot === 270
                                      ? { top: cK2, bottom: cK1, left: cU1, right: cU2 }
                                      : { top: cU1, bottom: cU2, left: cK1, right: cK2 };

                                  const adjGrooveSide = pl.hasGroove
                                    ? adjustErpGrooveSideForRotation(pl.grooveSide || "Alt", rot)
                                    : "";
                                  const gOff = pl.grooveOffset ?? 20;
                                  const fontTitle = Math.max(
                                    24,
                                    Math.min(
                                      44,
                                      Math.floor(pw / Math.max(6, pl.part_label.length * 0.58))
                                    )
                                  );
                                  const fontDim = Math.max(22, Math.min(38, Math.floor(pw / 8.5)));

                                  const isLNotchPanel = /L-Köşe.*Tek Parça|İç Boşaltmalı/i.test(pl.part_label);
                                  const isDiagChamferPanel = !isLNotchPanel && /Diyagonal.*(Alt|Üst|Raf)|pentagon/i.test(`${pl.part_label} ${pl.part_id}`);
                                  const isRoundedSlabPanel = !isLNotchPanel && !isDiagChamferPanel && /(Kapsül|Stadyum|R-Köşe|R-Köşeli).*(Alt Tabla|Üst Tabla|Masa Tablası|Mermer|Kuvars)/i.test(pl.part_label);
                                  const rMatch = isRoundedSlabPanel ? pl.part_label.match(/R=(\d+)/i) : null;
                                  const roundedSlabR = isRoundedSlabPanel
                                    ? Math.min(Math.floor(Math.min(pw, ph) / 2), rMatch ? Number(rMatch[1]) : Math.floor(Math.min(pw, ph) * 0.48))
                                    : 4;
                                  const matchedCut = isLNotchPanel
                                    ? bom.cutList.find((cp) => cp.pieceName === pl.part_label || pl.part_id.startsWith(cp.id))
                                    : undefined;
                                  const rawNw = matchedCut?.cutoutWidthMm || Math.round(pw * 0.39);
                                  const rawNh = matchedCut?.cutoutDepthMm || Math.round(ph * 0.39);
                                  const notchW = Math.min(Math.round(pw * 0.65), Math.max(80, rot === 90 || rot === 270 ? rawNh : rawNw));
                                  const notchH = Math.min(Math.round(ph * 0.65), Math.max(80, rot === 90 || rot === 270 ? rawNw : rawNh));
                                  const lPolyPoints = isLNotchPanel
                                    ? `${pl.x},${pl.y} ${pl.x + pw},${pl.y} ${pl.x + pw},${pl.y + ph - notchH} ${pl.x + pw - notchW},${pl.y + ph - notchH} ${pl.x + pw - notchW},${pl.y + ph} ${pl.x},${pl.y + ph}`
                                    : "";

                                  return (
                                    <g key={pl.part_id}>
                                      {isLNotchPanel ? (
                                        <>
                                          <polygon
                                            points={lPolyPoints}
                                            fill={pl.color || "#3B82F6"}
                                            fillOpacity={0.84}
                                            stroke="#0F172A"
                                            strokeWidth="5"
                                            strokeLinejoin="round"
                                          />
                                          <rect
                                            x={pl.x + pw - notchW}
                                            y={pl.y + ph - notchH}
                                            width={notchW}
                                            height={notchH}
                                            fill="#F8FAFC"
                                            fillOpacity={0.92}
                                            stroke="#DC2626"
                                            strokeWidth="5"
                                            strokeDasharray="18 10"
                                          />
                                          <line
                                            x1={pl.x + pw - notchW}
                                            y1={pl.y + ph - notchH}
                                            x2={pl.x + pw}
                                            y2={pl.y + ph}
                                            stroke="#DC2626"
                                            strokeOpacity={0.35}
                                            strokeWidth="3"
                                          />
                                          <line
                                            x1={pl.x + pw}
                                            y1={pl.y + ph - notchH}
                                            x2={pl.x + pw - notchW}
                                            y2={pl.y + ph}
                                            stroke="#DC2626"
                                            strokeOpacity={0.35}
                                            strokeWidth="3"
                                          />
                                          <text
                                            x={pl.x + pw - notchW / 2}
                                            y={pl.y + ph - notchH / 2 - 12}
                                            textAnchor="middle"
                                            fontSize={Math.max(20, Math.min(30, Math.floor(notchW / 12)))}
                                            fontWeight="800"
                                            fill="#B91C1C"
                                          >
                                            CNC L-BOŞALTMA
                                          </text>
                                          <text
                                            x={pl.x + pw - notchW / 2}
                                            y={pl.y + ph - notchH / 2 + 20}
                                            textAnchor="middle"
                                            fontSize={Math.max(18, Math.min(28, Math.floor(notchW / 11)))}
                                            fontWeight="700"
                                            fontFamily="ui-monospace, monospace"
                                            fill="#991B1B"
                                          >
                                            {Math.round(notchW)}×{Math.round(notchH)}
                                          </text>
                                        </>
                                      ) : isDiagChamferPanel ? (
                                        <>
                                          <polygon
                                            points={`${pl.x},${pl.y} ${pl.x + pw},${pl.y} ${pl.x + pw},${pl.y + Math.round(ph * 0.6)} ${pl.x + Math.round(pw * 0.6)},${pl.y + ph} ${pl.x},${pl.y + ph}`}
                                            fill={pl.color || "#3B82F6"}
                                            fillOpacity={0.84}
                                            stroke="#0F172A"
                                            strokeWidth="5"
                                            strokeLinejoin="round"
                                          />
                                          <polygon
                                            points={`${pl.x + pw},${pl.y + Math.round(ph * 0.6)} ${pl.x + pw},${pl.y + ph} ${pl.x + Math.round(pw * 0.6)},${pl.y + ph}`}
                                            fill="#F8FAFC"
                                            fillOpacity={0.92}
                                            stroke="#DC2626"
                                            strokeWidth="5"
                                            strokeDasharray="16 10"
                                          />
                                        </>
                                      ) : isRoundedSlabPanel ? (
                                        <>
                                          <rect
                                            x={pl.x}
                                            y={pl.y}
                                            width={pw}
                                            height={ph}
                                            fill="none"
                                            stroke="#DC2626"
                                            strokeWidth="3"
                                            strokeDasharray="14 10"
                                            strokeOpacity={0.55}
                                          />
                                          <rect
                                            x={pl.x}
                                            y={pl.y}
                                            width={pw}
                                            height={ph}
                                            rx={roundedSlabR}
                                            ry={roundedSlabR}
                                            fill={pl.color || "#3B82F6"}
                                            fillOpacity={0.84}
                                            stroke="#0F172A"
                                            strokeWidth="5"
                                          />
                                        </>
                                      ) : (
                                        <rect
                                          x={pl.x}
                                          y={pl.y}
                                          width={pw}
                                          height={ph}
                                          rx={4}
                                          fill={pl.color || "#3B82F6"}
                                          fillOpacity={0.82}
                                          stroke="#0F172A"
                                          strokeWidth="4"
                                        />
                                      )}
                                      {visEdges.top && (
                                        <line
                                          x1={pl.x + 3}
                                          y1={pl.y + 5}
                                          x2={pl.x + pw - 3}
                                          y2={pl.y + 5}
                                          stroke={visEdges.top}
                                          strokeWidth="10"
                                        />
                                      )}
                                      {visEdges.bottom && (
                                        <line
                                          x1={pl.x + 3}
                                          y1={pl.y + ph - 5}
                                          x2={pl.x + pw - 3}
                                          y2={pl.y + ph - 5}
                                          stroke={visEdges.bottom}
                                          strokeWidth="10"
                                        />
                                      )}
                                      {visEdges.left && (
                                        <line
                                          x1={pl.x + 5}
                                          y1={pl.y + 3}
                                          x2={pl.x + 5}
                                          y2={pl.y + ph - 3}
                                          stroke={visEdges.left}
                                          strokeWidth="10"
                                        />
                                      )}
                                      {visEdges.right && (
                                        <line
                                          x1={pl.x + pw - 5}
                                          y1={pl.y + 3}
                                          x2={pl.x + pw - 5}
                                          y2={pl.y + ph - 3}
                                          stroke={visEdges.right}
                                          strokeWidth="10"
                                        />
                                      )}

                                      {pl.hasGroove && (
                                        <line
                                          x1={
                                            adjGrooveSide === "Sol"
                                              ? pl.x + gOff
                                              : adjGrooveSide === "Sağ"
                                              ? pl.x + pw - gOff
                                              : pl.x + 8
                                          }
                                          y1={
                                            adjGrooveSide === "Üst"
                                              ? pl.y + gOff
                                              : adjGrooveSide === "Alt"
                                              ? pl.y + ph - gOff
                                              : pl.y + 8
                                          }
                                          x2={
                                            adjGrooveSide === "Sol"
                                              ? pl.x + gOff
                                              : adjGrooveSide === "Sağ"
                                              ? pl.x + pw - gOff
                                              : pl.x + pw - 8
                                          }
                                          y2={
                                            adjGrooveSide === "Üst"
                                              ? pl.y + gOff
                                              : adjGrooveSide === "Alt"
                                              ? pl.y + ph - gOff
                                              : pl.y + ph - 8
                                          }
                                          stroke="#67E8F9"
                                          strokeWidth="6"
                                          strokeDasharray="16 10"
                                        />
                                      )}

                                      {pw >= 120 && ph >= 80 && (
                                        <>
                                          <text
                                            x={cx}
                                            y={cy - 4}
                                            textAnchor="middle"
                                            fill="#FFFFFF"
                                            fontSize={fontTitle}
                                            fontWeight="900"
                                            fontFamily="sans-serif"
                                          >
                                            {pl.part_label.slice(0, 22)}
                                          </text>
                                          <text
                                            x={cx}
                                            y={cy + fontDim + 6}
                                            textAnchor="middle"
                                            fill="#FEF08A"
                                            fontSize={fontDim}
                                            fontWeight="800"
                                            fontFamily="monospace"
                                          >
                                            {`${Math.round(pl.width)}×${Math.round(pl.height)}${pl.rotated ? " ↻" : ""}`}
                                          </text>
                                        </>
                                      )}
                                    </g>
                                  );
                                })}

                                {showCutSequences &&
                                  (sheet.sequences || []).map((seq, sqIdx) => (
                                    <line
                                      key={`seq_${sqIdx}`}
                                      x1={seq.x1}
                                      y1={seq.y1}
                                      x2={seq.x2}
                                      y2={seq.y2}
                                      stroke={seq.isTraversal ? "#38BDF8" : "#F43F5E"}
                                      strokeWidth={seq.isTraversal ? "4" : "5.5"}
                                      strokeDasharray={seq.isTraversal ? "14 10" : "22 10"}
                                      opacity={0.85}
                                    />
                                  ))}
                              </svg>
                            </div>

                            {sheet.cuttingInstructions && sheet.cuttingInstructions.length > 0 && (
                              <details className="rounded-xl bg-white border border-[#E5DFD3] p-2.5">
                                <summary className="cursor-pointer font-bold text-[#141413] text-[11px]">
                                  🪚 Ebatlama Operatör Kesim Reçetesi ({sheet.placements.length}{" "}
                                  Parça Kesim Adımı)
                                </summary>
                                <pre className="mt-2 max-h-40 overflow-auto text-[10px] font-mono text-[#44403C] whitespace-pre-wrap">
                                  {sheet.cuttingInstructions.join("\n")}
                                </pre>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: FACTORY VALIDATION GATE & SHELF DEFLECTION */}
          {activeTab === "validation" && (
            <div className="space-y-5">
              <div className="space-y-3">
                <h3 className="font-extrabold text-[#141413] text-sm">
                  6 Aşamalı Deterministik Üretim Doğrulama Kapısı (Fail-Closed Gate)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {gateChecks.map((chk) => (
                    <div
                      key={chk.id}
                      className={`p-3.5 rounded-2xl border ${
                        chk.passed
                          ? "bg-emerald-50/75 border-emerald-300 text-emerald-950"
                          : "bg-amber-50/90 border-amber-300 text-amber-950"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs mb-1">
                        <span>{chk.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                            chk.passed
                              ? "bg-emerald-700 text-white"
                              : "bg-amber-700 text-white"
                          }`}
                        >
                          {chk.passed ? "GEÇTİ (PASS)" : "KİLİTLİ (HOLD)"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#44403C] leading-relaxed">{chk.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {shelfDeflections.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="font-extrabold text-[#141413] text-sm">
                    ISO 7170 Euler-Bernoulli Fiziksel Raf Sehim (Esneme) Analizi
                  </h3>
                  <div className="bg-white border border-[#E5DFD3] rounded-2xl shadow-2xs overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-[#F4F0E8] text-[#57534E] uppercase tracking-wider text-[10.5px] border-b border-[#E5DFD3]">
                        <tr>
                          <th className="p-2.5 font-bold">Modül / Bölme</th>
                          <th className="p-2.5 text-right font-bold">Açıklık (L)</th>
                          <th className="p-2.5 text-right font-bold">Derinlik (D)</th>
                          <th className="p-2.5 text-right font-bold">Kalınlık (T)</th>
                          <th className="p-2.5 text-right font-bold">Hesaplanan Sehim</th>
                          <th className="p-2.5 text-right font-bold">L/300 Sınırı</th>
                          <th className="p-2.5 text-center font-bold">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECE7DC] font-mono text-[11px]">
                        {shelfDeflections.map((sd, idx) => (
                          <tr key={`${sd.moduleId}_${sd.bayIndex}_${idx}`} className="hover:bg-[#FAF7F1]">
                            <td className="p-2.5 font-sans font-bold text-[#141413]">
                              {sd.moduleName} — Bölme {sd.bayIndex + 1}
                            </td>
                            <td className="p-2.5 text-right text-[#44403C]">{sd.spanMm} mm</td>
                            <td className="p-2.5 text-right text-[#44403C]">{sd.depthMm} mm</td>
                            <td className="p-2.5 text-right text-[#44403C]">{sd.thicknessMm} mm</td>
                            <td className="p-2.5 text-right font-bold text-amber-800">
                              {sd.deflectionMm} mm
                            </td>
                            <td className="p-2.5 text-right text-[#78716C]">{sd.maxAllowedMm} mm</td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  sd.passed
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                    : "bg-red-100 text-red-900 border border-red-300"
                                }`}
                              >
                                {sd.passed ? "UYGUN" : "SEHİM AŞIMI"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ASSEMBLY INSTRUCTIONS */}
          {activeTab === "assembly" && (
            <div className="space-y-3.5 max-w-4xl">
              <p className="text-[#57534E] font-medium">
                Fabrikada ebatlanan, kenar bantlanan ve CNC delik/kanal operasyonları açılan panellerin sahada kurulum sırası:
              </p>
              <div className="space-y-2.5">
                {assemblySteps.map((st) => (
                  <div
                    key={st.stepNumber}
                    className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#141413] text-amber-300 font-mono font-black text-xs flex items-center justify-center">
                        {st.stepNumber}
                      </span>
                      <h4 className="font-extrabold text-[#141413] text-xs">{st.title}</h4>
                    </div>
                    <p className="text-[#44403C] leading-relaxed pl-8">{st.description}</p>
                    <div className="pl-8 pt-1 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="text-[#78716C] font-semibold">Parçalar:</span>
                      {st.requiredParts.map((p, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-lg bg-[#FAF8F4] text-[#141413] border border-[#E5DFD3] font-medium"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                    {st.safetyNotes && (
                      <div className="pl-8 text-amber-900 text-[11px] flex items-center gap-1.5 pt-1 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>{st.safetyNotes}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: SELCO WNT 600 POSTPROCESSOR */}
          {activeTab === "selco" && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-950 font-extrabold">
                  <ShieldAlert className="w-5 h-5 text-amber-700" />
                  <span>Biesse Selco WNT 600 Postprocessor (Teknik Uyarı)</span>
                </div>
                <p className="text-amber-950/90 text-xs leading-relaxed">
                  Gerçek üretim dosyası oluşturulmadan önce fabrika şefi ve Selco OptiPlanning operatörü tarafından takım ve bıçak parametreleri onaylanmalıdır.
                </p>
                {selcoPackage?.unverifiedNotes.map((note, idx) => (
                  <div key={idx} className="text-amber-900 text-xs font-mono">
                    • {note}
                  </div>
                ))}
              </div>

              {selcoPackage && (
                <div className="space-y-2">
                  <h4 className="font-bold text-[#141413]">
                    Üretim XML Çıktı Taslağı ({selcoPackage.batchId}):
                  </h4>
                  <pre className="p-4 rounded-2xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono overflow-x-auto max-h-80">
                    {selcoPackage.xmlOutputDraft}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: BLUM BXF & EASYSTICK (MINIPRESS / E-SERVICES) */}
          {activeTab === "blum_bxf" && (
            <div data-testid="bom-blum-bxf-panel" className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-[#1D4ED8]">
                    BLUM GÖVDE TASARLAYICI &amp; BXF / EASYSTICK ÜRETİM PAKETİ
                  </h3>
                  <p className="text-[#57534E] mt-0.5">
                    KB/KH/KT Dış Ölçüler • LW/LH/LT Net İç Ölçüler • Kapak Ağırlığı (kg) &amp; AVENTOS Güç Faktörü (LF) • LEGRABOX/TANDEMBOX Kesim Formülleri • MINIPRESS EASYSTICK Delik Matrisi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadBlumBxf}
                  className="px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold cursor-pointer"
                >
                  🟦 Blum .BXF Dosyasını İndir (EASYSTICK / CAD)
                </button>
              </div>

              {blumCabinetSummaries.map((cab, cIdx) => (
                <div
                  key={cab.moduleId}
                  className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECE7DC] pb-2.5">
                    <div>
                      <span className="font-extrabold text-[#141413] text-sm">
                        {cIdx + 1}. {cab.moduleName}
                      </span>
                      <div className="text-[11px] font-mono text-[#57534E] mt-0.5">
                        Dış (KB×KH×KT):{" "}
                        <strong className="text-amber-800">
                          {cab.outerDimensions.KB} × {cab.outerDimensions.KH} ×{" "}
                          {cab.outerDimensions.KT} mm
                        </strong>{" "}
                        • Net İç (LW×LH×LT):{" "}
                        <strong className="text-emerald-800">
                          {cab.innerDimensions.LW} × {cab.innerDimensions.LH} ×{" "}
                          {cab.innerDimensions.LT} mm
                        </strong>{" "}
                        • Panel: {cab.panelThicknessMm}mm • Derz (Fuge): {cab.frontGapFugeMm}mm
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        cab.collisionFree
                          ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
                          : "bg-amber-50 text-amber-950 border border-amber-300"
                      }`}
                    >
                      {cab.collisionFree ? "✓ BLUM ÇAKIŞMA KONTROLÜ: UYGUN" : "⚠ UYARI MEVCUT"}
                    </span>
                  </div>

                  {cab.collisionWarnings.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1">
                      {cab.collisionWarnings.map((w, wi) => (
                        <div key={wi}>• {w}</div>
                      ))}
                    </div>
                  )}

                  {cab.doors.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-bold text-[#57534E] text-[10.5px] uppercase tracking-wider">
                        Kapak Ağırlığı, CLIP top BLUMOTION Menteşe &amp; AVENTOS Güç Faktörü (LF = KH × kg)
                      </div>
                      <div className="border border-[#ECE7DC] rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse font-mono text-[11px]">
                          <thead className="bg-[#F4F0E8] text-[#57534E]">
                            <tr>
                              <th className="p-2">Bölme</th>
                              <th className="p-2">Kapak Ölçüsü</th>
                              <th className="p-2">Ağırlık (kg)</th>
                              <th className="p-2">Menteşe Adedi &amp; Kodu</th>
                              <th className="p-2">Delik Şablonu</th>
                              <th className="p-2">AVENTOS LF &amp; Öneri</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#ECE7DC]">
                            {cab.doors.map((d) => (
                              <tr key={d.bayIndex}>
                                <td className="p-2 text-[#141413] font-bold">Bölme {d.bayIndex + 1}</td>
                                <td className="p-2 text-amber-900">
                                  {d.doorWidthMm}×{d.doorHeightMm}×{d.doorThicknessMm} mm
                                </td>
                                <td className="p-2 text-emerald-800 font-bold">
                                  {d.estimatedWeightKg} kg
                                </td>
                                <td className="p-2 text-[#292524]">
                                  {d.recommendedHingeCount}× {d.hingeSku} + {d.mountingPlateSku}
                                </td>
                                <td className="p-2 text-[#57534E]">{d.cupDrillingPattern}</td>
                                <td className="p-2 text-blue-800 font-semibold">
                                  LF={d.aventosPowerFactorLf} •{" "}
                                  {d.recommendedAventosModel || "Menteşeli"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {cab.drawers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-bold text-[#57534E] text-[10.5px] uppercase tracking-wider">
                        Çekmece Ahşap Kesim Ölçüleri (Taban &amp; Arkalık) ve EASYSTICK Ray Delik Eksenleri
                      </div>
                      <div className="border border-[#ECE7DC] rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse font-mono text-[11px]">
                          <thead className="bg-[#F4F0E8] text-[#57534E]">
                            <tr>
                              <th className="p-2">Bölme</th>
                              <th className="p-2">Blum Sistem &amp; Ray SKU</th>
                              <th className="p-2">NL / LW</th>
                              <th className="p-2">Ahşap Taban Kesim</th>
                              <th className="p-2">Ahşap Arkalık Kesim</th>
                              <th className="p-2">EASYSTICK Yan Delik X (mm)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#ECE7DC]">
                            {cab.drawers.map((drw) => (
                              <tr key={drw.drawerId}>
                                <td className="p-2 text-[#141413] font-bold">
                                  Bölme {drw.bayIndex + 1}
                                </td>
                                <td className="p-2 text-[#292524]">
                                  {drw.systemName} [{drw.runnerSku}]
                                </td>
                                <td className="p-2 text-amber-900">
                                  NL:{drw.nominalLengthNlMm} / LW:{drw.netInnerWidthLwMm}
                                </td>
                                <td className="p-2 text-emerald-800 font-bold">
                                  {drw.woodenBottomWidthMm} × {drw.woodenBottomDepthMm} mm (16mm)
                                </td>
                                <td className="p-2 text-emerald-800 font-bold">
                                  {drw.woodenBackWidthMm} × {drw.woodenBackHeightMm} mm (16mm)
                                </td>
                                <td className="p-2 text-purple-800">
                                  Y:{drw.easystickElevationYMm}mm → X:[
                                  {drw.easystickSideHoleXCoordsMm.join(", ")}]
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="space-y-2">
                <h4 className="font-bold text-[#141413]">
                  Canlı Blum Exchange Format (.BXF / XML) Çıktı Önizlemesi:
                </h4>
                <pre className="p-4 rounded-2xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono overflow-x-auto max-h-64">
                  {blumBxfXml}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 7: CUSTOMER QUOTE & PRESENTATION SHEET */}
          {activeTab === "quote" && (
            <div data-testid="bom-quote-panel" className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-[#141413]">
                    BİRİM MOBİLYA — KURUMSAL MÜŞTERİ TEKLİF &amp; TEKNİK SUNUM FÖYÜ
                  </h3>
                  <p className="text-[#57534E] mt-0.5">
                    Proje: {project.title} • {project.modules.length} Modül • Toplam Levha:{" "}
                    {bom.summary.totalPanelAreaM2} m² • Kenar Bandı:{" "}
                    {bom.summary.totalEdgeBandMeters} mt
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadCustomerQuoteHtml}
                  className="px-4 py-2 rounded-xl birim-ice-charcoal-pill font-bold cursor-pointer"
                >
                  📄 Yazdırılabilir Teklif Föyünü İndir (.HTML)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-2">
                  <h4 className="font-bold text-[#57534E] uppercase tracking-wider text-[11px]">
                    1. Modül ve Seçilen Levha Dekorları
                  </h4>
                  <div className="divide-y divide-[#ECE7DC]">
                    {project.modules.map((m, idx) => (
                      <div key={m.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#141413]">
                            {idx + 1}. {m.name}
                          </div>
                          <div className="text-[11px] text-[#78716C] font-mono">
                            Gövde: {m.carcass.bodyMaterialId} • Kapak: {m.carcass.doorMaterialId}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-amber-900 shrink-0">
                          {m.dimensions.width}×{m.dimensions.height}×{m.dimensions.depth} mm
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-3">
                  <h4 className="font-bold text-[#57534E] uppercase tracking-wider text-[11px]">
                    2. Maliyet ve Satış Teklif Kırılımı
                  </h4>
                  <div className="space-y-2 font-mono text-[#292524]">
                    <div className="flex justify-between">
                      <span className="font-sans text-[#57534E]">Ahşap / Levha Maliyeti:</span>
                      <span className="font-bold">
                        €{(pricing.materialCost ?? (pricing as any).materialCostEur ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-[#57534E]">
                        Kenar Bandı (PVC/ABS) Maliyeti:
                      </span>
                      <span className="font-bold">
                        €{(pricing.edgeBandCost ?? (pricing as any).edgeBandCostEur ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-[#57534E]">
                        Dünya Markaları Aksesuar &amp; LED Donanım:
                      </span>
                      <span className="font-bold">
                        €{(pricing.hardwareCost ?? (pricing as any).hardwareCostEur ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-[#57534E]">
                        CNC İşçilik, Ebatlama &amp; Montaj:
                      </span>
                      <span className="font-bold">
                        €{(pricing.laborCost ?? (pricing as any).laborCostEur ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-[#E5DFD3] flex justify-between items-baseline text-sm font-black text-[#141413]">
                      <span className="font-sans">KDV Dahil Müşteri Satış Toplamı:</span>
                      <span className="text-amber-900">
                        €
                        {(pricing.totalWithVatEur ?? 0).toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        (
                        {(pricing.totalWithVatTry ?? 0).toLocaleString("tr-TR", {
                          maximumFractionDigits: 0,
                        })}{" "}
                        TL)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: DOUBLE-SIDED CNC POSTPROCESSORS (.MPR / .CIX / .XCS) */}
          {activeTab === "cnc_mpr_cix" &&
            (() => {
              const cncInputs: CncPieceInput[] = bom.cutList.map((cp) =>
                mapCutPieceToCncPieceInput(cp)
              );
              const bundle = generateProjectCncPostProcessorBundle(cncInputs);
              return (
                <div className="space-y-4 text-xs text-[#141413]">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#141413]">
                        Homag WoodWOP (.MPR), BiesseWorks (.CIX) &amp; SCM Maestro (.XCS) Çift Yüzeyli CNC Çıktısı
                      </h3>
                      <p className="text-[#57534E] mt-0.5">
                        Ara dikme gibi çift yüzeyli parçalar otomatik olarak Setup-1 (Üst) ve Setup-2 (X-Simetrik Flip) programlarına ayrılır.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!checkGateBeforeProductionExport("Homag .MPR")) return;
                          const allMpr = bundle.homagMprFiles
                            .map((f) => `; === ${f.fileName} ===\r\n${f.content}`)
                            .join("\r\n\r\n");
                          downloadFile(
                            allMpr,
                            `Homag_WoodWOP_${project.id}_v${project.version}.mpr`,
                            "text/plain;charset=utf-8"
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold cursor-pointer"
                      >
                        Homag .MPR İndir ({bundle.homagMprFiles.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!checkGateBeforeProductionExport("Biesse .CIX")) return;
                          const allCix = bundle.biesseCixFiles
                            .map((f) => `// === ${f.fileName} ===\r\n${f.content}`)
                            .join("\r\n\r\n");
                          downloadFile(
                            allCix,
                            `Biesse_Works_${project.id}_v${project.version}.cix`,
                            "text/plain;charset=utf-8"
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold cursor-pointer"
                      >
                        Biesse .CIX İndir ({bundle.biesseCixFiles.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!checkGateBeforeProductionExport("SCM Maestro .XCS")) return;
                          const allXcs = bundle.scmXcsFiles
                            .map((f) => `// === ${f.fileName} ===\r\n${f.content}`)
                            .join("\r\n\r\n");
                          downloadFile(
                            allXcs,
                            `SCM_Maestro_${project.id}_v${project.version}.xcs`,
                            "text/plain;charset=utf-8"
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                      >
                        SCM .XCS İndir ({bundle.scmXcsFiles.length})
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const simReport = simulateCncPostProcessorBundle(project, bom);
                    const simTargetPiece =
                      bom.cutList.find((cp) => cp.id === selectedSimulatedPieceId) ||
                      bom.cutList.find((cp) => (cp.holes?.length || 0) > 0) ||
                      bom.cutList[0];
                    const simSvg = simTargetPiece
                      ? generateCncToolpathSimulationSvg(simTargetPiece)
                      : "";
                    return (
                      <div
                        data-testid="cnc-preflight-simulation-card"
                        className="p-4 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-extrabold text-[#141413]">
                              CNC Ön Doğrulama &amp; 2B Takım Yolu Simülasyonu (Makine Öncesi Güvenlik Kapısı)
                            </div>
                            <div className="text-[11px] text-amber-800 mt-0.5 font-medium">
                              {simReport.postProcessorDisclaimerTr}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                            <span className="px-2.5 py-1 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] text-[#141413] font-semibold">
                              İşlenen Panel: {simReport.machinedPanelsCount}/
                              {simReport.totalPanelsSimulated}
                            </span>
                            <span className="px-2.5 py-1 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] text-emerald-800 font-bold">
                              Tahmini Süre: ~{simReport.totalEstimatedMinutes} dk
                            </span>
                            <span
                              className={`px-2.5 py-1 rounded-xl border font-bold ${
                                simReport.blockingErrorCount === 0
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                                  : "bg-red-50 border-red-300 text-red-900"
                              }`}
                            >
                              {simReport.blockingErrorCount === 0
                                ? "Z-Derinlik & Et Kalınlığı Uygun"
                                : `${simReport.blockingErrorCount} Kritik CNC Uyarısı`}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {simReport.pieces.map((sp) => (
                              <button
                                key={sp.pieceId}
                                type="button"
                                onClick={() => setSelectedSimulatedPieceId(sp.pieceId)}
                                className={`w-full text-left p-2.5 rounded-xl border text-[11px] transition cursor-pointer ${
                                  simTargetPiece?.id === sp.pieceId
                                    ? "bg-[#141413] border-[#141413] text-white shadow-xs"
                                    : "bg-[#FAF8F4] border-[#E5DFD3] text-[#141413] hover:bg-[#EFECE4]"
                                }`}
                              >
                                <div className="font-bold truncate">{sp.partName}</div>
                                <div
                                  className={`text-[10px] font-mono ${
                                    simTargetPiece?.id === sp.pieceId
                                      ? "text-amber-300"
                                      : "text-[#78716C]"
                                  }`}
                                >
                                  {sp.lengthMm}×{sp.widthMm}×{sp.thicknessMm}mm • {sp.drillCount}{" "}
                                  delik • ~{sp.estimatedCycleSeconds}s
                                </div>
                              </button>
                            ))}
                          </div>
                          <div
                            className="lg:col-span-2 p-2.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD3] overflow-hidden"
                            dangerouslySetInnerHTML={{ __html: simSvg }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs">
                      <div className="font-bold text-amber-900 mb-2">
                        Örnek Homag .MPR ({bundle.homagMprFiles[0]?.fileName || "-"})
                      </div>
                      <pre className="max-h-80 overflow-auto p-3 rounded-xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono whitespace-pre-wrap">
                        {bundle.homagMprFiles[0]?.content || "Parça yok"}
                      </pre>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs">
                      <div className="font-bold text-blue-900 mb-2">
                        Örnek Biesse .CIX ({bundle.biesseCixFiles[0]?.fileName || "-"})
                      </div>
                      <pre className="max-h-80 overflow-auto p-3 rounded-xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono whitespace-pre-wrap">
                        {bundle.biesseCixFiles[0]?.content || "Parça yok"}
                      </pre>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E5DFD3] shadow-2xs">
                      <div className="font-bold text-emerald-900 mb-2">
                        Örnek SCM Maestro .XCS ({bundle.scmXcsFiles[0]?.fileName || "-"})
                      </div>
                      <pre className="max-h-80 overflow-auto p-3 rounded-xl bg-[#1E1D1B] text-[#F5F2EA] text-[11px] font-mono whitespace-pre-wrap">
                        {bundle.scmXcsFiles[0]?.content || "Parça yok"}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      </div>
      {/* 100×50mm Thermal Label Preview Sub-Modal */}
      {labelPreviewPiece && (
        <div
          onClick={() => setLabelPreviewPiece(null)}
          className="fixed inset-0 z-[170] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#FAF8F4] border border-[#D6CFC2] rounded-2xl shadow-2xl overflow-hidden text-[#141413]"
          >
            <div className="px-4 py-3 bg-[#F5F2EA] border-b border-[#E5DFD3] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-orange-700" />
                <span className="text-xs font-extrabold">Termal Etiket Önizleme · 100 × 50 mm</span>
              </div>
              <button
                type="button"
                onClick={() => setLabelPreviewPiece(null)}
                className="p-1 rounded-lg text-[#57534E] hover:text-[#141413] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-[#EFECE4]">
              <div className="bg-white text-zinc-950 rounded-xl p-4 border-2 border-dashed border-stone-400">
                <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-2">
                  <div>
                    <div className="text-[9px] font-extrabold tracking-[0.18em] uppercase">BİRİM® · İMALAT ETİKETİ</div>
                    <div className="text-xs font-bold mt-0.5">{project.title}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-base font-extrabold leading-none">
                      #{String(Math.max(1, bom.cutList.findIndex((x) => x.id === labelPreviewPiece.id) + 1)).padStart(2, "0")}
                    </div>
                    <div className="text-[9px] text-zinc-600">/ {bom.cutList.length} PARÇA</div>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-3 py-3 items-center">
                  <div className="col-span-8 space-y-1">
                    <div className="text-sm font-extrabold leading-tight">{labelPreviewPiece.pieceName}</div>
                    <div className="font-mono text-[9.5px] text-zinc-600 break-all">{labelPreviewPiece.id}</div>
                    <div className="pt-1 flex items-center gap-3 font-mono text-xs">
                      <span><strong>NET:</strong> {labelPreviewPiece.netCutLengthMm ?? labelPreviewPiece.lengthMm}×{labelPreviewPiece.netCutWidthMm ?? labelPreviewPiece.widthMm}</span>
                      <span><strong>{labelPreviewPiece.thicknessMm}mm</strong></span>
                    </div>
                    <div className="text-[10px] text-zinc-700">
                      {labelPreviewPiece.materialName} • CNC: {(labelPreviewPiece.holes?.length || 0) > 0 ? `${labelPreviewPiece.holes!.length} delik` : "Yok"}
                    </div>
                  </div>
                  <div className="col-span-4 flex flex-col items-center">
                    <svg viewBox="0 0 80 52" className="w-24 h-16">
                      <rect x="12" y="9" width="56" height="34" fill="#F4F4F5" stroke="#A1A1AA" strokeWidth="1" />
                      {labelPreviewPiece.edgeBanding.top && <line x1="12" y1="9" x2="68" y2="9" stroke="#09090B" strokeWidth="4" />}
                      {labelPreviewPiece.edgeBanding.bottom && <line x1="12" y1="43" x2="68" y2="43" stroke="#09090B" strokeWidth="4" />}
                      {labelPreviewPiece.edgeBanding.left && <line x1="12" y1="9" x2="12" y2="43" stroke="#09090B" strokeWidth="4" />}
                      {labelPreviewPiece.edgeBanding.right && <line x1="68" y1="9" x2="68" y2="43" stroke="#09090B" strokeWidth="4" />}
                      <text x="40" y="29" textAnchor="middle" fontFamily="monospace" fontSize="8" fontWeight="bold" fill="#18181B">
                        {labelPreviewPiece.edgeBandCode || `${countActiveBands(labelPreviewPiece.edgeBanding)}K`}
                      </text>
                    </svg>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-300 flex items-center justify-between gap-3">
                  <svg viewBox="0 0 210 22" className="h-5 flex-1">
                    {Array.from({ length: 42 }).map((_, i) => (
                      <rect key={i} x={i * 5} y="0" width={i % 3 === 0 ? 3 : i % 2 === 0 ? 1.4 : 2.2} height="22" fill="#09090B" />
                    ))}
                  </svg>
                  <span className="font-mono text-[10px] font-bold">v{project.version}</span>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 bg-[#F5F2EA] border-t border-[#E5DFD3] flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-[#78716C]">Zebra ZD421 • 203 DPI • ZPL II</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadThermalLabelsHtml();
                    setLabelPreviewPiece(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#EFECE4] border border-[#DED8CC] text-xs font-bold cursor-pointer"
                >
                  HTML Etiket
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadThermalLabelsZpl();
                    setLabelPreviewPiece(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#141413] hover:bg-stone-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  <span>Zebra .ZPL İndir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
