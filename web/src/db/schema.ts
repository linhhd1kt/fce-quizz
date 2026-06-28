import { pgTable, uuid, text, boolean, integer, bigint, jsonb, timestamp, primaryKey } from 'drizzle-orm/pg-core';
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

export const attempts = pgTable('attempts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  quizId: uuid('quiz_id').references(() => quizzes.id),
  studentName: text('student_name').notNull(),
  score: integer('score').notNull(),
  totalQuestions: integer('total_questions').notNull(),
  timeSpentMs: bigint('time_spent_ms', { mode: 'number' }).notNull(),
  answers: jsonb('answers').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).default(sql`now()`),
});
