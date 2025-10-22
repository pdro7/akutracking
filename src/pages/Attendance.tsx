import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, CheckCircle, XCircle, User, History } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPaymentStatus } from '@/types/student';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function Attendance() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dateString = format(selectedDate, 'yyyy-MM-dd');

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

  const markAttendanceMutation = useMutation({
    mutationFn: async ({ studentId, attended }: { studentId: string; attended: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const student = students.find(s => s.id === studentId)!;

      const { error } = await supabase.from('attendance_records').insert({
        student_id: studentId,
        date: dateString,
        attended,
        marked_by: user.id,
      });

      if (error) throw error;

      if (attended) {
        const { error: updateError } = await supabase
          .from('students')
          .update({
            classes_attended: student.classes_attended + 1,
            classes_remaining: student.classes_remaining - 1,
          })
          .eq('id', studentId);

        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Attendance recorded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const handleMarkAttendance = (studentId: string, attended: boolean) => {
    markAttendanceMutation.mutate({ studentId, attended });
  };

  const activeStudents = students;

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

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
        <div className="flex items-center gap-3">
          <CalendarIcon className="text-primary" size={24} />
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Select Date</h3>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {activeStudents.map((student) => {
          const status = getPaymentStatus(student.classes_remaining);
          return (
            <Card key={student.id} className="p-6 hover:shadow-hover transition-shadow">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                    <User className="text-primary-foreground" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{student.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {student.classes_remaining} {student.classes_remaining === 1 ? 'class' : 'classes'} remaining
                    </p>
                  </div>
                  {student.classes_remaining === 0 && (
                    <Badge variant="destructive">Payment Due</Badge>
                  )}
                  {student.classes_remaining <= 2 && student.classes_remaining > 0 && (
                    <Badge variant="warning">Low Credits</Badge>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleMarkAttendance(student.id, true)}
                    className="gap-2"
                    disabled={student.classes_remaining === 0}
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
          );
        })}
      </div>

      {activeStudents.length === 0 && (
        <Card className="p-12 text-center">
          <CalendarIcon className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-semibold mb-2">No students to mark</h3>
          <p className="text-muted-foreground">Add students to start tracking attendance</p>
        </Card>
      )}
    </div>
  );
}
