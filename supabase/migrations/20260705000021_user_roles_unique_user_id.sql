-- Fix for the invite-teacher edge function: user_roles.upsert with
-- ON CONFLICT (user_id) was failing silently because the column had no
-- unique constraint. As a result, invited teachers never got their role
-- and fell back to the app default (staff), gaining access to everything.
--
-- Enforce one role per user going forward.

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
