import { Suspense } from "react";
import { QuizEditor } from "../../../components/instructor/quiz-editor";
import { decodeInstructorActivityParam } from "../../../lib/instructor/activity";

export const metadata = { title: "Quiz Builder" };
type Props = { params: Promise<{ activityId: string }>; searchParams: Promise<{ preview?: string }> };
export default function Page(props: Props) {
  return <Suspense fallback={<p role="status">Opening quiz…</p>}><EditorRoute {...props} /></Suspense>;
}
async function EditorRoute({ params, searchParams }: Props) {
  const [{ activityId }, query] = await Promise.all([params, searchParams]);
  return <QuizEditor activityId={decodeInstructorActivityParam(activityId)} initialPreview={query.preview === "1"} />;
}
