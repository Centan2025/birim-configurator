import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("BİRİM CONFIGURATOR V4 — Universal Module & Hardware Library E2E Suite", () => {
  const outDir = path.resolve("test-results/v4");

  test.beforeAll(async () => {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
  });

  test("1. V4 6-Family / 92-Template Browser, Smart Wall Builder & Wardrobe Interior Wizards", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/v3", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());

    await expect(page.getByTestId("v3-unified-root")).toBeVisible();
    await expect(page.getByTestId("v4-compatibility-card")).toContainText("UNVERIFIED");
    await expect(page.getByTestId("v4-four-space-summary")).toBeVisible();

    // Browse V4 Kitchen Base Family (20 templates) and apply 3-Drawer Base Module
    await page.getByTestId("v4-family-selector").selectOption("fam_kitchen_base");
    await expect(page.getByTestId("v4-apply-tpl-tpl_kb_05_three_drawers")).toBeVisible();
    await page.getByTestId("v4-apply-tpl-tpl_kb_05_three_drawers").click();
    await expect(page.getByTestId("studio-footer-dimensions")).toContainText("800 × 720 × 580 mm");
    await page.screenshot({ path: path.join(outDir, "v4_01_kitchen_3drawer_legrabox.png") });

    // Generate automatic Kitchen Complementary modules (Worktop, Backsplash, End Panels, Plinth)
    await page.getByTestId("v4-auto-complementary-btn").click();
    await page.screenshot({ path: path.join(outDir, "v4_02_kitchen_auto_complementary.png") });

    // Use V4 Smart Wall Layout Builder (3.6m -> 4 Symmetric Carcasses = 4x900mm)
    await page.getByTestId("v4-smart-wall-4carcass").click();
    await expect(page.getByTestId("studio-footer-dimensions")).toContainText("900 × 720 × 580 mm");

    // Apply Wardrobe Interior Wizard (Lüks Giyinme Odası)
    await page.getByTestId("v4-wizard-wiz_walkin_luxury").click();
    await page.screenshot({ path: path.join(outDir, "v4_03_smart_wall_4carcass_wizard.png") });
  });

  test("2. V4 4-Step Door, Overlay, Handle, Opening & Manufacturer Hardware SKU Selector + Live Compatibility Gate", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/v3", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());

    const initialPrice = await page.getByTestId("studio-total-price").textContent();

    // Step 1: Switch Overlay to Inset (İçerde Kapak)
    await page.getByTestId("v4-overlay-inset").click();
    await expect(page.getByTestId("v4-four-space-summary")).toContainText("560 mm");

    // Step 2 & 3: Select Handleless Plain with Manual Standard -> Expect INCOMPATIBLE error + suggestion
    await page.getByTestId("v4-handle-select").selectOption("handleless_plain");
    await page.getByTestId("v4-opening-select").selectOption("manual_standard");
    await expect(page.getByTestId("v4-compatibility-card")).toContainText("INCOMPATIBLE");
    await expect(page.getByTestId("v4-compatibility-card")).toContainText("Bloklu");
    await page.screenshot({ path: path.join(outDir, "v4_04_incompatible_handleless_blocked.png") });

    // Fix by selecting Push-to-Open + Soft-Close (TIP-ON BLUMOTION)
    await page.getByTestId("v4-opening-select").selectOption("push_to_open_soft_close");
    await expect(page.getByTestId("v4-compatibility-card")).toContainText("UNVERIFIED");
    await expect(page.getByTestId("v4-compatibility-card")).toContainText("Bloklu");

    // Step 4: Swap Hardware Manufacturer Profile from Blum 71B3550 to Blum 155° Zero-Protrusion (hw_blum_71b7550)
    await page.getByTestId("v4-hardware-sku-select").selectOption("hw_blum_71b7550");
    const updatedPrice = await page.getByTestId("studio-total-price").textContent();
    expect(updatedPrice).not.toBe(initialPrice);

    // Open V4 Library Admin Governance Modal
    await page.getByTestId("v4-library-admin-btn").click();
    await expect(page.getByTestId("v4-library-admin-modal")).toBeVisible();
    await expect(page.getByTestId("v4-library-admin-modal")).toContainText("92 Şablon (6 Aile)");
    await page.screenshot({ path: path.join(outDir, "v4_05_library_admin_governance.png") });
    await page.getByTestId("v4-library-admin-close").click();
  });
});
