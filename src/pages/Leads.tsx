import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type LeadStatus = 'new' | 'contacted' | 'trial_scheduled' | 'trial_attended' | 'trial_no_show' | 'enrolled' | 'lost';
type LeadSource = 'whatsapp' | 'google_organic' | 'web' | 'calendly' | 'referral' | 'other';

const STATUS_CONFIG: Record<LeadStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' }> = {
  new:             { label: 'Nuevo',            variant: 'secondary' },
  contacted:       { label: 'Contactado',       variant: 'default' },
  trial_scheduled: { label: 'Prueba agendada',  variant: 'warning' },
  trial_attended:  { label: 'Prueba realizada', variant: 'warning' },
  trial_no_show:   { label: 'No asistió',       variant: 'destructive' },
  enrolled:        { label: 'Inscrito',         variant: 'success' },
  lost:            { label: 'Perdido',          variant: 'destructive' },
};

const SOURCE_CONFIG: Record<LeadSource, { label: string; color: string }> = {
  whatsapp:       { label: 'WhatsApp',   color: 'bg-green-100 text-green-800' },
  google_organic: { label: 'Google',     color: 'bg-blue-100 text-blue-800' },
  web:            { label: 'Web',        color: 'bg-purple-100 text-purple-800' },
  calendly:       { label: 'Calendly',   color: 'bg-orange-100 text-orange-800' },
  referral:       { label: 'Referido',   color: 'bg-yellow-100 text-yellow-800' },
  other:          { label: 'Otro',       color: 'bg-gray-100 text-gray-800' },
};

const PIPELINE_STAGES: { status: LeadStatus | 'all'; label: string }[] = [
  { status: 'all',             label: 'Todos' },
  { status: 'new',             label: 'Nuevos' },
  { status: 'contacted',       label: 'Contactados' },
  { status: 'trial_scheduled', label: 'Prueba agendada' },
  { status: 'trial_attended',  label: 'Prueba realizada' },
  { status: 'trial_no_show',   label: 'No asistió' },
  { status: 'enrolled',        label: 'Inscritos' },
  { status: 'lost',            label: 'Perdidos' },
];

export default function Leads() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ['leads_counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('status');
      if (error) throw error;
      const c: Record<string, number> = { all: data?.length || 0 };
      for (const row of (data || [])) {
        c[row.status] = (c[row.status] || 0) + 1;
      }
      return c;
    },
  });

  const filtered = leads.filter((l: any) =>
    !search ||
    l.child_name.toLowerCase().includes(search.toLowerCase()) ||
    l.parent_name.toLowerCase().includes(search.toLowerCase()) ||
    l.phone.includes(search)
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Users className="text-primary-foreground" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Leads</h1>
            <p className="text-muted-foreground">Seguimiento de potenciales alumnos</p>
          </div>
        </div>
        <Button onClick={() => navigate('/leads/new')} className="gap-2">
          <Plus size={20} />
          Nuevo lead
        </Button>
      </div>

      {/* Pipeline summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {PIPELINE_STAGES.filter(s => s.status !== 'all').map((stage) => (
          <Card
            key={stage.status}
            className={`p-3 cursor-pointer transition-all ${statusFilter === stage.status ? 'ring-2 ring-primary' : 'hover:bg-accent/50'}`}
            onClick={() => setStatusFilter(statusFilter === stage.status ? 'all' : stage.status as LeadStatus)}
          >
            <p className="text-2xl font-bold">{counts[stage.status] || 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stage.label}</p>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 max-w-sm"
        />
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No hay leads en esta etapa</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Niño</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Fuente</TableHead>
                <TableHead>Curso interés</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha entrada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead: any) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <TableCell>
                    <p className="font-medium">{lead.child_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.parent_name}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <p>{lead.phone}</p>
                    {lead.email && <p className="text-xs">{lead.email}</p>}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${SOURCE_CONFIG[lead.source as LeadSource]?.color}`}>
                      {SOURCE_CONFIG[lead.source as LeadSource]?.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.course_interest || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_CONFIG[lead.status as LeadStatus]?.variant}>
                      {STATUS_CONFIG[lead.status as LeadStatus]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString('es-CO')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
