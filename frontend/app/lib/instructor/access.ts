import type { AuthUser } from "../../components/auth/auth-client";

// UI navigation is only a convenience; server layouts verify the real session.
export function instructorAccessAllowed(user: Pick<AuthUser, "email" | "role"> | null | undefined) {
  return user?.role === "INSTRUCTOR" && user.email.trim().toLowerCase() === "decode.instructor@gmail.com";
}

export function accountHome(user: Pick<AuthUser, "email" | "role">) {
  if (user.role === "ADMIN") return "/admin";
  return instructorAccessAllowed(user) ? "/instructor" : "/dashboard";
}
