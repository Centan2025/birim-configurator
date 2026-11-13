import {
  DesignProject,
  ModuleInstance,
  isSinkModule,
  isCooktopModule,
  isBuiltInDishwasherModule,
  isBuiltInOvenOrFridgeTower,
  roundMm,
} from "@birim/core";

export interface MepUtilityPoint {
  id: string;
  discipline: "plumbing_cold" | "plumbing_hot" | "plumbing_drain" | "elec_appliance" | "elec_counter" | "elec_led_driver" | "hvac_hood_flue";
  label: string;
  codeNote: string;
  xFromLeftWallMm: number;
  yFromFloorMm: number;
  diameterOrSpec: string;
  moduleId: string;
}

/**
 * Computes exact construction-site MEP (Mechanical, Electrical, Plumbing) rough-in coordinates
 * referenced from Left Wall (X=0) and Finished Floor Level (FFL ±0.00).
 */
export function computeProjectMepUtilityPoints(project: DesignProject): MepUtilityPoint[] {
  const points: MepUtilityPoint[] = [];

  const mainWallModules = project.modules.filter(
    (m) => m.category !== "complementary" && (((m.rotation?.y ?? 0) % 360) + 360) % 360 === 0
  );

  mainWallModules.forEach((mod: ModuleInstance) => {
    const cx = roundMm(mod.position.x + mod.dimensions.width / 2, 0);
    const modTopY = roundMm(mod.position.y + mod.dimensions.height, 0);

    // 1. Sink Base: Hot/Cold angle valves + Ø50 waste drain
    if (isSinkModule(mod)) {
      points.push(
        {
          id: `mep_hot_${mod.id}`,
          discipline: "plumbing_hot",
          label: "Sıcak Su Taharet Musluğu (1/2\")",
          codeNote: "FFL +500mm • Merkez -50mm",
          xFromLeftWallMm: cx - 50,
          yFromFloorMm: 500,
          diameterOrSpec: "PPR Ø20 / 1/2\"",
          moduleId: mod.id,
        },
        {
          id: `mep_cold_${mod.id}`,
          discipline: "plumbing_cold",
          label: "Soğuk Su + Bulaşık Musluğu (1/2\")",
          codeNote: "FFL +500mm • Merkez +50mm",
          xFromLeftWallMm: cx + 50,
          yFromFloorMm: 500,
          diameterOrSpec: "PPR Ø20 / Çift Çıkış",
          moduleId: mod.id,
        },
        {
          id: `mep_drain_${mod.id}`,
          discipline: "plumbing_drain",
          label: "Pis Su Gider Ağzı (Ø50 PVC)",
          codeNote: "FFL +420mm • Sifon Aksı",
          xFromLeftWallMm: cx,
          yFromFloorMm: 420,
          diameterOrSpec: "Ø50mm PVC",
          moduleId: mod.id,
        }
      );
    }

    // 2. Built-in Dishwasher: Per electrical code, socket MUST sit in adjacent bay (+350mm), never behind machine!
    if (isBuiltInDishwasherModule(mod)) {
      const safeSocketX = mod.position.x >= 120 ? mod.position.x - 90 : mod.position.x + mod.dimensions.width + 90;
      points.push({
        id: `mep_dsh_pwr_${mod.id}`,
        discipline: "elec_appliance",
        label: "Bulaşık Makinesi Prizi (Yandaki Dolap İçinde)",
        codeNote: "Cihaz arkasına konulmaz • FFL +350mm",
        xFromLeftWallMm: roundMm(safeSocketX, 0),
        yFromFloorMm: 350,
        diameterOrSpec: "16A Topraklı (3×2.5mm²)",
        moduleId: mod.id,
      });
    }

    // 3. Cooktop + Extractor Hood Flue + Worktop Socket
    if (isCooktopModule(mod)) {
      points.push(
        {
          id: `mep_hob_pwr_${mod.id}`,
          discipline: "elec_appliance",
          label: "Ankastre Ocak Besleme Buat / Prizi",
          codeNote: "FFL +550mm",
          xFromLeftWallMm: cx + 120,
          yFromFloorMm: 550,
          diameterOrSpec: "16A / Trifaze Hazır Buat",
          moduleId: mod.id,
        },
        {
          id: `mep_hood_flue_${mod.id}`,
          discipline: "hvac_hood_flue",
          label: "Davlumbaz Baca Çıkışı & Priz",
          codeNote: "FFL +2180mm • Ocak Ekseni",
          xFromLeftWallMm: cx,
          yFromFloorMm: 2180,
          diameterOrSpec: "Ø150mm Alüminyum Baca + 10A Priz",
          moduleId: mod.id,
        }
      );
    }

    // 4. Tall Oven / Fridge Tower
    if (isBuiltInOvenOrFridgeTower(mod)) {
      points.push({
        id: `mep_tower_pwr_${mod.id}`,
        discipline: "elec_appliance",
        label: "Ankastre Fırın / Mikrodalga / Soğutucu Prizi",
        codeNote: "50mm arka havalandırma boşluğunda",
        xFromLeftWallMm: cx,
        yFromFloorMm: Math.min(2100, Math.max(680, modTopY - 220)),
        diameterOrSpec: "16A Müstakil Hat (3×2.5mm²)",
        moduleId: mod.id,
      });
    }

    // 5. Countertop General Appliance Socket on standard kitchen base cabinets (>500mm wide, non-sink/hob)
    if (
      mod.category === "kitchen_base" &&
      !isSinkModule(mod) &&
      !isCooktopModule(mod) &&
      !isBuiltInDishwasherModule(mod) &&
      mod.dimensions.width >= 500
    ) {
      points.push({
        id: `mep_ctop_sock_${mod.id}`,
        discipline: "elec_counter",
        label: "Tezgâh Üstü İkili Priz",
        codeNote: "FFL +1100mm (Tezgâh +20cm)",
        xFromLeftWallMm: cx,
        yFromFloorMm: 1100,
        diameterOrSpec: "2×16A Kapaklı Priz",
        moduleId: mod.id,
      });
    }

    // 6. 24V DC LED Driver Power Tail on LED-equipped Wardrobes or Wall Cabinets
    if (mod.carcass.ledLightingEnabled) {
      points.push({
        id: `mep_led_drv_${mod.id}`,
        discipline: "elec_led_driver",
        label: "24V DC LED Trafo Besleme Ucu",
        codeNote: `Dolap üstü gizli trafo noktası (+${modTopY + 35}mm)`,
        xFromLeftWallMm: cx,
        yFromFloorMm: modTopY + 35,
        diameterOrSpec: "220V AC Buat Ucu (2×1.5mm²)",
        moduleId: mod.id,
      });
    }
  });

  return points;
}

