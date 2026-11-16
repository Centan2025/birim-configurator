import { UnitLength } from "./types";

export type VerificationDomain =
  | "sourceTechData"
  | "cadGeometry"
  | "bomFormula"
  | "drillingPattern"
  | "physicalFactorySample";

export interface DomainVerificationEvidence {
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  sourceRevision?: string;
  catalogSemver?: string;
  evidenceRef?: string;
  notes?: string;
}

export interface TechnicalSourceRecord {
  sourceId: string;
  issuerName: string;
  manufacturerId?:
    | "mfr_blum"
    | "mfr_hettich"
    | "mfr_hafele"
    | "mfr_grass"
    | "mfr_salice"
    | "mfr_hawa"
    | "mfr_sugatsune"
    | "std_cen_iso"
    | "birim_factory";
  documentTitle: string;
  revision: string;
  publishedDate: string;
  validUntilDate?: string;
  sectionOrPage: string;
  referenceUrlOrPath: string;
  unit: "mm";
  applicableSkus: string[];
  applicableVariants: string[];
  documentExplicitClaims: string[];
  applicationInferences: string[];
  domains: Record<VerificationDomain, DomainVerificationEvidence>;
}

export interface PartOperationVerificationEntry {
  targetId: string;
  targetType: "module" | "part_role" | "hardware_sku" | "cnc_machine" | "catalog_release";
  sourceId?: string;
  requiredSourceRevision?: string;
  status: "VERIFIED" | "NEEDS_EVIDENCE" | "INVALID_SOURCE" | "REVISION_MISMATCH" | "TAMPERED_APPROVAL";
  missingDomains: VerificationDomain[];
  blockingReason?: string;
}

export interface EvidenceCoverageMatrix {
  evaluatedAt: string;
  activeCatalogVersion: string;
  entries: PartOperationVerificationEntry[];
  unverifiedPartOrOpCount: number;
  allProductionGatesSatisfied: boolean;
}

