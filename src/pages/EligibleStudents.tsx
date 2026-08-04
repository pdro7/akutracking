import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { GraduationCap, MessageCircle, UserPlus } from 'lucide-react';
import {
  useEligibleStudents,
  buildWhatsAppLink,
  defaultOfferMessage,
  type Candidate,
} from '@/hooks/useEligibleStudents';

export default function EligibleStudents() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const targetCourseId = params.get('course') || '';

  // Enroll dialog state
  const [enrolling, setEnrolling] = useState<Candidate | null>(null);
  const [enrollGroupId, setEnrollGroupId] = useState<string>('');

  const { data: courses = [] } = useQuery({
    queryKey: ['virtual_courses_all_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_courses')
        .select('id, code, name, next_course_id')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data, isLoading } = useEligibleStudents(targetCourseId || null);

  // Groups of the target course that can receive new enrollments.
  const { data: targetGroups = [] } = useQuery({
    queryKey: ['target_course_groups', targetCourseId],
    enabled: !!targetCourseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_groups')
        .select('id, code, start_date, start_time, status')
        .eq('virtual_course_id', targetCourseId)
        .in('status', ['forming', 'active'])
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setCourse = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('course', id); else next.delete('course');
    setParams(next, { replace: true });
  };

  const hasPrereqs = (data?.prerequisites?.length ?? 0) > 0;

  const combined = useMemo<Candidate[]>(
    () => data
      ? [...data.terminados, ...data.porTerminar].filter(
          (c) => !data.alreadyEnrolled.has(c.student_id),
        )
      : [],
    [data],
  );

  const targetName = data?.targetCourseName ?? '';

  const handleOpenWA = (c: Candidate) => {
    if (!targetName) return;
    const link = buildWhatsAppLink(c.phone, defaultOfferMessage(c, targetName));
    window.open(link, '_blank');
  };

  const openEnroll = (c: Candidate) => {
    setEnrolling(c);
    setEnrollGroupId(targetGroups[0]?.id ?? '');
  };

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!enrolling) throw new Error('Sin candidato');
      if (!enrollGroupId) throw new Error('Selecciona un grupo');
      // Reactivate a withdrawn enrollment if it exists, otherwise insert new.
      const { data: existing } = await supabase
        .from('course_enrollments')
        .select('id, status')
        .eq('student_id', enrolling.student_id)
        .eq('group_id', enrollGroupId)
        .maybeSingle();
      if (existing) {
        if (existing.status === 'active') throw new Error('Este alumno ya está activo en ese grupo');
        const { error } = await supabase
          .from('course_enrollments')
          .update({ status: 'active' })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('course_enrollments').insert({
          student_id: enrolling.student_id,
          group_id: enrollGroupId,
          status: 'active',
          payment_plan: 'full',
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eligible_students'] });
      queryClient.invalidateQueries({ queryKey: ['course_enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment_counts'] });
      toast.success(`${enrolling?.student_name} inscrito. Configura el pago desde el detalle del grupo.`);
      setEnrolling(null);
      setEnrollGroupId('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap size={22} />
            Candidatos para el siguiente curso
          </h1>
          <p className="text-sm text-muted-foreground">
            Alumnos que terminaron (o están por terminar) el curso prerequisito.
          </p>
        </div>
        <div className="w-full md:w-[320px]">
          <Select value={targetCourseId} onValueChange={setCourse}>
            <SelectTrigger>
              <SelectValue placeholder="Elige un curso destino" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!targetCourseId && (
        <Card className="p-8 text-center text-muted-foreground">
          Selecciona un curso destino arriba para ver quiénes son candidatos.
        </Card>
      )}

      {targetCourseId && isLoading && (
        <Card className="p-8 text-center text-muted-foreground">Cargando candidatos…</Card>
      )}

      {targetCourseId && !isLoading && data && !hasPrereqs && (
        <Card className="p-6">
          <h2 className="font-semibold mb-2">Candidatos para {data.targetCourseCode} — {data.targetCourseName}</h2>
          <p className="text-sm text-muted-foreground">
            Este curso <b>no tiene prerequisito configurado</b>. Para que aparezcan candidatos, edita el curso previo desde{' '}
            <Link to="/settings" className="underline">Settings</Link> y en el campo "Siguiente curso" apunta a este.
          </p>
        </Card>
      )}

      {targetCourseId && !isLoading && data && hasPrereqs && (
        <>
          <Card className="p-4 mb-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Destino: </span>
                <span className="font-semibold">{data.targetCourseCode} — {data.targetCourseName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Prerequisito{data.prerequisites.length > 1 ? 's' : ''}: </span>
                <span className="font-semibold">
                  {data.prerequisites.map((p) => `${p.code}`).join(', ')}
                </span>
              </div>
              <div className="flex gap-2 ml-auto">
                <Badge variant="success">{data.terminados.length} terminados</Badge>
                <Badge variant="warning">{data.porTerminar.length} por terminar</Badge>
              </div>
            </div>
          </Card>

          {combined.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Ningún alumno cumple los criterios hoy.
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alumno</TableHead>
                    <TableHead>Edad</TableHead>
                    <TableHead>Padre / madre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Prerequisito · grupo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combined.map((c) => (
                      <TableRow key={`${c.status}-${c.student_id}`}>
                        <TableCell>
                          <button
                            type="button"
                            className="text-primary hover:underline text-left"
                            onClick={() => navigate(`/student/${c.student_id}`)}
                          >
                            {c.student_name}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {c.age_label ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{c.parent_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{c.phone}</div>
                        </TableCell>
                        <TableCell>
                          {c.status === 'terminado' ? (
                            <Badge variant="success">
                              Terminado{c.group_end_date ? ` · ${c.group_end_date}` : ''}
                            </Badge>
                          ) : (
                            <Badge variant="warning">
                              Por terminar · {c.classes_remaining} clase{(c.classes_remaining ?? 0) === 1 ? '' : 's'} restante{(c.classes_remaining ?? 0) === 1 ? '' : 's'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-mono">{c.group_code}</div>
                          <div className="text-xs text-muted-foreground">{c.prerequisite_course_code}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => handleOpenWA(c)}
                              title="Abrir WhatsApp con el mensaje pre-armado"
                            >
                              <MessageCircle size={14} />
                              WhatsApp
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="gap-1"
                              onClick={() => openEnroll(c)}
                              title="Inscribir a un grupo"
                            >
                              <UserPlus size={14} />
                              Inscribir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* Enroll dialog */}
      <Dialog open={!!enrolling} onOpenChange={(o) => !o && setEnrolling(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Inscribir a {enrolling?.student_name}</DialogTitle>
            <DialogDescription>
              A un grupo de <b>{data?.targetCourseCode} — {data?.targetCourseName}</b>. Después de inscribir, configura el plan de pago desde el detalle del grupo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {targetGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay grupos abiertos de este curso todavía. Crea uno desde{' '}
                <Link to="/virtual-groups" className="underline">Virtual</Link> y vuelve aquí.
              </p>
            ) : (
              <div>
                <label className="text-xs font-medium block mb-1">Grupo destino</label>
                <Select value={enrollGroupId} onValueChange={setEnrollGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige un grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetGroups.map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.code} · {g.start_date}{g.start_time ? ` · ${g.start_time.slice(0, 5)}` : ''} · {g.status === 'forming' ? 'Formando' : 'Activo'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrolling(null)}>Cancelar</Button>
            <Button
              onClick={() => enrollMutation.mutate()}
              disabled={enrollMutation.isPending || !enrollGroupId || targetGroups.length === 0}
            >
              {enrollMutation.isPending ? 'Inscribiendo...' : 'Inscribir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
