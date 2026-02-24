import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Calendar, TrendingUp, Search, Monitor } from 'lucide-react';
import { getPaymentStatus } from '@/types/student';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('is_active', true)
        .eq('archived', false)
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  const { data: activeGroups = [] } = useQuery({
    queryKey: ['active_groups_count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_groups')
        .select('id')
        .eq('status', 'active');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: upcomingInstallments = [] } = useQuery({
    queryKey: ['upcoming_installments'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const sevenDays = new Date();
      sevenDays.setDate(sevenDays.getDate() + 7);
      const sevenDaysStr = sevenDays.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('id, installment_2_due_date, students(name)')
        .eq('payment_plan', 'installments')
        .is('installment_2_paid_at', null)
        .gte('installment_2_due_date', today)
        .lte('installment_2_due_date', sevenDaysStr);
      if (error) throw error;
      return data || [];
    }
  });

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.parent_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeStudents = filteredStudents;
  const needsPayment = activeStudents.filter(s => s.classes_remaining === 0);
  const lowCredits = activeStudents.filter(s => s.classes_remaining > 0 && s.classes_remaining <= 2);

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  const stats = [
    { label: 'Active Students', value: activeStudents.length, icon: Users },
    { label: 'Payment Due', value: needsPayment.length, icon: TrendingUp },
    { label: 'Low Credits', value: lowCredits.length, icon: Calendar },
    { label: 'Grupos activos', value: activeGroups.length, icon: Monitor },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your academy overview.</p>
        </div>
        <Button onClick={() => navigate('/students/new')} className="gap-2">
          <Plus size={20} />
          Add Student
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-3xl font-bold">{stat.value}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center text-white">
                <stat.icon size={24} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Upcoming installment alerts */}
      {(upcomingInstallments as any[]).length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-medium text-yellow-800 mb-2">
            Cuotas virtuales próximas a vencer ({(upcomingInstallments as any[]).length}):
          </p>
          {(upcomingInstallments as any[]).map((e: any) => (
            <p key={e.id} className="text-sm text-yellow-700">
              • {(e.students as any)?.name} — vence {new Date(e.installment_2_due_date + 'T12:00:00').toLocaleDateString('es-CO')}
            </p>
          ))}
        </div>
      )}

      {/* Students List */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">All Students</h2>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              type="text"
              placeholder="Search by student or parent name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Parent Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Classes Attended</TableHead>
                <TableHead>Classes Remaining</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeStudents.map((student) => {
                const status = getPaymentStatus(student.classes_remaining);
                const statusConfig = {
                  good: { variant: 'success' as const, label: 'Active' },
                  low: { variant: 'warning' as const, label: 'Low Credits' },
                  due: { variant: 'destructive' as const, label: 'Payment Due' },
                };
                
                return (
                  <TableRow 
                    key={student.id} 
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => navigate(`/student/${student.id}`)}
                  >
                    <TableCell className="font-medium text-primary">{student.name}</TableCell>
                    <TableCell>{student.parent_name}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>{student.classes_attended}</TableCell>
                    <TableCell>{student.classes_remaining}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[status].variant} className="whitespace-nowrap">
                        {statusConfig[status].label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {activeStudents.length === 0 && (
        <Card className="p-12 text-center">
          <Users className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-semibold mb-2">No students yet</h3>
          <p className="text-muted-foreground mb-4">Get started by adding your first student</p>
          <Button onClick={() => navigate('/students/new')}>
            <Plus size={20} className="mr-2" />
            Add First Student
          </Button>
        </Card>
      )}
    </div>
  );
}
