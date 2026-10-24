export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
};

export async function authRequest<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Unable to reach the server. Please try again.");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    const message = response.status < 500 && typeof result?.message === "string"
      ? result.message
      : "Authentication is temporarily unavailable. Please try again.";
    throw new Error(message);
  }
  return result as T;
}
