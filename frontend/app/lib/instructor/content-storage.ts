import { isIsoTimestamp } from "./dates";

type DraftDates = { version: 1; activityId: string; createdAt: string; updatedAt: string };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
// Validate each content extension independently. A broken quiz must not discard
// valid Theory drafts or the catalog, and future formats must remain untouched.
export function decodeDraftStore<T extends DraftDates>(extension: unknown, activityIds: Set<string>, validate: (value: unknown, id: string) => value is T): { store?: { version: 1; drafts: Record<string, T> }; recovery: "none" | "malformed" | "unsupported" } {
  if (extension === undefined) return { recovery: "none" };
  if (object(extension) && (typeof extension.version === "number" && extension.version !== 1 || object(extension.drafts) && Object.values(extension.drafts).some(d => object(d) && typeof d.version === "number" && d.version !== 1))) return { recovery: "unsupported" };
  if (!object(extension) || extension.version !== 1 || !object(extension.drafts)) return { recovery: "malformed" };
  const entries: [string, T][] = [];
  for (const [id, value] of Object.entries(extension.drafts)) {
    if (activityIds.has(id) && validate(value, id) && isIsoTimestamp(value.createdAt) && isIsoTimestamp(value.updatedAt)) entries.push([id, { ...value, createdAt: new Date(value.createdAt).toISOString(), updatedAt: new Date(value.updatedAt).toISOString() }]);
  }
  return { store: { version: 1, drafts: Object.fromEntries(entries) }, recovery: entries.length === Object.keys(extension.drafts).length ? "none" : "malformed" };
}
