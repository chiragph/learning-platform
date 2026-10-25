import type * as Monaco from "monaco-editor";
import { emmetHTML } from "emmet-monaco-es";

type Registration = { users: number; provider: Monaco.languages.CompletionItemProvider; dispose: () => void };
const registrations = new WeakMap<typeof Monaco, Registration>();

// Keep one language provider while any owned editor is alive. Capture the public
// provider to use the SAME context detection/expansion for explicit Tab presses.
export function acquireHtmlEmmet(monaco: typeof Monaco) {
  let entry = registrations.get(monaco);
  if (!entry) {
    let provider!: Monaco.languages.CompletionItemProvider;
    const adapter = { ...monaco, languages: { ...monaco.languages, registerCompletionItemProvider(language: Monaco.languages.LanguageSelector, value: Monaco.languages.CompletionItemProvider) {
      provider = value;
      const original = value.provideCompletionItems;
      value.provideCompletionItems = function (...args) {
        // A language worker/tokenizer may still be starting. Never break native completion.
        try {
          const result = original.apply(this, args);
          return Promise.resolve(result).then((list) => {
            // Exact Emmet expansions lead the suggestion list; native HTML
            // completions remain registered and usable alongside them.
            list?.suggestions.forEach((item) => { if (item.detail === "Emmet abbreviation") { item.kind = monaco.languages.CompletionItemKind.Snippet; item.sortText = "0" + String(item.label); } });
            return list;
          }).catch(() => undefined);
        } catch { return undefined; }
      };
      return monaco.languages.registerCompletionItemProvider(language, value);
    } } };
    const dispose = emmetHTML(adapter, ["html"]);
    entry = { users: 0, provider, dispose }; registrations.set(monaco, entry);
  }
  entry.users++;
  const owned = entry;
  let released = false;
  return {
    async expand(editor: Monaco.editor.IStandaloneCodeEditor, active: () => boolean) {
      const model = editor.getModel(), position = editor.getPosition(), selection = editor.getSelection();
      if (!model || model.getLanguageId() !== "html" || !position || !selection?.isEmpty() || editor.getSelections()?.length !== 1) return false;
      const version = model.getVersionId();
      const cancellation = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) };
      const list = await owned.provider.provideCompletionItems(model, position, { triggerKind: monaco.languages.CompletionTriggerKind.Invoke }, cancellation);
      try {
        if (!active() || editor.getModel() !== model || model.getVersionId() !== version || !editor.getPosition()?.equals(position)) return true;
        const item = list?.suggestions.find((suggestion) => suggestion.detail === "Emmet abbreviation");
        if (!item || !monaco.Range.isIRange(item.range)) return false;
        editor.setSelection(item.range);
        editor.trigger("decode-emmet", "editor.action.insertSnippet", { snippet: item.insertText });
        return true;
      } finally { list?.dispose?.(); }
    },
    dispose() { if (released) return; released = true; if (--owned.users === 0) { owned.dispose(); registrations.delete(monaco); } },
  };
}
