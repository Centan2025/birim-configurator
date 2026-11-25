"use client";
import React from "react";
import { type V11CatalogGroup } from "../v11Constants";

export type KitchenSubFilterId = "all" | "base" | "wall" | "tall" | "corner";
export type WardrobeSubFilterId = "all" | "hinged" | "sliding" | "corner_open";

export function renderPrimaryGroupVisualSvg(id: V11CatalogGroup["id"], active: boolean) {
  const fillTone = active ? "#F8FAFC" : "#E2E8F0";
  const accentTone = active ? "#BAE6FD" : "#94A3B8";
  const strokeTone = active ? "#FFFFFF" : "#0F172A";
  return (
    <svg viewBox="0 0 36 26" className="w-11 h-8 shrink-0" fill="none" aria-hidden="true">
      {id === "wardrobe" && (
        <>
          <rect x="7" y="2.5" width="22" height="21" rx="1.8" fill={fillTone} stroke={strokeTone} strokeWidth="1.4" />
          <line x1="18" y1="2.5" x2="18" y2="23.5" stroke={strokeTone} strokeWidth="1.2" />
          <line x1="15.8" y1="10" x2="15.8" y2="15" stroke={strokeTone} strokeWidth="1.4" strokeLinecap="round" />
          <line x1="20.2" y1="10" x2="20.2" y2="15" stroke={strokeTone} strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {id === "kitchen" && (
        <>
          {/* Upper cabinet */}
          <rect x="5" y="3" width="17" height="7" rx="1.2" fill={accentTone} stroke={strokeTone} strokeWidth="1.3" />
          <line x1="13.5" y1="3" x2="13.5" y2="10" stroke={strokeTone} strokeWidth="1" />
          {/* Tall tower right */}
          <rect x="23.5" y="3" width="7.5" height="20.5" rx="1.2" fill={fillTone} stroke={strokeTone} strokeWidth="1.3" />
          {/* Countertop + Base */}
          <line x1="4" y1="14" x2="22.5" y2="14" stroke={strokeTone} strokeWidth="1.8" strokeLinecap="round" />
          <rect x="5" y="14.5" width="17" height="9" rx="1" fill={fillTone} stroke={strokeTone} strokeWidth="1.3" />
          <line x1="5" y1="19" x2="22" y2="19" stroke={strokeTone} strokeWidth="1" />
        </>
      )}
      {id === "living" && (
        <>
          {/* Wall TV */}
          <rect x="9" y="3.5" width="18" height="9.5" rx="1.4" fill="#334155" stroke={strokeTone} strokeWidth="1.3" />
          {/* Low Floating / Plinth Console */}
          <rect x="4" y="16" width="28" height="6.5" rx="1.2" fill={fillTone} stroke={strokeTone} strokeWidth="1.3" />
          <line x1="13.3" y1="16" x2="13.3" y2="22.5" stroke={strokeTone} strokeWidth="1.1" />
          <line x1="22.6" y1="16" x2="22.6" y2="22.5" stroke={strokeTone} strokeWidth="1.1" />
        </>
      )}
      {id === "objects" && (
        <>
          {/* Appliance + Table Silhouette */}
          <rect x="5" y="4" width="11" height="19" rx="1.5" fill={accentTone} stroke={strokeTone} strokeWidth="1.3" />
          <rect x="7" y="7" width="7" height="5" rx="0.8" fill="#1E293B" />
          <ellipse cx="25.5" cy="14" rx="6.5" ry="2.6" fill={fillTone} stroke={strokeTone} strokeWidth="1.3" />
          <line x1="21.5" y1="16" x2="20.5" y2="23" stroke={strokeTone} strokeWidth="1.3" strokeLinecap="round" />
          <line x1="29.5" y1="16" x2="30.5" y2="23" stroke={strokeTone} strokeWidth="1.3" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function renderKitchenSubFilterSvg(kind: KitchenSubFilterId, active: boolean) {
  const cabFill = active ? "#F1F5F9" : "#E2E8F0";
  const strk = active ? "#FFFFFF" : "#0F172A";
  const muted = active ? "#A8A29E" : "#A8A29E";
  return (
    <svg viewBox="0 0 34 26" className="w-10 h-7 shrink-0" fill="none" aria-hidden="true">
      {kind === "all" && (
        <>
          <rect x="5" y="3" width="15" height="6.5" rx="1" fill={cabFill} stroke={strk} strokeWidth="1.25" />
          <rect x="5" y="14.5" width="15" height="8.5" rx="1" fill={cabFill} stroke={strk} strokeWidth="1.25" />
          <line x1="4" y1="14" x2="21" y2="14" stroke={strk} strokeWidth="1.6" />
          <rect x="22" y="3" width="7" height="20" rx="1" fill={cabFill} stroke={strk} strokeWidth="1.25" />
        </>
      )}
      {kind === "base" && (
        <>
          <rect x="6" y="3" width="22" height="5" rx="1" stroke={muted} strokeWidth="1" strokeDasharray="2 2" />
          <line x1="4.5" y1="12" x2="29.5" y2="12" stroke={strk} strokeWidth="2" strokeLinecap="round" />
          <rect x="6" y="12.5" width="22" height="9.5" rx="1" fill={cabFill} stroke={strk} strokeWidth="1.35" />
          <line x1="17" y1="12.5" x2="17" y2="22" stroke={strk} strokeWidth="1.1" />
          <rect x="7.5" y="22" width="19" height="2" fill={strk} opacity="0.7" />
        </>
      )}
      {kind === "wall" && (
        <>
          <rect x="6" y="2.5" width="22" height="10" rx="1.2" fill={cabFill} stroke={strk} strokeWidth="1.35" />
          <line x1="17" y1="2.5" x2="17" y2="12.5" stroke={strk} strokeWidth="1.1" />
          <line x1="8" y1="13.8" x2="26" y2="13.8" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="5" y1="21.5" x2="29" y2="21.5" stroke={muted} strokeWidth="1.3" strokeDasharray="2.5 2" />
        </>
      )}
      {kind === "tall" && (
        <>
          <rect x="10" y="2.5" width="14" height="20.5" rx="1.3" fill={cabFill} stroke={strk} strokeWidth="1.35" />
          <rect x="12" y="9" width="10" height="5.5" rx="0.8" fill="#1E293B" />
          <line x1="10" y1="16.5" x2="24" y2="16.5" stroke={strk} strokeWidth="1.1" />
        </>
      )}
      {kind === "corner" && (
        <>
          <polygon points="6,13 15,6 29,6 29,17 18,17 12,22 6,22" fill={cabFill} stroke={strk} strokeWidth="1.3" strokeLinejoin="round" />
          <polyline points="6,13 12,13 18,8 29,8" stroke={strk} strokeWidth="1.1" />
          <line x1="18" y1="8" x2="18" y2="17" stroke={strk} strokeWidth="1.2" />
        </>
      )}
    </svg>
  );
}

export function renderWardrobeSubFilterSvg(kind: WardrobeSubFilterId, active: boolean) {
  const cabFill = active ? "#F1F5F9" : "#E2E8F0";
  const strk = active ? "#FFFFFF" : "#0F172A";
  return (
    <svg viewBox="0 0 34 24" className="w-10 h-7 shrink-0" fill="none" aria-hidden="true">
      {kind === "all" && (
        <>
          <rect x="5" y="2.5" width="24" height="19" rx="1.4" fill={cabFill} stroke={strk} strokeWidth="1.3" />
          <line x1="13" y1="2.5" x2="13" y2="21.5" stroke={strk} strokeWidth="1.1" />
          <line x1="21" y1="2.5" x2="21" y2="21.5" stroke={strk} strokeWidth="1.1" />
        </>
      )}
      {kind === "hinged" && (
        <>
          <rect x="7" y="2.5" width="20" height="19" rx="1.4" fill={cabFill} stroke={strk} strokeWidth="1.3" />
          <line x1="17" y1="2.5" x2="17" y2="21.5" stroke={strk} strokeWidth="1.2" />
          <line x1="15" y1="10" x2="15" y2="14" stroke={strk} strokeWidth="1.4" strokeLinecap="round" />
          <line x1="19" y1="10" x2="19" y2="14" stroke={strk} strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {kind === "sliding" && (
        <>
          <rect x="5" y="2.5" width="24" height="19" rx="1.4" fill={cabFill} stroke={strk} strokeWidth="1.3" />
          <line x1="17" y1="2.5" x2="17" y2="21.5" stroke={strk} strokeWidth="1.1" />
          <path d="M9 12h4m-1.5-1.5L13 12l-1.5 1.5M25 12h-4m1.5-1.5L21 12l1.5 1.5" stroke={strk} strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
      {kind === "corner_open" && (
        <>
          <rect x="6" y="2.5" width="22" height="19" rx="1.4" fill="#F5F1E8" stroke={strk} strokeWidth="1.3" />
          <line x1="8" y1="7.5" x2="26" y2="7.5" stroke={strk} strokeWidth="1.3" />
          <line x1="8" y1="15" x2="26" y2="15" stroke={strk} strokeWidth="1.1" />
          <path d="M14 7.5l-2.5 4h5L14 7.5zM21 7.5l-2.5 4h5L21 7.5z" stroke={strk} strokeWidth="1" />
        </>
      )}
    </svg>
  );
}
