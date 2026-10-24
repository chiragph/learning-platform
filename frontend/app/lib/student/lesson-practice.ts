import type { Code, Lesson } from "./types";

const contexts: Record<string, { html?: string; css?: string }> = {
  "html-text": {},
  "html-lists": {},
  "html-forms": {},
  "css-selectors": { html: '<article class="card"><h1>A small idea</h1><p>Style this reading card.</p><button type="button">Try keyboard focus</button></article>' },
  "css-box-model": { html: '<article class="card"><h1>Make room for content</h1><p>Explore padding, borders, and margins.</p></article>' },
  "css-flexbox": { html: '<nav class="toolbar" aria-label="Practice toolbar"><strong>Field Notes</strong><button type="button">Read</button><button type="button">Build</button><button type="button">Explore</button></nav>' },
  "css-grid": { html: '<div class="gallery"><article>HTML</article><article>CSS</article><article>JavaScript</article><article>Practice</article><article>Build</article><article>Explore</article></div>', css: 'article { padding: 24px; background: white; border: 1px solid #d1d5db; border-radius: 8px; }\n' },
  "css-responsive": { html: '<main class="layout"><aside><h2>Explore</h2><p>A supporting column.</p></aside><article><h1>A flexible page</h1><p>Switch the preview width to see the layout adapt.</p></article></main>' },
  "javascript-conditions": { html: '<h1>Make a decision</h1><p>Run the example and read its console output below the preview.</p>' },
  "javascript-functions": { html: '<h1>Write a reusable function</h1><p>Run the example and inspect the console messages.</p>' },
  "javascript-dom": { html: '<h1>My learning plan</h1><ul><li>Understand the page</li></ul>' },
  "javascript-events": { html: '<h1>Make it interactive</h1><p>Run the code, then activate the button.</p><button type="button">Clicked 0 times</button>' },
};

export const practiceLessonIds = Object.keys(contexts);
export function lessonStarter(lesson: Lesson): Code | null {
  const context = contexts[lesson.id];
  if (!context) return null;
  const css = '* { box-sizing: border-box; }\nbody { font: 16px/1.6 system-ui, sans-serif; margin: 0; padding: 24px; color: #202a32; background: #faf9f6; }\nbutton, input { font: inherit; padding: 10px 14px; }\n' + (context.css ?? "");
  return {
    html: lesson.language === "html" ? lesson.code : context.html ?? "<h1>My experiment</h1>",
    css: css + (lesson.language === "css" ? lesson.code : ""),
    javascript: lesson.language === "javascript" ? lesson.code : "// Add optional interactions here.\n",
  };
}
