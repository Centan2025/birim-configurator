import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import {
  TenantSecurityError,
  checkTenantRateLimit,
  recordTenantAuditEvent,
  resolveTenantRequestContext,
} from "../../../../lib/tenant-auth-guard";
import { consumeTenantUsageQuota } from "../../../../lib/saas-billing-and-metering";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BlenderExecutableInfo {
  available: boolean;
  path: string | null;
  version: string | null;
}

async function resolveBlenderExecutable(): Promise<string | null> {
  const envPath = process.env.BLENDER_PATH?.trim();
  if (envPath) {
    try {
      await fs.access(envPath);
      return envPath;
    } catch {
      // fall through
    }
  }

  if (process.platform === "win32") {
    const baseDir = "C:\\Program Files\\Blender Foundation";
    try {
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      const candidates = entries
        .filter((e) => e.isDirectory() && e.name.toLowerCase().startsWith("blender"))
        .map((e) => e.name)
        .sort()
        .reverse();
      for (const dir of candidates) {
        const exePath = path.join(baseDir, dir, "blender.exe");
        try {
          await fs.access(exePath);
          return exePath;
        } catch {
          // continue
        }
      }
    } catch {
      // ignore if folder does not exist
    }
  } else if (process.platform === "darwin") {
    const macPath = "/Applications/Blender.app/Contents/MacOS/Blender";
    try {
      await fs.access(macPath);
      return macPath;
    } catch {
      // ignore
    }
  }

  // Fallback to PATH lookup
  return new Promise<string | null>((resolve) => {
    const cmd = process.platform === "win32" ? "where.exe" : "which";
    const proc = spawn(cmd, ["blender"], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString("utf8");
    });
    proc.on("close", (code) => {
      if (code === 0) {
        const firstLine = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
        resolve(firstLine ?? null);
      } else {
        resolve(null);
      }
    });
    proc.on("error", () => resolve(null));
  });
}

async function queryBlenderVersion(exePath: string): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const proc = spawn(exePath, ["--version"], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString("utf8");
    });
    proc.on("close", () => {
      const match = out.match(/Blender\s+([\d.]+(?:\s+\w+)?)/i);
      resolve(match ? match[1].trim() : null);
    });
    proc.on("error", () => resolve(null));
  });
}

export async function GET(): Promise<NextResponse<BlenderExecutableInfo>> {
  const exePath = await resolveBlenderExecutable();
  if (!exePath) {
    return NextResponse.json({ available: false, path: null, version: null });
  }
  const version = await queryBlenderVersion(exePath);
  return NextResponse.json({ available: true, path: exePath, version });
}

interface RenderMetaPayload {
  width?: number;
  height?: number;
  samples?: number;
  bounces?: number;
  isDark?: boolean;
  camera?: {
    position?: [number, number, number];
    target?: [number, number, number];
    fov?: number;
  };
}

