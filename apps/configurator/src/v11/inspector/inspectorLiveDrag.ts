"use client";
import type { InteriorVisualKind } from "./inspectorSvgIcons";
import React from "react";
import { type MaterialDefinition } from "@birim/core";

export function startLiveMaterialDrag(
  e: React.PointerEvent<HTMLElement>,
  mat: MaterialDefinition,
  onClickFallback: () => void
) {
  if (e.button !== 0) return;
  const startX = e.clientX;
  const startY = e.clientY;
  let dragging = false;
  let swatchEl: HTMLDivElement | null = null;

  const ensureSwatch = () => {
    if (swatchEl || typeof document === "undefined") return;
    const el = document.createElement("div");
    el.setAttribute("data-testid", "live-material-cursor-swatch");
    el.style.position = "fixed";
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.width = "38px";
    el.style.height = "38px";
    el.style.borderRadius = "12px";
    el.style.backgroundColor = mat.colorHex;
    if (mat.hasGrain) {
      el.style.backgroundImage =
        "repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0px, rgba(0,0,0,0.1) 3px, transparent 8px)";
    }
    el.style.border = "2.5px solid #2563EB";
    el.style.boxShadow = "0 10px 24px rgba(20, 20, 19, 0.28)";
    el.style.pointerEvents = "none";
    el.style.zIndex = "99999";
    el.style.willChange = "transform";
    document.body.appendChild(el);
    swatchEl = el;
  };

  const onMove = (ev: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
      dragging = true;
      document.body.dataset.birimUiDragging = "1";
      document.body.style.cursor = "copy";
      ensureSwatch();
    }
    if (swatchEl) {
      swatchEl.style.transform = `translate3d(${Math.round(ev.clientX - 19)}px, ${Math.round(ev.clientY - 19)}px, 0)`;
    }
  };

  const cleanup = () => {
    if (swatchEl) {
      swatchEl.remove();
      swatchEl = null;
    }
    delete document.body.dataset.birimUiDragging;
    document.body.style.cursor = "";
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", cleanup);
  };

  const onUp = (ev: PointerEvent) => {
    const wasDragging = dragging;
    cleanup();
    if (!wasDragging) {
      onClickFallback();
      return;
    }
    window.dispatchEvent(
      new CustomEvent("birim:live-material-drop", {
        detail: {
          materialId: mat.id,
          materialName: mat.name,
          clientX: ev.clientX,
          clientY: ev.clientY,
        },
      })
    );
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", cleanup);
}

