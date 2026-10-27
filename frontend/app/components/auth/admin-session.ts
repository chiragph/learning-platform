import type { AuthUser } from "./auth-client";
import { accountHome } from "../../lib/instructor/access";

export type AdminSession = { status: "authenticated"; user: AuthUser } | { status: "forbidden"; destination: string } | { status: "anonymous" } | { status: "unavailable" };
export async function adminSessionResponse(response: Response): Promise<AdminSession> {
  if (response.status === 401) return { status: "anonymous" };
  if (!response.ok) return { status: "unavailable" };
  const data: unknown = await response.json().catch(() => null);
  if (!data || typeof data !== "object" || !("user" in data)) return { status: "unavailable" };
  const user = data.user;
  if (!user || typeof user !== "object" || !("id" in user) || typeof user.id !== "string" || !user.id || !("name" in user) || typeof user.name !== "string" || !user.name.trim() || !("email" in user) || typeof user.email !== "string" || !user.email.trim() || !("role" in user) || !["ADMIN", "INSTRUCTOR", "STUDENT"].includes(String(user.role))) return { status: "unavailable" };
  const account: AuthUser = { id: user.id, name: user.name, email: user.email, role: user.role as AuthUser["role"] };
  return account.role === "ADMIN" ? { status: "authenticated", user: account } : { status: "forbidden", destination: accountHome(account) };
}
export async function loadAdminSession(signal: AbortSignal): Promise<AdminSession> {
  try { return await adminSessionResponse(await fetch("/api/auth/me?scope=admin", { credentials: "same-origin", cache: "no-store", signal })); }
  catch { return { status: "unavailable" }; }
}
