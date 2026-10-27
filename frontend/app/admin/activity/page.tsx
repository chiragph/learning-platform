import { AdminWorkspace } from "../../components/admin/admin-workspace";
import { ActivityView } from "../../components/admin/activity-view";
export const metadata = { title: "Activity Logs" };
export default function ActivityPage() { return <AdminWorkspace><ActivityView /></AdminWorkspace>; }
