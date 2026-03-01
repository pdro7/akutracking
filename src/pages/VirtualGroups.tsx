import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Monitor } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' }> = {
  forming:   { label: 'Formando',   variant: 'secondary' },
  active:    { label: 'Activo',     variant: 'success' },
  completed: { label: 'Completado', variant: 'outline' },
  cancelled: { label: 'Cancelado',  variant: 'destructive' },
};

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function generateGroupCode(courseCode: string, startDate: Date): string {
  const month = MONTHS[startDate.getMonth()];
  const year = String(startDate.getFullYear()).slice(2);
  const day = String(startDate.getDate()).padStart(2, '0');
  return `${courseCode}-${month}${year}-${day}`;
}

export default function VirtualGroups() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDialog, setShowDialog] = useState(false);

  // Form state
  const [courseId, setCourseId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupStatus, setGroupStatus] = useState('forming');
  const [notes, setNotes] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [autoSessions, setAutoSessions] = useState(true);

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('teachers').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: virtualCourses = [] } = useQuery({
    queryKey: ['virtual_courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_courses')
        .select('*')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['course_groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_groups')
        .select('*, virtual_courses(code, name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: enrollmentCounts = {} } = useQuery({
    queryKey: ['enrollment_counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('group_id')
        .eq('status', 'active');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((e: any) => {
        counts[e.group_id] = (counts[e.group_id] || 0) + 1;
      });
      return counts;
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      const course = (virtualCourses as any[]).find((c) => c.id === courseId);
      if (!course) throw new Error('Selecciona un curso');
      if (!startDate) throw new Error('La fecha de inicio es obligatoria');

      const base = generateGroupCode(course.code, new Date(startDate + 'T12:00:00'));

      const { data: existing } = await supabase
        .from('course_groups')
        .select('code')
        .eq('code', base)
        .maybeSingle();
      const code = existing ? `${base}-B` : base;

      const { data: group, error } = await supabase
        .from('course_groups')
        .insert({
          code,
          virtual_course_id: courseId,
          start_date: startDate,
          end_date: endDate || null,
          status: groupStatus,
          teacher_id: teacherId && teacherId !== 'none' ? teacherId : null,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (autoSessions && group) {
        const sessions = Array.from({ length: 8 }, (_, i) => {
          const d = new Date(startDate + 'T12:00:00');
          d.setDate(d.getDate() + i * 7);
          return {
            group_id: group.id,
            session_number: i + 1,
            scheduled_date: d.toISOString().split('T')[0],
          };
        });
        const { error: sessErr } = await supabase.from('course_sessions').insert(sessions);
        if (sessErr) throw sessErr;
      }

      return group;
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['course_groups'] });
      toast.success('Grupo creado correctamente');
      setShowDialog(false);
      resetForm();
      if (group) navigate(`/virtual-groups/${group.id}`);
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const resetForm = () => {
    setCourseId('');
    setStartDate('');
    setEndDate('');
    setGroupStatus('forming');
    setTeacherId('none');
    setNotes('');
    setAutoSessions(true);
  };

  const selectedCourse = (virtualCourses as any[]).find((c) => c.id === courseId);
  const baseCode = selectedCourse && startDate
    ? generateGroupCode(selectedCourse.code, new Date(startDate + 'T12:00:00'))
    : '';

  const { data: resolvedCode } = useQuery({
    queryKey: ['group_code_check', baseCode],
    enabled: !!baseCode,
    queryFn: async () => {
      const { data } = await supabase
        .from('course_groups')
        .select('code')
        .eq('code', baseCode)
        .maybeSingle();
      return data ? `${baseCode}-B` : baseCode;
    },
  });

  const previewCode = resolvedCode ?? baseCode;

  const filteredGroups = (groups as any[]).filter((g) =>
    statusFilter === 'all' ? true : g.status === statusFilter
  );

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Grupos Virtuales</h1>
          <p className="text-muted-foreground">Gestión de cohortes de cursos virtuales</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="gap-2">
          <Plus size={20} />
          Nuevo grupo
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-6">
        {['all', 'forming', 'active', 'completed', 'cancelled'].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'Todos' : STATUS_CONFIG[s]?.label ?? s}
          </Button>
        ))}
      </div>

      {filteredGroups.length === 0 ? (
        <Card className="p-12 text-center">
          <Monitor className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-semibold mb-2">No hay grupos</h3>
          <p className="text-muted-foreground mb-4">Crea el primer grupo virtual</p>
          <Button onClick={() => setShowDialog(true)}>
            <Plus size={20} className="mr-2" />
            Nuevo grupo
          </Button>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Alumnos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((group: any) => {
                const conf = STATUS_CONFIG[group.status] ?? { label: group.status, variant: 'secondary' as const };
                return (
                  <TableRow
                    key={group.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => navigate(`/virtual-groups/${group.id}`)}
                  >
                    <TableCell className="font-mono font-medium text-primary">{group.code}</TableCell>
                    <TableCell>{group.virtual_courses?.name ?? '—'}</TableCell>
                    <TableCell>{new Date(group.start_date + 'T12:00:00').toLocaleDateString('es-CO')}</TableCell>
                    <TableCell>
                      {group.end_date
                        ? new Date(group.end_date + 'T12:00:00').toLocaleDateString('es-CO')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={conf.variant}>{conf.label}</Badge>
                    </TableCell>
                    <TableCell>{(enrollmentCounts as any)[group.id] ?? 0}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* New Group Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo grupo virtual</DialogTitle>
            <DialogDescription>Crea una cohorte para un curso virtual</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[65vh] overflow-y-auto pr-1">
            <div>
              <Label className="mb-2 block">Curso *</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un curso..." />
                </SelectTrigger>
                <SelectContent>
                  {(virtualCourses as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">Fecha de inicio *</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {previewCode && (
              <div className="text-sm text-muted-foreground">
                Código generado: <span className="font-mono font-semibold text-foreground">{previewCode}</span>
              </div>
            )}

            <div>
              <Label className="mb-2 block">Profesor (opcional)</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin profesor asignado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin profesor asignado</SelectItem>
                  {(teachers as any[]).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">Fecha de fin (opcional)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-2 block">Estado inicial</Label>
              <Select value={groupStatus} onValueChange={setGroupStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forming">Formando</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Observaciones sobre el grupo..."
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoSessions"
                checked={autoSessions}
                onChange={(e) => setAutoSessions(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="autoSessions" className="cursor-pointer">
                Crear 8 sesiones automáticamente (cada 7 días)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => createGroupMutation.mutate()}
              disabled={createGroupMutation.isPending || !courseId || !startDate}
            >
              {createGroupMutation.isPending ? 'Creando...' : 'Crear grupo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
