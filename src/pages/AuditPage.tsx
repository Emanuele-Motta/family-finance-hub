// 16-Apr-2026 — Emanuele Motta
// Audit History Page - Transaction change timeline

import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useAuth } from '@/contexts/AuthContext';
import { getFamilyAudit, getTransactionAudit } from '@/services/rulesService';
import { useTransactions } from '@/hooks/useFinanceData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import type { TransactionAuditEntry } from '@/types/finance';

export default function AuditPage() {
  const { currentFamilyGroupId } = useAppStore();
  const { user } = useAuth();
  const { transactions } = useTransactions();
  const { toast } = useToast();

  const [audit, setAudit] = useState<TransactionAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<'all' | 'CREATE' | 'UPDATE' | 'DELETE'>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'manual' | 'trigger' | 'automation'>('all');
  const [searchTxId, setSearchTxId] = useState('');

  useEffect(() => {
    loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFamilyGroupId]);

  const loadAudit = async () => {
    if (!currentFamilyGroupId) return;
    try {
      setLoading(true);
      const loaded = await getFamilyAudit(currentFamilyGroupId, 200);
      setAudit(loaded);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
      toast({ title: 'Errore caricamento audit', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filtered = audit.filter((entry) => {
    if (filterAction !== 'all' && entry.action !== filterAction) return false;
    if (filterSource !== 'all' && entry.trigger_source !== filterSource) return false;
    if (searchTxId && !entry.transaction_id?.includes(searchTxId)) return false;
    return true;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Badge className="bg-green-500">Creato</Badge>;
      case 'UPDATE':
        return <Badge className="bg-blue-500">Modificato</Badge>;
      case 'DELETE':
        return <Badge className="bg-red-500">Eliminato</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'manual':
        return <Badge variant="outline" className="text-xs">Manuale</Badge>;
      case 'trigger':
        return <Badge variant="secondary" className="text-xs">Trigger DB</Badge>;
      case 'automation':
        return <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">Automazione</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{source}</Badge>;
    }
  };

  const formatValue = (val: unknown): string => {
    if (val === null) return 'null';
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'number') return val.toFixed(2);
    return String(val);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Storico audit</h1>
        <p className="text-sm text-muted-foreground">Cronologia di tutti i cambiamenti e le operazioni.</p>
      </div>

      <Card className="glass-card">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <Select value={filterAction} onValueChange={(value: string) => setFilterAction(value as 'all' | 'CREATE' | 'UPDATE' | 'DELETE')}>
                <SelectTrigger><SelectValue placeholder="Azione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte azioni</SelectItem>
                  <SelectItem value="CREATE">Creato</SelectItem>
                  <SelectItem value="UPDATE">Modificato</SelectItem>
                  <SelectItem value="DELETE">Eliminato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={filterSource} onValueChange={(value: string) => setFilterSource(value as 'all' | 'manual' | 'trigger' | 'automation')}>
                <SelectTrigger><SelectValue placeholder="Fonte" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte fonti</SelectItem>
                  <SelectItem value="manual">Manuale</SelectItem>
                  <SelectItem value="trigger">Trigger</SelectItem>
                  <SelectItem value="automation">Automazione</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-2">
              <Input value={searchTxId} onChange={(e) => setSearchTxId(e.target.value)} placeholder="Cerca ID transazione..." />
            </div>
          </div>

          <div className="text-xs text-muted-foreground">Risultati: {filtered.length}</div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento storico...</div>
      ) : filtered.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-10 text-center text-muted-foreground">Nessuna voce di audit con i filtri correnti.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry, index) => {
            const prevEntry = index > 0 ? filtered[index - 1] : null;
            const sameHour = prevEntry && new Date(entry.created_at).getHours() === new Date(prevEntry.created_at).getHours();

            return (
              <Card key={entry.id} className="glass-card">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mt-1.5 ${entry.action === 'CREATE' ? 'bg-green-500' : entry.action === 'DELETE' ? 'bg-red-500' : 'bg-blue-500'}`} />
                        {index < filtered.length - 1 && <div className="w-0.5 h-6 bg-border my-0.5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getActionBadge(entry.action)}
                          {getSourceBadge(entry.trigger_source)}
                          <span className="text-xs text-muted-foreground">{format(parseISO(entry.created_at), 'dd MMM HH:mm:ss', { locale: it })}</span>
                        </div>

                        <div className="mt-2 text-xs space-y-1">
                          {entry.transaction_id && <p className="text-muted-foreground">Transazione: <code className="bg-muted px-1 rounded">{entry.transaction_id.slice(0, 8)}...</code></p>}

                          {entry.action === 'UPDATE' && entry.old_values && entry.new_values && (
                            <div className="border-t border-border/60 pt-2 mt-2">
                              <p className="font-medium text-foreground mb-1">Modifiche:</p>
                              <div className="space-y-1 ml-2">
                                {Object.keys(entry.new_values || {}).map((key) => {
                                  const oldVal = (entry.old_values || {})[key];
                                  const newVal = (entry.new_values || {})[key];
                                  if (oldVal === newVal) return null;
                                  return (
                                    <div key={key} className="text-muted-foreground">
                                      <span className="font-mono text-xs">{key}:</span>
                                      <br />
                                      <span className="line-through text-xs opacity-60">{formatValue(oldVal)}</span>
                                      <span className="text-xs ml-1">→ {formatValue(newVal)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {entry.action === 'CREATE' && entry.new_values && (
                            <div className="border-t border-border/60 pt-2 mt-2">
                              <p className="font-medium text-green-600 text-xs">Creato con:</p>
                              <div className="space-y-0.5 ml-2 text-xs text-muted-foreground">
                                <div>Importo: <span className="font-mono text-foreground">{formatValue((entry.new_values as Record<string, unknown>)?.amount)}</span></div>
                                <div>Tipo: <span className="font-mono text-foreground">{formatValue((entry.new_values as Record<string, unknown>)?.type)}</span></div>
                                <div>Data: <span className="font-mono text-foreground">{formatValue((entry.new_values as Record<string, unknown>)?.date)}</span></div>
                                {(entry.new_values as Record<string, unknown>)?.notes && <div>Note: <span className="font-mono text-foreground">{formatValue((entry.new_values as Record<string, unknown>)?.notes)}</span></div>}
                              </div>
                            </div>
                          )}

                          {entry.action === 'DELETE' && entry.old_values && (
                            <div className="border-t border-border/60 pt-2 mt-2">
                              <p className="font-medium text-red-600 text-xs">Precedenti valori:</p>
                              <div className="space-y-0.5 ml-2 text-xs text-muted-foreground">
                                <div>Importo: <span className="font-mono text-foreground">{formatValue((entry.old_values as Record<string, unknown>)?.amount)}</span></div>
                                <div>Tipo: <span className="font-mono text-foreground">{formatValue((entry.old_values as Record<string, unknown>)?.type)}</span></div>
                                {(entry.old_values as Record<string, unknown>)?.notes && <div>Note: <span className="font-mono text-foreground">{formatValue((entry.old_values as Record<string, unknown>)?.notes)}</span></div>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
