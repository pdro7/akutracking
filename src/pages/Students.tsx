import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Archive, Search, MessageCircle, AlertCircle } from 'lucide-react';
import { getPaymentStatus } from '@/types/student';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ViewMode = 'active' | 'inactive' | 'archived';

const PAYMENT_STATUS_CONFIG = {
  good: { variant: 'success' as const, label: 'Active' },
  low:  { variant: 'warning' as const, label: 'Low Credits' },
  due:  { variant: 'destructive' as const, label: 'Payment Due' },
};

function isPhoneValid(raw: string): boolean {
  const p = raw.replace(/\s+/g, '').replace(/^\+/, '');
  if (p.length === 10 && p.startsWith('3')) return true;
  if (p.length >= 11) return true;
  return false;
}

export default function Students() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [modalityFilter, setModalityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [archiveStudentId, setArchiveStudentId] = useState<string | null>(null);
  const [archiveStudentName, setArchiveStudentName] = useState('');

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', viewMode],
    queryFn: async () => {
      let query = supabase.from('students').select('*').order('name');
      if (viewMode === 'active') {
        query = query.eq('is_active', true).eq('archived', false);
      } else if (viewMode === 'inactive') {
        query = query.eq('is_active', false).eq('archived', false);
      } else {
        query = query.eq('archived', true);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase
        .from('students')
        .update({ archived: true })
        .eq('id', studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Alumno archivado');
      setArchiveStudentId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startConversationMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('start-conversation', {
        body: { student_id: studentId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.data?.ok === false) throw new Error(res.data.error);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => toast.success('Conversación iniciada con Pablo'),
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredStudents = students.filter((s) => {
    const matchesModality = modalityFilter === 'all' || s.modality === modalityFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      s.name.toLowerCase().includes(term) ||
      s.parent_name.toLowerCase().includes(term);
    return matchesModality && matchesSearch;
  });

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Students</h1>
          <p className="text-muted-foreground">
            {viewMode === 'active' ? 'Alumnos activos' : viewMode === 'inactive' ? 'Ex-alumnos inactivos' : 'Alumnos archivados'}
          </p>
        </div>
        {viewMode === 'active' && (
          <Button onClick={() => navigate('/students/new')} className="gap-2">
            <Plus size={20} />
            <span className="hidden sm:inline">Add Student</span>
          </Button>
        )}
      </div>

      {/* View mode tabs */}
      <div className="flex gap-1 mb-6 bg-muted p-1 rounded-lg w-fit">
        {([
          { value: 'active', label: 'Activos' },
          { value: 'inactive', label: 'Inactivos' },
          { value: 'archived', label: 'Archivados' },
        ] as const).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setViewMode(tab.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === tab.value
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input
          placeholder="Buscar por alumno o padre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Modality filter — only for active */}
      {viewMode === 'active' && (
        <div className="flex gap-2 mb-4">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'presencial', label: 'Presencial' },
            { value: 'virtual', label: 'Virtual' },
            { value: 'both', label: 'Ambos' },
            { value: 'individual', label: 'Individual' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setModalityFilter(opt.value)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                modalityFilter === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filteredStudents.map((student) => {
          const status = getPaymentStatus(student.classes_remaining);
          return (
            <Card
              key={student.id}
              className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate(`/student/${student.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-primary">{student.name}</p>
                  <p className="text-xs text-muted-foreground">{student.parent_name}</p>
                </div>
                {viewMode === 'active' && (
                  <Badge variant={PAYMENT_STATUS_CONFIG[status].variant} className="flex-shrink-0">
                    {PAYMENT_STATUS_CONFIG[status].label}
                  </Badge>
                )}
              </div>
              {viewMode === 'active' && (
                <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>{student.classes_remaining} restantes</span>
                  <span className="capitalize">{student.modality ?? 'presencial'}</span>
                </div>
              )}
              {viewMode === 'inactive' && (
                <div className="flex items-center justify-between mt-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {student.city || '—'}
                    {!isPhoneValid(student.phone ?? '') && (
                      <span className="flex items-center gap-1 text-orange-600 ml-2">
                        <AlertCircle size={11} />
                        Tel. pendiente
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs text-green-700 border-green-300 hover:bg-green-50"
                    disabled={startConversationMutation.isPending}
                    onClick={() => startConversationMutation.mutate(student.id)}
                  >
                    <MessageCircle size={13} />
                    Reactivar
                  </Button>
                </div>
              )}
              {viewMode === 'active' && (
                <div className="flex justify-end mt-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setArchiveStudentId(student.id); setArchiveStudentName(student.name); }}
                  >
                    <Archive size={14} className="text-muted-foreground" />
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alumno/a</TableHead>
              <TableHead>Padre/madre</TableHead>
              <TableHead>Email</TableHead>
              {viewMode === 'active' && (
                <>
                  <TableHead>Clases asistidas</TableHead>
                  <TableHead>Clases restantes</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead>Estado</TableHead>
                </>
              )}
              {viewMode === 'inactive' && <TableHead>Ciudad</TableHead>}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.map((student) => {
              const status = getPaymentStatus(student.classes_remaining);
              return (
                <TableRow
                  key={student.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => navigate(`/student/${student.id}`)}
                >
                  <TableCell className="font-medium text-primary">{student.name}</TableCell>
                  <TableCell>{student.parent_name}</TableCell>
                  <TableCell>{student.email}</TableCell>
                  {viewMode === 'active' && (
                    <>
                      <TableCell>{student.classes_attended}</TableCell>
                      <TableCell>{student.classes_remaining}</TableCell>
                      <TableCell className="capitalize text-sm text-muted-foreground">{student.modality ?? 'presencial'}</TableCell>
                      <TableCell>
                        <Badge variant={PAYMENT_STATUS_CONFIG[status].variant}>{PAYMENT_STATUS_CONFIG[status].label}</Badge>
                      </TableCell>
                    </>
                  )}
                  {viewMode === 'inactive' && (
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {student.city || '—'}
                        {!isPhoneValid(student.phone ?? '') && (
                          <span className="flex items-center gap-1 text-orange-600 text-xs">
                            <AlertCircle size={12} />
                            Tel. pendiente
                          </span>
                        )}
                      </div>
                    </TableCell>
                  )}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {viewMode === 'inactive' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                        disabled={startConversationMutation.isPending}
                        onClick={() => startConversationMutation.mutate(student.id)}
                      >
                        <MessageCircle size={14} />
                        Reactivar con Pablo
                      </Button>
                    )}
                    {viewMode === 'active' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setArchiveStudentId(student.id);
                          setArchiveStudentName(student.name);
                        }}
                      >
                        <Archive size={16} className="text-muted-foreground" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {filteredStudents.length === 0 && (
        <Card className="p-12 text-center">
          <Users className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-semibold mb-2">
            {viewMode === 'active' ? 'No hay alumnos activos' : viewMode === 'inactive' ? 'No hay ex-alumnos inactivos' : 'No hay alumnos archivados'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {viewMode === 'inactive' ? 'Importa ex-alumnos desde CSV para reactivarlos con Pablo' : ''}
          </p>
          {viewMode === 'active' && (
            <Button onClick={() => navigate('/students/new')}>
              <Plus size={20} className="mr-2" />
              Add First Student
            </Button>
          )}
        </Card>
      )}

      <AlertDialog open={!!archiveStudentId} onOpenChange={(open) => !open && setArchiveStudentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar a {archiveStudentName}?</AlertDialogTitle>
            <AlertDialogDescription>
              El alumno seguirá en el historial pero no aparecerá como activo. Puedes verlo en "Archivados".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveStudentId && archiveMutation.mutate(archiveStudentId)}>
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
