import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("BİRİM CONFIGURATOR — Radical Simplicity & Professional Power UX Suite", () => {
  test.beforeAll(async () => {
    const dir = path.resolve("test-results");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3300", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    const resetBtn = page.locator("button[title='Tasarımı Sıfırla']");
    await resetBtn.click();
    await expect(page.locator("text=Vadi İstanbul Villa")).toBeVisible();
    await page.waitForTimeout(100);
  });

  test("1. Default Showroom Mode: Kolay Tasarım (Mağaza) & Quick Preset Chips", async ({ page }) => {
    // Verify Brand, Title and Mode Switcher
    await expect(page.locator("text=BİRİM CONFIGURATOR V2")).toBeVisible();
    await expect(page.locator("button:has-text('Kolay Tasarım (Mağaza)')")).toBeVisible();
    await expect(page.locator("text=Kaydedilmedi")).toBeVisible();

    // Verify EasyInspector is active by default
    await expect(page.locator("text=Kolay Tasarım Paneli")).toBeVisible();
    await expect(page.locator("text=Gövde Ölçüleri (mm)")).toBeVisible();

    // Verify Width input initially 1800
    const widthInput = page.locator("input[type='number']").nth(0);
    await expect(widthInput).toHaveValue("1800");

    // Click 2000 mm preset chip
    await page.click("button:text-is('2000')");
    await page.waitForTimeout(200);
    await expect(widthInput).toHaveValue("2000");

    // Test stepper button [+]
    const plusButtons = page.locator("button:text-is('+')");
    await plusButtons.first().click();
    await page.waitForTimeout(200);
    await expect(widthInput).toHaveValue("2050");

    // Test stepper button [-]
    const minusButtons = page.locator("button:text-is('-')");
    await minusButtons.first().click();
    await page.waitForTimeout(200);
    await expect(widthInput).toHaveValue("2000");

    await page.screenshot({ path: "test-results/ux_01_kolay_tasarim_overview.png" });
  });

  test("2. Touch-Friendly Bay Selection & 1-Click Feature Additions", async ({ page }) => {
    // Select 3 Compartment Bays (Large 44px button with testid)
    await page.click("[data-testid='bay-btn-3']");
    await page.waitForTimeout(200);

    // Switch to Bay 1 tab explicitly
    const bay1Btn = page.locator("button:has-text('Bölme 1')");
    if (await bay1Btn.count() > 0) {
      await bay1Btn.first().click();
      await page.waitForTimeout(200);
    }

    // In Bay 1: 1-click add Shelf
    await page.click("[data-testid='add-shelf-btn']");
    await page.waitForTimeout(200);

    // In Bay 1: 1-click add Drawer
    await page.click("[data-testid='add-drawer-btn']");
    await page.waitForTimeout(200);

    // In Bay 1: 1-click add Hanging Rail
    await page.click("[data-testid='add-rail-btn']");
    await page.waitForTimeout(200);

    // Verify items in list
    await expect(page.locator("text=Çekmece #").first()).toBeVisible();
    await expect(page.locator("text=Askı Borusu #").first()).toBeVisible();

    await page.screenshot({ path: "test-results/ux_02_bay_one_click_actions.png" });
  });

  test("3. Mode Switch: Seamless Transition to Teknik Düzenleme (Mühendislik)", async ({ page }) => {
    // Click mode toggle button in header
    await page.click("button:has-text('Teknik Düzenleme (Mühendislik)')");
    await page.waitForTimeout(300);

    // Verify TechnicalInspector mounted
    await expect(page.locator("text=Teknik Mühendislik Paneli")).toBeVisible();
    await expect(page.locator("text=İmalat & Mühendislik Parametreleri")).toBeVisible();
    await expect(page.locator("text=Gövde Birleşim Tipi (System 32)")).toBeVisible();

    // Change Joint Type to Kabin Vidası
    await page.click("button:has-text('Kabin Vidası (7x50)')");
    await page.waitForTimeout(200);

    // Change body thickness to 25mm
    await page.click("button:has-text('25 mm')");
    await page.waitForTimeout(200);

    await page.screenshot({ path: "test-results/ux_03_teknik_duzenleme_mode.png" });
  });

  test("4. Canvas-First Workspace: Collapsible Side Docks for Maximal Design Area", async ({ page }) => {
    // Collapse left dock
    const collapseLeftBtn = page.locator("button[title='Paneli Daralt']").first();
    await collapseLeftBtn.click();
    await page.waitForTimeout(300);

    // Collapse right inspector
    const collapseRightBtn = page.locator("button[title='Paneli Daralt']").last();
    await collapseRightBtn.click();
    await page.waitForTimeout(300);

    // Canvas now occupies 95%+ of screen
    await expect(page.locator("canvas")).toBeVisible();
    await page.screenshot({ path: "test-results/ux_04_fullscreen_canvas_collapsed.png" });

    // Expand panels again
    const expandButtons = page.locator("button[title='Paneli Genişlet']");
    await expandButtons.first().click();
    await page.waitForTimeout(200);
    await expandButtons.last().click();
    await page.waitForTimeout(200);
  });

  test("5. Keyboard Shortcuts & Instant View Switching", async ({ page }) => {
    // Press '2' for 2D Elevation
    await page.keyboard.press("2");
    await page.waitForTimeout(300);
    await expect(page.locator("text=Ön Görünüş (2D CAD)")).toBeVisible();

    // Press '3' for 2D Top Plan
    await page.keyboard.press("3");
    await page.waitForTimeout(300);
    await expect(page.locator("text=Üstten Plan (2D Top Plan)")).toBeVisible();

    // Press '1' to return to 3D WebGL
    await page.keyboard.press("1");
    await page.waitForTimeout(300);
    await expect(page.locator("canvas")).toBeVisible();

    // Press 'Space' to toggle doors
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    await expect(page.locator("button:has-text('Kapakları Kapat')")).toBeVisible();

    await page.screenshot({ path: "test-results/ux_05_keyboard_shortcuts_and_doors_open.png" });
  });
});
