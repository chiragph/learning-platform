import "server-only";
import { cookies } from "next/headers";
import { instructorSessionResponse, type InstructorSession } from "./instructor-session";

export async function verifyInstructorSession(): Promise<InstructorSession> {
  const token = (await cookies()).get("decode_session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return { status: "anonymous" };
  try {
    return await instructorSessionResponse(await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/api/auth/me`, {
      headers: { Cookie: `decode_session=${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }));
  } catch { return { status: "unavailable" }; }
}
