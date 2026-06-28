ALTER TABLE sessions ADD COLUMN IF NOT EXISTS questions_subset jsonb;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS batch_id uuid;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS batch_order integer;
