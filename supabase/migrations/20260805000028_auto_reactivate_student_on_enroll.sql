-- When a student is (re-)enrolled in a group or opens a new individual pack,
-- flip students.is_active back to true if they were inactive. Applies on
-- INSERT and on UPDATE to status='active' (covers reactivation of a
-- previously withdrawn enrollment).

create or replace function public.reactivate_student_on_enroll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    update public.students
       set is_active = true
     where id = new.student_id
       and is_active = false
       and archived = false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reactivate_on_enroll on public.course_enrollments;
create trigger trg_reactivate_on_enroll
  after insert or update of status on public.course_enrollments
  for each row execute function public.reactivate_student_on_enroll();

-- Same for individual_schedules: creating an active schedule for a student
-- means they're a student again.
create or replace function public.reactivate_student_on_individual_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active = true then
    update public.students
       set is_active = true
     where id = new.student_id
       and is_active = false
       and archived = false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reactivate_on_individual_schedule on public.individual_schedules;
create trigger trg_reactivate_on_individual_schedule
  after insert or update of is_active on public.individual_schedules
  for each row execute function public.reactivate_student_on_individual_schedule();
