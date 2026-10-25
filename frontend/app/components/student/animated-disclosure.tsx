import type { ReactNode } from "react";

export function AnimatedDisclosure({ id, open, children, className = "" }: { id: string; open: boolean; children: ReactNode; className?: string }) {
  return <div id={id} className="student-disclosure" data-open={open} aria-hidden={!open} inert={!open}><div className="student-disclosure-clip"><div className={className}>{children}</div></div></div>;
}
