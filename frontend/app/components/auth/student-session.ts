import type { AuthUser } from "./auth-client";

export type StudentSession =
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous" | "forbidden" | "unavailable" };

export const authChangeKey = "decode-auth-change-v1";

// A storage event is only a request to recheck the backend cookie. It never
// supplies an identity, token, or learning record.
export function announceAuthChange() {
  try { window.localStorage.setItem(authChangeKey, crypto.randomUUID()); }
  catch { /* Authentication also works when optional browser storage is disabled. */ }
}

export async function studentSessionResponse(response: Response): Promise<StudentSession> {
  if (response.status === 401) return { status: "anonymous" };
  if (!response.ok) return { status: "unavailable" };
  const result: unknown = await response.json().catch(() => null);
  if (!result || typeof result !== "object" || !("user" in result)) return { status: "unavailable" };
  const user = result.user;
  if (!user || typeof user !== "object" || !("id" in user) || typeof user.id !== "string" || !user.id ||
    !("name" in user) || typeof user.name !== "string" || !user.name.trim() ||
    !("email" in user) || typeof user.email !== "string" || !user.email ||
    !("role" in user) || !["STUDENT", "INSTRUCTOR", "ADMIN"].includes(String(user.role))) return { status: "unavailable" };
  if (user.role !== "STUDENT") return { status: "forbidden" };
  // Forward only the public fields defined by main's AuthUser contract.
  return { status: "authenticated", user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

export async function loadStudentSession(signal: AbortSignal): Promise<StudentSession> {
  try {
    return await studentSessionResponse(await fetch("/api/auth/me?scope=student", { credentials: "same-origin", cache: "no-store", signal }));
  } catch { return { status: "unavailable" }; }
}
