import { ModuleInstance } from "@birim/core";

export interface ModuleTemplate {
  templateId: string;
  name: string;
  description: string;
  category: ModuleInstance["category"];
  defaultDimensions: { width: number; height: number; depth: number };
  createInstance: (id: string, name?: string) => ModuleInstance;
}

export const WARDROBE_TEMPLATES: ModuleTemplate[] = [
  {
    templateId: "tpl_wardrobe_2door",
    name: "2 Kapaklı Standart Gardırop",
    description: "1000-1200mm genişlik, üst raf ve uzun askı alanı",
    category: "wardrobe",
    defaultDimensions: { width: 1200, height: 2200, depth: 600 },
    createInstance: (id, name = "2 Kapaklı Gardırop") => ({
      id,
      name,
      category: "wardrobe",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 1200, height: 2200, depth: 600 },
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
      bays: [
        {
          index: 0,
          door: { id: `door_${id}_0`, bayIndex: 0, type: "double", softClose: true, hingeCount: 8 },
          shelves: [
            { id: `shelf_${id}_0_top`, bayIndex: 0, elevationY: 1800, isAdjustable: false },
            { id: `shelf_${id}_0_bot`, bayIndex: 0, elevationY: 300, isAdjustable: true },
          ],
          hangingRails: [{ id: `rail_${id}_0`, bayIndex: 0, elevationY: 1730 }],
          drawers: [],
        },
      ],
    }),
  },
  {
    templateId: "tpl_wardrobe_3door_drawers",
    name: "3 Kapaklı Çekmeceli Master Gardırop",
    description: "1800mm genişlik, 2 bölme, 2 çekmece ve çift askı alanı",
    category: "wardrobe",
    defaultDimensions: { width: 1800, height: 2200, depth: 600 },
    createInstance: (id, name = "3 Kapaklı Master Gardırop") => ({
      id,
      name,
      category: "wardrobe",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 1800, height: 2200, depth: 600 },
      carcass: {
        panelThickness: 18,
        backPanelThickness: 8,
        backPanelType: "grooved",
        plinthHeight: 80,
        doorPerimeterGap: 2,
        edgeBandThickness: 1,
        bodyMaterialId: "mat_melamine_white",
        doorMaterialId: "mat_lacquer_cream",
      },
      bays: [
        {
          index: 0,
          door: { id: `door_${id}_0`, bayIndex: 0, type: "single_left", softClose: true, hingeCount: 4 },
          shelves: [
            { id: `shelf_${id}_0_1`, bayIndex: 0, elevationY: 1750, isAdjustable: false },
            { id: `shelf_${id}_0_2`, bayIndex: 0, elevationY: 1350, isAdjustable: true },
            { id: `shelf_${id}_0_3`, bayIndex: 0, elevationY: 950, isAdjustable: true },
            { id: `shelf_${id}_0_4`, bayIndex: 0, elevationY: 550, isAdjustable: true },
          ],
          hangingRails: [],
          drawers: [],
        },
        {
          index: 1,
          door: { id: `door_${id}_1`, bayIndex: 1, type: "double", softClose: true, hingeCount: 8 },
          shelves: [{ id: `shelf_${id}_1_top`, bayIndex: 1, elevationY: 1800, isAdjustable: false }],
          hangingRails: [{ id: `rail_${id}_1`, bayIndex: 1, elevationY: 1730 }],
          drawers: [
            { id: `drw_${id}_1_1`, bayIndex: 1, elevationY: 0, height: 180, slideType: "soft_close" },
            { id: `drw_${id}_1_2`, bayIndex: 1, elevationY: 185, height: 180, slideType: "soft_close" },
          ],
        },
      ],
    }),
  },
  {
    templateId: "tpl_wardrobe_walkin_open",
    name: "Açık Giyinme Odası Modülü (Walk-in)",
    description: "Kapak kullanılmayan modern açık giyinme sistemi",
    category: "wardrobe",
    defaultDimensions: { width: 1000, height: 2300, depth: 550 },
    createInstance: (id, name = "Açık Giyinme Modülü") => ({
      id,
      name,
      category: "wardrobe",
      isOpenFront: true,
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 1000, height: 2300, depth: 550 },
      carcass: {
        panelThickness: 18,
        backPanelThickness: 8,
        backPanelType: "grooved",
        plinthHeight: 60,
        doorPerimeterGap: 2,
        edgeBandThickness: 1,
        bodyMaterialId: "mat_veneer_walnut",
        doorMaterialId: "mat_veneer_walnut",
      },
      bays: [
        {
          index: 0,
          door: { id: `door_${id}_0`, bayIndex: 0, type: "open", softClose: false },
          shelves: [
            { id: `shelf_${id}_0_top`, bayIndex: 0, elevationY: 1900, isAdjustable: false },
            { id: `shelf_${id}_0_mid`, bayIndex: 0, elevationY: 1000, isAdjustable: false },
          ],
          hangingRails: [
            { id: `rail_${id}_0_top`, bayIndex: 0, elevationY: 1830 },
            { id: `rail_${id}_0_bot`, bayIndex: 0, elevationY: 930 },
          ],
          drawers: [
            { id: `drw_${id}_0_1`, bayIndex: 0, elevationY: 0, height: 160, slideType: "push_to_open" },
            { id: `drw_${id}_0_2`, bayIndex: 0, elevationY: 165, height: 160, slideType: "push_to_open" },
          ],
        },
      ],
    }),
  },
];

