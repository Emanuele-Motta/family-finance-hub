// Author: Emanuele Motta
// Date: 16-Apr-2026
// DEPLOYMENT GUIDE - Complete production setup checklist

/**
 * ============================================================================
 * FAMILY FINANCE HUB - PRODUCTION DEPLOYMENT GUIDE
 * ============================================================================
 *
 * This document outlines all steps required to deploy the family finance
 * application to production.
 *
 * Estimated time: 4-6 hours for full deployment
 * Prerequisites: Node.js 18+, Supabase CLI, Vercel account (or hosting provider)
 */

// ============================================================================
// PHASE 1: DATABASE SETUP (1-2 hours)
// ============================================================================

/*
✅ Deploy Database Migration

1. Connect to Supabase Project
   $ supabase link
   
2. Create migration directory
   $ mkdir -p supabase/migrations
   
3. Copy migration file
   cp 20260416110000_advanced_features_schema.sql supabase/migrations/

4. Deploy migration
   $ supabase db push

5. Generate TypeScript types
   $ supabase gen types typescript --linked > src/types/supabase.ts

✅ Verify RLS Policies

1. Go to Supabase Dashboard > Authentication > Policies
2. For each of these tables, verify RLS is enabled:
   - audit_logs
   - record_versions
   - import_batches
   - import_pending_transactions
   - reconciliations
   - transaction_rules
   - rule_applications
   - recurring_templates
   - recurring_occurrences
   - cashflow_forecasts
   - transaction_comments
   - transaction_approvals
   - notifications
   - anomalies

3. Verify policies use family_group_id for isolation
   Example policy:
   (auth.uid() IN (SELECT user_id FROM family_members WHERE family_group_id = audit_logs.family_group_id))

✅ Create Database Indexes

Run all CREATE INDEX statements from scripts/setup-database.ts in SQL Editor:

   CREATE INDEX IF NOT EXISTS idx_audit_logs_family_group_id ON audit_logs(family_group_id);
   CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
   CREATE INDEX IF NOT EXISTS idx_record_versions_type ON record_versions(record_type);
   CREATE INDEX IF NOT EXISTS idx_import_pending_batch_id ON import_pending_transactions(import_batch_id);
   CREATE INDEX IF NOT EXISTS idx_import_pending_status ON import_pending_transactions(status);
   CREATE INDEX IF NOT EXISTS idx_recon_import_tx_id ON reconciliations(import_transaction_id);
   CREATE INDEX IF NOT EXISTS idx_rules_family_id ON transaction_rules(family_group_id);
   CREATE INDEX IF NOT EXISTS idx_rules_active ON transaction_rules(is_active);
   CREATE INDEX IF NOT EXISTS idx_recurring_family_id ON recurring_templates(family_group_id);
   CREATE INDEX IF NOT EXISTS idx_recurring_status ON recurring_occurrences(status);
   CREATE INDEX IF NOT EXISTS idx_forecast_created ON cashflow_forecasts(created_at);
   CREATE INDEX IF NOT EXISTS idx_notif_user_id ON notifications(user_id);
   CREATE INDEX IF NOT EXISTS idx_notif_is_read ON notifications(is_read);
   CREATE INDEX IF NOT EXISTS idx_anomalies_tx_id ON anomalies(transaction_id);
*/

// ============================================================================
// PHASE 2: ENVIRONMENT VARIABLES (15 minutes)
// ============================================================================

/*
Create .env.production file with all required variables:

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Monitoring
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_APP_VERSION=1.0.0

# Analytics (optional)
VITE_ANALYTICS_API_KEY=your-api-key

# Third-party integrations
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
RESEND_API_KEY=your-resend-api-key  # For email notifications

# Deployment
VITE_API_URL=https://api.familyfinance.app
NODE_ENV=production
*/

// ============================================================================
// PHASE 3: EDGE FUNCTIONS DEPLOYMENT (1 hour)
// ============================================================================

/*
Deploy Supabase Edge Functions for background jobs:

1. Deploy recurring generation function
   $ supabase functions deploy recurring-generation

2. Deploy notification delivery function
   $ supabase functions deploy send-notifications

3. Set up automated schedules
   - In Supabase Dashboard > Functions > Manage
   - Create cron job: recurring-generation runs daily at 2:00 AM UTC
   - Create cron job: send-notifications runs every 5 minutes

Example schedule setup:
   POST /functions/v1/recurring-generation
   Schedule: 0 2 * * * (Daily at 2 AM)

   POST /functions/v1/send-notifications
   Schedule: */5 * * * * (Every 5 minutes)

