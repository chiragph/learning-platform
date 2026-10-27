import type { ReactNode } from "react";
import "../components/admin/admin.css";

export const metadata = { title: { default: "Admin Workspace | DECODE", template: "%s | DECODE Admin" }, robots: { index: false, follow: false } };
export default function AdminLayout({ children }: { children: ReactNode }) {
  // Keep page segments in Next's render tree even when authentication is
  // unavailable. Every admin page enforces access through AdminWorkspace.
  return children;
}
