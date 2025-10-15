import { mockUser } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bot, Home, Users, Settings, Calendar } from 'lucide-react';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();

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
              <p className="text-sm font-medium">{mockUser.name}</p>
              <Badge variant="secondary" className="text-xs">
                {mockUser.role.charAt(0).toUpperCase() + mockUser.role.slice(1)}
              </Badge>
            </div>
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
