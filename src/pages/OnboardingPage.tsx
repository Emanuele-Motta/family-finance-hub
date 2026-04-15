import { useState } from 'react';
import { useFamilyGroup } from '@/hooks/useFamilyGroup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, LogIn } from 'lucide-react';

export default function OnboardingPage() {
  const { createGroup, joinGroup } = useFamilyGroup();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createGroup(groupName);
      toast({ title: 'Gruppo creato!', description: 'Il tuo gruppo familiare è pronto.' });
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await joinGroup(inviteCode);
      toast({ title: 'Unito al gruppo!', description: 'Sei entrato nel gruppo familiare.' });
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
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
    </div>
  );
}
