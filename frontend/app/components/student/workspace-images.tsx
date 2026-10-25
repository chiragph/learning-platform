"use client";

import { useEffect, useRef, useState } from "react";
import { imageReference, imageSignatureMatches, imageTag, readWorkspaceImages, saveWorkspaceImages, validateImageFile, type WorkspaceImage } from "@/app/lib/student/workspace-images";

type Props = { scope?: "lesson" | "lab" | "workshop"; studentId: string; workspaceId: string; onImages: (images: WorkspaceImage[]) => void; onInsert: (text: string) => void };
export function WorkspaceImages({ scope = "lesson", studentId, workspaceId, onImages, onInsert }: Props) {
  const [images, setImages] = useState<WorkspaceImage[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const reader = useRef<FileReader | null>(null);
  const callbacks = useRef({ onImages, onInsert });
  useEffect(() => { callbacks.current = { onImages, onInsert }; });
  useEffect(() => {
    function restore() {
      try { const saved = readWorkspaceImages(window.localStorage, studentId, workspaceId); setImages(saved); callbacks.current.onImages(saved); }
      catch { setImages([]); callbacks.current.onImages([]); setNotice("Browser storage is unavailable. Online HTTPS images still work."); }
      setBusy(false);
    }
    restore();
    const storage = () => restore(); window.addEventListener("storage", storage);
    return () => { reader.current?.abort(); reader.current = null; window.removeEventListener("storage", storage); };
  }, [studentId, workspaceId]);
  function save(next: WorkspaceImage[]) {
    saveWorkspaceImages(window.localStorage, studentId, workspaceId, next); setImages(next); callbacks.current.onImages(next);
  }
  function upload(file?: File) {
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { setNotice(error); return; }
    const owned = new FileReader(); reader.current?.abort(); reader.current = owned;
    setBusy(true); setNotice("");
    owned.onload = () => {
      if (reader.current !== owned) return;
      try {
        const data = String(owned.result);
        const encoded = data.slice(data.indexOf(",") + 1);
        const header = Uint8Array.from(atob(encoded.slice(0, 24)), (character) => character.charCodeAt(0));
        if (!imageSignatureMatches(header, file.type)) throw new Error("The file contents do not match its image type. Choose another image.");
        const image = { id: crypto.randomUUID(), name: file.name.slice(0, 120), data };
        // Re-read storage so a second workspace/tab cannot silently lose an upload.
        save([...readWorkspaceImages(window.localStorage, studentId, workspaceId), image]);
        setNotice("Image saved for this " + scope + ". Insert its tag, then Run Code.");
      } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Image could not be saved. Retry with a smaller image."); }
      finally { reader.current = null; setBusy(false); }
    };
    owned.onerror = () => { if (reader.current === owned) { reader.current = null; setBusy(false); setNotice("Image could not be read. Try another file."); } };
    owned.readAsDataURL(file);
  }
  return <details className="student-workspace-images"><summary>Images for this {scope} <span>{images.length}/4</span></summary>
    <div className="student-image-upload"><div><strong>Bring an image into your page</strong><p>For online images, use a direct, publicly accessible HTTPS image URL in an <code>&lt;img&gt;</code> tag.</p><p>Local images: PNG, JPEG, WebP, GIF · 256 KiB each · up to 4 per workspace (768 KiB encoded). Stored in this browser for this account and workspace; clearing site data removes them. All demo images share a 1.5 MiB encoded limit.</p></div><button className="student-button secondary" disabled={busy || images.length >= 4} onClick={() => input.current?.click()}>{busy ? "Reading image…" : "Upload Image"}</button><input ref={input} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label={"Choose a " + scope + " image"} onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} /></div>
    <ul>{images.map((image) => <li key={image.id}><span className="student-image-name">{image.name}<code>{imageReference(image.id)}</code></span><div><button className="student-button secondary" onClick={() => callbacks.current.onInsert(imageTag(image))}>Insert &lt;img&gt;</button><button className="student-text-action" aria-label={`Remove ${image.name}`} onClick={() => setDeleting(image.id)}>Remove</button></div>{deleting === image.id && <div className="student-image-remove-confirm" role="group" aria-label="Confirm image removal"><p>Remove this image? Saved code keeps its reference and will show a missing-image message.</p><button className="student-button secondary" onClick={() => setDeleting(null)}>Keep image</button><button className="student-button secondary" onClick={() => { try { save(images.filter((item) => item.id !== image.id)); setDeleting(null); setNotice("Image removed from this workspace."); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Image could not be removed."); } }}>Remove image</button></div>}</li>)}</ul><p role="status">{notice}</p>
  </details>;
}
