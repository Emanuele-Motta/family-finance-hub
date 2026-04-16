import { useMemo } from 'react';
import type { Transaction, Category, Budget } from '@/types/finance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle, Target } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, parseISO, getDaysInMonth, getDate } from 'date-fns';

interface Insight {
  type: 'warning' | 'success' | 'info' | 'danger';
  icon: typeof Lightbulb;
  title: string;
  description: string;
}

interface Props {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  totalIncome: number;
  totalExpense: number;
}

export default function SmartInsights({ transactions, categories, budgets, totalIncome, totalExpense }: Props) {
  const insights = useMemo(() => {
    const result: Insight[] = [];
    const now = new Date();
    const currentMonth = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const prevMonth = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));

    const currentTx = transactions.filter(t => {
      const d = parseISO(t.date);
      return d >= currentMonth && d <= currentMonthEnd;
    });
    const prevTx = transactions.filter(t => {
      const d = parseISO(t.date);
      return d >= prevMonth && d <= prevMonthEnd;
    });

    // Savings rate
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    if (savingsRate > 20) {
      result.push({
        type: 'success', icon: Target,
        title: `Ottimo risparmio: ${savingsRate.toFixed(0)}%`,
        description: 'Stai risparmiando più del 20% delle entrate. Continua così!'
      });
    } else if (savingsRate < 0) {
      result.push({
        type: 'danger', icon: AlertTriangle,
        title: 'Spese superiori alle entrate!',
        description: `Stai spendendo €${Math.abs(totalIncome - totalExpense).toFixed(0)} più di quanto guadagni questo mese.`
      });
    }

    // Per-category analysis vs last month
    const catExpenses: Record<string, number> = {};
    const prevCatExpenses: Record<string, number> = {};
    currentTx.filter(t => t.type === 'expense').forEach(t => {
      catExpenses[t.category_id || 'other'] = (catExpenses[t.category_id || 'other'] || 0) + Number(t.amount);
    });
    prevTx.filter(t => t.type === 'expense').forEach(t => {
      prevCatExpenses[t.category_id || 'other'] = (prevCatExpenses[t.category_id || 'other'] || 0) + Number(t.amount);
    });

    for (const [catId, amount] of Object.entries(catExpenses)) {
      const prevAmount = prevCatExpenses[catId] || 0;
      if (prevAmount > 0 && amount > prevAmount * 1.3) {
        const cat = categories.find(c => c.id === catId);
        if (cat) {
          result.push({
            type: 'warning', icon: TrendingUp,
            title: `${cat.name}: +${Math.round(((amount - prevAmount) / prevAmount) * 100)}% vs mese scorso`,
            description: `Stai spendendo di più in ${cat.name}. Mese scorso: €${prevAmount.toFixed(0)}, questo mese: €${amount.toFixed(0)}.`
          });
        }
      }
    }

    // Budget alerts
    for (const budget of budgets) {
      const spent = currentTx
        .filter(t => t.type === 'expense' && (budget.category_id ? t.category_id === budget.category_id : true))
        .reduce((s, t) => s + Number(t.amount), 0);
      const pct = (spent / Number(budget.amount)) * 100;
      if (pct >= 100) {
        const cat = categories.find(c => c.id === budget.category_id);
        result.push({
          type: 'danger', icon: AlertTriangle,
          title: `Budget ${cat?.name || 'globale'} superato!`,
          description: `Hai speso €${spent.toFixed(0)} su un budget di €${Number(budget.amount).toFixed(0)}.`
        });
      }
    }

    // Forecast: projected end-of-month balance
    const dayOfMonth = getDate(now);
    const daysInMonth = getDaysInMonth(now);
    if (dayOfMonth >= 5 && totalExpense > 0) {
      const dailyAvgExpense = totalExpense / dayOfMonth;
      const projectedExpense = dailyAvgExpense * daysInMonth;
      const projectedBalance = totalIncome - projectedExpense;
      if (projectedBalance < 0) {
        result.push({
          type: 'danger', icon: TrendingDown,
          title: `Previsione: -€${Math.abs(projectedBalance).toFixed(0)} a fine mese`,
          description: `Al ritmo attuale (€${dailyAvgExpense.toFixed(0)}/giorno), finirai il mese in negativo.`
        });
      } else {
        result.push({
          type: 'info', icon: TrendingUp,
          title: `Previsione: +€${projectedBalance.toFixed(0)} a fine mese`,
          description: `Spesa media giornaliera: €${dailyAvgExpense.toFixed(0)}. Stai andando bene.`
        });
      }
    }

    // If no insights, add a default
    if (result.length === 0) {
      result.push({
        type: 'info', icon: Lightbulb,
        title: 'Aggiungi più transazioni',
        description: 'Con più dati potrò fornirti analisi e suggerimenti personalizzati.'
      });
    }

    return result.slice(0, 5);
  }, [transactions, categories, budgets, totalIncome, totalExpense]);

  const colorMap = {
    warning: 'border-l-warning bg-warning/5',
    success: 'border-l-primary bg-primary/5',
    info: 'border-l-blue-500 bg-blue-500/5',
    danger: 'border-l-destructive bg-destructive/5',
  };

  const badgeMap = {
    warning: 'bg-warning/20 text-warning hover:bg-warning/20',
    success: 'bg-primary/20 text-primary hover:bg-primary/20',
    info: 'bg-blue-500/20 text-blue-500 hover:bg-blue-500/20',
    danger: 'bg-destructive/20 text-destructive hover:bg-destructive/20',
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-primary" />
          Smart Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight, i) => (
          <div key={i} className={`rounded-lg border-l-4 p-3 ${colorMap[insight.type]}`}>
            <div className="flex items-start gap-2">
              <insight.icon className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{insight.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
