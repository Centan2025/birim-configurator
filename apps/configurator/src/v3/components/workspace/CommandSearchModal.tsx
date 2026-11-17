"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Star, Clock, X, ArrowRight } from "lucide-react";

export interface CommandPaletteAction {
  id: string;
  labelTr: string;
  categoryTr: string;
  keywords: string;
  shortcut?: string;
  onExecute: () => void;
}

interface CommandSearchModalProps {
  isOpen: boolean;
  actions: CommandPaletteAction[];
  onClose: () => void;
}

const FAV_STORAGE_KEY = "birim_cmd_favorites_v1";
const RECENT_STORAGE_KEY = "birim_cmd_recent_v1";

/**
 * Görev Odaklı Komut Arama, Favori Araçlar ve Son Kullanılan İşlemler Paleti (Ctrl+K).
 * Araç kalabalığını gizlerken hiçbir profesyonel özelliği ulaşılmaz bırakmaz.
 */
export const CommandSearchModal: React.FC<CommandSearchModalProps> = React.memo(
  ({ isOpen, actions, onClose }) => {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
    const [recentIds, setRecentIds] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (!isOpen || typeof window === "undefined") return;
      try {
        const fav = JSON.parse(window.localStorage.getItem(FAV_STORAGE_KEY) || "[]");
        const rec = JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) || "[]");
        if (Array.isArray(fav)) setFavoriteIds(fav);
        if (Array.isArray(rec)) setRecentIds(rec);
      } catch {
        // Ignore storage read error
      }
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }, [isOpen]);

    const filteredActions = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) {
        const favSet = new Set(favoriteIds);
        const recSet = new Set(recentIds);
        return [...actions].sort((a, b) => {
          const aScore = (favSet.has(a.id) ? 4 : 0) + (recSet.has(a.id) ? 2 : 0);
          const bScore = (favSet.has(b.id) ? 4 : 0) + (recSet.has(b.id) ? 2 : 0);
          return bScore - aScore;
        });
      }
      return actions.filter(
        (act) =>
          act.labelTr.toLowerCase().includes(q) ||
          act.categoryTr.toLowerCase().includes(q) ||
          act.keywords.toLowerCase().includes(q)
      );
    }, [actions, query, favoriteIds, recentIds]);

    const toggleFavorite = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setFavoriteIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        try {
          window.localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore
        }
        return next;
      });
    };

    const runAction = (act: CommandPaletteAction) => {
      setRecentIds((prev) => {
        const next = [act.id, ...prev.filter((x) => x !== act.id)].slice(0, 8);
        try {
          window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore
        }
        return next;
      });
      onClose();
      act.onExecute();
    };

    if (!isOpen) return null;

    return (
      <div
        data-testid="command-search-modal"
        onClick={onClose}
        className="fixed inset-0 z-[190] flex items-start justify-center pt-[11vh] bg-[#141413]/45 backdrop-blur-xs p-4"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-w-xl w-full rounded-3xl bg-[#FAF9F6] border border-[#DED8CC] shadow-2xl overflow-hidden text-[#141413]"
        >
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#EAE5DC] bg-white">
            <Search className="w-4 h-4 text-[#8C7A6B] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  onClose();
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedIndex((i) => Math.min(filteredActions.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedIndex((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter" && filteredActions[selectedIndex]) {
                  e.preventDefault();
                  runAction(filteredActions[selectedIndex]);
                }
              }}
              placeholder="Komut, modül, görünüm veya üretim aracı ara... (örn. Gola, Kesim, Tel Kafes, CNC)"
              className="flex-1 text-sm font-medium bg-transparent outline-hidden placeholder:text-[#8C7A6B]"
            />
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-[#F5F3EE] text-[#57534E] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-2 space-y-1">
            {filteredActions.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#57534E]">
                Aramanızla eşleşen işlem bulunamadı.
              </div>
            ) : (
              filteredActions.map((act, idx) => {
                const isFav = favoriteIds.includes(act.id);
                const isRec = recentIds.includes(act.id);
                const isSel = idx === selectedIndex;
                return (
                  <div
                    key={act.id}
                    onClick={() => runAction(act)}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-2xl cursor-pointer transition ${
                      isSel ? "bg-[#141413] text-white" : "hover:bg-[#EFECE5]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(act.id, e)}
                        title="Favori araçlara ekle/çıkar"
                        className="p-0.5 cursor-pointer shrink-0"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            isFav
                              ? "fill-amber-400 text-amber-400"
                              : isSel
                              ? "text-stone-400"
                              : "text-[#8C7A6B]"
                          }`}
                        />
                      </button>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate flex items-center gap-1.5">
                          <span>{act.labelTr}</span>
                          {isRec && !query && (
                            <span
                              className={`inline-flex items-center gap-0.5 text-[9.5px] font-medium px-1.5 py-0.2 rounded-full ${
                                isSel ? "bg-white/15 text-stone-200" : "bg-[#EAE5DC] text-[#57534E]"
                              }`}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              Son
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-[10.5px] truncate ${
                            isSel ? "text-stone-300" : "text-[#57534E]"
                          }`}
                        >
                          {act.categoryTr}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {act.shortcut && (
                        <kbd
                          className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] border ${
                            isSel
                              ? "border-white/25 bg-white/10 text-stone-200"
                              : "border-[#DED8CC] bg-white text-[#57534E]"
                          }`}
                        >
                          {act.shortcut}
                        </kbd>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 opacity-70" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }
);
CommandSearchModal.displayName = "CommandSearchModal";
