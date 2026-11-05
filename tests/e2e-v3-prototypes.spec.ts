import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("BİRİM CONFIGURATOR V3.0 — 3-Prototype Verification & UX Audit Suite", () => {
  const outDir = path.resolve("test-results/v3");

  test.beforeAll(async () => {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
  });

  test("0. V2 Baseline Audit & Preservation Check (/)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("text=BİRİM CONFIGURATOR V2")).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "v2_baseline_desktop.png") });
  });

  test("1. Prototype A: BİRİM STUDIO (/v3/studio) — Full 8-Step Flow + Desktop & Tablet", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/v3/studio", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());

    await expect(page.getByTestId("v3-studio-root")).toBeVisible();
    await expect(page.getByTestId("v3-three-canvas")).toBeVisible();

    // Initial screenshot
    await page.screenshot({ path: path.join(outDir, "studio_01_desktop_initial.png") });

    // Step 1: Load ready wardrobe template
    const t0Template = await page.evaluate(() => performance.now());
    await page.getByTestId("studio-tpl-tpl_wardrobe_3door_drawers").click();
    const dtTemplate = await page.evaluate((t0) => performance.now() - t0, t0Template);
    console.log(`[STUDIO] Template Load Latency: ${dtTemplate.toFixed(2)} ms`);

    // Step 2: Select module
    await page.getByTestId("studio-mod-pill-0").click();

    // Step 3: Change Width (1800 -> 2000 mm)
    const t0Width = await page.evaluate(() => performance.now());
    await page.getByTestId("studio-width-preset-2000").click();
    await expect(page.getByTestId("studio-footer-dimensions")).toContainText("2000 × 2200 × 600 mm");
    const dtWidth = await page.evaluate((t0) => performance.now() - t0, t0Width);
    console.log(`[STUDIO] Width Change Latency: ${dtWidth.toFixed(2)} ms`);

    // Step 4: Add Shelf
    await page.getByTestId("studio-add-shelf-btn").click();
    await expect(page.getByTestId("studio-add-shelf-btn")).toContainText("+ Raf (5)");

    // Step 5: Change Material (Switch to Surfaces tab & pick Walnut)
    await page.getByTestId("studio-tab-materials").click();
    await page.getByTestId("studio-door-mat-mat_veneer_walnut").click();
    await page.screenshot({ path: path.join(outDir, "studio_02_customized_3d.png") });

    // Step 6: Switch between 2D and 3D views
    await page.getByTestId("studio-view-2d").click();
    await expect(page.getByTestId("v3-cad-elevation")).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "studio_03_2d_elevation.png") });
    await page.getByTestId("studio-view-3d").click();
    await expect(page.getByTestId("v3-three-canvas")).toBeVisible();

    // Step 7 & 8: Save design, reset/change, and reopen
    await page.getByTestId("studio-open-projects-btn").click();
    await expect(page.getByTestId("v3-project-modal")).toBeVisible();
    await page.getByTestId("v3-save-input").fill("Studio Test Kayıt 2000");
    await page.getByTestId("v3-save-confirm-btn").click();
    await expect(page.getByTestId("v3-saved-item-0")).toContainText("Studio Test Kayıt 2000");
    await page.getByTestId("v3-modal-close").click();

    // Change width temporarily to 1200, then reload saved 2000mm design
    await page.getByTestId("studio-width-preset-1200").click();
    await expect(page.getByTestId("studio-footer-dimensions")).toContainText("1200 × 2200 × 600 mm");

    await page.getByTestId("studio-open-projects-btn").click();
    await page.getByTestId("v3-load-btn-0").click();
    await expect(page.getByTestId("studio-footer-dimensions")).toContainText("2000 × 2200 × 600 mm");

    // Tablet Ergonomics Check (1024 x 768)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.getByTestId("studio-toggle-left").click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(outDir, "studio_04_tablet_ergonomics.png") });
  });

  test("2. Prototype B: BİRİM PLAN (/v3/plan) — Full 8-Step Flow + Desktop & Tablet", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/v3/plan", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());

    await expect(page.getByTestId("v3-plan-root")).toBeVisible();
    await expect(page.getByTestId("v3-cad-plan-interactive")).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "plan_01_desktop_split.png") });

    // Step 1: Load Linear Kitchen Layout Preset
    await page.getByTestId("plan-preset-linear-kitchen").click();
    await expect(page.getByTestId("plan-project-title")).toContainText("Doğrusal Modern Mutfak");
    await page.screenshot({ path: path.join(outDir, "plan_02_kitchen_layout.png") });

    // Step 2: Select Module 2 in 2D Plan
    const t0Select = await page.evaluate(() => performance.now());
    await page.getByTestId("plan-mod-tab-1").click();
    const dtSelect = await page.evaluate((t0) => performance.now() - t0, t0Select);
    console.log(`[PLAN] Module Select Latency: ${dtSelect.toFixed(2)} ms`);

    // Step 3: Change Width to 1200 mm
    const t0Width = await page.evaluate(() => performance.now());
    await page.getByTestId("plan-width-preset-1200").click();
    await expect(page.getByTestId("plan-width-input")).toHaveValue("1200");
    const dtWidth = await page.evaluate((t0) => performance.now() - t0, t0Width);
    console.log(`[PLAN] Width Change Latency: ${dtWidth.toFixed(2)} ms`);

    // Step 4: Add Shelf
    await page.getByTestId("plan-add-shelf-btn").click();
    await expect(page.getByTestId("plan-add-shelf-btn")).toContainText("+ Raf (1)");

    // Step 5: Change Material
    await page.getByTestId("plan-mat-mat_melamine_anthracite").click();

    // Step 6: Switch between 2D Plan Only / 3D Only / Split View
    await page.getByTestId("plan-mode-2d").click();
    await page.screenshot({ path: path.join(outDir, "plan_03_fullscreen_2d_cad.png") });
    await page.getByTestId("plan-mode-3d").click();
    await expect(page.getByTestId("v3-three-canvas")).toBeVisible();
    await page.getByTestId("plan-mode-split").click();

    // Step 7 & 8: Save & Reload
    await page.getByTestId("plan-open-projects-btn").click();
    await page.getByTestId("v3-save-input").fill("Mutfak Plan Kayıt");
    await page.getByTestId("v3-save-confirm-btn").click();
    await page.getByTestId("v3-modal-close").click();

    await page.getByTestId("plan-width-preset-800").click();
    await expect(page.getByTestId("plan-width-input")).toHaveValue("800");

    await page.getByTestId("plan-open-projects-btn").click();
    await page.getByTestId("v3-load-btn-0").click();
    await page.getByTestId("plan-mod-tab-1").click();
    await expect(page.getByTestId("plan-width-input")).toHaveValue("1200");

    // Tablet Ergonomics Check (1024 x 768)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.screenshot({ path: path.join(outDir, "plan_04_tablet_ergonomics.png") });
  });

  test("3. Prototype C: BİRİM SHOWROOM (/v3/showroom) — Full 8-Step Flow + Desktop & Tablet", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/v3/showroom", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());

    await expect(page.getByTestId("v3-showroom-root")).toBeVisible();
    await expect(page.getByTestId("v3-three-canvas")).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "showroom_01_desktop_initial.png") });

    // Step 1: Load Ready Wardrobe Collection from Floating Drawer
    await page.getByTestId("showroom-open-templates").click();
    await expect(page.getByTestId("showroom-drawer-templates")).toBeVisible();
    await page.getByTestId("showroom-tpl-tpl_wardrobe_3door_drawers").click();

    // Step 2, 3, 4: Open Customize Drawer -> Select Module, Change Width to 2400, Add Shelf
    await page.getByTestId("showroom-open-customize").click();
    await expect(page.getByTestId("showroom-drawer-customize")).toBeVisible();
    const t0Width = await page.evaluate(() => performance.now());
    await page.getByTestId("showroom-width-preset-2400").click();
    const dtWidth = await page.evaluate((t0) => performance.now() - t0, t0Width);
    console.log(`[SHOWROOM] Width Change Latency: ${dtWidth.toFixed(2)} ms`);
    await page.getByTestId("showroom-add-shelf-btn").click();
    await page.getByTestId("showroom-open-customize").click(); // close drawer

    // Step 5: Change Material from Floating Bottom Swatch Carousel & Open Doors
    await page.getByTestId("showroom-mat-mat_veneer_walnut").click();
    await page.getByTestId("showroom-door-toggle").click();
    await page.getByTestId("showroom-cam-front").click();
    await page.screenshot({ path: path.join(outDir, "showroom_02_doors_open_walnut.png") });

    // Step 6: Switch between 2D Elevation & 3D Presentation + Zen Mode
    await page.getByTestId("showroom-toggle-2d").click();
    await expect(page.getByTestId("v3-cad-elevation")).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "showroom_03_2d_overlay.png") });
    await page.getByTestId("showroom-toggle-2d").click();

    await page.getByTestId("showroom-zen-toggle").click();
    await page.screenshot({ path: path.join(outDir, "showroom_04_zen_presentation.png") });
    await page.getByTestId("showroom-exit-zen").click();

    // Step 7 & 8: Save & Reload
    await page.getByTestId("showroom-open-projects-btn").click();
    await page.getByTestId("v3-save-input").fill("Showroom Sunum 2400");
    await page.getByTestId("v3-save-confirm-btn").click();
    await page.getByTestId("v3-modal-close").click();

    // Change width to 1600, then reload 2400
    await page.getByTestId("showroom-open-customize").click();
    await page.getByTestId("showroom-width-preset-1600").click();
    await page.getByTestId("showroom-open-customize").click();
    await expect(page.getByTestId("showroom-open-customize")).toContainText("1600mm");

    await page.getByTestId("showroom-open-projects-btn").click();
    await page.getByTestId("v3-load-btn-0").click();
    await expect(page.getByTestId("showroom-open-customize")).toContainText("2400mm");

    // Tablet Ergonomics Check (1024 x 768)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(outDir, "showroom_05_tablet_ergonomics.png") });
  });
});
