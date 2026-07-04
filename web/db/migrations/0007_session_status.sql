ALTER TABLE sessions ADD COLUMN status text NOT NULL DEFAULT 'waiting';
-- All existing sessions were already in active play; mark them active.
UPDATE sessions SET status = 'active';
