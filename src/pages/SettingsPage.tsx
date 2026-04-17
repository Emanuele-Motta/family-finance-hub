import { useFamilyGroup } from '@/hooks/useFamilyGroup';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { useCarExpensesSettings } from '@/hooks/useCarExpensesSettings';
import { useTransactions, useCategories, useAccounts } from '@/hooks/useFinanceData';
import { supabase } from '@/integrations/supabase/client';
import { getTransactionRules } from '@/services/rulesService';
import { exportFamilyData, downloadBackupFile, parseBackupFile, getOfflineSnapshot, saveOfflineSnapshot } from '@/services/backupService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Car, Plus, Trash2, Users, UserRound, ShieldCheck, Info, Mail, KeyRound, PencilLine, Check, Download, Upload, Zap, Bell, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';

type CarFormState = {
  brand: string;
  model: string;
  nickname: string;
};

const DEFAULT_ACCOUNT_KEY = 'ff_default_account_id';
const THEME_KEY = 'ff_theme_mode';

export default function SettingsPage() {
  const { familyGroups } = useFamilyGroup();
  const { currentFamilyGroupId } = useAppStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: carSettings, setEnabled, addCar, updateCar, removeCar } = useCarExpensesSettings(currentFamilyGroupId);
  const { transactions } = useTransactions();
  const categories = useCategories();
  const { accounts } = useAccounts();
  const group = familyGroups[0];
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [newCarBrand, setNewCarBrand] = useState('');
  const [newCarModel, setNewCarModel] = useState('');
  const [newCarNickname, setNewCarNickname] = useState('');
  const [editingCars, setEditingCars] = useState<Record<string, CarFormState>>({});
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loadingExport, setLoadingExport] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  });
  const [defaultAccountId, setDefaultAccountId] = useState(() => localStorage.getItem(DEFAULT_ACCOUNT_KEY) || '');

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || '');
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('display_name').eq('user_id', user.id).single();
      setDisplayName(data?.display_name || '');
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    const next: Record<string, CarFormState> = {};
    carSettings.cars.forEach((car) => {
      next[car.id] = {
        brand: car.brand,
        model: car.model,
        nickname: car.nickname || '',
      };
    });
    setEditingCars(next);
  }, [carSettings.cars]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
    localStorage.setItem(THEME_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!defaultAccountId && accounts.length > 0) {
      const primary = accounts.find((account) => account.is_primary)?.id || accounts[0].id;
      setDefaultAccountId(primary);
      localStorage.setItem(DEFAULT_ACCOUNT_KEY, primary);
    }
  }, [accounts, defaultAccountId]);

  const getDisplayName = (brand: string, model: string, nickname: string) => {
    const custom = nickname.trim();
    if (custom) return custom;
    return `${brand.trim()} ${model.trim()}`.trim();
  };

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

  const handleAddCar = () => {
    const brand = newCarBrand.trim();
    const model = newCarModel.trim();
    const nickname = newCarNickname.trim();
    if (!brand) {
      toast({ title: 'Marca obbligatoria', variant: 'destructive' });
      return;
    }

    const nextDisplay = getDisplayName(brand, model, nickname).toLowerCase();
    if (carSettings.cars.some((car) => getDisplayName(car.brand, car.model, car.nickname || '').toLowerCase() === nextDisplay)) {
      toast({ title: 'Auto già presente' });
      return;
    }

    addCar({ brand, model, nickname: nickname || null });
    setNewCarBrand('');
    setNewCarModel('');
    setNewCarNickname('');
    toast({ title: 'Auto aggiunta' });
  };

  const handleUpdateCar = (id: string) => {
    const current = carSettings.cars.find((car) => car.id === id);
    if (!current) return;

    const edited = editingCars[id];
    const nextBrand = edited?.brand.trim() || '';
    const nextModel = edited?.model.trim() || '';
    const nextNickname = edited?.nickname.trim() || '';

    if (!nextBrand) {
      toast({ title: 'Marca obbligatoria', variant: 'destructive' });
      setEditingCars((prev) => ({
        ...prev,
        [id]: { brand: current.brand, model: current.model, nickname: current.nickname || '' },
      }));
      return;
    }

    const duplicate = carSettings.cars.some((car) =>
      car.id !== id &&
      getDisplayName(car.brand, car.model, car.nickname || '').toLowerCase() === getDisplayName(nextBrand, nextModel, nextNickname).toLowerCase()
    );
    if (duplicate) {
      toast({ title: 'Auto già presente' });
      return;
    }

    updateCar(id, {
      brand: nextBrand,
      model: nextModel,
      nickname: nextNickname || null,
    });
    toast({ title: 'Auto aggiornata', description: 'Logo aggiornato automaticamente in base alla marca.' });
  };

  const handleExportData = async () => {
    if (!currentFamilyGroupId) return;
    try {
      setLoadingExport(true);
      const rules = await getTransactionRules(currentFamilyGroupId);
      const backup = await exportFamilyData(currentFamilyGroupId, {
        transactions,
        accounts,
        categories,
        rules,
      });
      downloadBackupFile(backup);
      toast({ title: 'Esportazione completa', description: 'File scaricato con successo.' });
    } catch (error: any) {
      toast({ title: 'Errore esportazione', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingExport(false);
    }
  };

  const handleSaveOfflineSnapshot = async () => {
    if (!currentFamilyGroupId) return;
    try {
      setLoadingExport(true);
      const rules = await getTransactionRules(currentFamilyGroupId);
      const backup = await exportFamilyData(currentFamilyGroupId, {
        transactions,
        accounts,
        categories,
        rules,
      });
      saveOfflineSnapshot(backup);
      toast({ title: 'Snapshot offline salvato', description: 'Dati disponibili per offline.' });
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingExport(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = await parseBackupFile(file);
      const confirmed = window.confirm(`Importare backup di ${backup.transactions.length} transazioni?`);
      if (!confirmed) return;
      toast({ title: 'Backup pronto', description: 'Contatta il supporto per il ripristino completo nel database.' });
    } catch (error: any) {
      toast({ title: 'Errore import', description: error.message, variant: 'destructive' });
    }
  };

  const handleEnableLocalPush = async () => {
    if (!('Notification' in window)) {
      toast({ title: 'Notifiche non supportate su questo browser', variant: 'destructive' });
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      toast({ title: 'Permesso notifiche negato', variant: 'destructive' });
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    registration?.active?.postMessage({
      type: 'SHOW_LOCAL_NOTIFICATION',
      title: 'Notifiche attive',
      body: 'Riceverai promemoria locali e avvisi importanti.',
      tag: 'notifications-enabled',
      url: '/settings',
    });

    toast({ title: 'Notifiche locali abilitate' });
  };

  const handleSavePreferences = () => {
    if (defaultAccountId) {
      localStorage.setItem(DEFAULT_ACCOUNT_KEY, defaultAccountId);
    }
    localStorage.setItem(THEME_KEY, themeMode);
    toast({ title: 'Preferenze salvate' });
  };

  const handleExportSettings = () => {
    const payload = {
      themeMode,
      defaultAccountId,
      notificationsEnabled: Notification.permission === 'granted',
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `impostazioni_familyfinance_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as { themeMode?: 'light' | 'dark'; defaultAccountId?: string };
      if (parsed.themeMode) setThemeMode(parsed.themeMode);
      if (parsed.defaultAccountId) {
        setDefaultAccountId(parsed.defaultAccountId);
        localStorage.setItem(DEFAULT_ACCOUNT_KEY, parsed.defaultAccountId);
      }
      toast({ title: 'Impostazioni importate' });
    } catch (error: any) {
      toast({ title: 'File non valido', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="rounded-2xl border border-border/60 bg-[linear-gradient(120deg,rgba(16,185,129,0.08),rgba(59,130,246,0.08))] p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Impostazioni</p>
        <h2 className="mt-1 text-2xl font-semibold">Configura il tuo spazio famiglia</h2>
        <p className="mt-1 text-sm text-muted-foreground">Gestisci account, sicurezza e sezioni dell'app da un'unica schermata.</p>
      </div>

      <Card className="glass-card border-border/70">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Gruppo familiare
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {group ? (
            <>
              <div className="space-y-2">
                <Label>Nome del gruppo</Label>
                <Input value={group.name} readOnly className="bg-background/60" />
              </div>
              <div className="space-y-2">
                <Label>Codice invito</Label>
                <div className="flex gap-2">
                  <Input value={group.invite_code} readOnly className="font-mono bg-background/60" />
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card border-border/70">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserRound className="w-4 h-4 text-primary" />
              Profilo utente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Il tuo nome" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button onClick={handleProfileSave} className="w-full sm:w-auto">Salva profilo</Button>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/70">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Sicurezza
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Password attuale</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" />Nuova password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <Button onClick={handlePasswordChange} variant="outline" className="w-full sm:w-auto">Aggiorna password</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-border/70">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="w-4 h-4 text-primary" />
            Preferenze app
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Tema</p>
              <p className="text-xs text-muted-foreground">Passa tra modalità chiara e scura</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setThemeMode((current) => current === 'light' ? 'dark' : 'light')} className="gap-2">
              {themeMode === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              {themeMode === 'dark' ? 'Dark' : 'Light'}
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Account predefinito</Label>
            <select
              value={defaultAccountId}
              onChange={(event) => setDefaultAccountId(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button type="button" onClick={handleSavePreferences}>Salva preferenze</Button>
            <Button type="button" variant="outline" onClick={handleExportSettings}>Esporta impostazioni</Button>
            <label>
              <Button asChild type="button" variant="outline" className="w-full cursor-pointer">
                <span>Importa impostazioni</span>
              </Button>
              <input type="file" accept=".json" onChange={handleImportSettings} hidden />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/70">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="w-4 h-4 text-primary" />
            Spese Auto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Mostra sezione Spese Auto</p>
              <p className="text-xs text-muted-foreground">Se disattivata, non appare nel menu laterale.</p>
            </div>
            <Switch checked={carSettings.enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label>Le tue auto</Label>
            <div className="grid gap-2 md:grid-cols-3">
              <Input
                value={newCarBrand}
                onChange={(e) => setNewCarBrand(e.target.value)}
                placeholder="Marca (es. Fiat)"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCar())}
              />
              <Input
                value={newCarModel}
                onChange={(e) => setNewCarModel(e.target.value)}
                placeholder="Modello (es. Panda)"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCar())}
              />
              <Input
                value={newCarNickname}
                onChange={(e) => setNewCarNickname(e.target.value)}
                placeholder="Nome auto (opzionale)"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCar())}
              />
            </div>
            <div>
              <Button type="button" variant="outline" onClick={handleAddCar} className="shrink-0">
                <Plus className="w-4 h-4" />
                <span className="ml-1">Aggiungi auto</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Inserisci almeno la marca: il logo viene associato automaticamente e puoi dare un nome personalizzato all'auto.</p>
            {carSettings.cars.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nessuna auto inserita.</p>
            ) : (
              <div className="space-y-2">
                {carSettings.cars.map((car) => (
                  <div key={car.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative w-8 h-8 rounded-full bg-muted/60 border border-border/60 flex items-center justify-center overflow-hidden shrink-0">
                        <Car className="w-4 h-4 text-muted-foreground" />
                        {car.logoUrl && (
                          <img
                            src={car.logoUrl}
                            alt={getDisplayName(car.brand, car.model, car.nickname || '')}
                            className="absolute inset-0 w-full h-full object-cover bg-background"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      <div className="min-w-0 w-full grid gap-1 md:grid-cols-3">
                        <Input
                          value={editingCars[car.id]?.brand ?? car.brand}
                          onChange={(e) => setEditingCars((prev) => ({
                            ...prev,
                            [car.id]: { ...(prev[car.id] || { brand: car.brand, model: car.model, nickname: car.nickname || '' }), brand: e.target.value },
                          }))}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleUpdateCar(car.id))}
                          className="h-8 text-sm"
                          placeholder="Marca"
                        />
                        <Input
                          value={editingCars[car.id]?.model ?? car.model}
                          onChange={(e) => setEditingCars((prev) => ({
                            ...prev,
                            [car.id]: { ...(prev[car.id] || { brand: car.brand, model: car.model, nickname: car.nickname || '' }), model: e.target.value },
                          }))}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleUpdateCar(car.id))}
                          className="h-8 text-sm"
                          placeholder="Modello"
                        />
                        <Input
                          value={editingCars[car.id]?.nickname ?? (car.nickname || '')}
                          onChange={(e) => setEditingCars((prev) => ({
                            ...prev,
                            [car.id]: { ...(prev[car.id] || { brand: car.brand, model: car.model, nickname: car.nickname || '' }), nickname: e.target.value },
                          }))}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleUpdateCar(car.id))}
                          className="h-8 text-sm"
                          placeholder="Nome auto"
                        />
                        <span className="text-[11px] text-muted-foreground truncate block md:col-span-3 mt-1">
                          Visualizzato come: {getDisplayName(editingCars[car.id]?.brand ?? car.brand, editingCars[car.id]?.model ?? car.model, editingCars[car.id]?.nickname ?? (car.nickname || ''))}
                          {car.logoUrl ? ' · Logo automatico attivo' : ' · Logo non trovato per questa marca'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleUpdateCar(car.id)}
                        title="Salva modifiche auto"
                      >
                        {(editingCars[car.id]?.brand ?? car.brand) !== car.brand || (editingCars[car.id]?.model ?? car.model) !== car.model || (editingCars[car.id]?.nickname ?? (car.nickname || '')) !== (car.nickname || '')
                          ? <Check className="w-4 h-4" />
                          : <PencilLine className="w-4 h-4" />}
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeCar(car.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/70">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Backup e offline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Esporta i tuoi dati, crea snapshot per offline o ripristina da backup.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button onClick={handleExportData} disabled={loadingExport} className="gap-2">
              <Download className="w-4 h-4" />
              {loadingExport ? 'Esportando...' : 'Esporta JSON'}
            </Button>
            <Button onClick={handleSaveOfflineSnapshot} disabled={loadingExport} variant="outline" className="gap-2">
              <Zap className="w-4 h-4" />
              {loadingExport ? 'Salvando...' : 'Snapshot offline'}
            </Button>
            <label>
              <Button asChild variant="outline" className="gap-2 cursor-pointer w-full">
                <span>
                  <Upload className="w-4 h-4" />
                  Importa backup
                </span>
              </Button>
              <input type="file" accept=".json" onChange={handleImportBackup} hidden />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/70">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            Notifiche push locali
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Attiva promemoria locali PWA per quick add e notifiche operative.</p>
          <Button onClick={handleEnableLocalPush} variant="outline" className="gap-2">
            <Bell className="w-4 h-4" />
            Abilita notifiche locali
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/70">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Informazioni
          </CardTitle>
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