export const KITCHEN_TEMPLATES: ModuleTemplate[] = [
  {
    templateId: "tpl_kitchen_base_standard",
    name: "Mutfak Alt Dolap (Standart)",
    description: "600mm tek/çift kapaklı tezgâh altı dolap",
    category: "kitchen_base",
    defaultDimensions: { width: 600, height: 720, depth: 580 },
    createInstance: (id, name = "Alt Dolap 600") => ({
      id,
      name,
      category: "kitchen_base",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: 600, height: 720, depth: 580 },
      carcass: {
        panelThickness: 18,
        backPanelThickness: 8,
        backPanelType: "grooved",
        plinthHeight: 100,
        doorPerimeterGap: 2,
        edgeBandThickness: 1,
        bodyMaterialId: "mat_melamine_white",
        doorMaterialId: "mat_lacquer_sage",
      },
      bays: [
        {
          index: 0,
          door: { id: `door_${id}_0`, bayIndex: 0, type: "single_left", softClose: true, hingeCount: 2 },
          shelves: [{ id: `shelf_${id}_0_mid`, bayIndex: 0, elevationY: 340, isAdjustable: true }],
          hangingRails: [],
          drawers: [],
        },
      ],
    }),
  },
  {
    templateId: "tpl_kitchen_base_drawers",
    name: "Mutfak Çekmeceli Alt Dolap (3 Çekmece)",
    description: "1 çatal-kaşık + 2 tencere derin çekmeceli modül",
    category: "kitchen_base",
    defaultDimensions: { width: 800, height: 720, depth: 580 },
    createInstance: (id, name = "Çekmeceli Alt Dolap 800") => ({
      id,
      name,
      category: "kitchen_base",
      position: { x: 600, y: 0, z: 0 },
      dimensions: { width: 800, height: 720, depth: 580 },
      carcass: {
        panelThickness: 18,
        backPanelThickness: 8,
        backPanelType: "grooved",
        plinthHeight: 100,
        doorPerimeterGap: 2,
        edgeBandThickness: 1,
        bodyMaterialId: "mat_melamine_white",
        doorMaterialId: "mat_lacquer_sage",
      },
      bays: [
        {
          index: 0,
          door: { id: `door_${id}_0`, bayIndex: 0, type: "open", softClose: false },
          shelves: [],
          hangingRails: [],
          drawers: [
            { id: `drw_${id}_0_1`, bayIndex: 0, elevationY: 0, height: 140, slideType: "soft_close" },
            { id: `drw_${id}_0_2`, bayIndex: 0, elevationY: 145, height: 280, slideType: "soft_close" },
            { id: `drw_${id}_0_3`, bayIndex: 0, elevationY: 430, height: 280, slideType: "soft_close" },
          ],
        },
      ],
    }),
  },
  {
    templateId: "tpl_kitchen_base_sink",
    name: "Mutfak Evye Alt Dolabı",
    description: "Arkalık tesisat boşluklu 800mm evye dolabı",
    category: "kitchen_base",
    defaultDimensions: { width: 800, height: 720, depth: 580 },
    createInstance: (id, name = "Evye Dolabı 800") => ({
      id,
      name,
      category: "kitchen_base",
      position: { x: 1400, y: 0, z: 0 },
      dimensions: { width: 800, height: 720, depth: 580 },
      carcass: {
        panelThickness: 18,
        backPanelThickness: 8,
        backPanelType: "grooved",
        plinthHeight: 100,
        doorPerimeterGap: 2,
        edgeBandThickness: 1,
        bodyMaterialId: "mat_melamine_white",
        doorMaterialId: "mat_lacquer_sage",
      },
      bays: [
        {
          index: 0,
          door: { id: `door_${id}_0`, bayIndex: 0, type: "double", softClose: true, hingeCount: 4 },
          shelves: [],
          hangingRails: [],
          drawers: [],
        },
      ],
    }),
  },
  {
    templateId: "tpl_kitchen_wall_standard",
    name: "Mutfak Üst Dolap (Standart 720mm)",
    description: "600mm genişlik, 350mm derinlik, 2 raflı üst dolap",
    category: "kitchen_wall",
    defaultDimensions: { width: 600, height: 720, depth: 350 },
    createInstance: (id, name = "Üst Dolap 600") => ({
      id,
      name,
      category: "kitchen_wall",
      position: { x: 0, y: 1450, z: 0 },
      dimensions: { width: 600, height: 720, depth: 350 },
      carcass: {
        panelThickness: 18,
        backPanelThickness: 8,
        backPanelType: "grooved",
        plinthHeight: 0,
        doorPerimeterGap: 2,
        edgeBandThickness: 1,
        bodyMaterialId: "mat_melamine_white",
        doorMaterialId: "mat_lacquer_sage",
      },
      bays: [
        {
          index: 0,
          door: { id: `door_${id}_0`, bayIndex: 0, type: "single_left", softClose: true, hingeCount: 2 },
          shelves: [
            { id: `shelf_${id}_0_1`, bayIndex: 0, elevationY: 230, isAdjustable: true },
            { id: `shelf_${id}_0_2`, bayIndex: 0, elevationY: 460, isAdjustable: true },
          ],
          hangingRails: [],
          drawers: [],
        },
      ],
    }),
  },
  {
    templateId: "tpl_kitchen_tall_pantry",
    name: "Mutfak Boy Kiler Dolabı (Pantry)",
    description: "600mm genişlik, 2150mm boy dolap, iç çekmeceler",
    category: "kitchen_tall",
    defaultDimensions: { width: 600, height: 2150, depth: 580 },
    createInstance: (id, name = "Boy Kiler Dolabı") => ({
      id,
      name,
      category: "kitchen_tall",
      position: { x: 2200, y: 0, z: 0 },
      dimensions: { width: 600, height: 2150, depth: 580 },
      carcass: {
        panelThickness: 18,
        backPanelThickness: 8,
        backPanelType: "grooved",
        plinthHeight: 100,
        doorPerimeterGap: 2,
        edgeBandThickness: 1,
        bodyMaterialId: "mat_melamine_white",
        doorMaterialId: "mat_lacquer_sage",
      },
      bays: [
        {
          index: 0,
          door: { id: `door_${id}_0`, bayIndex: 0, type: "single_left", softClose: true, hingeCount: 5 },
          shelves: [
            { id: `shelf_${id}_0_1`, bayIndex: 0, elevationY: 1500, isAdjustable: true },
            { id: `shelf_${id}_0_2`, bayIndex: 0, elevationY: 1800, isAdjustable: true },
          ],
          hangingRails: [],
          drawers: [
            { id: `drw_${id}_0_1`, bayIndex: 0, elevationY: 0, height: 180, slideType: "soft_close" },
            { id: `drw_${id}_0_2`, bayIndex: 0, elevationY: 185, height: 180, slideType: "soft_close" },
            { id: `drw_${id}_0_3`, bayIndex: 0, elevationY: 370, height: 180, slideType: "soft_close" },
          ],
        },
      ],
    }),
  },
];
