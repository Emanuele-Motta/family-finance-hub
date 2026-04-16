import { useMemo, useState } from 'react';
import type { Transaction, Category, Debt } from '@/types/finance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, parseISO, addMonths, subMonths, isToday, getDay } from 'date-fns';
import { it } from 'date-fns/locale';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  debts: Debt[];
}

export default function FinancialCalendar({ transactions, categories, debts }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const dayData = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    transactions.forEach(t => {
      const key = t.date;
      const existing = map.get(key) || { income: 0, expense: 0 };
      if (t.type === 'income') existing.income += Number(t.amount);
      if (t.type === 'expense') existing.expense += Number(t.amount);
      map.set(key, existing);
    });
    return map;
  }, [transactions]);

  // Debt due dates in this month
  const dueDates = useMemo(() => {
    return debts
      .filter(d => !d.is_paid && d.due_date)
      .map(d => ({ date: d.due_date!, name: d.name }));
  }, [debts]);

  const firstDayOffset = (getDay(startOfMonth(currentDate)) + 6) % 7; // Monday = 0
  const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : n.toFixed(0);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Calendario finanziario</CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[100px] text-center">
              {format(currentDate, 'MMMM yyyy', { locale: it })}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-px">
          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (
            <div key={d} className="text-xs text-muted-foreground text-center py-1 font-medium">{d}</div>
          ))}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd');
            const data = dayData.get(key);
            const hasDue = dueDates.some(d => d.date === key);
            const isT = isToday(day);

            return (
              <div
                key={key}
                className={`relative p-1 min-h-[48px] rounded-md text-center transition-colors
                  ${isT ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted/50'}
                  ${hasDue ? 'ring-1 ring-destructive/50' : ''}`}
              >
                <span className={`text-xs ${isT ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                  {format(day, 'd')}
                </span>
                {data && (
                  <div className="mt-0.5 space-y-0.5">
                    {data.income > 0 && (
                      <div className="text-[9px] leading-tight text-income font-medium">+{fmt(data.income)}</div>
                    )}
                    {data.expense > 0 && (
                      <div className="text-[9px] leading-tight text-expense font-medium">-{fmt(data.expense)}</div>
                    )}
                  </div>
                )}
                {hasDue && (
                  <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-destructive" />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-income" /> Entrate</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-expense" /> Spese</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> Scadenze</span>
        </div>
      </CardContent>
    </Card>
  );
}
