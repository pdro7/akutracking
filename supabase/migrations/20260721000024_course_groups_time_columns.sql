-- Groups need to record their weekly schedule (time-of-day), not just
-- the start_date. The old model only kept start/end dates, so the hour
-- at which the cohort actually meets was lost the moment a course_slot
-- was activated into a course_group. Nullable for backwards compat with
-- existing rows that pre-date this migration.

ALTER TABLE course_groups
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;
