import { describe, expect, it } from "vitest";
import {
  CEILING_TYPE_CATALOG,
  DEFAULT_MATERIALS,
  GRAIN_CONTINUITY_CATALOG,
  MULTI_HOLE_MODE_CATALOG,
  computeEffectiveCeilingClearHeight,
  computeProjectGrainContinuityMap,
  createInitialProject,
  evaluateUnifiedEngineeringModel,
  parseAndMigrateProject,
} from "@birim/core";
import {
  buildBirimErpNestingBundle,
  generateBOMForProject,
} from "@birim/manufacturing";

describe("V7.4 — Çoklu Delik Sistemi (System 32), Mimari Tavan Tipleri ve Desenli Malzemede Desen Takibi", () => {
  it("1. Çoklu Delik Sistemi: Tam Boy 32mm, 3 Sıra Derin Gövde, 3'lü/5'li Küme, Tekli Pim, Orta Dikme Boydan Boya ve P0 Deliksiz Raf Koruması çalışır", () => {
    expect(MULTI_HOLE_MODE_CATALOG.length).toBe(6);
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));

    // A) Tam Boy Sistem 32 + 3 Sıra (Ön + Orta + Arka) + Orta Dikme Boydan Boya (18mm)
    const projFull = createInitialProject();
    const mod = projFull.modules[0];
    mod.dimensions = { width: 1200, height: 2200, depth: 600 };
    mod.bays[0].customWidth = 573;
    mod.carcass.multiHoleMode = "full_system_32";
    mod.carcass.multiHoleRowCount = 3;
    mod.carcass.multiHoleDividerThroughBore = true;

    const bomFull = generateBOMForProject(projFull, matMap);
    const leftSide = bomFull.cutList.find((p) => p.componentRole === "carcass_side_left")!;
    const divider = bomFull.cutList.find((p) => p.componentRole === "carcass_divider")!;

    const leftPins = (leftSide.holes || []).filter((h) => h.purpose === "shelf_pin");
    const distinctXCols = Array.from(new Set(leftPins.map((h) => h.x))).sort((a, b) => a - b);
    expect(distinctXCols.length).toBe(3); // Ön + Orta + Arka 3 sütun!
    // Her sütun arası 32mm'nin tam katı olmalıdır
    expect((distinctXCols[1] - distinctXCols[0]) % 32).toBe(0);
    expect((distinctXCols[2] - distinctXCols[0]) % 32).toBe(0);
    expect(leftPins.length).toBeGreaterThan(120);

    // Orta dikmede boydan boya (18mm) delik aktifken derinlik tam panel kalınlığı (18mm) olmalı ve arka yüz tekrarı olmamalıdır
    const divPins = (divider.holes || []).filter((h) => h.purpose === "shelf_pin");
    expect(divPins.length).toBeGreaterThan(60);
    expect(divPins.every((h) => h.depth === 18 && h.direction === "face_front")).toBe(true);

    // B) 3'lü Küme (cluster_3) ve Tekli Pim (single_pin) delik sayısı azalımı
    const projCluster3 = createInitialProject();
    projCluster3.modules[0].dimensions = { width: 1200, height: 2200, depth: 600 };
    projCluster3.modules[0].bays[0].customWidth = 573;
    projCluster3.modules[0].carcass.multiHoleMode = "cluster_3";
    projCluster3.modules[0].carcass.multiHoleRowCount = 2;
    const bomCluster3 = generateBOMForProject(projCluster3, matMap);
    const cluster3Pins = (
      bomCluster3.cutList.find((p) => p.componentRole === "carcass_side_left")!.holes || []
    ).filter((h) => h.purpose === "shelf_pin");
    // Bölme 0'da 1 hareketli raf var -> 3 yükseklik (-32, 0, +32) × 2 sütun = 6 delik!
    expect(cluster3Pins.length).toBe(6);

    const projSingle = createInitialProject();
    projSingle.modules[0].dimensions = { width: 1200, height: 2200, depth: 600 };
    projSingle.modules[0].bays[0].customWidth = 573;
    projSingle.modules[0].carcass.multiHoleMode = "single_pin";
    const bomSingle = generateBOMForProject(projSingle, matMap);
    const singlePins = (
      bomSingle.cutList.find((p) => p.componentRole === "carcass_side_left")!.holes || []
    ).filter((h) => h.purpose === "shelf_pin");
    expect(singlePins.length).toBe(2); // Ön + Arka toplam 2 tekil pim deliği!

    // C) Deliksiz ("none") modda hareketli raf varsa P0 mühendislik hatası üretilmeli
    const projNone = createInitialProject();
    projNone.modules[0].dimensions = { width: 1200, height: 2200, depth: 600 };
    projNone.modules[0].bays[0].customWidth = 573;
    projNone.modules[0].carcass.multiHoleMode = "none";
    const repBlocked = evaluateUnifiedEngineeringModel(projNone);
    expect(
      repBlocked.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_ADJUSTABLE_SHELF_WITHOUT_PIN_HOLES"
      )
    ).toBe(true);

    // Tüm raflar sabit yapıldığında P0 hatası kalkmalıdır
    projNone.modules[0].bays.forEach((b) =>
      b.shelves.forEach((s) => {
        s.isAdjustable = false;
      })
    );
    const repFixedOk = evaluateUnifiedEngineeringModel(projNone);
    expect(
      repFixedOk.blockingSafetyAndEngineeringErrors.some(
        (e) => e.code === "ERR_ADJUSTABLE_SHELF_WITHOUT_PIN_HOLES"
      )
    ).toBe(false);
  });

  it("2. Mimari Tavan Sistemi ve 6 Tavan Tipi: Net alt kot hesabı, P0 tavan çakışma engeli, çözüm önerisi ve Zod şema korunumu çalışır", () => {
    expect(CEILING_TYPE_CATALOG.length).toBe(6);

    const proj = createInitialProject();
    proj.space.ceilingHeight = 2600;
    const mod = proj.modules[0];
    mod.dimensions = { width: 1200, height: 2460, depth: 600 };
    mod.bays[0].customWidth = 573;
    mod.wallAnchored = true;
    mod.wallSubstrate = "concrete";

    // 1) Düz Tavan (2600mm): 2460mm dolap sığar
    proj.space.ceilingConfig = {
      enabled: true,
      ceilingType: "flat_plaster",
      showIn3D: true,
      showInElevation2D: true,
    };
    const clearFlat = computeEffectiveCeilingClearHeight(proj.space, 0, 1200, 0, 600);
    expect(clearFlat.minClearHeightMm).toBe(2600);

    // 2) Dolap Üstü Alçıpan Alın Kutusu (gypsum_soffit_bulkhead, 200mm düşüm -> net kot 2400mm): 2460mm dolap P0 çakışır!
    proj.space.ceilingConfig = {
      enabled: true,
      ceilingType: "gypsum_soffit_bulkhead",
      dropHeightMm: 200,
      soffitDepthMm: 620,
      showIn3D: true,
      showInElevation2D: true,
      translucentCutawayIn3D: true,
    };
    const clearSoffit = computeEffectiveCeilingClearHeight(proj.space, 0, 1200, 0, 600);
    expect(clearSoffit.minClearHeightMm).toBe(2400);

    const repCollision = evaluateUnifiedEngineeringModel(proj);
    const ceilErr = repCollision.blockingSafetyAndEngineeringErrors.find(
      (e) => e.code === "ERR_CEILING_TYPE_COLLISION"
    );
    expect(ceilErr).toBeDefined();
    expect(ceilErr?.remediationProposals?.[0]?.patchPayload?.targetHeightMm).toBe(2380);

    // 3) Eğimli Çatı (sloped_attic): X=0'da 1800mm diz duvarı, 25° eğim
    proj.space.ceilingConfig = {
      enabled: true,
      ceilingType: "sloped_attic",
      slopeKneeHeightMm: 1800,
      slopeAngleDeg: 25,
      slopeDirection: "left_to_right",
    };
    const clearSlopedLeft = computeEffectiveCeilingClearHeight(proj.space, 0, 600, 0, 600);
    const clearSlopedRight = computeEffectiveCeilingClearHeight(proj.space, 1200, 600, 0, 600);
    expect(clearSlopedLeft.minClearHeightMm).toBe(1800);
    expect(clearSlopedRight.minClearHeightMm).toBeGreaterThan(2300);

    // 4) Strict Zod Schema Roundtrip (Hiçbir V7.4 alanı kırpılmamalıdır!)
    mod.carcass.multiHoleMode = "cluster_5";
    mod.carcass.multiHoleRowCount = 3;
    mod.carcass.grainContinuityMode = "module_4way";
    proj.facadeGrainContinuity = true;
    const parsed = parseAndMigrateProject(JSON.parse(JSON.stringify(proj)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.project.space.ceilingConfig?.ceilingType).toBe("sloped_attic");
      expect(parsed.project.space.ceilingConfig?.slopeKneeHeightMm).toBe(1800);
      expect(parsed.project.modules[0].carcass.multiHoleMode).toBe("cluster_5");
      expect(parsed.project.modules[0].carcass.grainContinuityMode).toBe("module_4way");
      expect(parsed.project.facadeGrainContinuity).toBe(true);
    }
  });

  it("3. Desenli Malzemede Desen Takibi: 3D/2D UV ofset haritası, BOM kompozit 2D plaka şeridi ve ERP Nesting sıra kilidi birebir tutarlıdır", () => {
    expect(GRAIN_CONTINUITY_CATALOG.length).toBe(4);
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));

    // İki adet yan yana doğal meşe kaplama (mat_veneer_oak, hasGrain: true) modül oluştur
    const proj = createInitialProject();
    proj.facadeGrainContinuity = true;
    const m1 = proj.modules[0];
    m1.id = "mod_oak_left";
    m1.name = "Sol Meşe Dolap";
    m1.position = { x: 0, y: 0, z: 0 };
    m1.dimensions = { width: 1000, height: 2100, depth: 600 };
    m1.carcass.doorMaterialId = "mat_veneer_oak";
    m1.carcass.grainContinuityMode = "facade_continuous";
    m1.bays[0].customWidth = 473;
    // Bölme 1'de üst üste 2 dış çekmece + üst kapak olsun (aynı ebattaki çekmecelerin ERP'de birleştirilmediğini de kanıtlar!)
    m1.bays[1].drawers = [
      { id: "drw_oak_1", bayIndex: 1, elevationY: 0, height: 200, slideType: "soft_close", isInternal: false },
      { id: "drw_oak_2", bayIndex: 1, elevationY: 203, height: 200, slideType: "soft_close", isInternal: false },
    ];

    const m2 = JSON.parse(JSON.stringify(m1));
    m2.id = "mod_oak_right";
    m2.name = "Sağ Meşe Dolap";
    m2.position = { x: 1000, y: 0, z: 0 };
    m2.bays[0].door.id = "door_m2_0";
    m2.bays[1].door.id = "door_m2_1";
    m2.bays[1].drawers[0].id = "drw_m2_1";
    m2.bays[1].drawers[1].id = "drw_m2_2";
    proj.modules.push(m2);

    // 1) Merkezi Desen Takibi UV ve Grup Haritası Doğrulaması
    const grainMap = computeProjectGrainContinuityMap(proj, matMap);
    const d1Assign = grainMap.get("drw_oak_1_front")!;
    const d2Assign = grainMap.get("drw_oak_2_front")!;
    const m2Assign = grainMap.get("drw_m2_1_front")!;
    expect(d1Assign).toBeDefined();
    expect(d2Assign).toBeDefined();
    expect(m2Assign).toBeDefined();

    // Üst çekmecenin Y ofseti alt çekmeceden tam 203mm yukarıda olmalı, X ofseti birebir aynı kalmalı!
    expect(d2Assign.offsetXMm).toBeCloseTo(d1Assign.offsetXMm, 1);
    expect(d2Assign.offsetYMm - d1Assign.offsetYMm).toBeCloseTo(203, 1);
    // Yan modüldeki çekmecenin her iki modül toplam 2000mm (< 2040mm net plaka eni) olduğu için X ofseti tam +1000mm sağda olmalı!
    expect(m2Assign.offsetXMm - d1Assign.offsetXMm).toBeCloseTo(1000, 1);
    expect(d1Assign.grainGroupId).toBe(m2Assign.grainGroupId);

    // 3D mesh-generator'ın ürettiği gerçek kapak/çekmece bileşen kimliklerinin (`_leaf_left`, `_leaf_right`, `_left`, `_front`) %100'ü haritada eşleşmelidir!
    const { generateModuleGeometry } = require("@birim/geometry");
    const defaultOakProj = createInitialProject();
    const defaultMap = computeProjectGrainContinuityMap(defaultOakProj, matMap);
    const geo3d = generateModuleGeometry(defaultOakProj.modules[0]);
    const front3dComps = geo3d.components.filter(
      (c: { role: string }) => c.role === "door_left" || c.role === "door_right" || c.role === "drawer_front"
    );
    expect(front3dComps.length).toBe(5); // 1 sol tek kapak + 2 çekmece + 2 çift kapak kanadı = 5 parça!
    for (const fc of front3dComps) {
      expect(defaultMap.get(fc.id)).toBeDefined();
    }

    // 2) BOM & Nesting Doğrulaması: Aynı gruptaki parçalar grainGroupId taşır ve döndürülmez
    const bom = generateBOMForProject(proj, matMap);
    const oakFrontPieces = bom.cutList.filter((p) => p.grainGroupId === d1Assign.grainGroupId);
    expect(oakFrontPieces.length).toBeGreaterThanOrEqual(6);
    expect(oakFrontPieces.every((p) => p.grain !== "none")).toBe(true);
    expect(oakFrontPieces.every((p) => (p.notes || "").includes("Desen Takibi:"))).toBe(true);

    // 3) Birim-Portal ERP Nesting Köprüsü: Aynı ebattaki drw_oak_1 ve drw_oak_2 ASLA quantity:2 altında ezilmez, sıra etiketleri korunur!
    const erpBundle = buildBirimErpNestingBundle(proj, bom, matMap);
    const oakJob = erpBundle.jobs.find((j) => j.material_id === "mat_veneer_oak")!;
    expect(oakJob).toBeDefined();
    const dtParts = oakJob.part_records.filter((pr) => pr.part_label.includes("[DT:"));
    expect(dtParts.length).toBe(oakFrontPieces.length);
    expect(dtParts.every((pr) => pr.can_rotate === false && pr.quantity === 1)).toBe(true);
  });

  it("4. Next.js SWC Koruması: Tüm .ts/.tsx dosyalarında 'use client' ve 'use server' yönergeleri her zaman ilk ifade olarak yer alır", () => {
    const fsMod = require("fs") as typeof import("fs");
    const pathMod = require("path") as typeof import("path");
    const repoRoot = pathMod.resolve(__dirname, "..");

    function walk(dir: string, acc: string[] = []): string[] {
      for (const ent of fsMod.readdirSync(dir, { withFileTypes: true })) {
        if (["node_modules", ".next", "dist", ".git"].includes(ent.name)) continue;
        const full = pathMod.join(dir, ent.name);
        if (ent.isDirectory()) walk(full, acc);
        else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) acc.push(full);
      }
      return acc;
    }

    const violations: string[] = [];
    for (const file of walk(repoRoot)) {
      const raw = fsMod.readFileSync(file, "utf8");
      const lines = raw.split(/\r?\n/);
      let seenExpression = false;
      let inBlockComment = false;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].replace(/^\uFEFF/, "").trim();
        if (!trimmed) continue;
        if (inBlockComment) {
          if (trimmed.includes("*/")) inBlockComment = false;
          continue;
        }
        if (trimmed.startsWith("/*")) {
          if (!trimmed.includes("*/")) inBlockComment = true;
          continue;
        }
        if (trimmed.startsWith("//")) continue;

        const isDirective = /^["']use (client|server)["']\s*;?$/.test(trimmed);
        if (isDirective && (seenExpression || raw.startsWith("\uFEFF"))) {
          violations.push(`${pathMod.relative(repoRoot, file)}:${i + 1}`);
        }
        seenExpression = true;
      }
    }
    expect(violations).toEqual([]);
  });

  it("5. Çalışma Zamanı Referans Koruması: Tüm .ts/.tsx dosyalarında tanımsız değişken/hook (ReferenceError) bulunmaz", () => {
    const fsMod = require("fs") as typeof import("fs");
    const pathMod = require("path") as typeof import("path");
    const babel = require("@babel/core");
    const parser = require("@babel/parser");
    const traverse = require("@babel/traverse").default;
    const repoRoot = pathMod.resolve(__dirname, "..");

    const knownGlobals = new Set([
      "undefined", "NaN", "Infinity", "globalThis", "global", "self",
      "Object", "Function", "Boolean", "Symbol", "Error", "AggregateError",
      "EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError",
      "Number", "BigInt", "Math", "Date", "String", "RegExp",
      "Array", "Int8Array", "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array",
      "Int32Array", "Uint32Array", "Float32Array", "Float64Array", "BigInt64Array", "BigUint64Array",
      "Map", "Set", "WeakMap", "WeakSet", "ArrayBuffer", "SharedArrayBuffer", "Atomics", "DataView", "JSON",
      "Promise", "Reflect", "Proxy", "Intl", "WebAssembly",
      "eval", "isFinite", "isNaN", "parseFloat", "parseInt",
      "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent", "escape", "unescape",
      "setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate",
      "queueMicrotask", "structuredClone", "requestAnimationFrame", "cancelAnimationFrame",
      "requestIdleCallback", "cancelIdleCallback",
      "window", "document", "navigator", "location", "history", "screen",
      "localStorage", "sessionStorage", "indexedDB", "console", "performance", "crypto", "atob", "btoa",
      "fetch", "Headers", "Request", "Response", "AbortController", "AbortSignal",
      "URL", "URLSearchParams", "Blob", "File", "FileReader", "FormData",
      "TextEncoder", "TextDecoder", "CompressionStream", "DecompressionStream",
      "ReadableStream", "WritableStream", "TransformStream",
      "Worker", "SharedWorker", "MessageChannel", "MessagePort", "BroadcastChannel",
      "Event", "CustomEvent", "MessageEvent", "ErrorEvent", "PromiseRejectionEvent",
      "UIEvent", "MouseEvent", "PointerEvent", "KeyboardEvent", "WheelEvent", "TouchEvent", "FocusEvent", "DragEvent", "ClipboardEvent",
      "EventTarget", "Node", "Element", "HTMLElement", "SVGElement", "SVGSVGElement",
      "HTMLCanvasElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement",
      "HTMLDivElement", "HTMLButtonElement", "HTMLAnchorElement", "HTMLImageElement", "HTMLFormElement",
      "Image", "ImageData", "CanvasRenderingContext2D", "OffscreenCanvas", "Path2D", "createImageBitmap",
      "WebGLRenderingContext", "WebGL2RenderingContext", "AudioContext", "webkitAudioContext",
      "DOMParser", "XMLSerializer", "DOMRect", "DOMMatrix",
      "ResizeObserver", "IntersectionObserver", "MutationObserver",
      "getComputedStyle", "matchMedia", "alert", "confirm", "prompt", "print", "open", "close",
      "devicePixelRatio", "innerWidth", "innerHeight", "scrollTo", "scrollBy", "CSS", "FontFace", "ClipboardItem",
      "process", "Buffer", "require", "module", "exports", "__dirname", "__filename",
    ]);

    function walk(dir: string, acc: string[] = []): string[] {
      for (const ent of fsMod.readdirSync(dir, { withFileTypes: true })) {
        if (["node_modules", ".next", "dist", ".git"].includes(ent.name)) continue;
        const full = pathMod.join(dir, ent.name);
        if (ent.isDirectory()) walk(full, acc);
        else if ((ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) && !ent.name.endsWith(".d.ts")) acc.push(full);
      }
      return acc;
    }

    const undeclared: string[] = [];
    for (const file of walk(repoRoot)) {
      const src = fsMod.readFileSync(file, "utf8");
      const transformed = babel.transformSync(src, {
        filename: file,
        babelrc: false,
        configFile: false,
        compact: true,
        presets: [
          ["@babel/preset-typescript", { isTSX: file.endsWith("x"), allExtensions: true }],
          ...(file.endsWith("x") ? [["@babel/preset-react", { runtime: "automatic" }]] : []),
        ],
      });
      const ast = parser.parse(transformed.code, { sourceType: "module" });
      traverse(ast, {
        ReferencedIdentifier(p: any) {
          const name = p.node.name;
          if (knownGlobals.has(name)) return;
          if (p.parentPath && p.parentPath.isUnaryExpression({ operator: "typeof" })) return;
          if (!p.scope.hasBinding(name)) {
            undeclared.push(`${pathMod.relative(repoRoot, file)} -> ${name}`);
          }
        },
      });
    }
    expect(Array.from(new Set(undeclared))).toEqual([]);
  });

  it("6. Next.js externalDir Derleme Koruması ve Cloudflare R2 SigV4 + Canlı Bucket Kilidi doğrulanır", async () => {
    const fsMod = require("fs") as typeof import("fs");
    const pathMod = require("path") as typeof import("path");
    const nextCfg = fsMod.readFileSync(
      pathMod.resolve(__dirname, "../apps/configurator/next.config.mjs"),
      "utf8"
    );
    expect(nextCfg).toContain("externalDir: true");
    expect(nextCfg).toContain('"@birim/integrations"');

    const {
      buildR2SigV4PutHeaders,
      POST: postR2Upload,
    } = require("../apps/configurator/src/app/api/integrations/r2-upload/route");

    const signed = buildR2SigV4PutHeaders({
      endpointUrl: "https://acc123.r2.cloudflarestorage.com",
      bucketName: "birim-staging",
      objectKey: "0001/configurator-glb/test.glb",
      accessKeyId: "AKIA_TEST",
      secretAccessKey: "SECRET_TEST",
      contentType: "model/gltf-binary",
      bodyBuffer: Buffer.from("glTF_test"),
      now: new Date("2026-11-14T08:00:00.000Z"),
    });
    expect(signed.url).toBe(
      "https://acc123.r2.cloudflarestorage.com/birim-staging/0001/configurator-glb/test.glb"
    );
    expect(signed.headers.Authorization).toContain("AWS4-HMAC-SHA256 Credential=AKIA_TEST/20261114/auto/s3/aws4_request");

    // Production bucket ('birim-teklif') must fail-closed with 403 unless explicitly unlocked!
    const prevEnd = process.env.R2_ENDPOINT;
    const prevBkt = process.env.R2_BUCKET_NAME;
    const prevKey = process.env.R2_ACCESS_KEY_ID;
    const prevSec = process.env.R2_SECRET_ACCESS_KEY;
    try {
      process.env.R2_ENDPOINT = "https://acc123.r2.cloudflarestorage.com";
      process.env.R2_BUCKET_NAME = "birim-teklif";
      process.env.R2_ACCESS_KEY_ID = "AKIA_TEST";
      process.env.R2_SECRET_ACCESS_KEY = "SECRET_TEST";
      const req = new Request("http://localhost:3300/api/integrations/r2-upload", {
        method: "POST",
        headers: { "Content-Type": "model/gltf-binary", "x-birim-filename": "chair.glb" },
        body: new Uint8Array([1, 2, 3, 4]),
      });
      const res = await postR2Upload(req);
      expect(res.status).toBe(403);
    } finally {
      if (prevEnd === undefined) delete process.env.R2_ENDPOINT; else process.env.R2_ENDPOINT = prevEnd;
      if (prevBkt === undefined) delete process.env.R2_BUCKET_NAME; else process.env.R2_BUCKET_NAME = prevBkt;
      if (prevKey === undefined) delete process.env.R2_ACCESS_KEY_ID; else process.env.R2_ACCESS_KEY_ID = prevKey;
      if (prevSec === undefined) delete process.env.R2_SECRET_ACCESS_KEY; else process.env.R2_SECRET_ACCESS_KEY = prevSec;
    }
  });
});
