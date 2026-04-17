// Author: Emanuele Motta
// Date: 16-Apr-2026
// Guided onboarding component with real-world family finance examples
// Walks users through setup: family group, accounts, categories, budgets, goals

'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ChevronRight, Check, Home, Users, Tag, Wallet, Target, Bell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

export function OnboardingGuide() {
  const [currentStep, setCurrentStep] = useState(0);
  const [familyName, setFamilyName] = useState('');
  const [accounts, setAccounts] = useState<{ name: string; balance: number }[]>([
    { name: 'Conto Corrente', balance: 0 },
  ]);
  const [categories, setCategories] = useState<string[]>([]);
  const [budgets, setBudgets] = useState<{ category: string; amount: number }[]>([]);
  const [goals, setGoals] = useState<{ name: string; target: number }[]>([]);
  const [preferences, setPreferences] = useState({
    currency: 'EUR',
    language: 'it',
    notifications: true,
  });

  const steps: OnboardingStep[] = [
    {
      id: 'family',
      title: 'Crea il tuo Gruppo Famiglia',
      description: 'Inizia configurando il tuo gruppo familiare',
      icon: <Users className="h-6 w-6" />,
      completed: !!familyName,
    },
    {
      id: 'accounts',
      title: 'Aggiungi i Tuoi Conti',
      description: 'Conto corrente, conto risparmio, carta di credito...',
      icon: <Wallet className="h-6 w-6" />,
      completed: accounts.length > 0,
    },
    {
      id: 'categories',
      title: 'Configura le Categorie',
      description: 'Spese, entrate, trasferimenti...',
      icon: <Tag className="h-6 w-6" />,
      completed: categories.length > 0,
    },
    {
      id: 'budgets',
      title: 'Imposta i Budget Mensili',
      description: 'Limiti di spesa per categoria',
      icon: <Wallet className="h-6 w-6" />,
      completed: budgets.length > 0,
    },
    {
      id: 'goals',
      title: 'Definisci i Tuoi Obiettivi',
      description: 'Vacanza, casa, investimenti...',
      icon: <Target className="h-6 w-6" />,
      completed: goals.length > 0,
    },
    {
      id: 'notifications',
      title: 'Attiva le Notifiche',
      description: 'Ricevi avvisi per budget e transazioni',
      icon: <Bell className="h-6 w-6" />,
      completed: preferences.notifications,
    },
  ];

  const createFamilyMutation = useMutation({
    mutationFn: async () => {
      // In production, this would call the API to create family group
      console.log('Creating family group:', {
        familyName,
        accounts,
        categories,
        budgets,
        goals,
      });
    },
  });

  const renderStepContent = () => {
    const step = steps[currentStep];

    switch (step.id) {
      case 'family':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Nome del Gruppo Famiglia
              </label>
              <Input
                placeholder="Es: Famiglia Rossi"
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                className="text-lg"
              />
              <p className="text-xs text-gray-500 mt-2">
                Questo nome sarà visibile a tutti i familiari
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-semibold">💡 Esempio reale:</p>
              <p className="text-sm text-gray-700">
                La famiglia Rossi ha creato un gruppo condiviso per tracciare le spese comuni della casa.
              </p>
            </div>
          </div>
        );

      case 'accounts':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">I Tuoi Conti</label>
              <div className="space-y-2 mb-3">
                {accounts.map((acc, idx) => (
                  <Card key={idx} className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{acc.name}</p>
                      <p className="text-sm text-gray-600">€{acc.balance.toFixed(2)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAccounts(accounts.filter((_, i) => i !== idx))}
                    >
                      Rimuovi
                    </Button>
                  </Card>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  id="account-name"
                  placeholder="Nome conto (es: Conto Corrente)"
                />
                <Input
                  id="account-balance"
                  type="number"
                  placeholder="Saldo iniziale"
                  step="0.01"
                />
                <Button
                  onClick={() => {
                    const name = (document.getElementById('account-name') as HTMLInputElement).value;
                    const balance = parseFloat(
                      (document.getElementById('account-balance') as HTMLInputElement).value || '0'
                    );
                    if (name) {
                      setAccounts([...accounts, { name, balance }]);
                      (document.getElementById('account-name') as HTMLInputElement).value = '';
                      (document.getElementById('account-balance') as HTMLInputElement).value = '';
                    }
                  }}
                >
                  Aggiungi
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
              <p className="text-sm font-semibold">💡 Consiglio:</p>
              <p className="text-sm text-gray-700">
                Aggiungi un conto per ogni risorsa finanziaria: conto corrente, conto risparmio, carte di credito.
              </p>
            </div>
          </div>
        );

      case 'categories':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Categorie di Spesa Suggerite
              </label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  'Alimentare',
                  'Trasporti',
                  'Utilities',
                  'Sanità',
                  'Intrattenimento',
                  'Vestiario',
                  'Educazione',
                  'Casa',
                ].map(cat => (
                  <button
                    key={cat}
                    onClick={() =>
                      setCategories(
                        categories.includes(cat)
                          ? categories.filter(c => c !== cat)
                          : [...categories, cat]
                      )
                    }
                    className={`p-2 rounded-lg text-sm font-medium transition ${
                      categories.includes(cat)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
              <p className="text-sm font-semibold">💡 Famiglia Rossi:</p>
              <p className="text-sm text-gray-700">
                Ha organizzato le categorie per tracciare i costi fissi (Utilities, Affitto) separatamente dalle spese variabili (Alimentare, Svago).
              </p>
            </div>
          </div>
        );

      case 'budgets':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Budget Mensili</label>
              <div className="space-y-2 mb-3">
                {budgets.map((b, idx) => (
                  <Card key={idx} className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{b.category}</p>
                      <p className="text-sm text-gray-600">€{b.amount.toFixed(2)}/mese</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setBudgets(budgets.filter((_, i) => i !== idx))}
                    >
                      Rimuovi
                    </Button>
                  </Card>
                ))}
              </div>

              <div className="flex gap-2">
                <Select>
                  <SelectTrigger id="budget-category">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="budget-amount"
                  type="number"
                  placeholder="Importo mensile"
                  step="10"
                />
                <Button
                  onClick={() => {
                    const category = (document.getElementById('budget-category') as any)?.value;
                    const amount = parseFloat(
                      (document.getElementById('budget-amount') as HTMLInputElement).value
                    );
                    if (category && amount > 0) {
                      setBudgets([...budgets, { category, amount }]);
                      (document.getElementById('budget-amount') as HTMLInputElement).value = '';
                    }
                  }}
                >
                  Aggiungi
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
              <p className="text-sm font-semibold">📊 Budget Famiglia Rossi:</p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Alimentare: €500/mese</li>
                <li>• Trasporti: €300/mese</li>
                <li>• Utilities: €150/mese</li>
                <li>• Svago: €200/mese</li>
              </ul>
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Obiettivi Finanziari</label>
              <div className="space-y-2 mb-3">
                {goals.map((g, idx) => (
                  <Card key={idx} className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{g.name}</p>
                      <p className="text-sm text-gray-600">€{g.target.toFixed(2)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setGoals(goals.filter((_, i) => i !== idx))}
                    >
                      Rimuovi
                    </Button>
                  </Card>
                ))}
              </div>

              <div className="flex gap-2 flex-col">
                <Input
                  id="goal-name"
                  placeholder="Nome obiettivo (es: Vacanza estiva)"
                />
                <div className="flex gap-2">
                  <Input
                    id="goal-amount"
                    type="number"
                    placeholder="Importo target"
                    step="100"
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      const name = (document.getElementById('goal-name') as HTMLInputElement).value;
                      const target = parseFloat(
                        (document.getElementById('goal-amount') as HTMLInputElement).value
                      );
                      if (name && target > 0) {
                        setGoals([...goals, { name, target }]);
                        (document.getElementById('goal-name') as HTMLInputElement).value = '';
                        (document.getElementById('goal-amount') as HTMLInputElement).value = '';
                      }
                    }}
                  >
                    Aggiungi
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
              <p className="text-sm font-semibold">🎯 Obiettivi Famiglia Rossi:</p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Vacanza Agosto: €2,000</li>
                <li>• Ristrutturazione bagno: €5,000</li>
                <li>• Fondo emergenza: €3,000</li>
              </ul>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-3">Notifiche</label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.notifications}
                    onChange={e =>
                      setPreferences({ ...preferences, notifications: e.target.checked })
                    }
                  />
                  <span>Attiva notifiche push</span>
                </label>

                {preferences.notifications && (
                  <div className="ml-7 space-y-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span>Budget quasi esaurito</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span>Ricorrenti prossime</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span>Transazioni anomale</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span>Obiettivi raggiunti</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
              <p className="text-sm font-semibold">✨ Tutto pronto!</p>
              <p className="text-sm text-gray-700">
                Il tuo gruppo famiglia è configurato. Puoi iniziare ad aggiungere transazioni e familiari.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isStepComplete = steps[currentStep].completed;

  return (
    <Dialog open={true}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {steps[currentStep].icon}
            <div>
              <DialogTitle>{steps[currentStep].title}</DialogTitle>
              <DialogDescription>{steps[currentStep].description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex gap-2 py-2">
          {steps.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => idx <= currentStep && setCurrentStep(idx)}
              className={`flex-1 h-2 rounded-full transition ${
                idx < currentStep
                  ? 'bg-green-500'
                  : idx === currentStep
                    ? 'bg-blue-500'
                    : 'bg-gray-200'
              }`}
              title={s.title}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="py-4">{renderStepContent()}</div>

        <DialogFooter>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="flex-1"
            >
              Indietro
            </Button>
            {currentStep === steps.length - 1 ? (
              <Button
                onClick={() => createFamilyMutation.mutateAsync()}
                disabled={!isStepComplete}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                Completa Onboarding
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                disabled={!isStepComplete}
                className="flex-1"
              >
                Continua
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
