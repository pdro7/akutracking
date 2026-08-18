import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AvailabilityRangePicker } from '@/components/AvailabilityRangePicker';
import { parseAvailability, normalizeRanges, type AvailabilityRange } from '@/lib/availability';
import { SUBJECTS, SUBJECT_LABEL, MODALITIES, MODALITY_LABEL } from '@/lib/subjects';
import { useTeacherRecord } from '@/hooks/useUserRole';

export default function TeacherAvailability() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: teacherRecord, isLoading: loadingRecord } = useTeacherRecord();

  const teacherId = teacherRecord?.id;

  const { data: teacher, isLoading } = useQuery({
    queryKey: ['teacher_self', teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name, subjects, availability, modalities')
        .eq('id', teacherId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!teacherId,
  });

  const [subjects, setSubjects] = useState<string[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRange[]>([]);
  const [modalities, setModalities] = useState<string[]>([]);

  useEffect(() => {
    if (!teacher) return;
    setSubjects(Array.isArray(teacher.subjects) ? teacher.subjects : []);
    setAvailability(parseAvailability(teacher.availability));
    setModalities(Array.isArray(teacher.modalities) ? teacher.modalities : []);
  }, [teacher]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!teacherId) throw new Error('Sin registro de profesor');
      const { error } = await supabase.from('teachers').update({
        subjects,
        availability: normalizeRanges(availability),
        modalities,
      }).eq('id', teacherId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher_self', teacherId] });
      toast.success('Disponibilidad actualizada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  if (loadingRecord || isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  }

  if (!teacherRecord) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <p className="text-sm text-muted-foreground">
          Tu usuario no está vinculado a un registro de profesor. Contacta con un administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 mb-6">
        <ArrowLeft size={16} />
        Volver
      </Button>

      <h1 className="text-2xl font-bold mb-2">Mi disponibilidad</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Estos datos se usan para asignarte a grupos que se están formando y a clases de prueba.
      </p>

      <Card className="p-6 space-y-6">
        <div>
          <Label className="mb-2 block">Herramientas / temas que puedo enseñar</Label>
          <div className="flex flex-wrap gap-3">
            {SUBJECTS.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={subjects.includes(s)}
                  onCheckedChange={() => setSubjects(toggle(subjects, s))}
                />
                {SUBJECT_LABEL[s]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Modalidades</Label>
          <div className="flex flex-wrap gap-3">
            {MODALITIES.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={modalities.includes(m)}
                  onCheckedChange={() => setModalities(toggle(modalities, m))}
                />
                {MODALITY_LABEL[m]}
              </label>
            ))}
          </div>
        </div>

        <AvailabilityRangePicker
          value={availability}
          onChange={setAvailability}
          label="Horas en las que puedo dictar"
        />

        <div className="flex justify-end pt-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
