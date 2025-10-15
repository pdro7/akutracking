import { Student, getPaymentStatus } from '@/types/student';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { User, Calendar, Phone, Mail } from 'lucide-react';

interface StudentCardProps {
  student: Student;
}

export function StudentCard({ student }: StudentCardProps) {
  const navigate = useNavigate();
  const status = getPaymentStatus(student.classesRemaining);

  const statusConfig = {
    good: { variant: 'success' as const, label: 'Good Standing' },
    low: { variant: 'warning' as const, label: 'Low Credits' },
    due: { variant: 'destructive' as const, label: 'Payment Due' },
  };

  const { variant, label } = statusConfig[status];

  return (
    <Card 
      className="p-6 hover:shadow-hover transition-shadow cursor-pointer"
      onClick={() => navigate(`/student/${student.id}`)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
            <User className="text-primary-foreground" size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{student.name}</h3>
            <p className="text-sm text-muted-foreground">{student.parentName}</p>
          </div>
        </div>
        <Badge variant={variant}>{label}</Badge>
      </div>

      <div className="space-y-2 mb-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail size={16} />
          <span>{student.email}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone size={16} />
          <span>{student.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar size={16} />
          <span>Enrolled: {new Date(student.enrollmentDate).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Classes Attended</p>
            <p className="text-2xl font-bold text-primary">{student.classesAttended}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Remaining</p>
            <p className="text-2xl font-bold">{student.classesRemaining}</p>
          </div>
        </div>
      </div>

      <Button 
        className="w-full mt-4" 
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/student/${student.id}`);
        }}
      >
        View Details
      </Button>
    </Card>
  );
}
