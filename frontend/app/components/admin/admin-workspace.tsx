import "server-only";

import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "../auth/server-admin-session";
import { AdminProvider } from "./admin-provider";
import { AdminShell } from "./admin-shell";

async function AuthenticatedAdmin({ children }: { children: ReactNode }) {
  const session = await verifyAdminSession();
  if (session.status === "anonymous") redirect("/login");
  if (session.status === "forbidden") redirect(session.destination);
  if (session.status !== "authenticated") return <main className="adm-session" role="alert"><h1>Unable to verify admin access</h1><p>The backend must support ADMIN sessions and the admin session scope. No protected content is available until verification succeeds.</p><a className="adm-button" href="/admin">Try again</a><a className="adm-link" href="/login">Return to sign in</a></main>;
  return <AdminProvider user={session.user}><AdminShell>{children}</AdminShell></AdminProvider>;
}

// This boundary belongs inside each page, after Next has reached the segment.
// Nothing in the protected shell or view renders before server authorization.
export function AdminWorkspace({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="adm-session" role="status">Checking your admin session…</p>}><AuthenticatedAdmin>{children}</AuthenticatedAdmin></Suspense>;
}
