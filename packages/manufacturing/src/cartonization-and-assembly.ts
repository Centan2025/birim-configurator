import { DesignProject } from "@birim/core";
import { CutPiece, HardwareBOMItem, ManufacturingBOM } from "./types";

export interface CartonPackedItem {
  pieceId: string;
  pieceName: string;
  dimensionsLabel: string;
  quantity: number;
  weightKg: number;
}

export interface CartonPackage {
  cartonNumber: number;
  cartonCode: string;
  moduleId: string;
  moduleName: string;
  packageRole: "carcass_panels" | "fronts_and_shelves" | "hardware_kit";
  outerLengthMm: number;
  outerWidthMm: number;
  outerHeightMm: number;
  grossWeightKg: number;
  maxErgonomicLimitKg: number;
  requiresTwoPersonLift: boolean;
  items: CartonPackedItem[];
  honeycombCornerCount: number;
}

export interface CartonizationManifest {
  projectId: string;
  projectTitle: string;
  totalCartons: number;
  totalGrossWeightKg: number;
  cartons: CartonPackage[];
}

const DEFAULT_DENSITY_KG_M3 = 680; // 18mm melamine/MDF average density
const MAX_SINGLE_CARTON_KG = 28.0; // Ergonomic flat-pack carrier threshold

function estimatePieceWeightKg(piece: CutPiece): number {
  const volM3 =
    (piece.lengthMm / 1000) * (piece.widthMm / 1000) * ((piece.thicknessMm || 18) / 1000);
  const density = piece.materialId.includes("glass") ? 2500 : DEFAULT_DENSITY_KG_M3;
  return Math.max(0.25, Number((volM3 * density * piece.quantity).toFixed(2)));
}

/**
 * Groups all cut panels and hardware kits into weight-balanced, flat-pack cartons
 * (`<= 28 kg` per box wherever single panels allow) with protective honeycomb padding.
 */
export function computeProjectCartonization(
  project: DesignProject,
  bom: ManufacturingBOM
): CartonizationManifest {
  const cartons: CartonPackage[] = [];
  let seq = 1;

  const byModule = new Map<string, CutPiece[]>();
  for (const piece of bom.cutList) {
    const list = byModule.get(piece.moduleId) || [];
    list.push(piece);
    byModule.set(piece.moduleId, list);
  }

  for (const [moduleId, pieces] of byModule.entries()) {
    const modName =
      project.modules.find((m) => m.id === moduleId)?.name ||
      pieces[0]?.moduleName ||
      "Modül";

    // Sort largest panels first so flat-pack footprint stays stable
    const sorted = [...pieces].sort(
      (a, b) => b.lengthMm * b.widthMm - a.lengthMm * a.widthMm
    );

    let bucket: CutPiece[] = [];
    let bucketKg = 0;

    const flushBucket = () => {
      if (bucket.length === 0) return;
      const maxL = Math.max(...bucket.map((p) => Math.max(p.lengthMm, p.widthMm)));
      const maxW = Math.max(...bucket.map((p) => Math.min(p.lengthMm, p.widthMm)));
      const stackH = bucket.reduce((s, p) => s + (p.thicknessMm || 18) * p.quantity, 0);
      const cardboardAndFoamKg = 1.4;
      const grossKg = Number((bucketKg + cardboardAndFoamKg).toFixed(1));
      const hasFronts = bucket.some(
        (p) => p.componentRole.startsWith("door") || p.componentRole === "drawer_front"
      );

      cartons.push({
        cartonNumber: seq,
        cartonCode: `BRM-KOLI-${String(seq).padStart(2, "0")}`,
        moduleId,
        moduleName: modName,
        packageRole: hasFronts ? "fronts_and_shelves" : "carcass_panels",
        outerLengthMm: maxL + 36,
        outerWidthMm: maxW + 36,
        outerHeightMm: Math.max(55, stackH + 24),
        grossWeightKg: grossKg,
        maxErgonomicLimitKg: MAX_SINGLE_CARTON_KG,
        requiresTwoPersonLift: grossKg > MAX_SINGLE_CARTON_KG || maxL > 2100,
        honeycombCornerCount: 8,
        items: bucket.map((p) => ({
          pieceId: p.id,
          pieceName: p.pieceName,
          dimensionsLabel: `${p.lengthMm}×${p.widthMm}×${p.thicknessMm} mm`,
          quantity: p.quantity,
          weightKg: estimatePieceWeightKg(p),
        })),
      });
      seq++;
      bucket = [];
      bucketKg = 0;
    };

    for (const p of sorted) {
      const wKg = estimatePieceWeightKg(p);
      if (bucket.length > 0 && bucketKg + wKg > MAX_SINGLE_CARTON_KG - 1.4) {
        flushBucket();
      }
      bucket.push(p);
      bucketKg += wKg;
    }
    flushBucket();
  }

  // Dedicated Master Hardware & Fasteners Box
  if (bom.hardwareList.length > 0) {
    const hwWeightKg = Number(
      Math.max(
        1.8,
        bom.hardwareList.reduce((s: number, h: HardwareBOMItem) => s + h.quantity * 0.18, 0.8)
      ).toFixed(1)
    );
    cartons.push({
      cartonNumber: seq,
      cartonCode: `BRM-KOLI-${String(seq).padStart(2, "0")}-HW`,
      moduleId: "master_hardware",
      moduleName: "Tüm Proje Bağlantı & Aksesuar Seti",
      packageRole: "hardware_kit",
      outerLengthMm: 560,
      outerWidthMm: 380,
      outerHeightMm: 220,
      grossWeightKg: hwWeightKg,
      maxErgonomicLimitKg: MAX_SINGLE_CARTON_KG,
      requiresTwoPersonLift: false,
      honeycombCornerCount: 4,
      items: bom.hardwareList.map((h) => ({
        pieceId: h.sku,
        pieceName: h.name,
        dimensionsLabel: `${h.sku} (${h.unit})`,
        quantity: h.quantity,
        weightKg: Number((h.quantity * 0.18).toFixed(2)),
      })),
    });
  }

  const totalGrossWeightKg = Number(
    cartons.reduce((s, c) => s + c.grossWeightKg, 0).toFixed(1)
  );

  return {
    projectId: project.id,
    projectTitle: project.title,
    totalCartons: cartons.length,
    totalGrossWeightKg,
    cartons,
  };
}

export function exportCartonManifestCsv(manifest: CartonizationManifest): string {
  const header =
    "Koli_Kodu;Koli_No;Modul_Adi;Paket_Tipi;Dis_Boy_mm;Dis_En_mm;Dis_Yukseklik_mm;Brut_Kg;Tasima_Sinifi;Parca_Sayisi";
  const rows = manifest.cartons.map((c) => {
    const carry = c.requiresTwoPersonLift ? "2 Kisilik Tasima" : "Tek Kisi Ergonomik";
    const count = c.items.reduce((s, i) => s + i.quantity, 0);
    return `${c.cartonCode};${c.cartonNumber};"${c.moduleName.replace(/"/g, '""')}";${c.packageRole};${c.outerLengthMm};${c.outerWidthMm};${c.outerHeightMm};${c.grossWeightKg};${carry};${count}`;
  });
  return [header, ...rows].join("\n");
}