function runBlenderProcess(
  exePath: string,
  scriptPath: string,
  glbPath: string,
  outputPngPath: string,
  metaPath: string,
  signal: AbortSignal,
  onStdoutLine?: (line: string) => void
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      exePath,
      ["--background", "--python-exit-code", "1", "--python", scriptPath, "--", glbPath, outputPngPath, metaPath],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    let lineBuf = "";

    const onAbort = () => {
      try {
        proc.kill("SIGTERM");
      } catch {
        // ignore
      }
      reject(new Error("Render iptal edildi."));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });

    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      if (onStdoutLine) {
        lineBuf += text;
        const lines = lineBuf.split(/\r?\n/);
        lineBuf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) onStdoutLine(line);
        }
      }
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    proc.on("error", (err) => {
      signal.removeEventListener("abort", onAbort);
      reject(err);
    });
    proc.on("close", (code) => {
      signal.removeEventListener("abort", onAbort);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Blender Cycles cikis kodu ${code}: ${stderr.slice(-500) || stdout.slice(-500)}`));
      }
    });
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let tenantCtx;
  try {
    tenantCtx = resolveTenantRequestContext(request);
    checkTenantRateLimit(tenantCtx.tenantId, "blender_render", 20);
    consumeTenantUsageQuota(
      tenantCtx.tenantId,
      tenantCtx.profile,
      "cloud_render",
      1,
      request.headers.get("Idempotency-Key") || undefined
    );
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status: err.httpStatus }
      );
    }
    throw err;
  }

  const isCloudQueueMode = process.env.MODUL_CLOUD_SAAS_MODE === "true";

  if (isCloudQueueMode) {
    const cloudJobId = `rnd_${tenantCtx.tenantSlug}_${Date.now()}`;
    const r2TargetKey = `${tenantCtx.tenantId}/configurator/renders/${cloudJobId}.png`;
    recordTenantAuditEvent({
      tenantId: tenantCtx.tenantId,
      actorUserId: tenantCtx.userId,
      actorRole: tenantCtx.role,
      action: "CLOUD_GPU_RENDER_QUEUED",
      targetType: "render_job",
      targetId: cloudJobId,
      metadata: { r2TargetKey },
    });
    return NextResponse.json(
      {
        ok: true,
        mode: "cloud_gpu_render_queue",
        jobId: cloudJobId,
        tenantId: tenantCtx.tenantId,
        r2TargetKey,
        status: "queued",
      },
      { status: 202 }
    );
  }

  const exePath = await resolveBlenderExecutable();
  if (!exePath) {
    return NextResponse.json(
      { error: "Blender yuklu degil veya BLENDER_PATH tanimli degil." },
      { status: 503 }
    );
  }

  const scriptPath = path.resolve(process.cwd(), "scripts", "blender_studio_render.py");
  try {
    await fs.access(scriptPath);
  } catch {
    return NextResponse.json(
      { error: `Render betigi bulunamadi: ${scriptPath}` },
      { status: 500 }
    );
  }

  const jobId = crypto.randomUUID();
  const tempDir = path.join(os.tmpdir(), "birim-blender-render", jobId);
  let cleanupHandledByStream = false;

  try {
    const formData = await request.formData();
    const glbEntry = formData.get("glb");
    const metaEntry = formData.get("meta");

    if (!(glbEntry instanceof File)) {
      return NextResponse.json({ error: "GLB sahne dosyasi eksik." }, { status: 400 });
    }

    let meta: RenderMetaPayload = {};
    if (typeof metaEntry === "string") {
      try {
        meta = JSON.parse(metaEntry) as RenderMetaPayload;
      } catch {
        meta = {};
      }
    }

    await fs.mkdir(tempDir, { recursive: true });
    const glbPath = path.join(tempDir, "scene.glb");
    const metaPath = path.join(tempDir, "meta.json");
    const outputPngPath = path.join(tempDir, "render.png");

    const glbBuffer = Buffer.from(await glbEntry.arrayBuffer());
    await fs.writeFile(glbPath, glbBuffer);
    await fs.writeFile(metaPath, JSON.stringify(meta), "utf8");

    const wantsStream = request.nextUrl.searchParams.get("stream") === "1";
    if (wantsStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (obj: Record<string, unknown>) => {
            try {
              controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
            } catch {
              // stream closed
            }
          };
          let lastPct = 24;
          send({ type: "progress", pct: 24, stage: "Blender Başlatılıyor..." });
          try {
            const t0 = Date.now();
            const { stdout } = await runBlenderProcess(
              exePath,
              scriptPath,
              glbPath,
              outputPngPath,
              metaPath,
              request.signal,
              (line) => {
                if (line.includes("[BIRIM_CYCLES] Scene imported")) {
                  lastPct = Math.max(lastPct, 28);
                  send({ type: "progress", pct: lastPct, stage: "Sahne & Işıklar Hazırlanıyor..." });
                } else if (line.includes("[BIRIM_CYCLES] Rendering")) {
                  lastPct = Math.max(lastPct, 32);
                  send({ type: "progress", pct: lastPct, stage: line.replace("[BIRIM_CYCLES] ", "") });
                } else {
                  const tileMatch = line.match(/Rendered\s+(\d+)\s*\/\s*(\d+)\s+Tiles/i);
                  const sampleMatch = line.match(/Sample\s+(\d+)\s*\/\s*(\d+)/i);
                  if (sampleMatch) {
                    const cur = Number(sampleMatch[1]);
                    const tot = Math.max(1, Number(sampleMatch[2]));
                    let combinedFrac = cur / tot;
                    if (tileMatch) {
                      const doneTiles = Math.max(0, Number(tileMatch[1]));
                      const totalTiles = Math.max(1, Number(tileMatch[2]));
                      combinedFrac = Math.min(1, (doneTiles + cur / tot) / totalTiles);
                    }
                    const pct = Math.min(93, Math.max(lastPct, 32 + Math.round(combinedFrac * 60)));
                    lastPct = pct;
                    const remMatch = line.match(/Remaining:([^\s|]+)/i);
                    const rem = remMatch ? ` • Kalan ~${remMatch[1]}` : "";
                    send({ type: "progress", pct, stage: `Cycles Örnekleme ${cur}/${tot}${rem}` });
                  } else if (/Denoising/i.test(line)) {
                    lastPct = Math.max(lastPct, 95);
                    send({ type: "progress", pct: lastPct, stage: "OpenImageDenoise Gürültü Temizleme..." });
                  }
                }
              }
            );
            const elapsedMs = Date.now() - t0;
            const pngBuffer = await fs.readFile(outputPngPath);
            const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
            const deviceMatch = stdout.match(/\(device=([A-Z0-9_]+)\)/);
            const device = deviceMatch ? deviceMatch[1] : "CPU";
            send({
              type: "done",
              dataUrl,
              elapsedMs,
              device,
              engine: `Blender Cycles (${device} + OIDN)`,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : "Blender render hatasi";
            send({ type: "error", error: message });
          } finally {
            try {
              await fs.rm(tempDir, { recursive: true, force: true });
            } catch {
              // ignore cleanup error
            }
            controller.close();
          }
        },
      });
      cleanupHandledByStream = true;
      return new NextResponse(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    const t0 = Date.now();
    const { stdout } = await runBlenderProcess(
      exePath,
      scriptPath,
      glbPath,
      outputPngPath,
      metaPath,
      request.signal
    );
    const elapsedMs = Date.now() - t0;

    const pngBuffer = await fs.readFile(outputPngPath);
    const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    const deviceMatch = stdout.match(/\(device=([A-Z0-9_]+)\)/);
    const device = deviceMatch ? deviceMatch[1] : "CPU";

    return NextResponse.json({
      dataUrl,
      elapsedMs,
      device,
      engine: `Blender Cycles (${device} + OIDN)`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Blender render hatasi";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (!cleanupHandledByStream) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  }
}
