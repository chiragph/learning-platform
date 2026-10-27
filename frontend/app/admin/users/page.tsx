import { AdminWorkspace } from "../../components/admin/admin-workspace";
import { UsersView } from "../../components/admin/users-view";
export const metadata = { title: "Users" };
export default function UsersPage() { return <AdminWorkspace><UsersView /></AdminWorkspace>; }
