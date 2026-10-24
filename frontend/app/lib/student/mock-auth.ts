import { readStorage, writeStorage } from "./storage";

export const DEMO_ENABLED = process.env.NODE_ENV === "development";
export const DEMO_PASSWORD = "Decode123!";
const accountsKey = "decode-demo-accounts-v1";
const sessionKey = "decode-demo-session-v1";
const aliasPattern = /^[a-z][a-z0-9-]{1,24}$/;
export type DemoStudent = { id: string; label: string; email: string };
function requireDemo() { if (!DEMO_ENABLED) throw new Error("Demo accounts are disabled outside development."); }
export function demoAlias(email: string) {
  const match = /^([a-z][a-z0-9-]{1,24})@example\.test$/.exec(email.trim().toLowerCase());
  if (!match) throw new Error("Use a fictional address such as learner@example.test. Real email addresses are not accepted.");
  return match[1];
}
function aliases(): string[] {
  const stored = readStorage<unknown>(localStorage, accountsKey, []);
  return ["student", ...Array.isArray(stored) ? stored.filter((v): v is string => typeof v === "string" && aliasPattern.test(v) && v !== "student") : []];
}
function student(alias: string): DemoStudent { return { id: alias, label: `Learner ${alias}`, email: `${alias}@example.test` }; }
export function restoreSession(): DemoStudent | null {
  if (!DEMO_ENABLED) return null;
  const id = readStorage<unknown>(localStorage, sessionKey, null) ?? readStorage<unknown>(sessionStorage, sessionKey, null);
  return typeof id === "string" && aliases().includes(id) ? student(id) : null;
}
export function authenticateDemo(email: string, password: string, register: boolean, remember: boolean): DemoStudent {
  requireDemo();
  const id = demoAlias(email);
  if (password !== DEMO_PASSWORD) throw new Error(`Use the public demo passphrase ${DEMO_PASSWORD}. Never enter a real password.`);
  const all = aliases();
  if (register && all.includes(id)) throw new Error("This demo address is already registered in this browser. Sign in instead.");
  if (!register && !all.includes(id)) throw new Error("Demo account not found. Register this fictional address first, or use student@example.test.");
  if (register) writeStorage(localStorage, accountsKey, [...all.filter((v) => v !== "student"), id]);
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
  writeStorage(remember ? localStorage : sessionStorage, sessionKey, id);
  return student(id);
}
export function logoutDemo() {
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
}
