"use client";
import { Empty } from "../components/admin/ui";
export default function AdminError({ retry }: { error: unknown; retry: () => void }) {
  return <div className="adm-resource-error" role="alert"><Empty title="This page could not be opened">Try loading the page again. Your account and course records have not been changed.</Empty><button className="adm-button" onClick={retry}>Try again</button></div>;
}
