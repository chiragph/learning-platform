-- CreateTable
CREATE TABLE "instructor_workspaces" (
    "ownerId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "document" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "instructor_workspaces_pkey" PRIMARY KEY ("ownerId")
);

-- CreateTable
CREATE TABLE "learning_courses" (
    "id" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "liveVersionId" UUID,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "learning_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_publications" (
    "id" UUID NOT NULL,
    "courseId" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_progress" (
    "studentId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "document" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "learning_progress_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "learning_quiz_attempts" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "publicationId" UUID NOT NULL,
    "activityId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_submissions" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "publicationId" UUID NOT NULL,
    "activityId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "workshopTitle" TEXT NOT NULL,
    "code" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "feedback" TEXT NOT NULL DEFAULT '',
    "publishedFeedback" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "reviewedAt" TIMESTAMPTZ(3),

    CONSTRAINT "learning_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_courses_liveVersionId_key" ON "learning_courses"("liveVersionId");

-- CreateIndex
CREATE INDEX "learning_courses_ownerId_idx" ON "learning_courses"("ownerId");

-- CreateIndex
CREATE INDEX "learning_publications_courseId_idx" ON "learning_publications"("courseId");

-- CreateIndex
CREATE INDEX "learning_quiz_attempts_studentId_activityId_idx" ON "learning_quiz_attempts"("studentId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_quiz_attempts_studentId_requestKey_key" ON "learning_quiz_attempts"("studentId", "requestKey");

-- CreateIndex
CREATE INDEX "learning_submissions_studentId_referenceId_idx" ON "learning_submissions"("studentId", "referenceId");

-- CreateIndex
CREATE INDEX "learning_submissions_courseId_status_idx" ON "learning_submissions"("courseId", "status");

-- AddForeignKey
ALTER TABLE "instructor_workspaces" ADD CONSTRAINT "instructor_workspaces_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_courses" ADD CONSTRAINT "learning_courses_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_courses" ADD CONSTRAINT "learning_courses_liveVersionId_fkey" FOREIGN KEY ("liveVersionId") REFERENCES "learning_publications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_publications" ADD CONSTRAINT "learning_publications_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_quiz_attempts" ADD CONSTRAINT "learning_quiz_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_quiz_attempts" ADD CONSTRAINT "learning_quiz_attempts_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "learning_publications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_submissions" ADD CONSTRAINT "learning_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_submissions" ADD CONSTRAINT "learning_submissions_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "learning_publications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Publication pointers must refer to a snapshot of the same course.
ALTER TABLE "learning_publications" ADD CONSTRAINT "publication_course_identity" UNIQUE ("id", "courseId");
ALTER TABLE "learning_courses" ADD CONSTRAINT "live_publication_course_scope"
  FOREIGN KEY ("liveVersionId", "id") REFERENCES "learning_publications"("id", "courseId");
ALTER TABLE "instructor_workspaces" ADD CONSTRAINT "workspace_revision_positive" CHECK ("revision" >= 0);
ALTER TABLE "learning_progress" ADD CONSTRAINT "progress_revision_positive" CHECK ("revision" >= 0);
ALTER TABLE "learning_submissions" ADD CONSTRAINT "submission_status_valid" CHECK ("status" IN ('pending','in-review','reviewed','changes-requested'));
CREATE FUNCTION preserve_learning_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Learning publication and quiz attempt history is immutable'; END;
$$;
CREATE TRIGGER immutable_publication BEFORE UPDATE OR DELETE ON "learning_publications"
  FOR EACH ROW EXECUTE FUNCTION preserve_learning_history();
CREATE TRIGGER immutable_quiz_attempt BEFORE UPDATE OR DELETE ON "learning_quiz_attempts"
  FOR EACH ROW EXECUTE FUNCTION preserve_learning_history();
