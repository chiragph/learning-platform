import type * as Monaco from "monaco-editor";
import type { Subject } from "./types";

export type EditorState = {
  path: string; language: Subject; value: string;
  onChange: (value: string) => boolean;
  onRun: () => void; onSave: () => void; onDiagnostics: (count: number) => void;
};
export type EditorSession = ReturnType<typeof createEditorSession>;

// One effect owns one editor and exactly the models it creates. In particular,
// never scan/dispose another mounted editor's models or dispose Monaco services.
export function createEditorSession(monaco: typeof Monaco, container: HTMLElement, read: () => EditorState, options: Monaco.editor.IStandaloneEditorConstructionOptions) {
  const models = new Map<string, Monaco.editor.ITextModel>();
  const views = new Map<string, Monaco.editor.ICodeEditorViewState | null>();
  const subscriptions: Monaco.IDisposable[] = [];
  let disposed = false;
  let changing = false;
  let path = read().path;
  function modelFor(state: EditorState) {
    let model = models.get(state.path);
    if (!model) {
      model = monaco.editor.createModel(state.value, state.language, monaco.Uri.parse(state.path));
      models.set(state.path, model);
    }
    return model;
  }
  let editor: Monaco.editor.IStandaloneCodeEditor;
  function dispose() {
    if (disposed) return;
    disposed = true;
    subscriptions.forEach((subscription) => subscription.dispose());
    // Detach the view before releasing active and inactive models. A language
    // worker finishing later can no longer call back into this session.
    editor?.dispose();
    models.forEach((model) => model.dispose());
    models.clear(); views.clear();
  }
  function diagnostics() {
    if (disposed) return;
    const model = editor.getModel();
    if (model) read().onDiagnostics(monaco.editor.getModelMarkers({ resource: model.uri }).filter((marker) => marker.severity >= monaco.MarkerSeverity.Warning).length);
  }
  try {
    editor = monaco.editor.create(container, { ...options, model: modelFor(read()) });
    subscriptions.push(editor.addAction({ id: "decode-run", label: "DECODE: Run code", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter], run: () => { if (!disposed) read().onRun(); } }));
    subscriptions.push(editor.addAction({ id: "decode-save", label: "DECODE: Save draft", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS], run: () => { if (!disposed) read().onSave(); } }));
    subscriptions.push(editor.onDidChangeModelContent(() => {
      if (disposed || changing || path !== read().path) return;
      const value = editor.getValue();
      if (!read().onChange(value)) {
        changing = true;
        try { editor.setValue(read().value); } finally { changing = false; }
      }
    }));
    subscriptions.push(monaco.editor.onDidChangeMarkers((uris) => {
      if (!disposed && uris.some((uri) => uri.toString() === editor.getModel()?.uri.toString())) diagnostics();
    }));
    diagnostics();
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    update(state: EditorState, nextOptions: Monaco.editor.IStandaloneEditorConstructionOptions) {
      if (disposed) return;
      changing = true;
      try {
        if (path !== state.path) {
          views.set(path, editor.saveViewState());
          const model = modelFor(state);
          path = state.path;
          editor.setModel(model);
          editor.restoreViewState(views.get(path) ?? null);
        }
        const model = editor.getModel()!;
        if (model.getValue() !== state.value) {
          editor.executeEdits("decode-sync", [{ range: model.getFullModelRange(), text: state.value, forceMoveMarkers: true }]);
          editor.pushUndoStop();
        }
        editor.updateOptions(nextOptions);
        if (nextOptions.theme !== options.theme) monaco.editor.setTheme(nextOptions.theme!);
        options = nextOptions;
      } finally { changing = false; }
      diagnostics();
    },
    dispose,
  };
}

// React Activity, Strict Mode and Fast Refresh can clean up and restart effects
// while keeping refs/state. Each setup gets its own cancellation flag and owner;
// an old loader resolution cannot install an editor in a newer session's DOM.
export function startEditorSession<T extends { dispose: () => void }>(load: PromiseLike<unknown>, create: () => T, failed: (error: unknown) => void) {
  let active = true;
  let session: T | null = null;
  void Promise.resolve(load).then(() => {
    if (active) session = create();
  }).catch((error: unknown) => { if (active) failed(error); });
  return () => { active = false; session?.dispose(); session = null; };
}
