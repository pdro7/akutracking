import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, TrendingUp, UserCheck, GraduationCap, AlertTriangle, Clock } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type RangeOption = '7d' | '30d' | '90d' | 'all';

type ConversationRow = {
  id: string;
  created_at: string;
  updated_at: string;
  escalated: boolean | null;
  lead_id: string | null;
  student_id: string | null;
  messages: unknown;
};

const RANGE_LABELS: Record<RangeOption, string> = {
  '7d':  'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  'all': 'Todo el tiempo',
};

function rangeStart(range: RangeOption): Date | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmt(n: number, digits = 0): string {
  return n.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function PabloStats() {
  const [range, setRange] = useState<RangeOption>('30d');

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['pablo_stats_conversations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('whatsapp_conversations')
        .select('id, created_at, updated_at, escalated, lead_id, student_id, messages')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ConversationRow[];
    },
  });

  const stats = useMemo(() => {
    const start = rangeStart(range);
    const filtered = start
      ? conversations.filter((c) => new Date(c.created_at) >= start)
      : conversations;

    const total = filtered.length;
    const escalated = filtered.filter((c) => c.escalated).length;
    const withLead = filtered.filter((c) => c.lead_id).length;
    const withStudent = filtered.filter((c) => c.student_id).length;

    const totalMsgs = filtered.reduce((sum, c) => {
      const arr = Array.isArray(c.messages) ? c.messages : [];
      return sum + arr.length;
    }, 0);
    const avgMsgs = total > 0 ? totalMsgs / total : 0;

    // Time series — group by day
    const byDay: Record<string, number> = {};
    if (start) {
      // pre-fill all days in the range so the line is continuous
      const cursor = new Date(start);
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      while (cursor <= end) {
        byDay[cursor.toISOString().split('T')[0]] = 0;
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    filtered.forEach((c) => {
      const day = new Date(c.created_at).toISOString().split('T')[0];
      byDay[day] = (byDay[day] ?? 0) + 1;
    });
    const timeSeries = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({
        day,
        label: new Date(day + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        count,
      }));

    // Hour distribution (0-23) — based on first user message timestamp (created_at)
    const byHour: number[] = Array(24).fill(0);
    filtered.forEach((c) => {
      const h = new Date(c.created_at).getHours();
      byHour[h] += 1;
    });
    const hourSeries = byHour.map((count, hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}h`,
      count,
    }));

    return {
      total,
      escalated,
      withLead,
      withStudent,
      avgMsgs,
      escalationRate: total > 0 ? (escalated / total) * 100 : 0,
      leadRate:       total > 0 ? (withLead / total) * 100 : 0,
      studentRate:    total > 0 ? (withStudent / total) * 100 : 0,
      timeSeries,
      hourSeries,
    };
  }, [conversations, range]);

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Cargando estadísticas...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Estadísticas de Pablo</h1>
          <p className="text-muted-foreground text-sm">
            Métricas de las conversaciones de WhatsApp con el asistente
          </p>
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {(['7d', '30d', '90d', 'all'] as RangeOption[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                range === r
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard
          label="Conversaciones"
          value={fmt(stats.total)}
          icon={MessageCircle}
        />
        <StatCard
          label="Promedio mensajes"
          value={fmt(stats.avgMsgs, 1)}
          icon={TrendingUp}
        />
        <StatCard
          label="Con lead"
          value={`${fmt(stats.withLead)}`}
          sub={`${fmt(stats.leadRate, 1)}%`}
          icon={UserCheck}
          tone="green"
        />
        <StatCard
          label="Con alumno"
          value={`${fmt(stats.withStudent)}`}
          sub={`${fmt(stats.studentRate, 1)}%`}
          icon={GraduationCap}
          tone="purple"
        />
      </div>

      {/* Funnel + escalation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" />
            Tasa de escalamiento a humano
          </h2>
          <div className="flex items-baseline gap-3">
            <p className="text-3xl font-bold text-orange-500">{fmt(stats.escalationRate, 1)}%</p>
            <p className="text-sm text-muted-foreground">
              {fmt(stats.escalated)} de {fmt(stats.total)} conversaciones
            </p>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all"
              style={{ width: `${stats.escalationRate}%` }}
            />
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-3">Embudo de conversión</h2>
          <div className="space-y-2">
            <FunnelRow label="Conversaciones" count={stats.total} max={stats.total} color="bg-blue-500" />
            <FunnelRow label="Con lead vinculado" count={stats.withLead} max={stats.total} color="bg-green-500" />
            <FunnelRow label="Inscritos como alumnos" count={stats.withStudent} max={stats.total} color="bg-purple-500" />
          </div>
        </Card>
      </div>

      {/* Time series */}
      <Card className="p-4 mb-6">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Clock size={16} className="text-primary" />
          Conversaciones nuevas por día
        </h2>
        {stats.timeSeries.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">
            Sin datos para el período seleccionado
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats.timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) => v}
                formatter={(v: number) => [v, 'Conversaciones']}
              />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Hour distribution */}
      <Card className="p-4">
        <h2 className="font-semibold text-sm mb-1 flex items-center gap-2">
          <Clock size={16} className="text-primary" />
          Distribución por hora del día
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Cuándo escriben más los padres (basado en hora de la primera conversación)
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.hourSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(v) => `Hora ${v}`}
              formatter={(v: number) => [v, 'Conversaciones']}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function StatCard({
  label, value, sub, icon: Icon, tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number }>;
  tone?: 'green' | 'purple' | 'orange';
}) {
  const toneClasses =
    tone === 'green' ? 'bg-green-500/10 text-green-600' :
    tone === 'purple' ? 'bg-purple-500/10 text-purple-600' :
    tone === 'orange' ? 'bg-orange-500/10 text-orange-600' :
    'bg-gradient-primary text-white';

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl md:text-3xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${toneClasses}`}>
          <Icon size={18} />
        </div>
      </div>
    </Card>
  );
}

function FunnelRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{count} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
