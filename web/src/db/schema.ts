import { pgTable, uuid, text, boolean, integer, bigint, jsonb, timestamp, primaryKey, date, doublePrecision, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AdapterAccountType } from 'next-auth/adapters';

// ── Auth.js tables ──────────────────────────────────────────────────────────
export const authUsers = pgTable('auth_users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  password: text('password'),
});

export const authAccounts = pgTable('auth_accounts', {
  userId: text('userId').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  type: text('type').$type<AdapterAccountType>().notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

export const authVerificationTokens = pgTable('auth_verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

// ── App tables ──────────────────────────────────────────────────────────────
export const quizzes = pgTable('quizzes', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teacherId: text('teacher_id').references(() => authUsers.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  source: text('source'),
  timePerQuestion: integer('time_per_question').default(45),
  questions: jsonb('questions').notNull(),
  skippedSections: jsonb('skipped_sections'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  quizId: uuid('quiz_id').references(() => quizzes.id, { onDelete: 'cascade' }),
  teacherId: text('teacher_id').references(() => authUsers.id, { onDelete: 'cascade' }),
  code: text('code').unique().notNull(),
  isActive: boolean('is_active').default(true),
  questionsSubset: jsonb('questions_subset'),
  batchId: uuid('batch_id'),
  batchOrder: integer('batch_order'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`),
});

// ── Student tables ───────────────────────────────────────────────────────────
export const students = pgTable('students', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  username: text('username').unique().notNull(),
  pinHash: text('pin_hash').notNull(),
  displayName: text('display_name').notNull(),
  createdBy: text('created_by').references(() => authUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
});

export const studentStats = pgTable('student_stats', {
  studentId: uuid('student_id').primaryKey().references(() => students.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  totalGames: integer('total_games').notNull().default(0),
  totalCorrect: integer('total_correct').notNull().default(0),
  totalAnswered: integer('total_answered').notNull().default(0),
  lastPlayedDate: date('last_played_date'),
  consecutivePerfect: integer('consecutive_perfect').notNull().default(0),
  badges: jsonb('badges').notNull().default(sql`'[]'::jsonb`),
});

export const studentQuestionStats = pgTable('student_question_stats', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  quizId: uuid('quiz_id').notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull(),
  correctCount: integer('correct_count').notNull().default(0),
  wrongCount: integer('wrong_count').notNull().default(0),
  easeFactor: doublePrecision('ease_factor').notNull().default(2.5),
  repetitions: integer('repetitions').notNull().default(0),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).default(sql`now()`),
});

export const attempts = pgTable('attempts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  quizId: uuid('quiz_id').references(() => quizzes.id),
  studentId: uuid('student_id').references(() => students.id, { onDelete: 'set null' }),
  studentName: text('student_name').notNull(),
  score: integer('score').notNull(),
  totalQuestions: integer('total_questions').notNull(),
  timeSpentMs: bigint('time_spent_ms', { mode: 'number' }).notNull(),
  answers: jsonb('answers').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).default(sql`now()`),
});

// ── Real-time monitoring ─────────────────────────────────────────────────────
export const sessionProgress = pgTable(
  'session_progress',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
    studentName: text('student_name').notNull(),
    currentQuestion: integer('current_question').notNull().default(0),
    score: integer('score').notNull().default(0),
    totalQuestions: integer('total_questions').notNull().default(0),
    isFinished: boolean('is_finished').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`),
  },
  (t) => [unique().on(t.sessionId, t.studentName)]
);
