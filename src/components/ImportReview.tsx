// Author: Emanuele Motta
// Date: 16-Apr-2026
// Component for inline editing and review of imported transactions before confirmation
// Supports category/account/tags editing, duplicate detection, and bulk operations

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { AlertCircle, CheckCircle2, XCircle, Edit2, Save, X, Trash2, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { supabase } from '@/integrations/supabase/client';
import type { 
  ImportPendingTransaction, 
  Category, 
  Account 
} from '@/types/finance';

interface ImportReviewProps {
  importBatchId: string;
  familyGroupId: string;
  onImportComplete?: () => void;
}

interface EditingState {
  [key: string]: Partial<ImportPendingTransaction>;
}

export function ImportReview({ 
  importBatchId, 
  familyGroupId,
  onImportComplete 
}: ImportReviewProps) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<EditingState>({});
  const [showBulkActionDialog, setShowBulkActionDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState<'category' | 'tags' | 'delete' | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'duplicate_warning'>('all');

  // Fetch pending transactions
  const { data: pendingTransactions = [], isLoading } = useQuery({
    queryKey: ['import_pending', importBatchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_pending_transactions')
        .select('*')
        .eq('import_batch_id', importBatchId)
        .order('row_index', { ascending: true });

      if (error) throw error;
      return data as ImportPendingTransaction[];
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', familyGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('family_group_id', familyGroupId)
        .order('name');

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

  // Update transaction mutation
  const updateTransactionMutation = useMutation({
    mutationFn: async (payload: { 
      id: string; 
      updates: Partial<ImportPendingTransaction> 
    }) => {
      const { data, error } = await supabase
        .from('import_pending_transactions')
        .update(payload.updates)
        .eq('id', payload.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Confirm all reviewed transactions
  const confirmAllMutation = useMutation({
    mutationFn: async () => {
      const reviewedIds = pendingTransactions
        .filter(t => t.status !== 'pending')
        .map(t => t.id);

      if (reviewedIds.length === 0) throw new Error('Nessuna transazione da confermare');

      const { error } = await supabase
        .from('import_pending_transactions')
        .update({ status: 'confirmed' })
        .in('id', reviewedIds);

      if (error) throw error;
    },
    onSuccess: () => {
      onImportComplete?.();
    },
  });

  // Delete transaction
  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('import_pending_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
  });

  // Bulk operations
  const applyBulkAction = useCallback(async (action: 'category' | 'tags' | 'delete', value?: any) => {
    const selectedIds = Array.from(selectedRows);
    
    if (action === 'delete') {
      const { error } = await supabase
        .from('import_pending_transactions')
        .delete()
        .in('id', selectedIds);

      if (!error) {
        setSelectedRows(new Set());
        setShowBulkActionDialog(false);
      }
    } else if (action === 'category') {
      const { error } = await supabase
        .from('import_pending_transactions')
        .update({ category_id: value, status: 'manual_edit' })
        .in('id', selectedIds);

      if (!error) {
        setSelectedRows(new Set());
        setShowBulkActionDialog(false);
      }
    } else if (action === 'tags') {
      const { error } = await supabase
        .from('import_pending_transactions')
        .update({ tags: value || [], status: 'manual_edit' })
        .in('id', selectedIds);

      if (!error) {
        setSelectedRows(new Set());
        setShowBulkActionDialog(false);
      }
    }
  }, [selectedRows]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return pendingTransactions.filter(t => {
      if (filterStatus === 'all') return true;
      return t.status === filterStatus;
    });
  }, [pendingTransactions, filterStatus]);

  const handleEdit = (transaction: ImportPendingTransaction) => {
    setEditingId(transaction.id);
    setEditingState(prev => ({
      ...prev,
      [transaction.id]: { ...transaction }
    }));
  };

  const handleSave = async (id: string) => {
    const edits = editingState[id];
    if (!edits) return;

    await updateTransactionMutation.mutateAsync({
      id,
      updates: { 
        ...edits, 
        status: edits.status || 'manual_edit' 
      }
    });

    setEditingId(null);
    setEditingState(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingState(prev => {
      const next = { ...prev };
      delete next[editingId!];
      return next;
    });
  };

  const toggleRowSelection = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedRows.size === filteredTransactions.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const getStatusBadge = (status: ImportPendingTransaction['status']) => {
    const variants: Record<string, { label: string; color: string }> = {
      pending: { label: 'In sospeso', color: 'bg-yellow-100 text-yellow-800' },
      matched: { label: 'Abbinato', color: 'bg-blue-100 text-blue-800' },
      duplicate_warning: { label: '⚠️ Possibile duplicato', color: 'bg-orange-100 text-orange-800' },
      manual_edit: { label: 'Modificato', color: 'bg-purple-100 text-purple-800' },
      confirmed: { label: 'Confermato', color: 'bg-green-100 text-green-800' },
    };
    const variant = variants[status] || variants.pending;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Non assegnato';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Sconosciuto';
  };

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return 'Non assegnato';
    const account = accounts.find(a => a.id === accountId);
    return account?.name || 'Sconosciuto';
  };

  if (isLoading) {
    return <div className="flex justify-center py-8">Caricamento...</div>;
  }

  const stats = {
    total: pendingTransactions.length,
    pending: pendingTransactions.filter(t => t.status === 'pending').length,
    warnings: pendingTransactions.filter(t => t.status === 'duplicate_warning').length,
    reviewed: pendingTransactions.filter(t => t.status !== 'pending').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <Card className="p-4">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-gray-600">Totale</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">In sospeso</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">{stats.warnings}</div>
            <div className="text-sm text-gray-600">Avvisi</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{stats.reviewed}</div>
            <div className="text-sm text-gray-600">Revisionate</div>
          </div>
        </div>
      </Card>

      {/* Filter & Bulk Actions */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            <SelectItem value="pending">In sospeso</SelectItem>
            <SelectItem value="duplicate_warning">Avvisi duplicati</SelectItem>
          </SelectContent>
        </Select>

        {selectedRows.size > 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBulkAction('category');
                setShowBulkActionDialog(true);
              }}
            >
              Categoria ({selectedRows.size})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBulkAction('tags');
                setShowBulkActionDialog(true);
              }}
            >
              Tag ({selectedRows.size})
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setBulkAction('delete');
                setShowBulkActionDialog(true);
              }}
            >
              Elimina ({selectedRows.size})
            </Button>
          </div>
        )}
      </div>

      {/* Warnings Alert */}
      {stats.warnings > 0 && (
        <Alert className="bg-orange-50 border-orange-200">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertTitle>Possibili duplicati rilevati</AlertTitle>
          <AlertDescription>
            {stats.warnings} transazione{stats.warnings !== 1 ? 'i' : ''} potrebbero essere duplicati. Controlla e conferma.
          </AlertDescription>
        </Alert>
      )}

      {/* Transactions Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedRows.size === filteredTransactions.length && filteredTransactions.length > 0}
                  indeterminate={selectedRows.size > 0 && selectedRows.size < filteredTransactions.length}
                  onCheckedChange={toggleAllSelection}
                />
              </TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="text-right">Importo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="w-24">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((transaction) => {
              const isEditing = editingId === transaction.id;
              const edits = editingState[transaction.id] || transaction;

              return (
                <TableRow key={transaction.id} className={selectedRows.has(transaction.id) ? 'bg-blue-50' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.has(transaction.id)}
                      onCheckedChange={() => toggleRowSelection(transaction.id)}
                    />
                  </TableCell>
                  <TableCell>{format(parseISO(transaction.date), 'd MMM yyyy', { locale: it })}</TableCell>
                  <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
                  <TableCell className="text-right font-semibold">
                    €{Math.abs(transaction.amount).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Select
                        value={edits.category_id || ''}
                        onValueChange={(value) =>
                          setEditingState(prev => ({
                            ...prev,
                            [transaction.id]: { ...edits, category_id: value || null }
                          }))
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Non assegnato</SelectItem>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      getCategoryName(edits.category_id)
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Select
                        value={edits.account_id || ''}
                        onValueChange={(value) =>
                          setEditingState(prev => ({
                            ...prev,
                            [transaction.id]: { ...edits, account_id: value || null }
                          }))
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      getAccountName(edits.account_id)
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {isEditing ? (
                      <Input
                        type="text"
                        placeholder="tag1, tag2..."
                        value={(edits.tags || []).join(', ')}
                        onChange={(e) =>
                          setEditingState(prev => ({
                            ...prev,
                            [transaction.id]: { 
                              ...edits, 
                              tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                            }
                          }))
                        }
                        className="h-8"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(edits.tags || []).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSave(transaction.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancel}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(transaction)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteTransactionMutation.mutateAsync(transaction.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Confirm Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline">Annulla</Button>
        <Button 
          onClick={() => confirmAllMutation.mutateAsync()}
          disabled={stats.pending > 0 || confirmAllMutation.isPending}
        >
          {confirmAllMutation.isPending ? 'Conferma...' : 'Conferma importazione'}
        </Button>
      </div>

      {/* Bulk Action Dialog */}
      <Dialog open={showBulkActionDialog} onOpenChange={setShowBulkActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'category' && 'Assegna categoria'}
              {bulkAction === 'tags' && 'Aggiungi tag'}
              {bulkAction === 'delete' && 'Elimina transazioni'}
            </DialogTitle>
          </DialogHeader>
          
          {bulkAction === 'category' && (
            <div className="space-y-4">
              <Select onValueChange={(value) => applyBulkAction('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {bulkAction === 'tags' && (
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="tag1, tag2, tag3..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const tags = e.currentTarget.value.split(',').map(t => t.trim()).filter(Boolean);
                    applyBulkAction('tags', tags);
                  }
                }}
              />
            </div>
          )}

          {bulkAction === 'delete' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Confermi?</AlertTitle>
                <AlertDescription>
                  Eliminerai {selectedRows.size} transazioni. Questa azione non è reversibile.
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBulkActionDialog(false)}>
                  Annulla
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => applyBulkAction('delete')}
                >
                  Elimina
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
