// Manual visual QA only. Never imported by the Next application or used as an
// authentication fallback. Run after `npm run build`: node tests/admin-preview.mjs
// Open http://127.0.0.1:4317/admin. All identities and API responses are fixtures.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { admin, user, userDetail, instructor, course, courseDetail, overview, analytics, event, page } from "./admin-test-helpers.mjs";

const chunks = path.resolve(".next/static/chunks"), assets = path.resolve(".next/static");
const css = (await fs.readdir(chunks)).filter(file => file.endsWith(".css"));
const output = path.resolve(".next/admin-qa"); await fs.mkdir(output, { recursive: true });
const responses = {
  "/api/auth/me": { user: admin }, "/api/auth/logout": { message: "Fixture signed out." },
  "/api/admin/overview": overview, "/api/admin/users": page([user]), "/api/admin/users/user-1": userDetail,
  "/api/admin/instructors": page([instructor]), "/api/admin/instructors/instructor-1": { ...instructor, courses: [course], recentPublications: [{ courseId: course.id, title: course.title, publishedAt: course.publishedAt }] },
  "/api/admin/courses": page([course]), "/api/admin/courses/html": courseDetail, "/api/admin/analytics": analytics,
  "/api/admin/activity": page([event]), "/api/admin/filter-options": { courses: [{ id: course.id, label: course.title }], instructors: [{ id: instructor.id, label: instructor.name }] },
  "/api/admin/account": { user: { ...admin, status: "active", createdAt: user.createdAt }, capabilities: { editName: false } }, "/api/admin/settings": { uploadLimitBytes: null, accountPolicy: null },
};
const navigation = `import React from 'react';
const subscribe = fn => { window.addEventListener('popstate', fn); return () => window.removeEventListener('popstate', fn); };
export const usePathname = () => React.useSyncExternalStore(subscribe, () => window.location.pathname, () => '/admin');
const navigate = href => { window.history.pushState(null, '', href); window.dispatchEvent(new PopStateEvent('popstate')); };
const router = { replace:navigate, push:navigate, refresh:() => {} };
export const useRouter = () => router;
export default function Link({href,children,onClick,...props}) { return React.createElement('a', {...props, href, onClick:e=>{e.preventDefault();onClick?.(e);navigate(href);}}, children); }`;
const entry = `import React from 'react'; import {createRoot} from 'react-dom/client';
import {usePathname} from 'next/navigation';
import {AdminProvider} from './app/components/admin/admin-provider'; import {AdminShell} from './app/components/admin/admin-shell';
import {OverviewView} from './app/components/admin/overview-view'; import {UsersView} from './app/components/admin/users-view';
import {InstructorsView} from './app/components/admin/instructors-view'; import {CoursesView} from './app/components/admin/courses-view';
import {AnalyticsView} from './app/components/admin/analytics-view'; import {ActivityView} from './app/components/admin/activity-view';
import {SettingsView} from './app/components/admin/settings-view'; import {ProfileView} from './app/components/admin/profile-view';
function Preview() { const pathname=usePathname(); const views={'/admin':OverviewView,'/admin/users':UsersView,'/admin/instructors':InstructorsView,'/admin/courses':CoursesView,'/admin/analytics':AnalyticsView,'/admin/activity':ActivityView,'/admin/settings':SettingsView,'/admin/profile':ProfileView}; const View=views[pathname]??OverviewView; return <AdminProvider user={${JSON.stringify(admin)}}><AdminShell><View key={pathname}/></AdminShell></AdminProvider>; }
createRoot(document.getElementById('preview')).render(<Preview/>);`;
await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, jsx: "automatic", outfile: path.join(output, "preview.js"), define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "isolated-next-navigation", setup(api) { api.onResolve({ filter: /^next\/(link|navigation)$/ }, () => ({ path: "next-preview", namespace: "preview" })); api.onLoad({ filter: /.*/, namespace: "preview" }, () => ({ contents: navigation, loader: "js", resolveDir: process.cwd() })); } }] });
const html = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DECODE Admin · Isolated visual QA</title>${css.map(file => `<link rel="stylesheet" href="/_next/static/chunks/${file}">`).join("")}<style>@font-face{font-family:AdminQAGeist;src:url('/qa-font') format('woff2');font-display:swap}:root{--font-geist-sans:AdminQAGeist,Arial,sans-serif;--font-geist-mono:Consolas,monospace}.qa-note{padding:5px 12px;background:#315db5;color:#fff;text-align:center;font:10px Arial}.adm-sidebar{top:0}</style></head><body><div class="qa-note">ISOLATED VISUAL QA · SAMPLE DATA · NO LIVE ADMIN ACCESS</div><div id="preview"></div><script src="/preview.js"></script></body></html>`;
const media = await fs.readdir(path.join(assets, "media"));
const font = media.find(file => file.endsWith(".woff2"));
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1:4317");
    if (url.pathname.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store");
      const data = url.searchParams.has("unavailable") ? null : responses[url.pathname];
      if (!data) { res.statusCode = 501; res.end(JSON.stringify({ message: "Isolated fixture endpoint unavailable." })); }
      else res.end(JSON.stringify(data)); return;
    }
    if (url.pathname === "/preview.js") { res.setHeader("Content-Type", "text/javascript"); res.end(await fs.readFile(path.join(output, "preview.js"))); return; }
    if (url.pathname === "/qa-font" && font) { res.setHeader("Content-Type", "font/woff2"); res.end(await fs.readFile(path.join(assets, "media", font))); return; }
    if (url.pathname.startsWith("/_next/static/")) {
      const file = path.resolve(assets, url.pathname.slice("/_next/static/".length));
      if (!file.startsWith(assets + path.sep)) { res.statusCode = 403; res.end(); return; }
      res.setHeader("Content-Type", file.endsWith(".css") ? "text/css" : "application/octet-stream"); res.end(await fs.readFile(file)); return;
    }
    res.setHeader("Content-Type", "text/html"); res.end(html);
  } catch { res.statusCode = 404; res.end("Not found"); }
});
server.listen(4317, "127.0.0.1", () => console.log("Isolated admin visual QA: http://127.0.0.1:4317/admin (fixtures only)"));
