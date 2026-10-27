import "server-only";
import { cookies } from "next/headers";
import { adminSessionResponse, type AdminSession } from "./admin-session";

export async function verifyAdminSession(): Promise<AdminSession> {
  const store = await cookies();
  const scoped = store.get("decode_admin_session");
  const name = scoped ? "decode_admin_session" : "decode_session";
  const token = (scoped ?? store.get("decode_session"))?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return { status: "anonymous" };
  try {
    return await adminSessionResponse(await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/api/auth/me?scope=admin`, { headers: { Cookie: `${name}=${token}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) }));
  } catch { return { status: "unavailable" }; }
}
