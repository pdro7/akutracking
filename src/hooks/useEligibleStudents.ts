import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Candidate = {
  student_id: string;
  student_name: string;
  parent_name: string;
  phone: string;
  additional_phones: string[];
  age_label: string | null;   // "8a 11m", "9a", "11m", or null when unknown
  status: 'terminado' | 'por_terminar';
  classes_remaining?: number;
  group_code: string;
  group_end_date: string | null;
  prerequisite_course_id: string;
  prerequisite_course_name: string;
  prerequisite_course_code: string;
};

// Compact age label — years + months when we have a real birthdate,
// years-only when we only have age_at_enrollment (frozen integer).
// Formats: "8a 11m", "9a", "11m" (under 1 year).
function computeAgeLabel(dob: string | null, fallback: number | null): string | null {
  if (dob) {
    const birth = new Date(dob + 'T12:00:00');
    if (!isNaN(birth.getTime())) {
      const now = new Date();
      let years = now.getFullYear() - birth.getFullYear();
      let months = now.getMonth() - birth.getMonth();
      if (now.getDate() < birth.getDate()) months--;
      if (months < 0) { years--; months += 12; }
      if (years < 0 || years > 120) return null;
      if (years === 0) return `${months}m`;
      if (months === 0) return `${years}a`;
      return `${years}a ${months}m`;
    }
  }
  if (typeof fallback === 'number' && fallback >= 0) return `${fallback}a`;
  return null;
}

export type EligibleData = {
  targetCourseId: string;
  targetCourseName: string;
  targetCourseCode: string;
  prerequisites: Array<{ id: string; code: string; name: string }>;
  terminados: Candidate[];
  porTerminar: Candidate[];
  alreadyEnrolled: Set<string>;
};

