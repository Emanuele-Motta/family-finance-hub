import { useFamilyGroup } from '@/hooks/useFamilyGroup';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { familyGroups } = useFamilyGroup();
  const { toast } = useToast();
  const group = familyGroups[0];

  const copyInviteCode = () => {
    if (group?.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      toast({ title: 'Codice copiato!' });
    }
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
