import { describe, it, expect } from "vitest";
import { generateDrillingForPart } from "@birim/manufacturing";
import { ParametricPart } from "@birim/core";

describe("Drilling Operations Engine (System 32)", () => {
  it("generates correct System 32 minifix, dowel and shelf pin holes for side panels", () => {
    const sidePart: ParametricPart = {
      id: "P_test_side_left",
      moduleId: "mod_1",
      label: "Sol Yan Panel",
      role: "carcass_side_left",
      dimensions: { width: 580, height: 2120, depth: 18 },
      materialId: "mat_melamine_white",
      grain: "lengthwise",
      edgeBanding: { top: false, bottom: true, left: true, right: false, thickness: 1 },
      jointType: "minifix_dowel",
      holes: [],
      position: { x: 0, y: 80, z: 0 },
    };

    const holes = generateDrillingForPart(sidePart);
    expect(holes.length).toBeGreaterThan(10);

    const minifixBolts = holes.filter((h) => h.purpose === "minifix_bolt");
    expect(minifixBolts.length).toBe(4); // 2 at bottom, 2 at top

    const dowels = holes.filter((h) => h.purpose === "dowel");
    expect(dowels.length).toBe(4); // Paired with minifix

    const shelfPins = holes.filter((h) => h.purpose === "shelf_pin");
    expect(shelfPins.length).toBeGreaterThan(0);
    // Shelf pins must follow 32mm grid intervals
    expect(shelfPins[0].diameter).toBe(5);
    expect(shelfPins[0].depth).toBe(12);
  });

  it("generates 35mm hinge cup holes and 8mm knock-in holes for door panels", () => {
    const doorPart: ParametricPart = {
      id: "P_test_door_left",
      moduleId: "mod_1",
      label: "Kapak Sol",
      role: "door_left",
      dimensions: { width: 596, height: 2116, depth: 18 },
      materialId: "mat_veneer_oak",
      grain: "lengthwise",
      edgeBanding: { top: true, bottom: true, left: true, right: true, thickness: 1 },
      jointType: "minifix_dowel",
      holes: [],
      position: { x: 0, y: 82, z: 600 },
    };

    const holes = generateDrillingForPart(doorPart);
    const cups = holes.filter((h) => h.purpose === "hinge_cup" && h.diameter === 35);
    expect(cups.length).toBeGreaterThanOrEqual(4); // 2116mm height requires 4 hinges
    expect(cups[0].x).toBe(21.5); // Standard 21.5mm Blum hinge cup center distance
    expect(cups[0].depth).toBe(12.5);
  });
});
