import { pgTable, uuid, text, boolean, integer, bigint, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const teacherProfiles = pgTable('teacher_profiles', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`),
});

export const quizzes = pgTable('quizzes', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teacherId: uuid('teacher_id').references(() => teacherProfiles.id, { onDelete: 'cascade' }),
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
  teacherId: uuid('teacher_id').references(() => teacherProfiles.id, { onDelete: 'cascade' }),
  code: text('code').unique().notNull(),
  isActive: boolean('is_active').default(true),
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
