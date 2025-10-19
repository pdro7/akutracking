import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Calendar, TrendingUp } from 'lucide-react';
import { getPaymentStatus } from '@/types/student';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const navigate = useNavigate();
  
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  const activeStudents = students;
  const needsPayment = activeStudents.filter(s => s.classes_remaining === 0);
  const lowCredits = activeStudents.filter(s => s.classes_remaining > 0 && s.classes_remaining <= 2);

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  const stats = [
    { label: 'Active Students', value: activeStudents.length, icon: Users, color: 'text-primary' },
    { label: 'Payment Due', value: needsPayment.length, icon: TrendingUp, color: 'text-destructive' },
    { label: 'Low Credits', value: lowCredits.length, icon: Calendar, color: 'text-warning' },
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-3xl font-bold">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Students List */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">All Students</h2>
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
                      <Badge variant={statusConfig[status].variant}>
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
