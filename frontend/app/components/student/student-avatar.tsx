import { profileAvatars, type AvatarId } from "@/app/lib/student/student-profile";

import { AvatarIllustration } from "./avatar-illustrations";

// Original local vector presets. No external avatars, uploads, or tracking URLs.
export function StudentAvatar({ avatar = "owl", className = "" }: { avatar?: AvatarId; className?: string }) {
  const preset = profileAvatars.find((a) => a.id === avatar) ?? profileAvatars[0];
  return <svg className={`student-preset-avatar ${className}`} data-avatar={preset.id} viewBox="0 0 80 80" aria-hidden="true" focusable="false">
    <rect width="80" height="80" rx="22" fill={preset.background} />
    <g stroke={preset.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {!["owl", "fox", "bot", "cat"].includes(avatar) ? <AvatarIllustration character={avatar} ink={preset.ink} background={preset.background} /> : avatar === "bot" ? <><path d="M40 17v8M35 16h10" /><rect x="20" y="26" width="40" height="35" rx="10" fill="white" /><path d="M15 37v12m50-12v12M32 51h16" /><circle cx="31" cy="39" r="3" fill={preset.ink} /><circle cx="49" cy="39" r="3" fill={preset.ink} /></> : avatar === "fox" ? <><path d="m19 22 20 9 22-9-5 30-16 12-16-12z" fill={preset.ink} /><path d="m23 37 17 11 17-11-4 14-13 10-13-10z" fill="white" stroke="none" /><path d="m35 48 5 4 5-4z" fill={preset.ink} /><path d="m28 36 5 2m14 0 5-2" stroke="white" /></> : avatar === "cat" ? <><path d="m21 38-1-17 17 9h6l17-9-1 17v10c0 13-38 13-38 0z" fill="white" /><path d="m29 41 3 2m16 0 3-2m-15 7 4 3 4-3M17 47l10 2m26 0 10-2M40 51v4" /></> : <><path d="m20 26 12 5h16l12-5v25c0 17-40 17-40 0z" fill="white" /><circle cx="31" cy="42" r="10" fill={preset.background} /><circle cx="49" cy="42" r="10" fill={preset.background} /><circle cx="31" cy="42" r="2.5" fill={preset.ink} /><circle cx="49" cy="42" r="2.5" fill={preset.ink} /><path d="m36 53 4 5 4-5z" fill={preset.ink} /></>}
    </g>
  </svg>;
}
