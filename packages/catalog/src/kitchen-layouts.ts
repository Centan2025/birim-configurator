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
  if (wall2.bays[0]?.door) {
    wall2.bays[0].door.type = "single_right";
  }

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
  const baseCorner = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard")!.createInstance("l_corner", "L Köşe Alt Dolabı (90° Katlanır)");
  baseCorner.templateId = "tpl_kb_14_l_corner";
  baseCorner.category = "kitchen_corner";
  baseCorner.moduleFamilyId = "fam_kitchen_base";
  baseCorner.isCorner = true;
  baseCorner.cornerAngleDeg = 90;
  baseCorner.dimensions = { width: 900, height: 720, depth: 900 };
  baseCorner.position = { x: 0, y: 0, z: 0 };
  if (baseCorner.bays[0]?.door) {
    baseCorner.bays[0].door.type = "folding";
    baseCorner.bays[0].door.doorSystemId = "folding_side";
  }

  const baseSink = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_sink")!.createInstance("l_sink", "Evye Dolabı 800");
  baseSink.position = { x: 900, y: 0, z: 0 };

  const baseDrawers = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_drawers")!.createInstance("l_drawers", "Çekmeceli Alt Dolap 800");
  baseDrawers.position = { x: 1700, y: 0, z: 0 };

  // Corner return arm along the left Z wall (starting right after the 900mm L-corner)
  const baseArm = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard")!.createInstance("l_arm", "Yan Dönüş Alt Dolap 600");
  baseArm.isCorner = false;
  baseArm.position = { x: 0, y: 0, z: 900 };
  baseArm.rotation = { x: 0, y: 90, z: 0 };

  const wall1 = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_wall_standard")!.createInstance("l_wall_1", "Üst Dolap 800 (Çift Kapak)");
  wall1.position = { x: 1700, y: 1450, z: 0 };
  wall1.dimensions.width = 800;
  if (wall1.bays[0]?.door) {
    wall1.bays[0].door.type = "double";
    wall1.bays[0].door.doorSystemId = "hinged_double";
  }

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
    modules: [baseCorner, baseSink, baseDrawers, baseArm, wall1],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createKitchenUProject(): DesignProject {
  const cornerLeft = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard")!.createInstance("u_corner_left", "Sol L Köşe Alt Dolabı 900");
  cornerLeft.templateId = "tpl_kb_14_l_corner";
  cornerLeft.category = "kitchen_corner";
  cornerLeft.moduleFamilyId = "fam_kitchen_base";
  cornerLeft.isCorner = true;
  cornerLeft.cornerAngleDeg = 90;
  cornerLeft.dimensions = { width: 900, height: 720, depth: 900 };
  cornerLeft.position = { x: 0, y: 0, z: 0 };
  if (cornerLeft.bays[0]?.door) {
    cornerLeft.bays[0].door.type = "folding";
    cornerLeft.bays[0].door.doorSystemId = "folding_side";
  }

  const baseSink = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_sink")!.createInstance("u_sink", "Evye Dolabı 1000");
  baseSink.dimensions.width = 1000;
  baseSink.position = { x: 900, y: 0, z: 0 };

  const cornerRight = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard")!.createInstance("u_corner_right", "Sağ L Köşe Alt Dolabı 900");
  cornerRight.templateId = "tpl_kb_14_l_corner";
  cornerRight.category = "kitchen_corner";
  cornerRight.moduleFamilyId = "fam_kitchen_base";
  cornerRight.isCorner = true;
  cornerRight.cornerAngleDeg = 90;
  cornerRight.dimensions = { width: 900, height: 720, depth: 900 };
  cornerRight.position = { x: 1900, y: 0, z: 0 };
  cornerRight.rotation = { x: 0, y: 90, z: 0 };
  if (cornerRight.bays[0]?.door) {
    cornerRight.bays[0].door.type = "folding";
    cornerRight.bays[0].door.doorSystemId = "folding_side";
  }

  const baseArmLeft = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_standard")!.createInstance("u_arm_left", "Sol Kol Alt Dolap 600");
  baseArmLeft.isCorner = false;
  baseArmLeft.position = { x: 0, y: 0, z: 900 };
  baseArmLeft.rotation = { x: 0, y: 90, z: 0 };

  const baseArmRight = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_base_drawers")!.createInstance("u_arm_right", "Sağ Kol Çekmeceli 600");
  baseArmRight.dimensions.width = 600;
  baseArmRight.isCorner = false;
  baseArmRight.position = { x: 2220, y: 0, z: 900 };
  baseArmRight.rotation = { x: 0, y: 270, z: 0 };

  const wallTop = KITCHEN_TEMPLATES.find((t) => t.templateId === "tpl_kitchen_wall_standard")!.createInstance("u_wall_top", "Üst Dolap 1000");
  wallTop.dimensions.width = 1000;
  wallTop.position = { x: 900, y: 1450, z: 0 };

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
          length: 2800,
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
    modules: [cornerLeft, baseSink, cornerRight, baseArmLeft, baseArmRight, wallTop],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
