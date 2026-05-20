'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Bell,
  Shield,
  Crown,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building2,
  FileText,
  Ban,
  Shirt,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuthStore, type UserRole } from '@/store/auth-store';
import { useAppStore, type AppView } from '@/store/app-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface NavItem {
  id: AppView;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[]; // If specified, only these roles can see it by default. No roles = everyone can see.
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'employees', label: 'Employees', icon: Users, roles: ['super_admin'] },
  { id: 'sites', label: 'Sites', icon: Building2, roles: ['super_admin'] },
  { id: 'attendance', label: 'Attendance', icon: Calendar, roles: ['super_admin'] },
  { id: 'uniform_registry', label: 'Uniform Registry', icon: Shirt },
  { id: 'leave_requests', label: 'Leave Requests', icon: FileText, roles: ['super_admin'] },
  { id: 'cancellation_requests', label: 'Cancellations', icon: Ban, roles: ['super_admin'] },
  { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['super_admin'] },
  { id: 'admins', label: 'Admin Management', icon: Shield, roles: ['super_admin'] },
];

interface SidebarContentProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

function SidebarContent({ collapsed = false, onNavigate }: SidebarContentProps) {
  const { currentView, setCurrentView } = useAppStore();
  const { user, logout, updateUser } = useAuthStore();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [adminPermissions, setAdminPermissions] = React.useState<string[]>([]);
  const [isThemeLoading, setIsThemeLoading] = React.useState(false);

  // Determine if we're in dark mode
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // Fetch admin menu permissions
  React.useEffect(() => {
    if (!user || user.role === 'super_admin') return;

    const fetchPermissions = async () => {
      try {
        const res = await fetch(`/api/menu-permissions?userId=${user.id}`);
        const data = await res.json();
        if (data.success) {
          setAdminPermissions(data.data.allowedMenus || []);
        }
      } catch {
        // silent
      }
    };
    fetchPermissions();
  }, [user]);

  // Fetch unread notification count
  React.useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/notifications?limit=1');
        const data = await res.json();
        if (data.success) {
          setUnreadCount(data.data.unreadCount || 0);
        }
      } catch {
        // silent
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNavClick = (view: AppView) => {
    setCurrentView(view);
    onNavigate?.();
  };

  const handleLogout = () => {
    logout();
    onNavigate?.();
  };

  const handleThemeToggle = async () => {
    if (!user || isThemeLoading) return;
    setIsThemeLoading(true);

    const newTheme = user.theme === 'dark' ? 'light' : 'dark';

    try {
      const res = await fetch('/api/user/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, theme: newTheme }),
      });

      const data = await res.json();
      if (data.success) {
        updateUser({ theme: newTheme });
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    } catch {
      // silent
    } finally {
      setIsThemeLoading(false);
    }
  };

  // Permission-based filtering logic
  const filteredNavItems = navItems.filter((item) => {
    // No roles restriction = everyone can see (dashboard, uniform_registry)
    if (!item.roles) return true;

    // super_admin sees everything
    if (user?.role === 'super_admin') return true;

    // admin: check if they have explicit permission for this menu
    return adminPermissions.includes(item.id);
  });

  const currentTheme = user?.theme || 'dark';

  return (
    <div className="flex h-full flex-col bg-black dark:bg-black light:bg-white border-r border-white/10 dark:border-white/10">
      {/* Logo Section */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white font-bold text-black text-lg shrink-0">
          A
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-white dark:text-white text-lg leading-tight">ASM</span>
            <span className="text-xs text-gray-500 dark:text-gray-500 truncate">
              Arabian Shield Manpower
            </span>
          </div>
        )}
      </div>

      <Separator className="bg-white/10 dark:bg-white/10" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {filteredNavItems.map((item) => {
            const isActive = currentView === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 w-full text-left relative',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-white')} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && item.id === 'notifications' && unreadCount > 0 && (
                  <Badge
                    variant="default"
                    className="ml-auto bg-white text-black text-[10px] px-1.5 py-0 min-w-[20px] h-5 flex items-center justify-center"
                  >
                    {unreadCount}
                  </Badge>
                )}
                {collapsed && item.id === 'notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-black">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-white/10 dark:bg-white/10" />

      {/* User Info Section - Sticky Footer */}
      <div className="p-3 mt-auto">
        {user && (
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg bg-white/5 dark:bg-white/5 p-3',
              collapsed && 'justify-center p-2'
            )}
          >
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full font-semibold text-sm shrink-0",
              user.role === 'super_admin'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-white/10 text-white'
            )}>
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-white dark:text-white truncate">
                  {user.name}
                </span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "mt-0.5 w-fit text-[10px] px-1.5 py-0 h-4",
                    user.role === 'super_admin'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      : 'bg-white/10 text-gray-400 border border-white/10'
                  )}
                >
                  {user.role === 'super_admin' ? (
                    <span className="flex items-center gap-0.5"><Crown className="h-2.5 w-2.5" /> Super Admin</span>
                  ) : 'Admin'}
                </Badge>
              </div>
            )}
            {!collapsed && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 shrink-0"
                  onClick={handleThemeToggle}
                  disabled={isThemeLoading}
                >
                  {currentTheme === 'dark' ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AppSidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  const isMobile = useIsMobile();

  // Mobile: Sheet-based sidebar
  if (isMobile) {
    return (
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-black border-white/10">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
          <SidebarContent onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Collapsible sidebar
  return (
    <div
      className={cn(
        'h-screen sticky top-0 flex flex-col transition-all duration-300 border-r border-white/10 bg-black',
        sidebarOpen ? 'w-64' : 'w-[72px]'
      )}
    >
      <SidebarContent collapsed={!sidebarOpen} />

      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute -right-3 top-7 z-10 h-6 w-6 rounded-full border border-white/20 bg-black text-gray-400 hover:text-white hover:bg-white/10 shadow-md"
      >
        {sidebarOpen ? (
          <ChevronLeft className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}
