import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Phone, Mail, User, GraduationCap } from 'lucide-react';
import { format, differenceInYears } from 'date-fns';

type TrialLeadStatus = 'trial_scheduled' | 'trial_attended' | 'enrolled' | 'trial_cancelled' | 'trial_no_show' | 'interested';

interface TrialLead {
  id: string;
  child_name: string;
  date_of_birth: string | null;
  parent_name: string;
  phone: string | null;
  email: string | null;
  trial_class_date: string;
  trial_class_time: string | null;
  notes: string | null;
  status: TrialLeadStatus;
  created_at: string;
  trial_teacher: { name: string } | null;
}

const statusColors: Record<TrialLeadStatus, string> = {
  trial_scheduled: 'bg-blue-500/10 text-blue-500',
  trial_attended:  'bg-green-500/10 text-green-500',
  interested:      'bg-teal-500/10 text-teal-600',
  enrolled:        'bg-purple-500/10 text-purple-500',
  trial_cancelled: 'bg-gray-500/10 text-gray-500',
  trial_no_show:   'bg-orange-500/10 text-orange-500',
};

const statusLabels: Record<TrialLeadStatus, string> = {
  trial_scheduled: 'Agendado',
  trial_attended:  'Asistió',
  interested:      'Interesado',
  enrolled:        'Inscrito',
  trial_cancelled: 'Cancelado',
  trial_no_show:   'No asistió',
};

export default function TrialLeads() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<TrialLeadStatus | 'all'>('all');

  const { data: leads, isLoading } = useQuery({
    queryKey: ['trial-leads', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('*, trial_teacher:teachers!trial_teacher_id(name)')
        .not('trial_class_date', 'is', null)
        .order('trial_class_date', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as TrialLead[];
    },
  });

  const filterButtons: Array<{ value: TrialLeadStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'trial_scheduled', label: 'Agendado' },
    { value: 'trial_attended', label: 'Asistió' },
    { value: 'interested', label: 'Interesado' },
    { value: 'enrolled', label: 'Inscrito' },
    { value: 'trial_cancelled', label: 'Cancelado' },
    { value: 'trial_no_show', label: 'No asistió' },
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Clases de Prueba</h1>
          <p className="text-muted-foreground">Seguimiento de clases de prueba y leads de Calendly</p>
        </div>
        <Button onClick={() => navigate('/trial-leads/new')} className="gap-2">
          <Plus size={18} />
          <span className="hidden sm:inline">Agregar</span>
        </Button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {filterButtons.map(({ value, label }) => (
          <Button
            key={value}
            variant={statusFilter === value ? 'default' : 'outline'}
            onClick={() => setStatusFilter(value)}
            size="sm"
          >
            {label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      ) : leads && leads.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <Card
              key={lead.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/trial-leads/${lead.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{lead.child_name}</CardTitle>
                    <CardDescription>
                      {lead.date_of_birth && `${differenceInYears(new Date(), new Date(lead.date_of_birth))} años`}
                    </CardDescription>
                  </div>
                  <Badge className={statusColors[lead.status]} variant="secondary">
                    {statusLabels[lead.status] ?? lead.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(new Date(lead.trial_class_date + 'T12:00:00'), 'PPP')}
                    {lead.trial_class_time && ` · ${lead.trial_class_time.slice(0, 5)}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.parent_name}</span>
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.phone}</span>
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{lead.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.trial_teacher?.name ?? <span className="text-muted-foreground italic">Por asignar</span>}</span>
                </div>
                {lead.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground line-clamp-2">{lead.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No hay clases de prueba.</p>
            <Button onClick={() => navigate('/trial-leads/new')} className="mt-4 gap-2">
              <Plus size={18} />
              Agregar la primera
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
