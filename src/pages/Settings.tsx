import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings as SettingsIcon, Save, Plus, X, Pencil, Trash2, BookOpen, Layers, Monitor, GraduationCap, CalendarClock } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AREA_CONFIG: Record<string, { label: string; className: string }> = {
  programming: { label: 'Programación', className: 'bg-blue-100 text-blue-800' },
  robotics: { label: 'Robótica', className: 'bg-green-100 text-green-800' },
  '3d_design': { label: 'Diseño 3D', className: 'bg-purple-100 text-purple-800' },
  ai: { label: 'IA', className: 'bg-orange-100 text-orange-800' },
  other: { label: 'Otro', className: 'bg-gray-100 text-gray-800' },
};

export default function Settings() {
  const queryClient = useQueryClient();

  // General settings state
  const [packSize, setPackSize] = useState(8);
  const [classDay, setClassDay] = useState('Saturday');
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['Cash', 'Bancololombia', 'Davivienda', 'Wompi', 'Nequi']);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [holidays, setHolidays] = useState<string[]>([]);

  // Activity state
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [activityName, setActivityName] = useState('');
  const [activityArea, setActivityArea] = useState('programming');
  const [activityDescription, setActivityDescription] = useState('');
  const [deleteActivityId, setDeleteActivityId] = useState<string | null>(null);

  // Teacher state
  const [showTeacherDialog, setShowTeacherDialog] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [deleteTeacherId, setDeleteTeacherId] = useState<string | null>(null);

  // Course slots state
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [slotCourseCode, setSlotCourseCode] = useState('RCZ');
  const [slotCourseName, setSlotCourseName] = useState('Real Coders Zero');
  const [slotDay, setSlotDay] = useState('Sábado');
  const [slotStartTime, setSlotStartTime] = useState('09:00');
  const [slotEndTime, setSlotEndTime] = useState('10:30');
  const [slotDate, setSlotDate] = useState('');
  const [slotActive, setSlotActive] = useState(true);
  const [deleteSlotId, setDeleteSlotId] = useState<string | null>(null);

  // Virtual course edit state
  const [editingVirtualCourse, setEditingVirtualCourse] = useState<any>(null);
  const [vcName, setVcName] = useState('');
  const [vcDescription, setVcDescription] = useState('');
  const [vcNextCourseId, setVcNextCourseId] = useState('');
  const [showVcDialog, setShowVcDialog] = useState(false);

  // Module state
  const [showModuleDialog, setShowModuleDialog] = useState(false);
  const [editingModule, setEditingModule] = useState<any>(null);
  const [moduleName, setModuleName] = useState('');
  const [moduleLevel, setModuleLevel] = useState(1);
  const [moduleDescription, setModuleDescription] = useState('');
  const [deleteModuleId, setDeleteModuleId] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('*').maybeSingle();
      if (error) throw error;
      return data || { default_pack_size: 8, class_day: 'Saturday', payment_methods: ['Cash', 'Bancolombia', 'Davivienda', 'Wompi', 'Nequi'] };
    }
  });

  // Initialize form state once when settings first load (not on background refetches)
  useEffect(() => {
    if (settings) {
      setPackSize(settings.default_pack_size);
      setClassDay(settings.class_day);
      setPaymentMethods(settings.payment_methods || ['Cash', 'Bancolombia', 'Davivienda', 'Wompi', 'Nequi']);
      setHolidays((settings as any).holidays || []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(settings as any)?.id ?? 'default']);

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
      const { data, error } = await supabase.from('modules').select('*').order('level');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: virtualCourses = [] } = useQuery({
    queryKey: ['virtual_courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_courses')
        .select('*')
        .order('code');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('teachers').select('*').order('name');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: courseSlots = [] } = useQuery({
    queryKey: ['course_slots'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('course_slots').select('*').order('course_code').order('day_of_week').order('start_time');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: userRole } = useQuery({
    queryKey: ['userRole'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      return data?.role || 'user';
    }
  });

  const saveTeacherMutation = useMutation({
    mutationFn: async () => {
      if (!teacherName.trim()) throw new Error('El nombre es obligatorio');
      const payload: any = { name: teacherName.trim(), email: teacherEmail.trim() || null };
      if (editingTeacher) {
        const { error } = await supabase.from('teachers').update(payload).eq('id', editingTeacher.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('teachers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast.success(editingTeacher ? 'Profesor actualizado' : 'Profesor añadido');
      setShowTeacherDialog(false);
      setEditingTeacher(null);
      setTeacherName('');
      setTeacherEmail('');
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  const inviteTeacherMutation = useMutation({
    mutationFn: async ({ email, teacher_id }: { email: string; teacher_id: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('invite-teacher', {
        body: { email, teacher_id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast.success('Invitación enviada correctamente');
    },
    onError: (error: Error) => { toast.error(error.message); },
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teachers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast.success('Profesor eliminado');
      setDeleteTeacherId(null);
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  const saveSlotMutation = useMutation({
    mutationFn: async () => {
      if (!slotCourseCode || !slotDay || !slotStartTime || !slotEndTime) throw new Error('Completa los campos obligatorios');
      const payload = {
        course_code: slotCourseCode,
        course_name: slotCourseName,
        day_of_week: slotDay,
        start_time: slotStartTime,
        end_time: slotEndTime,
        tentative_start_date: slotDate || null,
        is_active: slotActive,
        updated_at: new Date().toISOString(),
      };
      if (editingSlot) {
        const { error } = await (supabase as any).from('course_slots').update(payload).eq('id', editingSlot.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('course_slots').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course_slots'] });
      toast.success(editingSlot ? 'Franja actualizada' : 'Franja añadida');
      setShowSlotDialog(false);
      setEditingSlot(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('course_slots').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course_slots'] });
      toast.success('Franja eliminada');
      setDeleteSlotId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateVirtualCourseMutation = useMutation({
    mutationFn: async () => {
      if (!editingVirtualCourse) return;
      const { error } = await supabase
        .from('virtual_courses')
        .update({
          name: vcName.trim(),
          description: vcDescription.trim() || null,
          next_course_id: vcNextCourseId && vcNextCourseId !== 'none' ? vcNextCourseId : null,
        })
        .eq('id', editingVirtualCourse.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual_courses'] });
      toast.success('Curso actualizado');
      setShowVcDialog(false);
      setEditingVirtualCourse(null);
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: { packSize: number; classDay: string; paymentMethods: string[]; holidays: string[] }) => {
      const { data: existing } = await supabase.from('settings').select('id').maybeSingle();
      if (existing) {
        const { data: updated, error } = await supabase.from('settings').update({
          default_pack_size: payload.packSize,
          class_day: payload.classDay,
          payment_methods: payload.paymentMethods,
          holidays: payload.holidays,
        }).eq('id', existing.id).select();
        if (error) throw error;
        if (!updated || updated.length === 0) throw new Error('No tienes permisos para editar la configuración');
      } else {
        const { error } = await supabase.from('settings').insert({
          default_pack_size: payload.packSize,
          class_day: payload.classDay,
          payment_methods: payload.paymentMethods,
          holidays: payload.holidays,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved successfully!');
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  const saveActivityMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name: activityName.trim(),
        area: activityArea,
        description: activityDescription.trim() || null,
      };
      if (editingActivity) {
        const { error } = await supabase.from('activities').update(data).eq('id', editingActivity.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('activities').insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast.success(editingActivity ? 'Actividad actualizada' : 'Actividad creada');
      setShowActivityDialog(false);
      setEditingActivity(null);
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast.success('Actividad eliminada');
      setDeleteActivityId(null);
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  const saveModuleMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name: moduleName.trim(),
        level: moduleLevel,
        description: moduleDescription.trim() || null,
      };
      if (editingModule) {
        const { error } = await supabase.from('modules').update(data).eq('id', editingModule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('modules').insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      toast.success(editingModule ? 'Módulo actualizado' : 'Módulo creado');
      setShowModuleDialog(false);
      setEditingModule(null);
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  const deleteModuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('modules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      toast.success('Módulo eliminado');
      setDeleteModuleId(null);
    },
    onError: (error: Error) => { toast.error(error.message); }
  });

  const handleOpenActivityDialog = (activity?: any) => {
    if (activity) {
      setEditingActivity(activity);
      setActivityName(activity.name);
      setActivityArea(activity.area);
      setActivityDescription(activity.description || '');
    } else {
      setEditingActivity(null);
      setActivityName('');
      setActivityArea('programming');
      setActivityDescription('');
    }
    setShowActivityDialog(true);
  };

  const handleOpenModuleDialog = (module?: any) => {
    if (module) {
      setEditingModule(module);
      setModuleName(module.name);
      setModuleLevel(module.level);
      setModuleDescription(module.description || '');
    } else {
      setEditingModule(null);
      setModuleName('');
      setModuleLevel((modules as any[]).length > 0 ? Math.max(...(modules as any[]).map((m: any) => m.level)) + 1 : 1);
      setModuleDescription('');
    }
    setShowModuleDialog(true);
  };

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Configure academy preferences and defaults</p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* General Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
              <SettingsIcon className="text-primary-foreground" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">General Settings</h2>
              <p className="text-sm text-muted-foreground">Academy-wide configuration</p>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <Label htmlFor="packSize" className="text-base mb-2 block">Default Pack Size</Label>
              <p className="text-sm text-muted-foreground mb-3">Number of classes included in a standard tuition pack</p>
              <Input id="packSize" type="number" min="1" value={packSize} onChange={(e) => setPackSize(Number(e.target.value))} className="max-w-xs" />
            </div>
            <div>
              <Label htmlFor="classDay" className="text-base mb-2 block">Class Day</Label>
              <p className="text-sm text-muted-foreground mb-3">Day of the week when classes typically occur</p>
              <Select value={classDay} onValueChange={setClassDay}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Select a day" />
                </SelectTrigger>
                <SelectContent>
                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-base mb-2 block">Payment Methods</Label>
              <p className="text-sm text-muted-foreground mb-3">Manage available payment methods for student payments</p>
              <div className="space-y-2">
                {paymentMethods.map((method, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input value={method} readOnly className="max-w-xs" />
                    <Button variant="ghost" size="icon" onClick={() => setPaymentMethods(paymentMethods.filter((_, i) => i !== index))}>
                      <X size={16} />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="New payment method"
                    value={newPaymentMethod}
                    onChange={(e) => setNewPaymentMethod(e.target.value)}
                    className="max-w-xs"
                    maxLength={100}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPaymentMethod.trim()) {
                        setPaymentMethods([...paymentMethods, newPaymentMethod.trim()]);
                        setNewPaymentMethod('');
                      }
                    }}
                  />
                  <Button variant="outline" size="icon" onClick={() => {
                    if (newPaymentMethod.trim()) {
                      setPaymentMethods([...paymentMethods, newPaymentMethod.trim()]);
                      setNewPaymentMethod('');
                    }
                  }}>
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-base mb-2 block">Festivos</Label>
              <p className="text-sm text-muted-foreground mb-3">Haz clic en los días festivos. Las sesiones que caigan en esas fechas se moverán automáticamente a la siguiente semana.</p>
              <Calendar
                mode="multiple"
                selected={holidays.map(d => new Date(d + 'T12:00:00'))}
                onSelect={(dates) => {
                  setHolidays((dates || []).map(d => {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}`;
                  }));
                }}
                className="rounded-md border w-fit"
                numberOfMonths={2}
              />
              {holidays.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {holidays.sort().map((date) => (
                    <span key={date} className="flex items-center gap-1 text-xs bg-accent rounded px-2 py-1">
                      {new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      <button onClick={() => setHolidays(holidays.filter(d => d !== date))} className="ml-1 hover:text-destructive">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="pt-4 border-t">
              <Button onClick={() => {
                const methods = newPaymentMethod.trim()
                  ? [...paymentMethods, newPaymentMethod.trim()]
                  : paymentMethods;
                if (newPaymentMethod.trim()) {
                  setPaymentMethods(methods);
                  setNewPaymentMethod('');
                }
                updateSettingsMutation.mutate({ packSize, classDay, paymentMethods: methods, holidays });
              }} className="gap-2">
                <Save size={20} />
                Save Settings
              </Button>
            </div>
          </div>
        </Card>

        {/* Activities */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                <BookOpen className="text-primary-foreground" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Actividades</h2>
                <p className="text-sm text-muted-foreground">Catálogo de actividades predefinidas</p>
              </div>
            </div>
            <Button onClick={() => handleOpenActivityDialog()} size="sm" className="gap-2">
              <Plus size={16} />
              Nueva actividad
            </Button>
          </div>
          {(activities as any[]).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay actividades. Añade la primera.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(activities as any[]).map((activity) => {
                  const areaConf = AREA_CONFIG[activity.area] || AREA_CONFIG.other;
                  return (
                    <TableRow key={activity.id}>
                      <TableCell className="font-medium">{activity.name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${areaConf.className}`}>
                          {areaConf.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                        {activity.description || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenActivityDialog(activity)}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteActivityId(activity.id)}>
                            <Trash2 size={14} className="text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Modules */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Layers className="text-primary-foreground" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Módulos</h2>
                <p className="text-sm text-muted-foreground">Unidades de curriculum por nivel</p>
              </div>
            </div>
            <Button onClick={() => handleOpenModuleDialog()} size="sm" className="gap-2">
              <Plus size={16} />
              Nuevo módulo
            </Button>
          </div>
          {(modules as any[]).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay módulos. Añade el primero.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(modules as any[]).map((module) => (
                  <TableRow key={module.id}>
                    <TableCell>
                      <span className="font-bold text-primary">Niv. {module.level}</span>
                    </TableCell>
                    <TableCell className="font-medium">{module.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                      {module.description || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenModuleDialog(module)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteModuleId(module.id)}>
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Profesores */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                <GraduationCap className="text-primary-foreground" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Profesores</h2>
                <p className="text-sm text-muted-foreground">Lista de profesores activos de la academia</p>
              </div>
            </div>
            <Button onClick={() => { setEditingTeacher(null); setTeacherName(''); setTeacherEmail(''); setShowTeacherDialog(true); }} size="sm" className="gap-2">
              <Plus size={16} />
              Añadir profesor
            </Button>
          </div>
          {(teachers as any[]).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay profesores registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email / Acceso</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(teachers as any[]).map((teacher: any) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-medium">{teacher.name}</TableCell>
                    <TableCell>
                      {teacher.email ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{teacher.email}</span>
                          {teacher.user_id ? (
                            <span className="text-xs text-green-600 border border-green-300 rounded px-1.5 py-0.5">✓ Activo</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              disabled={inviteTeacherMutation.isPending}
                              onClick={() => inviteTeacherMutation.mutate({ email: teacher.email, teacher_id: teacher.id })}
                            >
                              Enviar invitación
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sin email asignado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingTeacher(teacher); setTeacherName(teacher.name); setTeacherEmail(teacher.email || ''); setShowTeacherDialog(true); }}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTeacherId(teacher.id)}>
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Virtual Courses — admin only */}
        {userRole === 'admin' && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Monitor className="text-primary-foreground" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Cursos Virtuales</h2>
                <p className="text-sm text-muted-foreground">Catálogo de cursos (sólo editar nombre, descripción y siguiente curso)</p>
              </div>
            </div>
            {(virtualCourses as any[]).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay cursos. Ejecuta virtual_setup.sql en Supabase.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Siguiente curso</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(virtualCourses as any[]).map((course: any) => {
                    const nextCourse = (virtualCourses as any[]).find((c: any) => c.id === course.next_course_id);
                    return (
                      <TableRow key={course.id}>
                        <TableCell className="font-mono font-semibold">{course.code}</TableCell>
                        <TableCell className="font-medium">{course.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {nextCourse ? `${nextCourse.code} — ${nextCourse.name}` : '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingVirtualCourse(course);
                              setVcName(course.name);
                              setVcDescription(course.description || '');
                              setVcNextCourseId(course.next_course_id || 'none');
                              setShowVcDialog(true);
                            }}
                          >
                            <Pencil size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        )}

        {/* Course Slots — Pablo scheduling */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                <CalendarClock className="text-primary-foreground" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Franjas de cursos</h2>
                <p className="text-sm text-muted-foreground">Fechas y horarios tentativos que Pablo propone al recomendar un curso</p>
              </div>
            </div>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => {
                setEditingSlot(null);
                setSlotCourseCode('RCZ'); setSlotCourseName('Real Coders Zero');
                setSlotDay('Sábado'); setSlotStartTime('09:00'); setSlotEndTime('10:30');
                setSlotDate(''); setSlotActive(true);
                setShowSlotDialog(true);
              }}
            >
              <Plus size={16} />
              Añadir franja
            </Button>
          </div>
          {courseSlots.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay franjas configuradas. Pablo pedirá disponibilidad al padre.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Curso</TableHead>
                  <TableHead>Día</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Fecha tentativa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseSlots.map((slot: any) => (
                  <TableRow key={slot.id} className={!slot.is_active ? 'opacity-50' : ''}>
                    <TableCell>
                      <span className="font-mono font-semibold text-sm">{slot.course_code}</span>
                      <span className="text-muted-foreground text-xs ml-2">{slot.course_name}</span>
                    </TableCell>
                    <TableCell>{slot.day_of_week}</TableCell>
                    <TableCell className="font-mono text-sm">{slot.start_time} – {slot.end_time}</TableCell>
                    <TableCell>
                      {slot.tentative_start_date
                        ? new Date(slot.tentative_start_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
                        : <span className="text-muted-foreground text-xs">Sin fecha</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        !slot.is_active ? 'bg-muted text-muted-foreground border-muted' :
                        slot.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-300' :
                        'bg-blue-50 text-blue-700 border-blue-300'
                      }`}>
                        {!slot.is_active ? 'Inactiva' : slot.status === 'confirmed' ? 'Confirmada' : 'Formando grupo'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingSlot(slot);
                          setSlotCourseCode(slot.course_code);
                          setSlotCourseName(slot.course_name);
                          setSlotDay(slot.day_of_week);
                          setSlotStartTime((slot.start_time ?? '').slice(0, 5));
                          setSlotEndTime((slot.end_time ?? '').slice(0, 5));
                          setSlotDate(slot.tentative_start_date || '');
                          setSlotActive(slot.is_active ?? true);
                          setShowSlotDialog(true);
                        }}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteSlotId(slot.id)}>
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-2">About</h3>
          <p className="text-sm text-muted-foreground">AKU Tracker v2.0</p>
        </Card>
      </div>

      {/* Activity Dialog */}
      <Dialog open={showActivityDialog} onOpenChange={(open) => !open && setShowActivityDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingActivity ? 'Editar actividad' : 'Nueva actividad'}</DialogTitle>
            <DialogDescription>
              {editingActivity ? 'Modifica los datos de la actividad' : 'Añade una nueva actividad al catálogo'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="activityName" className="mb-2 block">Nombre *</Label>
              <Input id="activityName" value={activityName} onChange={(e) => setActivityName(e.target.value)} placeholder="Ej: Scratch básico" />
            </div>
            <div>
              <Label htmlFor="activityArea" className="mb-2 block">Área *</Label>
              <Select value={activityArea} onValueChange={setActivityArea}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="programming">Programación</SelectItem>
                  <SelectItem value="robotics">Robótica</SelectItem>
                  <SelectItem value="3d_design">Diseño 3D</SelectItem>
                  <SelectItem value="ai">IA</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="activityDesc" className="mb-2 block">Descripción (opcional)</Label>
              <Textarea id="activityDesc" value={activityDescription} onChange={(e) => setActivityDescription(e.target.value)} rows={3} placeholder="Breve descripción de la actividad..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivityDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveActivityMutation.mutate()} disabled={!activityName.trim()}>
              {editingActivity ? 'Guardar cambios' : 'Crear actividad'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteActivityId} onOpenChange={(open) => !open && setDeleteActivityId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar actividad?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteActivityId && deleteActivityMutation.mutate(deleteActivityId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Module Dialog */}
      <Dialog open={showModuleDialog} onOpenChange={(open) => !open && setShowModuleDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModule ? 'Editar módulo' : 'Nuevo módulo'}</DialogTitle>
            <DialogDescription>
              {editingModule ? 'Modifica los datos del módulo' : 'Define un nuevo módulo de curriculum'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="moduleName" className="mb-2 block">Nombre *</Label>
              <Input id="moduleName" value={moduleName} onChange={(e) => setModuleName(e.target.value)} placeholder="Ej: Módulo 1 - Fundamentos" />
            </div>
            <div>
              <Label htmlFor="moduleLevel" className="mb-2 block">Nivel *</Label>
              <Input id="moduleLevel" type="number" min="1" value={moduleLevel} onChange={(e) => setModuleLevel(Number(e.target.value))} className="max-w-xs" />
            </div>
            <div>
              <Label htmlFor="moduleDesc" className="mb-2 block">Descripción (opcional)</Label>
              <Textarea id="moduleDesc" value={moduleDescription} onChange={(e) => setModuleDescription(e.target.value)} rows={3} placeholder="Descripción del módulo..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModuleDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveModuleMutation.mutate()} disabled={!moduleName.trim()}>
              {editingModule ? 'Guardar cambios' : 'Crear módulo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Virtual Course Edit Dialog */}
      <Dialog open={showVcDialog} onOpenChange={(open) => !open && setShowVcDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar curso virtual — {editingVirtualCourse?.code}</DialogTitle>
            <DialogDescription>Actualiza nombre, descripción o siguiente curso en la ruta</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-2 block">Nombre *</Label>
              <Input value={vcName} onChange={(e) => setVcName(e.target.value)} placeholder="Nombre del curso" />
            </div>
            <div>
              <Label className="mb-2 block">Descripción (opcional)</Label>
              <Textarea value={vcDescription} onChange={(e) => setVcDescription(e.target.value)} rows={3} placeholder="Descripción del curso..." />
            </div>
            <div>
              <Label className="mb-2 block">Siguiente curso en la ruta (opcional)</Label>
              <Select value={vcNextCourseId} onValueChange={setVcNextCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin siguiente curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin siguiente curso</SelectItem>
                  {(virtualCourses as any[])
                    .filter((c: any) => c.id !== editingVirtualCourse?.id)
                    .map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVcDialog(false)}>Cancelar</Button>
            <Button onClick={() => updateVirtualCourseMutation.mutate()} disabled={!vcName.trim()}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teacher Dialog */}
      <Dialog open={showTeacherDialog} onOpenChange={(open) => !open && setShowTeacherDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTeacher ? 'Editar profesor' : 'Nuevo profesor'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label className="mb-2 block">Nombre *</Label>
              <Input
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="Nombre del profesor"
              />
            </div>
            <div>
              <Label className="mb-2 block">Email de cuenta</Label>
              <Input
                type="email"
                value={teacherEmail}
                onChange={(e) => setTeacherEmail(e.target.value)}
                placeholder="email@ejemplo.com"
              />
              <p className="text-xs text-muted-foreground mt-1">Email con el que iniciará sesión. Si se asigna, tendrá acceso solo a sus grupos.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTeacherDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveTeacherMutation.mutate()} disabled={!teacherName.trim() || saveTeacherMutation.isPending}>
              {editingTeacher ? 'Guardar cambios' : 'Añadir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTeacherId} onOpenChange={(open) => !open && setDeleteTeacherId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar profesor?</AlertDialogTitle>
            <AlertDialogDescription>Los grupos asignados a este profesor quedarán sin profesor asignado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTeacherId && deleteTeacherMutation.mutate(deleteTeacherId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteModuleId} onOpenChange={(open) => !open && setDeleteModuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar módulo?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteModuleId && deleteModuleMutation.mutate(deleteModuleId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Course Slot Dialog */}
      <Dialog open={showSlotDialog} onOpenChange={(open) => !open && setShowSlotDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSlot ? 'Editar franja' : 'Nueva franja'}</DialogTitle>
            <DialogDescription>Configura el curso, horario y fecha tentativa de inicio.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-2 block">Código del curso *</Label>
                <Select value={slotCourseCode} onValueChange={(v) => {
                  setSlotCourseCode(v);
                  const course = (virtualCourses as any[]).find((c: any) => c.code === v);
                  setSlotCourseName(course?.name || v);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(virtualCourses as any[]).map((c: any) => (
                      <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Día *</Label>
                <Select value={slotDay} onValueChange={setSlotDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Sábado','Lunes','Martes','Miércoles','Jueves','Viernes'].map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-2 block">Hora inicio *</Label>
                <Select value={slotStartTime} onValueChange={setSlotStartTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['09:00','10:30','14:00','16:00','17:00','18:00'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Hora fin *</Label>
                <Select value={slotEndTime} onValueChange={setSlotEndTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['10:30','12:00','15:30','17:30','18:30','19:30'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Fecha tentativa de inicio</Label>
              <Input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="slotActive"
                checked={slotActive}
                onChange={(e) => setSlotActive(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="slotActive">Activa (Pablo la propone en conversaciones)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSlotDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveSlotMutation.mutate()} disabled={saveSlotMutation.isPending}>
              {editingSlot ? 'Guardar cambios' : 'Añadir franja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSlotId} onOpenChange={(open) => !open && setDeleteSlotId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta franja?</AlertDialogTitle>
            <AlertDialogDescription>Pablo dejará de proponer este horario en sus conversaciones.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSlotId && deleteSlotMutation.mutate(deleteSlotId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
