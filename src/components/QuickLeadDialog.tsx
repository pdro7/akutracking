import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// Slim lead capture used when a call/WhatsApp comes in on the manual
// AKUMAYA number. Only the phone is required — name is often unknown
// until the trial is booked, so we don't gate on it. Existing leads
// with the same phone are surfaced instead of creating a duplicate.

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function normalizeDigits(p: string): string {
  return p.replace(/\D/g, '');
}

const UNDECIDED = 'undecided';

export function QuickLeadDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState('');
  const [courseId, setCourseId] = useState<string>(UNDECIDED);
  const [age, setAge] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [existingLead, setExistingLead] = useState<any | null>(null);

  const { data: courses = [] } = useQuery({
    queryKey: ['virtual_courses_public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_courses')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Reset form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setPhone('');
      setCourseId(UNDECIDED);
      setAge('');
      setCity('');
      setNotes('');
      setExistingLead(null);
    }
  }, [open]);

  // Live dedup check as the user types the phone.
  useEffect(() => {
    if (!open) return;
    const digits = normalizeDigits(phone);
    if (digits.length < 7) { setExistingLead(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, child_name, parent_name, status, phone')
        .or(`phone.eq.${phone.trim()},phone.eq.+${digits},phone.eq.${digits}`)
        .limit(1);
      const match = (data ?? []).find((l: any) => normalizeDigits(l.phone || '') === digits) ?? null;
      if (!cancelled) setExistingLead(match);
    })();
    return () => { cancelled = true; };
  }, [phone, open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmed = phone.trim();
      if (!trimmed) throw new Error('El teléfono es obligatorio');
      const digits = normalizeDigits(trimmed);
      if (digits.length < 7) throw new Error('Teléfono no parece válido');

      const payload: Record<string, unknown> = {
        phone: trimmed,
        child_name: '—',
        parent_name: '—',
        source: 'whatsapp',
        status: 'contacted',
        interested_course_id: courseId && courseId !== UNDECIDED ? courseId : null,
        age: age.trim() || null,
        city: city.trim() || null,
        notes: notes.trim() || null,
      };
      const { data, error } = await supabase.from('leads').insert(payload).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads_counts'] });
      toast.success('Lead creado — puedes completar los datos después');
      onOpenChange(false);
      navigate(`/leads/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lead rápido</DialogTitle>
          <DialogDescription>
            Registro mínimo para no perder rastro de una llamada / WhatsApp entrante. Solo el teléfono es obligatorio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="mb-1 block">Teléfono *</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="3XX..."
              autoFocus
            />
            {existingLead && (
              <div className="mt-2 text-xs p-2 rounded bg-yellow-50 border border-yellow-200">
                Ya existe un lead con este teléfono: <b>{existingLead.child_name !== '—' ? existingLead.child_name : existingLead.parent_name}</b>.
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 ml-1 text-xs"
                  onClick={() => { onOpenChange(false); navigate(`/leads/${existingLead.id}`); }}
                >
                  Abrir ficha →
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label className="mb-1 block">Curso de interés</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Sin decidir" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNDECIDED}>No lo sé / Sin decidir</SelectItem>
                {(courses as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">Edad</Label>
              <Input value={age} onChange={(e) => setAge(e.target.value)} placeholder="ej. 9" />
            </div>
            <div>
              <Label className="mb-1 block">Ciudad</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="ej. Bogotá" />
            </div>
          </div>

          <div>
            <Label className="mb-1 block">Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Cualquier dato que te haya dado en la llamada."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!phone.trim() || createMutation.isPending || !!existingLead}
            title={existingLead ? 'Ya existe un lead con ese teléfono, ábrelo desde el aviso' : undefined}
          >
            {createMutation.isPending ? 'Creando…' : 'Crear lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
