import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Login successful | DECODE" };

async function LoginResult() {
  const token = (await cookies()).get("decode_session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) redirect("/login");

  let response: Response;
  try {
    response = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/api/auth/me`, {
      headers: { Cookie: `decode_session=${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return <p>Unable to verify your session. Please refresh to try again.</p>;
  }
  if (response.status === 401) redirect("/login");
  if (!response.ok) return <p>Unable to verify your session. Please refresh to try again.</p>;

  return <h1>Login successful.</h1>;
}

export default function LoginSuccessPage() {
  return (
    <main className="p-8">
      <Suspense fallback={<p>Checking your session…</p>}>
        <LoginResult />
      </Suspense>
    </main>
  );
}
