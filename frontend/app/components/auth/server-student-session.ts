import "server-only";
import { cookies } from "next/headers";
import { studentSessionResponse, type StudentSession } from "./student-session";

// Prefer the student workspace cookie; preserve legacy sign-ins until reauthentication.
// Never cache a session across requests or expose its token to client props.
export async function verifyStudentSession(): Promise<StudentSession> {
  const cookieStore = await cookies();
  const scoped = cookieStore.get("decode_student_session");
  const cookieName = scoped ? "decode_student_session" : "decode_session";
  const token = (scoped ?? cookieStore.get("decode_session"))?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return { status: "anonymous" };
  try {
    const response = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/api/auth/me?scope=student`, {
      headers: { Cookie: `${cookieName}=${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return await studentSessionResponse(response);
  } catch { return { status: "unavailable" }; }
}
