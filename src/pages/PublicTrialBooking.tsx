import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2, ArrowLeft, Clock, Video, CalendarDays, Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { es } from 'date-fns/locale';
import { REFERRAL_SOURCES } from '@/lib/referralSources';

// Página pública de agendamiento. Sustituye al link de Calendly y sigue su
// misma estructura, que es la que los padres ya conocen: panel de marca a
// la izquierda, calendario del mes y horas del día elegido a la derecha.
//
// El profesor lo asigna el backend; aquí nunca se muestran nombres del
// equipo ni cuánta plantilla hay.

const WHATSAPP = '+57 316 294 1820';

type Slot = {
  date: string;
  start_time: string;
  end_time: string;
  seats_left: number;
  /** Estudiantes que admite la clase. 1 = individual. */
  capacity: number;
};

type Step = 'slot' | 'form' | 'done';

// "YYYY-MM-DD" -> Date local sin corrimiento de día.
const parseISO = (iso: string) => new Date(iso + 'T12:00:00');
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function durationLabel(s?: Slot): string {
  if (!s) return '';
  const [h1, m1] = s.start_time.split(':').map(Number);
  const [h2, m2] = s.end_time.split(':').map(Number);
  const mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins % 60 === 0) return `${mins / 60} h`;
  return `${mins} min`;
}

