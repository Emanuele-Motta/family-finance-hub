import { useFamilyGroup } from '@/hooks/useFamilyGroup';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const { familyGroups } = useFamilyGroup();
  const { user } = useAuth();
  const { toast } = useToast();
  const group = familyGroups[0];
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || '');
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('display_name').eq('user_id', user.id).single();
      setDisplayName(data?.display_name || '');
    };
    fetchProfile();
  }, [user]);

  const copyInviteCode = () => {
    if (group?.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      toast({ title: 'Codice copiato!' });
    }
  };

  const handleProfileSave = async () => {
    if (!user) return;
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('user_id', user.id);
    if (profileError) {
      toast({ title: 'Errore', description: profileError.message, variant: 'destructive' });
      return;
    }

    if (email && email !== user.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email });
      if (emailError) {
        toast({ title: 'Errore', description: emailError.message, variant: 'destructive' });
        return;
      }
    }
    toast({ title: 'Profilo aggiornato' });
  };

  const handlePasswordChange = async () => {
    if (!user || !user.email) return;
    if (newPassword.length < 8) {
      toast({ title: 'Password troppo corta', description: 'Minimo 8 caratteri', variant: 'destructive' });
      return;
    }
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verifyError) {
      toast({ title: 'Password attuale non valida', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    toast({ title: 'Password aggiornata con successo' });
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-lg">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Gruppo familiare</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {group ? (
            <>
              <div className="space-y-2">
                <Label>Nome del gruppo</Label>
                <Input value={group.name} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Codice invito</Label>
                <div className="flex gap-2">
                  <Input value={group.invite_code} readOnly className="font-mono" />
                  <Button variant="outline" size="icon" onClick={copyInviteCode}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Condividi questo codice con i membri della tua famiglia per unirli al gruppo.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nessun gruppo configurato</p>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Profilo utente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button onClick={handleProfileSave}>Salva profilo</Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Sicurezza</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Password attuale</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Nuova password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <Button onClick={handlePasswordChange}>Aggiorna password</Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Informazioni</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            FamilyFinance v1.0 — Gestione finanze familiari
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
