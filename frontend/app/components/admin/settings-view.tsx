"use client";

import { adminApi } from "../../lib/admin/api";
import { AdminLogout, useAdmin } from "./admin-provider";
import { AccountPreferences } from "./account-preferences";
import { Appearance } from "./appearance";
import { useAdminResource } from "./use-admin-resource";
import { DetailGrid, Heading, Info, Panel, ResourceView } from "./ui";

export function SettingsView() {
  const resource = useAdminResource(adminApi.settings), { logoutError } = useAdmin();
  return <><Heading title="Settings" description="Make the workspace yours and review supported platform configuration." /><div className="adm-settings-stack"><Panel title="Appearance" subtitle="The same DECODE theme across all your workspaces"><div className="adm-panel-body"><Appearance /><p className="adm-muted">Theme preferences are stored in this browser. Light and dark modes follow the existing DECODE theme.</p></div></Panel><Panel title="Account preferences" subtitle="Your verified administrator identity"><div className="adm-panel-body"><AccountPreferences /></div></Panel><Panel title="Platform configuration" subtitle="Read-only configuration reported by the backend"><ResourceView resource={resource}>{data => <div className="adm-panel-body"><DetailGrid items={[{ label: "Upload limit", value: data.uploadLimitBytes === null ? "Unavailable" : `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(data.uploadLimitBytes / 1024 / 1024)} MiB` }, { label: "Account policy", value: data.accountPolicy ?? "Unavailable" }]} /><Info>Configuration changes require a separately authorized backend setting. Only supported public configuration is displayed.</Info></div>}</ResourceView></Panel><Panel title="Session" subtitle="Sign out of this admin account"><div className="adm-panel-body"><AdminLogout />{logoutError && <p className="adm-error" role="alert">{logoutError}</p>}</div></Panel></div></>;
}
