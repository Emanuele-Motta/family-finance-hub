// Author: Emanuele Motta
// Date: 16-Apr-2026
// INTEGRATION GUIDE - How to Use the Generated Components & Services
// This document provides practical examples for integrating all features

/**
 * ============================================================================
 * 1. IMPORT & USE RECONCILIATION SERVICE
 * ============================================================================
 */

import { reconciliationService } from '@/services/reconciliationService';

// Example: Find matches for an imported transaction
async function handleImportReconciliation(importBatchId: string) {
  // Get pending transactions from the import batch
  const pendingTx = await supabase
    .from('import_pending_transactions')
    .select('*')
    .eq('import_batch_id', importBatchId);

  // For each pending transaction, find potential matches
  for (const pending of pendingTx) {
    const matches = await reconciliationService.findPotentialMatches(
      pending,
      familyGroupId,
      90 // days back to look
    );

    if (matches.length > 0) {
      // Top match with highest confidence
      const topMatch = matches[0];
      if (topMatch.score > 0.85) {
        // Auto-match with high confidence
        await reconciliationService.reconcileImportBatch(
          importBatchId,
          familyGroupId
        );
      } else if (topMatch.score > 0.70) {
        // Present to user for manual confirmation
        // Store in pending_reconciliations for review
      }
    }
  }
}

/**
 * ============================================================================
 * 2. IMPORT REVIEW COMPONENT
 * ============================================================================
 */

import { ImportReview } from '@/components/ImportReview';

// In your import page/modal:
export function CsvImportPage() {
  const [importBatchId, setImportBatchId] = useState<string | null>(null);

  return (
    <>
      {!importBatchId ? (
        <FileUploadWidget onBatchCreated={setImportBatchId} />
      ) : (
        <ImportReview
          batchId={importBatchId}
          familyGroupId={familyGroupId}
          onImportComplete={() => {
            // Refresh transactions list, show success toast
            showToast('✅ Transazioni importate con successo!');
          }}
        />
      )}
    </>
  );
}

/**
 * ============================================================================
 * 3. TRANSACTION RULES SERVICE
 * ============================================================================
 */

import { transactionRulesService } from '@/services/transactionRulesService';

// Example: Create a rule like Gmail filters
async function createMerchantRule() {
  await transactionRulesService.createRule({
    family_group_id: familyGroupId,
    name: 'Auto-tag Spotify',
    is_active: true,
    priority: 100,
    condition_type: 'all_match',
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'Spotify',
      },
    ],
    category_id: subscriptionsCategory.id,
    tags: ['subscription', 'entertainment'],
    auto_apply: true,
    require_review: false,
    created_by: userId,
  });
}

// Example: Apply rules to new transactions
async function processNewTransaction(transaction: Transaction) {
  const applied = await transactionRulesService.applyRulesToTransaction(
    transaction,
    familyGroupId
  );

  if (applied.length > 0) {
    // Update transaction with rule-applied changes
    console.log(`Applied ${applied.length} rules`);
  }
}

/**
 * ============================================================================
 * 4. RECURRING SERVICE
 * ============================================================================
 */

import { recurringService } from '@/services/recurringService';

// Example: Create monthly recurring (like rent)
async function createMonthlyRent() {
  const template = await recurringService.createRecurringTemplate({
    family_group_id: familyGroupId,
    name: 'Affitto mensile',
    frequency: 'monthly',
    interval: 1,
    day_of_month: 1, // First day of month
    amount: 1200,
    category_id: housingCategory.id,
    account_id: primaryAccount.id,
    description: 'Affitto appartamento',
    max_occurrences: 60, // 5 years
    created_by: userId,
  });

  return template;
}

// Example: Get upcoming reminders
async function getReminders() {
  const upcoming = await recurringService.getUpcomingReminders(
    familyGroupId,
    7 // next 7 days
  );

  return upcoming; // Shows [{ template, daysUntil, nextDate }]
}

