import { Suspense } from "react";
import { LabEditor } from "../../../components/instructor/lab-editor";
import { decodeInstructorActivityParam } from "../../../lib/instructor/activity";

export const metadata = { title: "Coding Lab Editor" };
type Props = { params: Promise<{ activityId: string }>; searchParams: Promise<{ preview?: string }> };
export default function Page(props: Props) {
  return <Suspense fallback={<p role="status">Opening lab…</p>}><EditorRoute {...props} /></Suspense>;
}
async function EditorRoute({ params, searchParams }: Props) {
  const [{ activityId }, query] = await Promise.all([params, searchParams]);
  return <LabEditor activityId={decodeInstructorActivityParam(activityId)} initialPreview={query.preview === "1"} />;
}
