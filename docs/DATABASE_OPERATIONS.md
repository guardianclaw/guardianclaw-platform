# Database Operations Runbook

Comprehensive guide for database management in the GuardianClaw Platform.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Migration Management](#migration-management)
3. [Creating New Migrations](#creating-new-migrations)
4. [Applying Migrations](#applying-migrations)
5. [Row Level Security](#row-level-security)
6. [Conventions & Standards](#conventions--standards)
7. [Troubleshooting](#troubleshooting)
8. [Emergency Procedures](#emergency-procedures)

---

## Architecture Overview

### Database Stack

| Component | Technology | Details |
|-----------|------------|---------|
| Database | PostgreSQL 15 | Hosted on Supabase |
| Region | AWS us-east-1 | Low latency to Modal.com |
| Connection | Pooler (Transaction mode) | 6543 for serverless |
| Direct | Direct connection | 5432 for migrations |

### Directory Structure

```
guardianclaw-platform/
├── supabase/
│   └── migrations/           # Source of truth for all migrations
│       ├── 20260105000000_initial_schema.sql
│       ├── 20260109000000_add_integration_config.sql
│       └── ...
└── docs/
    └── DATABASE_OPERATIONS.md  # This document
```

> **IMPORTANT**: All database migrations MUST be placed in `supabase/migrations/`.
> There is no other valid location. This was established to prevent confusion
> and ensure consistent deployment workflows.

### Connection Details

| Environment | Host | Database |
|-------------|------|----------|
| Production | `db.fxtchupyztjpyuhkhgpf.supabase.co` | postgres |
| Local | `localhost` | postgres |

---

## Migration Management

### Migration Registry

Migrations are tracked in the `supabase_migrations.schema_migrations` table:

```sql
SELECT version, name, statements_hash
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;
```

### Current Migration Count

```bash
# List all migrations
ls -la supabase/migrations/

# Count migrations
ls supabase/migrations/*.sql | wc -l
```

### Naming Convention

```
YYYYMMDDHHMMSS_description.sql
```

| Component | Format | Example |
|-----------|--------|---------|
| Date | `YYYYMMDD` | `20260125` |
| Time | `HHMMSS` | `000000` (midnight) or `143052` (specific time) |
| Separator | `_` | Required |
| Description | `snake_case` | `add_alerts`, `fix_rls_policies` |

**Timestamp Guidelines:**

- Use `000000` for the first migration of a day
- Use `100000`, `200000`, `300000` for subsequent migrations same day
- Ensures correct ordering when multiple migrations are created

**Description Prefixes:**

| Prefix | Usage |
|--------|-------|
| `add_` | New tables, columns, or features |
| `fix_` | Bug fixes or corrections |
| `seed_` | Initial data insertion |
| `drop_` | Removing tables or columns |
| `alter_` | Modifying existing structures |

---

## Creating New Migrations

### Step 1: Generate Timestamp

```bash
# Get current timestamp for filename
date +%Y%m%d%H%M%S
# Example output: 20260125143052
```

### Step 2: Create Migration File

```bash
# Create new migration file
touch supabase/migrations/20260125143052_add_new_feature.sql
```

### Step 3: Write Migration Content

Use this template structure:

```sql
-- Migration: YYYYMMDDHHMMSS_description
-- Date: YYYY-MM-DD
-- Description: Brief description of what this migration does
-- Author: GuardianClaw Team
--
-- This migration adds:
-- 1. table_name - Purpose of table
-- 2. function_name - Purpose of function
--
-- Dependencies:
-- - existing_table(column) from YYYYMMDDHHMMSS_migration_name.sql

-- ============================================
-- 1. TABLE DEFINITION
-- ============================================

CREATE TABLE new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Foreign keys
    wallet_address TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    -- Columns
    name TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX idx_new_table_wallet ON new_table(wallet_address);
CREATE INDEX idx_new_table_active ON new_table(is_active) WHERE is_active = true;

-- ============================================
-- 3. TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE TRIGGER new_table_updated_at
    BEFORE UPDATE ON new_table
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- User policies (wallet-scoped)
CREATE POLICY new_table_select_policy ON new_table
    FOR SELECT
    USING (wallet_address = current_setting('app.wallet_address', true));

CREATE POLICY new_table_insert_policy ON new_table
    FOR INSERT
    WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

CREATE POLICY new_table_update_policy ON new_table
    FOR UPDATE
    USING (wallet_address = current_setting('app.wallet_address', true));

CREATE POLICY new_table_delete_policy ON new_table
    FOR DELETE
    USING (wallet_address = current_setting('app.wallet_address', true));

-- Service role bypass (for API operations)
CREATE POLICY new_table_service_policy ON new_table
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- 5. HELPER FUNCTIONS (if needed)
-- ============================================

CREATE OR REPLACE FUNCTION get_new_table_data(p_wallet_address TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name, t.created_at
    FROM new_table t
    WHERE t.wallet_address = p_wallet_address
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. COMMENTS
-- ============================================

COMMENT ON TABLE new_table IS 'Description of what this table stores';
COMMENT ON COLUMN new_table.config IS 'JSON configuration options';
COMMENT ON FUNCTION get_new_table_data IS 'Retrieves data for a wallet';
```

### Step 4: Validate Migration

Before applying, validate the migration:

```bash
# Check SQL syntax (requires psql)
psql -h localhost -U postgres -d postgres -f supabase/migrations/NEW_MIGRATION.sql --set ON_ERROR_STOP=on -1

# Or use a SQL linter
sqlfluff lint supabase/migrations/NEW_MIGRATION.sql
```

### Pre-Commit Checklist

- [ ] Filename follows `YYYYMMDDHHMMSS_description.sql` format
- [ ] File is in `supabase/migrations/` directory (NOT elsewhere)
- [ ] Migration header includes date, description, author
- [ ] Dependencies are documented if referencing other tables
- [ ] RLS policies use `app.wallet_address` variable
- [ ] Service role bypass policy included if API access needed
- [ ] Indexes created for common query patterns
- [ ] COMMENT statements added for tables and functions
- [ ] No hardcoded sensitive data (use environment variables or RPC)
- [ ] Tested locally before committing

---

## Applying Migrations

### Method 1: Supabase CLI (Recommended for Local)

```bash
# Link to project (first time only)
npx supabase link --project-ref fxtchupyztjpyuhkhgpf

# Apply all pending migrations
npx supabase db push

# Apply specific migration
npx supabase migration up
```

### Method 2: Supabase Management API (Production)

For production deployments, use the Management API:

```bash
# Set variables
PROJECT_REF="fxtchupyztjpyuhkhgpf"
ACCESS_TOKEN="sbp_YOUR_ACCESS_TOKEN"

# Apply migration via API
curl -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "-- Your SQL here"
  }'
```

### Method 3: Direct psql (Emergency Only)

```bash
# Get connection string from Supabase Dashboard
psql "postgresql://postgres:[PASSWORD]@db.fxtchupyztjpyuhkhgpf.supabase.co:5432/postgres" \
  -f supabase/migrations/NEW_MIGRATION.sql
```

### Post-Apply Verification

After applying a migration, verify:

```sql
-- Check migration was registered
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version = 'YYYYMMDDHHMMSS';

-- Verify table exists
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'new_table'
ORDER BY ordinal_position;

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'new_table';

-- Verify policies exist
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'new_table';

-- Verify indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'new_table';

-- Verify functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%new_table%';
```

---

## Row Level Security

### Standard Variable

**ALWAYS use `app.wallet_address`** for RLS policies:

```sql
current_setting('app.wallet_address', true)
```

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Setting name | `app.wallet_address` | Consistent with majority of codebase |
| Missing ok | `true` | Returns NULL instead of error if not set |

> **IMPORTANT**: Do NOT use `app.current_user` or `app.current_wallet`.
> These were used inconsistently in legacy migrations and should not be
> replicated. All new migrations must use `app.wallet_address`.

### Setting the Variable (API Side)

The API sets this variable before queries:

```typescript
// In Hono middleware or route
await supabase.rpc('set_config', {
  setting: 'app.wallet_address',
  value: wallet,
  is_local: true
});
```

### RLS Policy Patterns

#### Direct Ownership (Table has wallet_address)

```sql
CREATE POLICY table_select_policy ON table_name
    FOR SELECT
    USING (wallet_address = current_setting('app.wallet_address', true));
```

#### Indirect Ownership (Via parent table)

```sql
CREATE POLICY child_table_select_policy ON child_table
    FOR SELECT
    USING (
        parent_id IN (
            SELECT id FROM parent_table
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );
```

#### Service Role Bypass

Always include for tables accessed by the API:

```sql
CREATE POLICY table_service_policy ON table_name
    FOR ALL
    USING (current_setting('role', true) = 'service_role');
```

### Testing RLS Policies

```sql
-- Set test wallet
SELECT set_config('app.wallet_address', 'test_wallet_address', true);

-- Test SELECT policy
SELECT * FROM table_name;

-- Test INSERT policy
INSERT INTO table_name (wallet_address, ...) VALUES ('test_wallet_address', ...);

-- Reset
SELECT set_config('app.wallet_address', '', true);
```

---

## Conventions & Standards

### Data Types

| Use Case | Type | Example |
|----------|------|---------|
| Primary key | `UUID` | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| Foreign key | `UUID` or `TEXT` | Match parent type |
| Wallet address | `TEXT` | `wallet_address TEXT NOT NULL` |
| Timestamps | `TIMESTAMPTZ` | `created_at TIMESTAMPTZ DEFAULT NOW()` |
| JSON data | `JSONB` | `config JSONB DEFAULT '{}'` |
| Enums | `TEXT + CHECK` | `status TEXT CHECK (status IN ('a', 'b'))` |
| Money | `DECIMAL(10, 4)` | `amount DECIMAL(10, 4)` |
| Counts | `INTEGER` or `BIGINT` | `count INTEGER DEFAULT 0` |

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Tables | `snake_case`, plural | `agent_alert_rules` |
| Columns | `snake_case` | `wallet_address` |
| Indexes | `idx_table_column` | `idx_agents_wallet` |
| Policies | `table_operation_policy` | `agents_select_policy` |
| Functions | `verb_noun` | `get_agent_alerts` |
| Triggers | `table_event_trigger` | `agents_updated_at` |

### Common Patterns

#### Updated At Trigger

```sql
CREATE TRIGGER table_updated_at
    BEFORE UPDATE ON table_name
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

> Note: `update_updated_at()` function is defined in the initial schema.

#### Soft Delete Pattern

```sql
-- Add column
is_deleted BOOLEAN DEFAULT false,
deleted_at TIMESTAMPTZ,

-- Create partial index
CREATE INDEX idx_table_active ON table_name(id)
    WHERE is_deleted = false;

-- RLS policy respects soft delete
CREATE POLICY table_select_policy ON table_name
    FOR SELECT
    USING (
        wallet_address = current_setting('app.wallet_address', true)
        AND is_deleted = false
    );
```

#### Audit Log Pattern

```sql
-- Immutable audit table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    wallet_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No UPDATE or DELETE policies (immutable)
CREATE POLICY audit_log_select ON audit_log FOR SELECT USING (...);
CREATE POLICY audit_log_insert ON audit_log FOR INSERT WITH CHECK (...);
```

---

## Troubleshooting

### Common Errors

#### "relation does not exist"

**Cause**: Table referenced in migration doesn't exist yet.

**Solution**: Check dependencies and migration order:

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

#### "permission denied for table"

**Cause**: RLS is blocking access.

**Solution**: Verify service role bypass policy exists:

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'table_name';
```

#### "duplicate key value violates unique constraint"

**Cause**: Migration already applied.

**Solution**: Check migration registry:

```sql
SELECT * FROM supabase_migrations.schema_migrations
WHERE version = 'YYYYMMDDHHMMSS';
```

#### "current_setting: unrecognized configuration parameter"

**Cause**: Using wrong variable name or missing `true` parameter.

**Solution**: Always use:

```sql
current_setting('app.wallet_address', true)
```

### Debugging RLS

```sql
-- Check if RLS is enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'table_name';

-- List all policies
SELECT * FROM pg_policies WHERE tablename = 'table_name';

-- Test as specific wallet
SET app.wallet_address = 'wallet_to_test';
SELECT * FROM table_name;
RESET app.wallet_address;
```

### Connection Issues

```bash
# Test connectivity
pg_isready -h db.fxtchupyztjpyuhkhgpf.supabase.co -p 5432

# Check SSL
psql "postgresql://postgres@db.fxtchupyztjpyuhkhgpf.supabase.co:5432/postgres?sslmode=require"
```

---

## Emergency Procedures

### Rollback a Migration

> **WARNING**: Rollbacks can cause data loss. Always backup first.

#### 1. Create Rollback Migration

```sql
-- 20260126000000_rollback_feature.sql
-- Rollback for 20260125000000_add_feature.sql

DROP FUNCTION IF EXISTS new_function();
DROP TABLE IF EXISTS new_table CASCADE;
```

#### 2. Apply Rollback

```bash
npx supabase db push
```

#### 3. Remove from Registry (if needed)

```sql
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260125000000';
```

### Backup Before Major Changes

```bash
# Via Supabase CLI
npx supabase db dump -f backup_$(date +%Y%m%d).sql

# Via pg_dump
pg_dump "postgresql://postgres:[PASSWORD]@db.fxtchupyztjpyuhkhgpf.supabase.co:5432/postgres" \
  > backup_$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
# Full restore (destructive)
psql "postgresql://postgres:[PASSWORD]@db.fxtchupyztjpyuhkhgpf.supabase.co:5432/postgres" \
  < backup_YYYYMMDD.sql
```

### Emergency Contacts

| Situation | Contact |
|-----------|---------|
| Database unreachable | Supabase Status: https://status.supabase.com |
| Data corruption | Supabase Support + Restore from backup |
| Performance issues | Check Supabase Dashboard > Database > Performance |

---

## Appendix

### Existing Tables Reference

| Table | Purpose | Migration |
|-------|---------|-----------|
| `profiles` | User profiles (wallet-based) | `20260105000000_initial_schema` |
| `agents` | AI agent definitions | `20260105000000_initial_schema` |
| `api_keys` | Agent API keys | `20260105000000_initial_schema` |
| `llm_keys` | User LLM keys (encrypted) | `20260105000000_initial_schema` |
| `execution_logs` | Detailed execution traces | `20260115200000_add_execution_logs` |
| `user_credits` | Credit balances | `20260121000000_credits_system` |
| `agent_alert_rules` | Per-agent alert rules | `20260125000000_agent_alert_rules` |

### Function Reference

| Function | Purpose |
|----------|---------|
| `update_updated_at()` | Trigger function for updated_at columns |
| `get_execution_logs()` | Paginated execution log retrieval |
| `get_agent_health_stats()` | 24h health metrics for agent |
| `deduct_credits()` | Atomic credit deduction |
| `get_agent_alerts_to_check()` | Alerts needing evaluation |

### Useful Queries

```sql
-- List all tables with row counts
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- List all functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Check database size
SELECT pg_size_pretty(pg_database_size('postgres'));

-- Find unused indexes
SELECT indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE 'pg_%';
```

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-25 | 1.0 | Initial version |

---

*Maintained by GuardianClaw Team*
