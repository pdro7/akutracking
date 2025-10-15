import { mockStudents } from '@/data/mockData';
import { StudentCard } from '@/components/StudentCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';

export default function Students() {
  const navigate = useNavigate();
  const activeStudents = mockStudents.filter(s => s.isActive);

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeStudents.map((student) => (
          <StudentCard key={student.id} student={student} />
        ))}
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
