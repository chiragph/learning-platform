import type { SVGProps } from "react";

const shapes = {
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  down: <path d="M12 5v14m-6-6 6 6 6-6" />,
  code: <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16" />,
  style: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 10h16M10 10v10" /></>,
  interact: <path d="m5 3 14 9-7 1-3 7-4-17Zm9 13 4 5" />,
  book: <path d="M12 6C9 4 6 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14" />,
  check: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="m8 12 3 3 5-6" /></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m7 9 3 3-3 3m6 0h4" /></>,
  build: <><rect x="3" y="6" width="18" height="15" rx="3" /><path d="M8 6V3h8v3M3 12h18m-11 0v3h4v-3" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  pause: <path d="M9 5v14m6-14v14" />,
  play: <path d="m8 5 11 7-11 7V5Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  moon: <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  "eye-off": <><path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3 3.8M6.3 6.3A21 21 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 5.7-1.6M10 10a3 3 0 0 0 4 4" /></>,
} as const;

export type IconName = keyof typeof shapes;

export function Icon({ name, className = "size-4", ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>{shapes[name]}</svg>;
}
