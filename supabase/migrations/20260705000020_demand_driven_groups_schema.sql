-- Demand-driven group formation — Phase 1.1: schema
--
-- Adds the data needed to cluster leads by (course × slot × modality)
-- and to match those clusters against teachers with the right subject
-- expertise and availability.

-- ============================================================
-- leads: interested course FK + preferences
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS interested_course_id uuid
    REFERENCES virtual_courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_modality text
    CHECK (preferred_modality IN ('virtual','presencial','any')),
  ADD COLUMN IF NOT EXISTS desired_start_by date;

-- preferred_slots stores an array of slot IDs from the shared
-- catalog defined in src/lib/timeSlots.ts, e.g.
-- ["sat-am-1","sat-am-2","wk-pm-17"].

CREATE INDEX IF NOT EXISTS leads_interested_course_id_idx
  ON leads(interested_course_id);

-- Backfill interested_course_id from the free-text course_interest.
-- Matches are done case-insensitively against the course code or name.
-- Anything that doesn't match remains NULL and is resolved by hand.
UPDATE leads l
SET interested_course_id = vc.id
FROM virtual_courses vc
WHERE l.interested_course_id IS NULL
  AND l.course_interest IS NOT NULL
  AND (
    lower(trim(l.course_interest)) = lower(vc.code)
    OR lower(trim(l.course_interest)) = lower(vc.name)
    OR lower(l.course_interest) LIKE '%' || lower(vc.code) || '%'
  );

-- ============================================================
-- teachers: subjects, availability, modalities
-- ============================================================

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS subjects text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS availability jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS modalities text[] NOT NULL DEFAULT '{}';

-- subjects: freeform tags aligned with virtual_courses.subject
--   e.g. ['scratch','python','robotica','minecraft']
-- availability: same slot-id shape as leads.preferred_slots
--   e.g. ["sat-am-1","wk-pm-16","wk-am-9"]
-- modalities: subset of ['virtual','presencial']

-- ============================================================
-- virtual_courses: subject tag + open threshold
-- ============================================================

ALTER TABLE virtual_courses
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS min_students_to_open int NOT NULL DEFAULT 4;

-- Best-effort backfill of the subject tag from the course code prefix.
UPDATE virtual_courses
SET subject = CASE
  WHEN code ILIKE 'RC%'  THEN 'robotica'
  WHEN code ILIKE 'PG%'  THEN 'python'
  WHEN code ILIKE 'MC%'  THEN 'minecraft'
  WHEN code ILIKE 'RBX%' THEN 'roblox'
  WHEN code ILIKE 'UNI%' THEN 'unity'
  WHEN code ILIKE 'YT%'  THEN 'youtube'
  WHEN code ILIKE 'IA%'  THEN 'ia'
  ELSE subject
END
WHERE subject IS NULL;
