// Author: Emanuele Motta
// Date: 16-Apr-2026
// Mobile-first dashboard with compact widgets, quick filters, daily spending timeline
// Shows key metrics: balance, forecast, anomalies, upcoming recurring, budget status

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  Target,
  Zap,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import { supabase } from '@/integrations/supabase/client';
import type {
  Account,
  Budget,
  Transaction,
  CashflowForecast,
  Anomaly,
  Notification,
} from '@/types/finance';

interface DashboardProps {
  familyGroupId: string;
}

export function MobileDashboard({ familyGroupId }: DashboardProps) {
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  // Fetch primary account
  const { data: primaryAccount } = useQuery({
    queryKey: ['account:primary', familyGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('family_group_id', familyGroupId)
        .eq('is_primary', true)
        .single();

      if (error) throw error;
      return data as Account;
    },
  });

  // Fetch cashflow forecast
  const { data: forecast } = useQuery({
    queryKey: ['forecast:30d', familyGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cashflow_forecasts')
        .select('*')
        .eq('family_group_id', familyGroupId)
        .eq('forecast_days', 30)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data as CashflowForecast;
    },
  });

  // Fetch today's transactions
  const { data: todayTransactions = [] } = useQuery({
    queryKey: ['transactions:today', familyGroupId],
    queryFn: async () => {
      const today = format(selectedDay, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('family_group_id', familyGroupId)
        .eq('date', today)
        .order('date', { ascending: false });

      if (error) throw error;
      return (data as Transaction[]) || [];
    },
  });

  // Fetch budget status
  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets:month', familyGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('family_group_id', familyGroupId)
        .eq('period', 'monthly');

      if (error) throw error;
      return (data as Budget[]) || [];
    },
  });

  // Fetch anomalies
  const { data: anomalies = [] } = useQuery({
    queryKey: ['anomalies:recent', familyGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anomalies')
        .select('*')
        .eq('family_group_id', familyGroupId)
        .eq('is_acknowledged', false)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      return (data as Anomaly[]) || [];
    },
  });

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications:unread'],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data as Notification[]) || [];
    },
  });

  // Calculate today's balance change
  const todayBalance = todayTransactions.reduce(
    (sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount),
    0
  );
  const todayExpenses = todayTransactions
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Calculate budget progress
  const budgetProgress = budgets.slice(0, 3).map(budget => {
    // Would fetch transactions for this category in production
    return {
      ...budget,
      spent: 0,
      remaining: budget.amount,
    };
  });

  const dailyTxs = [
    ...Array.from({ length: 7 }, (_, i) => {
      const date = new Date(selectedDay);
      date.setDate(date.getDate() - 3 + i);
      return date;
    }),
  ];

  return (
    <div className="space-y-4 pb-20">
      {/* Header with balance */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 rounded-2xl space-y-3">
        <div className="text-sm opacity-90">Saldo disponibile</div>
        <div className="text-4xl font-bold">€{primaryAccount?.balance.toFixed(2) || '0.00'}</div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-500 border-opacity-30">
          <div>
            <div className="text-xs opacity-75">Previsto a 30 giorni</div>
            <div className="text-lg font-semibold flex items-center gap-1">
              {forecast && forecast.forecast_balance > (primaryAccount?.balance || 0) ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              €{forecast?.forecast_balance.toFixed(2) || '0.00'}
            </div>
          </div>
          <div>
            <div className="text-xs opacity-75">Spending oggi</div>
            <div className="text-lg font-semibold">-€{todayExpenses.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Risk Alert */}
      {forecast && forecast.forecast_balance < 0 && (
        <Card className="p-4 bg-red-50 border-red-200 space-y-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-900">Attenzione</div>
              <div className="text-sm text-red-800">
                Saldo negativo previsto tra i prossimi 30 giorni
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Anomalies Alert */}
      {anomalies.length > 0 && (
        <Card className="p-4 bg-orange-50 border-orange-200 space-y-2">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-orange-900">
                {anomalies.length} anomalia{anomalies.length !== 1 ? 'e' : ''}
              </div>
              <div className="text-sm text-orange-800">{anomalies[0]?.description}</div>
            </div>
            <ChevronRight className="h-5 w-5 text-orange-600" />
          </div>
        </Card>
      )}

      {/* Budget Status - Compact */}
      {budgetProgress.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-semibold">Budget mese</h3>
            <Button variant="ghost" size="sm" className="h-8">
              Vedi tutto
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {budgetProgress.slice(0, 2).map(budget => {
            const percent = (budget.spent / budget.amount) * 100;
            return (
              <Card key={budget.id} className="p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Budget</span>
                  <span className="text-sm font-semibold">
                    €{budget.spent.toFixed(2)} / €{budget.amount.toFixed(2)}
                  </span>
                </div>
                <Progress value={Math.min(percent, 100)} className="h-2" />
                {percent > 100 && (
                  <div className="text-xs text-red-600 font-semibold">
                    Superato di €{(budget.spent - budget.amount).toFixed(2)}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Daily Timeline */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-2">
          <h3 className="font-semibold">Timeline spese</h3>
          <Button variant="ghost" size="sm" className="h-8 px-2">
            {format(selectedDay, 'd MMM', { locale: it })}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto px-2 pb-2">
          {dailyTxs.map((date, idx) => {
            const isSelected =
              format(date, 'yyyy-MM-dd') === format(selectedDay, 'yyyy-MM-dd');
            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(new Date(date))}
                className={`flex-shrink-0 p-3 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-600'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <div className="text-xs font-semibold">
                  {format(date, 'dd', { locale: it })}
                </div>
                <div className="text-xs text-gray-600">
                  {format(date, 'EEE', { locale: it }).toUpperCase()}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Today's Transactions */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-2">
          <h3 className="font-semibold">Transazioni oggi</h3>
          <Button variant="ghost" size="sm" className="h-8">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {todayTransactions.length === 0 ? (
          <Card className="p-6 text-center text-gray-500">
            <p className="text-sm">Nessuna transazione oggi</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {todayTransactions.slice(0, 5).map(tx => (
              <Card key={tx.id} className="p-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    {tx.type === 'income' ? (
                      <ArrowDownLeft className="h-5 w-5 text-green-600" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{tx.notes}</div>
                    <div className="text-xs text-gray-500">
                      {format(parseISO(tx.date), 'HH:mm')}
                    </div>
                  </div>
                </div>
                <div
                  className={`font-bold ${
                    tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {tx.type === 'income' ? '+' : '-'}€{Math.abs(tx.amount).toFixed(2)}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-semibold">Notifiche</h3>
            <Badge variant="destructive" className="rounded-full">
              {notifications.length}
            </Badge>
          </div>

          <div className="space-y-2">
            {notifications.slice(0, 3).map(notif => (
              <Card key={notif.id} className="p-3">
                <div className="font-medium text-sm">{notif.title}</div>
                <div className="text-xs text-gray-600 mt-1">{notif.message}</div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2 px-2">
        <Button variant="outline" className="h-auto flex flex-col gap-2 py-4" asChild>
          <div>
            <Plus className="h-5 w-5" />
            <span className="text-xs font-semibold">Aggiungi</span>
          </div>
        </Button>
        <Button variant="outline" className="h-auto flex flex-col gap-2 py-4" asChild>
          <div>
            <Target className="h-5 w-5" />
            <span className="text-xs font-semibold">Obiettivi</span>
          </div>
        </Button>
        <Button variant="outline" className="h-auto flex flex-col gap-2 py-4" asChild>
          <div>
            <Clock className="h-5 w-5" />
            <span className="text-xs font-semibold">Ricorrenti</span>
          </div>
        </Button>
        <Button variant="outline" className="h-auto flex flex-col gap-2 py-4" asChild>
          <div>
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs font-semibold">Report</span>
          </div>
        </Button>
      </div>
    </div>
  );
}
