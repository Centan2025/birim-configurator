import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("BİRİM CONFIGURATOR V2.5 E2E Real Browser Test Suite", () => {
  test.beforeAll(async () => {
    const dir = path.resolve("test-results");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  test("1. Application Loads Successfully & Displays Default Wardrobe in 3D WebGL", async ({ page }) => {
    await page.goto("http://localhost:3300", { waitUntil: "networkidle" });

    // Verify Title & Brand
    await expect(page.locator("text=BİRİM CONFIGURATOR V2")).toBeVisible();
    await expect(page.locator("text=Gövde Ölçüleri (mm)")).toBeVisible();

    // Verify 3D Canvas
    const canvasContainer = page.locator("canvas");
    await expect(canvasContainer).toBeVisible({ timeout: 10000 });

    // Capture screenshot
    await page.screenshot({ path: "test-results/01_default_wardrobe_3d.png", fullPage: true });
  });

  test("2. View Switching: 3D -> 2D Ön Görünüş -> 2D Üst Plan -> 2D Kesit", async ({ page }) => {
    await page.goto("http://localhost:3300", { waitUntil: "networkidle" });

    // Switch to 2D Ön Görünüş (Elevation)
    await page.click("button:has-text('2D Ön Görünüş')");
    await expect(page.locator("text=Ön Görünüş (2D CAD)")).toBeVisible();
    await page.screenshot({ path: "test-results/02_view_2d_elevation.png" });

    // Switch to 2D Üst Plan (Top Plan)
    await page.click("button:has-text('2D Üst Plan')");
    await expect(page.locator("text=Üstten Plan (2D Top Plan)")).toBeVisible();
    await page.screenshot({ path: "test-results/03_view_2d_top_plan.png" });

    // Switch to 2D Kesit (Cross Section)
    await page.click("button:has-text('2D Kesit')");
    await expect(page.locator("text=Düşey Kesit Çizimi")).toBeVisible();
    await page.screenshot({ path: "test-results/04_view_2d_cross_section.png" });

    // Return to 3D
    await page.click("button:has-text('3D WebGL')");
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("3. Parametric Dimension Changes (Numeric mm Input & Sliders)", async ({ page }) => {
    await page.goto("http://localhost:3300", { waitUntil: "networkidle" });

    // Target the first numeric input (Width)
    const inputs = page.locator("input[type='number']");
    const widthInput = inputs.nth(0);
    const heightInput = inputs.nth(1);
    const depthInput = inputs.nth(2);

    // Initial check
    await expect(widthInput).toHaveValue("1800");

    // Change Width to 2400 mm
    await widthInput.fill("2400");
    await widthInput.blur();
    await page.waitForTimeout(300);

    // Change Height to 2400 mm
    await heightInput.fill("2400");
    await heightInput.blur();
    await page.waitForTimeout(300);

    // Change Depth to 650 mm
    await depthInput.fill("650");
    await depthInput.blur();
    await page.waitForTimeout(300);

    // Verify price updated
    const priceText = await page.locator("footer .text-lg.font-black.text-amber-400").innerText();
    expect(priceText).toContain("€");

    await page.screenshot({ path: "test-results/05_custom_dimensions_2400x2400x650.png" });
  });

  test("4. Add Compartment Bays, Shelves, Drawers and Hanging Rails", async ({ page }) => {
    await page.goto("http://localhost:3300", { waitUntil: "networkidle" });

    // Change to 3 bays
    await page.click("button:text-is('3')");
    await expect(page.locator("text=Bölme 3")).toBeVisible();

    // In Bay 1, add a shelf
    const addShelfBtns = page.locator("button:has-text('+ Raf')");
    if (await addShelfBtns.count() > 0) {
      await addShelfBtns.nth(0).click();
      await page.waitForTimeout(200);
    }

    // In Bay 2, add a drawer
    const addDrawerBtns = page.locator("button:has-text('+ Çekmece')");
    if (await addDrawerBtns.count() > 1) {
      await addDrawerBtns.nth(1).click();
      await page.waitForTimeout(200);
    }

    // In Bay 3, add a hanging rail
    const addRailBtns = page.locator("button:has-text('+ Askılık')");
    if (await addRailBtns.count() > 2) {
      await addRailBtns.nth(2).click();
      await page.waitForTimeout(200);
    }

    await page.screenshot({ path: "test-results/06_bay_customizations.png" });
  });

  test("5. Multi-Module Management: Add Module, Duplicate & Move", async ({ page }) => {
    await page.goto("http://localhost:3300", { waitUntil: "networkidle" });

    // Add adjacent module
    await page.click("button:has-text('Kabin Ekle')");
    await expect(page.locator("text=Aktif Kabin:")).toBeVisible();
    await expect(page.locator("button:text-is('Kabin 2')")).toBeVisible();

    // Duplicate active module
    await page.click("button:has-text('Çoğalt')");
    await expect(page.locator("button:text-is('Kabin 2 (Kopya)')")).toBeVisible();

    // Move module with right arrow
    const rightArrow = page.locator("button[title*='Sağa Kaydır']");
    if (await rightArrow.count() > 0) {
      await rightArrow.click();
      await page.waitForTimeout(200);
    }

    await page.screenshot({ path: "test-results/07_multi_modules.png" });
  });

  test("6. Production BOM Modal, Cut List & Nesting Visualization", async ({ page }) => {
    await page.goto("http://localhost:3300", { waitUntil: "networkidle" });

    // Open BOM Modal
    await page.click("button:has-text('BOM & Üretim Portalı')");
    await expect(page.locator("text=BOM & İmalat Mühendisliği Portalı")).toBeVisible();
    await expect(page.locator("text=Net Kesim & Delik Tablosu")).toBeVisible();

    // Verify tabs inside BOM modal
    await page.click("button:has-text('Gerçek 2D Plaka Optimizasyonu')");
    await expect(page.locator("text=Plaka #").first()).toBeVisible();
    await page.screenshot({ path: "test-results/08_bom_nesting_layout.png" });

    await page.click("button:has-text('Selco WNT 600 Postprocessor')");
    await expect(page.locator("text=Biesse Selco WNT 600 Postprocessor (Teknik Uyarı)")).toBeVisible();
    await page.screenshot({ path: "test-results/09_bom_selco_cnc.png" });

    // Close Modal
    await page.click("button[title='Kapat']");
  });

  test("7. Project Save, List, and Reload via LocalStorage", async ({ page }) => {
    await page.goto("http://localhost:3300", { waitUntil: "networkidle" });

    // Open Save/Load Modal
    await page.click("button:has-text('Projeler / Kayıtlar')");
    await expect(page.locator("text=Proje Yönetimi & Kayıtlar")).toBeVisible();

    // Fill project name & save
    const nameInput = page.locator("input[placeholder*='Salon Dolabı']");
    await nameInput.fill("E2E Test Projesi 2026");
    await page.click("button:text-is('Kaydet')");

    // Verify success banner & item in list
    await expect(page.locator("text=Proje başarıyla kaydedildi")).toBeVisible();
    await expect(page.locator("text=E2E Test Projesi 2026")).toBeVisible();

    // Close modal
    await page.click("button:text-is('Kapat')");

    // Modify width to 3000 mm
    const widthInput = page.locator("input[type='number']").nth(0);
    await widthInput.fill("3000");
    await widthInput.blur();
    await page.waitForTimeout(300);

    // Reopen modal and load the saved project
    await page.click("button:has-text('Projeler / Kayıtlar')");
    const loadButtons = page.locator("button:text-is('Yükle')");
    await loadButtons.first().click();
    await page.waitForTimeout(600);

    // Verify width was restored to 1800
    await expect(widthInput).toHaveValue("1800");
    await page.screenshot({ path: "test-results/10_project_saved_reloaded.png" });
  });

  test("8. Kitchen Layout Scenarios: Linear Kitchen, L-Kitchen, and U-Kitchen", async ({ page }) => {
    await page.goto("http://localhost:3300", { waitUntil: "networkidle" });

    // Load Linear Kitchen
    await page.click("button:has-text('Doğrusal Mutfak Yerleşimi (3.2m)')");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/11_kitchen_linear.png" });

    // Load L-Kitchen
    await page.click("button:has-text('L Tipi Mutfak (2.4m x 2.4m)')");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/12_kitchen_L_shape.png" });

    // Load U-Kitchen
    await page.click("button:has-text('U Tipi Mutfak (2.4m x 3.0m x 2.4m)')");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/13_kitchen_U_shape.png" });
  });
});
