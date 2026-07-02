-- Migration: add student auth tables and student_id to attempts
-- Run: psql $DATABASE_URL -f 0004_student_auth.sql

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_by TEXT REFERENCES auth_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS student_stats (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  total_games INTEGER NOT NULL DEFAULT 0,
  total_correct INTEGER NOT NULL DEFAULT 0,
  total_answered INTEGER NOT NULL DEFAULT 0,
  last_played_date DATE,
  consecutive_perfect INTEGER NOT NULL DEFAULT 0,
  badges JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS student_question_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, quiz_id, question_id)
);

ALTER TABLE attempts ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL;
