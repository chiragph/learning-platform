import type { LabId } from "./labs";
import type { LabRequirementResult } from "./types";

// Self-contained on purpose: buildPreview serializes this trusted function into
// the opaque iframe. Never call it on the parent application's document.
export function evaluateLab(document: Document, view: Window, id: LabId, errors: number): LabRequirementResult[] {
  const results: LabRequirementResult[] = [];
  const add = (id: string, passed: unknown) => results.push({ id, passed: Boolean(passed) });
  const text = (node: Element | null) => node?.textContent?.trim() ?? "";
  const fits = (node: Element | null) => {
    if (!node) return false;
    const bounds = node.getBoundingClientRect(), viewport = document.documentElement.clientWidth || view.innerWidth;
    return bounds.width > 0 && bounds.left >= -1 && bounds.right <= viewport + 1 && document.documentElement.scrollWidth <= viewport + 1;
  };
  if (id === "html-heading") {
    add("heading", document.querySelectorAll("h1").length === 1);
    add("heading-text", text(document.querySelector("h1")) === "Hello, DECODE!");
    add("paragraph", [...document.querySelectorAll("p")].some(node => text(node)));
  }
  if (id === "html-link") {
    add("main", document.querySelectorAll("#learning").length === 1 && document.querySelector("main#learning"));
    add("heading", text(document.querySelector("main#learning h1")));
    add("link", [...document.querySelectorAll('nav a[href="#learning"]')].some(node => text(node) === "Start learning"));
  }
  if (id === "css-card") {
    const card = document.querySelector("article.card"), paragraph = card?.querySelector("p") ?? null;
    const style = card ? view.getComputedStyle(card) : null, reading = paragraph ? view.getComputedStyle(paragraph) : null;
    add("card", card && text(card.querySelector("h1")) && text(paragraph));
    add("padding", style && [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].every(value => parseFloat(value) >= 16));
    add("border", style && ["Top", "Right", "Bottom", "Left"].every(side => parseFloat(style.getPropertyValue("border-" + side.toLowerCase() + "-width")) >= 1 && !["none", "hidden"].includes(style.getPropertyValue("border-" + side.toLowerCase() + "-style"))));
    add("line-height", reading && parseFloat(reading.lineHeight) / parseFloat(reading.fontSize) >= 1.4);
    const bounds = card?.getBoundingClientRect(), viewport = document.documentElement.clientWidth || view.innerWidth;
    add("width", bounds && style?.maxWidth && style.maxWidth !== "none" && bounds.width >= Math.min(240, viewport) && bounds.width <= 576 && Math.abs(bounds.left - (viewport - bounds.right)) <= 2);
    add("fits", fits(card));
  }
  if (id === "css-grid") {
    const gallery = document.querySelector(".gallery"), style = gallery ? view.getComputedStyle(gallery) : null;
    add("cards", gallery && [...gallery.querySelectorAll("article")].filter(node => text(node)).length >= 3);
    add("grid", style?.display === "grid");
    const columns = style?.gridTemplateColumns.trim().split(/\s+/).filter(Boolean) ?? [];
    add("columns", style && style.gridTemplateColumns !== "none" && (view.innerWidth <= 320 ? columns.length === 1 : columns.length >= 2));
    add("gap", style && parseFloat(style.rowGap) >= 8 && parseFloat(style.columnGap) >= 8);
    add("fits", fits(gallery) && [...(gallery?.querySelectorAll("article") ?? [])].every(node => fits(node)));
  }
  if (id === "javascript-button") {
    const button = document.querySelector<HTMLButtonElement>("button#greet"), message = document.querySelector("#message");
    add("elements", button && message);
    if (message) message.textContent = "Check the first click";
    button?.click(); add("click", text(message) === "Hello, developer!");
    if (message) message.textContent = "Check another click";
    button?.click(); add("repeat", text(message) === "Hello, developer!");
  }
  if (id === "javascript-list") {
    const list = document.querySelector("#goals"), button = document.querySelector<HTMLButtonElement>("button#add-goal") ?? document.querySelector<HTMLButtonElement>("button");
    const items = () => [...(list?.querySelectorAll("li") ?? [])].map(node => text(node));
    let before = items(); add("initial", before.length === 3 && before.every(Boolean)); add("button", button);
    button?.click(); let after = items();
    add("append", after.length === before.length + 1 && before.every((value, index) => after[index] === value) && after.every(Boolean));
    before = after; button?.click(); after = items();
    add("repeat", after.length === before.length + 1 && before.every((value, index) => after[index] === value) && after.every(Boolean));
  }
  add("runtime", errors === 0);
  return results;
}