// Given a target course, find:
//  - which courses are its prerequisites (virtual_courses.next_course_id = targetCourseId)
//  - students who completed one of those prerequisites (terminados)
//  - students currently enrolled in one of those prerequisites with <=2 classes left (por terminar)
//  - students already enrolled (any status) in the target course, so the UI can mark them
export function useEligibleStudents(targetCourseId: string | null | undefined) {
  return useQuery<EligibleData | null>({
    queryKey: ['eligible_students', targetCourseId ?? 'none'],
    enabled: !!targetCourseId,
    queryFn: async () => {
      if (!targetCourseId) return null;

      // Target course header
      const { data: target, error: targetErr } = await supabase
        .from('virtual_courses')
        .select('id, code, name')
        .eq('id', targetCourseId)
        .single();
      if (targetErr) throw targetErr;

      // Prerequisites = courses that point to targetCourseId via next_course_id
      const { data: prereqs, error: prereqErr } = await supabase
        .from('virtual_courses')
        .select('id, code, name')
        .eq('next_course_id', targetCourseId);
      if (prereqErr) throw prereqErr;

      const prerequisites = prereqs ?? [];
      const prereqIds = prerequisites.map((p) => p.id);

      if (prereqIds.length === 0) {
        return {
          targetCourseId: target.id,
          targetCourseName: target.name,
          targetCourseCode: target.code,
          prerequisites: [],
          terminados: [],
          porTerminar: [],
          alreadyEnrolled: new Set<string>(),
        };
      }

      // Fetch every enrollment on any prerequisite group, joined to student + group + course.
      // Archived students are excluded — they left the academy so offering them
      // the next level makes no sense.
      const { data: enrollments, error: enrErr } = await supabase
        .from('course_enrollments')
        .select(`
          status,
          created_at,
          students!inner(id, name, parent_name, phone, additional_phones, classes_remaining, date_of_birth, age_at_enrollment, archived),
          course_groups!inner(
            id, code, status, end_date, virtual_course_id,
            virtual_courses!inner(id, code, name)
          )
        `)
        .in('course_groups.virtual_course_id', prereqIds)
        .eq('students.archived', false);
      if (enrErr) throw enrErr;

      // Enrollments in the target course (any status) so we can flag "ya inscrito".
      const { data: alreadyRows, error: alreadyErr } = await supabase
        .from('course_enrollments')
        .select('student_id, course_groups!inner(virtual_course_id)')
        .in('status', ['active', 'completed'])
        .eq('course_groups.virtual_course_id', targetCourseId);
      if (alreadyErr) throw alreadyErr;

      const alreadyEnrolled = new Set<string>((alreadyRows ?? []).map((r: any) => r.student_id));

      // Bucketize. Keep the most recent qualifying enrollment per student per bucket.
      const terminadosMap = new Map<string, Candidate>();
      const porTerminarMap = new Map<string, Candidate>();

      for (const e of (enrollments ?? []) as any[]) {
        const student = e.students;
        const group = e.course_groups;
        const course = group?.virtual_courses;
        if (!student || !group || !course) continue;

        const base: Candidate = {
          student_id: student.id,
          student_name: student.name,
          parent_name: student.parent_name,
          phone: student.phone,
          additional_phones: Array.isArray(student.additional_phones) ? student.additional_phones : [],
          age_label: computeAgeLabel(student.date_of_birth ?? null, student.age_at_enrollment ?? null),
          status: 'terminado',
          group_code: group.code,
          group_end_date: group.end_date,
          prerequisite_course_id: course.id,
          prerequisite_course_name: course.name,
          prerequisite_course_code: course.code,
        };

        // A student is "terminado" as long as the group closed and the student
        // didn't withdraw. We used to require the enrollment itself to be
        // 'completed', but staff rarely flips that flag per-student — closing
        // the group is the natural signal that everyone who stuck around
        // finished. Withdrawals are still excluded.
        const isTerminado = e.status !== 'withdrawn' && group.status === 'completed';
        const isPorTerminar = e.status === 'active'
          && group.status === 'active'
          && typeof student.classes_remaining === 'number'
          && student.classes_remaining <= 2;

        if (isTerminado) {
          const prev = terminadosMap.get(student.id);
          if (!prev || (group.end_date ?? '') > (prev.group_end_date ?? '')) {
            terminadosMap.set(student.id, base);
          }
        } else if (isPorTerminar) {
          const prev = porTerminarMap.get(student.id);
          const cand: Candidate = {
            ...base,
            status: 'por_terminar',
            classes_remaining: student.classes_remaining,
          };
          if (!prev || (cand.classes_remaining ?? 99) < (prev.classes_remaining ?? 99)) {
            porTerminarMap.set(student.id, cand);
          }
        }
      }

      // A student in terminado should not also appear in porTerminar (they already finished).
      for (const id of terminadosMap.keys()) {
        porTerminarMap.delete(id);
      }

      return {
        targetCourseId: target.id,
        targetCourseName: target.name,
        targetCourseCode: target.code,
        prerequisites,
        terminados: Array.from(terminadosMap.values()).sort((a, b) => {
          // Most recently finished first. Groups without an end_date sink to
          // the bottom so we don't confuse "unknown" with "recent".
          const av = a.group_end_date ?? '';
          const bv = b.group_end_date ?? '';
          if (!av && !bv) return a.student_name.localeCompare(b.student_name);
          if (!av) return 1;
          if (!bv) return -1;
          return bv.localeCompare(av);
        }),
        porTerminar: Array.from(porTerminarMap.values()).sort((a, b) => (a.classes_remaining ?? 0) - (b.classes_remaining ?? 0)),
        alreadyEnrolled,
      };
    },
  });
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function defaultOfferMessage(candidate: Candidate, targetCourseName: string): string {
  const child = candidate.student_name;
  const parent = candidate.parent_name;
  const prereq = candidate.prerequisite_course_name;
  const salutation = parent ? `Hola ${parent} 👋` : 'Hola 👋';
  if (candidate.status === 'terminado') {
    return `${salutation} Estamos armando el siguiente nivel para ${child}: ${targetCourseName} (continúa después de ${prereq}). ¿Te interesa que lo agendemos?`;
  }
  return `${salutation} A ${child} le quedan pocas clases para terminar ${prereq}. Ya estamos preparando el siguiente nivel: ${targetCourseName}. ¿Quieres que le reservemos cupo?`;
}
