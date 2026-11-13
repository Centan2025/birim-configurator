import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";

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
  signal: AbortSignal
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      exePath,
      ["--background", "--python", scriptPath, "--", glbPath, outputPngPath, metaPath],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";

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
      stdout += chunk.toString("utf8");
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
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  }
}