4. Test functions manually
   $ curl -X POST https://your-project.supabase.co/functions/v1/recurring-generation \
     -H "Authorization: Bearer your-service-role-key"
*/

// ============================================================================
// PHASE 4: BUILD & DEPLOYMENT (30 minutes)
// ============================================================================

/*
1. Build for production
   $ npm run build

2. Test production build locally
   $ npm run preview
   $ npm run test:e2e  # Run Playwright tests

3. Deploy to Vercel (or your hosting provider)
   $ vercel deploy --prod

   Alternative (Netlify):
   $ netlify deploy --prod --dir=dist

   Alternative (GitHub Pages):
   $ npm run build
   $ git add dist/
   $ git commit -m "Deploy: production build"
   $ git push origin main

4. Set environment variables on hosting platform
   - Vercel: Settings > Environment Variables
   - Netlify: Build & deploy > Environment

5. Verify deployment
   - Visit https://familyfinance.app
   - Check browser console for errors
   - Verify Sentry DSN is loaded (check Network tab)
*/

// ============================================================================
// PHASE 5: MONITORING SETUP (45 minutes)
// ============================================================================

/*
✅ Sentry Configuration

1. Create Sentry project
   - Go to sentry.io
   - Create new organization
   - Create new project (React)
   - Copy DSN

2. Configure Sentry
   - Set VITE_SENTRY_DSN in .env.production
   - In Sentry dashboard, set up:
     - Issue routing to team members
     - Slack integration for alerts
     - Email digest (daily or weekly)

3. Set up alerts
   - Alert: Error rate > 5%
   - Alert: Performance regression > 20%
   - Alert: New issue (high priority)

4. Configure release tracking
   - Link GitHub repo to Sentry
   - Enable automatic source map uploads
   - Set up commit and deploy tracking

✅ Analytics Setup

1. Create analytics_events table (if not in migration)
   CREATE TABLE analytics_events (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     event_type TEXT NOT NULL,
     user_id UUID NOT NULL,
     family_group_id UUID,
     metadata JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     FOREIGN KEY (user_id) REFERENCES profiles(user_id)
   );

2. Create real-time dashboard
   - Use Metabase, Looker, or custom React dashboard
   - Key metrics:
     - Daily Active Users (DAU)
     - Transaction creation rate
     - Feature usage (imports, bulk actions, etc.)
     - Error rate and top errors
     - Session duration

3. Set up automated reports
   - Daily email with key metrics
   - Weekly feature adoption report
   - Monthly usage trends

✅ Logging & Debugging

1. Configure structured logging
   - Use winston or pino for server-side logging
   - Log to CloudWatch or Datadog
   - Retain logs for 30 days

2. Set up distributed tracing
   - Use OpenTelemetry for trace correlation
   - Link frontend errors to backend operations
   - Monitor Supabase RLS policy violations
*/

// ============================================================================
// PHASE 6: TESTING & QA (1-2 hours)
// ============================================================================

/*
✅ Run Complete Test Suite

1. Unit tests
   $ npm run test

2. E2E tests
   $ npm run test:e2e  # Runs Playwright on all breakpoints

3. Performance tests
   $ npm run test:perf

4. Security tests
   - Verify CORS headers
   - Check RLS policies block unauthorized access
   - Test SQL injection prevention
   - Verify sensitive data is not logged

5. Manual testing checklist
   ☐ Login/signup flow
   ☐ CSV import with reconciliation
   ☐ Bulk actions on transactions
   ☐ Rule creation and auto-application
   ☐ Recurring transaction generation
   ☐ 30/60/90 day forecast calculation
   ☐ Notifications delivery (push, email, telegram)
   ☐ Anomaly detection
   ☐ Approval workflow
   ☐ Mobile responsiveness (test on real devices)
   ☐ Dark mode (if supported)
   ☐ Offline mode / network resilience

✅ Performance Benchmarks

1. Lighthouse audit
   $ npm run build
   $ lighthouse https://familyfinance.app

   Target scores:
   - Performance: > 90
   - Accessibility: > 95
   - Best Practices: > 95
   - SEO: > 90

2. Core Web Vitals
   - First Contentful Paint: < 1.8s
   - Largest Contentful Paint: < 2.5s
   - Cumulative Layout Shift: < 0.1

3. Database performance
   - Query execution time < 200ms
   - RLS policy evaluation time < 50ms
   - Concurrent user capacity: 1000+

4. Bundle size analysis
   $ npm run build
   $ npm run analyze
   
   Target: Main bundle < 500KB (gzip)
*/

// ============================================================================
// PHASE 7: POST-DEPLOYMENT MONITORING (Ongoing)
// ============================================================================

