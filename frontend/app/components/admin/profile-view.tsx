"use client";

import Link from "next/link";
import { AdminLogout, useAdmin } from "./admin-provider";
import { Appearance } from "./appearance";
import { AccountPreferences } from "./account-preferences";
import { Avatar, Badge, Heading, Panel } from "./ui";

export function ProfileView() {
  const { user } = useAdmin();
  return <><Heading title="Your profile" description="Your administrator identity and workspace preferences." /><div className="adm-profile-grid"><Panel title="Administrator profile"><div className="adm-profile-card"><Avatar name={user.name} large /><h2>{user.name}</h2><p>{user.email}</p><Badge value="ADMIN" /><p className="adm-muted">Identity verified through your account session.</p><Link className="adm-button adm-secondary" href="/admin/settings">Account settings</Link><AdminLogout /></div></Panel><div className="adm-settings-stack"><Panel title="Account information"><div className="adm-panel-body"><AccountPreferences /></div></Panel><Panel title="Theme preference"><div className="adm-panel-body"><Appearance /></div></Panel></div></div></>;
}
