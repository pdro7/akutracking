import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, Phone, Mail, User, Save } from 'lucide-react';
import { format, differenceInYears } from 'date-fns';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

type TrialLeadStatus = 'scheduled' | 'attended' | 'converted' | 'cancelled' | 'no_show';

interface TrialLead {
  id: string;
  child_name: string;
  date_of_birth: string | null;
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
  no_show: 'bg-orange-500/10 text-orange-500',
};

export default function TrialLeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [childName, setChildName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [trialClassDate, setTrialClassDate] = useState('');
  const [status, setStatus] = useState<TrialLeadStatus>('scheduled');
  const [notes, setNotes] = useState('');

  const { data: lead, isLoading } = useQuery({
    queryKey: ['trial-lead', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trial_leads')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as TrialLead | null;
    },
  });

  useEffect(() => {
    if (lead) {
      setChildName(lead.child_name);
      setDateOfBirth(lead.date_of_birth || '');
      setParentName(lead.parent_name);
      setParentPhone(lead.parent_phone);
      setParentEmail(lead.parent_email || '');
      setTrialClassDate(lead.trial_class_date);
      setStatus(lead.status);
      setNotes(lead.notes || '');
    }
  }, [lead]);

  const updateLeadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('trial_leads')
        .update({
          child_name: childName,
          date_of_birth: dateOfBirth || null,
          parent_name: parentName,
          parent_phone: parentPhone,
          parent_email: parentEmail || null,
          trial_class_date: trialClassDate,
          status,
          notes: notes || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial-lead', id] });
      queryClient.invalidateQueries({ queryKey: ['trial-leads'] });
      toast.success('Trial lead updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSave = () => {
    if (!childName || !parentName || !parentPhone || !trialClassDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    updateLeadMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Loading trial lead...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Trial lead not found</h2>
          <Button onClick={() => navigate('/trial-leads')}>Back to Trial Leads</Button>
        </Card>
      </div>
    );
  }

  const age = lead.date_of_birth ? differenceInYears(new Date(), new Date(lead.date_of_birth)) : null;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate('/trial-leads')} className="gap-2">
          <ArrowLeft size={20} />
          Back to Trial Leads
        </Button>
        <Button onClick={handleSave} disabled={updateLeadMutation.isPending} className="gap-2">
          <Save size={20} />
          {updateLeadMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Header Card */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{lead.child_name}</h1>
              {age !== null && (
                <p className="text-muted-foreground">{age} years old</p>
              )}
            </div>
            <Badge className={statusColors[status]} variant="secondary">
              {status === 'no_show' ? 'No Show' : status}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Trial Date: {format(new Date(lead.trial_class_date), 'PPP')}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Created: {format(new Date(lead.created_at), 'PPP')}</span>
            </div>
          </div>
        </Card>

        {/* Edit Form */}
        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>Trial Lead Information</CardTitle>
          </CardHeader>
          <CardContent className="px-0 space-y-4">
            {/* Child Information */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Child Name *</label>
              <Input
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="Enter child's name"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Date of Birth</label>
              <Input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            {/* Parent Information */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Parent/Guardian Name *</label>
              <Input
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Enter parent's name"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Parent Phone *</label>
                <Input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Parent Email</label>
                <Input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="Enter email address"
                />
              </div>
            </div>

            {/* Trial Class Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Trial Class Date *</label>
                <Input
                  type="date"
                  value={trialClassDate}
                  onChange={(e) => setTrialClassDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Status *</label>
                <Select value={status} onValueChange={(value) => setStatus(value as TrialLeadStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="attended">Attended</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes about this trial lead..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
