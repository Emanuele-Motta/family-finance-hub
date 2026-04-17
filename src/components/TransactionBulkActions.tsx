// Author: Emanuele Motta
// Date: 16-Apr-2026
// Bulk actions component for transactions
// Supports multi-select, batch editing, and quick operations

'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Trash2, 
  Tag, 
  Folder, 
  Copy, 
  Archive,
  MoreVertical,
  ChevronDown,
  Filter,
  Download,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { supabase } from '@/integrations/supabase/client';
import type { Transaction, Category, Account } from '@/types/finance';

interface TransactionBulkActionsProps {
  familyGroupId: string;
  onActionsComplete?: () => void;
}

type BulkAction = 'category' | 'tags' | 'delete' | 'copy' | 'archive' | 'export';

export function TransactionBulkActions({
  familyGroupId,
  onActionsComplete,
}: TransactionBulkActionsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentAction, setCurrentAction] = useState<BulkAction | null>(null);
  const [actionValue, setActionValue] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>(
    format(new Date(), 'yyyy-MM')
  );

  // Fetch transactions
  const { data: transactions = [], refetch } = useQuery({
    queryKey: ['transactions', familyGroupId, filterMonth],
    queryFn: async () => {
      const [year, month] = filterMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-31`;

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('family_group_id', familyGroupId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as Transaction[];
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', familyGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('family_group_id', familyGroupId);

      if (error) throw error;
      return data as Category[];
    },
  });

  // Fetch accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', familyGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('family_group_id', familyGroupId);

      if (error) throw error;
      return data as Account[];
    },
  });

  // Mutations
  const updateCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const selectedArray = Array.from(selectedIds);
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: categoryId })
        .in('id', selectedArray);

      if (error) throw error;
      return { count: selectedArray.length };
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      refetch();
      onActionsComplete?.();
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: async (tags: string[]) => {
      const selectedArray = Array.from(selectedIds);
      const updates = transactions
        .filter(t => selectedArray.includes(t.id))
        .map(t => ({
          id: t.id,
          tags: Array.from(new Set([...(t.tags || []), ...tags])),
        }));

      for (const update of updates) {
        const { error } = await supabase
          .from('transactions')
          .update({ tags: update.tags })
          .eq('id', update.id);

        if (error) throw error;
      }

      return { count: updates.length };
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      refetch();
      onActionsComplete?.();
    },
  });

  const deleteTransactionsMutation = useMutation({
    mutationFn: async () => {
      const selectedArray = Array.from(selectedIds);
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', selectedArray);

      if (error) throw error;
      return { count: selectedArray.length };
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      refetch();
      onActionsComplete?.();
    },
  });

  const copyTransactionsMutation = useMutation({
    mutationFn: async () => {
      const selectedArray = Array.from(selectedIds);
      const selectedTxs = transactions.filter(t => selectedArray.includes(t.id));
      const tomorrow = format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

      const copies = selectedTxs.map(tx => ({
        ...tx,
        id: undefined,
        date: tomorrow,
        created_at: undefined,
      }));

      const { error } = await supabase
        .from('transactions')
        .insert(copies as any);

      if (error) throw error;
      return { count: copies.length };
    },
    onSuccess: () => {
      refetch();
      onActionsComplete?.();
    },
  });

  // Handlers
  const toggleAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)));
    }
  };

  const toggleRow = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const executeAction = async (action: BulkAction, value?: string) => {
    switch (action) {
      case 'category':
        if (value) {
          await updateCategoryMutation.mutateAsync(value);
        }
        break;
      case 'tags':
        if (value) {
          const tags = value.split(',').map(t => t.trim()).filter(Boolean);
          await updateTagsMutation.mutateAsync(tags);
        }
        break;
      case 'delete':
        await deleteTransactionsMutation.mutateAsync();
        break;
      case 'copy':
        await copyTransactionsMutation.mutateAsync();
        break;
      case 'export':
        exportAsCSV();
        break;
    }

    setCurrentAction(null);
    setActionValue('');
    setShowConfirmDialog(false);
  };

  const exportAsCSV = () => {
    const selectedArray = Array.from(selectedIds);
    const selectedTxs = transactions.filter(t => selectedArray.includes(t.id));

    const headers = ['Data', 'Descrizione', 'Importo', 'Categoria', 'Tag', 'Note'];
    const rows = selectedTxs.map(tx => [
      tx.date,
      tx.notes || '',
      tx.amount,
      categories.find(c => c.id === tx.category_id)?.name || '',
      tx.tags?.join(';') || '',
      tx.notes || '',
    ]);

    const csv =
      headers.join(',') +
      '\n' +
      rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transazioni-${filterMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedTransaction = transactions.find(t => selectedIds.has(t.id));
  const totalAmount = Array.from(selectedIds).reduce((sum, id) => {
    const tx = transactions.find(t => t.id === id);
    return sum + (tx?.amount || 0);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      {selectedIds.size > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-semibold">
                {selectedIds.size} transazioni selezionate
              </div>
              <div className="text-2xl font-bold">€{Math.abs(totalAmount).toFixed(2)}</div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCurrentAction('category');
                  setShowConfirmDialog(true);
                }}
              >
                <Folder className="h-4 w-4 mr-2" />
                Categoria
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCurrentAction('tags');
                  setShowConfirmDialog(true);
                }}
              >
                <Tag className="h-4 w-4 mr-2" />
                Tag
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCurrentAction('copy');
                  executeAction('copy');
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copia
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCurrentAction('export');
                  executeAction('export');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Esporta
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setCurrentAction('delete');
                  setShowConfirmDialog(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Elimina
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => {
              const date = new Date();
              date.setMonth(date.getMonth() - i);
              const value = format(date, 'yyyy-MM');
              return (
                <SelectItem key={value} value={value}>
                  {format(date, 'MMMM yyyy', { locale: it })}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            onClick={() => setSelectedIds(new Set())}
          >
            Deseleziona tutto
          </Button>
        )}
      </div>

      {/* Transactions Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === transactions.length && transactions.length > 0}
                  indeterminate={selectedIds.size > 0 && selectedIds.size < transactions.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="text-right">Importo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  Nessuna transazione per questo mese
                </TableCell>
              </TableRow>
            ) : (
              transactions.map(tx => (
                <TableRow
                  key={tx.id}
                  className={selectedIds.has(tx.id) ? 'bg-blue-50' : ''}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(tx.id)}
                      onCheckedChange={() => toggleRow(tx.id)}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(parseISO(tx.date), 'd MMM', { locale: it })}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">{tx.notes}</TableCell>
                  <TableCell className="text-right font-semibold">
                    <span className={tx.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                      {tx.amount > 0 ? '+' : ''}€{tx.amount.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {categories.find(c => c.id === tx.category_id)?.name || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tx.tags?.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {(tx.tags?.length || 0) > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{tx.tags!.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toggleRow(tx.id)}>
                          {selectedIds.has(tx.id) ? 'Deseleziona' : 'Seleziona'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => deleteTransactionsMutation.mutateAsync()}
                        >
                          Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Action Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentAction === 'category' && 'Assegna categoria'}
              {currentAction === 'tags' && 'Aggiungi tag'}
              {currentAction === 'delete' && 'Elimina transazioni'}
            </DialogTitle>
          </DialogHeader>

          {currentAction === 'category' && (
            <div className="space-y-4">
              <Select value={actionValue} onValueChange={setActionValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Scegli categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {currentAction === 'tags' && (
            <div className="space-y-4">
              <Input
                placeholder="tag1, tag2, tag3..."
                value={actionValue}
                onChange={e => setActionValue(e.target.value)}
              />
            </div>
          )}

          {currentAction === 'delete' && (
            <Alert variant="destructive">
              <AlertDescription>
                Eliminerai {selectedIds.size} transazioni. Questa azione non è reversibile.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Annulla
            </Button>
            <Button
              variant={currentAction === 'delete' ? 'destructive' : 'default'}
              onClick={() =>
                executeAction(currentAction!, actionValue)
              }
              disabled={
                currentAction !== 'delete' &&
                !actionValue
              }
            >
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
