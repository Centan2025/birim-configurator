import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  DEFAULT_MATERIALS,
  computeProjectGrainNeighborMap,
  createDefaultWardrobeModule,
  type DesignProject,
} from "@birim/core";
import {
  generateAssemblyInstructions,
  generateBOMForProject,
  generateThermalPartLabelsHtml,
  generateThermalPartLabelsZpl,
} from "@birim/manufacturing";

function createOak180WardrobeProject(): DesignProject {
  const mod = createDefaultWardrobeModule("mod_oak_180", 1800, 2200, 600);
  mod.name = "180cm Meşe Gardırop (58+117cm)";
  mod.carcass.materialId = "mat_melamine_white";
  mod.carcass.doorMaterialId = "mat_veneer_oak";
  mod.carcass.grainContinuityMode = "module_4way";
  mod.carcass.plinthHeight = 80;

  // 1. Bölme (58 cm iç net) -> Tek Sol Kapak, 0 çekmece
  // 2. Bölme (117 cm iç net) -> Altta 2 dış çekmece + Üstte Çift Kapak
  mod.bays = [
    {
      id: "bay_0",
      index: 0,
      widthRule: "fixed",
      fixedWidth: 580,
      shelves: [],
      drawers: [],
      hangingRails: [],
      internalFittings: [],
      door: {
        id: "door_b0",
        type: "single_left",
        doorSystemId: "hinged_single_left",
        doorMaterialId: "mat_veneer_oak",
      },
    },
    {
      id: "bay_1",
      index: 1,
      widthRule: "fixed",
      fixedWidth: 1166,
      shelves: [],
      drawers: [
        {
          id: "drw_b1_bot",
          height: 200,
          elevationY: 0,
          slideSystemId: "blum_tandem_500",
          frontMaterialId: "mat_veneer_oak",
        },
        {
          id: "drw_b1_top",
          height: 200,
          elevationY: 200,
          slideSystemId: "blum_tandem_500",
          frontMaterialId: "mat_veneer_oak",
        },
      ],
      hangingRails: [],
      internalFittings: [],
      door: {
        id: "door_b1",
        type: "double",
        doorSystemId: "hinged_double",
        doorMaterialId: "mat_veneer_oak",
      },
    },
  ];

  return {
    id: "proj_v75_oak180",
    title: "Birim V7.5 Desen Takibi & Ortak R2 Testi",
    customerName: "Cenk Tanrikulu",
    version: 1,
    status: "draft",
    createdAt: "2026-11-14T09:00:00.000Z",
    updatedAt: "2026-11-14T09:00:00.000Z",
    space: {
      id: "sp_1",
      name: "Yatak Odası",
      type: "bedroom",
      walls: [{ id: "w1", length: 3600, height: 2600, thickness: 200 }],
      ceilingHeight: 2600,
      elements: [],
    },
    modules: [mod],
  } as DesignProject;
}