/**
 * ============================================================================
 * 5. ADVANCE FORECASTING
 * ============================================================================
 */

import { forecastService } from '@/services/forecastService';

// Example: Generate 30/60/90 day forecast
async function generateForecast() {
  const forecast = await forecastService.generateForecast(
    familyGroupId,
    primaryAccountId,
    'combined' // or 'recurring' or 'avg_historical'
  );

  // Display on dashboard:
  // - forecast.forecast_balance_30
  // - forecast.forecast_balance_60
  // - forecast.forecast_balance_90
  // - forecast.confidence_level
}

// Example: Risk analysis
async function analyzeRisk() {
  const risk = await forecastService.analyzeForecastRisk(
    familyGroupId,
    primaryAccountId
  );

  if (risk.negative_balance_risk > 0.5) {
    notificationService.notifyBudgetAlert(
      userId,
      'High risk of negative balance in 30 days'
    );
  }
}

/**
 * ============================================================================
 * 6. BULK ACTIONS COMPONENT
 * ============================================================================
 */

import { TransactionBulkActions } from '@/components/TransactionBulkActions';

// In your transactions page:
export function TransactionsPage() {
  return (
    <div>
      {/* Add bulk actions component */}
      <TransactionBulkActions
        familyGroupId={familyGroupId}
        onTransactionsUpdated={() => {
          // Refetch transactions
        }}
      />
    </div>
  );
}

/**
 * ============================================================================
 * 7. ANOMALY DETECTION
 * ============================================================================
 */

import { anomalyService } from '@/services/anomalyService';

// Example: Analyze transaction for anomalies
async function flagAnomalies(transaction: Transaction) {
  const anomalies = await anomalyService.analyzeTransaction(
    transaction,
    familyGroupId,
    90 // historical window days
  );

  // anomalies.unusual_amount: boolean
  // anomalies.unusual_category: boolean
  // anomalies.duplicate_like: boolean
  // anomalies.fraud_score: 0-100

  if (anomalies.fraud_score > 70) {
    // High risk transaction
    await transactionApprovalsService.requestApproval(
      transaction,
      50, // threshold
      familyGroupId
    );
  }
}

// Example: Dashboard alert
async function getAnomalyAlert() {
  const summary = await anomalyService.getAnomalySummary(familyGroupId);
  // { total_unacknowledged: 3, critical: 1, warning: 2 }
}

/**
 * ============================================================================
 * 8. NOTIFICATIONS SERVICE
 * ============================================================================
 */

import { notificationService } from '@/services/notificationService';

// Example: Send budget alert
async function checkBudgets() {
  const budgets = await supabase
    .from('budgets')
    .select('*')
    .eq('family_group_id', familyGroupId);

  for (const budget of budgets) {
    const spent = await sumTransactionsByCategory(budget.category_id);
    const spent_pct = spent / budget.amount;

    if (spent_pct > 0.9) {
      // 90% spent
      await notificationService.notifyBudgetAlert(
        userId,
        budget.name,
        spent_pct,
        'push'
      );
    }
  }
}

// Example: Recurring reminder
async function sendRecurringReminders() {
  const upcoming = await recurringService.getUpcomingReminders(
    familyGroupId,
    2 // next 2 days
  );

  for (const reminder of upcoming) {
    if (reminder.daysUntil <= reminder.template.notification_days_before) {
      await notificationService.notifyRecurrenceReminder(
        userId,
        reminder.template.name,
        reminder.nextDate,
        reminder.template.notification_channel
      );
    }
  }
}

/**
 * ============================================================================
 * 9. TRANSACTION COLLABORATION
 * ============================================================================
 */

import { TransactionCollaboration } from '@/components/TransactionCollaboration';

// In transaction detail page:
export function TransactionDetailPage({ transactionId }: Props) {
  return (
    <div>
      <TransactionHeader transaction={transaction} />
      <TransactionCollaboration
        transactionId={transactionId}
        familyGroupId={familyGroupId}
        transaction={transaction}
        currentUserId={userId}
      />
    </div>
  );
}

