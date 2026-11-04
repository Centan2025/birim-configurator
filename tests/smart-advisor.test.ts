import { describe, it, expect } from "vitest";
import { analyzeAndAdviseSpan, createModulesFromPartition } from "@birim/catalog";

describe("Smart Design Advisor", () => {
  it("suggests 3-carcass partition and structural warning for large 3600mm span", () => {
    const feedback = analyzeAndAdviseSpan(3600, 2400);

    expect(feedback.spanWidthMm).toBe(3600);
    expect(feedback.manufacturingFeasibilityNotes.length).toBeGreaterThan(0);

    // Must recommend 3-module or 4-module partitions
    const partition3 = feedback.recommendedPartitions.find((p) => p.carcassCount === 3);
    expect(partition3).toBeDefined();
    expect(partition3!.moduleWidths.reduce((a, b) => a + b, 0)).toBe(3600);

    // Hinge advice for 2400mm door height: 5 hinges
    expect(feedback.hingeAdvice.recommendedHingesPerDoor).toBe(5);

    // Instantiate concrete modules from partition
    const modules = createModulesFromPartition(partition3!, 2400, 600);
    expect(modules).toHaveLength(3);
    expect(modules[0].dimensions.width).toBe(1200);
    expect(modules[1].position.x).toBe(1200);
    expect(modules[2].position.x).toBe(2400);
  });

  it("suggests 2 equal carcasses for 1800mm span", () => {
    const feedback = analyzeAndAdviseSpan(1800, 2100);
    const partition2 = feedback.recommendedPartitions.find((p) => p.carcassCount === 2);
    expect(partition2).toBeDefined();
    expect(partition2!.moduleWidths).toEqual([900, 900]);
  });
});
