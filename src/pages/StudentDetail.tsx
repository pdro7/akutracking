import { useParams, useNavigate } from 'react-router-dom';
import { mockStudents } from '@/data/mockData';
import { getPaymentStatus } from '@/types/student';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, CheckCircle, XCircle, User, Phone, Mail } from 'lucide-react';

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const student = mockStudents.find(s => s.id === id);

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

  const status = getPaymentStatus(student.classesRemaining);
  const statusConfig = {
    good: { variant: 'success' as const, label: 'Good Standing' },
    low: { variant: 'warning' as const, label: 'Low Credits' },
    due: { variant: 'destructive' as const, label: 'Payment Due' },
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => navigate('/')} className="mb-6 gap-2">
        <ArrowLeft size={20} />
        Back to Dashboard
      </Button>

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
            <div>
              <p className="text-muted-foreground mb-1">Parent/Guardian</p>
              <p className="font-medium">{student.parentName}</p>
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
              <p className="font-medium">{new Date(student.enrollmentDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Last Payment</p>
              <p className="font-medium">{new Date(student.lastPaymentDate).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="border-t mt-6 pt-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pack Size</p>
                <p className="text-xl font-bold">{student.packSize}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Attended</p>
                <p className="text-xl font-bold text-primary">{student.classesAttended}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Remaining Classes</p>
              <p className="text-3xl font-bold">{student.classesRemaining}</p>
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
            {student.attendanceHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No attendance records yet</p>
            ) : (
              student.attendanceHistory
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {record.attended ? (
                        <CheckCircle className="text-success" size={24} />
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
                        <p className="text-sm text-muted-foreground">Marked by {record.markedBy}</p>
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
