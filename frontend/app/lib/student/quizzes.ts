import type { Question, Subject } from "./types";
const q = (id: string, topic: string, prompt: string, options: Question["options"], correct: number, explanation: string): Question => ({ id, topic, prompt, options, correct, explanation });
export const quizzes: Record<Subject, Question[]> = {
  html: [
    q("html-1", "Introduction", "What is HTML primarily responsible for?", ["Page animations", "Content structure and meaning", "Database queries", "Network encryption"], 1, "HTML describes the structure and meaning of content. CSS handles presentation and JavaScript handles behavior."),
    q("html-2", "Document structure", "Where should a page's title element be placed?", ["Inside head", "Inside footer", "After html", "Inside an image"], 0, "The title element belongs in head and names the document in the browser tab."),
    q("html-3", "Headings", "What should determine a heading's level?", ["Its preferred color", "Its desired font size", "Its position in the content hierarchy", "The length of its text"], 2, "Heading levels convey a hierarchy. Use CSS to change visual size independently."),
    q("html-4", "Links and images", "Which attribute provides a meaningful image's text alternative?", ["href", "title alone", "src", "alt"], 3, "The alt attribute provides alternative text. Decorative images normally have alt=\"\"."),
    q("html-5", "Lists", "Which element represents an ordered list?", ["ul", "ol", "li alone", "list"], 1, "An ol contains li elements and represents items whose order matters."),
    q("html-6", "Tables", "Which element labels a data table?", ["caption", "legend", "label", "summary-text"], 0, "A caption gives a table a descriptive title. A legend labels a fieldset."),
    q("html-7", "Forms", "How do you explicitly associate a label with an input?", ["Give them the same class", "Put the label in head", "Match the label's for with the input's id", "Add a placeholder only"], 2, "Matching for and id connects the visible label to the input for assistive technology and pointer activation."),
    q("html-8", "Semantics", "Which element represents the primary content of a page?", ["aside", "span", "nav", "main"], 3, "main identifies the document's dominant content, excluding repeated navigation and similar surrounding material."),
  ],
  css: [
    q("css-1", "Introduction", "Which is a valid CSS declaration?", ["color = blue", "color: blue;", "<color>blue</color>", "blue -> color"], 1, "A declaration pairs a property with a value separated by a colon, normally followed by a semicolon."),
    q("css-2", "Selectors", "Which selector matches elements with class card?", ["#card", "card()", ".card", "@card"], 2, "A dot introduces a class selector. A hash introduces an ID selector."),
    q("css-3", "Typography", "What does a unitless line-height of 1.6 mean?", ["1.6 times the element's font size", "Exactly 1.6 pixels", "1.6 times viewport height", "Sixteen lines of text"], 0, "A unitless line-height multiplies the element's own font size and inherits usefully."),
    q("css-4", "Box model", "With box-sizing: border-box, width includes…", ["Only content", "Margins too", "Only the border", "Content, padding, and border"], 3, "border-box includes content, padding, and border in the specified width. Margin is outside."),
    q("css-5", "Flexbox", "Which property aligns items along a flex container's main axis?", ["align-items", "justify-content", "font-weight", "z-index"], 1, "justify-content operates along the main axis, whose direction is set by flex-direction."),
    q("css-6", "Grid", "What does 1fr 2fr specify in grid-template-columns?", ["One row and two columns", "Fixed pixel sizes", "Two columns sharing remaining space in a 1:2 ratio", "Two percentage widths of 1% and 2%"], 2, "fr represents a fraction of available space after other sizing constraints are considered."),
    q("css-7", "Positioning", "Which position value can stick at top: 0 while staying in flow?", ["sticky", "absolute", "static", "inherit-only"], 0, "Sticky positioning stays in normal flow, then is constrained by its inset and scrolling container."),
    q("css-8", "Responsive design", "Which media feature detects a request for less animation?", ["screen-width", "color-gamut", "hover", "prefers-reduced-motion"], 3, "prefers-reduced-motion: reduce allows nonessential movement to be disabled or simplified."),
  ],
  javascript: [
    q("js-1", "Introduction", "Which method writes a debugging message to the console?", ["document.print()", "console.log()", "window.css()", "html.writeLog()"], 1, "console.log outputs values to the developer console; it does not change page content."),
    q("js-2", "Variables", "Which declaration allows later reassignment?", ["const count = 0", "fixed count = 0", "let count = 0", "immutable count = 0"], 2, "let permits reassignment. const prevents reassigning the binding, but does not freeze objects."),
    q("js-3", "Operators", "What is the value of 5 === '5'?", ["false", "true", "5", "An error"], 0, "Strict equality does not coerce types, so a number and a string are not strictly equal."),
    q("js-4", "Conditions", "Which value is falsy?", ["'false'", "[]", "{}", "0"], 3, "The number 0 is falsy. Nonempty strings, arrays, and objects are truthy."),
    q("js-5", "Loops", "Which loop iterates over array values directly?", ["for...in", "for...of", "if...else", "try...catch"], 1, "for...of yields iterable values. for...in enumerates property keys."),
    q("js-6", "Functions", "What does return do inside a function?", ["Restarts the function", "Declares a global", "Ends that function call and supplies a result", "Always logs a value"], 2, "return immediately ends the call and provides its expression's value to the caller."),
    q("js-7", "Arrays and objects", "What is the first index of a JavaScript array?", ["0", "1", "-1", "The length"], 0, "Array indices start at zero. An array with three items normally uses indices 0, 1, and 2."),
    q("js-8", "DOM", "Which property should you use to insert untrusted plain text?", ["outerHTML", "innerHTML", "style", "textContent"], 3, "textContent treats input as text rather than parsing it as HTML markup."),
    q("js-9", "Events", "How do you register a button click handler?", ["button.addStyle('click', handler)", "button.addEventListener('click', handler)", "button.querySelector('click')", "button.click = 'handler'"], 1, "addEventListener registers a callback for the event without replacing other listeners."),
  ],
};
export function scoreQuiz(questions: Question[], answers: Record<string, number>) {
  const correct = questions.filter((question) => answers[question.id] === question.correct).length;
  return { correct, total: questions.length, percent: questions.length ? Math.round(correct / questions.length * 100) : 0 };
}
