-- M13: Fix Python course names
UPDATE public.virtual_courses SET name = 'Python Zero'     WHERE code = 'PGZ';
UPDATE public.virtual_courses SET name = 'Python Games 1'  WHERE code = 'PG1';
UPDATE public.virtual_courses SET name = 'Python Games 2'  WHERE code = 'PG2';
UPDATE public.virtual_courses SET name = 'Python Games 3'  WHERE code = 'PG3';
