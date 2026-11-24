import { describe, expect, it } from "vitest";
import type { DesignProject } from "@birim/core";
import { V4_MODULE_TEMPLATES } from "@birim/catalog";
import {
  computeMultiWallDragPreview,
  computeMultiWallModuleSnap,
} from "../apps/configurator/src/v3/engine/multiWallSnapAndBvhEngine";

const SAMPLE_TPL_ID = V4_MODULE_TEMPLATES[0].templateId;

describe("computeMultiWallDragPreview", () => {
  const buildUShapedProject = (): DesignProject =>
    ({
      id: "proj_test_u",
      schemaVersion: 4,
      name: "U-Kitchen Test",
      modules: [],
      sceneObjects: [],
      customMaterials: [],
      space: {
        ceilingHeight: 2600,
        walls: [
          {
            id: "wall_main",
            name: "Ana Duvar",
            length: 3600,
            height: 2600,
            thickness: 150,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            elements: [],
          },
          {
            id: "wall_left",
            name: "Sol Duvar",
            length: 2800,
            height: 2600,
            thickness: 150,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 90,
            elements: [],
          },
          {
            id: "wall_right",
            name: "Sağ Duvar",
            length: 2800,
            height: 2600,
            thickness: 150,
            position: { x: 3600, y: 0, z: 0 },
            rotationY: 90,
            elements: [],
          },
        ],
      },
    }) as unknown as DesignProject;

  it("places drag ghost preview on selected Left Wall matching drop result to 0mm", () => {
    const project = buildUShapedProject();
    const preview = computeMultiWallDragPreview(project, SAMPLE_TPL_ID, {
      wallId: "wall_left",
      worldX: 280,
      worldZ: 1200,
    });
    const dropped = computeMultiWallModuleSnap(project, SAMPLE_TPL_ID, {
      wallId: "wall_left",
      worldX: 280,
      worldZ: 1200,
    });

    expect(preview).not.toBeNull();
    expect(dropped).not.toBeNull();
    expect(preview!.wallId).toBe("wall_left");
    expect(preview!.rotationYDeg).toBe(90);
    expect(preview!.snappedX).toBe(dropped!.moduleInstance.position.x);
    expect(preview!.snappedY).toBe(dropped!.moduleInstance.position.y);
    expect(preview!.snappedZ).toBe(dropped!.moduleInstance.position.z);
    expect(preview!.rotationYDeg).toBe(dropped!.snap.rotationYDeg);
    expect(preview!.snapSlots.length).toBeGreaterThan(0);
  });

  it("places drag ghost preview on selected Right Wall matching drop result to 0mm", () => {
    const project = buildUShapedProject();
    const preview = computeMultiWallDragPreview(project, SAMPLE_TPL_ID, {
      wallId: "wall_right",
      worldX: 3320,
      worldZ: 900,
    });
    const dropped = computeMultiWallModuleSnap(project, SAMPLE_TPL_ID, {
      wallId: "wall_right",
      worldX: 3320,
      worldZ: 900,
    });

    expect(preview).not.toBeNull();
    expect(dropped).not.toBeNull();
    expect(preview!.wallId).toBe("wall_right");
    expect(preview!.rotationYDeg).toBe(270);
    expect(preview!.snappedX).toBe(dropped!.moduleInstance.position.x);
    expect(preview!.snappedZ).toBe(dropped!.moduleInstance.position.z);
    expect(preview!.snappedX).toBeGreaterThan(2500);
  });
});
