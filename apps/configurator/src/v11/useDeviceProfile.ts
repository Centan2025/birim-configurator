"use client";

import { useEffect, useState } from "react";

export type DeviceTier = "mobile" | "tablet" | "desktop";

export interface DeviceProfile {
  tier: DeviceTier;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  isPortrait: boolean;
  /** Mobile ve tablet ekranlarda (<1200px) sol/sağ çekmeceler birbirini karşılıklı kapatır. */
  singleDrawerOnly: boolean;
}

const SSR_DEFAULT_PROFILE: DeviceProfile = {
  tier: "desktop",
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouch: false,
  isPortrait: false,
  singleDrawerOnly: false,
};

function computeDeviceProfile(): DeviceProfile {
  if (typeof window === "undefined") return SSR_DEFAULT_PROFILE;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const tier: DeviceTier = w < 768 ? "mobile" : w < 1200 ? "tablet" : "desktop";
  const isTouch =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window
      : false;
  return {
    tier,
    isMobile: tier === "mobile",
    isTablet: tier === "tablet",
    isDesktop: tier === "desktop",
    isTouch,
    isPortrait: h > w,
    singleDrawerOnly: tier !== "desktop",
  };
}

/**
 * SSR-güvenli (hydration mismatch üretmeyen) 3 kırılımlı cihaz ve dokunmatik profil kancası.
 * Masaüstü (>=1200px) davranışını korurken tablet (768-1199px) ve mobil (<768px) yerleşimlerini ayırır.
 */
export function useDeviceProfile(): DeviceProfile {
  const [profile, setProfile] = useState<DeviceProfile>(SSR_DEFAULT_PROFILE);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let rafId: number | null = null;
    const sync = () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const next = computeDeviceProfile();
        setProfile((prev) =>
          prev.tier === next.tier &&
          prev.isTouch === next.isTouch &&
          prev.isPortrait === next.isPortrait
            ? prev
            : next
        );
      });
    };

    sync();
    window.addEventListener("resize", sync, { passive: true });
    window.addEventListener("orientationchange", sync, { passive: true });
    const mq =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)")
        : null;
    mq?.addEventListener?.("change", sync);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      mq?.removeEventListener?.("change", sync);
    };
  }, []);

  return profile;
}
