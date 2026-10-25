"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { activityForRoute, recordVisit } from "@/app/lib/student/curriculum";
import { useProgress } from "./progress-provider";

// Observe real route visits, including direct links/back navigation. Prefetching
// and opening curriculum accordions do not count as visits or completion.
export function ActivityVisitTracker() {
  const pathname = usePathname();
  const { ready, update } = useProgress();
  const tracked = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || tracked.current === pathname) return;
    const location = activityForRoute(pathname);
    if (!location) { tracked.current = pathname; return; }
    if (update((progress) => recordVisit(progress, location.activity.id, new Date().toISOString()))) tracked.current = pathname;
  }, [pathname, ready, update]);
  return null;
}
