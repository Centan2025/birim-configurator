import { DesignProject } from "@birim/core";
import { KITCHEN_TEMPLATES } from "./templates";

export function createKitchenLinearProject(): DesignProject {
  const baseSink = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_sink")!.createInstance("k_sink", "Evye Dolabı 800");
  baseSink.position = { x: 0, y: 0, z: 0 };

  const baseDrawers = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_drawers")!.createInstance("k_drawers", "Çekmeceli Dolap 800");
  baseDrawers.position = { x: 800, y: 0, z: 0 };

  const baseStd = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard")!.createInstance("k_base", "Alt Dolap 600");
  baseStd.position = { x: 1600, y: 0, z: 0 };

  const tallPantry = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_tall_pantry")!.createInstance("k_tall", "Boy Kiler 600");
  tallPantry.position = { x: 2200, y: 0, z: 0 };

  const wall1 = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_wall_standard")!.createInstance("k_wall_1", "Üst Dolap Sol 600");
  wall1.position = { x: 800, y: 1450, z: 0 };

  const wall2 = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_wall_standard")!.createInstance("k_wall_2", "Üst Dolap Sağ 600");
  wall2.position = { x: 1400, y: 1450, z: 0 };

  return {
    id: "proj_kitchen_linear",
    version: 1,
    title: "Levent Loft - Doğrusal Modern Mutfak",
    customerName: "Birim Showroom",
    branchId: "branch_levent",
    status: "draft",
    space: {
      id: "space_kitchen_01",
      name: "Doğrusal Mutfak Alanı",
      type: "kitchen_straight",
      walls: [
        {
          id: "wall_kitchen_back",
          name: "Mutfak Ana Duvar",
          length: 3200,
          height: 2600,
          thickness: 150,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
        },
      ],
      ceilingHeight: 2600,
    },
    modules: [baseSink, baseDrawers, baseStd, tallPantry, wall1, wall2],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
