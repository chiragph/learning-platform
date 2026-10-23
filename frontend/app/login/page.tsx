import type { Metadata } from "next";
import { AuthForm } from "../components/auth/auth-form";
import { AuthShell } from "../components/auth/auth-shell";

export const metadata: Metadata = { title: "Sign In | DECODE" };

export default function LoginPage() {
  return <AuthShell><AuthForm mode="login" /></AuthShell>;
}
