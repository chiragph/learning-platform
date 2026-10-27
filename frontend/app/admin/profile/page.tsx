import { AdminWorkspace } from "../../components/admin/admin-workspace";
import { ProfileView } from "../../components/admin/profile-view";
export const metadata = { title: "Profile" };
export default function ProfilePage() { return <AdminWorkspace><ProfileView /></AdminWorkspace>; }