describe("V7.5 — Desen Takibi Termal Etiketler, 2D Montaj Dizilimi ve Ortak Birim-Portal R2", () => {
  it("180cm (58+117cm) meşe gardıropta 5 cephe parçasının 4-yönlü komşuluklarını, HTML ve Zebra ZPL etiketlerini eksiksiz üretir", () => {
    const project = createOak180WardrobeProject();
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    const neighborMap = computeProjectGrainNeighborMap(project, matMap);

    const b0Door = neighborMap.get("door_b0");
    const drwBot = neighborMap.get("drw_b1_bot_front");
    const drwTop = neighborMap.get("drw_b1_top_front");
    const b1Left = neighborMap.get("door_b1_leaf_left");
    const b1Right = neighborMap.get("door_b1_leaf_right");

    expect(b0Door?.shortSeqBadge).toBe("[1/5]");
    expect(drwBot?.shortSeqBadge).toBe("[2/5]");
    expect(drwTop?.shortSeqBadge).toBe("[3/5]");
    expect(b1Left?.shortSeqBadge).toBe("[4/5]");
    expect(b1Right?.shortSeqBadge).toBe("[5/5]");

    // Alt çekmece ([2/5]) üstünde [3/5] olduğunu, üst çekmece ([3/5]) altında [2/5] ve üstünde [4/5] olduğunu bilir!
    expect(drwBot?.topNeighbor?.shortSeqBadge).toBe("[3/5]");
    expect(drwBot?.leftNeighbor?.shortSeqBadge).toBe("[1/5]");
    expect(drwTop?.bottomNeighbor?.shortSeqBadge).toBe("[2/5]");
    expect(drwTop?.topNeighbor?.shortSeqBadge).toBe("[4/5]");
    expect(b1Left?.rightNeighbor?.shortSeqBadge).toBe("[5/5]");
    expect(b1Right?.leftNeighbor?.shortSeqBadge).toBe("[4/5]");

    const bom = generateBOMForProject(project, matMap);
    const htmlLabels = generateThermalPartLabelsHtml(project, bom);
    expect(htmlLabels).toContain("100mm 50mm");
    expect(htmlLabels).toContain("[0,0]");
    expect(htmlLabels).toContain("DESEN [1/5] ↑");
    expect(htmlLabels).toContain("DESEN [2/5] ↑");
    expect(htmlLabels).toContain("DESEN [5/5] ↑");
    expect(htmlLabels).toContain("DİKEY SUYOLU ↑ [2/5]:");
    expect(htmlLabels).toContain("↑ ÜST:[3/5]");

    const zplLabels = generateThermalPartLabelsZpl(project, bom);
    expect(zplLabels).toContain("^XA");
    expect(zplLabels).toContain("^BCN");
    expect(zplLabels).toContain("[DT [2/5]]");
    expect(zplLabels).toContain("DESEN SIRA [2/5] DIKEY SUYOLU (^)");
    expect(zplLabels).toContain("UST:[3/5]");
    expect(zplLabels).toContain("DESEN SIRA [3/5] DIKEY SUYOLU (^)");
    expect(zplLabels).toContain("ALT:[2/5]");
  });

  it("Montaj kılavuzu (generateAssemblyInstructions) ve 2D Montaj Şeması modalı desen sırası ve suyolu oklarını içerir", () => {
    const project = createOak180WardrobeProject();
    const matMap = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
    const bom = generateBOMForProject(project, matMap);
    const steps = generateAssemblyInstructions(project, bom);

    expect(steps.length).toBeGreaterThanOrEqual(4);
    const finalDoorStep = steps[steps.length - 1];
    expect(finalDoorStep.title).toContain("Kapak");
    expect(finalDoorStep.description).toContain("DESEN TAKİBİ MONTAJ DİZİLİMİ");
    expect(finalDoorStep.description).toContain("[1/5]");
    expect(finalDoorStep.description).toContain("[5/5]");
    expect(finalDoorStep.safetyWarning).toContain("DESEN TAKİBİ UYARISI");

    const modalSrc = fs.readFileSync(
      path.join(__dirname, "../apps/configurator/src/v3/components/workspace/AssemblyDiagramModal.tsx"),
      "utf8"
    );
    expect(modalSrc).toContain("computeProjectGrainNeighborMap");
    expect(modalSrc).toContain("assembly-grain-sequence-card");
    expect(modalSrc).toContain("grain-flow-arrow");
  });

  it("Ortak birim-portal .env.local R2 kurulumunu okur, 'JzdXBhYmFz' domain temizliğini yapar ve 'configurator/' önekiyle izole yükler", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "birim-portal-env-test-"));
    const mockEnvFile = path.join(tmpDir, ".env.local");
    fs.writeFileSync(
      mockEnvFile,
      [
        "# Mock F:\\birim-portal\\.env.local",
        "R2_ENDPOINT=https://portalacc.r2.cloudflarestorage.com",
        "R2_BUCKET_NAME=birim-teklif",
        "R2_ACCESS_KEY_ID=PORTAL_AKIA_KEY",
        "R2_SECRET_ACCESS_KEY=PORTAL_SECRET_KEY",
        'NEXT_PUBLIC_R2_DOMAIN="https://cdn.birim.comJzdXBhYmFz/"',
        "NEXT_PUBLIC_SUPABASE_URL=https://gmxzpwufdsjtwzshxomd.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY=eyJ_mock_service_role",
      ].join("\n"),
      "utf8"
    );

    const {
      resolveSharedBirimPortalEnv,
    } = require("../apps/configurator/src/lib/birim-portal-env");
    const {
      buildIsolatedConfiguratorR2Key,
      GET: getR2Health,
      POST: postR2Upload,
    } = require("../apps/configurator/src/app/api/integrations/r2-upload/route");

    const prevPortalPath = process.env.BIRIM_PORTAL_ENV_PATH;
    const prevEnd = process.env.R2_ENDPOINT;
    const prevBkt = process.env.R2_BUCKET_NAME;
    const prevKey = process.env.R2_ACCESS_KEY_ID;
    const prevSec = process.env.R2_SECRET_ACCESS_KEY;
    const prevDom = process.env.NEXT_PUBLIC_R2_DOMAIN;
    const origFetch = global.fetch;

    try {
      delete process.env.R2_ENDPOINT;
      delete process.env.R2_BUCKET_NAME;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.NEXT_PUBLIC_R2_DOMAIN;
      process.env.BIRIM_PORTAL_ENV_PATH = mockEnvFile;

      const resolved = resolveSharedBirimPortalEnv();
      expect(resolved.r2Configured).toBe(true);
      expect(resolved.r2Source).toBe("birim_portal_shared_env");
      expect(resolved.r2BucketName).toBe("birim-teklif");
      expect(resolved.r2PublicDomain).toBe("https://cdn.birim.com");

      const isolatedKey = buildIsolatedConfiguratorR2Key({
        organizationId: "00000000-0000-0000-0000-000000000001",
        subFolder: "configurator-glb",
        fileName: "Birim_CAM_Paket.zip",
        timestampMs: 1763100000000,
      });
      expect(isolatedKey).toBe(
        "00000000-0000-0000-0000-000000000001/configurator/glb/1763100000000-Birim_CAM_Paket.zip"
      );

      const healthRes = await getR2Health();
      const healthJson = await healthRes.json();
      expect(healthJson.ok).toBe(true);
      expect(healthJson.sharedWithBirimPortal).toBe(true);
      expect(healthJson.bucketName).toBe("birim-teklif");

      // Mock upstream Cloudflare R2 PUT response
      let capturedPutUrl = "";
      global.fetch = (async (input: RequestInfo | URL) => {
        capturedPutUrl = String(input);
        return new Response("", { status: 200 });
      }) as typeof fetch;

      const uploadReq = new Request("http://localhost:3300/api/integrations/r2-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/zip",
          "x-birim-filename": "Birim_CAM_v75.zip",
          "x-birim-folder": "cam-packages",
          "x-birim-org-id": "00000000-0000-0000-0000-000000000001",
          "x-birim-share-portal-r2": "true",
        },
        body: new Uint8Array([80, 75, 3, 4, 10, 20]),
      });

      const uploadRes = await postR2Upload(uploadReq);
      expect(uploadRes.status).toBe(201);
      const uploadJson = await uploadRes.json();
      expect(uploadJson.ok).toBe(true);
      expect(uploadJson.source).toBe("birim_portal_shared_env");
      expect(uploadJson.key).toMatch(
        /^00000000-0000-0000-0000-000000000001\/configurator\/cam-packages\/\d+-Birim_CAM_v75\.zip$/
      );
      expect(uploadJson.url).toBe(`https://cdn.birim.com/${uploadJson.key}`);
      expect(capturedPutUrl).toContain("https://portalacc.r2.cloudflarestorage.com/birim-teklif/");
    } finally {
      global.fetch = origFetch;
      if (prevPortalPath === undefined) delete process.env.BIRIM_PORTAL_ENV_PATH;
      else process.env.BIRIM_PORTAL_ENV_PATH = prevPortalPath;
      if (prevEnd === undefined) delete process.env.R2_ENDPOINT;
      else process.env.R2_ENDPOINT = prevEnd;
      if (prevBkt === undefined) delete process.env.R2_BUCKET_NAME;
      else process.env.R2_BUCKET_NAME = prevBkt;
      if (prevKey === undefined) delete process.env.R2_ACCESS_KEY_ID;
      else process.env.R2_ACCESS_KEY_ID = prevKey;
      if (prevSec === undefined) delete process.env.R2_SECRET_ACCESS_KEY;
      else process.env.R2_SECRET_ACCESS_KEY = prevSec;
      if (prevDom === undefined) delete process.env.NEXT_PUBLIC_R2_DOMAIN;
      else process.env.NEXT_PUBLIC_R2_DOMAIN = prevDom;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
