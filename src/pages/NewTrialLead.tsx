import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

const trialLeadSchema = z.object({
  childName: z.string().min(1, 'Child name is required').max(100, 'Child name must be less than 100 characters'),
  dateOfBirth: z.string().optional(),
  parentName: z.string().min(1, 'Parent name is required').max(100, 'Parent name must be less than 100 characters'),
  parentPhone: z.string().min(1, 'Phone is required').max(20, 'Phone must be less than 20 characters'),
  parentEmail: z.string().email('Invalid email').max(255, 'Email must be less than 255 characters').optional().or(z.literal('')),
  trialClassDate: z.string().min(1, 'Trial class date is required'),
  status: z.enum(['scheduled', 'attended', 'converted', 'cancelled']),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

type TrialLeadFormValues = z.infer<typeof trialLeadSchema>;

export default function NewTrialLead() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TrialLeadFormValues>({
    resolver: zodResolver(trialLeadSchema),
    defaultValues: {
      childName: '',
      dateOfBirth: '',
      parentName: '',
      parentPhone: '',
      parentEmail: '',
      trialClassDate: '',
      status: 'scheduled',
      notes: '',
    },
  });

  const addTrialLeadMutation = useMutation({
    mutationFn: async (values: TrialLeadFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.from('trial_leads').insert({
        child_name: values.childName,
        date_of_birth: values.dateOfBirth || null,
        parent_name: values.parentName,
        parent_phone: values.parentPhone,
        parent_email: values.parentEmail || null,
        trial_class_date: values.trialClassDate,
        status: values.status,
        notes: values.notes || null,
        created_by: user.id,
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trial-leads'] });
      toast({
        title: 'Success',
        description: 'Trial lead added successfully',
      });
      navigate('/trial-leads');
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    },
  });

  const onSubmit = (values: TrialLeadFormValues) => {
    addTrialLeadMutation.mutate(values);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/trial-leads')} className="gap-2 mb-4">
          <ArrowLeft size={18} />
          Back to Trial Leads
        </Button>
        <h1 className="text-3xl font-bold">Add New Trial Lead</h1>
        <p className="text-muted-foreground">Record a new trial class appointment</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Child Information</CardTitle>
              <CardDescription>Basic details about the child</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="childName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Child Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter child's name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parent Information</CardTitle>
              <CardDescription>Contact details for the parent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="parentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter parent's name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trial Class Details</CardTitle>
              <CardDescription>Information about the trial class</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="trialClassDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trial Class Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="attended">Attended</SelectItem>
                        <SelectItem value="converted">Converted</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any additional notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/trial-leads')}>
              Cancel
            </Button>
            <Button type="submit" disabled={addTrialLeadMutation.isPending}>
              {addTrialLeadMutation.isPending ? 'Adding...' : 'Add Trial Lead'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
