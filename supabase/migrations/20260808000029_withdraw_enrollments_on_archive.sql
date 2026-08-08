-- When a student is archived, remove them from active groups and packs.
-- Archiving is the one-shot "this person is out" action; keeping the
-- enrollment rows active caused duplicates to keep showing up in
-- /virtual-groups/:id after archiving one of them.

create or replace function public.withdraw_on_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.archived = true and coalesce(old.archived, false) = false then
    update public.course_enrollments
       set status = 'withdrawn'
     where student_id = new.id
       and status = 'active';

    update public.individual_schedules
       set is_active = false
     where student_id = new.id
       and is_active = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_withdraw_on_archive on public.students;
create trigger trg_withdraw_on_archive
  after update of archived on public.students
  for each row execute function public.withdraw_on_archive();

-- Retroactive cleanup: any student already archived whose enrollments
-- were left active from before this trigger existed.
update public.course_enrollments e
   set status = 'withdrawn'
  from public.students s
 where e.student_id = s.id
   and s.archived = true
   and e.status = 'active';

update public.individual_schedules i
   set is_active = false
  from public.students s
 where i.student_id = s.id
   and s.archived = true
   and i.is_active = true;
