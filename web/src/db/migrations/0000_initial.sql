CREATE TABLE IF NOT EXISTS "teacher_profiles" (
  "id" uuid PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "quizzes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "teacher_id" uuid REFERENCES "teacher_profiles"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "source" text,
  "time_per_question" integer DEFAULT 45,
  "questions" jsonb NOT NULL,
  "skipped_sections" jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "quiz_id" uuid REFERENCES "quizzes"("id") ON DELETE CASCADE,
  "teacher_id" uuid REFERENCES "teacher_profiles"("id") ON DELETE CASCADE,
  "code" text UNIQUE NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid REFERENCES "sessions"("id") ON DELETE CASCADE,
  "quiz_id" uuid REFERENCES "quizzes"("id"),
  "student_name" text NOT NULL,
  "score" integer NOT NULL,
  "total_questions" integer NOT NULL,
  "time_spent_ms" bigint NOT NULL,
  "answers" jsonb NOT NULL,
  "completed_at" timestamp with time zone DEFAULT now()
);

-- Auto-create teacher_profile khi có user mới đăng ký
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.teacher_profiles (id, name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END $$;
