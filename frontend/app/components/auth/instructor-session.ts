import type { AuthUser } from "./auth-client";
import { instructorAccessAllowed } from "../../lib/instructor/access";

export type InstructorSession =
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous" | "forbidden" | "unavailable" };

export async function instructorSessionResponse(response: Response): Promise<InstructorSession> {
  if (response.status === 401) return { status: "anonymous" };
  if (!response.ok) return { status: "unavailable" };
  const result: unknown = await response.json().catch(() => null);
  if (!result || typeof result !== "object" || !("user" in result)) return { status: "unavailable" };
  const user = result.user;
  if (!user || typeof user !== "object" ||
    !("id" in user) || typeof user.id !== "string" || !user.id ||
    !("name" in user) || typeof user.name !== "string" || !user.name.trim() ||
    !("email" in user) || typeof user.email !== "string" || !user.email.trim() ||
    !("role" in user) || !["STUDENT", "INSTRUCTOR", "ADMIN"].includes(String(user.role))) return { status: "unavailable" };
  const account: AuthUser = { id: user.id, name: user.name, email: user.email, role: user.role as AuthUser["role"] };
  return instructorAccessAllowed(account) ? { status: "authenticated", user: account } : { status: "forbidden" };
}

export async function loadInstructorSession(signal: AbortSignal): Promise<InstructorSession> {
  try {
    return await instructorSessionResponse(await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store", signal }));
  } catch { return { status: "unavailable" }; }
}
