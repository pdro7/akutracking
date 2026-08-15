import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CalendarDays, Clock, Globe, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { es } from 'date-fns/locale';

// Autogestión del padre: ver, cancelar o reagendar su clase de prueba
// desde el link con token que recibe por correo. Sin login.

const WHATSAPP = '+57 316 294 1820';

type Booking = {
  child_name: string;
  parent_name: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
};

type Slot = { date: string; start_time: string; end_time: string };

const parseISO = (iso: string) => new Date(iso + 'T12:00:00');
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function callManage(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('manage-trial', { body });
  let detail: string | null = null;
  if (error) {
    detail = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.json) {
        const b = await ctx.json();
        if (b?.error) detail = b.error;
      }
    } catch { /* ignore */ }
  } else if (data?.error) {
    detail = data.error;
  }
  if (detail) throw new Error(detail);
  return data;
}

export default function PublicTrialManage() {
  const { token } = useParams();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState<'view' | 'reschedule'>('view');
  const [selectedDay, setSelectedDay] = useState<Date | undefined>();
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [reason, setReason] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!token) { setLoadError('Enlace no válido'); setLoading(false); return; }
    (async () => {
      try {
        const data = await callManage({ action: 'read', token });
        setBooking(data.booking);
      } catch (e) {
        setLoadError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const { data: slots = [] } = useQuery({
    queryKey: ['manage_availability', mode],
    enabled: mode === 'reschedule',
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('trial-availability', { body: {} });
      if (error) throw error;
      return (data?.slots ?? []) as Slot[];
    },
    staleTime: 30_000,
  });

  const availableDays = useMemo(
    () => Array.from(new Set(slots.map((s) => s.date))).map(parseISO),
    [slots],
  );
  const daySlots = useMemo(() => {
    if (!selectedDay) return [];
    const iso = toISO(selectedDay);
    return slots.filter((s) => s.date === iso).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [slots, selectedDay]);

  const prettyDate = (iso: string) =>
    parseISO(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

  const doCancel = async () => {
    setBusy(true);
    try {
      const data = await callManage({ action: 'cancel', token, reason });
      setBooking(data.booking);
      setConfirmCancel(false);
      toast.success('Clase cancelada');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doReschedule = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      const data = await callManage({
        action: 'reschedule', token,
        date: chosen.date, start_time: chosen.start_time, reason,
      });
      setBooking(data.booking);
      setMode('view');
      setChosen(null);
      setSelectedDay(undefined);
      toast.success('Clase reagendada');
    } catch (e) {
      toast.error((e as Error).message);
      // Si el hueco se ocupó, refrescamos la lista dejando al padre en el
      // calendario en vez de en un callejón sin salida.
      setChosen(null);
    } finally {
      setBusy(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-muted/30 p-4 flex items-start justify-center">
      <div className="w-full max-w-lg bg-background rounded-xl border shadow-sm p-6 sm:p-8 my-6">
        <img src="/akumaya-logo.png" alt="AKUMAYA Educación" className="w-14 h-14 rounded-full mb-4" />
        {children}
        <p className="text-xs text-muted-foreground mt-6 pt-5 border-t">
          ¿Dudas? Escríbenos por WhatsApp al{' '}
          <span className="whitespace-nowrap font-medium text-foreground">{WHATSAPP}</span>.
        </p>
      </div>
    </div>
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>;
  }

  if (loadError || !booking) {
    return (
      <Shell>
        <h1 className="text-xl font-bold mb-2">No encontramos tu clase</h1>
        <p className="text-sm text-muted-foreground">
          {loadError ?? 'El enlace no es válido o ha caducado.'}
        </p>
      </Shell>
    );
  }

  if (booking.status === 'cancelled') {
    return (
      <Shell>
        <XCircle className="text-muted-foreground mb-2" size={32} />
        <h1 className="text-xl font-bold mb-2">Clase cancelada</h1>
        <p className="text-sm text-muted-foreground">
          La clase de prueba de <strong className="text-foreground">{booking.child_name}</strong> quedó
          cancelada. Si quieres agendar otra, escríbenos y te ayudamos.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-sm font-semibold text-muted-foreground">AKUMAYA Educación</p>
      <h1 className="text-2xl font-bold leading-tight mt-1 mb-5">
        Clase de prueba de {booking.child_name}
      </h1>

      <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm mb-6">
        <div className="flex gap-2.5 items-center">
          <CalendarDays size={16} className="text-muted-foreground shrink-0" />
          <span className="capitalize font-medium">{prettyDate(booking.date)}</span>
        </div>
        <div className="flex gap-2.5 items-center">
          <Clock size={16} className="text-muted-foreground shrink-0" />
          <span className="font-medium">{booking.start_time} – {booking.end_time}</span>
        </div>
        <div className="flex gap-2.5 items-center">
          <Globe size={16} className="text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Hora de Colombia</span>
        </div>
      </div>

      {mode === 'view' ? (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setMode('reschedule')}>
            Cambiar de horario
          </Button>
          <Button variant="outline" onClick={() => setConfirmCancel(true)}>
            Cancelar clase
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="font-semibold">Elige el nuevo horario</h2>

          {availableDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ahora mismo no hay otros horarios libres. Escríbenos por WhatsApp y lo buscamos.
            </p>
          ) : (
            <>
              <Calendar
                mode="single"
                locale={es}
                showOutsideDays={false}
                selected={selectedDay}
                onSelect={(d) => { setSelectedDay(d); setChosen(null); }}
                disabled={(date) => !availableDays.some((a) => toISO(a) === toISO(date))}
                modifiers={{ available: availableDays }}
                modifiersClassNames={{ available: 'bg-primary/10 text-primary font-semibold' }}
                className="p-0"
                classNames={{
                  caption_label: 'text-base font-semibold',
                  head_cell: 'text-muted-foreground w-10 font-normal text-xs',
                  cell: 'h-10 w-10 text-center text-sm p-0 relative',
                  day: 'h-10 w-10 p-0 font-normal rounded-full hover:bg-primary/20 transition-colors',
                  day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                  day_today: 'font-semibold',
                  day_disabled: 'text-muted-foreground/50 hover:bg-transparent',
                }}
              />

              {selectedDay && (
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((s) => {
                    const active = chosen?.start_time === s.start_time && chosen?.date === s.date;
                    return (
                      <button
                        key={`${s.date}-${s.start_time}`}
                        onClick={() => setChosen(s)}
                        className={`rounded-md border-2 px-4 py-2 text-sm transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-primary/40 text-primary hover:border-primary'
                        }`}
                      >
                        {s.start_time}
                      </button>
                    );
                  })}
                </div>
              )}

              <div>
                <Label className="text-xs">Motivo (opcional)</Label>
                <Textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nos ayuda a organizarnos mejor"
                />
              </div>
            </>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setMode('view'); setChosen(null); }}>
              Volver
            </Button>
            <Button className="flex-1" disabled={!chosen || busy} onClick={doReschedule}>
              {busy ? 'Guardando...' : 'Confirmar cambio'}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar la clase de prueba?</AlertDialogTitle>
            <AlertDialogDescription>
              Se liberará el horario del {prettyDate(booking.date)} a las {booking.start_time}.
              Si prefieres moverla a otro día, usa "Cambiar de horario".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-xs">Motivo (opcional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={doCancel}>
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {booking.status === 'booked' && mode === 'view' && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-4">
          <CheckCircle2 size={13} className="text-success" /> Tu clase está confirmada.
        </p>
      )}
    </Shell>
  );
}
