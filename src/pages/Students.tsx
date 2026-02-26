import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Archive, ArchiveRestore } from 'lucide-react';
import { getPaymentStatus } from '@/types/student';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Students() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [modalityFilter, setModalityFilter] = useState<string>('all');
  const [archiveStudentId, setArchiveStudentId] = useState<string | null>(null);
  const [archiveStudentName, setArchiveStudentName] = useState('');

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', showArchived],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('is_active', true)
        .eq('archived', showArchived)
        .order('name');

      if (error) throw error;
      return data;
    }
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
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const filteredStudents = students.filter((s) =>
    modalityFilter === 'all' ? true : s.modality === modalityFilter
  );

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Students</h1>
          <p className="text-muted-foreground">
            {showArchived ? 'Alumnos archivados' : 'Manage all enrolled students'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowArchived(!showArchived)}
            className="gap-2"
          >
            {showArchived ? <ArchiveRestore size={20} /> : <Archive size={20} />}
            {showArchived ? 'Ver activos' : 'Ver archivados'}
          </Button>
          {!showArchived && (
            <Button onClick={() => navigate('/students/new')} className="gap-2">
              <Plus size={20} />
              Add Student
            </Button>
          )}
        </div>
      </div>

      {/* Modality filter */}
      {!showArchived && (
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student Name</TableHead>
              <TableHead>Parent Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Classes Attended</TableHead>
              <TableHead>Classes Remaining</TableHead>
              <TableHead>Modalidad</TableHead>
              <TableHead>Status</TableHead>
              {!showArchived && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.map((student) => {
              const status = getPaymentStatus(student.classes_remaining);
              const statusConfig = {
                good: { variant: 'success' as const, label: 'Active' },
                low: { variant: 'warning' as const, label: 'Low Credits' },
                due: { variant: 'destructive' as const, label: 'Payment Due' },
              };

              return (
                <TableRow
                  key={student.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => navigate(`/student/${student.id}`)}
                >
                  <TableCell className="font-medium text-primary">{student.name}</TableCell>
                  <TableCell>{student.parent_name}</TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>{student.classes_attended}</TableCell>
                  <TableCell>{student.classes_remaining}</TableCell>
                  <TableCell className="capitalize text-sm text-muted-foreground">{student.modality ?? 'presencial'}</TableCell>
                  <TableCell>
                    <Badge variant={showArchived ? 'secondary' : statusConfig[status].variant}>
                      {showArchived ? 'Archivado' : statusConfig[status].label}
                    </Badge>
                  </TableCell>
                  {!showArchived && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
                    </TableCell>
                  )}
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
            {showArchived ? 'No hay alumnos archivados' : 'No students yet'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {showArchived ? 'Ningún alumno ha sido archivado todavía' : 'Get started by adding your first student'}
          </p>
          {!showArchived && (
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
              El alumno seguirá en el historial pero no aparecerá como activo. Puedes verlo en "Ver archivados".
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
