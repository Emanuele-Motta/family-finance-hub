import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import ErrorBoundary from "@/components/ErrorBoundary";

const AppLayout = lazy(() => import("@/components/AppLayout"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const CarExpensesPage = lazy(() => import("@/pages/CarExpensesPage"));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage"));
const BudgetsPage = lazy(() => import("@/pages/BudgetsPage"));
const GoalsPage = lazy(() => import("@/pages/GoalsPage"));
const DebtsPage = lazy(() => import("@/pages/DebtsPage"));
const SubscriptionsPage = lazy(() => import("@/pages/SubscriptionsPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const RulesPage = lazy(() => import("@/pages/RulesPage"));
const AuditPage = lazy(() => import("@/pages/AuditPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

function AppLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(1200px_520px_at_20%_-20%,hsl(var(--primary)/0.08),transparent_60%),hsl(var(--background))]">
      <div className="animate-pulse text-muted-foreground">Caricamento...</div>
    </div>
  );
}

function ProtectedRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { familyGroups, loading: groupLoading } = useFamilyGroup();

  if (authLoading || groupLoading) {
    return <AppLoadingScreen />;
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (familyGroups.length === 0) return <OnboardingPage />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<ErrorBoundary context="Dashboard"><DashboardPage /></ErrorBoundary>} />
        <Route path="/analytics" element={<ErrorBoundary context="Grafici"><AnalyticsPage /></ErrorBoundary>} />
        <Route path="/car-expenses" element={<ErrorBoundary context="Spese Auto"><CarExpensesPage /></ErrorBoundary>} />
        <Route path="/transactions" element={<ErrorBoundary context="Transazioni"><TransactionsPage /></ErrorBoundary>} />
        <Route path="/budgets" element={<ErrorBoundary context="Budget"><BudgetsPage /></ErrorBoundary>} />
        <Route path="/goals" element={<ErrorBoundary context="Obiettivi"><GoalsPage /></ErrorBoundary>} />
        <Route path="/debts" element={<ErrorBoundary context="Debiti"><DebtsPage /></ErrorBoundary>} />
        <Route path="/subscriptions" element={<ErrorBoundary context="Abbonamenti"><SubscriptionsPage /></ErrorBoundary>} />
        <Route path="/chat" element={<ErrorBoundary context="Chat"><ChatPage /></ErrorBoundary>} />
        <Route path="/rules" element={<ErrorBoundary context="Regole"><RulesPage /></ErrorBoundary>} />
        <Route path="/audit" element={<ErrorBoundary context="Storico"><AuditPage /></ErrorBoundary>} />
        <Route path="/settings" element={<ErrorBoundary context="Impostazioni"><SettingsPage /></ErrorBoundary>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function AuthGuard() {
  const { user, loading } = useAuth();
  if (loading) return <AppLoadingScreen />;
  if (user) return <Navigate to="/" replace />;
  return <AuthPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<AppLoadingScreen />}>
            <Routes>
              <Route path="/auth" element={<AuthGuard />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
