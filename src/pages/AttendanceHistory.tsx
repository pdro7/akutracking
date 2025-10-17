import { mockStudents } from '@/data/mockData';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, subWeeks, startOfWeek } from 'date-fns';

export default function AttendanceHistory() {
  const navigate = useNavigate();
  const activeStudents = mockStudents.filter(s => s.isActive);
  
  // Generate last 8 Saturdays
  const getSaturdays = () => {
    const saturdays = [];
    const today = new Date();
    
    for (let i = 0; i < 8; i++) {
      const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 0 });
      const saturday = new Date(weekStart);
      saturday.setDate(saturday.getDate() + 6);
      saturdays.push(saturday);
    }
    
    return saturdays.reverse();
  };

  const saturdays = getSaturdays();

  // Mock function to get attendance status for a student on a specific date
  const getAttendanceStatus = (studentId: string, date: Date) => {
    // Using attendance history from mock data
    const student = mockStudents.find(s => s.id === studentId);
    if (!student) return null;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const attendance = student.attendanceHistory.find(a => a.date === dateStr);
    
    return attendance?.attended;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => navigate('/attendance')}
        className="mb-6"
      >
        <ArrowLeft className="mr-2" size={20} />
        Back to Mark Attendance
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Attendance History</h1>
        <p className="text-muted-foreground">View attendance records across multiple Saturdays</p>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">
                Student Name
              </TableHead>
              {saturdays.map((saturday) => (
                <TableHead key={saturday.toISOString()} className="text-center min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <Calendar size={16} className="text-muted-foreground" />
                    <span className="font-semibold">{format(saturday, 'MMM d')}</span>
                    <span className="text-xs text-muted-foreground">{format(saturday, 'yyyy')}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeStudents.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="sticky left-0 bg-background z-10 font-medium">
                  {student.name}
                </TableCell>
                {saturdays.map((saturday) => {
                  const attended = getAttendanceStatus(student.id, saturday);
                  
                  return (
                    <TableCell key={saturday.toISOString()} className="text-center">
                      {attended === true && (
                        <div className="flex justify-center">
                          <CheckCircle className="text-green-600" size={24} />
                        </div>
                      )}
                      {attended === false && (
                        <div className="flex justify-center">
                          <XCircle className="text-red-600" size={24} />
                        </div>
                      )}
                      {attended === null && (
                        <div className="flex justify-center">
                          <span className="text-muted-foreground text-sm">-</span>
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {activeStudents.length === 0 && (
        <Card className="p-12 text-center mt-6">
          <Calendar className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-semibold mb-2">No students found</h3>
          <p className="text-muted-foreground">Add students to view their attendance history</p>
        </Card>
      )}

      <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CheckCircle className="text-green-600" size={20} />
          <span>Present</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="text-red-600" size={20} />
          <span>Absent</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">-</span>
          <span>No record</span>
        </div>
      </div>
    </div>
  );
}
