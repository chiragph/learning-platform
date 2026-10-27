import type { ReviewStatus } from "../instructor/submission-types";
export type Submission = {
  id: string;
  studentName: string;
  referenceId: string;
  courseId: string;
  activityId: string;
  courseTitle: string;
  workshopTitle: string;
  projectTitle: string;
  status: ReviewStatus;
  feedback: string;
  revision: number;
  createdAt: string;
  submittedAt: string;
  updatedAt: string;
  reviewedAt: string | null;
};
