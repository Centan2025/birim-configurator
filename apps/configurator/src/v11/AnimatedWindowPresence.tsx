"use client";

import React, { useEffect, useState } from "react";

export interface AnimatedModalPresenceProps {
  isOpen: boolean;
  durationMs?: number;
  children: (renderOpen: boolean) => React.ReactNode;
}

/**
 * Keeps any modal/dialog mounted during its closing animation (`durationMs`) while passing
 * `renderOpen = true` to the child modal so inner `if (!isOpen) return null` guards do not
 * prematurely unmount the DOM before the smooth CSS exit transition finishes.
 */
export const AnimatedModalPresence: React.FC<AnimatedModalPresenceProps> = ({
  isOpen,
  durationMs = 230,
  children,
}) => {
  const [shouldRender, setShouldRender] = useState<boolean>(isOpen);
  const [phase, setPhase] = useState<"entering" | "open" | "exiting">(
    isOpen ? "open" : "exiting"
  );

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setPhase("entering");
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          setPhase("open");
        });
        return () => cancelAnimationFrame(raf2);
      });
      return () => cancelAnimationFrame(raf1);
    }

    setPhase("exiting");
    const timer = setTimeout(() => {
      setShouldRender(false);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [isOpen, durationMs]);

  if (!shouldRender) return null;

  return (
    <div
      data-birim-modal-stage={phase}
      className="birim-animated-modal-stage"
    >
      {children(true)}
    </div>
  );
};

export interface AnimatedPopoverPresenceProps {
  isOpen: boolean;
  origin?: "top" | "bottom" | "top-right" | "top-left" | "bottom-center" | "left";
  durationMs?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Smooth spring-eased open AND close animation wrapper for floating popovers, dropdown menus,
 * and floating docks so no floating panel ever snaps in or out abruptly.
 */
export const AnimatedPopoverPresence: React.FC<AnimatedPopoverPresenceProps> = ({
  isOpen,
  origin = "top-left",
  durationMs = 190,
  className = "",
  style,
  children,
}) => {
  const [mounted, setMounted] = useState<boolean>(isOpen);
  const [visible, setVisible] = useState<boolean>(isOpen);
  const [settled, setSettled] = useState<boolean>(isOpen);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setSettled(false);
      let raf2 = 0;
      let settleTimer = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setVisible(true);
          settleTimer = window.setTimeout(() => setSettled(true), durationMs + 20);
        });
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
        if (settleTimer) window.clearTimeout(settleTimer);
      };
    }

    setSettled(false);
    setVisible(false);
    const t = setTimeout(() => {
      setMounted(false);
    }, durationMs);
    return () => clearTimeout(t);
  }, [isOpen, durationMs]);

  if (!mounted) return null;

  const originClass =
    origin === "left"
      ? "origin-left"
      : origin === "bottom" || origin === "bottom-center"
      ? "origin-bottom"
      : origin === "top-right"
      ? "origin-top-right"
      : origin === "top-left"
      ? "origin-top-left"
      : "origin-top";

  const hiddenTransform =
    origin === "left"
      ? "opacity-0 scale-[0.96] -translate-x-4 pointer-events-none"
      : origin === "bottom" || origin === "bottom-center"
      ? "opacity-0 scale-y-[0.94] translate-y-1.5 pointer-events-none"
      : "opacity-0 scale-y-[0.94] -translate-y-1.5 pointer-events-none";

  const visibleTransform =
    origin === "left"
      ? "opacity-100 scale-100 translate-x-0"
      : "opacity-100 scale-y-100 translate-y-0";

  // V92: Calm, overshoot-free unfold (zero upward bounce/jump), dropping transform once settled for true frosted glass!
  const animClasses =
    visible && settled
      ? ""
      : `${originClass} transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          visible ? visibleTransform : hiddenTransform
        }`;

  return (
    <div style={style} className={`${animClasses} ${className}`.trim()}>
      {children}
    </div>
  );
};


export interface AnimatedValuePresenceProps<T> {
  value: T | null | undefined;
  durationMs?: number;
  children: (latchedValue: T) => React.ReactNode;
}

/**
 * Latches the last non-null value during the smooth exit transition so modals/popovers
 * driven by nullable tab/target state (`bomModalTab`, `sceneHubTab`, `hardwareSwapTarget`)
 * animate closed cleanly without losing their props mid-exit.
 */
export function AnimatedValuePresence<T>({
  value,
  durationMs = 230,
  children,
}: AnimatedValuePresenceProps<T>): React.ReactElement | null {
  const [latched, setLatched] = useState<T | null>(value ?? null);
  const isOpen = value !== null && value !== undefined;

  useEffect(() => {
    if (value !== null && value !== undefined) {
      setLatched(value);
    }
  }, [value]);

  if (latched === null) return null;

  return (
    <AnimatedModalPresence isOpen={isOpen} durationMs={durationMs}>
      {() => children(latched)}
    </AnimatedModalPresence>
  );
}
