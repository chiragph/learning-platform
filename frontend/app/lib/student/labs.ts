import type { LabRequirementResult } from "./types";

export const labIds = ["html-heading", "html-link", "css-card", "css-grid", "javascript-button", "javascript-list"] as const;
export type LabId = typeof labIds[number];
export type LabRequirement = { id: string; title: string; help: string };
export type LabDefinition = { id: LabId; objective: string; widths: readonly number[]; requirements: readonly LabRequirement[] };
const requirement = (id: string, title: string, help: string): LabRequirement => ({ id, title, help });
const runtime = requirement("runtime", "Code runs without JavaScript errors", "Read the runtime messages, fix any script errors, and check again.");
export const labs: Record<LabId, LabDefinition> = {
  "html-heading": { id: "html-heading", objective: "Give a page a clear top-level heading and supporting text.", widths: [800], requirements: [
    requirement("heading", "Exactly one main heading", "Add one h1 element; remove any extra h1 elements."),
    requirement("heading-text", "Heading says Hello, DECODE!", "Use the exact text Hello, DECODE! inside your h1."),
    requirement("paragraph", "A paragraph with meaningful text", "Add a p element containing a short introduction."), runtime,
  ] },
  "html-link": { id: "html-link", objective: "Connect semantic navigation to the main content of a page.", widths: [800], requirements: [
    requirement("main", "One main element with id learning", 'Use <main id="learning"> once on the page.'),
    requirement("heading", "Main content has a nonempty h1", "Put a descriptive h1 inside main#learning."),
    requirement("link", "Navigation links to the learning section", 'Inside nav, add <a href="#learning">Start learning</a>.'), runtime,
  ] },
  "css-card": { id: "css-card", objective: "Build a readable card that stays centered and fits both small and large screens.", widths: [320, 800], requirements: [
    requirement("card", "A reading card with a heading and paragraph", "Keep article.card and give its h1 and p nonempty text."),
    requirement("padding", "At least 16px padding on every side", "Give .card comfortable padding, such as 1.5rem."),
    requirement("border", "A visible border around the card", "Set a border of at least 1px on all four sides."),
    requirement("line-height", "Paragraph line height at least 1.4", "Use a unitless line-height such as 1.6 on the card or paragraph."),
    requirement("width", "A centered card no wider than 576px", "Use max-width (for example 28rem) and margin-inline: auto. The rendered card should be 240–576px wide when room permits."),
    requirement("fits", "No horizontal overflow at 320px or 800px", "Avoid fixed widths wider than the screen; consider box-sizing: border-box."), runtime,
  ] },
  "css-grid": { id: "css-grid", objective: "Use CSS Grid to switch from one column on small screens to multiple columns on larger screens.", widths: [320, 800], requirements: [
    requirement("cards", "Three cards with content", "Keep at least three nonempty articles inside .gallery."),
    requirement("grid", "The gallery uses CSS Grid", "Set display: grid on .gallery."),
    requirement("columns", "One column at 320px, multiple at 800px", "Use responsive grid-template-columns, for example repeat(auto-fit, minmax(min(100%, 12rem), 1fr))."),
    requirement("gap", "A consistent gap of at least 8px", "Use gap: 1rem, or set both row-gap and column-gap."),
    requirement("fits", "No horizontal overflow at either width", "Allow the columns and cards to shrink within the viewport."), runtime,
  ] },
  "javascript-button": { id: "javascript-button", objective: "Respond to user input by updating the DOM on every click.", widths: [800], requirements: [
    requirement("elements", "A greeting button and message", "Keep button#greet and an element with id message."),
    requirement("click", "Clicking changes the greeting", 'On click, set #message.textContent to "Hello, developer!".'),
    requirement("repeat", "The handler works on repeated clicks", "Keep the click listener active; the check resets the message and clicks again."), runtime,
  ] },
  "javascript-list": { id: "javascript-list", objective: "Render a collection and append a new goal each time a button is clicked.", widths: [800], requirements: [
    requirement("initial", "Three nonempty goals on initial render", "Render exactly three li elements inside #goals before any clicks."),
    requirement("button", "An Add a goal button", "Keep the starter button (id add-goal is recommended)."),
    requirement("append", "A click appends one nonempty goal", "Append one li without removing or replacing earlier goals."),
    requirement("repeat", "Another click appends another goal", "Each click must add one new item and preserve the existing goals."), runtime,
  ] },
};
export function findLab(id: string): LabDefinition | undefined { return labIds.includes(id as LabId) ? labs[id as LabId] : undefined; }
export function validLabResults(lab: LabDefinition, value: unknown): value is LabRequirementResult[] {
  return Array.isArray(value) && value.length === lab.requirements.length && lab.requirements.every((requirement, index) => {
    const result = value[index]; return result && typeof result === "object" && result.id === requirement.id && typeof result.passed === "boolean";
  });
}