export default function PublicTrialBooking() {
  const referralCode = typeof window !== 'undefined'
    ? window.localStorage.getItem('aku_referral_code') || undefined
    : undefined;

  const [step, setStep] = useState<Step>('slot');
  const [selectedDay, setSelectedDay] = useState<Date | undefined>();
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [childName, setChildName] = useState('');
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [city, setCity] = useState('');
  const [experience, setExperience] = useState('');
  const [referralSource, setReferralSource] = useState('');

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['public_trial_availability'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('trial-availability', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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

  const prettyDate = (d: Date) =>
    d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosen) return;
    if (!childName.trim() || !parentName.trim() || !phone.trim()) {
      toast.error('Nombre del niño, tu nombre y celular son obligatorios');
      return;
    }
    if (!email.trim()) {
      toast.error('Necesitamos tu correo para enviarte la confirmación');
      return;
    }

    setSubmitting(true);
    try {
      const extra = [
        city.trim() ? `Ciudad: ${city.trim()}` : null,
        experience.trim() ? `Exp. previa: ${experience.trim()}` : null,
      ].filter(Boolean).join(' | ');

      const { data, error } = await supabase.functions.invoke('book-trial', {
        body: {
          child_name: childName,
          parent_name: parentName,
          phone,
          email,
          date_of_birth: dob || null,
          referral_source: referralSource || null,
          notes: extra || null,
          date: chosen.date,
          start_time: chosen.start_time,
          referral_code: referralCode,
        },
      });

      let detail: string | null = null;
      if (error) {
        detail = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx?.json) {
            const body = await ctx.json();
            if (body?.error) detail = body.error;
          }
        } catch { /* ignore */ }
      } else if (data?.error) {
        detail = data.error;
      }

      if (detail) {
        // Si el hueco se ocupó mientras rellenaba, vuelve al calendario con
        // la lista refrescada en vez de dejarle en un callejón sin salida.
        if (detail.includes('ocuparse') || detail.includes('disponible')) {
          setChosen(null);
          setStep('slot');
        }
        throw new Error(detail);
      }

      if (referralCode && typeof window !== 'undefined') {
        window.localStorage.removeItem('aku_referral_code');
      }
      setStep('done');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Panel de marca (columna izquierda) ──────────────────────────────────
  const BrandPanel = (
    <div className="p-6 sm:p-8 md:border-r md:w-[340px] shrink-0">
      {step === 'form' && (
        <button
          onClick={() => setStep('slot')}
          className="mb-6 h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft size={16} />
        </button>
      )}

      <img
        src="/akumaya-logo.png"
        alt="AKUMAYA Educación"
        className="w-16 h-16 rounded-full mb-4"
      />
      <p className="text-sm font-semibold text-muted-foreground">AKUMAYA Educación</p>
      <h1 className="text-2xl font-bold leading-tight mt-1 mb-5">
        Clase de prueba gratuita
      </h1>

      <div className="space-y-3 text-sm">
        {chosen && (
          <div className="flex gap-2.5 items-start font-medium">
            <Clock size={17} className="mt-0.5 shrink-0 text-muted-foreground" />
            <span>{durationLabel(chosen)}</span>
          </div>
        )}
        <div className="flex gap-2.5 items-start">
          <Video size={17} className="mt-0.5 shrink-0 text-muted-foreground" />
          <span className="font-medium">
            Los datos de conexión se envían en la confirmación.
          </span>
        </div>
        {step === 'form' && chosen && selectedDay && (
          <div className="flex gap-2.5 items-start font-medium">
            <CalendarDays size={17} className="mt-0.5 shrink-0 text-muted-foreground" />
            <span className="capitalize">
              {chosen.start_time} – {chosen.end_time}, {prettyDate(selectedDay)}
            </span>
          </div>
        )}
        <div className="flex gap-2.5 items-start">
          <Globe size={17} className="mt-0.5 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">Hora de Colombia</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mt-6 leading-relaxed">
        Clase de prueba virtual de programación AKUMAYA.
        <br />
        Si no encuentras un día y hora que te vaya bien, escríbenos al WhatsApp{' '}
        <span className="whitespace-nowrap font-medium text-foreground">{WHATSAPP}</span>
      </p>
    </div>
  );

  // ── Confirmación ────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="bg-background rounded-xl border shadow-sm max-w-md w-full p-8 text-center">
          <CheckCircle2 className="mx-auto text-success mb-3" size={44} />
          <h2 className="text-xl font-bold mb-2">¡Clase de prueba agendada!</h2>
          <p className="text-muted-foreground mb-5">
            Te esperamos el{' '}
            <strong className="capitalize text-foreground">
              {selectedDay && prettyDate(selectedDay)}
            </strong>{' '}
            a las <strong className="text-foreground">{chosen?.start_time}</strong>.
          </p>
          <div className="text-sm text-muted-foreground space-y-2 text-left bg-muted/50 rounded-lg p-4">
            <p>
              Enviamos la confirmación a <strong className="text-foreground">{email}</strong>.
              Si no la ves en unos minutos, revisa la carpeta de spam.
            </p>
            <p>
              ¿Necesitas cambiarla? Escríbenos al WhatsApp {WHATSAPP} y la movemos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Calendario + formulario ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/30 p-3 sm:p-6">
      <div className="mx-auto max-w-5xl bg-background rounded-xl border shadow-sm overflow-hidden md:flex">
        {BrandPanel}

        <div className="p-6 sm:p-8 flex-1 border-t md:border-t-0">
          {step === 'slot' ? (
            <>
              <h2 className="text-xl font-bold mb-5">Selecciona una fecha y hora</h2>

              {isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando horarios...</p>
              ) : availableDays.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2">Ahora mismo no hay horarios disponibles.</p>
                  <p>Escríbenos al WhatsApp {WHATSAPP} y te buscamos un hueco.</p>
                </div>
              ) : (
                <div className="sm:flex sm:gap-10">
                  <Calendar
                    mode="single"
                    locale={es}
                    showOutsideDays={false}
                    selected={selectedDay}
                    onSelect={(d) => { setSelectedDay(d); setChosen(null); }}
                    disabled={(date) =>
                      !availableDays.some((a) => toISO(a) === toISO(date))
                    }
                    modifiers={{ available: availableDays }}
                    modifiersClassNames={{
                      available: 'bg-primary/10 text-primary font-semibold',
                    }}
                    className="p-0"
                    classNames={{
                      // Celdas más grandes y redondas, como en Calendly.
                      caption_label: 'text-base font-semibold',
                      head_cell: 'text-muted-foreground w-11 font-normal text-xs',
                      cell: 'h-11 w-11 text-center text-sm p-0 relative',
                      day: 'h-11 w-11 p-0 font-normal rounded-full hover:bg-primary/20 transition-colors',
                      day_selected:
                        'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
                      // Hoy no se resalta con fondo: sólo importa si está
                      // disponible, y eso ya lo marca el modifier.
                      day_today: 'font-semibold',
                      day_disabled: 'text-muted-foreground/50 hover:bg-transparent',
                    }}
                  />

                  <div className="mt-6 sm:mt-0 sm:flex-1 sm:min-w-[190px]">
                    {selectedDay ? (
                      <>
                        <p className="text-sm mb-3 capitalize">{prettyDate(selectedDay)}</p>
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                          {daySlots.map((s) => {
                            // Dos ventanas pueden empezar a la misma hora con
                            // duraciones distintas, así que la clave y el texto
                            // secundario incluyen la duración: si no, salen dos
                            // botones idénticos e indistinguibles.
                            const key = `${s.start_time}-${s.end_time}`;
                            const active = chosen
                              && chosen.start_time === s.start_time
                              && chosen.end_time === s.end_time;
                            // Las clases individuales no necesitan hablar de
                            // plazas: si el horario se ofrece, está libre.
                            const seats = s.capacity > 1
                              ? (s.seats_left === 1
                                  ? ' · 1 plaza libre'
                                  : ` · ${s.seats_left} plazas libres`)
                              : '';
                            return active ? (
                              <div key={key} className="flex gap-2">
                                <div className="flex-1 rounded-md bg-muted-foreground/80 text-background text-center py-2.5 font-semibold">
                                  {s.start_time}
                                </div>
                                <Button className="flex-1" onClick={() => setStep('form')}>
                                  Siguiente
                                </Button>
                              </div>
                            ) : (
                              <button
                                key={key}
                                onClick={() => setChosen(s)}
                                className="w-full rounded-md border-2 border-primary/40 text-primary py-2 hover:border-primary transition-colors"
                              >
                                <div className="font-semibold">{s.start_time}</div>
                                <div className="text-xs font-normal">
                                  {durationLabel(s)}{seats}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Elige un día resaltado para ver las horas disponibles.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-5">Introduce los datos</h2>
              <form onSubmit={submit} className="space-y-4 max-w-md">
                <div>
                  <Label>Tu nombre *</Label>
                  <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
                </div>
                <div>
                  <Label>Correo electrónico *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Para enviarte la confirmación"
                  />
                </div>
                <div>
                  <Label>Celular de contacto *</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="300 000 0000"
                  />
                </div>
                <div>
                  <Label>Nombre de tu hijo(a) *</Label>
                  <Input value={childName} onChange={(e) => setChildName(e.target.value)} />
                </div>
                <div>
                  <Label>Fecha de nacimiento</Label>
                  <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
                <div>
                  <Label>Ciudad</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <Label>¿Ha tenido experiencia previa con programación/robótica?</Label>
                  <Input
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                  />
                </div>
                <div>
                  <Label>¿Cómo nos has conocido?</Label>
                  <Select value={referralSource} onValueChange={setReferralSource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {REFERRAL_SOURCES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Agendando...' : 'Agendar clase de prueba'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
