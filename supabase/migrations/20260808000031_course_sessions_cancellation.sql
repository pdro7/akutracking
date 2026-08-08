-- Support cancelling an individual course session and appending a
-- replacement at the end. Cancelled sessions stay in the timeline so we
-- can see when it happened and why; the replacement is a new row with
-- session_number = max + 1, dated one week after the previous last
-- session (weekly cadence assumed).

alter table public.course_sessions
  add column if not exists status text not null default 'scheduled'
    check (status in ('scheduled','cancelled')),
  add column if not exists cancelled_reason text,
  add column if not exists cancelled_at timestamptz;

-- The original constraint capped session_number at 8. Replacement
-- sessions for cancelled classes push that number higher.
alter table public.course_sessions
  drop constraint if exists course_sessions_session_number_check;
alter table public.course_sessions
  add constraint course_sessions_session_number_check
  check (session_number >= 1);
