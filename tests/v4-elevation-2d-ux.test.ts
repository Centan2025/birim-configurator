import { describe, it, expect } from "vitest";
import { createInitialProject } from "../packages/core/src/defaults";
import { generateModuleGeometry } from "../packages/geometry/src/mesh-generator";
import { generateElevation2D } from "../packages/geometry/src/projection2d";
import {
  formatElevationValue,
  toCanonicalMm,
  toDisplayUnitNumber,
  truncateCadLabel,
  resolveElevationLabelVisibility,
  resolveSelectedElevationContext,
} from "../apps/configurator/src/v3/components/workspace/elevation2dHelpers";

describe("2D Cephe (Elevation) UX/UI Helpers & 3-Seviyeli Görünüm", () => {
  it("1. 3 seviyeli görünüm (clean / selected / technical) etiket ve tutamaç görünürlüğünü doğru yönetir", () => {
    const cleanPassive = resolveElevationLabelVisibility("clean", {
      isActiveModule: true,
      isSelected: false,
      isHovered: false,
      isDragging: false,
      hasInteriorSelection: false,
    });
    expect(cleanPassive.showDimensionLines).toBe(false);
    expect(cleanPassive.showResizeHandles).toBe(false);
    expect(cleanPassive.showInteriorItemLabel).toBe(false);
    expect(cleanPassive.showHardwareLabel).toBe(false);

    const selectedPassiveNeighbor = resolveElevationLabelVisibility("selected", {
      isActiveModule: false,
      isSelected: false,
      isHovered: false,
      isDragging: false,
      hasInteriorSelection: false,
    });
    expect(selectedPassiveNeighbor.showNeighborHeader).toBe(false);
    expect(selectedPassiveNeighbor.showInteriorItemLabel).toBe(false);
    expect(selectedPassiveNeighbor.showDimensionLines).toBe(false);

    const selectedActiveShelf = resolveElevationLabelVisibility("selected", {
      isActiveModule: true,
      isSelected: true,
      isHovered: false,
      isDragging: false,
      hasInteriorSelection: true,
    });
    expect(selectedActiveShelf.showInteriorItemLabel).toBe(true);
    expect(selectedActiveShelf.showResizeHandles).toBe(false);

    const technicalAll = resolveElevationLabelVisibility("technical", {
      isActiveModule: false,
      isSelected: false,
      isHovered: false,
      isDragging: false,
      hasInteriorSelection: true,
    });
    expect(technicalAll.showNeighborHeader).toBe(true);
    expect(technicalAll.showInteriorItemLabel).toBe(true);
    expect(technicalAll.showHardwareLabel).toBe(true);
    expect(technicalAll.showDimensionLines).toBe(true);
  });

  it("2. Ölçü birimi dönüşümleri (mm / cm) kanonik model verisini bozmadan tutarlı çalışır", () => {
    expect(formatElevationValue(1800, "mm")).toBe("1800 mm");
    expect(formatElevationValue(1800, "cm")).toBe("180 cm");
    expect(formatElevationValue(635, "cm")).toBe("63.5 cm");
    expect(toDisplayUnitNumber(635, "cm")).toBe(63.5);
    expect(toCanonicalMm(63.5, "cm")).toBe(635);
    expect(toCanonicalMm(1800, "mm")).toBe(1800);
  });

  it("3. Dar bölmeler için etiket kısaltma (truncateCadLabel) taşmayı önler", () => {
    const narrow = truncateCadLabel("↕ Çekmece (H:180 • Y:450mm)", 150, 13);
    expect(narrow.endsWith("…")).toBe(true);
    expect(narrow.length).toBeLessThan(20);
  });

  it("4. Seçili modül, raf, çekmece, askı ve Blum menteşe bağlamsal bilgisini doğru çözer", () => {
    const project = createInitialProject();
    const mod = project.modules[0];
    mod.bays[0].shelves = [{ id: "sh_test_1", elevationY: 640, thickness: 18 }];
    mod.bays[0].drawers = [
      { id: "dr_test_1", bayIndex: 0, elevationY: 120, height: 180, slideType: "blum_tandembox" },
    ];
    mod.bays[0].hangingRails = [{ id: "hr_test_1", elevationY: 1650 }];

    const breakdown = generateModuleGeometry(mod, { doorOpenAngleDeg: 0 });
    const elev = generateElevation2D(breakdown);

    const modCtx = resolveSelectedElevationContext(mod, 0, null, elev.elements);
    expect(modCtx?.kind).toBe("module");
    expect(modCtx?.widthMm).toBe(mod.dimensions.width);

    const shelfCtx = resolveSelectedElevationContext(mod, 0, "sh_test_1", elev.elements);
    expect(shelfCtx?.kind).toBe("shelf");
    expect(shelfCtx?.elevationYMm).toBe(640);
    expect(shelfCtx?.canDelete).toBe(true);

    const drawerCtx = resolveSelectedElevationContext(mod, 0, "dr_test_1", elev.elements);
    expect(drawerCtx?.kind).toBe("drawer");
    expect(drawerCtx?.heightMm).toBe(180);
    expect(drawerCtx?.elevationYMm).toBe(120);

    const railCtx = resolveSelectedElevationContext(mod, 0, "hr_test_1", elev.elements);
    expect(railCtx?.kind).toBe("rail");
    expect(railCtx?.elevationYMm).toBe(1650);

    const hingeEl = elev.elements.find((el) => el.role === "door_hinge");
    if (hingeEl) {
      const hingeCtx = resolveSelectedElevationContext(mod, 0, hingeEl.id, elev.elements);
      expect(hingeCtx?.kind).toBe("hinge");
      expect(hingeCtx?.canDelete).toBe(false);
    }
  });
});
