import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPaymentStatus } from '@/types/student';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, CheckCircle, XCircle, User, Phone, Mail, Edit, Cake, Trash2, CalendarIcon, DollarSign, Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInYears } from 'date-fns';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCOP } from '@/lib/currency';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMounted = useRef(true);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editAttended, setEditAttended] = useState(true);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentPackSize, setPaymentPackSize] = useState(8);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
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

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: attendanceHistory = [] } = useQuery({
    queryKey: ['attendance', id],
    queryFn: async () => {
      const { data: records, error: recordsError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('student_id', id)
        .order('date', { ascending: false });
      
      if (recordsError) throw recordsError;
      if (!records || records.length === 0) return [];

      // Fetch profile names for all unique marked_by ids
      const markedByIds = [...new Set(records.map(r => r.marked_by))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', markedByIds);
      
      if (profilesError) throw profilesError;

      // Map profile names to records
      const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
      return records.map(record => ({
        ...record,
        profiles: { name: profileMap.get(record.marked_by) || 'Unknown' }
      }));
    },
    enabled: !!id
  });

  const { data: paymentHistory = [] } = useQuery({
    queryKey: ['payments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', id)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!id
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ recordId, date, attended }: { recordId: string; date: string; attended: boolean }) => {
      const { error } = await supabase
        .from('attendance_records')
        .update({ date, attended })
        .eq('id', recordId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', id] });
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      toast.success('Attendance record updated');
      if (isMounted.current) {
        setEditingRecord(null);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const deleteAttendanceMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const record = attendanceHistory.find((r: any) => r.id === recordId);
      if (!record) throw new Error('Record not found');

      const { error } = await supabase
        .from('attendance_records')
        .delete()
        .eq('id', recordId);
      
      if (error) throw error;

      // If it was marked as attended, restore the class count
      if (record.attended && student) {
        const { error: updateError } = await supabase
          .from('students')
          .update({
            classes_attended: student.classes_attended - 1,
            classes_remaining: student.classes_remaining + 1,
          })
          .eq('id', student.id);
        
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', id] });
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      toast.success('Attendance record deleted');
      if (isMounted.current) {
        setDeleteRecordId(null);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const savePaymentMutation = useMutation({
    mutationFn: async () => {
      const paymentData = {
        student_id: id,
        payment_date: format(paymentDate, 'yyyy-MM-dd'),
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        notes: paymentNotes || null,
      };

      if (editingPayment) {
        const { error } = await supabase
          .from('payments')
          .update(paymentData)
          .eq('id', editingPayment.id);
        if (error) throw error;
      } else {
        // Insert payment
        const { error } = await supabase
          .from('payments')
          .insert(paymentData);
        if (error) throw error;

        // Update student's pack size and add to classes_remaining
        const { error: updateError } = await supabase
          .from('students')
          .update({
            pack_size: paymentPackSize,
            classes_remaining: student!.classes_remaining + paymentPackSize,
            last_payment_date: format(paymentDate, 'yyyy-MM-dd'),
          })
          .eq('id', id);
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', id] });
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      toast.success(editingPayment ? 'Payment updated' : 'Payment added');
      if (isMounted.current) {
        setShowPaymentDialog(false);
        setEditingPayment(null);
        setPaymentAmount('');
        setPaymentMethod(settings?.payment_methods?.[0] || 'Cash');
        setPaymentNotes('');
        setPaymentDate(new Date());
        setPaymentPackSize(8);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', id] });
      toast.success('Payment deleted');
      if (isMounted.current) {
        setDeletePaymentId(null);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const handleEditClick = (record: any) => {
    setEditingRecord(record);
    setEditDate(new Date(record.date));
    setEditAttended(record.attended);
  };

  const handleSaveEdit = () => {
    if (editingRecord) {
      updateAttendanceMutation.mutate({
        recordId: editingRecord.id,
        date: format(editDate, 'yyyy-MM-dd'),
        attended: editAttended,
      });
    }
  };

  const handleAddPayment = () => {
    setEditingPayment(null);
    setPaymentAmount('');
    setPaymentMethod(settings?.payment_methods?.[0] || 'Cash');
    setPaymentNotes('');
    setPaymentDate(new Date());
    setPaymentPackSize(student?.pack_size || settings?.default_pack_size || 8);
    setShowPaymentDialog(true);
  };

  const handleEditPayment = (payment: any) => {
    setEditingPayment(payment);
    setPaymentDate(new Date(payment.payment_date));
    setPaymentAmount(payment.amount.toString());
    setPaymentMethod(payment.payment_method);
    setPaymentNotes(payment.notes || '');
    setShowPaymentDialog(true);
  };

  const handleSavePayment = () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    savePaymentMutation.mutate();
  };

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

  const calculateNextPaymentDate = () => {
    if (!student || student.classes_remaining <= 0) return null;
    
    // Get the most recent attended class date
    const attendedClasses = attendanceHistory.filter((r: any) => r.attended);
    const lastAttendedDate = attendedClasses.length > 0 
      ? new Date(attendedClasses[0].date)
      : new Date(student.enrollment_date);
    
    // Project forward by the number of classes remaining (assuming one class per week)
    const nextPaymentDate = new Date(lastAttendedDate);
    nextPaymentDate.setDate(nextPaymentDate.getDate() + (student.classes_remaining * 7));
    
    return nextPaymentDate;
  };

  const age = calculateAge(student.date_of_birth);
  const nextPaymentDate = calculateNextPaymentDate();

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

      <div className="space-y-6">
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
            {nextPaymentDate && (
              <div>
                <p className="text-muted-foreground mb-1">Next Payment Due</p>
                <p className="font-medium">{nextPaymentDate.toLocaleDateString()}</p>
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
                  <div className="flex items-center gap-2">
                    <Badge variant={record.attended ? 'success' : 'secondary'}>
                      {record.attended ? 'Present' : 'Absent'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditClick(record)}
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteRecordId(record.id)}
                    >
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Payment History */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">Payment History</h3>
          <Button onClick={handleAddPayment} size="sm" className="gap-2">
            <Plus size={16} />
            Add Payment
          </Button>
        </div>

        <div className="space-y-3">
          {paymentHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payment records yet</p>
          ) : (
            paymentHistory.map((payment: any) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <DollarSign className="text-primary" size={20} />
                  </div>
                  <div>
                    <p className="font-medium">
                      {formatCOP(parseFloat(payment.amount))}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(payment.payment_date).toLocaleDateString('es-CO')} • {payment.payment_method}
                    </p>
                    {payment.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{payment.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditPayment(payment)}
                  >
                    <Edit size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletePaymentId(payment.id)}
                  >
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance Record</DialogTitle>
            <DialogDescription>
              Update the date or attendance status for this record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDate ? format(editDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarPicker
                    mode="single"
                    selected={editDate}
                    onSelect={(date) => date && setEditDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <div className="flex gap-2">
                <Button
                  variant={editAttended ? "default" : "outline"}
                  onClick={() => setEditAttended(true)}
                  className="flex-1"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Present
                </Button>
                <Button
                  variant={!editAttended ? "default" : "outline"}
                  onClick={() => setEditAttended(false)}
                  className="flex-1"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Absent
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRecordId} onOpenChange={(open) => !open && setDeleteRecordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attendance Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this attendance record. If the student was marked as present, their class count will be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRecordId && deleteAttendanceMutation.mutate(deleteRecordId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={(open) => !open && setShowPaymentDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPayment ? 'Edit Payment' : 'Add Payment'}</DialogTitle>
            <DialogDescription>
              {editingPayment ? 'Update payment details' : 'Record a new payment for this student'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Pack Size</label>
              <Select value={paymentPackSize.toString()} onValueChange={(value) => setPaymentPackSize(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 classes</SelectItem>
                  <SelectItem value="8">8 classes</SelectItem>
                  <SelectItem value="12">12 classes</SelectItem>
                  <SelectItem value="16">16 classes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !paymentDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarPicker
                    mode="single"
                    selected={paymentDate}
                    onSelect={(date) => date && setPaymentDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Amount</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Payment Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(settings?.payment_methods || ['Cash', 'Bancololombia', 'Davivienda', 'Wompi', 'Nequi']).map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={3}
                placeholder="Add any additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePayment}>
              {editingPayment ? 'Update' : 'Add'} Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Confirmation */}
      <AlertDialog open={!!deletePaymentId} onOpenChange={(open) => !open && setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this payment record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePaymentId && deletePaymentMutation.mutate(deletePaymentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
