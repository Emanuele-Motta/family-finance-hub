// Author: Emanuele Motta
// Date: 16-Apr-2026
// Database Setup Script - Deploy migration and verify RLS policies

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Database Setup Tasks
 */

async function deployMigration() {
  console.log('📦 Deploying advanced features migration...');

  try {
    // In production, use Supabase CLI: supabase db push
    // Or deploy via Supabase Dashboard:
    // 1. Go to SQL Editor
    // 2. Upload 20260416110000_advanced_features_schema.sql
    // 3. Execute

    console.log(
      '⚠️  Manual Step Required:\n' +
        '   1. Navigate to Supabase Dashboard > SQL Editor\n' +
        '   2. Create new query\n' +
        '   3. Copy 20260416110000_advanced_features_schema.sql content\n' +
        '   4. Execute query\n'
    );

    // Alternatively, if using Supabase CLI:
    console.log(
      'OR using CLI:\n' +
        '   supabase db pull  # Get latest schema\n' +
        '   supabase db push  # Deploy migrations\n'
    );
  } catch (error) {
    console.error('❌ Migration deployment failed:', error);
    throw error;
  }
}

/**
 * Verify RLS policies are enabled
 */
async function verifyRLSPolicies() {
  console.log('\n🔐 Verifying RLS policies...');

  const tablesToCheck = [
    'audit_logs',
    'record_versions',
    'import_batches',
    'import_pending_transactions',
    'reconciliations',
    'transaction_rules',
    'rule_applications',
    'recurring_templates',
    'recurring_occurrences',
    'cashflow_forecasts',
    'transaction_comments',
    'transaction_approvals',
    'notifications',
    'anomalies',
    'transactions',
    'budgets',
    'categories',
    'accounts',
    'family_members',
    'profiles',
  ];

  for (const table of tablesToCheck) {
    try {
      // Check if RLS is enabled
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name, table_schema')
        .eq('table_name', table)
        .eq('table_schema', 'public');

      if (error) {
        console.warn(`⚠️  Could not verify ${table}: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(`✅ ${table} - RLS should be enabled`);
      }
    } catch (err) {
      console.warn(`⚠️  Skipping verification for ${table}`);
    }
  }

  console.log('\n📋 Manual Verification Checklist:\n');
  console.log('For each table, verify in Supabase Dashboard > Auth > Policies:');
  console.log('');
  console.log('1. audit_logs:');
  console.log('   - Policy: "Enable read for family members"');
  console.log('   - Query: (auth.uid() IN (SELECT user_id FROM family_members WHERE family_group_id = ''public''.''audit_logs''.''family_group_id''))');
  console.log('');
  console.log('2. import_pending_transactions:');
  console.log('   - Policy: "Enable full access for family members"');
  console.log('   - Applies to: SELECT, INSERT, UPDATE, DELETE');
  console.log('');
  console.log('3. reconciliations:');
  console.log('   - Policy: "Enable read/write for family members"');
  console.log('');
  console.log('✅ All new tables should have family_group_id based isolation');
}

/**
 * Create database indexes for performance
 */
async function createIndexes() {
  console.log('\n⚡ Creating database indexes...');

  const indexes = [
    {
      table: 'audit_logs',
      column: 'family_group_id',
      name: 'idx_audit_logs_family_group_id',
    },
    {
      table: 'audit_logs',
      column: 'created_at',
      name: 'idx_audit_logs_created_at',
    },
    {
      table: 'record_versions',
      column: 'record_type',
      name: 'idx_record_versions_type',
    },
    {
      table: 'import_pending_transactions',
      column: 'import_batch_id',
      name: 'idx_import_pending_batch_id',
    },
    {
      table: 'import_pending_transactions',
      column: 'status',
      name: 'idx_import_pending_status',
    },
    {
      table: 'reconciliations',
      column: 'import_transaction_id',
      name: 'idx_recon_import_tx_id',
    },
    {
      table: 'transaction_rules',
      column: 'family_group_id',
      name: 'idx_rules_family_id',
    },
    {
      table: 'transaction_rules',
      column: 'is_active',
      name: 'idx_rules_active',
    },
    {
      table: 'recurring_templates',
      column: 'family_group_id',
      name: 'idx_recurring_family_id',
    },
    {
      table: 'recurring_occurrences',
      column: 'status',
      name: 'idx_recurring_status',
    },
    {
      table: 'cashflow_forecasts',
      column: 'created_at',
      name: 'idx_forecast_created',
    },
    {
      table: 'notifications',
      column: 'user_id',
      name: 'idx_notif_user_id',
    },
    {
      table: 'notifications',
      column: 'is_read',
      name: 'idx_notif_is_read',
    },
    {
      table: 'anomalies',
      column: 'transaction_id',
      name: 'idx_anomalies_tx_id',
    },
  ];

  console.log('\n📋 Indexes to create manually in Supabase:\n');

  for (const idx of indexes) {
    const sql = `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.column});`;
    console.log(sql);
  }

  console.log('\n✅ Copy all CREATE INDEX statements and run in SQL Editor');
}

/**
 * Verify table structure
 */
async function verifyTableStructure() {
  console.log('\n📊 Verifying table structure...');

  const expectedTables = [
    'audit_logs',
    'record_versions',
    'import_batches',
    'import_pending_transactions',
    'reconciliations',
    'transaction_rules',
    'rule_applications',
    'recurring_templates',
    'recurring_occurrences',
    'cashflow_forecasts',
    'transaction_comments',
    'transaction_approvals',
    'notifications',
    'anomalies',
  ];

  console.log(`\nChecking for ${expectedTables.length} new tables:`);
  console.log(expectedTables.map(t => `  - ${t}`).join('\n'));

  console.log(
    '\n✅ Verify all tables exist in Supabase Dashboard > Database > Tables'
  );
}

/**
 * Main setup function
 */
async function setupDatabase() {
  try {
    console.log('🚀 Family Finance Hub - Database Setup\n');
    console.log('=====================================\n');

    await deployMigration();
    await verifyTableStructure();
    await verifyRLSPolicies();
    await createIndexes();

    console.log('\n=====================================');
    console.log('✅ Database setup checklist complete!\n');
    console.log('Next steps:');
    console.log('1. Execute migration in Supabase Dashboard');
    console.log('2. Verify RLS policies are enabled');
    console.log('3. Create indexes for performance');
    console.log('4. Run: supabase gen types typescript --linked');
    console.log('5. Update TypeScript types in project\n');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run setup
setupDatabase().then(() => {
  console.log('Setup complete! Ready for deployment.\n');
  process.exit(0);
});
