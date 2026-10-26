import { TheoryEditor } from "../../../components/instructor/theory-editor";
import { decodeTheoryActivityParam } from "../../../lib/instructor/theory";
import { Suspense } from "react";

export const metadata = { title: "Theory Lesson Editor" };
type Props = { params: Promise<{ activityId: string }>; searchParams: Promise<{ preview?: string }> };
export default function Page(props: Props) {
  return <Suspense fallback={<p role="status">Opening lesson…</p>}><EditorRoute {...props} /></Suspense>;
}
async function EditorRoute({ params, searchParams }: Props) {
  const [{ activityId }, query] = await Promise.all([params, searchParams]);
  return <TheoryEditor activityId={decodeTheoryActivityParam(activityId)} initialPreview={query.preview === "1"} />;
}
