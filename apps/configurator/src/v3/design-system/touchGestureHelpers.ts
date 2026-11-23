/**
 * BİRİM Studio — Birleşik Dokunmatik & İşaretçi (Unified Pointer) Yardımcıları
 *
 * Masaüstü fare etkileşimlerini (pointerType === "mouse") hiçbir şekilde etkilemeden:
 * 1. Dokunmatik uzun basma (450ms long-press -> sağ tık / bağlamsal menü),
 * 2. 2B SVG CAD için iki parmak yakınlaştırma & kaydırma (pinch-to-zoom + midpoint pan),
 * 3. Ters-zoom SVG tutamaç dokunma yarıçapı (inverse-zoom hit radius) sağlar.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface LongPressController {
  start: (e: { pointerType?: string; isPrimary?: boolean; clientX: number; clientY: number; target?: EventTarget | null }) => void;
  move: (e: { pointerType?: string; clientX: number; clientY: number }) => void;
  cancel: () => void;
}

export function createLongPressController(
  onTrigger: (clientX: number, clientY: number, target: EventTarget | null) => void,
  options?: { delayMs?: number; moveThresholdPx?: number }
): LongPressController {
  const delayMs = options?.delayMs ?? 450;
  const moveThresholdPx = options?.moveThresholdPx ?? 8;
  let timerId: number | null = null;
  let origin: Point2D | null = null;
  let originTarget: EventTarget | null = null;

  const cancel = () => {
    if (timerId !== null && typeof window !== "undefined") {
      window.clearTimeout(timerId);
    }
    timerId = null;
    origin = null;
    originTarget = null;
  };

  return {
    start(e) {
      if (e.pointerType !== "touch" || e.isPrimary === false) return;
      cancel();
      origin = { x: e.clientX, y: e.clientY };
      originTarget = e.target ?? null;
      if (typeof window === "undefined") return;
      timerId = window.setTimeout(() => {
        const pt = origin;
        const tgt = originTarget;
        cancel();
        if (!pt) return;
        try {
          if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            navigator.vibrate(12);
          }
        } catch {
          // ignore vibration unsupported
        }
        onTrigger(pt.x, pt.y, tgt);
      }, delayMs);
    },
    move(e) {
      if (!origin || e.pointerType !== "touch") return;
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > moveThresholdPx) {
        cancel();
      }
    },
    cancel,
  };
}

export interface PinchFrameDelta {
  scaleRatio: number;
  panDx: number;
  panDy: number;
  midX: number;
  midY: number;
}

export interface TwoFingerPinchTracker {
  pointerDown: (pointerId: number, x: number, y: number) => void;
  pointerMove: (pointerId: number, x: number, y: number) => PinchFrameDelta | null;
  pointerUp: (pointerId: number) => void;
  clear: () => void;
  isPinching: () => boolean;
  count: () => number;
}

export function createTwoFingerPinchTracker(): TwoFingerPinchTracker {
  const active = new Map<number, Point2D>();
  let lastDist: number | null = null;
  let lastMid: Point2D | null = null;

  const readPair = (): { dist: number; mid: Point2D } | null => {
    if (active.size < 2) return null;
    const it = active.values();
    const p1 = it.next().value as Point2D;
    const p2 = it.next().value as Point2D;
    return {
      dist: Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
      mid: { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 },
    };
  };

  return {
    pointerDown(pointerId, x, y) {
      active.set(pointerId, { x, y });
      const pair = readPair();
      if (pair) {
        lastDist = pair.dist;
        lastMid = pair.mid;
      }
    },
    pointerMove(pointerId, x, y) {
      if (!active.has(pointerId)) return null;
      active.set(pointerId, { x, y });
      const pair = readPair();
      if (!pair || lastDist === null || !lastMid) return null;
      const delta: PinchFrameDelta = {
        scaleRatio: pair.dist / lastDist,
        panDx: pair.mid.x - lastMid.x,
        panDy: pair.mid.y - lastMid.y,
        midX: pair.mid.x,
        midY: pair.mid.y,
      };
      lastDist = pair.dist;
      lastMid = pair.mid;
      return delta;
    },
    pointerUp(pointerId) {
      active.delete(pointerId);
      if (active.size < 2) {
        lastDist = null;
        lastMid = null;
      } else {
        const pair = readPair();
        if (pair) {
          lastDist = pair.dist;
          lastMid = pair.mid;
        }
      }
    },
    clear() {
      active.clear();
      lastDist = null;
      lastMid = null;
    },
    isPinching() {
      return active.size >= 2;
    },
    count() {
      return active.size;
    },
  };
}

/**
 * 2B SVG CAD tutamaçlarının uzaklaştırma (zoom-out) sırasında dokunmatik ekranda
 * küçülüp yakalanamaz hale gelmesini önleyen ters-zoom dokunma yarıçapı.
 */
export function computeInverseZoomHitRadius(
  baseSvgUnits: number,
  zoom: number,
  minCssPx = 22
): number {
  const safeZoom = Math.max(0.25, zoom || 1);
  return Math.max(baseSvgUnits, minCssPx / safeZoom);
}
