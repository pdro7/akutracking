import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bot, Home, Users, Settings, Calendar, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

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

  const { data: userRole } = useQuery({
    queryKey: ['userRole'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      return data?.role || 'user';
    }
  });

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: error.message,
      });
    } else {
      navigate("/auth");
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/attendance', label: 'Attendance', icon: Calendar },
    { path: '/students', label: 'Students', icon: Users },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Bot className="text-primary-foreground" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold">RoboAcademy</h1>
                <p className="text-xs text-muted-foreground">Attendance Tracker</p>
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant={location.pathname === item.path ? 'default' : 'ghost'}
                onClick={() => navigate(item.path)}
                className="gap-2"
              >
                <item.icon size={18} />
                {item.label}
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{profile?.name || 'User'}</p>
              <Badge variant="secondary" className="text-xs capitalize">
                {userRole}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex items-center gap-2 mt-4 overflow-x-auto">
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
  );
}
