// Run after build. All mutations are confined to a fresh, disposable schema.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client.js');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const { AppModule } = require('../dist/app.module.js');
const { PrismaService } = require('../dist/prisma/prisma.service.js');
const { hashPassword } = require('../dist/auth/password.js');
const schema = 'workflow_test_' + randomUUID().replaceAll('-', '');
const pg = new Client({ connectionString: process.env.DATABASE_URL });
let app, db;
async function main() {
  await pg.connect();
  await pg.query('CREATE SCHEMA "' + schema + '"');
  await pg.query('SET search_path TO "' + schema + '"');
  for (const name of fs
    .readdirSync(path.join(__dirname, '../prisma/migrations'))
    .sort()) {
    const file = path.join(
      __dirname,
      '../prisma/migrations',
      name,
      'migration.sql',
    );
    if (fs.existsSync(file)) await pg.query(fs.readFileSync(file, 'utf8'));
  }
  db = new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString: process.env.DATABASE_URL,
        options: '-c timezone=UTC',
      },
      { schema },
    ),
  });
  const password = 'Workflow-test-123!';
  await db.user.create({
    data: {
      name: 'Instructor',
      email: 'decode.instructor@gmail.com',
      role: 'INSTRUCTOR',
      passwordHash: await hashPassword(password),
    },
  });
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(db)
    .compile();
  app = module.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  const http = request(app.getHttpServer());
  async function auth(action, body) {
    const r = await http
      .post('/api/auth/' + action)
      .set('Origin', 'http://localhost:3000')
      .send(body);
    assert.ok([200, 201].includes(r.status), JSON.stringify(r.body));
    return r.headers['set-cookie'][0].split(';')[0];
  }
  const instructor = await auth('login', {
    email: 'decode.instructor@gmail.com',
    password,
  });
  const student = await auth('register', {
    name: 'Student One',
    email: 'one@example.com',
    password,
  });
  const other = await auth('register', {
    name: 'Student Two',
    email: 'two@example.com',
    password,
  });
  async function api(cookie, method, url, body, status = 200) {
    let r = http[method]('/api/learning/' + url)
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:3000');
    if (body) r = r.send(body);
    r = await r;
    assert.equal(r.status, status, url + ': ' + JSON.stringify(r.body));
    return r.body;
  }
  await http.get('/api/learning/curriculum').expect(401);
  await api(student, 'get', 'instructor', null, 403);
  await api(instructor, 'get', 'progress', null, 403);
  let workspace = await api(instructor, 'get', 'instructor');
  await http
    .post('/api/learning/instructor/commands')
    .set('Cookie', instructor)
    .set('Origin', 'https://untrusted.example')
    .send({})
    .expect(403);
  await api(
    instructor,
    'post',
    'instructor/import-drafts',
    { raw: '{broken' },
    400,
  );
  const domain = require('../domain/learning.cjs');
  const imported = domain.applyInstructorCommand(workspace.state, {
    type: 'course.create',
    id: 'browser-draft',
    fields: {
      title: 'Browser draft',
      description: 'Preserved authoring work',
      category: 'Web',
      difficulty: 'Beginner',
      duration: '1 hour',
      objectives: ['Preserve edits'],
      color: 'blue',
      icon: 'code',
    },
  }).state;
  workspace = await api(
    instructor,
    'post',
    'instructor/import-drafts',
    { raw: JSON.stringify(imported) },
    201,
  );
  assert.equal(
    workspace.state.courses.find((c) => c.id === 'browser-draft').status,
    'draft',
  );
  await api(
    instructor,
    'post',
    'instructor/import-drafts',
    { raw: JSON.stringify(imported) },
    409,
  );
  const original = await api(student, 'get', 'curriculum');
  assert.equal(original.courses.length, 3);
  assert.ok(
    original.courses.every((c) =>
      c.modules.every((m) =>
        m.activities.every(
          (a) =>
            a.type !== 'quiz' ||
            a.content.questions.every((q) => q.correctOptionId === null),
        ),
      ),
    ),
  );
  let revision = workspace.revision;
  async function command(command) {
    const r = await api(
      instructor,
      'post',
      'instructor/commands',
      { command, expectedRevision: revision },
      201,
    );
    revision = r.revision;
    return r;
  }
  const courseId = 'integration-course';
  await command({
    type: 'course.create',
    id: courseId,
    fields: {
      title: 'Integration course',
      description: 'Learning workflow',
      category: 'Testing',
      difficulty: 'Beginner',
      duration: '1 hour',
      objectives: ['Connect workflows'],
      color: 'blue',
      icon: 'code',
    },
  });
  const moduleId = (
    await command({
      type: 'module.create',
      courseId,
      title: 'First module',
      description: 'Learn and practice',
    })
  ).id;
  const activityId = (
    await command({
      type: 'activity.create',
      courseId,
      moduleId,
      activityType: 'quiz',
      title: 'New quiz',
      description: 'Answer the question',
    })
  ).id;
  await command({
    type: 'quiz.save',
    courseId,
    moduleId,
    activityId,
    expectedUpdatedAt: null,
    expectedRevision: null,
    content: {
      title: 'New quiz',
      instructions: 'Choose the right answer',
      questions: [
        {
          id: 'q1',
          topic: 'Basics',
          prompt: 'Two plus two?',
          options: [
            { id: 'a', text: '4' },
            { id: 'b', text: '5' },
          ],
          correctOptionId: 'a',
          explanation: 'Two and two is four.',
          points: 2,
        },
      ],
    },
  });
  assert.equal((await api(student, 'get', 'curriculum')).courses.length, 3);
  await api(
    instructor,
    'post',
    'instructor/commands',
    {
      command: { type: 'course.status', courseId, status: 'published' },
      expectedRevision: 0,
    },
    409,
  );
  await command({ type: 'course.status', courseId, status: 'published' });
  const course = (await api(student, 'get', 'curriculum')).courses.find(
    (c) => c.id === courseId,
  );
  assert.ok(course);
  await assert.rejects(
    db.learningPublication.update({
      where: { id: course.publicationId },
      data: { document: {} },
    }),
    /immutable/,
  );
  assert.equal(
    course.modules[0].activities[0].content.questions[0].correctOptionId,
    null,
  );
  let p = await api(student, 'get', 'progress');
  p.progress.quizzes.forged = {
    best: 100,
    latest: 100,
    attempts: 1,
    at: new Date().toISOString(),
  };
  p = await api(student, 'put', 'progress', {
    expectedRevision: p.revision,
    progress: p.progress,
  });
  assert.equal(p.progress.quizzes.forged, undefined);
  const payload = {
    activityId,
    publicationId: course.publicationId,
    requestKey: randomUUID(),
    answers: { q1: 0 },
  };
  const result = await api(student, 'post', 'quiz-attempts', payload, 201);
  assert.equal(result.attempt.percent, 100);
  assert.equal(result.progress.quizzes[activityId].attempts, 1);
  await api(student, 'post', 'quiz-attempts', payload, 201);
  assert.equal(
    (await api(student, 'get', 'progress')).progress.quizzes[activityId]
      .attempts,
    1,
  );
  await api(
    student,
    'post',
    'quiz-attempts',
    { ...payload, answers: { q1: 1 } },
    409,
  );
  assert.deepEqual((await api(other, 'get', 'progress')).progress.quizzes, {});
  assert.equal(
    (await api(instructor, 'get', 'instructor/insights')).courses.find(
      (c) => c.id === courseId,
    ).completed,
    1,
  );
  await command({ type: 'course.status', courseId, status: 'draft' });
  assert.equal((await api(student, 'get', 'curriculum')).courses.length, 3);
  assert.equal(
    (await api(student, 'get', 'progress')).progress.quizzes[activityId].best,
    100,
  );
  await api(
    student,
    'post',
    'quiz-attempts',
    { ...payload, requestKey: randomUUID() },
    409,
  );
  const project = original.courses
    .flatMap((c) => c.modules.flatMap((m) => m.activities))
    .find((a) => a.type === 'workshop');
  const id = project.reference.id;
  p = await api(student, 'get', 'progress');
  p.progress.workshops[id] = {
    completedSteps: project.content.steps.map((s) => s.id),
    currentStep: project.content.steps[0].id,
    at: new Date().toISOString(),
  };
  p.progress.drafts['project-' + id] = {
    html: '<h1>Student work</h1>',
    css: '',
    javascript: '',
  };
  p.progress.projects.push(id);
  await api(student, 'put', 'progress', {
    progress: p.progress,
    expectedRevision: p.revision,
  });
  const submissions = await api(instructor, 'get', 'instructor/submissions');
  assert.equal(submissions.records.length, 1);
  const submission = submissions.records[0];
  assert.match(
    (
      await api(
        instructor,
        'get',
        'instructor/submissions/' + submission.id + '/code',
      )
    ).html,
    /Student work/,
  );
  await api(
    student,
    'get',
    'instructor/submissions/' + submission.id + '/code',
    null,
    403,
  );
  await api(
    instructor,
    'post',
    'instructor/reviews',
    {
      id: submission.id,
      status: 'in-review',
      feedback: 'Private draft',
      expectedRevision: 1,
    },
    201,
  );
  assert.equal(
    (await api(student, 'get', 'submissions')).records[0].feedback,
    '',
  );
  await api(
    instructor,
    'post',
    'instructor/reviews',
    {
      id: submission.id,
      status: 'changes-requested',
      feedback: 'Please add a navigation link.',
      expectedRevision: 2,
    },
    201,
  );
  assert.match(
    (await api(student, 'get', 'submissions')).records[0].feedback,
    /navigation/,
  );
  assert.equal((await api(other, 'get', 'submissions')).records.length, 0);
  await api(
    student,
    'post',
    'submissions/resubmit',
    { id: submission.id },
    201,
  );
  assert.equal(
    (await api(instructor, 'get', 'instructor/submissions')).records[0].status,
    'pending',
  );
  // One browser cookie jar must carry both accounts, regardless of login order.
  for (const first of ['student', 'instructor']) {
    const browser = request.agent(app.getHttpServer());
    const emails = {
      student: 'one@example.com',
      instructor: 'decode.instructor@gmail.com',
    };
    const second = first === 'student' ? 'instructor' : 'student';
    for (const role of [first, second]) {
      const login = await browser
        .post('/api/auth/login')
        .send({ email: emails[role], password })
        .expect(200);
      assert.ok(
        login.headers['set-cookie'].some(
          (c) =>
            c.startsWith('decode_' + role + '_session=') &&
            c.includes('HttpOnly'),
        ),
      );
    }
    for (const role of ['student', 'instructor']) {
      const me = await browser.get('/api/auth/me?scope=' + role).expect(200);
      assert.equal(me.body.user.email, emails[role]);
    }
    await browser.get('/api/learning/progress').expect(200);
    await browser.get('/api/learning/instructor').expect(200);
    await browser.get('/api/auth/me?scope=unknown').expect(400);
    await browser
      .post('/api/auth/logout?scope=' + first)
      .send({})
      .expect(200);
    const stillSignedIn = await browser
      .get('/api/auth/me?scope=' + second)
      .expect(200);
    assert.equal(stillSignedIn.body.user.email, emails[second]);
    await browser
      .get(
        second === 'student'
          ? '/api/learning/progress'
          : '/api/learning/instructor',
      )
      .expect(200);
    // A second logout in the cleared scope cannot revoke the surviving legacy alias.
    await browser
      .post('/api/auth/logout?scope=' + first)
      .send({})
      .expect(200);
    await browser.get('/api/auth/me?scope=' + second).expect(200);
    await browser
      .post('/api/auth/logout?scope=' + second)
      .send({})
      .expect(200);
    await browser.get('/api/auth/me?scope=student').expect(401);
    await browser.get('/api/auth/me?scope=instructor').expect(401);
  }
  console.log(
    'PASS: concurrent instructor/student cookie jar, both login orders, scoped APIs and isolated logout.',
  );
  console.log(
    'PASS: authoring, draft isolation, publishing, grading, replay/conflicts, student isolation, dashboards, history, submissions and feedback.',
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (app) await app.close();
    if (db) await db.$disconnect();
    if (pg._connected) {
      if (!/^workflow_test_[a-f0-9]{32}$/.test(schema))
        throw new Error('Unsafe test schema');
      await pg.query('DROP SCHEMA "' + schema + '" CASCADE');
      await pg.end();
    }
  });
