import { learningRequest, LearningError } from "../learning/client";
import { seedInstructorState } from "./repository";
import type {
  InstructorCommand,
  InstructorState,
  RepositorySnapshot,
} from "./types";
export class RemoteInstructorRepository {
  private listeners = new Set<() => void>();
  private server: RepositorySnapshot = {
    state: seedInstructorState(),
    ready: false,
    writable: false,
    warning: "",
  };
  private snapshot = this.server;
  private revision = 0;
  private busy = false;
  private generation = 0;
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.server;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private notify() {
    this.listeners.forEach((listener) => listener());
  }
  initialize = async () => {
    if (this.busy) return;
    const generation = ++this.generation;
    try {
      let data = await learningRequest<{
        state: InstructorState;
        revision: number;
      }>("instructor");
      let warning = "";
      try {
        if (data.revision === 0 && typeof window !== "undefined") {
          const raw = window.localStorage.getItem(
            "decode-instructor-preview-v1",
          );
          if (raw && JSON.parse(raw)?.changes?.length)
            data = await learningRequest<{
              state: InstructorState;
              revision: number;
            }>("instructor/import-drafts", { raw });
        }
      } catch (e) {
        warning =
          e instanceof Error
            ? e.message
            : "Browser drafts could not be imported; the original backup is preserved.";
      }
      if (generation !== this.generation) return;
      this.revision = data.revision;
      this.snapshot = {
        state: data.state,
        ready: true,
        writable: true,
        warning,
      };
    } catch (e) {
      this.snapshot = {
        ...this.snapshot,
        writable: false,
        warning: e instanceof Error ? e.message : "Unable to load content.",
      };
    }
    this.notify();
  };
  execute = async (command: InstructorCommand) => {
    if (this.busy || !this.snapshot.writable)
      throw new Error("Wait for the current save to finish.");
    this.busy = true;
    this.generation++;
    this.snapshot = { ...this.snapshot, writable: false };
    this.notify();
    try {
      const data = await learningRequest<{
        state: InstructorState;
        revision: number;
        id: string;
      }>("instructor/commands", { command, expectedRevision: this.revision });
      this.revision = data.revision;
      this.snapshot = { ...this.snapshot, state: data.state };
      return data.id;
    } catch (e) {
      if (e instanceof LearningError && e.status === 409) {
        this.busy = false;
        await this.initialize();
      }
      throw e;
    } finally {
      this.busy = false;
      this.snapshot = { ...this.snapshot, writable: true };
      this.notify();
    }
  };
}
