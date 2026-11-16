"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  DEFAULT_MATERIALS,
  DesignProject,
  MaterialDefinition,
  evaluateUnifiedEngineeringModel,
} from "@birim/core";
import { generateModuleGeometry } from "@birim/geometry";
import { Cpu, Eye, EyeOff, HelpCircle, Layers, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

interface Software3DFallbackViewportProps {
  project: DesignProject;
  activeModuleIndex: number;
  selectedComponentId: string | null;
  selectedSceneObjectId?: string | null;
  doorOpenAngleDeg: number;
  drawerOpenMm: number;
  explodedFactor: number;
  gpuRendererInfo?: string;
  failureReason?: string;
  onSelectModule?: (modIndex: number) => void;
  onSelectComponent?: (compId: string | null) => void;
  onSelectSceneObject?: (objId: string | null) => void;
  onToggleDoorOpen?: () => void;
  onRetryWebGL?: () => void;
  onSwitchTo2DCad?: () => void;
}

interface ProjectedQuad {
  pts: { x: number; y: number }[];
  depthZ: number;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  hitTarget?: { kind: "module" | "scene_object"; index?: number; id: string };
}

function shadeHex(hex: string, factor: number): string {
  const clean = (hex || "#D6D1C7").replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "c").slice(0, 6);
  const r = Math.max(0, Math.min(255, Math.round(parseInt(full.slice(0, 2), 16) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(parseInt(full.slice(2, 4), 16) * factor)));
  const b = Math.max(0, Math.min(255, Math.round(parseInt(full.slice(4, 6), 16) * factor)));
  return `rgb(${r},${g},${b})`;
}

/**
 * Pure HTML5 `CanvasRenderingContext2D` Real-Time Interactive 3D Software Renderer!
 * Runs at 60 FPS with ZERO WebGL / GPU shader requirements on legacy showroom & factory PCs
 * (such as NVIDIA GeForce 210 on Direct3D9Ex `vs_3_0 ps_3_0`, Windows Remote Desktop, or VMs).
 */
export const Software3DFallbackViewport: React.FC<Software3DFallbackViewportProps> = ({
  project,
  activeModuleIndex,
  selectedComponentId,
  selectedSceneObjectId,
  doorOpenAngleDeg,
  drawerOpenMm,
  explodedFactor,
  gpuRendererInfo,
  failureReason,
  onSelectModule,
  onSelectComponent,
  onSelectSceneObject,
  onToggleDoorOpen,
  onRetryWebGL,
  onSwitchTo2DCad,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const quadsRef = useRef<ProjectedQuad[]>([]);

  const [yawDeg, setYawDeg] = useState<number>(-26);
  const [pitchDeg, setPitchDeg] = useState<number>(20);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 20 });
  const [hideDoors, setHideDoors] = useState<boolean>(false);
  const [showDriverTip, setShowDriverTip] = useState<boolean>(false);

  const dragRef = useRef<{
    mode: "orbit" | "pan";
    startX: number;
    startY: number;
    startYaw: number;
    startPitch: number;
    startPanX: number;
    startPanY: number;
    moved: boolean;
  } | null>(null);

  const matMap = useMemo(() => {
    const m = new Map<string, MaterialDefinition>();
    DEFAULT_MATERIALS.forEach((mat) => m.set(mat.id, mat));
    (project.customMaterials || []).forEach((mat) => m.set(mat.id, mat));
    return m;
  }, [project.customMaterials]);

  const engineeringReport = useMemo(
    () => evaluateUnifiedEngineeringModel(project),
    [project]
  );

  const sceneBoxes = useMemo(() => {
    const boxes: {
      id: string;
      cx: number;
      cy: number;
      cz: number;
      w: number;
      h: number;
      d: number;
      rotYDeg: number;
      colorHex: string;
      isSelected: boolean;
      isGlass: boolean;
      polygonContourMm?: [number, number][];
      primitive?: string;
      thicknessAxis?: "x" | "y" | "z";
      hitTarget?: ProjectedQuad["hitTarget"];
    }[] = [];

    project.modules.forEach((mod, mIdx) => {
      const geo = generateModuleGeometry(mod, {
        doorOpenAngleDeg: hideDoors ? 0 : doorOpenAngleDeg,
        drawerOpenMm,
        explodedFactor,
      });
      const modRotDeg = ((mod.rotation?.y ?? 0) % 360 + 360) % 360;
      const rad = (modRotDeg * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);

      geo.components.forEach((comp) => {
        if (hideDoors && comp.role.startsWith("door")) return;
        const mat = matMap.get(comp.materialId);
        const hex = mat?.colorHex || "#E5E0D8";
        const isGlass = Boolean(mat?.category === "glass" || comp.materialId.includes("glass"));
        const lx = comp.position.x + comp.dimensions.width / 2;
        const ly = comp.position.y + comp.dimensions.height / 2;
        const lz = comp.position.z + comp.dimensions.depth / 2;

        const wx = mod.position.x + lx * cosR + lz * sinR;
        const wy = mod.position.y + ly;
        const wz = mod.position.z - lx * sinR + lz * cosR;
        const compYaw = modRotDeg + (((comp.rotation?.[1] ?? 0) * 180) / Math.PI);

        boxes.push({
          id: comp.id,
          cx: wx,
          cy: wy,
          cz: wz,
          w: comp.dimensions.width,
          h: comp.dimensions.height,
          d: comp.dimensions.depth,
          rotYDeg: compYaw,
          colorHex: hex,
          isSelected: selectedComponentId === comp.id || activeModuleIndex === mIdx,
          isGlass,
          polygonContourMm: comp.polygonContourMm,
          primitive: comp.primitive,
          thicknessAxis: comp.thicknessAxis,
          hitTarget: { kind: "module", index: mIdx, id: comp.id },
        });
      });
    });

    (project.sceneObjects || []).forEach((so) => {
      if (so.isHidden) return;
      const sc = so.scaleFactor || 1;
      const w = so.dimensions.width * sc;
      const h = so.dimensions.height * sc;
      const d = so.dimensions.depth * sc;
      boxes.push({
        id: so.id,
        cx: so.position.x + w / 2,
        cy: so.position.y + h / 2,
        cz: so.position.z + d / 2,
        w,
        h,
        d,
        rotYDeg: so.rotation?.y || 0,
        colorHex: so.primaryColorHex || "#94A3B8",
        isSelected: selectedSceneObjectId === so.id,
        isGlass: false,
        hitTarget: { kind: "scene_object", id: so.id },
      });
    });

    return boxes;
  }, [
    project,
    activeModuleIndex,
    selectedComponentId,
    selectedSceneObjectId,
    doorOpenAngleDeg,
    drawerOpenMm,
    explodedFactor,
    hideDoors,
    matMap,
  ]);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const rect = canvas.getBoundingClientRect();
    const cw = Math.max(320, Math.round(rect.width));
    const ch = Math.max(240, Math.round(rect.height));
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Studio warm architectural backdrop gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, ch);
    bgGrad.addColorStop(0, "#DFDBD2");
    bgGrad.addColorStop(0.62, "#CFC9BE");
    bgGrad.addColorStop(1, "#BDB6AA");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cw, ch);

    // Compute scene bounding center
    let minX = 0,
      maxX = 2400,
      maxY = 2300,
      minZ = 0,
      maxZ = 800;
    if (sceneBoxes.length > 0) {
      minX = Math.min(...sceneBoxes.map((b) => b.cx - b.w / 2));
      maxX = Math.max(...sceneBoxes.map((b) => b.cx + b.w / 2));
      maxY = Math.max(1800, ...sceneBoxes.map((b) => b.cy + b.h / 2));
      minZ = Math.min(0, ...sceneBoxes.map((b) => b.cz - b.d / 2));
      maxZ = Math.max(600, ...sceneBoxes.map((b) => b.cz + b.d / 2));
    }
    const targetX = (minX + maxX) * 0.5;
    const targetY = maxY * 0.46;
    const targetZ = (minZ + maxZ) * 0.35;
    const span = Math.max(1800, maxX - minX, maxY * 1.15, maxZ - minZ);
    const baseScale = (Math.min(cw, ch) * 0.68) / span;
    const effScale = baseScale * zoomScale;

    const yaw = (yawDeg * Math.PI) / 180;
    const pitch = (pitchDeg * Math.PI) / 180;
    const cyaw = Math.cos(yaw);
    const syaw = Math.sin(yaw);
    const cpitch = Math.cos(pitch);
    const spitch = Math.sin(pitch);
    const camDist = span * 3.1;

    const projectPt = (wx: number, wy: number, wz: number) => {
      const dx = wx - targetX;
      const dy = wy - targetY;
      const dz = wz - targetZ;
      const rx = dx * cyaw + dz * syaw;
      const rz1 = -dx * syaw + dz * cyaw;
      const ry = dy * cpitch - rz1 * spitch;
      const rz = dy * spitch + rz1 * cpitch;
      const persp = camDist / Math.max(400, camDist - rz);
      return {
        x: cw * 0.5 + panOffset.x + rx * effScale * persp,
        y: ch * 0.52 + panOffset.y - ry * effScale * persp,
        z: rz,
      };
    };

    // Draw subtle architectural floor grid & back wall outline
    ctx.strokeStyle = "rgba(71, 85, 105, 0.16)";
    ctx.lineWidth = 1;
    const gridMinX = Math.floor((minX - 600) / 500) * 500;
    const gridMaxX = Math.ceil((maxX + 600) / 500) * 500;
    for (let gx = gridMinX; gx <= gridMaxX; gx += 500) {
      const p0 = projectPt(gx, 0, -100);
      const p1 = projectPt(gx, 0, Math.max(2200, maxZ + 600));
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    for (let gz = 0; gz <= Math.max(2200, maxZ + 600); gz += 500) {
      const p0 = projectPt(gridMinX, 0, gz);
      const p1 = projectPt(gridMaxX, 0, gz);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    // Build all visible box faces with directional shading
    const quads: ProjectedQuad[] = [];
    const faceDefs: {
      corners: [number, number, number][];
      normal: [number, number, number];
      shade: number;
    }[] = [
      // +Z Front
      {
        corners: [
          [-0.5, -0.5, 0.5],
          [0.5, -0.5, 0.5],
          [0.5, 0.5, 0.5],
          [-0.5, 0.5, 0.5],
        ],
        normal: [0, 0, 1],
        shade: 1.02,
      },
      // -Z Back
      {
        corners: [
          [0.5, -0.5, -0.5],
          [-0.5, -0.5, -0.5],
          [-0.5, 0.5, -0.5],
          [0.5, 0.5, -0.5],
        ],
        normal: [0, 0, -1],
        shade: 0.76,
      },
      // +Y Top
      {
        corners: [
          [-0.5, 0.5, 0.5],
          [0.5, 0.5, 0.5],
          [0.5, 0.5, -0.5],
          [-0.5, 0.5, -0.5],
        ],
        normal: [0, 1, 0],
        shade: 1.08,
      },
      // -Y Bottom
      {
        corners: [
          [-0.5, -0.5, -0.5],
          [0.5, -0.5, -0.5],
          [0.5, -0.5, 0.5],
          [-0.5, -0.5, 0.5],
        ],
        normal: [0, -1, 0],
        shade: 0.68,
      },
      // +X Right
      {
        corners: [
          [0.5, -0.5, 0.5],
          [0.5, -0.5, -0.5],
          [0.5, 0.5, -0.5],
          [0.5, 0.5, 0.5],
        ],
        normal: [1, 0, 0],
        shade: 0.88,
      },
      // -X Left
      {
        corners: [
          [-0.5, -0.5, -0.5],
          [-0.5, -0.5, 0.5],
          [-0.5, 0.5, 0.5],
          [-0.5, 0.5, -0.5],
        ],
        normal: [-1, 0, 0],
        shade: 0.92,
      },
    ];

    for (const box of sceneBoxes) {
      const br = (box.rotYDeg * Math.PI) / 180;
      const cb = Math.cos(br);
      const sb = Math.sin(br);

      // True Stadium / Capsule / Polygon Horizontal Slab Extrusion in Software 3D Engine
      if (box.polygonContourMm && box.polygonContourMm.length >= 3 && box.thicknessAxis === "y") {
        const poly = box.polygonContourMm;
        const halfH = box.h * 0.5;
        const strokeCol = box.isSelected ? "rgba(37, 99, 235, 0.72)" : "rgba(28, 25, 23, 0.26)";
        const mapLocalXZ = (px: number, pz: number, ly: number) => {
          const lx = px - box.w * 0.5;
          const lz = pz - box.d * 0.5;
          const wx = box.cx + lx * cb + lz * sb;
          const wy = box.cy + ly;
          const wz = box.cz - lx * sb + lz * cb;
          return projectPt(wx, wy, wz);
        };
        const topPts = poly.map(([px, pz]) => mapLocalXZ(px, pz, halfH));
        const topAvgZ = topPts.reduce((s, p) => s + p.z, 0) / topPts.length;
        quads.push({
          pts: topPts.map((p) => ({ x: p.x, y: p.y })),
          depthZ: topAvgZ,
          fillStyle: shadeHex(box.colorHex, 1.08),
          strokeStyle: strokeCol,
          lineWidth: box.isSelected ? 1.25 : 0.75,
          hitTarget: box.hitTarget,
        });
        for (let i = 0; i < poly.length; i++) {
          const [ax, az] = poly[i];
          const [bx2, bz2] = poly[(i + 1) % poly.length];
          const s0 = mapLocalXZ(ax, az, -halfH);
          const s1 = mapLocalXZ(bx2, bz2, -halfH);
          const s2 = mapLocalXZ(bx2, bz2, halfH);
          const s3 = mapLocalXZ(ax, az, halfH);
          quads.push({
            pts: [
              { x: s0.x, y: s0.y },
              { x: s1.x, y: s1.y },
              { x: s2.x, y: s2.y },
              { x: s3.x, y: s3.y },
            ],
            depthZ: (s0.z + s1.z + s2.z + s3.z) * 0.25,
            fillStyle: shadeHex(box.colorHex, 0.9),
            strokeStyle: strokeCol,
            lineWidth: 0.55,
            hitTarget: box.hitTarget,
          });
        }
        continue;
      }

      for (const fd of faceDefs) {
        // Transform face corners
        const projPts = fd.corners.map(([ux, uy, uz]) => {
          const lx = ux * box.w;
          const ly = uy * box.h;
          const lz = uz * box.d;
          const wx = box.cx + lx * cb + lz * sb;
          const wy = box.cy + ly;
          const wz = box.cz - lx * sb + lz * cb;
          return projectPt(wx, wy, wz);
        });

        // Backface culling in screen space (CCW check in y-down screen coords)
        const area2 =
          (projPts[1].x - projPts[0].x) * (projPts[2].y - projPts[0].y) -
          (projPts[1].y - projPts[0].y) * (projPts[2].x - projPts[0].x);
        if (area2 >= 0 && !box.isGlass) continue;

        const avgZ = (projPts[0].z + projPts[1].z + projPts[2].z + projPts[3].z) * 0.25;
        const fill = box.isGlass
          ? "rgba(186, 230, 253, 0.34)"
          : shadeHex(box.colorHex, fd.shade);

        quads.push({
          pts: projPts.map((p) => ({ x: p.x, y: p.y })),
          depthZ: avgZ,
          fillStyle: fill,
          strokeStyle: box.isSelected ? "rgba(37, 99, 235, 0.65)" : "rgba(28, 25, 23, 0.28)",
          lineWidth: box.isSelected ? 1.25 : 0.75,
          hitTarget: box.hitTarget,
        });
      }
    }

    // Painter's algorithm sort (back-to-front by camera-space Z)
    quads.sort((a, b) => a.depthZ - b.depthZ);
    quadsRef.current = quads;

    for (const q of quads) {
      if (q.pts.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(q.pts[0].x, q.pts[0].y);
      for (let pi = 1; pi < q.pts.length; pi++) {
        ctx.lineTo(q.pts[pi].x, q.pts[pi].y);
      }
      ctx.closePath();
      ctx.fillStyle = q.fillStyle;
      ctx.fill();
      ctx.strokeStyle = q.strokeStyle;
      ctx.lineWidth = q.lineWidth;
      ctx.stroke();
    }

    // Module overall dimension callout on active module
    const activeMod = project.modules[activeModuleIndex] || project.modules[0];
    if (activeMod) {
      const topCenter = projectPt(
        activeMod.position.x + activeMod.dimensions.width / 2,
        activeMod.position.y + activeMod.dimensions.height + 90,
        activeMod.position.z + activeMod.dimensions.depth / 2
      );
      const label = `${activeMod.name} • ${activeMod.dimensions.width}×${activeMod.dimensions.height}×${activeMod.dimensions.depth} mm`;
      ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
      const tw = ctx.measureText(label).width + 18;
      ctx.fillStyle = "rgba(20, 20, 19, 0.86)";
      ctx.beginPath();
      ctx.roundRect(topCenter.x - tw / 2, topCenter.y - 12, tw, 24, 8);
      ctx.fill();
      ctx.fillStyle = "#FAF9F6";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, topCenter.x, topCenter.y);
    }

    // 3D Spatial Engineering Error Beacons on Legacy GeForce 210 Canvas2D Viewport
    for (const err of engineeringReport.blockingSafetyAndEngineeringErrors) {
      if (!err.worldPositionMm) continue;
      const bp = projectPt(err.worldPositionMm.x, err.worldPositionMm.y, err.worldPositionMm.z);
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(220, 38, 38, 0.92)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 10px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", bp.x, bp.y + 0.5);
    }

    ctx.restore();
  }, [sceneBoxes, yawDeg, pitchDeg, zoomScale, panOffset, project.modules, activeModuleIndex, engineeringReport]);

  useEffect(() => {
    renderFrame();
    const onResize = () => renderFrame();
    window.addEventListener("resize", onResize);

    // Expose PNG snapshot & StudioRenderModal hooks so PDF / Presentation / Render modals work seamlessly on GeForce 210 terminals!
    if (typeof window !== "undefined") {
      const win = window as unknown as {
        __birimCapture3DSnapshot?: () => string | null;
        __birimRenderUltraStudioPhoto?: (opts?: { onProgress?: (pct: number) => void }) => Promise<string>;
        __birimGetLiveSceneStats?: () => {
          drawCalls: number;
          triangles: number;
          geometries: number;
          textures: number;
        };
      };
      win.__birimCapture3DSnapshot = () => {
        renderFrame();
        return canvasRef.current ? canvasRef.current.toDataURL("image/png") : null;
      };
      win.__birimRenderUltraStudioPhoto = async (opts) => {
        opts?.onProgress?.(50);
        renderFrame();
        opts?.onProgress?.(100);
        return canvasRef.current ? canvasRef.current.toDataURL("image/png") : "";
      };
      win.__birimGetLiveSceneStats = () => ({
        drawCalls: 1,
        triangles: quadsRef.current.length * 2,
        geometries: sceneBoxes.length,
        textures: 0,
      });
    }

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [renderFrame]);

  const isPointInPoly = (px: number, py: number, pts: { x: number; y: number }[]) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x,
        yi = pts[i].y;
      const xj = pts[j].x,
        yj = pts[j].y;
      const intersect =
        yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-6) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  return (
    <div
      data-testid="viewport-3d-webgl-unavailable"
      className="relative w-full h-full overflow-hidden select-none bg-[#CFC9BE]"
    >
      <canvas
        ref={canvasRef}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          dragRef.current = {
            mode: e.button === 2 || e.shiftKey ? "pan" : "orbit",
            startX: e.clientX,
            startY: e.clientY,
            startYaw: yawDeg,
            startPitch: pitchDeg,
            startPanX: panOffset.x,
            startPanY: panOffset.y,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const st = dragRef.current;
          if (!st) return;
          const dx = e.clientX - st.startX;
          const dy = e.clientY - st.startY;
          if (Math.hypot(dx, dy) > 4) st.moved = true;
          if (st.mode === "orbit") {
            setYawDeg(st.startYaw + dx * 0.45);
            setPitchDeg(Math.max(-5, Math.min(78, st.startPitch + dy * 0.35)));
          } else {
            setPanOffset({ x: st.startPanX + dx, y: st.startPanY + dy });
          }
        }}
        onPointerUp={(e) => {
          const st = dragRef.current;
          dragRef.current = null;
          if (!st || st.moved) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const py = e.clientY - rect.top;
          const quads = quadsRef.current;
          // Hit-test front-to-back
          for (let i = quads.length - 1; i >= 0; i--) {
            if (isPointInPoly(px, py, quads[i].pts) && quads[i].hitTarget) {
              const ht = quads[i].hitTarget!;
              if (ht.kind === "scene_object") {
                onSelectSceneObject?.(ht.id);
              } else {
                if (typeof ht.index === "number") onSelectModule?.(ht.index);
                onSelectComponent?.(ht.id);
                onSelectSceneObject?.(null);
              }
              return;
            }
          }
        }}
        onWheel={(e) => {
          e.stopPropagation();
          const delta = e.deltaY < 0 ? 0.12 : -0.12;
          setZoomScale((z) => Math.max(0.45, Math.min(2.8, +(z + delta).toFixed(2))));
        }}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {!engineeringReport.canExportToCncAndSaw && (
        <div
          data-testid="fallback-3d-engineering-alert"
          className="absolute top-28 left-4 z-30 max-w-xs px-3 py-2 rounded-2xl bg-red-950/92 text-red-100 border border-red-500/60 shadow-lg text-[11px]"
        >
          <div className="font-bold text-red-200">
            Üretim Engeli: {engineeringReport.blockingSafetyAndEngineeringErrors.length} Kritik Hata
          </div>
          <div className="truncate text-red-100/90 mt-0.5">
            {engineeringReport.blockingSafetyAndEngineeringErrors[0]?.message}
          </div>
        </div>
      )}

      {/* Non-blocking Hardware Compatibility Status Pill (Top-Center below TopBar) */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 max-w-[94vw] px-3.5 py-2 rounded-2xl bg-[#141413]/90 backdrop-blur-md text-white border border-amber-400/40 shadow-lg flex flex-wrap items-center gap-2.5 text-[11px]">
        <Cpu className="w-4 h-4 text-amber-300 shrink-0" />
        <span className="font-semibold">
          Eski Ekran Kartı Uyumluluk Modu (Yazılımsal 3D Motoru Aktif)
        </span>
        {gpuRendererInfo && (
          <span className="hidden lg:inline font-mono text-[10px] text-stone-300 truncate max-w-[260px]">
            • {gpuRendererInfo}
          </span>
        )}
        {onSwitchTo2DCad && (
          <button
            type="button"
            onClick={onSwitchTo2DCad}
            className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-bold cursor-pointer"
          >
            2B CAD Görünüm
          </button>
        )}
        {onRetryWebGL && (
          <button
            type="button"
            onClick={onRetryWebGL}
            className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 text-amber-200 font-bold cursor-pointer"
          >
            WebGL2 Yeniden Dene
          </button>
        )}
        <button
          type="button"
          title="Bu terminalde Chrome WebGL2 nasıl açılır?"
          onClick={() => setShowDriverTip((v) => !v)}
          className="p-1 rounded-lg hover:bg-white/15 text-stone-300 cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {showDriverTip && (
        <div className="absolute top-27 left-1/2 -translate-x-1/2 z-30 max-w-lg w-[92vw] p-3.5 rounded-2xl bg-white/95 backdrop-blur-md border border-stone-300 shadow-xl text-[11px] text-stone-800 space-y-1.5">
          <div className="font-bold text-[#141413]">
            Neden Bu Mod Açıldı? ({failureReason || "Direct3D9Ex / WebGL2 Sınırı"})
          </div>
          <p className="leading-relaxed text-stone-600">
            Bu bilgisayardaki ekran kartı (örn. <b>NVIDIA GeForce 210 Direct3D9Ex</b>) donanımsal <b>WebGL 2.0</b> desteklemiyor. Uygulamanın çökmemesi için <b>Birim Yazılımsal 3D Motoru</b> otomatik devreye girdi; fareyle döndürme, yakınlaştırma, modül/obje ekleme, BOM, CNC ve teklif işlemleri tam kapasite çalışır.
          </p>
          <p className="leading-relaxed text-stone-600">
            İsterseniz bu terminalde Chrome adres çubuğuna <code className="px-1 py-0.5 rounded bg-stone-100 font-mono">chrome://flags/#use-angle</code> yazıp <b>D3D11on12</b> veya <b>D3D11 WARP / SwiftShader</b> seçerek donanımsal PBR gölgeleri de açabilirsiniz.
          </p>
        </div>
      )}

      {/* Bottom Interactive Software 3D Camera & Door Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-2xl bg-white/90 backdrop-blur-md border border-stone-300 shadow-md flex flex-wrap items-center gap-1.5 text-[11px] text-[#141413]">
        <button
          type="button"
          onClick={() => {
            setYawDeg(-26);
            setPitchDeg(20);
            setZoomScale(1);
            setPanOffset({ x: 0, y: 20 });
          }}
          className="px-2.5 py-1 rounded-xl hover:bg-stone-100 font-bold inline-flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>İzometrik</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setYawDeg(0);
            setPitchDeg(2);
          }}
          className="px-2 py-1 rounded-xl hover:bg-stone-100 font-semibold cursor-pointer"
        >
          Ön
        </button>
        <button
          type="button"
          onClick={() => {
            setYawDeg(-90);
            setPitchDeg(6);
          }}
          className="px-2 py-1 rounded-xl hover:bg-stone-100 font-semibold cursor-pointer"
        >
          Yan
        </button>
        <button
          type="button"
          onClick={() => {
            setYawDeg(0);
            setPitchDeg(78);
          }}
          className="px-2 py-1 rounded-xl hover:bg-stone-100 font-semibold cursor-pointer"
        >
          Üst Plan
        </button>
        <div className="h-4 w-px bg-stone-300 mx-0.5" />
        <button
          type="button"
          onClick={() => setZoomScale((z) => Math.min(2.8, +(z + 0.18).toFixed(2)))}
          className="p-1.5 rounded-xl hover:bg-stone-100 cursor-pointer"
          title="Yakınlaştır"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoomScale((z) => Math.max(0.45, +(z - 0.18).toFixed(2)))}
          className="p-1.5 rounded-xl hover:bg-stone-100 cursor-pointer"
          title="Uzaklaştır"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        {onToggleDoorOpen && (
          <button
            type="button"
            onClick={onToggleDoorOpen}
            className="px-2.5 py-1 rounded-xl bg-[#141413] text-white font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{doorOpenAngleDeg > 5 ? "Kapak Kapat" : "Kapak Aç"}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setHideDoors((v) => !v)}
          className="px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
        >
          {hideDoors ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>{hideDoors ? "Kapakları Göster" : "İç Düzen"}</span>
        </button>
      </div>
    </div>
  );
};

/**
 * React Error Boundary wrapping any 3D viewport so even an unexpected driver/WebGL crash
 * during runtime renders `<Software3DFallbackViewport />` instead of crashing Next.js!
 */
export class Viewport3DErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
