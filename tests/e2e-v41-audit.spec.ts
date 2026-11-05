import { test, expect, Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const out = "test-results/v41-browser";
type Mesh = { id: string; role: string; parent?: string; category?: string; center: number[]; matrix: number[]; scale: number[]; geometry: string; materialId?: string; color?: string };
const scene = async (page: Page): Promise<Mesh[]> => JSON.parse(await page.locator("[data-testid=v3-three-canvas] canvas").getAttribute("data-scene") ?? "[]");
const handles = async (page: Page) => (await scene(page)).filter(m => m.role === "door_handle" || m.role === "drawer_handle" || m.role === "gola_profile");
test.beforeAll(() => mkdirSync(out, { recursive: true }));
test.beforeEach(async ({ page }) => {
  await page.goto("/v3?audit=1");
  await expect.poll(async () => (await scene(page)).length).toBeGreaterThan(0);
});

test("ten handle categories: actual meshes, open motion, saved design, undo and reload", async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.getByTestId("v4-family-selector").selectOption("fam_kitchen_base");
  await page.getByTestId("v4-apply-tpl-tpl_kb_02_double_door").click();
  const categories = ["knob", "bar_handle", "long_profile_handle", "edge_profile", "recessed_grip", "gola_profile", "j_pull", "milled_wood_grip", "decorative_bespoke", "handleless_plain"];
  const timings: { category: string; ms: number; meshes: number }[] = [];
  for (const category of categories) {
    const start = Date.now();
    await page.getByTestId("v4-handle-select").selectOption(category);
    await expect.poll(async () => (await handles(page)).every(h => h.category === category)).toBe(true);
    if (category !== "handleless_plain") await expect.poll(async () => (await handles(page)).length).toBeGreaterThan(0);
    else expect(await handles(page)).toHaveLength(0);
    const closed = await handles(page);
    for (const h of closed) { expect((await scene(page)).some(p => p.id === h.parent)).toBe(true); expect(h.scale.every(x => x > 0)).toBe(true); }
    await page.screenshot({ path: `${out}/handle-${category}-closed.png` });
    await page.getByTestId("studio-door-toggle").click();
    if (closed.length && category !== "gola_profile") await expect.poll(async () => JSON.stringify((await handles(page)).map(h => h.center))).not.toBe(JSON.stringify(closed.map(h => h.center)));
    if (category === "gola_profile") expect((await handles(page)).map(h => h.center)).toEqual(closed.map(h => h.center));
    await page.screenshot({ path: `${out}/handle-${category}-open.png` });
    await page.getByTestId("studio-door-toggle").click();
    timings.push({ category, ms: Date.now() - start, meshes: closed.length });
  }
  await page.getByTestId("v4-handle-select").selectOption("knob");
  await page.getByTestId("v3-undo-btn").click(); await expect(page.getByTestId("v4-handle-select")).toHaveValue("handleless_plain");
  await page.getByTestId("v3-redo-btn").click(); await expect(page.getByTestId("v4-handle-select")).toHaveValue("knob");
  await page.getByTestId("v3-open-projects-btn").click(); await page.getByTestId("v3-save-input").fill("V41 actual saved design"); await page.getByTestId("v3-save-confirm-btn").click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("birim_saved_projects") ?? "[]"));
  expect(stored[0].project.modules[0].bays[0].door.handleCategory).toBe("knob");
  await page.getByTestId("v3-modal-close").click(); await page.reload();
  await page.getByTestId("v3-open-projects-btn").click(); await page.getByTestId("v3-load-btn-0").click();
  await expect(page.getByTestId("v4-handle-select")).toHaveValue("knob");
  await expect.poll(async () => (await handles(page)).filter(h => h.category === "knob").length).toBe(4);
  expect(errors).toEqual([]); writeFileSync(`${out}/handle-interactions.json`, JSON.stringify(timings, null, 2));
});

