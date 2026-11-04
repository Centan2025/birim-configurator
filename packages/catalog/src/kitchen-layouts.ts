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
          elements: [],
        },
      ],
      ceilingHeight: 2600,
      elements: [],
    },
    modules: [baseSink, baseDrawers, baseStd, tallPantry, wall1, wall2],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createKitchenLProject(): DesignProject {
  const baseSink = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_sink")!.createInstance("l_sink", "Evye Dolabı 800");
  baseSink.position = { x: 600, y: 0, z: 0 };

  const baseDrawers = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_drawers")!.createInstance("l_drawers", "Çekmeceli Alt Dolap 800");
  baseDrawers.position = { x: 1400, y: 0, z: 0 };

  // Corner return arm
  const baseArm = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard")!.createInstance("l_arm", "Köşe Dönüş Dolabı 600");
  baseArm.position = { x: 0, y: 0, z: 600 };

  const wall1 = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_wall_standard")!.createInstance("l_wall_1", "Üst Dolap 600");
  wall1.position = { x: 1400, y: 1450, z: 0 };

  return {
    id: "proj_kitchen_l",
    version: 1,
    title: "Akasya Acıbadem - Modern L Mutfak",
    customerName: "Birim Showroom",
    branchId: "branch_akasya",
    status: "draft",
    space: {
      id: "space_kitchen_l",
      name: "L Mutfak Alanı",
      type: "kitchen_l",
      walls: [
        {
          id: "wall_l_main",
          name: "Ana Duvar",
          length: 2800,
          height: 2600,
          thickness: 150,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
          elements: [],
        },
        {
          id: "wall_l_side",
          name: "Yan Dönüş Duvarı",
          length: 1800,
          height: 2600,
          thickness: 150,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 90,
          elements: [],
        },
      ],
      ceilingHeight: 2600,
      elements: [],
    },
    modules: [baseSink, baseDrawers, baseArm, wall1],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createKitchenUProject(): DesignProject {
  const baseSink = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_sink")!.createInstance("u_sink", "Evye Dolabı 800");
  baseSink.position = { x: 600, y: 0, z: 0 };

  const baseArmLeft = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard")!.createInstance("u_arm_left", "Sol Kol Alt Dolap");
  baseArmLeft.position = { x: 0, y: 0, z: 600 };

  const baseArmRight = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_drawers")!.createInstance("u_arm_right", "Sağ Kol Çekmeceli");
  baseArmRight.position = { x: 1400, y: 0, z: 600 };

  const wallTop = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_wall_standard")!.createInstance("u_wall_top", "Üst Dolap");
  wallTop.position = { x: 700, y: 1450, z: 0 };

  return {
    id: "proj_kitchen_u",
    version: 1,
    title: "Kemer Country Villa - Geniş U Mutfak",
    customerName: "Birim Showroom",
    branchId: "branch_gokturk",
    status: "draft",
    space: {
      id: "space_kitchen_u",
      name: "U Mutfak Alanı",
      type: "kitchen_u",
      walls: [
        {
          id: "wall_u_back",
          name: "Arka Duvar",
          length: 2400,
          height: 2600,
          thickness: 150,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
          elements: [],
        },
      ],
      ceilingHeight: 2600,
      elements: [],
    },
    modules: [baseSink, baseArmLeft, baseArmRight, wallTop],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
