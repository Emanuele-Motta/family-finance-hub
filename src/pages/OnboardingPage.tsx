import { useState } from 'react';
import { useFamilyGroup } from '@/hooks/useFamilyGroup';
import { useAccounts } from '@/hooks/useFinanceData';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users, Plus, LogIn, ArrowRight, Wallet, Target, CreditCard, Sparkles } from 'lucide-react';

type Step = 'group' | 'setup';
type SetupMode = 'import' | 'zero' | null;

export default function OnboardingPage() {
  const { createGroup, joinGroup } = useFamilyGroup();
  const { accounts } = useAccounts();
  const { user } = useAuth();
  const { currentFamilyGroupId } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('group');
  const [setupMode, setSetupMode] = useState<SetupMode>(null);

  // Group form
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // Financial setup form
  const [initialBalance, setInitialBalance] = useState('');
  const [initialSavings, setInitialSavings] = useState('');
  const [initialDebt, setInitialDebt] = useState('');
  const [debtName, setDebtName] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createGroup(groupName);
      toast.success('Gruppo creato!');
      setStep('setup');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await joinGroup(inviteCode);
      toast.success('Unito al gruppo!');
      // When joining, skip setup (group already has data)
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    const defaultAccountId = accounts.find(a => a.is_primary)?.id || accounts[0]?.id;
    if (!user || !currentFamilyGroupId || !defaultAccountId) return;
    setLoading(true);
    try {
      // Add initial balance as income transaction
      if (initialBalance && parseFloat(initialBalance) > 0) {
        await supabase.from('transactions').insert({
          family_group_id: currentFamilyGroupId,
          user_id: user.id,
          created_by_user_id: user.id,
          paid_by_user_id: user.id,
          account_id: defaultAccountId,
          to_account_id: null,
          amount: parseFloat(initialBalance),
          type: 'income' as const,
          date: new Date().toISOString().split('T')[0],
          notes: 'Saldo iniziale',
        });
      }

      // Add initial savings as goal
      if (initialSavings && parseFloat(initialSavings) > 0) {
        await supabase.from('goals').insert({
          family_group_id: currentFamilyGroupId,
          name: 'Risparmi iniziali',
          target_amount: parseFloat(initialSavings) * 2, // Target = double
          current_amount: parseFloat(initialSavings),
        });
      }

      // Add initial debt
      if (initialDebt && parseFloat(initialDebt) > 0) {
        await supabase.from('debts').insert({
          family_group_id: currentFamilyGroupId,
          name: debtName || 'Debito iniziale',
          total_amount: parseFloat(initialDebt),
          remaining_amount: parseFloat(initialDebt),
        });
      }

      toast.success('Setup completato! Benvenuto in FamilyFinance.');
      // Force reload to go to dashboard
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(1200px_540px_at_85%_-18%,hsl(var(--chart-2)/0.08),transparent_58%),hsl(var(--background))] p-3 sm:p-4">
      {step === 'group' ? (
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-2">
              <Users className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">Gruppo Familiare</CardTitle>
            <CardDescription>Crea un nuovo gruppo o unisciti a uno esistente</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create"><Plus className="w-4 h-4 mr-1" />Crea</TabsTrigger>
                <TabsTrigger value="join"><LogIn className="w-4 h-4 mr-1" />Unisciti</TabsTrigger>
              </TabsList>
              <TabsContent value="create">
                <form onSubmit={handleCreate} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nome del gruppo</Label>
                    <Input required value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Es. Famiglia Rossi" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Creazione...' : 'Crea gruppo'}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="join">
                <form onSubmit={handleJoin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Codice invito</Label>
                    <Input required value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Inserisci il codice" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Accesso...' : 'Unisciti'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : setupMode === null ? (
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-2">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">Setup iniziale</CardTitle>
            <CardDescription>Come vuoi iniziare?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              onClick={() => setSetupMode('import')}
              className="w-full p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Importa situazione attuale</p>
                  <p className="text-xs text-muted-foreground">Inserisci saldo, risparmi e debiti</p>
                </div>
                <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </button>
            <button
              onClick={handleSkip}
              className="w-full p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Parti da zero</p>
                  <p className="text-xs text-muted-foreground">Inizia senza dati precedenti</p>
                </div>
                <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-xl font-bold">La tua situazione finanziaria</CardTitle>
            <CardDescription>Inserisci i dati attuali per partire con il contesto giusto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" />Saldo attuale (€)</Label>
              <Input type="number" step="0.01" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} placeholder="Es. 5000" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Target className="w-4 h-4 text-income" />Risparmi attuali (€)</Label>
              <Input type="number" step="0.01" value={initialSavings} onChange={e => setInitialSavings(e.target.value)} placeholder="Es. 10000" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-expense" />Debiti (€)</Label>
              <Input type="number" step="0.01" value={initialDebt} onChange={e => setInitialDebt(e.target.value)} placeholder="Es. 50000" className="h-11" />
              {initialDebt && parseFloat(initialDebt) > 0 && (
                <Input value={debtName} onChange={e => setDebtName(e.target.value)} placeholder="Nome del debito (es. Mutuo casa)" className="h-9 text-sm" />
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleSkip} className="flex-1">Salta</Button>
              <Button onClick={handleSetup} disabled={loading} className="flex-1">
                {loading ? 'Salvataggio...' : 'Completa setup'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