test("door motion, drawers, materials, mode changes and kitchen screenshots", async ({ page }) => {
  test.setTimeout(180000);
  await page.getByTestId("v4-family-selector").selectOption("fam_kitchen_wall");
  // The native selector is located by its persisted model field rather than assumed option order.
  const door = page.locator('select').filter({ has: page.locator('option[value="lift_up_stay"]') }).first();
  for (const system of ["hinged_single", "hinged_double", "sliding_top_hung", "lift_up_stay", "lift_parallel", "lift_bi_fold", "folding_side", "pocket_retractable", "tambour_roller"]) {
    await door.selectOption(system);
    const closed = (await scene(page)).filter(m => m.role === "door_left" || m.role === "door_right"); expect(closed.length).toBeGreaterThan(0);
    await page.getByTestId("studio-door-toggle").click();
    await expect.poll(async () => JSON.stringify((await scene(page)).filter(m => m.role === "door_left" || m.role === "door_right").map(m => m.matrix))).not.toBe(JSON.stringify(closed.map(m => m.matrix)));
    await page.screenshot({ path: `${out}/door-${system}-open.png` });
    await page.getByTestId("studio-door-toggle").click();
  }
  await page.getByTestId("v4-family-selector").selectOption("fam_kitchen_base"); await page.getByTestId("v4-apply-tpl-tpl_kb_05_three_drawers").click();
  await expect.poll(async () => (await scene(page)).filter(m => m.role === "drawer_front").length).toBe(3);
  await page.screenshot({ path: `${out}/drawers.png` });
  await page.getByTestId("v3-mode-plan").click();
  for (const kitchen of ["linear", "l", "u"]) { await page.getByTestId(`plan-preset-${kitchen}-kitchen`).click(); await page.screenshot({ path: `${out}/kitchen-${kitchen}.png` }); }
  await page.getByTestId("v3-mode-showroom").click(); await page.screenshot({ path: `${out}/showroom.png` });
  await page.getByTestId("v3-mode-studio").click(); await page.getByTestId("studio-view-2d").click(); await expect(page.getByTestId("v3-cad-elevation")).toBeVisible();
  await page.screenshot({ path: `${out}/elevation.png` });
});

test("material selections persist to mesh, BOM price and saved JSON; drawers follow translation", async ({ page }) => {
  test.setTimeout(120000);
  await page.getByTestId("v4-family-selector").selectOption("fam_kitchen_base"); await page.getByTestId("v4-apply-tpl-tpl_kb_05_three_drawers").click();
  await page.getByTestId("studio-tab-materials").click();
  const prices = new Set<string>();
  for (const material of ["mat_veneer_oak", "mat_lacquer_sage", "mat_smoked_glass"]) {
    const button = page.getByTestId(`studio-door-mat-${material}`);
    await expect(button).toBeAttached();
    await button.click();
    await expect.poll(async () => (await scene(page)).filter(m => m.role === "drawer_front").every(m => m.materialId === material)).toBe(true);
    prices.add(await page.getByTestId("studio-total-price").innerText());
    await page.screenshot({ path: `${out}/material-${material}.png` });
    await page.getByTestId("v3-open-projects-btn").click(); await page.getByTestId("v3-save-confirm-btn").click();
    const project = await page.evaluate(() => JSON.parse(localStorage.getItem("birim_saved_projects") ?? "[]")[0].project);
    expect(project.modules[0].carcass.doorMaterialId).toBe(material);
    expect(project.modules[0].bays[0].drawers.every((d: { frontMaterialId: string }) => d.frontMaterialId === material)).toBe(true);
    await page.getByTestId("v3-modal-close").click();
  }
  expect(prices.size).toBeGreaterThan(1);
  const closed = await handles(page);
  await page.getByTestId("v3-mode-showroom").click();
  await page.getByTestId("showroom-drawer-open-slider").fill("200");
  await expect.poll(async () => (await handles(page))[0].center[2] - closed[0].center[2]).toBeCloseTo(200);
  await page.screenshot({ path: `${out}/drawers-open.png` });
});

test("20 and 50 module browser stress records actual geometry and WebGL counters", async ({ page }) => {
  test.setTimeout(240000);
  const rows: unknown[] = [];
  const progress: unknown[] = [];
  for (let count = 2; count <= 50; count++) {
    const start = Date.now();
    await page.getByTestId("studio-pill-add-module").click();
    await expect(page.getByTestId(`studio-mod-pill-${count - 1}`)).toBeAttached();
    progress.push({ count, addMs: Date.now() - start });
    writeFileSync(`${out}/browser-add-progress.json`, JSON.stringify(progress, null, 2));
    if (count === 20 || count === 50) {
      await expect.poll(async () => (await scene(page)).filter(m => m.role === "carcass_side_left").length).toBe(count);
      await page.getByTestId("in-canvas-fit-scene").click();
      await page.screenshot({ path: `${out}/stress-${count}.png` });
      const metrics = await page.locator("[data-testid=v3-three-canvas] canvas").getAttribute("data-performance");
      const heap = await page.evaluate(() => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize);
      rows.push({ count, lastAddMs: Date.now() - start, meshes: (await scene(page)).length, metrics: metrics ? JSON.parse(metrics) : null, usedJSHeapBytes: heap });
    }
  }
  writeFileSync(`${out}/browser-performance.json`, JSON.stringify(rows, null, 2));
});

test("tablet interaction and storage failure feedback", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByTestId("v4-handle-select").selectOption("knob");
  await expect.poll(async () => (await handles(page)).filter(h => h.category === "knob").length).toBeGreaterThan(0);
  await page.getByTestId("v3-open-projects-btn").click();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); }; });
  await page.getByTestId("v3-save-confirm-btn").click(); await expect(page.getByTestId("v3-modal-feedback")).toContainText("Kayıt başarısız");
  await expect(page.getByTestId("v3-modal-feedback")).toHaveAttribute("role", "alert");
  await page.screenshot({ path: `${out}/tablet-storage-error.png` });
});
