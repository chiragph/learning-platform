// NODE_ENV is replaced at build time. A production build is always closed,
// including when next start runs on localhost. No cookie or role is altered.
export function instructorPreviewEnabled() { return process.env.NODE_ENV === "development"; }
