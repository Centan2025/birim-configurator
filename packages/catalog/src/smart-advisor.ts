import { UnitLength, ModuleInstance } from "@birim/core";
import { WARDROBE_TEMPLATES } from "./templates";

export interface PartitionOption {
  id: string;
  name: string;
  explanation: string;
  carcassCount: number;
  moduleWidths: UnitLength[];
  pros: string[];
  cons: string[];
}

export interface SmartAdvisorFeedback {
  spanWidthMm: number;
  recommendedPartitions: PartitionOption[];
  hingeAdvice: { doorHeightMm: number; recommendedHingesPerDoor: number; reason: string };
  drawerAdvice: { maxSafeDrawerWidth: number; reason: string };
  manufacturingFeasibilityNotes: string[];
}

/**
 * Deterministic Rule-Based Smart Design Advisor for cabinet layouts and spans.
 */
export function analyzeAndAdviseSpan(spanWidthMm: UnitLength, heightMm: UnitLength = 2200): SmartAdvisorFeedback {
  const partitions: PartitionOption[] = [];
  const feasibilityNotes: string[] = [];

  // Ergonomic and manufacturing limits
  const maxSingleCarcassWidth = 1200; // transport and handling ease
  const minCarcassWidth = 400;

  if (spanWidthMm > 2400) {
    feasibilityNotes.push(
      `${spanWidthMm}mm açıklık tek bir parça plaka veya gövde olarak taşınamaz. En az 2 veya 3 bağımsız gövdeye bölünmesi zorunludur.`
    );
  }

  // 1. Equal 2-Module Partition
  if (spanWidthMm >= 800 && spanWidthMm <= 2400) {
    const half = Math.floor(spanWidthMm / 2);
    partitions.push({
      id: "partition_2_equal",
      name: `2 Eşit Gövde (${half}mm + ${half}mm)`,
      explanation: "Standart simetrik çift gövde yapısı. Yatak odası ve giyinme odaları için en dengeli taşıma ve montaj ergonomisi.",
      carcassCount: 2,
      moduleWidths: [half, half],
      pros: ["Dengeli simetri", "Kolay nakliye ve montaj", "Eşit kapak ölçüleri"],
      cons: ["Genişlik 2000mm üstünde kapaklar genişleyebilir"],
    });
  }

  // 2. 3-Module Partition (for large spans e.g. 2400mm - 3600mm)
  if (spanWidthMm >= 1800) {
    const third = Math.floor(spanWidthMm / 3);
    partitions.push({
      id: "partition_3_equal",
      name: `3 Eşit Gövde (${third}mm + ${third}mm + ${third}mm)`,
      explanation: "Geniş duvarlar için optimum 3 gövdeli master dolap yerleşimi. Bay-bayan veya askı/raf ayrımı için ideal.",
      carcassCount: 3,
      moduleWidths: [third, third, third],
      pros: ["Mükemmel modüler esneklik", "Orta bölüm çekmece, yanlar askı düzeni", "Plaka firesi düşük"],
      cons: ["Birleşimlerde çift yan panel payı (18+18mm) gerekir"],
    });
  }

  // 3. 4-Module Partition (for very large spans e.g. 3000mm - 4000mm)
  if (spanWidthMm >= 2800) {
    const quarter = Math.floor(spanWidthMm / 4);
    partitions.push({
      id: "partition_4_equal",
      name: `4 Eşit Gövde (${quarter}mm x 4)`,
      explanation: "Lüks rezidans giyinme odaları için 4 bağımsız kule modülü. Tavana kadar gömme montaja tam uyumlu.",
      carcassCount: 4,
      moduleWidths: [quarter, quarter, quarter, quarter],
      pros: ["Yüksek yük taşıma kapasitesi", "Her kule bağımsız fonksiyonlandırılabilir"],
      cons: ["Daha fazla gövde paneli ve montaj işçiliği"],
    });
  }

  // Hinge advice based on height
  const recommendedHinges = heightMm > 2000 ? 5 : heightMm > 1600 ? 4 : heightMm > 900 ? 3 : 2;
  const hingeAdvice = {
    doorHeightMm: heightMm,
    recommendedHingesPerDoor: recommendedHinges,
    reason: `${heightMm}mm kapak yüksekliğinde kapak sarkmasını önlemek ve Blumotion frenli kapanış dengesini korumak için kapak başına ${recommendedHinges} adet menteşe zorunludur.`,
  };

  // Drawer advice
  const drawerAdvice = {
    maxSafeDrawerWidth: 1000,
    reason: "Tandembox çekmece raylarında 1000mm üzerindeki genişliklerde sehim ve ray kasılmasını önlemek için yan senkronizasyon mili önerilir.",
  };

  return {
    spanWidthMm,
    recommendedPartitions: partitions,
    hingeAdvice,
    drawerAdvice,
    manufacturingFeasibilityNotes: feasibilityNotes,
  };
}

/**
 * Builds concrete module instances from a chosen partition
 */
export function createModulesFromPartition(
  partition: PartitionOption,
  heightMm = 2200,
  depthMm = 600
): ModuleInstance[] {
  const template = WARDROBE_TEMPLATES[0];
  let curX = 0;

  return partition.moduleWidths.map((w, idx) => {
    const mod = template.createInstance(`mod_partition_${idx + 1}`, `Gövde ${idx + 1} (${w}mm)`);
    mod.position = { x: curX, y: 0, z: 0 };
    mod.dimensions = { width: w, height: heightMm, depth: depthMm };
    curX += w;
    return mod;
  });
}
