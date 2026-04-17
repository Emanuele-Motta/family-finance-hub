// Author: Emanuele Motta
// Date: 16-Apr-2026
// Family collaboration component: approvals, comments, settlements, who paid whom
// Enables inter-family reimbursements and transaction notes

'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Send, CheckCircle2, XCircle, MessageSquare, Handshake } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

import { supabase } from '@/integrations/supabase/client';
import type {
  Transaction,
  TransactionComment,
  TransactionApproval,
  Profile,
  FamilyMember,
} from '@/types/finance';

interface TransactionCollaborationProps {
  transactionId: string;
  familyGroupId: string;
  transaction: Transaction;
  currentUserId: string;
}

export function TransactionCollaboration({
  transactionId,
  familyGroupId,
  transaction,
  currentUserId,
}: TransactionCollaborationProps) {
  const [newComment, setNewComment] = useState('');
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementUserId, setSettlementUserId] = useState('');

  // Fetch comments
  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['transaction:comments', transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_comments')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data as unknown as TransactionComment[]) || [];
    },
  });

  // Fetch approvals
  const { data: approvals = [] } = useQuery({
    queryKey: ['transaction:approvals', transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_approvals')
        .select('*')
        .eq('transaction_id', transactionId);

      if (error) throw error;
      return (data as TransactionApproval[]) || [];
    },
  });

  // Fetch family members
  const { data: familyMembers = [] } = useQuery({
    queryKey: ['family:members', familyGroupId],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_group_id', familyGroupId);

      if (error) throw error;

      const userIds = (members || []).map((m) => m.user_id);
      if (userIds.length === 0) return [] as Array<{ user_id: string; profiles: { display_name: string | null; avatar_url: string | null } | null }>;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      return (members || []).map((m) => ({
        ...m,
        profiles: profiles?.find((p) => p.user_id === m.user_id) || null,
      }));
    },
  });

  // Mutations
  const addCommentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('transaction_comments')
        .insert({
          transaction_id: transactionId,
          family_group_id: familyGroupId,
          user_id: currentUserId,
          content: newComment,
          is_system_comment: false,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment('');
      refetchComments();
    },
  });

  const addSettlementMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('transaction_comments')
        .insert({
          transaction_id: transactionId,
          family_group_id: familyGroupId,
          user_id: currentUserId,
          content: `Rimborso: €${settlementAmount}`,
          is_settlement_comment: true,
          settled_between_user_a: currentUserId,
          settled_between_user_b: settlementUserId,
          settlement_amount: parseFloat(settlementAmount),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setSettlementAmount('');
      setSettlementUserId('');
      setShowSettlementDialog(false);
      refetchComments();
    },
  });

  const approveTransactionMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('transaction_approvals')
        .update({
          status: 'approved',
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
        })
        .eq('transaction_id', transactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      // Refetch approvals
    },
  });

  const rejectTransactionMutation = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase
        .from('transaction_approvals')
        .update({
          status: 'rejected',
          approved_by: currentUserId,
          approval_reason: reason,
        })
        .eq('transaction_id', transactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      // Refetch approvals
    },
  });

  const currentApproval = approvals.find(a => a.status === 'pending');
  const isCurrentUserApprover =
    currentApproval && currentApproval.requested_by !== currentUserId;

  const getMemberName = (userId: string) => {
    const member = familyMembers.find(m => m.user_id === userId);
    return member?.profiles?.display_name || 'Sconosciuto';
  };

  const getMemberAvatar = (userId: string) => {
    const member = familyMembers.find(m => m.user_id === userId);
    return member?.profiles?.avatar_url;
  };

  return (
    <div className="space-y-6">
      {/* Approval Section */}
      {currentApproval && (
        <Card className="p-4 border-blue-200 bg-blue-50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">✅ In attesa di approvazione</h3>
                <p className="text-sm text-gray-600">
                  Soglia: €{currentApproval.approval_threshold.toFixed(2)}
                </p>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>

            {isCurrentUserApprover && (
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => approveTransactionMutation.mutateAsync()}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approva
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => rejectTransactionMutation.mutateAsync('Non approvato')}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rifiuta
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Comments Section */}
      <div className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Commenti ({comments.length})
        </h3>

        {/* Comment List */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">Nessun commento ancora</p>
          ) : (
            comments.map(comment => (
              <Card key={comment.id} className="p-3">
                {comment.is_settlement_comment ? (
                  <div className="flex items-start gap-3">
                    <Handshake className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">
                        {getMemberName(comment.settled_between_user_a || '')} ha pagato{' '}
                        {getMemberName(comment.settled_between_user_b || '')}
                      </div>
                      <div className="text-lg font-bold text-green-600">
                        €{comment.settlement_amount?.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {format(parseISO(comment.created_at), 'd MMM HH:mm', { locale: it })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={getMemberAvatar(comment.user_id) || undefined}
                      />
                      <AvatarFallback>
                        {getMemberName(comment.user_id).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div className="font-semibold text-sm">
                          {getMemberName(comment.user_id)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(parseISO(comment.created_at), 'd MMM HH:mm', {
                            locale: it,
                          })}
                        </div>
                      </div>
                      <p className="text-sm mt-1">{comment.content}</p>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Add Comment */}
        <div className="space-y-2">
          <Textarea
            placeholder="Aggiungi un commento..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            className="min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => addCommentMutation.mutateAsync()}
              disabled={!newComment.trim() || addCommentMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              Commenta
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSettlementDialog(true)}
            >
              <Handshake className="h-4 w-4 mr-2" />
              Rimborso
            </Button>
          </div>
        </div>
      </div>

      {/* Settlement Dialog */}
      <Dialog open={showSettlementDialog} onOpenChange={setShowSettlementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registra rimborso</DialogTitle>
            <DialogDescription>
              Traccia il rimborso tra familiari
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold block mb-2">Chi ha pagato?</label>
              <Select value={settlementUserId} onValueChange={setSettlementUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona familiari" />
                </SelectTrigger>
                <SelectContent>
                  {familyMembers
                    .filter(m => m.user_id !== currentUserId)
                    .map(member => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.profiles?.display_name || 'Sconosciuto'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-semibold block mb-2">Importo rimborso</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">€</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={settlementAmount}
                  onChange={e => setSettlementAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border rounded-md"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSettlementDialog(false)}
            >
              Annulla
            </Button>
            <Button
              onClick={() => addSettlementMutation.mutateAsync()}
              disabled={
                !settlementAmount ||
                !settlementUserId ||
                addSettlementMutation.isPending
              }
            >
              Registra rimborso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
