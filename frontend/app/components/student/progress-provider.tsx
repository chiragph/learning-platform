"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { emptyProgress } from "@/app/lib/student/progress";
import { learningRequest } from "@/app/lib/learning/client";
import {
  installCatalog,
  type CatalogCourse,
  publishedActivities,
  publicationIds,
} from "@/app/lib/learning/catalog";
import type { Progress, QuizAttempt } from "@/app/lib/student/types";
import { useStudent } from "./student-provider";
type Reply = { progress: Progress; revision: number };
type Store = {
  progress: Progress;
  update: (change: (p: Progress) => Progress) => boolean;
  reset: () => void;
  ready: boolean;
  error: string;
  submitQuiz: (
    id: string,
    answers: Record<string, number>,
    requestKey: string,
  ) => Promise<QuizAttempt>;
};
const Context = createContext<Store | null>(null);
export function useProgress() {
  const store = useContext(Context);
  if (!store) throw new Error("Progress context missing");
  return store;
}
export function ProgressProvider({ children }: { children: ReactNode }) {
  const student = useStudent(),
    pathname = usePathname(),
    loaded = useRef(false);
  const [progress, setProgress] = useState<Progress>(emptyProgress),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState(0);
  const current = useRef(progress),
    server = useRef<Reply>({ progress: emptyProgress(), revision: 0 }),
    queue = useRef<((p: Progress) => Progress)[]>([]),
    running = useRef(false),
    live = useRef(true),
    blocked = useRef(false);
  const drain = useCallback(async () => {
    if (running.current || blocked.current) return;
    running.current = true;
    try {
      while (queue.current.length && live.current) {
        const change = queue.current[0];
        const reply = await learningRequest<Reply>(
          "progress",
          {
            expectedRevision: server.current.revision,
            progress: change(structuredClone(server.current.progress)),
            publicationIds: { ...publicationIds },
          },
          "PUT",
        );
        server.current = reply;
        queue.current.shift();
        current.current = queue.current.reduce(
          (p, f) => f(p),
          structuredClone(reply.progress),
        );
        if (live.current) {
          setProgress(current.current);
          setPending(queue.current.length);
          setError("");
        }
      }
    } catch (e) {
      blocked.current = true;
      if (live.current)
        setError(
          (e instanceof Error ? e.message : "Save failed.") +
            " Your unsaved work is still on this page. Retry saving before leaving.",
        );
    } finally {
      running.current = false;
    }
  }, []);
  useEffect(() => {
    live.current = true;
    let active = true;
    async function load() {
      if (running.current || queue.current.length) return;
      try {
        const [catalog, record] = await Promise.all([
          learningRequest<{ courses: CatalogCourse[] }>("curriculum"),
          learningRequest<Reply>("progress"),
        ]);
        if (!active || running.current || queue.current.length) return;
        if (
          !loaded.current ||
          !/^\/(lessons|quizzes|challenges|projects|courses)\/[^/]+/.test(
            pathname,
          )
        )
          installCatalog(catalog.courses);
        loaded.current = true;
        server.current = record;
        current.current = record.progress;
        setProgress(record.progress);
        setReady(true);
        setError("");
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Unable to load learning records.",
          );
      }
    }
    void load();
    const focus = () => {
      void load();
    };
    const before = (event: BeforeUnloadEvent) => {
      if (queue.current.length || running.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("focus", focus);
    window.addEventListener("beforeunload", before);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => {
      active = false;
      live.current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("beforeunload", before);
    };
  }, [student.id, pathname]);
  const update = useCallback(
    (change: (p: Progress) => Progress) => {
      if (!ready || blocked.current) return false;
      current.current = change(current.current);
      queue.current.push(change);
      setProgress(current.current);
      setPending(queue.current.length);
      void drain();
      return true;
    },
    [ready, drain],
  );
  async function submitQuiz(
    id: string,
    answers: Record<string, number>,
    requestKey: string,
  ) {
    while (running.current)
      await new Promise((resolve) => setTimeout(resolve, 25));
    if (blocked.current || queue.current.length)
      throw new Error("Save your pending work before submitting.");
    const activity = publishedActivities.get("quiz:" + id);
    if (!activity) throw new Error("Quiz is unavailable.");
    running.current = true;
    try {
      const reply = await learningRequest<Reply & { attempt: QuizAttempt }>(
        "quiz-attempts",
        { ...activity, answers, requestKey },
      );
      server.current = reply;
      current.current = reply.progress;
      setProgress(reply.progress);
      return reply.attempt;
    } finally {
      running.current = false;
      void drain();
    }
  }
  async function reset() {
    while (running.current)
      await new Promise((resolve) => setTimeout(resolve, 25));
    if (queue.current.length) {
      setError("Save pending work before resetting.");
      return;
    }
    running.current = true;
    try {
      const reply = await learningRequest<Reply>("progress/reset", {
        expectedRevision: server.current.revision,
      });
      server.current = reply;
      current.current = reply.progress;
      setProgress(reply.progress);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to reset learning records.",
      );
    } finally {
      running.current = false;
    }
  }
  async function retry() {
    try {
      server.current = await learningRequest<Reply>("progress");
      blocked.current = false;
      await drain();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reconnect.");
    }
  }
  return (
    <Context value={{ progress, ready, error, update, reset, submitQuiz }}>
      {error && (
        <p role="alert" className="student-notice student-error">
          {error} <button onClick={() => void retry()}>Retry saving</button>
        </p>
      )}
      {pending > 0 && (
        <p role="status" className="student-notice">
          Saving learning records...
        </p>
      )}
      {ready ? children : <p role="status">Loading your learning records...</p>}
    </Context>
  );
}