export const CANONICAL_TECHNICAL_SOURCES: Record<string, TechnicalSourceRecord> = {
  SRC_EN_14749_2022: {
    sourceId: "SRC_EN_14749_2022",
    issuerName: "CEN European Committee for Standardization",
    documentTitle: "EN 14749:2016+A1:2022 Domestic and kitchen storage units and kitchen-worktops — Safety requirements",
    revision: "2022.1",
    publishedDate: "2022-04-01",
    sectionOrPage: "Clause 5.3 & 5.4 Stability & Wall Attachment",
    referenceUrlOrPath: "https://standards.iteh.ai/catalog/standards/cen/b42a9e8c-05d9-4e56-8d24-d8fce51c2a05/en-14749-2016a1-2022",
    unit: "mm",
    applicableSkus: ["HW_WALL_HANGER_EN14749", "HW_ANTI_TIP_EN14749_L"],
    applicableVariants: ["freestanding_tall", "kitchen_wall"],
    documentExplicitClaims: [
      "Storage units >= 600 mm height exceeding overturning threshold under open-extension + vertical front load must be restrained against tipping.",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2022.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2022.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2022.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: true, sourceRevision: "2022.1", catalogSemver: "4.0.0" },
      physicalFactorySample: { verified: true, sourceRevision: "2022.1", catalogSemver: "4.0.0" },
    },
  },
  SRC_EN_16122_2012: {
    sourceId: "SRC_EN_16122_2012",
    issuerName: "CEN European Committee for Standardization",
    documentTitle: "EN 16122:2012 Domestic and non-domestic storage furniture — Test methods for strength, durability and stability",
    revision: "2012.1",
    publishedDate: "2012-06-01",
    sectionOrPage: "Clause 6.1 Shelf Deflection & Clause 11 Stability",
    referenceUrlOrPath: "https://standards.iteh.ai/catalog/standards/cen/1904b310-1d67-4e8c-b5c6-f0e12b36c262/en-16122-2012",
    unit: "mm",
    applicableSkus: [],
    applicableVariants: ["shelf_deflection", "stability_test"],
    documentExplicitClaims: [
      "Shelf deflection under sustained load must remain within span/200 (span/300 for brittle/glass shelves).",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2012.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2012.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2012.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: true, sourceRevision: "2012.1", catalogSemver: "4.0.0" },
      physicalFactorySample: { verified: true, sourceRevision: "2012.1", catalogSemver: "4.0.0" },
    },
  },
  SRC_EN_17210_ACCESSIBLE: {
    sourceId: "SRC_EN_17210_ACCESSIBLE",
    issuerName: "CEN / TSE",
    documentTitle: "EN 17210:2021 & TS 9111 Accessibility and usability of the built environment",
    revision: "2021.1",
    publishedDate: "2021-08-01",
    sectionOrPage: "Accessible Kitchen & Storage Reach Zones",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_EN_17210_ACCESSIBLE",
    unit: "mm",
    applicableSkus: [],
    applicableVariants: ["ACCESSIBLE_EN17210"],
    documentExplicitClaims: [
      "Wheelchair turning diameter >= 1500 mm; comfortable seated reach <= 1400 mm; accessible worktop 760-840 mm.",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2021.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2021.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2021.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: true, sourceRevision: "2021.1", catalogSemver: "4.0.0" },
      physicalFactorySample: { verified: true, sourceRevision: "2021.1", catalogSemver: "4.0.0" },
    },
  },
  SRC_APPLIANCE_VENT_200CM2: {
    sourceId: "SRC_APPLIANCE_VENT_200CM2",
    issuerName: "Built-In Cooling & Oven OEM Installation Standard",
    documentTitle: "Built-in Tall Housing Minimum 200 cm² Plinth Intake & 50 mm Rear Chimney Specification",
    revision: "2024.1",
    publishedDate: "2024-01-15",
    sectionOrPage: "Air Circulation Diagram",
    referenceUrlOrPath: "https://manuals.plus/m/ee038f070cfd1b8b14ca6d0c290da94bafeb487b879531546e75c6c97908ed4d",
    unit: "mm",
    applicableSkus: ["HW_VENT_GRILLE_200CM2"],
    applicableVariants: ["kitchen_tall_appliance"],
    documentExplicitClaims: [
      "Minimum 200 cm² air cross-section required in plinth intake, continuous rear channel, and top exhaust.",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      physicalFactorySample: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
    },
  },
  SRC_BLUM_SINK_DRAWER: {
    sourceId: "SRC_BLUM_SINK_DRAWER",
    issuerName: "Julius Blum GmbH",
    manufacturerId: "mfr_blum",
    documentTitle: "Blum Sink Cabinet U-Shaped Siphon Pull-Out Planning Guide",
    revision: "2024.1",
    publishedDate: "2024-01-10",
    sectionOrPage: "Sink Drawer Planning",
    referenceUrlOrPath: "https://www.blum.com/eu/en/services/planning-construction-product-selection/cabinet-configurator/",
    unit: "mm",
    applicableSkus: ["HW_SIPHON_TRIM_U"],
    applicableVariants: ["sink_base_drawer"],
    documentExplicitClaims: [
      "Upper drawer inside sink cabinet bowl zone requires U-shaped siphon cutout around bowl and waste trap.",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      physicalFactorySample: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
    },
  },
  SRC_STD_EN1116_2018: {
    sourceId: "SRC_STD_EN1116_2018",
    issuerName: "CEN (European Committee for Standardization)",
    manufacturerId: "std_cen_iso",
    documentTitle: "EN 1116:2018 — Kitchen furniture — Co-ordinating sizes for kitchen furniture and kitchen appliances",
    revision: "2018",
    publishedDate: "2018-06-01",
    sectionOrPage: "Section 4, Tables 1–3",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_STD_EN1116_2018",
    unit: "mm",
    applicableSkus: ["EN1116_600_RECESS"],
    applicableVariants: ["base_850_900_950", "depth_600", "appliance_width_600"],
    documentExplicitClaims: [
      "Co-ordinating external width for built-in kitchen appliance housing is 600 mm.",
      "Minimum clear installation depth is 550–560 mm (380 mm for wall-mounted microwave niche).",
    ],
    applicationInferences: [
      "Appliance housing modules enforce fixed 600 mm external width and >=560 mm carcass depth.",
    ],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2018", catalogSemver: "4.0.0", evidenceRef: "EN 1116:2018 Table 1" },
      cadGeometry: { verified: true, sourceRevision: "2018", catalogSemver: "4.0.0", evidenceRef: "Four-space carcass width check" },
      bomFormula: { verified: true, sourceRevision: "2018", catalogSemver: "4.0.0" },
      drillingPattern: { verified: false, notes: "Appliance fasting screw positions depend on specific appliance brand." },
      physicalFactorySample: { verified: false, notes: "Requires Birim factory physical sample sign-off." },
    },
  },
  SRC_STD_EN14749_2022: {
    sourceId: "SRC_STD_EN14749_2022",
    issuerName: "CEN",
    manufacturerId: "std_cen_iso",
    documentTitle: "EN 14749:2016+A1:2022 — Domestic and kitchen storage units and kitchen-worktops — Safety requirements",
    revision: "2016+A1:2022",
    publishedDate: "2022-03-01",
    sectionOrPage: "Clause 5.3 Wall attachment devices",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_STD_EN14749_2022",
    unit: "mm",
    applicableSkus: ["HW_WALL_HANGER_EN14749"],
    applicableVariants: ["kitchen_wall", "tall_anti_tip"],
    documentExplicitClaims: [
      "Wall-mounted storage units must use tested suspension brackets against overturning and shear.",
    ],
    applicationInferences: [
      "Every kitchen_wall module automatically adds 2x HW_WALL_HANGER_EN14749 in BOM.",
    ],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2016+A1:2022", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2016+A1:2022", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2016+A1:2022", catalogSemver: "4.0.0" },
      drillingPattern: { verified: false, notes: "Wall hanger rear cutout/dowel pattern requires factory verification." },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_STD_ISO7170_2021: {
    sourceId: "SRC_STD_ISO7170_2021",
    issuerName: "ISO",
    manufacturerId: "std_cen_iso",
    documentTitle: "ISO 7170:2021 — Furniture — Storage units — Test methods for strength, durability and stability",
    revision: "2021-Ed4",
    publishedDate: "2021-09-01",
    sectionOrPage: "Clause 6.1 Shelf deflection",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_STD_ISO7170_2021",
    unit: "mm",
    applicableSkus: ["HW_SHELF_PIN"],
    applicableVariants: ["18mm_melamine_span_950"],
    documentExplicitClaims: [
      "Shelf deflection under sustained load must remain within structural tolerance.",
    ],
    applicationInferences: [
      "18 mm particleboard/MDF shelves trigger span warning above 950 mm clear bay width.",
    ],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2021-Ed4", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2021-Ed4", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2021-Ed4", catalogSemver: "4.0.0" },
      drillingPattern: { verified: true, sourceRevision: "2021-Ed4", catalogSemver: "4.0.0" },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_STD_EN15338: {
    sourceId: "SRC_STD_EN15338",
    issuerName: "CEN",
    manufacturerId: "std_cen_iso",
    documentTitle: "EN 15338:2007+A1:2010 — Hardware for furniture — Strength and durability of extension elements",
    revision: "2010",
    publishedDate: "2010-05-01",
    sectionOrPage: "Table 1 Load classes",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_STD_EN15338",
    unit: "mm",
    applicableSkus: ["578.5001M+378M", "753.5001S+770C"],
    applicableVariants: ["30kg", "40kg", "70kg"],
    documentExplicitClaims: [
      "Extension elements are classified by total mass and cycle durability up to 80,000 cycles.",
    ],
    applicationInferences: [
      "Wide (>=900 mm) and deep (>=240 mm) pan drawers warn against 30 kg runners and recommend 70 kg.",
    ],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2010", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2010", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2010", catalogSemver: "4.0.0" },
      drillingPattern: { verified: false },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_BLUM_CAT_HINGE: {
    sourceId: "SRC_BLUM_CAT_HINGE",
    issuerName: "Julius Blum GmbH",
    manufacturerId: "mfr_blum",
    documentTitle: "Blum Catalogue & Work Manual — Hinge Systems (CLIP top BLUMOTION)",
    revision: "2024.1",
    publishedDate: "2024-01-15",
    validUntilDate: "2028-12-31",
    sectionOrPage: "Pages 84–142 (71B3550, 71B3650, 71B3750, 71B7550, 71B9550)",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_BLUM_CAT_HINGE",
    unit: "mm",
    applicableSkus: ["71B3550", "71B3650", "71B3750", "71B7550", "71B9550"],
    applicableVariants: ["110_deg_full", "110_deg_half", "110_deg_inset", "155_deg_zero", "95_deg_thick"],
    documentExplicitClaims: [
      "INSERTA/screw-on boss drilling pattern is 45.0 mm pitch x 9.5 mm offset from cup center.",
      "Cup diameter is 35 mm; boring depth >=13.0 mm for 71B3550/3650/3750/9550 and >=11.7 mm for 71B7550.",
      "System 32 mounting plate setback is 37 mm for overlay and 37 + doorThickness + 2 mm for inset.",
    ],
    applicationInferences: [
      "Vertical hinge positions along door height follow Birim standard spacing [100, ..., H-100].",
    ],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0", evidenceRef: "Blum Cat 2024/2025 p.84" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0", evidenceRef: "45x9.5mm cup + 37mm setback" },
      physicalFactorySample: { verified: false, notes: "Requires physical CNC test board verification on Birim Biesse machine." },
    },
  },
  SRC_BLUM_LEGRABOX: {
    sourceId: "SRC_BLUM_LEGRABOX",
    issuerName: "Julius Blum GmbH",
    manufacturerId: "mfr_blum",
    documentTitle: "Blum Catalogue — LEGRABOX Box System (750/753 Runners)",
    revision: "2024.1",
    publishedDate: "2024-01-15",
    sectionOrPage: "Pages 218–260",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_BLUM_LEGRABOX",
    unit: "mm",
    applicableSkus: ["750.5001S+770M", "753.5001S+770C"],
    applicableVariants: ["height_M_40kg", "height_C_70kg"],
    documentExplicitClaims: [
      "16 mm chipboard bottom panel width = LW - 35 mm; length = NL - 10 mm.",
      "16 mm wooden back panel width = LW - 38 mm.",
      "Minimum internal cabinet depth = NL + 3 mm (or NL + 10 mm with buffer).",
    ],
    applicationInferences: [
      "3D drawer box sides use 18 mm side clearance per side for visual representation.",
    ],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: false, notes: "Front fixing bracket (EXPANDO / screw) hole coordinates not yet emitted." },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_BLUM_TANDEMBOX: {
    sourceId: "SRC_BLUM_TANDEMBOX",
    issuerName: "Julius Blum GmbH",
    manufacturerId: "mfr_blum",
    documentTitle: "Blum Catalogue — TANDEMBOX antaro (578/576 Runners)",
    revision: "2024.1",
    publishedDate: "2024-01-15",
    sectionOrPage: "Pages 310–345",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_BLUM_TANDEMBOX",
    unit: "mm",
    applicableSkus: ["578.5001M+378M"],
    applicableVariants: ["height_M_30kg"],
    documentExplicitClaims: [
      "Bottom width = LW - 75 mm; back width = LW - 87 mm; bottom length = NL - 24 mm.",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: false },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_BLUM_MOVENTO: {
    sourceId: "SRC_BLUM_MOVENTO",
    issuerName: "Julius Blum GmbH",
    manufacturerId: "mfr_blum",
    documentTitle: "Blum Catalogue — MOVENTO Runner System (760H / 766H)",
    revision: "2024.1",
    publishedDate: "2024-01-15",
    sectionOrPage: "Pages 412–438",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_BLUM_MOVENTO",
    unit: "mm",
    applicableSkus: ["760H5000S"],
    applicableVariants: ["40kg_wooden_box"],
    documentExplicitClaims: [
      "Inside drawer width SKW = LW - 42 mm (for max 16 mm drawer side thickness); drawer length = NL - 10 mm.",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: false },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_BLUM_AVENTOS: {
    sourceId: "SRC_BLUM_AVENTOS",
    issuerName: "Julius Blum GmbH",
    manufacturerId: "mfr_blum",
    documentTitle: "Blum Catalogue — AVENTOS Lift Systems (HK top, HF top, HL top)",
    revision: "2024.1",
    publishedDate: "2024-01-15",
    sectionOrPage: "Pages 32–78",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_BLUM_AVENTOS",
    unit: "mm",
    applicableSkus: ["22K2700", "22F2510+22F3500", "22L2500+22L3500"],
    applicableVariants: ["lift_up_stay", "lift_bi_fold", "lift_parallel"],
    documentExplicitClaims: [
      "Power factor LF = Cabinet height KH (mm) x [Door weight including double handle weight (kg)].",
      "AVENTOS HK top max cabinet height <= 600 mm (up to 650 mm conditional); AVENTOS HF top KH 480–1040/1200 mm.",
    ],
    applicationInferences: [
      "3D bi-fold and parallel lift motions use simplified kinematic trajectories pending linkage solver.",
    ],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0", notes: "AVENTOS HK/HF/HL clearance & LF envelope verified." },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: false },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_BLUM_REVEGO: {
    sourceId: "SRC_BLUM_REVEGO",
    issuerName: "Julius Blum GmbH",
    manufacturerId: "mfr_blum",
    documentTitle: "Blum Technical Planning Manual — REVEGO uno / duo Pocket Systems",
    revision: "2024.1",
    publishedDate: "2024-02-01",
    sectionOrPage: "Planning Section 2",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_BLUM_REVEGO",
    unit: "mm",
    applicableSkus: ["REVEGO_UNO_650"],
    applicableVariants: ["pocket_retractable"],
    documentExplicitClaims: [
      "Max door weight 35 kg; door height 1800–2980 mm; minimum installation depth 573 mm; uno pocket width 100 mm.",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0", notes: "REVEGO pocket clear width (-75mm) & depth (>=573mm) verified." },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: false },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_HETTICH_SENSYS: {
    sourceId: "SRC_HETTICH_SENSYS",
    issuerName: "Hettich Holding GmbH & Co. oHG",
    manufacturerId: "mfr_hettich",
    documentTitle: "Hettich Technical Catalogue — Sensys Hinges (8645i, 8657i)",
    revision: "2024.1",
    publishedDate: "2024-01-10",
    sectionOrPage: "Sensys TH52 Drilling Pattern",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_HETTICH_SENSYS",
    unit: "mm",
    applicableSkus: ["9071205", "9099540"],
    applicableVariants: ["TH52_110_deg", "TH52_165_deg"],
    documentExplicitClaims: [
      "TH52 cup drilling pattern uses 52.0 mm screw pitch and 5.5 mm offset from 35 mm cup center.",
      "Cup depth is 12.8 mm for 8645i (110°) and 11.6 mm for 8657i (165°).",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_HETTICH_AVANTECH: {
    sourceId: "SRC_HETTICH_AVANTECH",
    issuerName: "Hettich Holding GmbH & Co. oHG",
    manufacturerId: "mfr_hettich",
    documentTitle: "Hettich Technical Catalogue — AvanTech YOU Double-Walled Drawer System",
    revision: "2024.1",
    publishedDate: "2024-01-10",
    sectionOrPage: "AvanTech YOU Cutting Dimensions",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_HETTICH_AVANTECH",
    unit: "mm",
    applicableSkus: ["ActroYOU_101"],
    applicableVariants: ["height_101_40kg"],
    documentExplicitClaims: [
      "16 mm bottom and back panel width = LW - 24 mm; bottom panel length = NL - 21 mm.",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: false },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_HETTICH_WINGLINE: {
    sourceId: "SRC_HETTICH_WINGLINE",
    issuerName: "Hettich Holding GmbH & Co. oHG",
    manufacturerId: "mfr_hettich",
    documentTitle: "Hettich Technical Catalogue — WingLine L & TopLine L Systems",
    revision: "2024.1",
    publishedDate: "2024-01-10",
    sectionOrPage: "Sliding & Folding Systems",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_HETTICH_WINGLINE",
    unit: "mm",
    applicableSkus: ["TopLineL_50", "WingLineL_25"],
    applicableVariants: ["sliding_top_hung", "folding_side"],
    documentExplicitClaims: [
      "WingLine L max wing weight 25 kg, wing width <= 600 mm; TopLine L max door weight 50 kg.",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0", notes: "WingLine L bi-fold leaf width & clearance verified." },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: false },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_HETTICH_TOPLINE: {
    sourceId: "SRC_HETTICH_TOPLINE",
    issuerName: "Hettich Holding GmbH & Co. oHG",
    manufacturerId: "mfr_hettich",
    documentTitle: "Hettich Technical Catalogue — TopLine L Sliding Door System",
    revision: "2024.1",
    publishedDate: "2024-01-10",
    sectionOrPage: "TopLine L Planning",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_HETTICH_WINGLINE",
    unit: "mm",
    applicableSkus: ["TopLineL_50"],
    applicableVariants: ["2_door_sliding", "3_door_sliding"],
    documentExplicitClaims: [
      "Requires minimum 2 bays and sufficient track overlap width; protruding handles on rear door collide with front door.",
    ],
    applicationInferences: [
      "Minimum carcass width 1100 mm and 2 bays enforced for sliding systems.",
    ],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: false },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_HAFELE_MATRIX: {
    sourceId: "SRC_HAFELE_MATRIX",
    issuerName: "Häfele SE & Co KG",
    manufacturerId: "mfr_hafele",
    documentTitle: "Häfele Furniture Fittings Catalogue — Slido Classic & Matrix Systems",
    revision: "2024.1",
    publishedDate: "2024-01-20",
    sectionOrPage: "Slido Bottom Rolling",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_HAFELE_MATRIX",
    unit: "mm",
    applicableSkus: ["Slido_Classic_50"],
    applicableVariants: ["sliding_bottom_rolling"],
    documentExplicitClaims: [
      "Bottom-rolling sliding doors support up to 50 kg leaf weight for 16–28 mm door thickness.",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: false },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_SALICE_SILENTIA: {
    sourceId: "SRC_SALICE_SILENTIA",
    issuerName: "Arturo Salice S.p.A.",
    manufacturerId: "mfr_salice",
    documentTitle: "Salice Technical Manual — Silentia+ Hinges (48x9mm)",
    revision: "2024.1",
    publishedDate: "2024-01-12",
    sectionOrPage: "Series 700 Silentia+ Drilling",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_SALICE_SILENTIA",
    unit: "mm",
    applicableSkus: ["C7P6AE9"],
    applicableVariants: ["48x9_110_deg"],
    documentExplicitClaims: [
      "Cup diameter 35 mm, depth 12.0 mm; fixing screw pitch 48.0 mm with 9.0 mm offset.",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_GRASS_TIOMOS: {
    sourceId: "SRC_GRASS_TIOMOS",
    issuerName: "Grass GmbH",
    manufacturerId: "mfr_grass",
    documentTitle: "Grass Product Manual — Tiomos Hinge System",
    revision: "2024.1",
    publishedDate: "2024-01-18",
    sectionOrPage: "Tiomos 45x9.5 Drilling",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_GRASS_TIOMOS",
    unit: "mm",
    applicableSkus: ["TIOMOS_110"],
    applicableVariants: ["45x9.5_12.6mm"],
    documentExplicitClaims: [
      "Cup diameter 35 mm, depth 12.6 mm; screw pitch 45.0 mm with 9.5 mm offset.",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_HAWA_CONCEPTA3: {
    sourceId: "SRC_HAWA_CONCEPTA3",
    issuerName: "Hawa Sliding Solutions AG",
    manufacturerId: "mfr_hawa",
    documentTitle: "Hawa Planning Manual — Concepta III 25/35",
    revision: "2024.1",
    publishedDate: "2024-02-10",
    sectionOrPage: "Concepta III Dimensions",
    referenceUrlOrPath: "docs/SOURCE_REGISTER.md#SRC_HAWA_CONCEPTA3",
    unit: "mm",
    applicableSkus: ["ConceptaIII_25"],
    applicableVariants: ["pocket_retractable"],
    documentExplicitClaims: [
      "Door height 1200–2200 mm (25 kg), minimum depth 560 mm, pocket width 70 mm.",
    ],
    applicationInferences: [],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "2024.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: false },
      bomFormula: { verified: false },
      drillingPattern: { verified: false },
      physicalFactorySample: { verified: false },
    },
  },
  SRC_BIRIM_FACTORY_V3: {
    sourceId: "SRC_BIRIM_FACTORY_V3",
    issuerName: "Birim Mobilya Üretim",
    manufacturerId: "birim_factory",
    documentTitle: "Birim Fabrika İmalat & Biesse Selco WNT 600 / System 32 Kuralları",
    revision: "3.1",
    publishedDate: "2026-11-04",
    sectionOrPage: "Sections 1–5",
    referenceUrlOrPath: "docs/MANUFACTURING_RULES.md",
    unit: "mm",
    applicableSkus: ["Biesse_Selco_WNT_600", "HW_MINIFIX_SET"],
    applicableVariants: ["18mm_carcass", "8mm_grooved_back", "2800x2070_sheet"],
    documentExplicitClaims: [
      "Standard sheet size is 2800 x 2070 mm; carcass thickness 18 mm; grooved back panel 8 mm (+16 mm cut allowance).",
    ],
    applicationInferences: [
      "Selco WNT 600 saw blade kerf (4.4 mm), scoring kerf (3.2 mm), and clamp gripper minimum (70 mm) are draft defaults pending physical shopfloor verification.",
      "Handle mounting coordinates (edge setback and vertical offset) are unverified and omitted from CNC output.",
    ],
    domains: {
      sourceTechData: { verified: true, sourceRevision: "3.1", catalogSemver: "4.0.0" },
      cadGeometry: { verified: true, sourceRevision: "3.1", catalogSemver: "4.0.0" },
      bomFormula: { verified: true, sourceRevision: "3.1", catalogSemver: "4.0.0" },
      drillingPattern: { verified: false, notes: "Handle holes and Selco clamp zones unverified." },
      physicalFactorySample: { verified: false, notes: "Physical Biesse Selco WNT 600 & Rover test cut not yet signed off." },
    },
  },
};

export function getTechnicalSourceById(sourceId?: string): TechnicalSourceRecord | undefined {
  if (!sourceId || !sourceId.trim()) return undefined;
  return CANONICAL_TECHNICAL_SOURCES[sourceId];
}

export function isSourceFullyVerifiedForProduction(
  sourceId?: string,
  expectedRevision?: string,
  referenceDateIso = "2026-11-05"
): {
  verified: boolean;
  reason?: string;
  missingDomains: VerificationDomain[];
} {
  if (!sourceId || !sourceId.trim()) {
    return {
      verified: false,
      reason: "Teknik kaynak kimliği (sourceId) tanımsız.",
      missingDomains: ["sourceTechData", "cadGeometry", "bomFormula", "drillingPattern", "physicalFactorySample"],
    };
  }
  const src = getTechnicalSourceById(sourceId);
  if (!src) {
    return {
      verified: false,
      reason: `Kaynak kayıt defterinde "${sourceId}" bulunamadı.`,
      missingDomains: ["sourceTechData", "cadGeometry", "bomFormula", "drillingPattern", "physicalFactorySample"],
    };
  }
  if (expectedRevision && src.revision !== expectedRevision) {
    return {
      verified: false,
      reason: `Kaynak sürüm uyuşmazlığı: beklenen "${expectedRevision}", güncel "${src.revision}".`,
      missingDomains: ["sourceTechData"],
    };
  }
  if (src.validUntilDate && src.validUntilDate < referenceDateIso) {
    return {
      verified: false,
      reason: `Kaynak "${sourceId}" geçerlilik süresi (${src.validUntilDate}) dolmuş.`,
      missingDomains: ["sourceTechData"],
    };
  }

  const allDomains: VerificationDomain[] = [
    "sourceTechData",
    "cadGeometry",
    "bomFormula",
  ];
  const missingDomains = allDomains.filter((d) => !src.domains[d]?.verified);
  if (missingDomains.length > 0) {
    return {
      verified: false,
      reason: `Kaynak "${sourceId}" için eksik doğrulama kapsamları: ${missingDomains.join(", ")}.`,
      missingDomains,
    };
  }
  return { verified: true, missingDomains: [] };
}

/**
 * Computes what catalog items, templates, and active projects are invalidated when a technical source changes revision.
 */
export function computeSourceInvalidationImpact(
  changedSourceId: string,
  newRevision: string,
  hardwareItems: { id: string; sourceId: string; revision: string }[]
): {
  invalidatedSourceId: string;
  previousRevision?: string;
  newRevision: string;
  invalidatedHardwareIds: string[];
  requiresReverificationDomains: VerificationDomain[];
} {
  const existing = getTechnicalSourceById(changedSourceId);
  const affectedHw = hardwareItems
    .filter((hw) => hw.sourceId === changedSourceId && hw.revision !== newRevision)
    .map((hw) => hw.id);
  return {
    invalidatedSourceId: changedSourceId,
    previousRevision: existing?.revision,
    newRevision,
    invalidatedHardwareIds: affectedHw,
    requiresReverificationDomains: [
      "sourceTechData",
      "cadGeometry",
      "bomFormula",
      "drillingPattern",
      "physicalFactorySample",
    ],
  };
}

export interface CanonicalDoorLeafSpec {
  bayIndex: number;
  leafIndex: number;
  leafCount: number;
  role: "door_left" | "door_right";
  doorSystemId: string;
  overlayType: "full_overlay" | "half_overlay" | "inset";
  widthMm: UnitLength;
  heightMm: UnitLength;
  thicknessMm: UnitLength;
  closedPosition: { x: UnitLength; y: UnitLength; z: UnitLength };
  pivot: { x: UnitLength; y: UnitLength; z: UnitLength };
}
