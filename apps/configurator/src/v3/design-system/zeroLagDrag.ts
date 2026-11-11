import type React from "react";

/**
 * Universal 120-FPS requestAnimationFrame-coalesced GPU `translate3d` drag handler
 * for any floating modal, popover, or inspector shell.
 * - Clears Tailwind v4 standalone `translate` property so centered shells NEVER jump left on click.
 * - Marks `data-birim-dragging="1"` so background WebGL raycasts, tooltips & heavy blur passes pause mid-drag.
 */
export function startZeroLagModalDrag(
  e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
  targetSelector = "[data-draggable-shell]"
): void {
  if ("button" in e && e.button !== 0) return;
  const target = e.target as HTMLElement | null;
  if (
    target?.closest(
      "button, input, select, textarea, a, label, [role='button'], [data-no-drag]"
    )
  ) {
    return;
  }

  const handleEl = e.currentTarget as HTMLElement;
  const shellEl =
    (handleEl.closest(targetSelector) as HTMLElement | null) ||
    (handleEl.parentElement as HTMLElement | null);
  if (!shellEl) return;

  e.preventDefault();
  e.stopPropagation();

  const curTx = Number(shellEl.dataset.dragTx || "0") || 0;
  const curTy = Number(shellEl.dataset.dragTy || "0") || 0;
  const startClientX = e.clientX;
  const startClientY = e.clientY;
  const rect = shellEl.getBoundingClientRect();

  const minDx = Math.min(0, -rect.left + 8);
  const maxDx = Math.max(0, window.innerWidth - rect.right - 8);
  const minDy = Math.min(0, -rect.top + 8);
  const maxDy = Math.max(0, window.innerHeight - Math.min(rect.bottom, rect.top + 72) - 8);

  const prevTransition = shellEl.style.transition;
  shellEl.style.transition = "none";
  shellEl.style.willChange = "transform";
  shellEl.style.translate = "none";
  shellEl.dataset.birimDragging = "1";
  document.body.dataset.birimUiDragging = "1";

  const pointerId = "pointerId" in e ? e.pointerId : undefined;
  if (pointerId !== undefined && typeof handleEl.setPointerCapture === "function") {
    try {
      handleEl.setPointerCapture(pointerId);
    } catch {
      // ignore synthetic events
    }
  }

  const prevCursor = document.body.style.cursor;
  document.body.style.cursor = "grabbing";

  let latestX = startClientX;
  let latestY = startClientY;
  let rafId = 0;

  const commitFrame = () => {
    rafId = 0;
    const rawDx = latestX - startClientX;
    const rawDy = latestY - startClientY;
    const clampedDx = Math.max(minDx, Math.min(maxDx, rawDx));
    const clampedDy = Math.max(minDy, Math.min(maxDy, rawDy));
    const nextTx = Math.round(curTx + clampedDx);
    const nextTy = Math.round(curTy + clampedDy);
    shellEl.dataset.dragTx = String(nextTx);
    shellEl.dataset.dragTy = String(nextTy);
    shellEl.style.transform = `translate3d(${nextTx}px, ${nextTy}px, 0)`;
  };

  const scheduleUpdate = (cx: number, cy: number) => {
    latestX = cx;
    latestY = cy;
    if (!rafId) {
      rafId = window.requestAnimationFrame(commitFrame);
    }
  };

  const onPointerMove = (pe: PointerEvent) => {
    scheduleUpdate(pe.clientX, pe.clientY);
  };
  const onMouseMove = (me: MouseEvent) => {
    scheduleUpdate(me.clientX, me.clientY);
  };

  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      commitFrame();
    }
    delete shellEl.dataset.birimDragging;
    delete document.body.dataset.birimUiDragging;
    document.body.style.cursor = prevCursor;
    shellEl.style.willChange = "auto";
    shellEl.style.transition = prevTransition;
    if (pointerId !== undefined && typeof handleEl.releasePointerCapture === "function") {
      try {
        handleEl.releasePointerCapture(pointerId);
      } catch {
        // ignore
      }
    }
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", cleanup);
    window.removeEventListener("pointercancel", cleanup);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", cleanup);
  };

  if (pointerId !== undefined) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  } else {
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseup", cleanup);
  }
}