/**
 * Renders a printable, architect-grade 2D MEP Coordination Plan SVG (Şantiye Elektrik & Sıhhi Tesisat Paftası).
 */
export function generateMepCoordinationPlanSvg(project: DesignProject): string {
  const points = computeProjectMepUtilityPoints(project);
  const wallLen = Math.max(
    2400,
    project.space?.walls?.[0]?.length || 3600,
    ...project.modules.map((m) => m.position.x + m.dimensions.width + 200)
  );
  const ceilH = Math.max(2500, project.space?.ceilingHeight || 2650);

  const svgW = 1080;
  const svgH = 720;
  const padL = 95;
  const padR = 65;
  const padT = 68;
  const padB = 135;
  const scale = Math.min((svgW - padL - padR) / wallLen, (svgH - padT - padB) / ceilH);
  const ox = padL;
  const oy = svgH - padB; // FFL ±0.00 line

  const mx = (xMm: number) => roundMm(ox + xMm * scale, 1);
  const my = (yMm: number) => roundMm(oy - yMm * scale, 1);

  const modShapes = project.modules
    .filter((m) => (((m.rotation?.y ?? 0) % 360) + 360) % 360 === 0)
    .map((m) => {
      const rx = mx(m.position.x);
      const ry = my(m.position.y + m.dimensions.height);
      const rw = Math.max(4, roundMm(m.dimensions.width * scale, 1));
      const rh = Math.max(4, roundMm(m.dimensions.height * scale, 1));
      return `<g>
        <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="none" stroke="#94a3b8" stroke-dasharray="4 3" stroke-width="1.1"/>
        <text x="${roundMm(rx + rw / 2, 1)}" y="${roundMm(ry + 14, 1)}" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#64748b">${m.name.replace(/[<>&"]/g, "").slice(0, 20)}</text>
      </g>`;
    })
    .join("\n");

  const colorFor = (d: MepUtilityPoint["discipline"]) => {
    if (d === "plumbing_hot") return "#dc2626";
    if (d === "plumbing_cold") return "#2563eb";
    if (d === "plumbing_drain") return "#0f766e";
    if (d === "hvac_hood_flue") return "#0891b2";
    if (d === "elec_led_driver") return "#d97706";
    return "#7c3aed";
  };

  const symbolGlyph = (p: MepUtilityPoint) => {
    const px = mx(p.xFromLeftWallMm);
    const py = my(p.yFromFloorMm);
    const c = colorFor(p.discipline);
    const shortTag =
      p.discipline === "plumbing_hot"
        ? "SS"
        : p.discipline === "plumbing_cold"
        ? "CS"
        : p.discipline === "plumbing_drain"
        ? "Ø50"
        : p.discipline === "hvac_hood_flue"
        ? "BACA"
        : p.discipline === "elec_led_driver"
        ? "LED"
        : "16A";

    return `<g>
      <line x1="${px}" y1="${oy}" x2="${px}" y2="${py}" stroke="${c}" stroke-opacity="0.35" stroke-dasharray="2 3" stroke-width="1"/>
      <circle cx="${px}" cy="${py}" r="10" fill="#ffffff" stroke="${c}" stroke-width="2"/>
      <text x="${px}" y="${py + 3}" text-anchor="middle" font-family="monospace" font-weight="700" font-size="7.5" fill="${c}">${shortTag}</text>
      <text x="${px}" y="${py - 14}" text-anchor="middle" font-family="monospace" font-size="8.5" font-weight="700" fill="#0f172a">X:${p.xFromLeftWallMm} / H:+${p.yFromFloorMm}</text>
    </g>`;
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <rect width="${svgW}" height="${svgH}" fill="#ffffff"/>
  <text x="${ox}" y="28" font-family="sans-serif" font-size="14" font-weight="700" fill="#0f172a">BİRİM MİMARİ ŞANTİYE ELEKTRİK &amp; SIHHİ TESİSAT AKS PAFTASI (MEP)</text>
  <text x="${ox}" y="46" font-family="sans-serif" font-size="10.5" fill="#475569">Proje: ${(project.title || "Proje").replace(/[<>&"]/g, "")} • Referans: Sol Bitmiş Duvar (X=0) ve Bitmiş Döşeme Kotu (FFL ±0.00) • Ölçüler: mm</text>

  <!-- Duvar Sınırı & Döşeme Çizgisi -->
  <rect x="${ox}" y="${my(ceilH)}" width="${roundMm(wallLen * scale, 1)}" height="${roundMm(ceilH * scale, 1)}" fill="#f8fafc" stroke="#334155" stroke-width="1.5"/>
  <line x1="${ox - 24}" y1="${oy}" x2="${mx(wallLen) + 24}" y2="${oy}" stroke="#0f172a" stroke-width="2.4"/>
  <text x="${ox - 8}" y="${oy - 6}" text-anchor="end" font-family="monospace" font-size="10" font-weight="700" fill="#0f172a">FFL ±0.00</text>
  <text x="${ox}" y="${oy + 18}" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700" fill="#0f172a">X=0 (Sol Duvar)</text>

  <!-- Modül İzdüşümleri -->
  ${modShapes}

  <!-- Tesisat & Elektrik Noktaları -->
  ${points.map(symbolGlyph).join("\n")}

  <!-- Lejant -->
  <g transform="translate(${ox}, ${oy + 38})">
    <rect x="0" y="0" width="${svgW - padL - padR}" height="76" rx="8" fill="#f1f5f9" stroke="#cbd5e1"/>
    <text x="14" y="20" font-family="sans-serif" font-size="10" font-weight="700" fill="#0f172a">ŞANTİYE UYGULAMA LEJANTI (${points.length} Nokta):</text>
    <text x="14" y="38" font-family="sans-serif" font-size="9.5" fill="#dc2626">● SS: Sıcak Su (+500mm)</text>
    <text x="165" y="38" font-family="sans-serif" font-size="9.5" fill="#2563eb">● CS: Soğuk Su (+500mm)</text>
    <text x="320" y="38" font-family="sans-serif" font-size="9.5" fill="#0f766e">● Ø50: Pis Su Gider (+420mm)</text>
    <text x="500" y="38" font-family="sans-serif" font-size="9.5" fill="#7c3aed">● 16A: Ankastre / Tezgâh Priz (+350/+1100mm)</text>
    <text x="770" y="38" font-family="sans-serif" font-size="9.5" fill="#0891b2">● BACA: Ø150 Davlumbaz (+2180mm)</text>
    <text x="14" y="58" font-family="sans-serif" font-size="9" fill="#475569">Not: Tam ankastre bulaşık makinesi arkasına priz/vana bırakmayınız; priz yandaki eviye modülü içine (+350mm) taşınmıştır.</text>
  </g>
</svg>`;
}

/**
 * Generates an AutoCAD / Revit / BricsCAD compatible multi-layer R2000 ASCII .DXF architectural sheet
 * with standardized AIA layers: A-WALL, A-CABINET, A-TABLE-MITER, M-PLUMBING, M-HVAC-FLUE, E-POWER, A-DIM.
 */
export function exportArchitecturalMepDxf(project: DesignProject): string {
  const points = computeProjectMepUtilityPoints(project);
  const wallLen = Math.max(
    2400,
    project.space?.walls?.[0]?.length || 3600,
    ...project.modules.map((m) => m.position.x + m.dimensions.width + 200)
  );
  const ceilH = Math.max(2500, project.space?.ceilingHeight || 2650);

  const entities: string[] = [];
  const dxfRect = (layer: string, x: number, y: number, w: number, h: number) => {
    entities.push(
      "0", "LWPOLYLINE",
      "8", layer,
      "90", "4",
      "70", "1",
      "10", String(roundMm(x, 2)), "20", String(roundMm(y, 2)),
      "10", String(roundMm(x + w, 2)), "20", String(roundMm(y, 2)),
      "10", String(roundMm(x + w, 2)), "20", String(roundMm(y + h, 2)),
      "10", String(roundMm(x, 2)), "20", String(roundMm(y + h, 2))
    );
  };

  const dxfCircle = (layer: string, cx: number, cy: number, r: number) => {
    entities.push(
      "0", "CIRCLE",
      "8", layer,
      "10", String(roundMm(cx, 2)),
      "20", String(roundMm(cy, 2)),
      "30", "0.0",
      "40", String(roundMm(r, 2))
    );
  };

  const dxfText = (layer: string, x: number, y: number, height: number, text: string) => {
    const ascii = text
      .replace(/ğ/g, "g").replace(/Ğ/g, "G")
      .replace(/ü/g, "u").replace(/Ü/g, "U")
      .replace(/ş/g, "s").replace(/Ş/g, "S")
      .replace(/ı/g, "i").replace(/İ/g, "I")
      .replace(/ö/g, "o").replace(/Ö/g, "O")
      .replace(/ç/g, "c").replace(/Ç/g, "C");
    entities.push(
      "0", "TEXT",
      "8", layer,
      "10", String(roundMm(x, 2)),
      "20", String(roundMm(y, 2)),
      "30", "0.0",
      "40", String(roundMm(height, 2)),
      "1", ascii
    );
  };

  // Wall & Floor Reference Envelope
  dxfRect("A-WALL", 0, 0, wallLen, ceilH);
  dxfText("A-DIM", 0, -90, 32, `BIRIM MIMARI MEP PAFTASI - DUVAR BOYU: ${wallLen}mm / TAVAN: ${ceilH}mm`);

  // Cabinet Elevation Envelopes + Attached Table Miter Callouts
  project.modules.forEach((m) => {
    const layer = m.complementaryRole === "attached_table" ? "A-TABLE-MITER" : "A-CABINET";
    dxfRect(layer, m.position.x, m.position.y, m.dimensions.width, m.dimensions.height);
    const angle = m.attachedTableConfig?.angleDeg;
    const tag = angle
      ? `${m.name} [ACILI BIRLESIM PAH: ${angle} DERECE]`
      : `${m.name} (${m.dimensions.width}x${m.dimensions.height})`;
    dxfText(layer, m.position.x + 25, m.position.y + m.dimensions.height / 2, 22, tag);
  });

  // MEP Utility Points on Discipline Layers
  points.forEach((pt) => {
    const layer = pt.discipline.startsWith("plumbing")
      ? "M-PLUMBING"
      : pt.discipline === "hvac_hood_flue"
      ? "M-HVAC-FLUE"
      : "E-POWER";
    const radius = pt.discipline === "hvac_hood_flue" ? 75 : 35;
    dxfCircle(layer, pt.xFromLeftWallMm, pt.yFromFloorMm, radius);
    dxfText(
      "A-DIM",
      pt.xFromLeftWallMm + radius + 12,
      pt.yFromFloorMm - 8,
      18,
      `${pt.label} [X=${pt.xFromLeftWallMm} H=+${pt.yFromFloorMm}]`
    );
  });

  return [
    "0", "SECTION",
    "2", "HEADER",
    "9", "$INSUNITS", "70", "4", // 4 = Millimeters
    "0", "ENDSEC",
    "0", "SECTION",
    "2", "TABLES",
    "0", "TABLE",
    "2", "LAYER",
    "70", "7",
    "0", "LAYER", "2", "A-WALL", "70", "0", "62", "7", "6", "CONTINUOUS",
    "0", "LAYER", "2", "A-CABINET", "70", "0", "62", "8", "6", "CONTINUOUS",
    "0", "LAYER", "2", "A-TABLE-MITER", "70", "0", "62", "30", "6", "CONTINUOUS",
    "0", "LAYER", "2", "M-PLUMBING", "70", "0", "62", "5", "6", "CONTINUOUS",
    "0", "LAYER", "2", "M-HVAC-FLUE", "70", "0", "62", "4", "6", "CONTINUOUS",
    "0", "LAYER", "2", "E-POWER", "70", "0", "62", "1", "6", "CONTINUOUS",
    "0", "LAYER", "2", "A-DIM", "70", "0", "62", "3", "6", "CONTINUOUS",
    "0", "ENDTAB",
    "0", "ENDSEC",
    "0", "SECTION",
    "2", "ENTITIES",
    ...entities,
    "0", "ENDSEC",
    "0", "EOF",
  ].join("\r\n");
}
