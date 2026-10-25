// Browser-local learning records and preferences only. Never store backend
// session tokens or passwords here.
export function readStorage<T>(storage: Storage, key: string, fallback: T): T {
  try { const value = storage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
export function writeStorage(storage: Storage, key: string, value: unknown) {
  storage.setItem(key, JSON.stringify(value)); // Let callers report quota / privacy-mode failures.
}
