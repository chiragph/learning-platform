"use client";
import { Component, type ReactNode } from "react";

export class EditorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="student-ide-loading" role="alert"><strong>Monaco could not load.</strong><p>Your code remains in this workspace. Choose the accessible editor above to keep working, or save your draft and reload the page.</p></div> : this.props.children;
  }
}
