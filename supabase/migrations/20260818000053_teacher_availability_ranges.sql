-- teachers.availability pasa de lista de bloques a rangos por día.
--
-- Antes: ["sat-am-0900","wed-am-0900",...], IDs del catálogo de
-- src/lib/timeSlots.ts, que son bloques fijos de 90 minutos.
--
-- Ahora: [{"day":"sat","from":"09:00","to":"12:00"}, ...].
--
-- El motivo es que el catálogo son las unidades de UN consumidor —los
-- cursos, que duran hora y media— mientras que las clases de prueba y las
-- individuales duran 60 minutos. Un profesor libre a las 11:00 un miércoles
-- no tenía casilla que marcar, y añadir casillas de una en una es una
-- escalera sin fin. Un rango es lo que el profesor sabe de verdad, y de ahí
-- se derivan tanto los bloques de curso como los huecos de prueba.
--
-- leads.preferred_slots NO cambia: para un padre, elegir entre unas pocas
-- opciones gruesas es mejor que declarar horas libres.
--
-- La conversión mapea cada ID a su rango y fusiona los contiguos: quien
-- marcó "sáb 09:00–10:30" y "sáb 10:30–12:00" queda con "sáb 09:00–12:00".

with mapping as (
  -- El catálogo, replicado aquí porque vive en TypeScript. Si se añaden
  -- IDs nuevos después de esta migración, ya nacerán como rangos.
  select * from (values
    ('sat-am-0900','sat','09:00','10:30'),
    ('sat-am-1030','sat','10:30','12:00'),
    ('sat-pm-1400','sat','14:00','15:30'),
    ('sat-pm-1530','sat','15:30','17:00'),
    ('mon-am-0900','mon','09:00','10:30'),
    ('tue-am-0900','tue','09:00','10:30'),
    ('wed-am-0900','wed','09:00','10:30'),
    ('thu-am-0900','thu','09:00','10:30'),
    ('fri-am-0900','fri','09:00','10:30'),
    ('mon-am-1030','mon','10:30','12:00'),
    ('tue-am-1030','tue','10:30','12:00'),
    ('wed-am-1030','wed','10:30','12:00'),
    ('thu-am-1030','thu','10:30','12:00'),
    ('fri-am-1030','fri','10:30','12:00'),
    ('mon-pm-1630','mon','16:30','18:00'),
    ('tue-pm-1630','tue','16:30','18:00'),
    ('wed-pm-1630','wed','16:30','18:00'),
    ('thu-pm-1630','thu','16:30','18:00'),
    ('fri-pm-1630','fri','16:30','18:00')
  ) as m(slot_id, day, from_t, to_t)
),
-- Sólo profesores cuyo availability sigue siendo lista de strings.
exploded as (
  select t.id as teacher_id,
         m.day,
         m.from_t,
         m.to_t
    from public.teachers t
    cross join lateral jsonb_array_elements_text(t.availability::jsonb) as e(slot_id)
    join mapping m on m.slot_id = e.slot_id
   where jsonb_typeof(t.availability::jsonb) = 'array'
     and jsonb_array_length(t.availability::jsonb) > 0
     and jsonb_typeof(t.availability::jsonb -> 0) = 'string'
),
-- Marca el inicio de cada grupo de franjas contiguas del mismo día.
flagged as (
  select *,
         case when lag(to_t) over w = from_t then 0 else 1 end as is_new_group
    from exploded
  window w as (partition by teacher_id, day order by from_t)
),
grouped as (
  select *,
         sum(is_new_group) over (partition by teacher_id, day order by from_t) as grp
    from flagged
),
merged as (
  select teacher_id, day, min(from_t) as from_t, max(to_t) as to_t
    from grouped
   group by teacher_id, day, grp
),
collected as (
  select teacher_id,
         jsonb_agg(
           jsonb_build_object('day', day, 'from', from_t, 'to', to_t)
           order by day, from_t
         ) as ranges
    from merged
   group by teacher_id
)
update public.teachers t
   set availability = c.ranges
  from collected c
 where c.teacher_id = t.id;
