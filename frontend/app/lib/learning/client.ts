export class LearningError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function learningRequest<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch("/api/learning/" + path, {
    method: body === undefined ? "GET" : method,
    credentials: "include",
    cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new LearningError(
      typeof data?.message === "string"
        ? data.message
        : "Unable to save to the server. Please retry.",
      response.status,
    );
  return data;
}
