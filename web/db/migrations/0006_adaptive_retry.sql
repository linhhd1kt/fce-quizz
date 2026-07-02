-- Remove any duplicate rows before adding unique constraint
DELETE FROM student_question_stats a
USING student_question_stats b
WHERE a.id > b.id
  AND a.student_id = b.student_id
  AND a.quiz_id = b.quiz_id
  AND a.question_id = b.question_id;

ALTER TABLE student_question_stats
  ADD COLUMN IF NOT EXISTS repetitions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ;

ALTER TABLE student_question_stats
  DROP CONSTRAINT IF EXISTS sqstats_student_quiz_question_unique;
ALTER TABLE student_question_stats
  ADD CONSTRAINT sqstats_student_quiz_question_unique
  UNIQUE (student_id, quiz_id, question_id);
