import { AdminWorkspace } from "../../components/admin/admin-workspace";
import { CoursesView } from "../../components/admin/courses-view";
export const metadata = { title: "Courses" };
export default function CoursesPage() { return <AdminWorkspace><CoursesView /></AdminWorkspace>; }
