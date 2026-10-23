import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "../landing/wordmark";
import { ThemeToggle } from "../theme-toggle";
import "./auth.css";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="decode decode-auth">
      <a className="decode-skip" href="#auth-content">Skip to content</a>
      <header className="decode-header border-b border-border">
        <div className="decode-container flex h-[72px] items-center justify-between gap-4">
          <Link href="/" className="decode-logo-link inline-flex shrink-0" aria-label="DECODE home"><Wordmark /></Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="auth-content" className="decode-auth-main decode-container" tabIndex={-1}>
        {children}
      </main>
      <footer className="decode-container pb-8 text-center text-xs text-secondary">Learn. Practice. Build.</footer>
    </div>
  );
}
