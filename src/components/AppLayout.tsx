import { ReactNode, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { useFamilyGroup } from '@/hooks/useFamilyGroup';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight, PiggyBank, Target, CreditCard, Settings, LogOut, Menu, X, Wallet, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import QuickAdd from '@/components/QuickAdd';
import SearchCommand from '@/components/SearchCommand';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transazioni' },
  { to: '/budgets', icon: PiggyBank, label: 'Budget' },
  { to: '/goals', icon: Target, label: 'Obiettivi' },
  { to: '/debts', icon: CreditCard, label: 'Debiti' },
  { to: '/settings', icon: Settings, label: 'Impostazioni' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const location = useLocation();
  const { familyGroups } = useFamilyGroup();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 z-30 lg:hidden" onClick={toggleSidebar} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-64'
        )}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Wallet className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-lg">FamilyFinance</span>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden text-sidebar-foreground" onClick={toggleSidebar}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {familyGroups.length > 0 && (
          <div className="px-4 py-3 border-b border-sidebar-border">
            <div className="flex items-center gap-2 text-sm text-sidebar-muted">
              <Users className="w-4 h-4" />
              <span className="truncate">{familyGroups[0]?.name}</span>
            </div>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => window.innerWidth < 1024 && toggleSidebar()}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                location.pathname === item.to
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-sidebar-foreground">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-sidebar-muted hover:text-sidebar-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center gap-4 px-6 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar}>
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">
            {navItems.find((n) => n.to === location.pathname)?.label || 'FamilyFinance'}
          </h1>
          <div className="ml-auto">
            <SearchCommand />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>

      {/* Global Quick Add FAB */}
      <QuickAdd />
    </div>
  );
}