/**
 * ============================================================================
 * 10. MOBILE DASHBOARD
 * ============================================================================
 */

import { MobileDashboard } from '@/components/MobileDashboard';

// In app layout for mobile:
export function AppLayout() {
  return (
    <>
      {isMobile ? (
        <MobileDashboard primaryAccountId={accountId} />
      ) : (
        <DesktopDashboard primaryAccountId={accountId} />
      )}
    </>
  );
}

/**
 * ============================================================================
 * 11. AUDIT LOGGING
 * ============================================================================
 */

import { AuditHelpers } from '@/services/auditService';

// Example: Log transaction creation
async function createTransaction(data: TransactionInput) {
  const tx = await supabase
    .from('transactions')
    .insert(data)
    .select()
    .single();

  // Automatically log to audit trail
  await AuditHelpers.logTransactionCreated(
    familyGroupId,
    tx.id,
    tx
  );
}

// Example: Get audit log for compliance
async function exportAuditReport() {
  const logs = await supabase
    .from('audit_logs')
    .select('*')
    .eq('family_group_id', familyGroupId)
    .order('created_at', { ascending: false });

  // Generate PDF or CSV report
}

/**
 * ============================================================================
 * 12. ONBOARDING GUIDE
 * ============================================================================
 */

import { OnboardingGuide } from '@/components/OnboardingGuide';

// Show on first app launch:
export function AppInitialization() {
  const { isNewUser } = useAuth();

  if (isNewUser) {
    return <OnboardingGuide />;
  }

  return <Dashboard />;
}

/**
 * ============================================================================
 * TESTING EXAMPLES
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';

describe('Reconciliation Flow', () => {
  it('should match identical transactions', async () => {
    const imported = {
      date: '2026-04-16',
      amount: 50.0,
      description: 'Pizzeria Roma',
    };

    const existing = {
      date: '2026-04-16',
      amount: 49.99,
      notes: 'Pizzeria Roma',
    };

    const score = calculateMatchScore(imported as any, existing as any);
    expect(score.total).toBeGreaterThan(0.85);
  });
});

/**
 * ============================================================================
 * KEY INTEGRATION CHECKLIST
 * ============================================================================
 */

/*
Before going to production, ensure:

✅ Database Migration
  - [ ] Deploy 20260416110000_advanced_features_schema.sql to Supabase
  - [ ] Verify RLS policies are active
  - [ ] Create database indexes

✅ Environment Variables
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
  - [ ] TELEGRAM_BOT_TOKEN (for notifications)
  - [ ] RESEND_API_KEY (for email notifications)

✅ Third Party Integration
  - [ ] Supabase Edge Functions for background jobs
  - [ ] Telegram Bot credentials
  - [ ] Email service (Resend, SendGrid, etc.)
  - [ ] Optional: Stripe for monetization

✅ React Query Setup
  - [ ] Configure QueryClient with appropriate defaults
  - [ ] Set up error boundaries
  - [ ] Configure retry logic

✅ Error Handling
  - [ ] Set up Sentry for error tracking
  - [ ] Configure error boundaries
  - [ ] Add user-friendly error messages

✅ Testing
  - [ ] Run unit tests: npm run test
  - [ ] Set up E2E tests with Playwright
  - [ ] Test RLS policies manually
  - [ ] Test on real devices (mobile)

✅ Documentation
  - [ ] Update README with feature overview
  - [ ] Create API documentation
  - [ ] Add troubleshooting guide

✅ Performance
  - [ ] Lighthouse audit (mobile)
  - [ ] Bundle size analysis
  - [ ] Database query optimization
  - [ ] Monitor query performance

✅ Security
  - [ ] Audit RLS policies
  - [ ] Test input validation
  - [ ] Security headers
  - [ ] CORS configuration

✅ Analytics & Monitoring
  - [ ] Set up usage tracking
  - [ ] Error monitoring
  - [ ] Performance monitoring
  - [ ] Feature flag configuration
*/
