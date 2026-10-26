import { Suspense } from "react";
import { WorkshopEditor } from "../../../components/instructor/workshop-editor";
import { decodeInstructorActivityParam } from "../../../lib/instructor/activity";

export const metadata = { title: "Workshop Builder" };
type Props = { params: Promise<{ activityId: string }>; searchParams: Promise<{ preview?: string }> };
export default function Page(props: Props) {
  return <Suspense fallback={<p role="status">Opening workshop…</p>}><EditorRoute {...props} /></Suspense>;
}
async function EditorRoute({ params, searchParams }: Props) {
  const [{ activityId }, query] = await Promise.all([params, searchParams]);
  return <WorkshopEditor activityId={decodeInstructorActivityParam(activityId)} initialPreview={query.preview === "1"} />;
}
