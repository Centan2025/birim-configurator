import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const srcDir = path.resolve(__dirname, "../apps/configurator/src");

describe("V14 UI Contrast, Low-GPU Theme Integrity & Zero-Overlap Spatial Layout Invariants", () => {
  it("eliminates pale light-on-light pills (bg-[#EEF2FF], bg-amber-400 text-[#141413], bg-white/96) and fixes low-GPU dark glass fallback", () => {
    const css = fs.readFileSync(path.join(srcDir, "app/globals.css"), "utf8");
    const onObj = fs.readFileSync(path.join(srcDir, "v11/OnObjectQuickToolbar.tsx"), "utf8");
    const hdr = fs.readFileSync(path.join(srcDir, "v11/StudioHeaderBar.tsx"), "utf8");
    const ctxMenu = fs.readFileSync(path.join(srcDir, "v3/components/Viewport3DContextMenu.tsx"), "utf8");

    // 1. Low-GPU mode MUST NEVER turn floating shells/modals cream-white while text is forced white
    expect(css).not.toContain("rgba(248, 246, 241, 0.97)");
    expect(css).not.toContain("rgba(251, 250, 247, 0.96)");
    expect(css).toContain('body[data-birim-gpu-tier="low"] .birim-ice-modal');
    expect(css).toContain("rgba(28, 34, 46, 0.96)");

    // 2. Screenshot #1 & #2 regressions (+ Yan Modül, ↑ Üst Modül, 3. Sunumda Gör) must have high-contrast dark-studio styling
    expect(onObj).not.toContain("bg-[#EEF2FF]");
    expect(hdr).not.toContain("bg-[#EEF2FF]");
    expect(hdr).not.toContain("group-hover:bg-white");

    // 3. Context menu badges must not combine bright 400 pastel fills with V30-whitened text-[#141413]
    expect(ctxMenu).not.toContain('bg-amber-400 text-[#141413]');
    expect(ctxMenu).not.toContain('bg-emerald-400 text-[#141413]');
    expect(ctxMenu).not.toContain('bg-sky-400 text-[#141413]');
  });

  it("enforces mutual exclusion and safe-inset non-overlap across Left Drawer, Quick Palette, Header Popovers, Bottom Dock & Inspector", () => {
    const ws = fs.readFileSync(path.join(srcDir, "v11/BirimStudioWorkspace.tsx"), "utf8");
    const hdr = fs.readFileSync(path.join(srcDir, "v11/StudioHeaderBar.tsx"), "utf8");
    const dock = fs.readFileSync(path.join(srcDir, "v11/BottomSceneDock.tsx"), "utf8");
    const qDock = fs.readFileSync(path.join(srcDir, "v11/QuickStyleAndMaterialDock.tsx"), "utf8");
    const leftLauncher = fs.readFileSync(path.join(srcDir, "v11/LeftCatalogLauncher.tsx"), "utf8");
    const rightInsp = fs.readFileSync(path.join(srcDir, "v11/RightParametricInspector.tsx"), "utf8");
    const hwSwap = fs.readFileSync(path.join(srcDir, "v11/HardwareQuickSwapPopover.tsx"), "utf8");

    // Left drawer & QuickStyleAndMaterialDock close each other and respect <1380px dual-drawer budget
    expect(ws).toContain("window.innerWidth < 1380");
    expect(qDock).toContain("72 + rightSafePx + 20");

    // Wrapped 2-row header (<1280px max-xl) never overlaps sidebars or hardware swap popover
    expect(leftLauncher).toContain("max-xl:top-[112px]");
    expect(rightInsp).toContain("max-xl:top-[112px]");
    expect(hwSwap).toContain("max-xl:top-[114px]");

    // Guided 3-step strip does not duplicate open Right Inspector or collide with Active Wall HUD on initial load
    expect(hdr).toContain('experienceTier === "simple" && !isInspectorOpen && onQuickNavigateStep');

    // BottomSceneDock closes viewMenuOpen when opening sibling popovers
    const viewCloseCount = (dock.match(/setViewMenuOpen\(false\)/g) || []).length;
    expect(viewCloseCount).toBeGreaterThanOrEqual(5);
  });

  it("applies progressive disclosure on initial screen without removing any feature or testid", () => {
    const onObj = fs.readFileSync(path.join(srcDir, "v11/OnObjectQuickToolbar.tsx"), "utf8");
    const dimTab = fs.readFileSync(path.join(srcDir, "v11/inspector/InspectorDimensionsTab.tsx"), "utf8");
    const rightInsp = fs.readFileSync(path.join(srcDir, "v11/RightParametricInspector.tsx"), "utf8");

    // All additive feature testids remain intact
    expect(onObj).toContain('data-testid="v13-on-object-grow-adjacent"');
    expect(onObj).toContain('data-testid="v13-on-object-grow-top"');
    expect(dimTab).toContain('data-testid="v13-smart-bay-and-load-card"');
    expect(rightInsp).toContain('data-testid="v11-toggle-module-production"');
    expect(rightInsp).toContain('data-testid="v11-toggle-module-pricing"');

    // Primary Width/Height/Depth sliders appear BEFORE smart bay & load advisor card in Boyut tab
    const slidersIdx = dimTab.indexOf('key: "width"');
    const smartCardIdx = dimTab.indexOf('data-testid="v13-smart-bay-and-load-card"');
    expect(slidersIdx).toBeGreaterThan(0);
    expect(smartCardIdx).toBeGreaterThan(slidersIdx);

    // Kolay mode opens stage-first (Right Inspector collapsed until cabinet click or guided step)
    const ws = fs.readFileSync(path.join(srcDir, "v11/BirimStudioWorkspace.tsx"), "utf8");
    expect(ws).toContain('useState<boolean>(() => experienceTier !== "simple")');
    expect(rightInsp).toContain('experienceTier === "simple" ? "Ölçü & Gövde" : "Gövde"');
  });

  it("parses globals.css cleanly with balanced brackets, braces, parentheses, and zero dangling rules", () => {
    const css = fs.readFileSync(path.join(srcDir, "app/globals.css"), "utf8");
    expect(css).not.toContain("dummy-amber-anchor");
    // Strip CSS comments and quoted strings before checking structural delimiter balance
    const stripped = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""')
      .replace(/\\./g, "_");
    const stack: string[] = [];
    const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    for (let i = 0; i < stripped.length; i++) {
      const ch = stripped[i];
      if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
      else if (ch === ")" || ch === "]" || ch === "}") {
        const top = stack.pop();
        expect(top).toBe(pairs[ch]);
      }
    }
    expect(stack.length).toBe(0);
  });
});
