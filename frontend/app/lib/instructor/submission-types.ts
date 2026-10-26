// Proposed Stage 5E transport types only. No upload/download API is implemented.
export type ReviewStatus = "pending" | "in-review" | "changes-requested" | "reviewed";
export type SubmissionFileMetadata = { id: string; originalName: string; sizeBytes: number; mediaType: string; scanStatus: "pending" | "clean" | "rejected" };
export type ProjectSubmissionMetadata = {
  id: string; studentId: string; courseId: string; moduleId: string; activityId: string;
  workshopVersionId: string; attempt: number; submittedAt: string; updatedAt: string;
  status: ReviewStatus; files: SubmissionFileMetadata[]; revision: number;
  review: { feedback: string; reviewedAt: string | null; reviewerId: string | null };
};
// Contract scaffold for Stage 5E. There is deliberately no implementation,
// fetch call, endpoint binding, credential handling or real upload in Stage 5D.
export type SubmissionUploadIntent = { activityId: string; workshopVersionId: string; originalName: string; sizeBytes: number; mediaType: string; idempotencyKey: string };
export type SubmissionUploadTicket = { fileId: string; uploadUrl: string; expiresAt: string; maxSizeBytes: number };
export type SubmissionDownloadTicket = { url: string; expiresAt: string };
export type SubmissionQuery = { courseId?: string; activityId?: string; status?: ReviewStatus; search?: string; cursor?: string };
export interface FutureSubmissionGateway {
  initializeUpload(intent: SubmissionUploadIntent): Promise<SubmissionUploadTicket>;
  finalize(input: { activityId: string; workshopVersionId: string; fileIds: string[]; idempotencyKey: string }): Promise<ProjectSubmissionMetadata>;
  listOwn(query: { cursor?: string }): Promise<{ items: ProjectSubmissionMetadata[]; nextCursor: string | null }>;
  listForInstructor(query: SubmissionQuery): Promise<{ items: ProjectSubmissionMetadata[]; nextCursor: string | null }>;
  get(id: string): Promise<ProjectSubmissionMetadata>;
  review(id: string, input: { feedback: string; status: ReviewStatus; expectedRevision: number }): Promise<ProjectSubmissionMetadata>;
  requestDownload(submissionId: string, fileId: string): Promise<SubmissionDownloadTicket>;
}
// Demo records cannot be mistaken for authenticated student submissions. They
// have no student identity, uploaded bytes, storage keys, or download URLs.
export type DemoWorkshopContext = { courseId: string; activityId: string; courseTitle: string; workshopTitle: string };
export type DemoSubmission = DemoWorkshopContext & {
  mode: "local-demo"; id: string; fictionalStudentName: string; projectTitle: string;
  status: ReviewStatus; feedback: string; revision: number;
  createdAt: string; submittedAt: string; updatedAt: string; reviewedAt: string | null;
};
export type DemoSubmissionState = { version: 1; records: DemoSubmission[] };
export type DemoSubmissionCommand =
  | { type: "demo.load"; workshops: DemoWorkshopContext[] }
  | { type: "demo.create"; workshop: DemoWorkshopContext; fictionalStudentName: string; projectTitle: string }
  | { type: "demo.review"; id: string; feedback: string; status: ReviewStatus; expectedRevision: number };
export type DemoSubmissionSnapshot = { state: DemoSubmissionState; ready: boolean; writable: boolean; warning: string };
export interface DemoSubmissionRepository {
  getSnapshot(): DemoSubmissionSnapshot;
  getServerSnapshot(): DemoSubmissionSnapshot;
  subscribe(listener: () => void): () => void;
  initialize(): void;
  execute(command: DemoSubmissionCommand): string;
}
