import { readStorage, writeStorage } from "./storage";

export const profileAvatars = [
  { id: "owl", label: "Owl", background: "#e5edff", ink: "#315db5" },
  { id: "fox", label: "Fox", background: "#fce8da", ink: "#a14d26" },
  { id: "bot", label: "Robot", background: "#dcefe9", ink: "#296a57" },
  { id: "cat", label: "Cat", background: "#eee5fa", ink: "#75529c" },
  { id: "panda", label: "Panda", background: "#e4ecec", ink: "#36585c" },
  { id: "bear", label: "Bear", background: "#f3e8dc", ink: "#916440" },
  { id: "penguin", label: "Penguin", background: "#e0edf8", ink: "#355b80" },
  { id: "frog", label: "Frog", background: "#e5efda", ink: "#567641" },
  { id: "rabbit", label: "Rabbit", background: "#f7e5ee", ink: "#a15b7e" },
  { id: "koala", label: "Koala", background: "#e8eaf3", ink: "#626e96" },
  { id: "astronaut", label: "Astronaut", background: "#e8e5fc", ink: "#6651aa" },
  { id: "dinosaur", label: "Dinosaur", background: "#ddefe7", ink: "#387862" },
  { id: "otter", label: "Otter", background: "#f6e8df", ink: "#96624b" },
  { id: "tiger", label: "Tiger", background: "#fff0d3", ink: "#9b6a28" },
] as const;
export type AvatarId = typeof profileAvatars[number]["id"];
export type StudentProfile = { version: 1; displayName: string; avatar: AvatarId };
export function profileKey(studentId: string) { return `decode-profile-v1-${studentId}`; }
export function defaultProfile(alias: string): StudentProfile { return { version: 1, displayName: `Learner ${alias}`, avatar: "owl" }; }
export function displayNameError(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  return name.length < 2 || name.length > 40 || /[\u0000-\u001f\u007f]/.test(value) ? "Use a demo display name with 2–40 characters and no control characters." : "";
}
export function normalizeProfile(value: unknown, alias: string): StudentProfile {
  const fallback = defaultProfile(alias);
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const saved = value as Record<string, unknown>;
  if (saved.version !== 1) return fallback;
  return {
    version: 1,
    displayName: typeof saved.displayName === "string" && !displayNameError(saved.displayName) ? saved.displayName.trim().replace(/\s+/g, " ") : fallback.displayName,
    avatar: profileAvatars.some((a) => a.id === saved.avatar) ? saved.avatar as AvatarId : fallback.avatar,
  };
}
export function readProfile(storage: Storage, alias: string) { return normalizeProfile(readStorage(storage, profileKey(alias), null), alias); }
export function saveProfile(storage: Storage, alias: string, value: StudentProfile): StudentProfile {
  const error = displayNameError(value.displayName);
  if (error) throw new Error(error);
  const profile = normalizeProfile(value, alias);
  writeStorage(storage, profileKey(alias), profile);
  return profile;
}
