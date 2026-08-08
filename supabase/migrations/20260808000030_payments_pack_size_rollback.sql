-- Track the pack size credited by each payment so deleting the payment can
-- roll it back. Historical payments (pack_size null) are left alone by the
-- delete path — we only refund packs we know we added.

alter table public.payments
  add column if not exists pack_size int;

comment on column public.payments.pack_size is
  'Classes credited to the student when this payment was recorded. Null for legacy rows created before this column existed. Delete flow subtracts this from students.classes_remaining.';
