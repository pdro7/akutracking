import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Users, LayoutGrid, List, MessageCircle, Upload } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type LeadStatus = 'new' | 'contacted' | 'trial_scheduled' | 'trial_attended' | 'trial_no_show' | 'enrolled' | 'lost';
type LeadSource = 'whatsapp' | 'google_organic' | 'web' | 'calendly' | 'referral' | 'other';

const STATUS_CONFIG: Record<LeadStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'; color: string }> = {
  new:             { label: 'Nuevo',            variant: 'secondary',    color: 'bg-slate-100 border-slate-200' },
  contacted:       { label: 'Contactado',       variant: 'default',      color: 'bg-blue-50 border-blue-200' },
  trial_scheduled: { label: 'Prueba agendada',  variant: 'warning',      color: 'bg-yellow-50 border-yellow-200' },
  trial_attended:  { label: 'Prueba realizada', variant: 'warning',      color: 'bg-orange-50 border-orange-200' },
  trial_no_show:   { label: 'No asistió',       variant: 'destructive',  color: 'bg-red-50 border-red-200' },
  enrolled:        { label: 'Inscrito',         variant: 'success',      color: 'bg-green-50 border-green-200' },
  lost:            { label: 'Perdido',          variant: 'destructive',  color: 'bg-gray-50 border-gray-200' },
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
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

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

  const { data: allLeads = [] } = useQuery({
    queryKey: ['leads', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: viewMode === 'kanban',
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

  const startConversationMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase.functions.invoke('start-conversation', {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads_counts'] });
      toast.success('Pablo ha iniciado la conversación');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('leads')
        .update({ status: status as any, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads_counts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = leads.filter((l: any) =>
    !search ||
    l.child_name.toLowerCase().includes(search.toLowerCase()) ||
    l.parent_name.toLowerCase().includes(search.toLowerCase()) ||
    l.phone.includes(search)
  );

  const kanbanFiltered = (allLeads as any[]).filter((l: any) =>
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
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('table')}
            >
              <List size={16} />
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid size={16} />
            </Button>
          </div>
          <Button variant="outline" onClick={() => navigate('/leads/import')} className="gap-2">
            <Upload size={16} />
            Importar CSV
          </Button>
          <Button onClick={() => navigate('/leads/new')} className="gap-2">
            <Plus size={20} />
            Nuevo lead
          </Button>
        </div>
      </div>

      {/* Pipeline summary cards — only in table mode */}
      {viewMode === 'table' && (
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
      )}

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

      {/* Table view */}
      {viewMode === 'table' && (
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
                  <TableHead></TableHead>
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {lead.status === 'new' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs border-green-300 text-green-700 hover:bg-green-50"
                          disabled={startConversationMutation.isPending}
                          onClick={() => startConversationMutation.mutate(lead.id)}
                        >
                          <MessageCircle size={13} />
                          Iniciar con Pablo
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* Kanban view */}
      {viewMode === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.filter(s => s.status !== 'all').map((stage) => {
            const stageLeads = kanbanFiltered.filter((l: any) => l.status === stage.status);
            const config = STATUS_CONFIG[stage.status as LeadStatus];
            return (
              <div
                key={stage.status}
                className="flex-shrink-0 w-60"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const leadId = e.dataTransfer.getData('leadId');
                  if (leadId) updateStatusMutation.mutate({ id: leadId, status: stage.status as string });
                }}
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-sm font-semibold">{stage.label}</h3>
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {stageLeads.length}
                  </span>
                </div>
                <div className={`min-h-24 rounded-xl border-2 p-2 space-y-2 ${config.color}`}>
                  {stageLeads.map((lead: any) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('leadId', lead.id)}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className="bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none"
                    >
                      <p className="font-medium text-sm leading-tight">{lead.child_name}</p>
                      <p className="text-xs text-muted-foreground">{lead.parent_name}</p>
                      {(lead.city || lead.age) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[lead.age, lead.city].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {lead.course_interest && (
                        <p className="text-xs text-primary/80 font-medium mt-1">{lead.course_interest}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${SOURCE_CONFIG[lead.source as LeadSource]?.color}`}>
                          {SOURCE_CONFIG[lead.source as LeadSource]?.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(lead.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
