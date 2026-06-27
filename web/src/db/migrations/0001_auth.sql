-- Auth.js tables
CREATE TABLE IF NOT EXISTS "auth_users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "email" text UNIQUE,
  "emailVerified" timestamp,
  "image" text
);

CREATE TABLE IF NOT EXISTS "auth_accounts" (
  "userId" text NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "provider" text NOT NULL,
  "providerAccountId" text NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" text,
  "scope" text,
  "id_token" text,
  "session_state" text,
  PRIMARY KEY ("provider", "providerAccountId")
);

CREATE TABLE IF NOT EXISTS "auth_verification_tokens" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" timestamp NOT NULL,
  PRIMARY KEY ("identifier", "token")
);

-- Migrate quizzes.teacher_id and sessions.teacher_id from uuid → text
-- (Auth.js uses text IDs; drop old FK to teacher_profiles first)
ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_teacher_id_fkey;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_teacher_id_fkey;

-- Nullify old IDs (they referenced Supabase auth.users, won't match new auth_users)
UPDATE quizzes SET teacher_id = NULL;
UPDATE sessions SET teacher_id = NULL;

ALTER TABLE quizzes  ALTER COLUMN teacher_id TYPE text USING teacher_id::text;
ALTER TABLE sessions ALTER COLUMN teacher_id TYPE text USING teacher_id::text;

ALTER TABLE quizzes  ADD CONSTRAINT quizzes_teacher_id_fkey  FOREIGN KEY (teacher_id) REFERENCES auth_users(id) ON DELETE CASCADE;
ALTER TABLE sessions ADD CONSTRAINT sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth_users(id) ON DELETE CASCADE;

-- Drop Supabase-specific tables
DROP TABLE IF EXISTS teacher_profiles CASCADE;
