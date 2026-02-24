import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings as SettingsIcon, Save, Plus, X, Pencil, Trash2, BookOpen, Layers, Monitor } from 'lucide-react';
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

  // Activity state
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [activityName, setActivityName] = useState('');
  const [activityArea, setActivityArea] = useState('programming');
  const [activityDescription, setActivityDescription] = useState('');
  const [deleteActivityId, setDeleteActivityId] = useState<string | null>(null);

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
      const result = data || { default_pack_size: 8, class_day: 'Saturday', payment_methods: ['Cash', 'Bancololombia', 'Davivienda', 'Wompi', 'Nequi'] };
      setPackSize(result.default_pack_size);
      setClassDay(result.class_day);
      setPaymentMethods(result.payment_methods || ['Cash', 'Bancololombia', 'Davivienda', 'Wompi', 'Nequi']);
      return result;
    }
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

  const { data: userRole } = useQuery({
    queryKey: ['userRole'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      return data?.role || 'user';
    }
  });

  const updateVirtualCourseMutation = useMutation({
    mutationFn: async () => {
      if (!editingVirtualCourse) return;
      const { error } = await supabase
        .from('virtual_courses')
        .update({
          name: vcName.trim(),
          description: vcDescription.trim() || null,
          next_course_id: vcNextCourseId || null,
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
    mutationFn: async () => {
      const { data: existing } = await supabase.from('settings').select('id').maybeSingle();
      if (existing) {
        const { error } = await supabase.from('settings').update({
          default_pack_size: packSize,
          class_day: classDay,
          payment_methods: paymentMethods,
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('settings').insert({
          default_pack_size: packSize,
          class_day: classDay,
          payment_methods: paymentMethods,
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
            <div className="pt-4 border-t">
              <Button onClick={() => updateSettingsMutation.mutate()} className="gap-2">
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
                              setVcNextCourseId(course.next_course_id || '');
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
                  <SelectItem value="">Sin siguiente curso</SelectItem>
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
    </div>
  );
}
