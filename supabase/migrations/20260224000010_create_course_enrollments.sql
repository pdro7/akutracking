-- M10: Create course_enrollments (student → group)
CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.course_groups(id) ON DELETE CASCADE,
  enrollment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_plan text NOT NULL DEFAULT 'full'
    CHECK (payment_plan IN ('full', 'installments')),
  installment_1_paid_at date,
  installment_1_amount numeric(10,2),
  installment_2_due_date date,
  installment_2_paid_at date,
  installment_2_amount numeric(10,2),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'withdrawn')),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (student_id, group_id)
);

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_course_enrollments"
  ON public.course_enrollments FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
