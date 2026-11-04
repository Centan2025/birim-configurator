import { DesignProject, MaterialDefinition, ModuleInstance } from "./types";

export const DEFAULT_MATERIALS: MaterialDefinition[] = [
  {
    id: "mat_melamine_white",
    name: "Melamin Mat Beyaz (Gövde)",
    category: "laminate",
    thickness: 18,
    colorHex: "#f3f4f6",
    roughness: 0.5,
    metalness: 0.05,
    costPerM2: 24, // EUR / m²
    edgeBandCostPerM: 1.5,
  },
  {
    id: "mat_melamine_anthracite",
    name: "Melamin Antrasit Gri",
    category: "laminate",
    thickness: 18,
    colorHex: "#374151",
    roughness: 0.6,
    metalness: 0.1,
    costPerM2: 28,
    edgeBandCostPerM: 1.8,
  },
  {
    id: "mat_veneer_oak",
    name: "Doğal Meşe Kaplama",
    category: "wood",
    thickness: 18,
    colorHex: "#b58d59",
    roughness: 0.7,
    metalness: 0.0,
    costPerM2: 75,
    edgeBandCostPerM: 4.2,
  },
  {
    id: "mat_veneer_walnut",
    name: "Amerikan Ceviz Kaplama",
    category: "wood",
    thickness: 18,
    colorHex: "#5c4033",
    roughness: 0.65,
    metalness: 0.0,
    costPerM2: 95,
    edgeBandCostPerM: 5.0,
  },
  {
    id: "mat_lacquer_cream",
    name: "İpek Mat Lake Krem",
    category: "lacquer",
    thickness: 18,
    colorHex: "#ede8d0",
    roughness: 0.35,
    metalness: 0.05,
    costPerM2: 68,
    edgeBandCostPerM: 3.5,
  },
  {
    id: "mat_lacquer_sage",
    name: "İpek Mat Lake Adaçayı Yeşili",
    category: "lacquer",
    thickness: 18,
    colorHex: "#9caf88",
    roughness: 0.35,
    metalness: 0.05,
    costPerM2: 68,
    edgeBandCostPerM: 3.5,
  },
  {
    id: "mat_smoked_glass",
    name: "Füme Cam Alüminyum Çerçeve",
    category: "glass",
    thickness: 20,
    colorHex: "#2b2f33",
    roughness: 0.1,
    metalness: 0.9,
    costPerM2: 125,
    edgeBandCostPerM: 0,
  },
];

export function createDefaultWardrobeModule(id = "module_1"): ModuleInstance {
  return {
    id,
    name: "Master Gardırop Modülü",
    category: "wardrobe",
    position: { x: 0, y: 0, z: 0 },
    dimensions: {
      width: 1800,
      height: 2200,
      depth: 600,
    },
    carcass: {
      panelThickness: 18,
      backPanelThickness: 8,
      backPanelType: "grooved",
      plinthHeight: 80,
      doorPerimeterGap: 2,
      edgeBandThickness: 1,
      bodyMaterialId: "mat_melamine_white",
      doorMaterialId: "mat_veneer_oak",
    },
    isOpenFront: false,
    bays: [
      {
        index: 0,
        door: {
          id: "door_0",
          bayIndex: 0,
          type: "single_left",
          softClose: true,
          hingeCount: 4,
        },
        shelves: [
          { id: "shelf_0_1", bayIndex: 0, elevationY: 1750, isAdjustable: false },
          { id: "shelf_0_2", bayIndex: 0, elevationY: 350, isAdjustable: true },
        ],
        hangingRails: [
          { id: "rail_0_1", bayIndex: 0, elevationY: 1680 },
        ],
        drawers: [],
      },
      {
        index: 1,
        door: {
          id: "door_1",
          bayIndex: 1,
          type: "double",
          softClose: true,
          hingeCount: 8,
        },
        shelves: [
          { id: "shelf_1_top", bayIndex: 1, elevationY: 1800, isAdjustable: false },
        ],
        hangingRails: [
          { id: "rail_1_1", bayIndex: 1, elevationY: 1730 },
        ],
        drawers: [
          { id: "drawer_1_1", bayIndex: 1, elevationY: 0, height: 180, slideType: "soft_close" },
          { id: "drawer_1_2", bayIndex: 1, elevationY: 185, height: 180, slideType: "soft_close" },
        ],
      },
    ],
  };
}

export function createInitialProject(): DesignProject {
  const mod = createDefaultWardrobeModule();
  return {
    id: "proj_demo_01",
    version: 1,
    title: "Vadi İstanbul Villa - Ebeveyn Giyinme Odası",
    customerName: "Centan Mimarlık",
    branchId: "branch_vadistanbul",
    status: "draft",
    space: {
      id: "space_01",
      name: "Giyinme Odası",
      type: "wardrobe_zone",
      walls: [
        {
          id: "wall_main",
          name: "Ana Duvar",
          length: 3600,
          height: 2700,
          thickness: 150,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
        },
      ],
      ceilingHeight: 2700,
    },
    modules: [mod],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
