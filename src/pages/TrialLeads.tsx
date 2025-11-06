import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Phone, Mail, User } from 'lucide-react';
import { format } from 'date-fns';

type TrialLeadStatus = 'scheduled' | 'attended' | 'converted' | 'cancelled';

interface TrialLead {
  id: string;
  child_name: string;
  child_age: number | null;
  parent_name: string;
  parent_phone: string;
  parent_email: string | null;
  trial_class_date: string;
  notes: string | null;
  status: TrialLeadStatus;
  created_at: string;
}

const statusColors: Record<TrialLeadStatus, string> = {
  scheduled: 'bg-blue-500/10 text-blue-500',
  attended: 'bg-green-500/10 text-green-500',
  converted: 'bg-purple-500/10 text-purple-500',
  cancelled: 'bg-gray-500/10 text-gray-500',
};

export default function TrialLeads() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<TrialLeadStatus | 'all'>('all');

  const { data: leads, isLoading } = useQuery({
    queryKey: ['trial-leads', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('trial_leads')
        .select('*')
        .order('trial_class_date', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TrialLead[];
    },
  });

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Trial Class Leads</h1>
          <p className="text-muted-foreground">Track and manage trial class appointments</p>
        </div>
        <Button onClick={() => navigate('/trial-leads/new')} className="gap-2">
          <Plus size={18} />
          Add Trial Lead
        </Button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('all')}
          size="sm"
        >
          All
        </Button>
        {(['scheduled', 'attended', 'converted', 'cancelled'] as TrialLeadStatus[]).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            onClick={() => setStatusFilter(status)}
            size="sm"
            className="capitalize"
          >
            {status}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading trial leads...</p>
        </div>
      ) : leads && leads.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <Card key={lead.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{lead.child_name}</CardTitle>
                    <CardDescription>
                      {lead.child_age && `${lead.child_age} years old`}
                    </CardDescription>
                  </div>
                  <Badge className={statusColors[lead.status]} variant="secondary">
                    {lead.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(lead.trial_class_date), 'PPP')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.parent_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.parent_phone}</span>
                </div>
                {lead.parent_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{lead.parent_email}</span>
                  </div>
                )}
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
            <p className="text-muted-foreground">No trial leads found.</p>
            <Button onClick={() => navigate('/trial-leads/new')} className="mt-4 gap-2">
              <Plus size={18} />
              Add Your First Trial Lead
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
