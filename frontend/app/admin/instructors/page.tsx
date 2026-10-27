import { AdminWorkspace } from "../../components/admin/admin-workspace";
import { InstructorsView } from "../../components/admin/instructors-view";
export const metadata = { title: "Instructors" };
export default function InstructorsPage() { return <AdminWorkspace><InstructorsView /></AdminWorkspace>; }
