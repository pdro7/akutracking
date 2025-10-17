import { useState } from 'react';
import { mockStudents } from '@/data/mockData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, XCircle, User, History } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function Attendance() {
  const navigate = useNavigate();
  const [selectedDate] = useState(new Date().toISOString().split('T')[0]);
  const activeStudents = mockStudents.filter(s => s.isActive);
  const today = new Date();
  const isSaturday = today.getDay() === 6;

  const handleMarkAttendance = (studentId: string, attended: boolean) => {
    toast.success(
      `Marked ${mockStudents.find(s => s.id === studentId)?.name} as ${attended ? 'present' : 'absent'}`
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Mark Attendance</h1>
          <p className="text-muted-foreground">Track student attendance for each class session</p>
        </div>
        <Button onClick={() => navigate('/attendance/history')} variant="outline" className="gap-2">
          <History size={20} />
          View History
        </Button>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="text-primary" size={24} />
          <div>
            <h3 className="font-semibold">Today's Date</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </Card>

      {!isSaturday && (
        <Card className="p-12 text-center">
          <Calendar className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-semibold mb-2">Classes are only on Saturdays</h3>
          <p className="text-muted-foreground">Please come back on Saturday to mark attendance</p>
        </Card>
      )}

      {isSaturday && (
        <div className="space-y-4">
          {activeStudents.map((student) => (
            <Card key={student.id} className="p-6 hover:shadow-hover transition-shadow">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                    <User className="text-primary-foreground" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{student.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {student.classesRemaining} {student.classesRemaining === 1 ? 'class' : 'classes'} remaining
                    </p>
                  </div>
                  {student.classesRemaining === 0 && (
                    <Badge variant="destructive">Payment Due</Badge>
                  )}
                  {student.classesRemaining <= 2 && student.classesRemaining > 0 && (
                    <Badge variant="warning">Low Credits</Badge>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleMarkAttendance(student.id, true)}
                    className="gap-2"
                    disabled={student.classesRemaining === 0}
                  >
                    <CheckCircle size={20} />
                    Present
                  </Button>
                  <Button
                    onClick={() => handleMarkAttendance(student.id, false)}
                    variant="outline"
                    className="gap-2"
                  >
                    <XCircle size={20} />
                    Absent
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {isSaturday && activeStudents.length === 0 && (
        <Card className="p-12 text-center">
          <Calendar className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-semibold mb-2">No students to mark</h3>
          <p className="text-muted-foreground">Add students to start tracking attendance</p>
        </Card>
      )}
    </div>
  );
}
