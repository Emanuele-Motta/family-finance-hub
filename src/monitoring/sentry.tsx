// Author: Emanuele Motta
// Date: 16-Apr-2026
// Sentry Configuration - Error tracking and monitoring setup

import React from 'react';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import type { ReactNode } from 'react';

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export function initializeSentry() {
  const environment = import.meta.env.MODE;
  const isDevelopment = environment === 'development';
  const isProduction = environment === 'production';

  if (!isProduction) {
    console.log('ℹ️  Sentry disabled in development');
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.warn('⚠️  VITE_SENTRY_DSN not configured');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [
      new BrowserTracing(),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Capture 100% of transactions in production for monitoring
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    // Capture 10% of sessions with replay
    replaysSessionSampleRate: isProduction ? 0.1 : 0,
    // Capture 100% of sessions with errors in replay
    replaysOnErrorSampleRate: 1.0,
    // Performance monitoring
    maxBreadcrumbs: 50,
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || 'unknown',
    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      'chrome-extension://',
      'moz-extension://',
      // Random plugins/extensions
      'top.GLOBALS',
      // See: http://blog.errorception.com/2012/03/tale-of-unfindable-js-error.html
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      // Network errors that aren't really errors
      'NetworkError',
      'Network request failed',
    ],
  });
}

/**
 * Error boundary wrapper for React
 */
export class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to Sentry
    Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              ❌ Qualcosa è andato storto
            </h1>
            <p className="text-gray-600 mb-4">
              Il nostro team è stato notificato dell'errore
            </p>
            <details className="text-left bg-gray-100 p-4 rounded-lg max-w-md mt-4">
              <summary className="cursor-pointer font-mono text-sm">
                Dettagli dell'errore
              </summary>
              <pre className="mt-2 text-xs overflow-auto">
                {this.state.error?.toString()}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Ricarica la pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Sentry Hook for React components
 */
export function useSentryErrorHandler() {
  const captureException = (error: Error | string, context?: Record<string, any>) => {
    if (typeof error === 'string') {
      Sentry.captureException(new Error(error), { contexts: { manual: context } });
    } else {
      Sentry.captureException(error, { contexts: { manual: context } });
    }
  };

  const captureMessage = (
    message: string,
    level: 'info' | 'warning' | 'error' = 'info'
  ) => {
    Sentry.captureMessage(message, level);
  };

  const addBreadcrumb = (message: string, data?: Record<string, any>) => {
    Sentry.addBreadcrumb({
      message,
      level: 'info',
      data,
    });
  };

  return { captureException, captureMessage, addBreadcrumb };
}

/**
 * Example usage in components:
 *
 * ```tsx
 * import { useSentryErrorHandler } from '@/monitoring/sentry';
 *
 * export function MyComponent() {
 *   const { captureException, addBreadcrumb } = useSentryErrorHandler();
 *
 *   const handleTransaction = async () => {
 *     try {
 *       addBreadcrumb('Starting transaction', { type: 'user_action' });
 *       // ... do something
 *     } catch (error) {
 *       captureException(error as Error, { action: 'transaction' });
 *     }
 *   };
 *
 *   return <button onClick={handleTransaction}>Create Transaction</button>;
 * }
 * ```
 */

/**
 * Production checklist:
 *
 * ✅ Set VITE_SENTRY_DSN in .env.production
 * ✅ Set VITE_APP_VERSION in package.json version field
 * ✅ Enable "Digest Emails" in Sentry project settings
 * ✅ Configure "Release Tracking" for version correlation
 * ✅ Set up issue routing to team members
 * ✅ Enable "Performance Monitoring"
 * ✅ Configure error rate alerts (e.g., >5% error rate)
 * ✅ Enable "Session Replay" for error investigation
 */
