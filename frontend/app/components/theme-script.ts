// Runs during HTML parsing, before first paint. Keep the storage key in sync
// with theme-toggle.tsx. Storage can be blocked without disabling the toggle.
export const themeScript = `(function(){var t;try{t=localStorage.getItem("decode-theme")}catch(e){}document.documentElement.dataset.theme=t==="dark"?"dark":"light"})()`;
