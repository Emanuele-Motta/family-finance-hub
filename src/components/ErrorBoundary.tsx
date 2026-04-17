/**
 * ErrorBoundary - Component-level error catching with retry logic
 * Author: Emanuele Motta - 17-Apr-2026
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Context label shown in error (e.g. "Dashboard", "Transazioni") */
  context?: string;
  /** Error messages mapped to user-friendly strings */
  errorMessages?: Record<string, string>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

const DEFAULT_ERROR_MESSAGES: Record<string, string> = {
  'Network request failed': 'Errore di rete. Controlla la connessione.',
  'Failed to fetch': 'Impossibile raggiungere il server. Controlla la connessione.',
  'JWT expired': 'Sessione scaduta. Effettua di nuovo il login.',
  'invalid claim': 'Sessione non valida. Effettua di nuovo il login.',
  'PGRST': 'Errore nel database. Riprova tra poco.',
  'permission denied': 'Non hai i permessi per questa operazione.',
  'too many requests': 'Troppe richieste. Attendi qualche secondo.',
};

function friendlyMessage(error: Error, extra?: Record<string, string>): string {
  const messages = { ...DEFAULT_ERROR_MESSAGES, ...extra };
  for (const [key, msg] of Object.entries(messages)) {
    if (error.message.includes(key)) return msg;
  }
  if (import.meta.env.DEV) {
    return error.message;
  }
  return 'Qualcosa è andato storto. Riprova o ricarica la pagina.';
}

export default class ErrorBoundary extends Component<Props, State> {
  private retryTimeouts: ReturnType<typeof setTimeout>[] = [];

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', this.props.context, error, info.componentStack);
    }
  }

  componentWillUnmount() {
    this.retryTimeouts.forEach(clearTimeout);
  }

  handleRetry = () => {
    const { retryCount } = this.state;
    // Exponential backoff: 0ms, 1s, 2s, 4s...
    const delay = retryCount === 0 ? 0 : Math.min(1000 * 2 ** (retryCount - 1), 8000);

    this.setState({ hasError: false, error: null, retryCount: retryCount + 1 });

    if (delay > 0) {
      const t = setTimeout(() => {
        this.setState({ hasError: false, error: null });
      }, delay);
      this.retryTimeouts.push(t);
    }
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children, fallback, context, errorMessages } = this.props;

    if (!hasError) return children;
    if (fallback) return fallback;

    const message = error ? friendlyMessage(error, errorMessages) : 'Errore sconosciuto.';
    const maxRetries = 3;
    const canRetry = retryCount < maxRetries;
    const nextDelay = retryCount === 0 ? null : Math.min(1000 * 2 ** (retryCount - 1), 8000) / 1000;

    return (
      <Card className="border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20">
        <CardContent className="p-5 flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          </div>
          {context && (
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">
              Errore in {context}
            </p>
          )}
          <p className="text-sm text-rose-700 dark:text-rose-300 max-w-xs">{message}</p>
          {canRetry ? (
            <Button
              size="sm"
              variant="outline"
              onClick={this.handleRetry}
              className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:text-rose-400"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {nextDelay ? `Riprova (attesa ${nextDelay}s)` : 'Riprova'}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Troppi errori consecutivi.{' '}
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() => window.location.reload()}
              >
                Ricarica la pagina
              </button>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }
}
