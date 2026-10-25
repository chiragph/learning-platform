import "server-only";
import { cookies } from "next/headers";
import { studentSessionResponse, type StudentSession } from "./student-session";

// Use the same cookie and verification endpoint as main's /login/success page.
// Never cache a session across requests or expose its token to client props.
export async function verifyStudentSession(): Promise<StudentSession> {
  const token = (await cookies()).get("decode_session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return { status: "anonymous" };
  try {
    const response = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/api/auth/me`, {
      headers: { Cookie: `decode_session=${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return await studentSessionResponse(response);
  } catch { return { status: "unavailable" }; }
}