/*
✅ First 24 Hours

1. Monitor error rate
   - Check Sentry dashboard every 2 hours
   - Set up Slack notifications for critical errors
   - Have team on standby for quick fixes

2. Monitor performance
   - Check backend response times
   - Monitor database query performance
   - Watch for RLS policy timeouts

3. Monitor user engagement
   - Track DAU and active sessions
   - Monitor feature adoption
   - Check for support tickets

✅ Ongoing Monitoring

Daily:
- Review error logs (Sentry)
- Check performance metrics (Lighthouse)
- Scan analytics for anomalies

Weekly:
- Review feature usage metrics
- Analyze user feedback and support tickets
- Plan optimizations based on data

Monthly:
- Performance review and optimization
- Security audit
- Database maintenance (vacuum, analyze)
- Plan next feature rollout

✅ Scaling Considerations

1. Database scaling
   - Monitor connection pool usage
   - Increase row limits if needed
   - Plan for data retention/archival

2. Function scaling
   - Monitor Edge Function execution time
   - Scale duplicate detection function if slow
   - Optimize query performance

3. Application scaling
   - Enable CDN caching for static assets
   - Consider image optimization
   - Monitor memory usage and bundle size

4. Support scaling
   - Set up chatbot for common questions
   - Create FAQ documentation
   - Establish SLA for issue resolution
*/

// ============================================================================
// ROLLBACK PROCEDURES
// ============================================================================

/*
If critical issues occur after deployment:

1. Stop accepting new traffic
   - In hosting provider, disable new requests
   - Route to maintenance page

2. Rollback application
   - Revert to previous stable version
   - $ vercel rollback (or equivalent)

3. Fix and redeploy
   - Identify root cause
   - Implement fix
   - Run full test suite
   - Redeploy when confidence is high

4. Communicate status
   - Update status page
   - Send email to affected users
   - Post to support channels

5. Post-incident review
   - Document what happened
   - Identify prevention measures
   - Update deployment procedures
*/

// ============================================================================
// DEPLOYMENT SUCCESS CHECKLIST
// ============================================================================

/*
✅ Database
  ☐ Migration deployed
  ☐ All new tables exist
  ☐ RLS policies verified
  ☐ Indexes created
  ☐ Audit logs working
  ☐ Backups configured

✅ Backend
  ☐ Edge Functions deployed and tested
  ☐ Recurring generation schedule active
  ☐ Notification delivery running
  ☐ Error handling working
  ☐ Rate limiting active

✅ Frontend
  ☐ Build completes without errors
  ☐ Bundles under size limit
  ☐ All components render
  ☐ Integrations working

✅ Monitoring
  ☐ Sentry collecting errors
  ☐ Analytics tracking events
  ☐ Performance metrics being recorded
  ☐ Alerts configured
  ☐ Logging working

✅ Testing
  ☐ All unit tests pass
  ☐ All E2E tests pass
  ☐ Performance benchmarks met
  ☐ Security audit passed
  ☐ Manual QA completed

✅ Operations
  ☐ Environment variables set
  ☐ Backups automated
  ☐ Scaling tested
  ☐ Disaster recovery plan ready
  ☐ Support team trained

✅ Documentation
  ☐ User guide completed
  ☐ API documentation
  ☐ Troubleshooting guide
  ☐ Emergency procedures
  ☐ Team runbooks

When all items are checked: 🚀 READY FOR PRODUCTION
*/

// ============================================================================
// SUPPORT & ESCALATION
// ============================================================================

/*
If you encounter deployment issues:

1. Check deployment logs
   - Hosting provider logs
   - Supabase dashboard
   - Browser console errors

2. Common issues and fixes

   Issue: "VITE_SUPABASE_URL not defined"
   Fix: Add to .env.production and rebuild

   Issue: "RLS policy violation"
   Fix: Verify policy SQL syntax and family_group_id column

   Issue: "Edge Function timeout"
   Fix: Optimize queries or increase timeout limit

   Issue: "Database query slow"
   Fix: Check indexes are created, run EXPLAIN ANALYZE

   Issue: "Out of memory during build"
   Fix: Increase Node memory: NODE_OPTIONS=--max-old-space-size=4096

3. Escalation paths
   - Database issues: Contact Supabase support
   - Hosting issues: Contact hosting provider support
   - Frontend issues: Check browser DevTools
   - Performance issues: Review monitoring dashboards

4. 24/7 Support
   - Supabase: https://supabase.com/support
   - Vercel: https://vercel.com/support
   - Sentry: https://sentry.io/support

*/

console.log('✅ Deployment guide complete. Ready for production!');
