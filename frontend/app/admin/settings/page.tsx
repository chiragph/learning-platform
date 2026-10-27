import { AdminWorkspace } from "../../components/admin/admin-workspace";
import { SettingsView } from "../../components/admin/settings-view";
export const metadata = { title: "Settings" };
export default function SettingsPage() { return <AdminWorkspace><SettingsView /></AdminWorkspace>; }
