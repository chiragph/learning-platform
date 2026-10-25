export const MAX_IMAGE_BYTES = 256 * 1024;
export const MAX_WORKSPACE_IMAGE_CHARACTERS = 768 * 1024;
export const MAX_TOTAL_IMAGE_CHARACTERS = 1536 * 1024;
export const MAX_WORKSPACE_IMAGES = 4;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type WorkspaceImage = { id: string; name: string; data: string };
const prefix = "decode-images-v1-";
export function imageStorageKey(studentId: string, workspaceId: string) { return prefix + encodeURIComponent(studentId) + "/" + encodeURIComponent(workspaceId); }
export function imageReference(id: string) { return "decode-image:" + id; }
function safeImage(value: unknown): value is WorkspaceImage {
  if (!value || typeof value !== "object") return false;
  const image = value as WorkspaceImage;
  return typeof image.id === "string" && /^[a-f\d-]{36}$/.test(image.id) && typeof image.name === "string" && image.name.length <= 120 && typeof image.data === "string" && image.data.length <= Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 50 && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z\d+/]+=*$/.test(image.data);
}
export function readWorkspaceImages(storage: Storage, studentId: string, workspaceId: string): WorkspaceImage[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(imageStorageKey(studentId, workspaceId)) ?? "null");
    if (!Array.isArray(value)) return [];
    const images = value.filter(safeImage).slice(0, MAX_WORKSPACE_IMAGES);
    return JSON.stringify(images).length <= MAX_WORKSPACE_IMAGE_CHARACTERS ? images : [];
  } catch { return []; }
}
export function saveWorkspaceImages(storage: Storage, studentId: string, workspaceId: string, images: WorkspaceImage[]) {
  if (images.length > MAX_WORKSPACE_IMAGES || images.some((image) => !safeImage(image))) throw new Error("Use up to four PNG, JPEG, WebP, or GIF images per workspace.");
  const key = imageStorageKey(studentId, workspaceId), serialized = JSON.stringify(images);
  if (serialized.length > MAX_WORKSPACE_IMAGE_CHARACTERS) throw new Error("This workspace’s image storage is full. Remove an image first.");
  let total = serialized.length;
  for (let index = 0; index < storage.length; index++) { const other = storage.key(index); if (other?.startsWith(prefix) && other !== key) total += (storage.getItem(other) ?? "").length; }
  if (total > MAX_TOTAL_IMAGE_CHARACTERS) throw new Error("This browser’s demo image storage is full. Remove unused workspace images first.");
  try { if (images.length) storage.setItem(key, serialized); else storage.removeItem(key); }
  catch { throw new Error("Image could not be saved in this browser. Free some storage and retry."); }
}
export function validateImageFile(file: Pick<File, "type" | "size">) {
  if (!IMAGE_TYPES.includes(file.type as typeof IMAGE_TYPES[number])) return "Choose a PNG, JPEG, WebP, or GIF image. SVG files are not supported.";
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) return "Choose an image smaller than or equal to 256 KiB.";
  return "";
}
export function imageSignatureMatches(bytes: Uint8Array, type: string) {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (type === "image/png") return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte);
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/gif") return ["GIF87a", "GIF89a"].includes(text(0, 6));
  return type === "image/webp" && text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
}
export function imageTag(image: WorkspaceImage) {
  const name = image.name.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
  return `<img src="${imageReference(image.id)}" alt="${name}">`;
}
