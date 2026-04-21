import { ReactNode, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { useFamilyGroup } from '@/hooks/useFamilyGroup';
import { useCarExpensesSettings } from '@/hooks/useCarExpensesSettings';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useTransactions } from '@/hooks/useFinanceData';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight, PiggyBank, Target, CreditCard, Settings, LogOut, X, Wallet, Users, MessageCircle, Repeat, ChartNoAxesCombined, Car, Zap, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import QuickAdd from '@/components/QuickAdd';
import SearchCommand from '@/components/SearchCommand';
import MobileBottomNav from '@/components/MobileBottomNav';

const baseNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/analytics', icon: ChartNoAxesCombined, label: 'Grafici' },
  { to: '/car-expenses', icon: Car, label: 'Spese Auto' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transazioni' },
  { to: '/subscriptions', icon: Repeat, label: 'Abbonamenti' },
  { to: '/budgets', icon: PiggyBank, label: 'Budget' },
  { to: '/goals', icon: Target, label: 'Obiettivi' },
  { to: '/debts', icon: CreditCard, label: 'Debiti' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/rules', icon: Zap, label: 'Regole' },
  { to: '/audit', icon: History, label: 'Storico' },
  { to: '/settings', icon: Settings, label: 'Impostazioni' },
];

const MOBILE_BOTTOM_NAV_ROUTES = new Set(['/', '/transactions', '/analytics']);

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const { sidebarOpen, toggleSidebar, currentFamilyGroupId } = useAppStore();
  const location = useLocation();
  const { familyGroups } = useFamilyGroup();
  const { settings: carSettings } = useCarExpensesSettings(currentFamilyGroupId);
  const { refetch } = useTransactions();
  
  // Sincronizzazione offline automatica quando online
  useOfflineSync(refetch);

  const navItems = useMemo(
    () => baseNavItems.filter((item) => item.to !== '/car-expenses' || carSettings.enabled),
    [carSettings.enabled]
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 z-30 lg:hidden" onClick={toggleSidebar} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-[linear-gradient(180deg,hsl(222_47%_14%)_0%,hsl(224_58%_16%)_45%,hsl(226_62%_13%)_100%)] text-sidebar-foreground shadow-2xl shadow-slate-950/20 transition-transform duration-300 pb-20 lg:pb-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-64'
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border/80">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary/90 shadow-md shadow-sidebar-primary/30 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[1.35rem] leading-none tracking-tight text-white">FamilyFinance</p>
            <p className="text-[11px] mt-1 text-sidebar-foreground/60 tracking-wide uppercase">Control Center</p>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto pl-6 lg:hidden text-sidebar-foreground" onClick={toggleSidebar}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {familyGroups.length > 0 && (
          <div className="mx-3 mt-4 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
              <Users className="w-4 h-4 text-sidebar-primary" />
              <span className="truncate font-medium">{familyGroups[0]?.name}</span>
            </div>
          </div>
        )}

        <nav className="flex-1 px-3 pt-4 pb-5 space-y-1.5 overflow-y-auto">
          <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/50">Navigazione</p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => window.innerWidth < 1024 && toggleSidebar()}
              className={cn(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                MOBILE_BOTTOM_NAV_ROUTES.has(item.to) && 'hidden lg:flex',
                location.pathname === item.to
                  ? 'bg-[linear-gradient(90deg,rgba(27,201,151,0.16),rgba(47,111,255,0.08))] text-sidebar-primary shadow-[inset_0_0_0_1px_rgba(27,201,151,0.32)]'
                  : 'text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground hover:translate-x-0.5'
              )}
            >
              {location.pathname === item.to && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
              )}
              <item.icon className={cn('w-5 h-5 transition-colors', location.pathname === item.to ? 'text-sidebar-primary' : 'text-sidebar-foreground/80 group-hover:text-sidebar-foreground')} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border/80">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-sidebar-accent/80 ring-1 ring-white/10 flex items-center justify-center text-xs font-bold text-sidebar-foreground">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-foreground">{user?.email}</p>
              <p className="text-[11px] text-sidebar-foreground/55">Account attivo</p>
            </div>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="h-8 w-full text-xs border border-rose-400/30 text-rose-300 hover:text-rose-200 hover:bg-rose-500/15">
              <LogOut className="w-3.5 h-3.5 mr-1" />Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <header className="h-14 sm:h-16 flex items-center gap-4 px-4 sm:px-6 border-b border-border bg-card sticky top-0 z-20">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight leading-none">
            {navItems.find((n) => n.to === location.pathname)?.label || 'FamilyFinance'}
          </h1>
          <div className="ml-auto">
            <SearchCommand />
          </div>
        </header>

        <main className="app-main flex-1 overflow-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6">
          <div className="app-page mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Global Quick Add FAB */}
      <QuickAdd />
      <MobileBottomNav />
    </div>
  );
}
