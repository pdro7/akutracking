import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bot, Home, Users, Settings, LogOut, DollarSign, Monitor, Radar, MessageCircle,
  FlaskConical, CalendarClock, CalendarDays, UserPlus, User, Gift,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// Persisted collapse state so the sidebar doesn't flicker between routes.
const STORAGE_KEY = 'aku_sidebar_collapsed';

// Header wraps its children so we can render both the sidebar (desktop)
// and the mobile top bar without touching every page. Every route in
// App.tsx uses <Header><Page /></Header>. Mobile keeps the horizontal
// scrollable nav strip per longstanding user feedback.
export function Header({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { data: userRole } = useUserRole();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return window.localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0'); } catch { /* private mode */ }
  }, [collapsed]);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      return data;
    }
  });

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ variant: 'destructive', title: 'Logout failed', description: error.message });
    } else {
      navigate('/auth');
    }
  };

  const isTeacher = userRole === 'teacher';

  const navItems = isTeacher
    ? [
        { path: '/virtual-groups', label: 'Mis grupos', icon: Monitor },
        { path: '/teacher/individuales', label: 'Mis individuales', icon: User },
        { path: '/teacher/trials', label: 'Mis pruebas', icon: FlaskConical },
        { path: '/calendario', label: 'Calendario', icon: CalendarDays },
        { path: '/teacher/availability', label: 'Mi disponibilidad', icon: CalendarClock },
      ]
    : [
        { path: '/', label: 'Dashboard', icon: Home },
        { path: '/students', label: 'Students', icon: Users },
        { path: '/individuales', label: 'Individuales', icon: User },
        { path: '/leads', label: 'Leads', icon: Radar },
        { path: '/trial-leads', label: 'Pruebas', icon: FlaskConical },
        { path: '/conversations', label: 'Pablo', icon: MessageCircle },
        { path: '/virtual-groups', label: 'Virtual', icon: Monitor },
        { path: '/candidatos', label: 'Candidatos', icon: UserPlus },
        { path: '/referidos', label: 'Referidos', icon: Gift },
        { path: '/calendario', label: 'Calendario', icon: CalendarDays },
        ...(userRole === 'admin' ? [{ path: '/payments', label: 'Payments', icon: DollarSign }] : []),
        { path: '/settings', label: 'Settings', icon: Settings },
      ];

  const sidebarWidth = collapsed ? 'md:w-14' : 'md:w-56';
  const mainOffset = collapsed ? 'md:ml-14' : 'md:ml-56';

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar (desktop only) */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen hidden md:flex flex-col border-r bg-card transition-[width] duration-200 z-30',
          sidebarWidth,
        )}
      >
        <div className="h-14 flex items-center gap-2 px-3 border-b shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
            <Bot className="text-primary-foreground" size={20} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate leading-tight">AKUMAYA</h1>
              <p className="text-[10px] text-muted-foreground truncate leading-tight">Tracker</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                variant={active ? 'default' : 'ghost'}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'w-full h-9 gap-2 justify-start',
                  collapsed && 'px-0 justify-center',
                )}
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Button>
            );
          })}
        </nav>

        <div className="border-t p-2 space-y-2 shrink-0">
          {!collapsed && (
            <div className="px-2">
              <p className="text-sm font-medium truncate">{profile?.name || 'User'}</p>
              <Badge variant="secondary" className="text-xs capitalize">{userRole}</Badge>
            </div>
          )}
          <div className={cn('flex gap-1', collapsed && 'flex-col')}>
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              onClick={handleLogout}
              className={cn(!collapsed && 'flex-1 justify-start gap-2')}
              title="Cerrar sesión"
            >
              <LogOut size={16} />
              {!collapsed && 'Salir'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar: logo, user info, and the horizontal scrollable nav. */}
      <header className="md:hidden border-b bg-card">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Bot className="text-primary-foreground" size={18} />
              </div>
              <h1 className="text-base font-bold">AKUMAYA</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{profile?.name || 'User'}</p>
                <Badge variant="secondary" className="text-xs capitalize">{userRole}</Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <nav className="flex items-center gap-2 mt-3 overflow-x-auto">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant={location.pathname === item.path ? 'default' : 'ghost'}
                onClick={() => navigate(item.path)}
                size="sm"
                className="gap-2 flex-shrink-0"
              >
                <item.icon size={16} />
                {item.label}
              </Button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content: shifted right on desktop to make room for the sidebar. */}
      <main className={cn('transition-[margin] duration-200', mainOffset)}>
        {children}
      </main>
    </div>
  );
}
