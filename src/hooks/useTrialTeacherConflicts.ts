import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TeacherConflict {
  busy_kind: string;
  busy_label: string;
  busy_start: string;
  busy_end: string;
}

/** "11:00:00" -> "11:00" */
export function hhmm(t: string | null | undefined): string {
  return (t ?? '').slice(0, 5);
}

export function describeConflict(c: TeacherConflict): string {
  return `${c.busy_label} (${hhmm(c.busy_start)}–${hhmm(c.busy_end)})`;
}

/**
 * Clases que ya tiene ese profesor solapando con la prueba del lead.
 *
 * La fecha, la hora y la duración las resuelve el RPC, no el cliente: salen
 * de la reserva si existe y de settings si no. El propio lead queda excluido
 * para que reasignar su prueba no choque consigo misma.
 */
export function useTrialTeacherConflicts(leadId?: string, teacherId?: string | null) {
  const enabled = !!leadId && !!teacherId && teacherId !== 'none';

  return useQuery({
    queryKey: ['trial_teacher_conflicts', leadId, teacherId],
    enabled,
    queryFn: async (): Promise<TeacherConflict[]> => {
      // `as any` porque types.ts se genera desde el esquema y aún no incluye
      // este RPC. Mismo patrón que el resto de llamadas a RPC del proyecto.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('trial_teacher_conflicts', {
        p_lead_id: leadId,
        p_teacher_id: teacherId,
      });
      if (error) throw error;
      return (data ?? []) as TeacherConflict[];
    },
  });
}
