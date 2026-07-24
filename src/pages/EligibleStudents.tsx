import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { GraduationCap, Link as LinkIcon, ExternalLink } from 'lucide-react';
import {
  useEligibleStudents,
  buildWhatsAppLink,
  defaultOfferMessage,
  type Candidate,
} from '@/hooks/useEligibleStudents';

export default function EligibleStudents() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const targetCourseId = params.get('course') || '';

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

  const setCourse = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('course', id); else next.delete('course');
    setParams(next, { replace: true });
  };

  const hasPrereqs = (data?.prerequisites?.length ?? 0) > 0;
  const total = (data?.terminados.length ?? 0) + (data?.porTerminar.length ?? 0);

  const combined = useMemo<Candidate[]>(
    () => data ? [...data.terminados, ...data.porTerminar] : [],
    [data],
  );

  const targetName = data?.targetCourseName ?? '';

  const handleCopyLink = async (c: Candidate) => {
    if (!targetName) return;
    const link = buildWhatsAppLink(c.phone, defaultOfferMessage(c, targetName));
    try {
      await navigator.clipboard.writeText(link);
      toast.success(`Link para ${c.student_name} copiado`);
    } catch {
      window.open(link, '_blank');
    }
  };

  const handleOpenWA = (c: Candidate) => {
    if (!targetName) return;
    const link = buildWhatsAppLink(c.phone, defaultOfferMessage(c, targetName));
    window.open(link, '_blank');
  };

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
                {data.alreadyEnrolled.size > 0 && (
                  <Badge variant="info">{data.alreadyEnrolled.size} ya inscritos</Badge>
                )}
              </div>
            </div>
          </Card>

          {total === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Ningún alumno cumple los criterios hoy.
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alumno</TableHead>
                    <TableHead>Padre / madre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Prerequisito · grupo</TableHead>
                    <TableHead>Ya inscrito</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combined.map((c) => {
                    const already = data.alreadyEnrolled.has(c.student_id);
                    return (
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
                        <TableCell>
                          {already && <Badge variant="info">Sí</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => handleCopyLink(c)}
                              title="Copiar link de WhatsApp con mensaje pre-armado"
                            >
                              <LinkIcon size={14} />
                              Copiar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => handleOpenWA(c)}
                              title="Abrir WhatsApp Web con el mensaje"
                            >
                              <ExternalLink size={14} />
                              WA
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
