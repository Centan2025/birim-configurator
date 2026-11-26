"use client";

import React, { useCallback, useMemo } from "react";
import * as THREE from "three";
import { DEFAULT_MATERIALS } from "../../adapter/useV3Adapter";
import { calculateFourSpaceDimensions } from "@birim/core";
import { type DimensionAnchor } from "./viewport3DSceneHelpers";

import type { UseViewport3DCalloutProjectionsCtx } from "./viewport3DTypes";

export function useViewport3DCalloutProjections(ctx: UseViewport3DCalloutProjectionsCtx) {
  const { activeBayIndex, activeBayWorldAnchorRef, activeDoorWorldAnchorRef, activeModuleIndex, bayPopoverDomRef, canvasRectRef, contextPopoverDomRef, controlsRef, customLabelOffsetsRef, dimLabelDomMapRef, dimPopoverDomRef, dimWorldAnchorsRef, displayUnit, dockedToCornerRef, doorPopoverDomRef, effectiveShowDimensions, floatingPanelPosRef, hardwareCatalog, hwCalloutDomMapRef, hwWorldAnchorsRef, isSimpleTier, labelScale3DRef, liveDimDeltaRef, matCalloutDomMapRef, matWorldAnchorsRef, mountRef, needsRenderRef, perspCamRef, project, rendererRef, selectedComponentId, setCustomLabelTick, setFloatingPanelPos, stageSafeInsetsRef } = ctx;
    const startFloatingPanelDrag = useCallback(
      (
        panelKey: "bay" | "door" | "dim" | "context",
        e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>
      ) => {
        if ("button" in e && e.button !== 0) return;
        if ((e.target as HTMLElement).closest("button, input, select, textarea, a, label")) return;
        e.preventDefault();
        e.stopPropagation();

        const domMap: Record<"bay" | "door" | "dim" | "context", HTMLDivElement | null> = {
          bay: bayPopoverDomRef.current,
          door: doorPopoverDomRef.current,
          dim: dimPopoverDomRef.current,
          context: contextPopoverDomRef.current,
        };
        const cardEl =
          domMap[panelKey] ||
          (e.currentTarget.closest("[data-floating-card]") as HTMLDivElement | null) ||
          (e.currentTarget.parentElement as HTMLDivElement | null);
        const containerEl = mountRef.current?.parentElement;
        if (!cardEl || !containerEl) return;

        // Freeze any CSS transitions immediately so position snap & cursor tracking have 0.0ms lag!
        cardEl.style.transition = "none";
        cardEl.style.willChange = "transform";

        const cRect = containerEl.getBoundingClientRect();
        const kRect = cardEl.getBoundingClientRect();
        const cardW = kRect.width || cardEl.offsetWidth || 260;
        const cardH = kRect.height || cardEl.offsetHeight || 48;

        // Exact offset from card's top-left corner to pointer cursor (prevents any initial jump!)
        const grabOffsetX = e.clientX - kRect.left;
        const grabOffsetY = e.clientY - kRect.top;
        const initX = Math.round(kRect.left - cRect.left);
        const initY = Math.round(kRect.top - cRect.top);

        // Normalize card anchor to (0,0) + clear Tailwind v4 `translate: -50%` so it NEVER shifts left on click!
        cardEl.style.left = "0px";
        cardEl.style.top = "0px";
        cardEl.style.right = "auto";
        cardEl.style.bottom = "auto";
        cardEl.style.translate = "none";
        cardEl.style.transform = `translate3d(${initX}px, ${initY}px, 0)`;
        floatingPanelPosRef.current = {
          ...floatingPanelPosRef.current,
          [panelKey]: { x: initX, y: initY },
        };

        const handleEl = e.currentTarget as HTMLElement;
        const pointerId = "pointerId" in e ? e.pointerId : undefined;
        if (pointerId !== undefined && typeof handleEl.setPointerCapture === "function") {
          try {
            handleEl.setPointerCapture(pointerId);
          } catch {
            // ignore synthetic events
          }
        }

        const prevBodyCursor = document.body.style.cursor;
        document.body.style.cursor = "grabbing";

        const applyMove = (clientX: number, clientY: number) => {
          const liveCRect = containerEl.getBoundingClientRect();
          const maxX = Math.max(8, liveCRect.width - cardW - 8);
          const maxY = Math.max(8, liveCRect.height - cardH - 8);
          const nx = Math.round(Math.max(8, Math.min(maxX, clientX - liveCRect.left - grabOffsetX)));
          const ny = Math.round(Math.max(8, Math.min(maxY, clientY - liveCRect.top - grabOffsetY)));
          floatingPanelPosRef.current[panelKey] = { x: nx, y: ny };
          cardEl.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
        };

        const onPointerMove = (pe: PointerEvent) => {
          pe.preventDefault();
          applyMove(pe.clientX, pe.clientY);
        };
        const onMouseMove = (me: MouseEvent) => {
          applyMove(me.clientX, me.clientY);
        };

        let cleanedUp = false;
        const finishDrag = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          document.body.style.cursor = prevBodyCursor;
          cardEl.style.willChange = "auto";
          if (pointerId !== undefined && typeof handleEl.releasePointerCapture === "function") {
            try {
              handleEl.releasePointerCapture(pointerId);
            } catch {
              // ignore
            }
          }
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", finishDrag);
          window.removeEventListener("pointercancel", finishDrag);
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", finishDrag);
          // Commit to React state ONLY ONCE on release so zero re-renders occur mid-drag!
          const finalPos = floatingPanelPosRef.current[panelKey];
          if (finalPos) {
            setFloatingPanelPos((prev) => ({ ...prev, [panelKey]: { ...finalPos } }));
          }
        };

        if (pointerId !== undefined) {
          window.addEventListener("pointermove", onPointerMove, { passive: false });
          window.addEventListener("pointerup", finishDrag);
          window.addEventListener("pointercancel", finishDrag);
        } else {
          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", finishDrag);
        }
      },
      []
    );

    const startCalloutBadgeDrag = useCallback(
      (badgeId: string, e: React.MouseEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const cur = customLabelOffsetsRef.current[badgeId] || { dx: 0, dy: 0 };
        let moved = false;

        const onMove = (me: MouseEvent) => {
          const dX = me.clientX - startClientX;
          const dY = me.clientY - startClientY;
          if (!moved && Math.hypot(dX, dY) < 4) return;
          moved = true;
          customLabelOffsetsRef.current[badgeId] = {
            dx: cur.dx + dX,
            dy: cur.dy + dY,
          };
          // Update projected label positions directly on next animation frame without full React re-render!
          needsRenderRef.current = true;
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (moved) {
            window.__birimSuppressNextClick = Date.now();
            setCustomLabelTick((t) => t + 1);
          }
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      },
      []
    );

    const dimLabels = useMemo<DimensionAnchor[]>(() => {
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!effectiveShowDimensions || !mod) return [];
      const { width: W, height: H, depth: D } = mod.dimensions;
      const T = mod.carcass.panelThickness || 18;
      const soketW = Math.max(200, W - 2 * T);
      const list: DimensionAnchor[] = [
        {
          id: "dim_W",
          tag: "Genişlik",
          valueText: displayUnit === "cm" ? `${Number((W / 10).toFixed(1))} cm` : `${Math.round(W)} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#141413",
          localMidpoint: new THREE.Vector3(W * 0.5, H + 195, D * 0.85),
          localStart: new THREE.Vector3(0, H + 195, D * 0.85),
          localEnd: new THREE.Vector3(W, H + 195, D * 0.85),
        },
        {
          id: "dim_H",
          tag: "Yükseklik",
          valueText: displayUnit === "cm" ? `${Number((H / 10).toFixed(1))} cm` : `${Math.round(H)} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#141413",
          localMidpoint: new THREE.Vector3(W + 175, H * 0.52, D),
          localStart: new THREE.Vector3(W + 175, 0, D),
          localEnd: new THREE.Vector3(W + 175, H, D),
        },
        {
          id: "dim_D",
          tag: "Derinlik",
          valueText: displayUnit === "cm" ? `${Number((D / 10).toFixed(1))} cm` : `${Math.round(D)} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#57534E",
          localMidpoint: new THREE.Vector3(-145, 18, D * 0.5),
          localStart: new THREE.Vector3(-145, 18, 0),
          localEnd: new THREE.Vector3(-145, 18, D),
        },
      ];

      if (!isSimpleTier) {
        list.push({
          id: "dim_SOKET",
          tag: "İç Net Genişlik",
          valueText: displayUnit === "cm" ? `${Number((soketW / 10).toFixed(1))} cm` : `${Math.round(soketW)} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#57534E",
          localMidpoint: new THREE.Vector3(W * 0.5, 8, D + 120),
          localStart: new THREE.Vector3(T, 8, D + 120),
          localEnd: new THREE.Vector3(W - T, 8, D + 120),
        });
      }

      if (mod.category !== "complementary" && mod.bays.length >= 1) {
        const fs = calculateFourSpaceDimensions(mod);
        const bayWidths = fs.usableInternal.bayClearWidthsMm;
        const plinthH = mod.carcass.plinthHeight ?? 100;
        const innerBotY = plinthH + T;
        const innerTopY = H - T;
        let curX = T;
        mod.bays.forEach((b, bIdx) => {
          const bw = bayWidths[bIdx] || Math.round((W - (mod.bays.length + 1) * T) / mod.bays.length);
          const midX = curX + bw * 0.5;
          // SketchUp-style contextual declutter: Kolay modda yalnızca aktif bölme genişliği gösterilir
          if (!isSimpleTier || bIdx === activeBayIndex) {
            list.push({
              id: `dim_BAY_${bIdx}`,
              tag: `${bIdx + 1}. Bölme`,
              valueText: displayUnit === "cm" ? `${Number((bw / 10).toFixed(1))} cm` : `${Math.round(bw)} mm`,
              borderColor: "#D6D0C4",
              badgeBg: "#141413",
              localMidpoint: new THREE.Vector3(midX, H + 34, D * 0.94),
              localStart: new THREE.Vector3(curX, H + 34, D * 0.94),
              localEnd: new THREE.Vector3(curX + bw, H + 34, D * 0.94),
            });
          }

          // Seçili raf için canlı Üst / Alt Net Boşluk ölçüleri
          if (bIdx === activeBayIndex && selectedComponentId) {
            const visibleShelves = (b.shelves || [])
              .filter((sh) => !sh.isHidden)
              .sort((a, z) => (a.elevationY ?? 0) - (z.elevationY ?? 0));
            const selIdx = visibleShelves.findIndex((sh) => sh.id === selectedComponentId);
            if (selIdx >= 0) {
              const selShelf = visibleShelves[selIdx];
              const shelfT = selShelf.thickness || T;
              const shelfBotY = plinthH + T + (selShelf.elevationY ?? 0);
              const shelfTopY = shelfBotY + shelfT;
              const prevTopY =
                selIdx > 0
                  ? plinthH + T + (visibleShelves[selIdx - 1].elevationY ?? 0) + (visibleShelves[selIdx - 1].thickness || T)
                  : innerBotY;
              const nextBotY =
                selIdx < visibleShelves.length - 1
                  ? plinthH + T + (visibleShelves[selIdx + 1].elevationY ?? 0)
                  : innerTopY;
              const gapBelow = Math.max(0, Math.round(shelfBotY - prevTopY));
              const gapAbove = Math.max(0, Math.round(nextBotY - shelfTopY));
              const fmtGap = (mm: number) =>
                displayUnit === "cm" ? `${Number((mm / 10).toFixed(1))} cm` : `${mm} mm`;

              if (gapAbove >= 40) {
                list.push({
                  id: "dim_SHELF_GAP_ABOVE",
                  tag: "Üst Boşluk",
                  valueText: fmtGap(gapAbove),
                  borderColor: "#93C5FD",
                  badgeBg: "#1D4ED8",
                  localMidpoint: new THREE.Vector3(midX, shelfTopY + gapAbove * 0.5, D + 26),
                  localStart: new THREE.Vector3(midX, shelfTopY, D + 26),
                  localEnd: new THREE.Vector3(midX, nextBotY, D + 26),
                });
              }
              if (gapBelow >= 40) {
                list.push({
                  id: "dim_SHELF_GAP_BELOW",
                  tag: "Alt Boşluk",
                  valueText: fmtGap(gapBelow),
                  borderColor: "#93C5FD",
                  badgeBg: "#1D4ED8",
                  localMidpoint: new THREE.Vector3(midX, prevTopY + gapBelow * 0.5, D + 26),
                  localStart: new THREE.Vector3(midX, prevTopY, D + 26),
                  localEnd: new THREE.Vector3(midX, shelfBotY, D + 26),
                });
              }
            }
          }
          curX += bw + T;
        });
      }

      const mainMods = project.modules.filter((m) => m.category !== "complementary");
      if (mainMods.length > 1) {
        const minX = Math.min(...mainMods.map((m) => m.position.x));
        const maxX = Math.max(...mainMods.map((m) => m.position.x + m.dimensions.width));
        const maxH = Math.max(...mainMods.map((m) => m.position.y + m.dimensions.height));
        const spanMm = Math.round(maxX - minX);
        list.push({
          id: "dim_TOTAL_SPAN",
          tag: "Toplam Genişlik",
          valueText: displayUnit === "cm" ? `${Number((spanMm / 10).toFixed(1))} cm` : `${Math.round(spanMm)} mm`,
          borderColor: "#D6D0C4",
          badgeBg: "#141413",
          localMidpoint: new THREE.Vector3((minX + maxX) * 0.5, maxH + 260, 300),
          localStart: new THREE.Vector3(minX, maxH + 260, 300),
          localEnd: new THREE.Vector3(maxX, maxH + 260, 300),
        });
      }

      return list;
    }, [project, activeModuleIndex, activeBayIndex, selectedComponentId, effectiveShowDimensions, isSimpleTier, displayUnit]);

    const hwCallouts = useMemo(() => {
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!mod || mod.category === "complementary") return [];
      const { width: W, height: H, depth: D } = mod.dimensions;
      const T = mod.carcass.panelThickness || 18;
      const plinthH = mod.carcass.plinthHeight ?? 100;
      const fs = calculateFourSpaceDimensions(mod);
      const bayWidths = fs.usableInternal.bayClearWidthsMm;

      const bayStartXs: number[] = [];
      let accX = T;
      mod.bays.forEach((_, idx) => {
        bayStartXs.push(accX);
        accX += (bayWidths[idx] || 550) + T;
      });

      const targetBayIdx = Math.min(activeBayIndex, Math.max(0, mod.bays.length - 1));
      const targetBay = mod.bays[targetBayIdx] || mod.bays[0];
      const dSys = targetBay?.door?.doorSystemId || "hinged_single";
      const doorHwId = targetBay?.door?.hardwareProductId || "hw_blum_71b3550";
      const doorHw = hardwareCatalog.find((h) => h.id === doorHwId);

      // 1. Hinge / Door Mechanism Callout
      const hingeLeaveSpec = fs.doorLeaves[0] || fs.doorLeaves[targetBayIdx];
      const topHingeY =
        hingeLeaveSpec?.hingePositionsY?.[hingeLeaveSpec.hingePositionsY.length - 1] ||
        Math.round((H - plinthH - 2 * T) * 0.76);
      const isSlidingSys = dSys.startsWith("sliding");
      const slideMount =
        dSys === "sliding_coplanar"
          ? "coplanar_flush"
          : mod.carcass.slidingMountingType || targetBay?.door?.slidingMountingType || "top_hung_pelmet";
      const hingeTitle = dSys.startsWith("hinged")
        ? "Menteşe"
        : isSlidingSys
        ? "Sürgü Sistemi"
        : "Açılma Sistemi";
      const hingeSub = isSlidingSys
        ? slideMount === "inset_inside"
          ? "Häfele Slido F-Line21 (İçten)"
          : slideMount === "top_hung_exposed"
          ? "Hettich TopLine XL (Açık Ray)"
          : slideMount === "coplanar_flush"
          ? "Hettich InLine XL (Koplanar)"
          : "Hettich TopLine XL (Alın Kapamalı)"
        : doorHw
        ? doorHw.id === "hw_blum_71b3550"
          ? "Blum Clip-Top 110°"
          : doorHw.id === "hw_blum_71b7550"
          ? "Blum Clip-Top 155°"
          : doorHw.id === "hw_hettich_9071205"
          ? "Hettich Sensys 110°"
          : doorHw.id === "hw_salice_c7p6ae9"
          ? "Salice Silentia+ 110°"
          : `${doorHw.manufacturerName.split(" ")[0]} • ${doorHw.sku}`
        : "Blum Clip-Top 110°";

      // 2. LED Lighting Callout
      const hasLed = mod.bays.some((b) =>
        (b.specialFittings || []).some((f) => f.type.startsWith("led_"))
      );
      const ledKelvin = mod.carcass.ledColorTempK || 3000;
      const midBayIdx = Math.min(Math.floor(mod.bays.length / 2), mod.bays.length - 1);
      const midBayCenterX =
        (bayStartXs[midBayIdx] || T) + (bayWidths[midBayIdx] || 550) * 0.5;

      // 3. Hanging Rail / Interior Mechanism Callout
      const railBayIdx =
        mod.bays.findIndex((b) => b.hangingRails.length > 0) >= 0
          ? mod.bays.findIndex((b) => b.hangingRails.length > 0)
          : targetBayIdx;
      const railObj = mod.bays[railBayIdx]?.hangingRails?.[0];
      const hasWardrobeLift = mod.bays.some((b) =>
        (b.specialFittings || []).some((f) => f.type === "wardrobe_lift")
      );
      const railElevY = railObj?.elevationY || Math.round((H - plinthH - 2 * T) * 0.78);
      const railCenterX =
        (bayStartXs[railBayIdx] || T) + (bayWidths[railBayIdx] || 550) * 0.58;

      // 4. Drawer Runner Callout
      const drwBayIdx =
        mod.bays.findIndex((b) => b.drawers.length > 0) >= 0
          ? mod.bays.findIndex((b) => b.drawers.length > 0)
          : mod.bays.length - 1;
      const firstDrw = mod.bays[drwBayIdx]?.drawers?.[0];
      const drwHwId = firstDrw?.hardwareProductId || "hw_blum_tandembox_m30";
      const drwHw = hardwareCatalog.find((h) => h.id === drwHwId);
      const drwNl =
        firstDrw?.nominalLengthMm ||
        Math.min(550, Math.max(350, Math.floor((fs.usableInternal.netInnerDepthMm - 10) / 50) * 50));
      const runnerSub = drwHw
        ? drwHw.id.includes("tandembox")
          ? `Blum Tandem ${drwNl} mm`
          : drwHw.id.includes("movento")
          ? `Blum Movento ${drwNl} mm`
          : drwHw.id.includes("hettich")
          ? `Hettich AvanTech ${drwNl} mm`
          : `Blum LEGRABOX ${drwNl} mm`
        : `Blum Tandem ${drwNl} mm`;
      const drwElevY = firstDrw ? firstDrw.elevationY + firstDrw.height * 0.5 : 180;
      const drwPinX = (bayStartXs[drwBayIdx] || T) + 24;

      const hasDoor =
        !mod.isOpenFront &&
        targetBay?.door &&
        targetBay.door.type !== "open" &&
        targetBay.door.doorSystemId !== "open";
      const hasAnyRail =
        Boolean(railObj) ||
        hasWardrobeLift ||
        mod.bays.some((b) => b.hangingRails && b.hangingRails.length > 0);
      const hasAnyDrawer =
        Boolean(firstDrw) ||
        mod.bays.some((b) => b.drawers && b.drawers.length > 0);

      const activeCallouts: {
        id: string;
        group: "hinge" | "lighting" | "accessories" | "runner";
        bayIndex: number;
        title: string;
        subtitle: string;
        sku: string;
        localPos: THREE.Vector3;
        offsetPx: [number, number];
      }[] = [];

      if (hasDoor) {
        activeCallouts.push({
          id: "hw_pin_hinge",
          group: "hinge",
          bayIndex: targetBayIdx,
          title: hingeTitle,
          subtitle: hingeSub,
          sku: doorHw?.sku || "71B3550",
          localPos: new THREE.Vector3(T + 12, plinthH + T + topHingeY, D + 14),
          offsetPx: [-24, -44],
        });
      }

      if (hasLed) {
        activeCallouts.push({
          id: "hw_pin_led",
          group: "lighting",
          bayIndex: midBayIdx,
          title: "LED Aydınlatma",
          subtitle: `Profil – ${ledKelvin}K`,
          sku: "833.74.700",
          localPos: new THREE.Vector3(midBayCenterX, H - T - 14, D * 0.82),
          offsetPx: [42, -38],
        });
      }

      if (hasAnyRail) {
        activeCallouts.push({
          id: "hw_pin_rail",
          group: "accessories",
          bayIndex: railBayIdx,
          title: "Askılık",
          subtitle: hasWardrobeLift ? "Servetto Asansör 10kg" : "Oval – Krom",
          sku: hasWardrobeLift ? "805.20.232" : "HW_HANGING_RAIL",
          localPos: new THREE.Vector3(railCenterX, plinthH + T + railElevY, D * 0.62),
          offsetPx: [52, 22],
        });
      }

      if (hasAnyDrawer) {
        activeCallouts.push({
          id: "hw_pin_runner",
          group: "runner",
          bayIndex: drwBayIdx,
          title: "Çekmece Rayı",
          subtitle: runnerSub,
          sku: drwHw?.sku || "578.5001M",
          localPos: new THREE.Vector3(drwPinX, plinthH + T + drwElevY, D * 0.88),
          offsetPx: [48, -32],
        });
      }

      return activeCallouts;
    }, [project, activeModuleIndex, activeBayIndex, hardwareCatalog]);

    const matCallouts = useMemo(() => {
      const mod = project.modules[activeModuleIndex] || project.modules[0];
      if (!mod || mod.category === "complementary") return [];
      const { width: W, height: H, depth: D } = mod.dimensions;
      const T = mod.carcass.panelThickness || 18;
      const plinthH = mod.carcass.plinthHeight ?? 100;
      const overrides = mod.componentMaterialOverrides || {};

      const formatShortMat = (matId?: string) => {
        const m = DEFAULT_MATERIALS.find((it) => it.id === matId) || DEFAULT_MATERIALS[0];
        const shortName = m.name
          .replace(/^Kastamonu Entegre\s+/i, "")
          .replace(/^Yıldız Entegre\s+/i, "")
          .replace(/^Çamsan Entegre\s+/i, "")
          .replace(/^AGT\s+/i, "")
          .split(" (")[0];
        return {
          label: shortName,
          colorHex: m.colorHex,
          matId: m.id,
        };
      };

      const topCompId = `${mod.id}_top`;
      const topMat = formatShortMat(overrides[topCompId] || mod.carcass.bodyMaterialId);

      const firstBay = mod.bays[0];
      const doorCompId = `${firstBay?.door?.id || `${mod.id}_door_0`}_${
        firstBay?.door?.type === "double" ? "leaf_left" : "left"
      }`;
      const doorMat = formatShortMat(
        overrides[doorCompId] || firstBay?.door?.doorMaterialId || mod.carcass.doorMaterialId
      );

      const rightSideCompId = `${mod.id}_side_right`;
      const rightSideMat = formatShortMat(overrides[rightSideCompId] || mod.carcass.bodyMaterialId);

      const drwBay = mod.bays.find((b) => b.drawers.length > 0) || firstBay;
      const firstDrw = drwBay?.drawers?.[0];
      const drwFrontId = firstDrw ? `${firstDrw.id}_front` : `${mod.id}_drw_0_front`;
      const drwMat = formatShortMat(
        overrides[drwFrontId] || firstDrw?.frontMaterialId || mod.carcass.doorMaterialId
      );

      const plinthCompId = `${mod.id}_plinth`;
      const plinthMat = formatShortMat(
        overrides[plinthCompId] ||
          overrides.__plinth__ ||
          mod.carcass.plinthMaterialId ||
          mod.carcass.bodyMaterialId
      );

      return [
        {
          id: "mat_pin_top",
          scope: "carcass" as const,
          componentId: topCompId,
          title: "Üst Tabla",
          subtitle: topMat.label,
          colorHex: topMat.colorHex,
          localPos: new THREE.Vector3(W * 0.45, H - T * 0.5, D * 0.85),
          offsetPx: [-10, -48] as [number, number],
        },
        {
          id: "mat_pin_door",
          scope: "doors" as const,
          componentId: doorCompId,
          title: "Kapak",
          subtitle: doorMat.label,
          colorHex: doorMat.colorHex,
          localPos: new THREE.Vector3(W * 0.24, H * 0.65, D + 18),
          offsetPx: [-24, -46] as [number, number],
        },
        {
          id: "mat_pin_side_right",
          scope: "selected_part" as const,
          componentId: rightSideCompId,
          title: "Sağ Yan Panel",
          subtitle: rightSideMat.label,
          colorHex: rightSideMat.colorHex,
          localPos: new THREE.Vector3(W, H * 0.45, D * 0.55),
          offsetPx: [18, -36] as [number, number],
        },
        {
          id: "mat_pin_drawer",
          scope: "drawers" as const,
          componentId: drwFrontId,
          title: "Çekmece Önü",
          subtitle: drwMat.label,
          colorHex: drwMat.colorHex,
          localPos: new THREE.Vector3(W * 0.42, plinthH + 140, D + 18),
          offsetPx: [-85, -42] as [number, number],
        },
        {
          id: "mat_pin_plinth",
          scope: "plinth" as const,
          componentId: plinthCompId,
          title: "Soket",
          subtitle: plinthMat.label,
          colorHex: plinthMat.colorHex,
          localPos: new THREE.Vector3(W * 0.36, Math.max(20, plinthH * 0.5), D - 10),
          offsetPx: [-12, 16] as [number, number],
        },
      ];
    }, [project, activeModuleIndex]);

    const updateProjectedDimensionLabels = useCallback(() => {
      const curRenderer = rendererRef.current;
      const cam = (controlsRef.current?.object as THREE.Camera) || perspCamRef.current;
      if (!curRenderer || !cam) return;
      const cachedRect = canvasRectRef.current;
      const w = cachedRect && cachedRect.width > 0 ? cachedRect.width : curRenderer.domElement.clientWidth;
      const h = cachedRect && cachedRect.height > 0 ? cachedRect.height : curRenderer.domElement.clientHeight;
      if (w === 0 || h === 0) return;

      cam.updateMatrixWorld();
      const placed: { id: string; x: number; y: number; angleDeg: number; visible: boolean }[] = [];

      const { dx: dimDx, dz: dimDz } = liveDimDeltaRef.current;
      for (const item of dimWorldAnchorsRef.current) {
        const anchorPos = item.isActiveMod && (dimDx !== 0 || dimDz !== 0)
          ? new THREE.Vector3(item.worldPos.x + dimDx, item.worldPos.y, item.worldPos.z + dimDz)
          : item.worldPos.clone();
        const ndc = anchorPos.project(cam);
        if (ndc.z > 1) {
          placed.push({ id: item.id, x: 0, y: 0, angleDeg: 0, visible: false });
          continue;
        }
        let angleDeg = 0;
        if (item.worldStart && item.worldEnd) {
          const pA = item.isActiveMod && (dimDx !== 0 || dimDz !== 0)
            ? new THREE.Vector3(item.worldStart.x + dimDx, item.worldStart.y, item.worldStart.z + dimDz)
            : item.worldStart.clone();
          const pB = item.isActiveMod && (dimDx !== 0 || dimDz !== 0)
            ? new THREE.Vector3(item.worldEnd.x + dimDx, item.worldEnd.y, item.worldEnd.z + dimDz)
            : item.worldEnd.clone();
          const ndcA = pA.project(cam);
          const ndcB = pB.project(cam);
          const sx1 = (ndcA.x + 1) * 0.5 * w;
          const sy1 = (-ndcA.y + 1) * 0.5 * h;
          const sx2 = (ndcB.x + 1) * 0.5 * w;
          const sy2 = (-ndcB.y + 1) * 0.5 * h;
          const ldx = sx2 - sx1;
          const ldy = sy2 - sy1;
          if (Math.hypot(ldx, ldy) > 10) {
            angleDeg = (Math.atan2(ldy, ldx) * 180) / Math.PI;
            if (angleDeg > 90) angleDeg -= 180;
            if (angleDeg < -90) angleDeg += 180;
          }
        }
        const rawX = (ndc.x + 1) * 0.5 * w;
        const rawY = (-ndc.y + 1) * 0.5 * h;
        let x = Math.max(72, Math.min(w - 72, rawX));
        let y = Math.max(64, Math.min(h - 68, rawY));

        // SketchUp-style 2-pass screen-space de-overlap so labels never stack on top of each other
        for (let pass = 0; pass < 2; pass += 1) {
          for (const prev of placed) {
            if (!prev.visible) continue;
            if (Math.abs(x - prev.x) < 120 && Math.abs(y - prev.y) < 30) {
              y = prev.y + (y >= prev.y ? 34 : -34);
              y = Math.max(68, Math.min(h - 74, y));
            }
          }
        }
        placed.push({ id: item.id, x, y, angleDeg, visible: true });
      }

      for (const p of placed) {
        const el = dimLabelDomMapRef.current.get(p.id);
        if (!el) continue;
        if (!p.visible) {
          el.style.opacity = "0";
        } else {
          const uOff = customLabelOffsetsRef.current[p.id] || { dx: 0, dy: 0 };
          el.style.opacity = "1";
          el.style.transform = `translate3d(${Math.round(p.x + uOff.dx)}px, ${Math.round(p.y + uOff.dy)}px, 0) translate(-50%, -50%) rotate(${p.angleDeg.toFixed(1)}deg) scale(${labelScale3DRef.current})`;
        }
      }

      if (bayPopoverDomRef.current) {
        const customBayPos = floatingPanelPosRef.current.bay;
        if (customBayPos) {
          bayPopoverDomRef.current.style.opacity = "1";
          bayPopoverDomRef.current.style.transform = `translate3d(${customBayPos.x}px, ${customBayPos.y}px, 0)`;
        } else if (dockedToCornerRef.current) {
          const rInset = stageSafeInsetsRef.current?.rightPx ?? 16;
          const tInset = stageSafeInsetsRef.current?.topPx ?? 14;
          const dockX = Math.max(16, w - rInset - 296);
          const dockY = Math.max(68, tInset + 54);
          bayPopoverDomRef.current.style.opacity = "1";
          bayPopoverDomRef.current.style.transform = `translate3d(${Math.round(dockX)}px, ${dockY}px, 0)`;
        } else if (activeBayWorldAnchorRef.current) {
          const ndc = activeBayWorldAnchorRef.current.clone().project(cam);
          if (ndc.z > 1) {
            bayPopoverDomRef.current.style.opacity = "0";
          } else {
            const px = Math.max(120, Math.min(w - 304, (ndc.x + 1) * 0.5 * w + 54));
            const py = Math.max(80, Math.min(h - 240, (-ndc.y + 1) * 0.5 * h - 120));
            bayPopoverDomRef.current.style.opacity = "1";
            bayPopoverDomRef.current.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0)`;
          }
        }
      }
      if (doorPopoverDomRef.current) {
        const customDoorPos = floatingPanelPosRef.current.door;
        if (customDoorPos) {
          doorPopoverDomRef.current.style.opacity = "1";
          doorPopoverDomRef.current.style.transform = `translate3d(${customDoorPos.x}px, ${customDoorPos.y}px, 0)`;
        } else if (dockedToCornerRef.current) {
          const rInset = stageSafeInsetsRef.current?.rightPx ?? 16;
          const tInset = stageSafeInsetsRef.current?.topPx ?? 14;
          const dockX = Math.max(16, w - rInset - 296);
          const dockY = Math.max(68, tInset + 54);
          doorPopoverDomRef.current.style.opacity = "1";
          doorPopoverDomRef.current.style.transform = `translate3d(${Math.round(dockX)}px, ${dockY}px, 0)`;
        } else if (activeDoorWorldAnchorRef.current) {
          const ndc = activeDoorWorldAnchorRef.current.clone().project(cam);
          if (ndc.z > 1) {
            doorPopoverDomRef.current.style.opacity = "0";
          } else {
            const px = Math.max(120, Math.min(w - 304, (ndc.x + 1) * 0.5 * w + 18));
            const py = Math.max(80, Math.min(h - 240, (-ndc.y + 1) * 0.5 * h - 120));
            doorPopoverDomRef.current.style.opacity = "1";
            doorPopoverDomRef.current.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0)`;
          }
        }
      }
      for (const hwAnchor of hwWorldAnchorsRef.current) {
        const el = hwCalloutDomMapRef.current.get(hwAnchor.id);
        if (!el) continue;
        const ndc = hwAnchor.worldPos.clone().project(cam);
        if (ndc.z > 1) {
          el.style.opacity = "0";
        } else {
          const uOff = customLabelOffsetsRef.current[hwAnchor.id] || { dx: 0, dy: 0 };
          const px = Math.max(45, Math.min(w - 110, (ndc.x + 1) * 0.5 * w + uOff.dx));
          const py = Math.max(45, Math.min(h - 65, (-ndc.y + 1) * 0.5 * h + uOff.dy));
          el.style.opacity = "1";
          el.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0) scale(${labelScale3DRef.current})`;
        }
      }
      for (const matAnchor of matWorldAnchorsRef.current) {
        const el = matCalloutDomMapRef.current.get(matAnchor.id);
        if (!el) continue;
        const ndc = matAnchor.worldPos.clone().project(cam);
        if (ndc.z > 1) {
          el.style.opacity = "0";
        } else {
          const uOff = customLabelOffsetsRef.current[matAnchor.id] || { dx: 0, dy: 0 };
          const px = Math.max(45, Math.min(w - 110, (ndc.x + 1) * 0.5 * w + uOff.dx));
          const py = Math.max(45, Math.min(h - 65, (-ndc.y + 1) * 0.5 * h + uOff.dy));
          el.style.opacity = "1";
          el.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0) scale(${labelScale3DRef.current})`;
        }
      }
    }, []);

  return {
    startFloatingPanelDrag,
    startCalloutBadgeDrag,
    dimLabels,
    hwCallouts,
    matCallouts,
    updateProjectedDimensionLabels,
  };
}
