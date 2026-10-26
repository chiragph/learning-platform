import { Suspense } from "react";
import { CurriculumView } from "../../components/instructor/curriculum-view";
export const metadata = { title: "Curriculum Builder" };
export default function Page() { return <Suspense fallback={<p role="status">Opening curriculum…</p>}><CurriculumView /></Suspense>; }
