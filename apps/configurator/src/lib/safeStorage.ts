/**
 * BİRİM Studio — Güvenli Tarayıcı Depolama Sarmalayıcısı (safeStorage)
 *
 * iPad/iPhone Safari Gizli Modu ve üçüncü parti iframe embed ortamlarında
 * `window.localStorage` erişiminin `SecurityError` veya `QuotaExceededError`
 * fırlatıp uygulamayı çökertmesini engeller; hata durumunda RAM yedeğine düşer.
 */

const memoryFallback = new Map<string, string>();

export function safeLocalStorageGet(key: string): string | null {
  if (typeof window === "undefined") return memoryFallback.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

export function safeLocalStorageSet(key: string, value: string): boolean {
  memoryFallback.set(key, value);
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeLocalStorageRemove(key: string): void {
  memoryFallback.delete(key);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
