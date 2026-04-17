import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Wallet, Mail, Lock, User, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegPasswordConfirm, setShowRegPasswordConfirm] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regName, setRegName] = useState('');

  const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[!@#$%^&*]/.test(pwd)) score++;

    if (score <= 1) return { score, label: 'Debole', color: 'text-rose-600' };
    if (score <= 2) return { score, label: 'Medio', color: 'text-amber-600' };
    if (score <= 3) return { score, label: 'Buono', color: 'text-blue-600' };
    return { score, label: 'Forte', color: 'text-emerald-600' };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(loginEmail, loginPassword);
      navigate('/');
    } catch (err: any) {
      toast({ title: 'Errore di accesso', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regPasswordConfirm) {
      toast({ title: 'Password non corrispondenti', description: 'Le due password inserite non coincidono.', variant: 'destructive' });
      return;
    }
    if (regPassword.length < 6) {
      toast({ title: 'Password troppo corta', description: 'La password deve essere almeno 6 caratteri.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await signUp(regEmail, regPassword, regName);
      toast({ title: 'Registrazione completata', description: 'Controlla la tua email per confermare.' });
    } catch (err: any) {
      toast({ title: 'Errore di registrazione', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(1100px_520px_at_15%_-20%,hsl(var(--primary)/0.08),transparent_60%),hsl(var(--background))] px-4 py-8 sm:p-4">
      <Card className="w-full max-w-md animate-fade-in border-border/50 shadow-lg">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
            <Wallet className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">FamilyFinance</CardTitle>
            <CardDescription className="text-sm mt-2">Gestisci le finanze della tua famiglia in modo semplice e trasparente</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
              <TabsTrigger value="login" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline">Accedi</span>
              </TabsTrigger>
              <TabsTrigger value="register" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Registrati</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                  <Label htmlFor="login-email" className="text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      id="login-email" 
                      type="email" 
                      required 
                      value={loginEmail} 
                      onChange={(e) => setLoginEmail(e.target.value)} 
                      placeholder="nome@email.com"
                      className="pl-10 border-border/50 hover:border-primary/30 focus:border-primary/50 transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
                  <Label htmlFor="login-password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      id="login-password" 
                      type={showLoginPassword ? 'text' : 'password'} 
                      required 
                      value={loginPassword} 
                      onChange={(e) => setLoginPassword(e.target.value)} 
                      placeholder="••••••••"
                      className="pl-10 pr-10 border-border/50 hover:border-primary/30 focus:border-primary/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full mt-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200 transform hover:scale-105 font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                      Accesso in corso...
                    </span>
                  ) : (
                    'Accedi'
                  )}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 mt-4">
                <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                  <Label htmlFor="reg-name" className="text-sm font-medium">Nome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      id="reg-name" 
                      required 
                      value={regName} 
                      onChange={(e) => setRegName(e.target.value)} 
                      placeholder="Il tuo nome completo"
                      className="pl-10 border-border/50 hover:border-primary/30 focus:border-primary/50 transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
                  <Label htmlFor="reg-email" className="text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      id="reg-email" 
                      type="email" 
                      required 
                      value={regEmail} 
                      onChange={(e) => setRegEmail(e.target.value)} 
                      placeholder="nome@email.com"
                      className="pl-10 border-border/50 hover:border-primary/30 focus:border-primary/50 transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                  <Label htmlFor="reg-password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      id="reg-password" 
                      type={showRegPassword ? 'text' : 'password'} 
                      required 
                      minLength={6} 
                      value={regPassword} 
                      onChange={(e) => setRegPassword(e.target.value)} 
                      placeholder="Min. 6 caratteri"
                      className="pl-10 pr-10 border-border/50 hover:border-primary/30 focus:border-primary/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {regPassword && (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-muted/30">
                      <CheckCircle2 className={cn('w-3.5 h-3.5', getPasswordStrength(regPassword).color)} />
                      <span className={cn('text-xs font-medium', getPasswordStrength(regPassword).color)}>
                        Forza: {getPasswordStrength(regPassword).label}
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
                  <Label htmlFor="reg-password-confirm" className="text-sm font-medium">Conferma Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      id="reg-password-confirm" 
                      type={showRegPasswordConfirm ? 'text' : 'password'} 
                      required 
                      minLength={6}
                      value={regPasswordConfirm} 
                      onChange={(e) => setRegPasswordConfirm(e.target.value)} 
                      placeholder="Ripeti la password"
                      className={cn(
                        'pl-10 pr-10 border-border/50 hover:border-primary/30 focus:border-primary/50 transition-colors',
                        regPasswordConfirm && regPassword !== regPasswordConfirm && 'border-rose-500/50 focus:border-rose-500/70'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPasswordConfirm(!showRegPasswordConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showRegPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {regPasswordConfirm && regPassword !== regPasswordConfirm && (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-rose-500/10">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span className="text-xs font-medium text-rose-600">
                        Le password non coincidono
                      </span>
                    </div>
                  )}
                  {regPasswordConfirm && regPassword === regPasswordConfirm && (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-emerald-500/10">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-600">
                        Password corrette
                      </span>
                    </div>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className="w-full mt-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200 transform hover:scale-105 font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  disabled={loading || !regPassword || !regPasswordConfirm || regPassword !== regPasswordConfirm || regPassword.length < 6}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                      Registrazione in corso...
                    </span>
                  ) : (
                    'Registrati'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
