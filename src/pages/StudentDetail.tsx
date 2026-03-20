import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPaymentStatus } from '@/types/student';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, Calendar, CheckCircle, XCircle, User, Phone, Mail, Edit,
  Cake, Trash2, CalendarIcon, DollarSign, Plus, Archive, BookOpen, Monitor,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInYears, format } from 'date-fns';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCOP } from '@/lib/currency';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MONTHS_VE = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
function generateVeGroupCode(courseCode: string, startDate: Date): string {
  const month = MONTHS_VE[startDate.getMonth()];
  const year = String(startDate.getFullYear()).slice(2);
  const day = String(startDate.getDate()).padStart(2, '0');
  return `${courseCode}-${month}${year}-${day}`;
}

const AREA_CONFIG: Record<string, { label: string; className: string }> = {
  programming: { label: 'Programación', className: 'bg-blue-100 text-blue-800' },
  robotics: { label: 'Robótica', className: 'bg-green-100 text-green-800' },
  '3d_design': { label: 'Diseño 3D', className: 'bg-purple-100 text-purple-800' },
  ai: { label: 'IA', className: 'bg-orange-100 text-orange-800' },
  other: { label: 'Otro', className: 'bg-gray-100 text-gray-800' },
};

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMounted = useRef(true);

  // Attendance state
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editAttended, setEditAttended] = useState(true);
  const [isMakeup, setIsMakeup] = useState(false);
  const [makeupReason, setMakeupReason] = useState('');
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);

  // Payment state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentPackSize, setPaymentPackSize] = useState(8);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);

  // Pending installment payment dialog (inst1 = full/first payment, inst2 = second installment)
  const [pendingPayEnrollment, setPendingPayEnrollment] = useState<any>(null);
  const [pendingPayType, setPendingPayType] = useState<'inst1' | 'inst2'>('inst1');
  const [inst2Date, setInst2Date] = useState<Date>(new Date());
  const [inst2Amount, setInst2Amount] = useState('');
  const [inst2Method, setInst2Method] = useState('Cash');
  const [inst2Notes, setInst2Notes] = useState('');

  // Class log state
  const [showClassLogDialog, setShowClassLogDialog] = useState(false);
  const [editingClassLog, setEditingClassLog] = useState<any>(null);
  const [classLogDate, setClassLogDate] = useState<Date>(new Date());
  const [classLogActivityId, setClassLogActivityId] = useState('');
  const [classLogModuleId, setClassLogModuleId] = useState('');
  const [classLogProjectName, setClassLogProjectName] = useState('');
  const [classLogDescription, setClassLogDescription] = useState('');
  const [classLogWhereLeftOff, setClassLogWhereLeftOff] = useState('');
  const [classLogProgressLevel, setClassLogProgressLevel] = useState(3);
  const [deleteClassLogId, setDeleteClassLogId] = useState<string | null>(null);

  // Archive state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  // Virtual enroll dialog
  const [showVirtualEnrollDialog, setShowVirtualEnrollDialog] = useState(false);
  const [virtualEnrollMode, setVirtualEnrollMode] = useState<'select' | 'create'>('select');
  const [veGroupId, setVeGroupId] = useState('');
  const [veCourseId, setVeCourseId] = useState('');
  const [veStartDate, setVeStartDate] = useState('');
  const [veEndDate, setVeEndDate] = useState('');
  const [veTeacherId, setVeTeacherId] = useState('none');
  const [vePaymentPlan, setVePaymentPlan] = useState('full');
  const [veFullAmount, setVeFullAmount] = useState('');
  const [veInst1Amount, setVeInst1Amount] = useState('');
  const [veInst2Amount, setVeInst2Amount] = useState('');
  const [veInst2DueDate, setVeInst2DueDate] = useState('');
  const [vePaymentReceived, setVePaymentReceived] = useState(false);
  const [veInst1PaidAt, setVeInst1PaidAt] = useState('');
  const [veNotes, setVeNotes] = useState('');

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('*').maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const { data: attendanceHistory = [] } = useQuery({
    queryKey: ['attendance', id],
    queryFn: async () => {
      const { data: records, error: recordsError } = await supabase
        .from('attendance_records').select('*').eq('student_id', id).order('date', { ascending: false });
      if (recordsError) throw recordsError;
      if (!records || records.length === 0) return [];
      const markedByIds = [...new Set(records.map(r => r.marked_by))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles').select('id, name').in('id', markedByIds);
      if (profilesError) throw profilesError;
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
      const { data, error } = await supabase.from('payments').select('*').eq('student_id', id).order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id
  });

  const { data: classLogs = [] } = useQuery({
    queryKey: ['class_logs', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_logs')
        .select('*, activities(id, name, area), modules(id, name, level)')
        .eq('student_id', id)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data, error } = await supabase.from('activities').select('*').order('area').order('name');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['modules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('modules').select('*').eq('is_active', true).order('level');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: virtualEnrollments = [] } = useQuery({
    queryKey: ['virtual_enrollments_student', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('*, course_groups(id, code, start_date, end_date, status, virtual_courses(name, code))')
        .eq('student_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: openGroups = [] } = useQuery({
    queryKey: ['open_groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_groups')
        .select('id, code, status, start_date, virtual_courses(name, code)')
        .in('status', ['forming', 'active'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: showVirtualEnrollDialog,
  });

  const { data: veVirtualCourses = [] } = useQuery({
    queryKey: ['virtual_courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_courses')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data || [];
    },
    enabled: showVirtualEnrollDialog && virtualEnrollMode === 'create',
  });

  const { data: veTeachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('teachers').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: showVirtualEnrollDialog && virtualEnrollMode === 'create',
  });

  // ── Attendance mutation ──────────────────────────────────────
  const saveAttendanceMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const attendanceData = {
        student_id: id,
        date: format(editDate, 'yyyy-MM-dd'),
        attended: editAttended,
        marked_by: user.id,
      };

      if (editingRecord) {
        const { error } = await supabase.from('attendance_records')
          .update({ date: attendanceData.date, attended: attendanceData.attended })
          .eq('id', editingRecord.id);
        if (error) throw error;

        if (student && editingRecord.attended !== editAttended) {
          const classChange = editAttended ? 1 : -1;
          const { error: updateError } = await supabase.from('students')
            .update({
              classes_attended: student.classes_attended + classChange,
              classes_remaining: student.classes_remaining - classChange,
            }).eq('id', student.id);
          if (updateError) throw updateError;
        }
      } else {
        const { error } = await supabase.from('attendance_records').insert({
          ...attendanceData,
          is_makeup: isMakeup,
          makeup_reason: isMakeup ? makeupReason || null : null,
        });
        if (error) throw error;

        // Only update class counts if NOT a make-up class
        if (editAttended && student && !isMakeup) {
          const { error: updateError } = await supabase.from('students')
            .update({
              classes_attended: student.classes_attended + 1,
              classes_remaining: student.classes_remaining - 1,
            }).eq('id', student.id);
          if (updateError) throw updateError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', id] });
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      toast.success(editingRecord ? 'Attendance record updated' : 'Attendance record added');
      if (isMounted.current) {
        setShowAttendanceDialog(false);
        setEditingRecord(null);
      }
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  const deleteAttendanceMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const record = attendanceHistory.find((r: any) => r.id === recordId);
      if (!record) throw new Error('Record not found');

      const { error } = await supabase.from('attendance_records').delete().eq('id', recordId);
      if (error) throw error;

      // Only restore class count for regular (non-makeup) attended classes
      if (record.attended && !record.is_makeup && student) {
        const { error: updateError } = await supabase.from('students')
          .update({
            classes_attended: student.classes_attended - 1,
            classes_remaining: student.classes_remaining + 1,
          }).eq('id', student.id);
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', id] });
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      toast.success('Attendance record deleted');
      if (isMounted.current) setDeleteRecordId(null);
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  // ── Payment mutations ────────────────────────────────────────
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
        const { error } = await supabase.from('payments').update(paymentData).eq('id', editingPayment.id);
        if (error) throw error;
        const { data: currentStudent, error: fetchError } = await supabase.from('students').select('classes_attended').eq('id', id).single();
        if (fetchError) throw fetchError;
        const { error: updateError } = await supabase.from('students')
          .update({ pack_size: paymentPackSize, classes_remaining: paymentPackSize - (currentStudent?.classes_attended || 0) })
          .eq('id', id);
        if (updateError) throw updateError;
      } else {
        const { error } = await supabase.from('payments').insert(paymentData);
        if (error) throw error;
        const { data: currentStudent, error: fetchError } = await supabase.from('students').select('classes_attended').eq('id', id).single();
        if (fetchError) throw fetchError;
        const { error: updateError } = await supabase.from('students')
          .update({
            pack_size: paymentPackSize,
            classes_remaining: paymentPackSize - (currentStudent?.classes_attended || 0),
            last_payment_date: format(paymentDate, 'yyyy-MM-dd'),
          }).eq('id', id);
        if (updateError) throw updateError;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payments', id] });
      await queryClient.refetchQueries({ queryKey: ['student', id] });
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
    onError: (error: Error) => { toast.error(error.message); }
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.from('payments').delete().eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', id] });
      toast.success('Payment deleted');
      if (isMounted.current) setDeletePaymentId(null);
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  // ── Pending installment payment mutation ────────────────────
  const payInstallmentMutation = useMutation({
    mutationFn: async () => {
      if (!pendingPayEnrollment) return;
      if (!inst2Amount || parseFloat(inst2Amount) <= 0) throw new Error('El monto debe ser mayor a 0');

      const dateStr = format(inst2Date, 'yyyy-MM-dd');

      const { error: payErr } = await supabase.from('payments').insert({
        student_id: id,
        payment_date: dateStr,
        amount: parseFloat(inst2Amount),
        payment_method: inst2Method,
        notes: inst2Notes.trim() || null,
      });
      if (payErr) throw payErr;

      const updateField = pendingPayType === 'inst1'
        ? { installment_1_paid_at: dateStr }
        : { installment_2_paid_at: dateStr };

      const { error: enrollErr } = await supabase
        .from('course_enrollments')
        .update(updateField)
        .eq('id', pendingPayEnrollment.id);
      if (enrollErr) throw enrollErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', id] });
      queryClient.invalidateQueries({ queryKey: ['virtual_enrollments_student', id] });
      queryClient.invalidateQueries({ queryKey: ['pending_installments'] });
      toast.success(pendingPayType === 'inst1' ? 'Pago registrado' : '2ª cuota registrada como pagada');
      if (isMounted.current) {
        setPendingPayEnrollment(null);
        setInst2Amount('');
        setInst2Method(settings?.payment_methods?.[0] || 'Cash');
        setInst2Notes('');
        setInst2Date(new Date());
      }
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  const enrollInVirtualGroupMutation = useMutation({
    mutationFn: async () => {
      let groupId = veGroupId;

      if (virtualEnrollMode === 'create') {
        const course = (veVirtualCourses as any[]).find((c: any) => c.id === veCourseId);
        if (!course) throw new Error('Selecciona un curso');
        if (!veStartDate) throw new Error('La fecha de inicio es obligatoria');

        const base = generateVeGroupCode(course.code, new Date(veStartDate + 'T12:00:00'));
        const { data: existing } = await supabase.from('course_groups').select('code').eq('code', base).maybeSingle();
        const code = existing ? `${base}-B` : base;

        const { data: group, error: groupErr } = await supabase
          .from('course_groups')
          .insert({
            code,
            virtual_course_id: veCourseId,
            start_date: veStartDate,
            end_date: veEndDate || null,
            status: 'forming',
            teacher_id: veTeacherId && veTeacherId !== 'none' ? veTeacherId : null,
          })
          .select()
          .single();
        if (groupErr) throw groupErr;
        groupId = group.id;

        // Auto-create 8 weekly sessions
        const sessions = Array.from({ length: 8 }, (_, i) => {
          const d = new Date(veStartDate + 'T12:00:00');
          d.setDate(d.getDate() + i * 7);
          return { group_id: group.id, session_number: i + 1, scheduled_date: d.toISOString().split('T')[0] };
        });
        const { error: sessErr } = await supabase.from('course_sessions').insert(sessions);
        if (sessErr) throw sessErr;
      }

      if (!groupId) throw new Error('Selecciona o crea un grupo');

      const today = new Date().toISOString().split('T')[0];
      const paidAt = vePaymentReceived ? (veInst1PaidAt || today) : null;

      const payload: any = {
        student_id: id,
        group_id: groupId,
        payment_plan: vePaymentPlan,
        notes: veNotes.trim() || null,
        installment_1_paid_at: paidAt,
      };
      if (vePaymentPlan === 'full') {
        payload.installment_1_amount = veFullAmount ? parseFloat(veFullAmount) : null;
      } else {
        payload.installment_1_amount = veInst1Amount ? parseFloat(veInst1Amount) : null;
        payload.installment_2_amount = veInst2Amount ? parseFloat(veInst2Amount) : null;
        payload.installment_2_due_date = veInst2DueDate || null;
      }

      const { data: existingEnroll } = await supabase
        .from('course_enrollments')
        .select('id, status')
        .eq('student_id', id)
        .eq('group_id', groupId)
        .maybeSingle();

      if (existingEnroll) {
        if (existingEnroll.status === 'active') throw new Error('El alumno ya está inscrito en este grupo');
        const { error } = await supabase.from('course_enrollments').update({ ...payload, status: 'active' }).eq('id', existingEnroll.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('course_enrollments').insert(payload);
        if (error) throw error;
      }

      // Auto-create payment record if payment received
      if (paidAt && payload.installment_1_amount) {
        const { error: payErr } = await supabase.from('payments').insert({
          student_id: id,
          payment_date: paidAt,
          amount: payload.installment_1_amount,
          payment_method: 'Unknown',
          notes: vePaymentPlan === 'full' ? 'Pago completo (curso virtual)' : '1ª cuota (curso virtual)',
        });
        if (payErr) throw payErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual_enrollments_student', id] });
      queryClient.invalidateQueries({ queryKey: ['open_groups'] });
      queryClient.invalidateQueries({ queryKey: ['course_groups'] });
      queryClient.invalidateQueries({ queryKey: ['payments', id] });
      queryClient.invalidateQueries({ queryKey: ['pending_installments'] });
      toast.success('Inscripción creada correctamente');
      setShowVirtualEnrollDialog(false);
      setVeGroupId(''); setVeCourseId(''); setVeStartDate(''); setVeEndDate('');
      setVeTeacherId('none'); setVePaymentPlan('full'); setVeFullAmount('');
      setVeInst1Amount(''); setVeInst2Amount(''); setVeInst2DueDate('');
      setVePaymentReceived(false); setVeInst1PaidAt(''); setVeNotes('');
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  // ── Class log mutations ──────────────────────────────────────
  const saveClassLogMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const logData = {
        student_id: id,
        date: format(classLogDate, 'yyyy-MM-dd'),
        activity_id: classLogActivityId || null,
        module_id: classLogModuleId || null,
        project_name: classLogProjectName.trim() || null,
        description: classLogDescription.trim() || null,
        where_left_off: classLogWhereLeftOff.trim() || null,
        progress_level: classLogProgressLevel || null,
        created_by: user.id,
      };

      if (editingClassLog) {
        const { error } = await supabase.from('class_logs').update(logData).eq('id', editingClassLog.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('class_logs').insert(logData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class_logs', id] });
      toast.success(editingClassLog ? 'Registro actualizado' : 'Clase registrada');
      if (isMounted.current) {
        setShowClassLogDialog(false);
        setEditingClassLog(null);
      }
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  const deleteClassLogMutation = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase.from('class_logs').delete().eq('id', logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class_logs', id] });
      toast.success('Registro eliminado');
      if (isMounted.current) setDeleteClassLogId(null);
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  // ── Archive mutation ─────────────────────────────────────────
  const archiveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('students').update({ archived: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Alumno archivado');
      navigate('/students');
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  // ── Handlers ─────────────────────────────────────────────────
  const handleAddAttendance = () => {
    setEditingRecord(null);
    setEditDate(new Date());
    setEditAttended(true);
    setIsMakeup(false);
    setMakeupReason('');
    setShowAttendanceDialog(true);
  };

  const handleEditClick = (record: any) => {
    setEditingRecord(record);
    setEditDate(new Date(record.date));
    setEditAttended(record.attended);
    setShowAttendanceDialog(true);
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

  const handleAddClassLog = () => {
    setEditingClassLog(null);
    setClassLogDate(new Date());
    setClassLogActivityId('');
    setClassLogModuleId('');
    setClassLogProjectName('');
    setClassLogDescription('');
    setClassLogWhereLeftOff('');
    setClassLogProgressLevel(3);
    setShowClassLogDialog(true);
  };

  const handleEditClassLog = (log: any) => {
    setEditingClassLog(log);
    setClassLogDate(new Date(log.date));
    setClassLogActivityId(log.activity_id || '');
    setClassLogModuleId(log.module_id || '');
    setClassLogProjectName(log.project_name || '');
    setClassLogDescription(log.description || '');
    setClassLogWhereLeftOff(log.where_left_off || '');
    setClassLogProgressLevel(log.progress_level || 3);
    setShowClassLogDialog(true);
  };

  // ── Render ────────────────────────────────────────────────────
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
    const attendedClasses = attendanceHistory.filter((r: any) => r.attended);
    const lastAttendedDate = attendedClasses.length > 0
      ? new Date(attendedClasses[0].date)
      : new Date(student.enrollment_date);
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
        <div className="flex gap-2">
          {!student.archived && (
            <Button variant="outline" onClick={() => setShowArchiveDialog(true)} className="gap-2">
              <Archive size={20} />
              Archivar
            </Button>
          )}
          <Button onClick={() => navigate(`/student/${id}/edit`)} className="gap-2">
            <Edit size={20} />
            Edit Student
          </Button>
        </div>
      </div>

      {student.archived && (
        <div className="mb-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          Este alumno está archivado y no aparece en las listas activas.
        </div>
      )}

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
              <Button onClick={handleAddAttendance} size="sm" className="gap-2">
                <Plus size={16} />
                Add Attendance
              </Button>
            </div>
            <div className="space-y-3">
              {attendanceHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No attendance records yet</p>
              ) : (
                (attendanceHistory as any[]).map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {record.attended ? (
                        <CheckCircle className="text-green-600" size={24} />
                      ) : (
                        <XCircle className="text-muted-foreground" size={24} />
                      )}
                      <div>
                        <p className="font-medium">
                          {new Date(record.date).toLocaleDateString('en-US', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
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
                      {record.is_makeup && (
                        <Badge variant="outline" className="text-xs">Recuperación</Badge>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleEditClick(record)}>
                        <Edit size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteRecordId(record.id)}>
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
              (paymentHistory as any[]).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <DollarSign className="text-primary" size={20} />
                    </div>
                    <div>
                      <p className="font-medium">{formatCOP(parseFloat(payment.amount))}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.payment_date).toLocaleDateString('es-CO')} • {payment.payment_method}
                      </p>
                      {payment.notes && <p className="text-xs text-muted-foreground mt-1">{payment.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEditPayment(payment)}>
                      <Edit size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeletePaymentId(payment.id)}>
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Class Log History */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BookOpen size={24} className="text-primary" />
              <h3 className="text-xl font-bold">Registro de Clases</h3>
            </div>
            <Button onClick={handleAddClassLog} size="sm" className="gap-2">
              <Plus size={16} />
              Registrar clase
            </Button>
          </div>
          <div className="space-y-3">
            {(classLogs as any[]).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay registros de clase todavía</p>
            ) : (
              (classLogs as any[]).map((log) => {
                const activity = log.activities;
                const module = log.modules;
                const areaConf = activity ? (AREA_CONFIG[activity.area] || AREA_CONFIG.other) : null;
                return (
                  <div key={log.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {new Date(log.date).toLocaleDateString('es-ES', {
                              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </span>
                          {module && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                              Niv. {module.level} · {module.name}
                            </span>
                          )}
                          {activity && areaConf && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${areaConf.className}`}>
                              {areaConf.label}
                            </span>
                          )}
                          {log.progress_level && (
                            <span className="text-xs text-amber-600 font-medium">
                              {'★'.repeat(log.progress_level)}{'☆'.repeat(5 - log.progress_level)}
                            </span>
                          )}
                        </div>
                        {activity && (
                          <p className="text-sm font-medium text-primary">{activity.name}</p>
                        )}
                        {log.project_name && (
                          <p className="text-sm text-muted-foreground">Proyecto: {log.project_name}</p>
                        )}
                        {log.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{log.description}</p>
                        )}
                        {log.where_left_off && (
                          <p className="text-xs text-muted-foreground italic">
                            Quedó en: {log.where_left_off}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleEditClassLog(log)}>
                          <Edit size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteClassLogId(log.id)}>
                          <Trash2 size={16} className="text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Virtual Courses Section */}
        {student.modality !== 'presencial' && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Monitor size={24} className="text-primary" />
                <h3 className="text-xl font-bold">Cursos Virtuales</h3>
              </div>
              <Button size="sm" className="gap-2" onClick={() => setShowVirtualEnrollDialog(true)}>
                <Plus size={16} />
                Inscribir en curso
              </Button>
            </div>
            {(virtualEnrollments as any[]).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay inscripciones en cursos virtuales</p>
            ) : (
              <div className="space-y-3">
                {(virtualEnrollments as any[]).map((enrollment: any) => {
                  const group = enrollment.course_groups;
                  const today = new Date();
                  const sevenDaysFromNow = new Date();
                  sevenDaysFromNow.setDate(today.getDate() + 7);
                  const inst2Due = enrollment.installment_2_due_date
                    ? new Date(enrollment.installment_2_due_date + 'T12:00:00')
                    : null;
                  const isInstallmentAlert = inst2Due && !enrollment.installment_2_paid_at && inst2Due <= sevenDaysFromNow;

                  return (
                    <div key={enrollment.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <button
                              className="font-medium hover:underline text-primary"
                              onClick={() => navigate(`/virtual-groups/${group?.id}`)}
                            >
                              {group?.virtual_courses?.name}
                            </button>
                            <span className="font-mono text-xs text-muted-foreground">{group?.code}</span>
                            <Badge variant={
                              group?.status === 'active' ? 'success' :
                              group?.status === 'completed' ? 'outline' :
                              group?.status === 'cancelled' ? 'destructive' : 'secondary'
                            } className="text-xs">
                              {group?.status === 'forming' ? 'Formando' :
                               group?.status === 'active' ? 'Activo' :
                               group?.status === 'completed' ? 'Completado' :
                               group?.status === 'cancelled' ? 'Cancelado' : group?.status}
                            </Badge>
                          </div>
                          {group?.start_date && (
                            <p className="text-sm text-muted-foreground">
                              Inicio: {new Date(group.start_date + 'T12:00:00').toLocaleDateString('es-CO')}
                              {group.end_date && ` · Fin: ${new Date(group.end_date + 'T12:00:00').toLocaleDateString('es-CO')}`}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={enrollment.payment_plan === 'full' ? 'outline' : 'warning'} className="text-xs">
                              {enrollment.payment_plan === 'full' ? 'Pago completo' : 'Cuotas'}
                            </Badge>
                            {/* 1st payment / full payment pending */}
                            {!enrollment.installment_1_paid_at && (
                              <span className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => {
                                    setPendingPayEnrollment(enrollment);
                                    setPendingPayType('inst1');
                                    setInst2Amount(enrollment.installment_1_amount?.toString() ?? '');
                                    setInst2Method(settings?.payment_methods?.[0] || 'Cash');
                                    setInst2Notes('');
                                    setInst2Date(new Date());
                                  }}
                                  className="text-xs font-medium text-destructive underline-offset-2 hover:underline"
                                >
                                  ⚠️ Pago pendiente — Registrar
                                </button>
                                {(enrollment as any).payment_requested_at && (
                                  <span className="text-xs text-blue-600 border border-blue-300 rounded px-1.5 py-0.5">✓ Solicitado</span>
                                )}
                              </span>
                            )}
                            {/* 2nd installment pending */}
                            {enrollment.payment_plan === 'installments' && !enrollment.installment_2_paid_at && (
                              <span className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => {
                                    setPendingPayEnrollment(enrollment);
                                    setPendingPayType('inst2');
                                    setInst2Amount(enrollment.installment_2_amount?.toString() ?? '');
                                    setInst2Method(settings?.payment_methods?.[0] || 'Cash');
                                    setInst2Notes('');
                                    setInst2Date(new Date());
                                  }}
                                  className={`text-xs font-medium underline-offset-2 hover:underline ${isInstallmentAlert ? 'text-destructive' : 'text-orange-600'}`}
                                >
                                  {isInstallmentAlert
                                    ? `⚠️ 2ª cuota vence ${inst2Due!.toLocaleDateString('es-CO')} — Registrar`
                                    : '2ª cuota pendiente — Registrar'}
                                </button>
                                {(enrollment as any).payment_requested_at && (
                                  <span className="text-xs text-blue-600 border border-blue-300 rounded px-1.5 py-0.5">✓ Solicitado</span>
                                )}
                              </span>
                            )}
                            {enrollment.payment_plan === 'installments' && enrollment.installment_2_paid_at && (
                              <span className="text-xs text-green-600">✓ 2ª cuota pagada</span>
                            )}
                          </div>
                        </div>
                        <Badge variant={
                          enrollment.status === 'active' ? 'success' :
                          enrollment.status === 'completed' ? 'outline' : 'secondary'
                        }>
                          {enrollment.status === 'active' ? 'Activo' :
                           enrollment.status === 'completed' ? 'Completado' : 'Retirado'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* ── Attendance Dialog ─────────────────────────────────── */}
      <Dialog open={showAttendanceDialog} onOpenChange={(open) => {
        if (!open) { setShowAttendanceDialog(false); setEditingRecord(null); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRecord ? 'Edit Attendance Record' : 'Add Attendance Record'}</DialogTitle>
            <DialogDescription>
              {editingRecord ? 'Update the date or attendance status for this record.' : 'Record a new attendance for this student.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDate ? format(editDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarPicker mode="single" selected={editDate} onSelect={(date) => date && setEditDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <div className="flex gap-2">
                <Button variant={editAttended ? "default" : "outline"} onClick={() => setEditAttended(true)} className="flex-1">
                  <CheckCircle className="mr-2 h-4 w-4" />Present
                </Button>
                <Button variant={!editAttended ? "default" : "outline"} onClick={() => setEditAttended(false)} className="flex-1">
                  <XCircle className="mr-2 h-4 w-4" />Absent
                </Button>
              </div>
            </div>
            {!editingRecord && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-3">
                  <Switch id="makeup" checked={isMakeup} onCheckedChange={setIsMakeup} />
                  <Label htmlFor="makeup" className="text-sm">Clase de recuperación (gratuita)</Label>
                </div>
                {isMakeup && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Motivo (opcional)</label>
                    <Input value={makeupReason} onChange={(e) => setMakeupReason(e.target.value)} placeholder="Motivo de la recuperación..." />
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAttendanceDialog(false); setEditingRecord(null); }}>
              Cancel
            </Button>
            <Button onClick={() => saveAttendanceMutation.mutate()}>
              {editingRecord ? 'Save Changes' : 'Add Attendance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Attendance Dialog ──────────────────────────── */}
      <AlertDialog open={!!deleteRecordId} onOpenChange={(open) => !open && setDeleteRecordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attendance Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this attendance record. If the student was marked as present (and it wasn't a make-up class), their class count will be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRecordId && deleteAttendanceMutation.mutate(deleteRecordId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Payment Dialog ────────────────────────────────────── */}
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
              <Select value={paymentPackSize.toString()} onValueChange={(v) => setPaymentPackSize(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !paymentDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarPicker mode="single" selected={paymentDate} onSelect={(date) => date && setPaymentDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Amount</label>
              <Input type="number" step="0.01" min="0" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Payment Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(settings?.payment_methods || ['Cash', 'Bancololombia', 'Davivienda', 'Wompi', 'Nequi']).map((method) => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
              <Textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows={3} placeholder="Add any additional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button onClick={handleSavePayment}>{editingPayment ? 'Update' : 'Add'} Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Payment Dialog ─────────────────────────────── */}
      <AlertDialog open={!!deletePaymentId} onOpenChange={(open) => !open && setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Record?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this payment record. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePaymentId && deletePaymentMutation.mutate(deletePaymentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Pending Installment Payment Dialog ───────────────── */}
      <Dialog open={!!pendingPayEnrollment} onOpenChange={(open) => !open && setPendingPayEnrollment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingPayType === 'inst1' ? 'Registrar pago' : 'Registrar 2ª cuota'}
            </DialogTitle>
            <DialogDescription>
              {pendingPayEnrollment?.course_groups?.virtual_courses?.name} — {pendingPayEnrollment?.course_groups?.code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Fecha de pago</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !inst2Date && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {inst2Date ? format(inst2Date, 'PPP') : <span>Selecciona una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarPicker mode="single" selected={inst2Date} onSelect={(date) => date && setInst2Date(date)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Monto</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={inst2Amount}
                onChange={(e) => setInst2Amount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Método de pago</label>
              <Select value={inst2Method} onValueChange={setInst2Method}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(settings?.payment_methods || ['Cash', 'Bancolombia', 'Davivienda', 'Wompi', 'Nequi']).map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Notas (opcional)</label>
              <Textarea value={inst2Notes} onChange={(e) => setInst2Notes(e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPayEnrollment(null)}>Cancelar</Button>
            <Button onClick={() => payInstallmentMutation.mutate()} disabled={payInstallmentMutation.isPending || !inst2Amount}>
              {payInstallmentMutation.isPending ? 'Guardando...' : 'Registrar pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Class Log Dialog ──────────────────────────────────── */}
      <Dialog open={showClassLogDialog} onOpenChange={(open) => {
        if (!open) { setShowClassLogDialog(false); setEditingClassLog(null); }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingClassLog ? 'Editar registro de clase' : 'Registrar clase'}</DialogTitle>
            <DialogDescription>
              {editingClassLog ? 'Actualiza los datos de esta clase' : 'Registra qué hizo el alumno en esta clase'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <label className="text-sm font-medium mb-2 block">Fecha</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !classLogDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {classLogDate ? format(classLogDate, "PPP") : <span>Elige una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarPicker mode="single" selected={classLogDate} onSelect={(date) => date && setClassLogDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Módulo (opcional)</label>
              <Select value={classLogModuleId || '__none__'} onValueChange={(v) => setClassLogModuleId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un módulo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin módulo</SelectItem>
                  {(modules as any[]).map((m) => (
                    <SelectItem key={m.id} value={m.id}>Niv. {m.level} · {m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Actividad (opcional)</label>
              <Select value={classLogActivityId || '__none__'} onValueChange={(v) => setClassLogActivityId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una actividad..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin actividad</SelectItem>
                  {(activities as any[]).map((a) => {
                    const areaConf = AREA_CONFIG[a.area] || AREA_CONFIG.other;
                    return (
                      <SelectItem key={a.id} value={a.id}>
                        {areaConf.label} · {a.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Nombre del proyecto (opcional)</label>
              <Input value={classLogProjectName} onChange={(e) => setClassLogProjectName(e.target.value)} placeholder="Ej: Mi primer juego en Scratch" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">¿Qué se hizo en esta clase?</label>
              <Textarea value={classLogDescription} onChange={(e) => setClassLogDescription(e.target.value)} rows={3} placeholder="Describe lo que se trabajó..." />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">¿Dónde se quedó?</label>
              <Textarea value={classLogWhereLeftOff} onChange={(e) => setClassLogWhereLeftOff(e.target.value)} rows={2} placeholder="Para saber por dónde continuar la próxima clase..." />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Nivel de avance: <span className="text-amber-500">{'★'.repeat(classLogProgressLevel)}{'☆'.repeat(5 - classLogProgressLevel)}</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <Button
                    key={level}
                    type="button"
                    variant={classLogProgressLevel === level ? "default" : "outline"}
                    size="sm"
                    onClick={() => setClassLogProgressLevel(level)}
                    className="w-10"
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowClassLogDialog(false); setEditingClassLog(null); }}>
              Cancelar
            </Button>
            <Button onClick={() => saveClassLogMutation.mutate()}>
              {editingClassLog ? 'Guardar cambios' : 'Registrar clase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Class Log Dialog ───────────────────────────── */}
      <AlertDialog open={!!deleteClassLogId} onOpenChange={(open) => !open && setDeleteClassLogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro de clase?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteClassLogId && deleteClassLogMutation.mutate(deleteClassLogId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Archive Dialog ────────────────────────────────────── */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar a {student.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              El alumno seguirá en el historial pero no aparecerá en las listas activas. Puedes verlo en Students → Ver archivados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveMutation.mutate()}>
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Virtual Group Enroll Dialog ─────────────────────── */}
      <Dialog open={showVirtualEnrollDialog} onOpenChange={(open) => { if (!open) setShowVirtualEnrollDialog(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inscribir en curso virtual</DialogTitle>
            <DialogDescription>{student?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            {/* Mode toggle */}
            <div className="flex rounded-lg border overflow-hidden">
              <button
                className={`flex-1 py-2 text-sm font-medium transition-colors ${virtualEnrollMode === 'select' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => setVirtualEnrollMode('select')}
              >
                Grupo existente
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium transition-colors ${virtualEnrollMode === 'create' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => setVirtualEnrollMode('create')}
              >
                Crear nuevo grupo
              </button>
            </div>

            {/* Select existing group */}
            {virtualEnrollMode === 'select' && (
              <div>
                <Label className="mb-2 block">Grupo *</Label>
                <Select value={veGroupId} onValueChange={setVeGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un grupo abierto" />
                  </SelectTrigger>
                  <SelectContent>
                    {(openGroups as any[]).map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.code} — {g.virtual_courses?.name} ({g.status === 'forming' ? 'Formando' : 'Activo'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Create new group */}
            {virtualEnrollMode === 'create' && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <p className="text-sm font-medium">Nuevo grupo</p>
                <div>
                  <Label className="mb-2 block">Curso *</Label>
                  <Select value={veCourseId} onValueChange={setVeCourseId}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un curso" /></SelectTrigger>
                    <SelectContent>
                      {(veVirtualCourses as any[]).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-2 block">Fecha inicio *</Label>
                    <Input type="date" value={veStartDate} onChange={(e) => setVeStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="mb-2 block">Fecha fin</Label>
                    <Input type="date" value={veEndDate} onChange={(e) => setVeEndDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Profesor</Label>
                  <Select value={veTeacherId} onValueChange={setVeTeacherId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {(veTeachers as any[]).map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Payment plan */}
            <div>
              <Label className="mb-2 block">Plan de pago</Label>
              <Select value={vePaymentPlan} onValueChange={setVePaymentPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Pago completo</SelectItem>
                  <SelectItem value="installments">En cuotas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {vePaymentPlan === 'full' && (
              <div>
                <Label className="mb-2 block">Monto</Label>
                <Input type="number" min="0" step="0.01" value={veFullAmount} onChange={(e) => setVeFullAmount(e.target.value)} placeholder="0.00" />
              </div>
            )}

            {vePaymentPlan === 'installments' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-2 block">Monto 1ª cuota</Label>
                  <Input type="number" min="0" step="0.01" value={veInst1Amount} onChange={(e) => setVeInst1Amount(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label className="mb-2 block">Monto 2ª cuota</Label>
                  <Input type="number" min="0" step="0.01" value={veInst2Amount} onChange={(e) => setVeInst2Amount(e.target.value)} placeholder="0.00" />
                </div>
                <div className="col-span-2">
                  <Label className="mb-2 block">Vencimiento 2ª cuota</Label>
                  <Input type="date" value={veInst2DueDate} onChange={(e) => setVeInst2DueDate(e.target.value)} />
                </div>
              </div>
            )}

            {/* Payment received */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <input
                type="checkbox"
                id="ve-payment-received"
                checked={vePaymentReceived}
                onChange={(e) => setVePaymentReceived(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="ve-payment-received" className="cursor-pointer">
                {vePaymentPlan === 'full' ? 'Pago completo recibido' : '1ª cuota recibida'}
              </Label>
            </div>
            {vePaymentReceived && (
              <div>
                <Label className="mb-2 block">Fecha de pago</Label>
                <Input type="date" value={veInst1PaidAt} onChange={(e) => setVeInst1PaidAt(e.target.value)} />
              </div>
            )}

            <div>
              <Label className="mb-2 block">Notas (opcional)</Label>
              <Textarea value={veNotes} onChange={(e) => setVeNotes(e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVirtualEnrollDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => enrollInVirtualGroupMutation.mutate()}
              disabled={
                enrollInVirtualGroupMutation.isPending ||
                (virtualEnrollMode === 'select' && !veGroupId) ||
                (virtualEnrollMode === 'create' && (!veCourseId || !veStartDate))
              }
            >
              {enrollInVirtualGroupMutation.isPending ? 'Guardando...' : 'Inscribir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
