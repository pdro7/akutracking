import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { getPaymentStatus } from '@/types/student';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Students() {
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

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Students</h1>
          <p className="text-muted-foreground">Manage all enrolled students</p>
        </div>
        <Button onClick={() => navigate('/students/new')} className="gap-2">
          <Plus size={20} />
          Add Student
        </Button>
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
