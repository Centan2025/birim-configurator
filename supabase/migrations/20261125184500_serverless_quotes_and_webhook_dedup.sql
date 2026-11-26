-- ============================================================================
-- Modül SaaS Serverless Persistence: Verified Quotes & Billing Webhook Dedup
-- Ensures multi-instance / serverless (Vercel) durability without relying on
-- process-local in-memory Maps or local JSON files.
-- ============================================================================

BEGIN;

-- 1. Verified Quotes Table (Tenant-isolated, HMAC-verified)
CREATE TABLE IF NOT EXISTS public.modul_verified_quotes (
  code text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  project_id text NOT NULL,
  hmac_signature text NOT NULL,
  expires_at timestamptz NOT NULL,
  record_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modul_verified_quotes_tenant_id
  ON public.modul_verified_quotes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_modul_verified_quotes_expires_at
  ON public.modul_verified_quotes (expires_at);

ALTER TABLE public.modul_verified_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modul_verified_quotes FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'modul_verified_quotes'
      AND policyname = 'tenant_verified_quotes_isolation_policy'
  ) THEN
    CREATE POLICY tenant_verified_quotes_isolation_policy
      ON public.modul_verified_quotes
      FOR ALL TO authenticated
      USING (tenant_id = (SELECT app_public.current_tenant_id()))
      WITH CHECK (tenant_id = (SELECT app_public.current_tenant_id()));
  END IF;
END $$;

-- 2. Billing Webhook Idempotency / Replay Protection Table (service_role only)
CREATE TABLE IF NOT EXISTS public.modul_billing_webhook_events (
  dedup_key text PRIMARY KEY,
  provider text NOT NULL,
  event_type text NOT NULL,
  tenant_id uuid,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modul_billing_webhook_events_processed_at
  ON public.modul_billing_webhook_events (processed_at);

ALTER TABLE public.modul_billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modul_billing_webhook_events FORCE ROW LEVEL SECURITY;
-- Intentionally NO authenticated/anon policy: only service_role BFF can read/write webhook dedup rows.

COMMIT;
