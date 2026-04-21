// 16-Apr-2026 — Emanuele Motta
// Bottom navigation dedicata mobile

import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, PlusCircle, ChartNoAxesCombined, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';

const items = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/transactions', label: 'Movimenti', icon: ArrowLeftRight },
  { to: '/?quickAdd=1', label: 'Aggiungi', icon: PlusCircle },
  { to: '/analytics', label: 'Grafici', icon: ChartNoAxesCombined },
];

export default function MobileBottomNav({ hide = false }: { hide?: boolean }) {
  const location = useLocation();
  const { toggleSidebar, sidebarOpen } = useAppStore();
  const quickAddOpen = location.pathname === '/' && new URLSearchParams(location.search).get('quickAdd') === '1';

  if (hide) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background lg:hidden pb-[max(env(safe-area-inset-bottom),0.25rem)]">
      <div className="grid grid-cols-5 gap-1 px-2 py-1">
        {items.map((item) => {
          const active = item.to === '/?quickAdd=1'
            ? quickAddOpen
            : item.to === '/'
              ? location.pathname === '/' && !quickAddOpen
              : location.pathname === item.to;

          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[11px] transition-colors',
                active ? 'text-primary bg-primary/10' : 'text-muted-foreground'
              )}
            >
              <item.icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            'flex flex-col h-auto items-center justify-center rounded-xl px-1 py-2 text-[11px] hover:text-foreground hover:bg-primary/10',
            sidebarOpen ? 'text-primary bg-primary/10' : 'text-muted-foreground'
          )}
        >
          <Menu className="w-4 h-4 mb-0.5" />
          <span>{sidebarOpen ? 'Chiudi' : 'Menu'}</span>
        </Button>
      </div>
    </nav>
  );
}
