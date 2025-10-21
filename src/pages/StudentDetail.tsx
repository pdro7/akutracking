import { useParams, useNavigate } from 'react-router-dom';
import { getPaymentStatus } from '@/types/student';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, CheckCircle, XCircle, User, Phone, Mail, Edit, Cake } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInYears } from 'date-fns';

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: attendanceHistory = [] } = useQuery({
    queryKey: ['attendance', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*, profiles:marked_by(name)')
        .eq('student_id', id)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  if (!student) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Student not found</h2>
          <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  const status = getPaymentStatus(student.classes_remaining);
  const statusConfig = {
    good: { variant: 'success' as const, label: 'Good Standing' },
    low: { variant: 'warning' as const, label: 'Low Credits' },
    due: { variant: 'destructive' as const, label: 'Payment Due' },
  };

  const calculateAge = (dateOfBirth: string | null) => {
    if (!dateOfBirth) return null;
    return differenceInYears(new Date(), new Date(dateOfBirth));
  };

  const age = calculateAge(student.date_of_birth);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
          <ArrowLeft size={20} />
          Back to Dashboard
        </Button>
        <Button onClick={() => navigate(`/student/${id}/edit`)} className="gap-2">
          <Edit size={20} />
          Edit Student
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Info Card */}
        <Card className="p-6 lg:col-span-1">
          <div className="text-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-primary flex items-center justify-center mx-auto mb-4">
              <User className="text-primary-foreground" size={48} />
            </div>
            <h2 className="text-2xl font-bold mb-2">{student.name}</h2>
            <Badge variant={statusConfig[status].variant} className="mb-4">
              {statusConfig[status].label}
            </Badge>
          </div>

          <div className="space-y-3 text-sm">
            {age !== null && (
              <div className="flex items-center gap-2">
                <Cake size={16} className="text-muted-foreground" />
                <p><span className="font-medium">{age}</span> years old</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground mb-1">Parent/Guardian</p>
              <p className="font-medium">{student.parent_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-muted-foreground" />
              <p>{student.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-muted-foreground" />
              <p>{student.phone}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Enrollment Date</p>
              <p className="font-medium">{new Date(student.enrollment_date).toLocaleDateString()}</p>
            </div>
            {student.last_payment_date && (
              <div>
                <p className="text-muted-foreground mb-1">Last Payment</p>
                <p className="font-medium">{new Date(student.last_payment_date).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          <div className="border-t mt-6 pt-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pack Size</p>
                <p className="text-xl font-bold">{student.pack_size}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Attended</p>
                <p className="text-xl font-bold text-primary">{student.classes_attended}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Remaining Classes</p>
              <p className="text-3xl font-bold">{student.classes_remaining}</p>
            </div>
          </div>
        </Card>

        {/* Attendance History */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Attendance History</h3>
            <Calendar size={24} className="text-muted-foreground" />
          </div>

          <div className="space-y-3">
            {attendanceHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No attendance records yet</p>
            ) : (
              attendanceHistory.map((record: any) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {record.attended ? (
                      <CheckCircle className="text-green-600" size={24} />
                    ) : (
                      <XCircle className="text-muted-foreground" size={24} />
                    )}
                    <div>
                      <p className="font-medium">
                        {new Date(record.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Marked by {record.profiles?.name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={record.attended ? 'success' : 'secondary'}>
                    {record.attended ? 'Present' : 'Absent'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
