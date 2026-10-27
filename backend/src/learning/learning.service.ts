import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
const domain = require('../../domain/learning.cjs');
const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
const safeKey = (v: any) =>
  typeof v === 'string' &&
  /^[a-zA-Z0-9:_-]{1,150}$/.test(v) &&
  !['__proto__', 'constructor', 'prototype'].includes(v);
@Injectable()
export class LearningService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async initialize(ownerId: string) {
    await this.db.$transaction(async (tx) => {
      // Serialize first-time seed initialization across browser tabs/processes.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))`;
      if (await tx.instructorWorkspace.findUnique({ where: { ownerId } }))
        return;
      const state = domain.seedInstructorState();
      await tx.instructorWorkspace.create({
        data: { ownerId, document: state },
      });
      for (const course of state.courses) {
        await tx.learningCourse.create({ data: { id: course.id, ownerId } });
        const version = await tx.learningPublication.create({
          data: {
            courseId: course.id,
            document: domain.publishCourse(state, course, true),
          },
        });
        await tx.learningCourse.update({
          where: { id: course.id },
          data: { liveVersionId: version.id },
        });
      }
    });
  }
  async workspace(ownerId: string) {
    await this.initialize(ownerId);
    const row = await this.db.instructorWorkspace.findUniqueOrThrow({
      where: { ownerId },
    });
    return { state: row.document, revision: row.revision };
  }
  async importDrafts(ownerId: string, body: any) {
    if (!object(body) || typeof body.raw !== 'string')
      throw new BadRequestException('Invalid browser draft backup.');
    const decoded = domain.decodeInstructorStorage(body.raw);
    if (decoded.recovery !== 'none')
      throw new BadRequestException(
        'Browser draft backup needs recovery before importing. The original browser record is preserved.',
      );
    const state = decoded.state;
    for (const c of state.courses)
      if (
        c.source === 'local' ||
        c.modules.some((m) =>
          m.activities.some((a) => state[a.type]?.drafts[a.id]),
        )
      )
        c.status = 'draft';
    return this.db.$transaction(async (tx) => {
      const changed = await tx.instructorWorkspace.updateMany({
        where: { ownerId, revision: 0 },
        data: { document: state, revision: 1 },
      });
      if (!changed.count)
        throw new ConflictException(
          'Server content already exists. Browser drafts were preserved.',
        );
      for (const c of state.courses) {
        const existing = await tx.learningCourse.findUnique({
          where: { id: c.id },
        });
        if (existing && existing.ownerId !== ownerId)
          throw new ConflictException('Course identifier is already used.');
        if (!existing)
          await tx.learningCourse.create({
            data: { id: c.id, ownerId, archived: c.archived },
          });
      }
      return { state, revision: 1 };
    });
  }
  async command(ownerId: string, body: any) {
    if (
      !object(body) ||
      !Number.isSafeInteger(body.expectedRevision) ||
      !object(body.command)
    )
      throw new BadRequestException('Invalid editor command.');
    const command = body.command;
    if (typeof command.type !== 'string')
      throw new BadRequestException('Invalid command type.');
    if (
      command.type.endsWith('.archive') &&
      typeof command.archived !== 'boolean'
    )
      throw new BadRequestException('Invalid archive action.');
    if (
      command.type.endsWith('.reorder') &&
      ![-1, 1].includes(command.direction)
    )
      throw new BadRequestException('Invalid reorder direction.');
    if (
      typeof command.type !== 'string' ||
      !/^(course|module|activity|theory|quiz|lab|workshop)\.(create|update|duplicate|status|archive|delete|reorder|move|save)$/.test(
        command.type,
      )
    )
      throw new BadRequestException('Unknown editor command.');
    if (command.type === 'course.create' && !safeKey(command.id))
      throw new BadRequestException('Use a valid course identifier.');
    return this.db.$transaction(async (tx) => {
      const row = await tx.instructorWorkspace.findUniqueOrThrow({
        where: { ownerId },
      });
      if (row.revision !== body.expectedRevision)
        throw new ConflictException(
          'Content changed in another tab. Reload the saved content before retrying.',
        );
      let result: any;
      try {
        result = domain.applyInstructorCommand(row.document, command);
      } catch (e) {
        throw new BadRequestException(
          e instanceof Error ? e.message : 'Invalid command.',
        );
      }
      if (command.type.endsWith('.save')) {
        result.state = structuredClone(result.state);
        result.state.courses.find((c) => c.id === command.courseId).status =
          'draft';
      }
      const changed = await tx.instructorWorkspace.updateMany({
        where: { ownerId, revision: row.revision },
        data: { document: result.state, revision: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException('Content changed. Reload before retrying.');
      for (const course of result.state.courses) {
        const exists = await tx.learningCourse.findUnique({
          where: { id: course.id },
        });
        if (exists && exists.ownerId !== ownerId)
          throw new ConflictException('Course identifier is already in use.');
        await tx.learningCourse.upsert({
          where: { id: course.id },
          create: { id: course.id, ownerId, archived: course.archived },
          update: { archived: course.archived },
        });
      }
      if (command.type === 'course.status') {
        const course = result.state.courses.find(
          (c) => c.id === command.courseId,
        );
        if (command.status === 'published') {
          const version = await tx.learningPublication.create({
            data: {
              courseId: course.id,
              document: domain.publishCourse(result.state, course),
            },
          });
          await tx.learningCourse.update({
            where: { id: course.id },
            data: { liveVersionId: version.id },
          });
        } else
          await tx.learningCourse.update({
            where: { id: course.id },
            data: { liveVersionId: null },
          });
      }
      return { state: result.state, id: result.id, revision: row.revision + 1 };
    });
  }
  async publications() {
    const instructor = await this.db.user.findUnique({
      where: { email: 'decode.instructor@gmail.com' },
    });
    if (instructor?.role === 'INSTRUCTOR') await this.initialize(instructor.id);
    return this.db.learningCourse.findMany({
      where: { archived: false, liveVersionId: { not: null } },
      include: { liveVersion: true },
    });
  }
  async curriculum() {
    return {
      courses: (await this.publications()).map((c) => ({
        ...domain.studentCourse(c.liveVersion.document),
        publicationId: c.liveVersionId,
      })),
    };
  }
  async progress(studentId: string) {
    const row = await this.db.learningProgress.upsert({
      where: { studentId },
      create: { studentId, document: domain.emptyProgress() },
      update: {},
    });
    return { progress: row.document, revision: row.revision };
  }
  async saveProgress(studentId: string, body: any) {
    if (
      !object(body) ||
      !Number.isSafeInteger(body.expectedRevision) ||
      !object(body.progress) ||
      body.progress.version !== 1
    )
      throw new BadRequestException('Invalid learning record.');
    const publications = await this.publications();
    if (body.publicationIds !== undefined) {
      if (!object(body.publicationIds))
        throw new BadRequestException('Invalid content versions.');
      for (const [courseId, version] of Object.entries(body.publicationIds)) {
        if (
          publications.find((c) => c.id === courseId)?.liveVersionId !== version
        )
          throw new ConflictException(
            'Published content changed. Reload this page before saving further work.',
          );
      }
    }
    const activities = publications.flatMap((c) =>
      (c.liveVersion.document as any).modules.flatMap((m) => m.activities),
    );
    const byKind = (kind: string) =>
      new Set(
        activities
          .filter((a) => a.reference.kind === kind)
          .map((a) => a.reference.id),
      );
    return this.db.$transaction(async (tx) => {
      const row = await tx.learningProgress.findUniqueOrThrow({
        where: { studentId },
      });
      if (row.revision !== body.expectedRevision)
        throw new ConflictException(
          'Learning records changed on another device. Refresh before saving again.',
        );
      const old: any = row.document,
        input = body.progress,
        next = structuredClone(old);
      for (const [field, kind] of [
        ['lessons', 'lesson'],
        ['challenges', 'exercise'],
        ['projects', 'project'],
      ]) {
        if (
          !Array.isArray(input[field]) ||
          input[field].some((id) => !safeKey(id))
        )
          throw new BadRequestException('Invalid completion records.');
        const allowed = byKind(kind);
        next[field] = [
          ...new Set([
            ...old[field],
            ...input[field].filter((id) => allowed.has(id)),
          ]),
        ];
      }
      for (const field of [
        'drafts',
        'quizSessions',
        'labChecks',
        'workshops',
      ]) {
        if (!object(input[field] ?? {}))
          throw new BadRequestException('Invalid workspace.');
        next[field] = { ...old[field] };
        for (const [id, value] of Object.entries(input[field] ?? {})) {
          if (!safeKey(id) || !object(value))
            throw new BadRequestException('Invalid workspace entry.');
          const v: any = value;
          if (field === 'drafts') {
            if (
              !['html', 'css', 'javascript'].every(
                (k) => typeof v[k] === 'string' && v[k].length <= 100000,
              )
            )
              throw new BadRequestException('Invalid code draft.');
            const allowed =
              id.startsWith('playground-') ||
              activities.some(
                (a) =>
                  id ===
                  ({
                    lesson: 'lesson-',
                    exercise: 'challenge-',
                    project: 'project-',
                  }[a.reference.kind] ?? 'invalid-') +
                    a.reference.id,
              );
            if (!allowed) continue;
          } else {
            const kind = {
              quizSessions: 'quiz',
              labChecks: 'exercise',
              workshops: 'project',
            }[field];
            if (!byKind(kind).has(id)) continue;
            if (field === 'quizSessions') {
              const questions = activities.find(
                (a) => a.reference.kind === 'quiz' && a.reference.id === id,
              ).content.questions;
              if (
                !object(v.answers) ||
                !Number.isSafeInteger(v.index) ||
                v.index < 0 ||
                v.index >= questions.length ||
                Object.entries(v.answers).some(
                  ([key, index]) =>
                    !questions.some(
                      (q) =>
                        q.id === key &&
                        Number.isInteger(index) &&
                        q.options[index as number],
                    ),
                )
              )
                throw new BadRequestException('Invalid quiz session.');
            }
            if (
              field === 'workshops' &&
              (!Array.isArray(v.completedSteps) ||
                typeof v.currentStep !== 'string')
            )
              throw new BadRequestException('Invalid workshop state.');
            if (field === 'labChecks') {
              const activity = activities.find(
                (a) => a.reference.kind === 'exercise' && a.reference.id === id,
              );
              if (
                !Array.isArray(v.requirements) ||
                !Number.isSafeInteger(v.attempts) ||
                v.attempts < 1 ||
                v.requirements.length !== activity.content.checks.length ||
                !activity.content.checks.every((c) =>
                  v.requirements.some(
                    (r) => r.id === c.id && typeof r.passed === 'boolean',
                  ),
                )
              )
                throw new BadRequestException('Invalid lab check.');
              v.passed = v.requirements.every((r) => r.passed);
              v.verification = 'browser-check';
            }
            if (field === 'workshops') {
              const activity = activities.find(
                (a) => a.reference.kind === 'project' && a.reference.id === id,
              );
              if (
                v.completedSteps.some(
                  (id) => !activity.content.steps.some((s) => s.id === id),
                ) ||
                !activity.content.steps.some((s) => s.id === v.currentStep)
              )
                throw new BadRequestException('Invalid workshop step.');
            }
          }
          next[field][id] = v;
        }
      }
      // Scores and history are server-owned and cannot be overwritten by workspace saves.
      next.currentLesson =
        input.currentLesson === null ||
        byKind('lesson').has(input.currentLesson)
          ? input.currentLesson
          : old.currentLesson;
      if (!Array.isArray(input.visits) || !Array.isArray(input.activity))
        throw new BadRequestException('Invalid activity history.');
      next.visits = input.visits
        .filter(
          (v) =>
            object(v) &&
            activities.some(
              (a) => a.reference.kind + ':' + a.reference.id === v.activityId,
            ) &&
            typeof v.at === 'string' &&
            Number.isFinite(Date.parse(v.at)),
        )
        .slice(0, 1000);
      next.activity = input.activity
        .filter(
          (v) =>
            object(v) &&
            typeof v.id === 'string' &&
            typeof v.title === 'string' &&
            v.title.length <= 1000 &&
            typeof v.at === 'string' &&
            typeof v.href === 'string' &&
            /^\/(lessons|quizzes|challenges|projects)\/[a-zA-Z0-9:_-]+$/.test(
              v.href,
            ),
        )
        .slice(0, 20);
      for (const id of next.projects.filter(
        (id) => !old.projects.includes(id),
      )) {
        const a = activities.find(
          (a) => a.reference.kind === 'project' && a.reference.id === id,
        );
        if (
          !a.content.steps.every((s) =>
            next.workshops[id]?.completedSteps.includes(s.id),
          )
        )
          throw new BadRequestException(
            'Review every workshop step before completing it.',
          );
        const owner = publications.find((c) =>
          (c.liveVersion.document as any).modules.some((m) =>
            m.activities.some((item) => item.id === a.id),
          ),
        )!;
        await tx.learningSubmission.create({
          data: {
            studentId,
            publicationId: owner.liveVersionId!,
            activityId: a.id,
            referenceId: id,
            courseId: owner.id,
            courseTitle: (owner.liveVersion.document as any).title,
            workshopTitle: a.content.title,
            code: next.drafts['project-' + id] ?? a.content.starter,
          },
        });
      }
      for (const id of next.challenges.filter(
        (id) => !old.challenges.includes(id),
      ))
        if (!next.labChecks[id]?.passed)
          throw new BadRequestException(
            'Pass the lab checks before completing.',
          );
      const saved = await tx.learningProgress.updateMany({
        where: { studentId, revision: row.revision },
        data: { document: next, revision: { increment: 1 } },
      });
      if (!saved.count)
        throw new ConflictException(
          'Learning records changed. Refresh before saving again.',
        );
      return { progress: next, revision: row.revision + 1 };
    });
  }
  async resetProgress(studentId: string, body: any) {
    if (!object(body) || !Number.isSafeInteger(body.expectedRevision))
      throw new BadRequestException('Invalid learning revision.');
    const progress = domain.emptyProgress();
    const changed = await this.db.learningProgress.updateMany({
      where: { studentId, revision: body.expectedRevision },
      data: { document: progress, revision: { increment: 1 } },
    });
    if (!changed.count)
      throw new ConflictException(
        'Learning records changed. Refresh before resetting.',
      );
    return { progress, revision: body.expectedRevision + 1 };
  }
  async quiz(studentId: string, body: any) {
    if (
      !object(body) ||
      !safeKey(body.activityId) ||
      !safeKey(body.requestKey) ||
      typeof body.publicationId !== 'string' ||
      !object(body.answers)
    )
      throw new BadRequestException('Invalid quiz attempt.');
    const hash = createHash('sha256')
      .update(
        JSON.stringify([
          body.activityId,
          body.publicationId,
          Object.entries(body.answers).sort(),
        ]),
      )
      .digest('hex');
    await this.progress(studentId);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`;
      const prior = await tx.learningQuizAttempt.findUnique({
        where: {
          studentId_requestKey: { studentId, requestKey: body.requestKey },
        },
      });
      if (prior) {
        if (prior.payloadHash !== hash)
          throw new ConflictException('Attempt identifier was already used.');
        const current = await tx.learningProgress.findUniqueOrThrow({
          where: { studentId },
        });
        return {
          ...(prior.result as any),
          progress: current.document,
          revision: current.revision,
        };
      }
      const publication = await tx.learningPublication.findUnique({
        where: { id: body.publicationId },
        include: { course: true },
      });
      if (
        !publication ||
        publication.course.archived ||
        publication.course.liveVersionId !== publication.id
      )
        throw new ConflictException(
          'This quiz has changed. Reload before submitting.',
        );
      const activity = (publication.document as any).modules
        .flatMap((m) => m.activities)
        .find((a) => a.id === body.activityId && a.type === 'quiz');
      if (!activity) throw new NotFoundException('Quiz not found.');
      const questions = activity.content.questions;
      if (
        Object.keys(body.answers).length !== questions.length ||
        questions.some(
          (q) =>
            !Number.isInteger(body.answers[q.id]) ||
            !q.options[body.answers[q.id]],
        )
      )
        throw new BadRequestException(
          'Answer every question with a valid option.',
        );
      const correct = questions.filter(
        (q) => q.options[body.answers[q.id]].id === q.correctOptionId,
      );
      const percent = Math.round(
        (correct.reduce((sum, q) => sum + (q.points ?? 1), 0) /
          questions.reduce((sum, q) => sum + (q.points ?? 1), 0)) *
          100,
      );
      const review = questions.map((q) => ({
        id: q.id,
        topic: q.topic,
        prompt: q.prompt,
        options: q.options.map((o) => o.text),
        correct: q.options.findIndex((o) => o.id === q.correctOptionId),
        explanation: q.explanation,
      }));
      const attempt = {
        review,
        id: body.requestKey,
        answers: body.answers,
        correct: correct.length,
        total: questions.length,
        percent,
        at: new Date().toISOString(),
        publicationId: publication.id,
      };
      const row = await tx.learningProgress.findUniqueOrThrow({
        where: { studentId },
      });
      const progress: any = structuredClone(row.document),
        key = activity.reference.id;
      const previous = progress.quizzes[key];
      progress.quizzes[key] = {
        latest: percent,
        best: Math.max(previous?.best ?? 0, percent),
        attempts: (previous?.attempts ?? 0) + 1,
        at: attempt.at,
      };
      progress.quizHistory ??= {};
      progress.quizHistory[key] = [
        attempt,
        ...(progress.quizHistory[key] ?? []),
      ].slice(0, 20);
      delete progress.quizSessions?.[key];
      progress.activity = [
        {
          id: attempt.id,
          title: activity.title + ': ' + percent + '%',
          at: attempt.at,
          href: '/quizzes/' + key,
        },
        ...progress.activity,
      ].slice(0, 20);
      const saved = await tx.learningProgress.updateMany({
        where: { studentId, revision: row.revision },
        data: { document: progress, revision: { increment: 1 } },
      });
      if (!saved.count)
        throw new ConflictException(
          'Learning records changed. Retry submission.',
        );
      const result = {
        attempt,
        questions: questions.map((q) => ({
          id: q.id,
          correct: q.options.findIndex((o) => o.id === q.correctOptionId),
          explanation: q.explanation,
        })),
        progress,
        revision: row.revision + 1,
      };
      await tx.learningQuizAttempt.create({
        data: {
          studentId,
          publicationId: publication.id,
          activityId: activity.id,
          requestKey: body.requestKey,
          payloadHash: hash,
          result,
        },
      });
      return result;
    });
  }
  async submissions(userId: string, instructor = false) {
    const rows = await this.db.learningSubmission.findMany({
      where: instructor
        ? { publication: { course: { ownerId: userId } } }
        : { studentId: userId },
      include: { student: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return {
      records: rows.map((r) => ({
        id: r.id,
        studentName: r.student.name,
        courseId: r.courseId,
        activityId: r.activityId,
        referenceId: r.referenceId,
        courseTitle: r.courseTitle,
        workshopTitle: r.workshopTitle,
        projectTitle: r.workshopTitle,
        status: r.status,
        feedback: instructor ? r.feedback : r.publishedFeedback,
        revision: r.revision,
        createdAt: r.createdAt,
        submittedAt: r.createdAt,
        updatedAt: r.updatedAt,
        reviewedAt: r.reviewedAt,
      })),
    };
  }
  async review(ownerId: string, body: any) {
    if (
      !object(body) ||
      !safeKey(body.id) ||
      !['pending', 'in-review', 'reviewed', 'changes-requested'].includes(
        body.status,
      ) ||
      typeof body.feedback !== 'string' ||
      body.feedback.length > 10000 ||
      !Number.isSafeInteger(body.expectedRevision)
    )
      throw new BadRequestException('Invalid review.');
    const final = ['reviewed', 'changes-requested'].includes(body.status);
    if (final && body.feedback.trim().length < 3)
      throw new BadRequestException(
        'Add feedback before completing the review.',
      );
    const updated = await this.db.learningSubmission.updateMany({
      where: {
        id: body.id,
        revision: body.expectedRevision,
        publication: { course: { ownerId } },
      },
      data: {
        status: body.status,
        feedback: body.feedback,
        revision: { increment: 1 },
        ...(final
          ? { publishedFeedback: body.feedback, reviewedAt: new Date() }
          : {}),
      },
    });
    if (!updated.count)
      throw new ConflictException(
        'Review changed or is unavailable. Reload before saving.',
      );
    return this.submissions(ownerId, true);
  }
  async submissionCode(ownerId: string, id: string) {
    const row = await this.db.learningSubmission.findFirst({
      where: { id, publication: { course: { ownerId } } },
      select: { code: true },
    });
    if (!row) throw new NotFoundException('Submission not found.');
    return row.code;
  }
  async resubmit(studentId: string, body: any) {
    if (!object(body) || !safeKey(body.id))
      throw new BadRequestException('Invalid submission.');
    return this.db.$transaction(async (tx) => {
      const old = await tx.learningSubmission.findFirst({
        where: { id: body.id, studentId, status: 'changes-requested' },
      });
      if (!old)
        throw new ConflictException('Submission is not awaiting changes.');
      const p = await tx.learningProgress.findUniqueOrThrow({
        where: { studentId },
      });
      const code = (p.document as any).drafts['project-' + old.referenceId];
      if (!code) throw new BadRequestException('Save your project code first.');
      const changed = await tx.learningSubmission.updateMany({
        where: {
          id: old.id,
          revision: old.revision,
          status: 'changes-requested',
        },
        data: {
          status: 'pending',
          revision: { increment: 1 },
          code,
          feedback: '',
        },
      });
      if (!changed.count)
        throw new ConflictException('Submission changed. Retry.');
      return { ok: true };
    });
  }
  async insights(ownerId: string) {
    const courses = await this.db.learningCourse.findMany({
      where: { ownerId, liveVersionId: { not: null } },
      include: { liveVersion: true },
    });
    const records = await this.db.learningProgress.findMany({
      include: { student: { select: { id: true, name: true } } },
    });
    return {
      courses: courses.map((c) => {
        const doc: any = c.liveVersion.document,
          activities = doc.modules.flatMap((m) => m.activities);
        const students = records
          .map((row) => {
            const p: any = row.document;
            const completed = activities.filter((a) =>
              a.type === 'quiz'
                ? (p.quizzes[a.reference.id]?.best ?? 0) >= 70
                : p[
                    {
                      theory: 'lessons',
                      lab: 'challenges',
                      workshop: 'projects',
                    }[a.type]
                  ]?.includes(a.reference.id),
            ).length;
            const visited = p.visits.some((v) =>
              activities.some(
                (a) => a.reference.kind + ':' + a.reference.id === v.activityId,
              ),
            );
            return {
              id: row.student.id,
              name: row.student.name,
              completed,
              total: activities.length,
              started: visited || completed > 0,
              updatedAt: row.updatedAt,
            };
          })
          .filter((s) => s.started);
        return {
          id: c.id,
          title: doc.title,
          students,
          learners: students.length,
          completed: students.filter(
            (s) => s.total > 0 && s.completed === s.total,
          ).length,
        };
      }),
      registeredStudents: await this.db.user.count({
        where: { role: 'STUDENT' },
      }),
    };
  }
}
