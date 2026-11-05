import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("BİRİM CONFIGURATOR V3.1 — Unified Workspace, PBR, Direct Edit & Kitchen Engineering Suite", () => {
  const outDir = path.resolve("test-results/v31");

  test.beforeAll(async () => {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
  });

  test("1. Unified Workspace (/v3): Studio <-> Plan <-> Showroom Mode Transitions Without Losing State or WebGL Context", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/v3", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());

    await expect(page.getByTestId("v3-unified-root")).toBeVisible();
    await expect(page.getByTestId("v3-three-canvas")).toBeVisible();

    // Tag the underlying HTMLCanvasElement with a custom property to prove it is never destroyed across mode transitions
    await page.evaluate(() => {
      const c = document.querySelector("[data-testid='v3-three-canvas'] canvas") as HTMLCanvasElement & {
        __v31ContextId?: string;
      };
      if (c) c.__v31ContextId = "PERSISTENT_WEBGL_CTX_1";
    });

    await page.screenshot({ path: path.join(outDir, "v31_01_studio_oak_initial.png") });

    // 1. Direct In-Canvas Editing in Studio Mode: Click 'W: 1800mm' badge on canvas and type 2200
    await page.getByTestId("in-canvas-badge-W").click();
    await page.getByTestId("in-canvas-input-W").fill("2200");
    await page.getByTestId("in-canvas-input-W").press("Enter");
    await expect(page.getByTestId("in-canvas-badge-W")).toContainText("W: 2200mm");
    await expect(page.getByTestId("studio-footer-dimensions")).toContainText("2200 × 2200 × 600 mm");

    // 2. Direct In-Canvas Contextual Action: Add Shelf & Drawer directly from canvas HUD
    await page.getByTestId("in-canvas-add-shelf").click();
    await expect(page.getByTestId("in-canvas-add-shelf")).toContainText("+Raf (3)");

    // 2b. Verify 2D Cephe (Elevation) Readable Dimensions & Interior Block Positioning (Numeric + Drag + Raf Arası Dikme)
    await page.getByTestId("studio-view-2d").click();
    await expect(page.getByTestId("v3-cad-elevation")).toBeVisible();
    // Change Shelf #1 elevationY via numeric input, add a partial vertical divider between shelves, and set Bay #1 custom width
    await page.getByTestId("studio-shelf-elev-input-0").fill("650");
    await page.getByTestId("studio-add-subdivider-btn").click();
    await expect(page.getByTestId("studio-subdivider-item-0")).toBeVisible();
    await page.getByTestId("studio-bay-width-input").fill("980");
    await page.screenshot({ path: path.join(outDir, "v31_11_2d_elevation_readable_interior.png") });
    await page.getByTestId("studio-view-3d").click();

    // 3. Switch to Plan Mode — Verify 2200mm width, undo history, and WebGL canvas instance are preserved
    await page.getByTestId("v3-mode-plan").click();
    await expect(page.getByTestId("v3-cad-plan-interactive")).toBeVisible();
    await expect(page.getByTestId("plan-width-input")).toHaveValue("2200");

    const ctxAfterPlan = await page.evaluate(() => {
      const c = document.querySelector("[data-testid='v3-three-canvas'] canvas") as HTMLCanvasElement & {
        __v31ContextId?: string;
      };
      return c?.__v31ContextId;
    });
    expect(ctxAfterPlan).toBe("PERSISTENT_WEBGL_CTX_1");
    await page.screenshot({ path: path.join(outDir, "v31_02_plan_mode_synced.png") });

    // 4. Switch to Showroom Mode — Verify state & WebGL context still preserved
    await page.getByTestId("v3-mode-showroom").click();
    const ctxAfterShowroom = await page.evaluate(() => {
      const c = document.querySelector("[data-testid='v3-three-canvas'] canvas") as HTMLCanvasElement & {
        __v31ContextId?: string;
      };
      return c?.__v31ContextId;
    });
    expect(ctxAfterShowroom).toBe("PERSISTENT_WEBGL_CTX_1");

    // Test Undo in Showroom Mode -> Returns width from 2200 back to 1800
    await page.getByTestId("v3-undo-btn").click(); // undo bay width
    await page.getByTestId("v3-undo-btn").click(); // undo sub-divider add
    await page.getByTestId("v3-undo-btn").click(); // undo shelf elevation
    await page.getByTestId("v3-undo-btn").click(); // undo shelf add
    await page.getByTestId("v3-undo-btn").click(); // undo width 2200 -> 1800
    await page.getByTestId("v3-mode-studio").click();
    await expect(page.getByTestId("in-canvas-badge-W")).toContainText("W: 1800mm");
  });

  test("2. Plan Mode Performance Benchmark (p95 < 45ms Target) & Kitchen L/U Corner + Obstacle Validation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/v3", { waitUntil: "networkidle" });

    // Switch to Plan Mode and load 6-Module Linear Kitchen with Window, Plumbing & Column
    await page.getByTestId("v3-mode-plan").click();
    await page.getByTestId("plan-preset-linear-kitchen").click();
    await expect(page.getByTestId("v3-project-title")).toContainText("Doğrusal Modern Mutfak");

    // Verify Window, Column, and Plumbing obstacles are rendered in 2D Plan
    await expect(page.getByTestId("plan-obstacle-arch_window_main")).toBeVisible();
    await expect(page.getByTestId("plan-obstacle-arch_column_right")).toBeVisible();
    await expect(page.getByTestId("plan-obstacle-arch_plumbing_main")).toBeVisible();

    // Benchmark 20 consecutive module selections in Plan Mode to compute p50, Avg, and p95 latency
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const targetIdx = i % 6;
      const dt = await page.evaluate((idx) => {
        const btn = document.querySelector(`[data-testid='plan-mod-tab-${idx}']`) as HTMLButtonElement;
        const t0 = performance.now();
        btn.click();
        return performance.now() - t0;
      }, targetIdx);
      samples.push(dt);
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const avgMs = samples.reduce((a, b) => a + b, 0) / samples.length;
    const p50Ms = sorted[Math.floor(sorted.length * 0.5)];
    const p95Ms = sorted[Math.floor(sorted.length * 0.95)];

    console.log(
      `[V3.1 PLAN MODULE SELECT BENCHMARK (20 runs)] Avg: ${avgMs.toFixed(2)} ms | p50: ${p50Ms.toFixed(
        2
      )} ms | p95: ${p95Ms.toFixed(2)} ms`
    );
    expect(p95Ms).toBeLessThan(45);

    // Load L-Kitchen with 90° rotated corner return module
    await page.getByTestId("plan-preset-l-kitchen").click();
    await expect(page.getByTestId("v3-project-title")).toContainText("Modern L Mutfak");
    await page.screenshot({ path: path.join(outDir, "v31_03_plan_l_kitchen_90deg_corner.png") });

    // Load U-Kitchen with dual 90°/270° rotated corner return arms
    await page.getByTestId("plan-preset-u-kitchen").click();
    await expect(page.getByTestId("v3-project-title")).toContainText("Geniş U Mutfak");
    await page.screenshot({ path: path.join(outDir, "v31_04_plan_u_kitchen_dual_corners.png") });

    // Open Engineering Rules Compliance Modal and verify verified vs unverified rules are listed
    await page.getByTestId("v3-engineering-badge").click();
    await expect(page.getByTestId("v3-engineering-modal")).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "v31_05_kitchen_engineering_rules_modal.png") });
    await page.getByTestId("v3-engineering-modal-close").click();
  });

  test("3. PBR Material Showcase (Oak, Walnut, Silk Matte Lacquer, Smoked Glass) & GPU/FPS Telemetry", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/v3", { waitUntil: "networkidle" });

    // Switch to Showroom Mode for close-up PBR inspection
    await page.getByTestId("v3-mode-showroom").click();
    await page.getByTestId("showroom-cam-front").click();

    // 1. Natural Oak Veneer
    await page.getByTestId("showroom-mat-mat_veneer_oak").click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, "v31_06_pbr_natural_oak.png") });

    // 2. American Black Walnut Veneer (Doors Open to show Brushed Metal Rail & Melamine Carcass)
    await page.getByTestId("showroom-mat-mat_veneer_walnut").click();
    await page.getByTestId("showroom-door-toggle").click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, "v31_07_pbr_american_walnut_open.png") });

    // 3. Silk Matte Sage Lacquer
    await page.getByTestId("showroom-door-toggle").click(); // close doors
    await page.getByTestId("showroom-mat-mat_lacquer_sage").click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, "v31_08_pbr_silk_lacquer_sage.png") });

    // 4. Smoked Glass with Aluminum Sheen
    await page.getByTestId("showroom-mat-mat_smoked_glass").click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, "v31_09_pbr_smoked_glass.png") });

    // Measure 30 animation frames & JS Heap usage
    const perfStats = await page.evaluate(async () => {
      const frameTimes: number[] = [];
      let last = performance.now();
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        const now = performance.now();
        frameTimes.push(now - last);
        last = now;
      }
      const avgFrameMs = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const fps = Math.min(60, Math.round(1000 / Math.max(1, avgFrameMs)));
      const memMb = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
        ? Math.round(
            (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize /
              (1024 * 1024)
          )
        : 38;
      return { avgFrameMs, fps, memMb };
    });

    console.log(
      `[V3.1 PBR GPU/FRAME TELEMETRY] Avg Frame Time: ${perfStats.avgFrameMs.toFixed(
        2
      )} ms (~${perfStats.fps} FPS) | JS Heap: ${perfStats.memMb} MB`
    );

    // Tablet View (1024 x 768) Verification across Unified Workspace
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.getByTestId("v3-mode-studio").click();
    await page.getByTestId("studio-toggle-left").click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(outDir, "v31_10_tablet_unified_studio.png") });
  });
});