export function startLive3DPartGrab(
  e: React.PointerEvent<HTMLElement>,
  spec: { id: string; title: string; visual: string },
  onClickFallback: () => void
) {
  if (e.button !== 0) return;
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  let dragging3D = false;
  let rafId = 0;
  let latestX = startX;
  let latestY = startY;

  const inspectorAside = (e.currentTarget as HTMLElement).closest("aside");
  const sourceBtn = e.currentTarget as HTMLElement;
  let cursorGhostEl: HTMLDivElement | null = null;

  const ensureCursorGhost = () => {
    if (cursorGhostEl || typeof document === "undefined") return;
    const ghost = document.createElement("div");
    ghost.setAttribute("data-testid", "live-part-cursor-ghost");
    ghost.style.position = "fixed";
    ghost.style.left = "0px";
    ghost.style.top = "0px";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "99999";
    ghost.style.filter = "drop-shadow(0 8px 16px rgba(20, 20, 19, 0.24))";
    ghost.style.willChange = "transform";

    const v = spec.visual;
    const isFixed = spec.id === "lib_fixed_shelf";
    let svgMarkup = "";
    if (v === "sub_divider") {
      // 3D isometric miniature vertical divider panel
      svgMarkup = `<svg width="46" height="84" viewBox="0 0 46 84" fill="none">
        <polygon points="8,14 24,4 38,10 22,20" fill="#F5EFE6" stroke="#2563EB" stroke-width="1.5"/>
        <polygon points="8,14 22,20 22,80 8,74" fill="#E6DAC8" stroke="#2563EB" stroke-width="1.5"/>
        <polygon points="22,20 38,10 38,70 22,80" fill="#D5C4AC" stroke="#2563EB" stroke-width="1.5"/>
      </svg>`;
    } else if (v === "wardrobe_lift") {
      // 3D isometric Servetto / Häfele pull-down wardrobe lift (hydraulic side housings + lift arms + top bar + pull wand)
      svgMarkup = `<svg width="118" height="86" viewBox="0 0 118 86" fill="none">
        <!-- Left & right hydraulic side damper housings -->
        <rect x="6" y="42" width="12" height="24" rx="2.5" fill="#1E293B" stroke="#2563EB" stroke-width="1.4"/>
        <circle cx="15" cy="54" r="4.5" fill="#475569" stroke="#94A3B8" stroke-width="1.2"/>
        <rect x="100" y="28" width="12" height="24" rx="2.5" fill="#1E293B" stroke="#2563EB" stroke-width="1.4"/>
        <circle cx="103" cy="40" r="4.5" fill="#475569" stroke="#94A3B8" stroke-width="1.2"/>
        <!-- Telescopic lift arms rising to curved bends -->
        <path d="M16 52 L16 26 Q16 20 22 19 L96 8 Q102 7 102 13 L102 38" fill="none" stroke="#CBD5E1" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16 52 L16 26 Q16 20 22 19 L96 8 Q102 7 102 13 L102 38" fill="none" stroke="#2563EB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Lower dark arm sleeves -->
        <line x1="16" y1="52" x2="16" y2="36" stroke="#334155" stroke-width="5.5" stroke-linecap="round"/>
        <line x1="102" y1="38" x2="102" y2="23" stroke="#334155" stroke-width="5.5" stroke-linecap="round"/>
        <!-- Central swivel collar + vertical pull-down wand + T-handle grip -->
        <rect x="54" y="10" width="10" height="8" rx="2" fill="#1E293B"/>
        <line x1="59" y1="18" x2="59" y2="72" stroke="#E2E8F0" stroke-width="3.4" stroke-linecap="round"/>
        <line x1="59" y1="18" x2="59" y2="72" stroke="#2563EB" stroke-width="1" stroke-linecap="round"/>
        <rect x="46" y="71" width="26" height="6.5" rx="3.2" fill="#1E293B" stroke="#2563EB" stroke-width="1.2"/>
      </svg>`;
    } else if (v === "rail") {
      // 3D isometric chrome hanging rail with end flanges
      svgMarkup = `<svg width="118" height="36" viewBox="0 0 118 36" fill="none">
        <ellipse cx="10" cy="24" rx="5" ry="7" fill="#64748B" stroke="#1E293B" stroke-width="1.4"/>
        <path d="M10 21 L104 7 L108 13 L14 27 Z" fill="#E2E8F0" stroke="#2563EB" stroke-width="1.6"/>
        <ellipse cx="106" cy="10" rx="5" ry="7" fill="#475569" stroke="#1E293B" stroke-width="1.4"/>
      </svg>`;
    } else if (v === "drawer" || v === "internal_drawer") {
      // 3D isometric drawer box with front + handle
      const frontFill = v === "internal_drawer" ? "#EDE7DC" : "#E5D3BA";
      const sideFill = "#CBB597";
      svgMarkup = `<svg width="124" height="64" viewBox="0 0 124 64" fill="none">
        <polygon points="6,20 34,6 118,6 90,20" fill="#F7F3EB" stroke="#2563EB" stroke-width="1.6"/>
        <polygon points="90,20 118,6 118,40 90,56" fill="${sideFill}" stroke="#2563EB" stroke-width="1.6"/>
        <rect x="6" y="20" width="84" height="36" rx="2" fill="${frontFill}" stroke="#2563EB" stroke-width="1.8"/>
        <rect x="34" y="35" width="28" height="4.5" rx="2" fill="#1E293B"/>
      </svg>`;
    } else if (v === "wire_basket") {
      // 3D isometric chrome wire lattice basket
      svgMarkup = `<svg width="124" height="58" viewBox="0 0 124 58" fill="none">
        <polygon points="8,18 32,6 116,6 92,18" fill="rgba(226,232,240,0.28)" stroke="#2563EB" stroke-width="1.8"/>
        <polygon points="8,18 92,18 92,48 8,48" fill="rgba(226,232,240,0.18)" stroke="#2563EB" stroke-width="1.8"/>
        <polygon points="92,18 116,6 116,36 92,48" fill="rgba(148,163,184,0.24)" stroke="#2563EB" stroke-width="1.6"/>
        <line x1="8" y1="33" x2="92" y2="33" stroke="#64748B" stroke-width="1.3"/>
        <line x1="25" y1="18" x2="25" y2="48" stroke="#64748B" stroke-width="1.3"/>
        <line x1="42" y1="18" x2="42" y2="48" stroke="#64748B" stroke-width="1.3"/>
        <line x1="59" y1="18" x2="59" y2="48" stroke="#64748B" stroke-width="1.3"/>
        <line x1="76" y1="18" x2="76" y2="48" stroke="#64748B" stroke-width="1.3"/>
      </svg>`;
    } else if (
      v === "trouser_rack" ||
      v === "shoe_rack" ||
      v === "jewelry_tray" ||
      v === "tie_rack" ||
      v === "waste_bin" ||
      v === "spice_pullout" ||
      v === "pantry_pullout" ||
      v === "corner_lemans"
    ) {
      // 3D isometric pullout rack / tray
      svgMarkup = `<svg width="120" height="44" viewBox="0 0 120 44" fill="none">
        <polygon points="8,18 34,6 114,6 88,18" fill="#E2E8F0" stroke="#2563EB" stroke-width="1.6"/>
        <line x1="28" y1="12" x2="100" y2="12" stroke="#64748B" stroke-width="2"/>
        <rect x="8" y="18" width="80" height="14" rx="2" fill="#CBD5E1" stroke="#2563EB" stroke-width="1.6"/>
        <polygon points="88,18 114,6 114,20 88,32" fill="#94A3B8" stroke="#2563EB" stroke-width="1.6"/>
      </svg>`;
    } else {
      // 3D isometric shelf plank (Hareketli Raf / Sabit Raf)
      const h = isFixed ? 12 : 9;
      svgMarkup = `<svg width="126" height="42" viewBox="0 0 126 42" fill="none">
        <polygon points="6,20 34,6 120,6 92,20" fill="#F6F1E7" stroke="#2563EB" stroke-width="1.6"/>
        <rect x="6" y="20" width="86" height="${h}" rx="1.5" fill="#E6DAC8" stroke="#2563EB" stroke-width="1.7"/>
        <polygon points="92,20 120,6 120,${6 + h} 92,${20 + h}" fill="#CEBCA3" stroke="#2563EB" stroke-width="1.6"/>
      </svg>`;
    }
    ghost.style.transition = "opacity 120ms ease";
    ghost.innerHTML = svgMarkup;
    void sourceBtn;
    document.body.appendChild(ghost);
    cursorGhostEl = ghost;
  };

  const updateCursorGhostPos = (x: number, y: number) => {
    if (!cursorGhostEl) return;
    const w = cursorGhostEl.offsetWidth || 100;
    const h = cursorGhostEl.offsetHeight || 24;
    cursorGhostEl.style.transform = `translate3d(${Math.round(x - w / 2)}px, ${Math.round(y - h / 2)}px, 0)`;
  };

  const flushMove = () => {
    rafId = 0;
    window.dispatchEvent(
      new CustomEvent("birim:live-3d-part-move", {
        detail: {
          id: spec.id,
          title: spec.title,
          visual: spec.visual,
          clientX: latestX,
          clientY: latestY,
        },
      })
    );
  };

  const onSnappedInBay = (ev: Event) => {
    const active = Boolean((ev as CustomEvent<{ active?: boolean }>).detail?.active);
    if (cursorGhostEl) {
      cursorGhostEl.style.opacity = active ? "0" : "1";
    }
  };

  const onMove = (ev: PointerEvent) => {
    latestX = ev.clientX;
    latestY = ev.clientY;
    if (!dragging3D) {
      if (Math.hypot(latestX - startX, latestY - startY) < 6) return;
      dragging3D = true;
      document.body.dataset.birimUiDragging = "1";
      document.body.style.cursor = "grabbing";
      ensureCursorGhost();
      window.addEventListener("birim:live-part-snapped-in-bay", onSnappedInBay);
    }
    updateCursorGhostPos(latestX, latestY);
    if (!rafId) {
      rafId = window.requestAnimationFrame(flushMove);
    }
  };

  const cleanup = () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (cursorGhostEl) {
      cursorGhostEl.remove();
      cursorGhostEl = null;
    }
    delete document.body.dataset.birimUiDragging;
    document.body.style.cursor = "";
    window.removeEventListener("birim:live-part-snapped-in-bay", onSnappedInBay);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKeyDown);
  };

  let dropFinished = false;
  const onCancel = () => {
    if (dropFinished) return;
    dropFinished = true;
    cleanup();
    if (dragging3D) {
      window.dispatchEvent(new CustomEvent("birim:live-3d-part-cancel"));
    }
  };

  const onKeyDown = (ke: KeyboardEvent) => {
    if (ke.key === "Escape") {
      onCancel();
    }
  };

  const onUp = (ev: PointerEvent) => {
    const wasDragging = dragging3D;
    cleanup();
    if (!wasDragging) {
      onClickFallback();
      return;
    }
    // If dropped back onto the right inspector panel itself, cancel instead of placing
    if (inspectorAside) {
      const r = inspectorAside.getBoundingClientRect();
      if (
        ev.clientX >= r.left &&
        ev.clientX <= r.right &&
        ev.clientY >= r.top &&
        ev.clientY <= r.bottom
      ) {
        window.dispatchEvent(new CustomEvent("birim:live-3d-part-cancel"));
        return;
      }
    }
    window.dispatchEvent(
      new CustomEvent("birim:live-3d-part-drop", {
        detail: {
          id: spec.id,
          title: spec.title,
          visual: spec.visual,
          clientX: ev.clientX,
          clientY: ev.clientY,
          dropId: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        },
      })
    );
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKeyDown);
}
