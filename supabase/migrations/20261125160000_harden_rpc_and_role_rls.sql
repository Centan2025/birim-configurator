-- ============================================================================
-- Modül SaaS & Birim Store/ERP Security Hardening Migration
-- Fixes P0-SEC-05:
--   1. Drops legacy overloaded RPC signatures from 20261114120000
--   2. Enforces tenant ownership (organization_id = p_session_org_id) on
--      SECURITY DEFINER UPSERTs (prevents cross-tenant ON CONFLICT overwrite)
--   3. Enforces role-based & immutable RLS policies on modul_audit_logs,
--      modul_subscriptions, modul_entitlement_overrides, modul_usage_events,
--      and tenant admin tables using app_public.has_tenant_role(...)
-- ============================================================================

BEGIN;

-- 1. Drop legacy overloaded no-op RPC signatures from 20261114120000
DROP FUNCTION IF EXISTS public.upsert_configurator_store_quotation_atomic(
  jsonb, jsonb, jsonb, jsonb, uuid, uuid, text, text, text, boolean, boolean, jsonb, jsonb, text, text, uuid, text, text
);
DROP FUNCTION IF EXISTS public.publish_configurator_erp_nesting_atomic(
  jsonb, jsonb, text, text, text, text, uuid, text
);

-- 2. Harden upsert_configurator_store_quotation_atomic against cross-tenant ON CONFLICT overwrite
CREATE OR REPLACE FUNCTION public.upsert_configurator_store_quotation_atomic(
  p_session_org_id uuid,
  p_configurator_project_id text,
  p_configurator_version integer DEFAULT 1,
  p_project_title text DEFAULT 'Birim Tasarım Projesi',
  p_project_payload jsonb DEFAULT '{}'::jsonb,
  p_lines jsonb DEFAULT '[]'::jsonb,
  p_currency text DEFAULT 'TRY',
  p_quotation_id uuid DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_branch_input text DEFAULT NULL,
  p_compatibility_status text DEFAULT 'UNVERIFIED',
  p_can_export_production boolean DEFAULT false,
  p_auto_convert_to_order boolean DEFAULT false,
  p_order_draft jsonb DEFAULT NULL,
  p_active_rates jsonb DEFAULT '{"EUR": 41.8, "TRY": 1}'::jsonb,
  p_idempotency_key text DEFAULT NULL,
  p_request_hash text DEFAULT NULL,
  p_session_user_id uuid DEFAULT NULL,
  p_session_username text DEFAULT 'configurator_bff',
  p_session_role text DEFAULT 'sales_manager'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_lock_key bigint;
  v_quotation_id uuid := COALESCE(p_quotation_id, gen_random_uuid());
  v_is_update boolean := p_quotation_id IS NOT NULL;
  v_quotation_no text;
  v_subtotal numeric(14,2) := 0;
  v_discount_total numeric(14,2) := 0;
  v_tax_total numeric(14,2) := 0;
  v_total_amount numeric(14,2) := 0;
  v_line_rec jsonb;
  v_line_count integer := COALESCE(jsonb_array_length(COALESCE(p_lines, '[]'::jsonb)), 0);
  v_existing record;
  v_owner_org uuid;
BEGIN
  IF p_session_org_id IS NULL THEN
    RAISE EXCEPTION 'Oturum organizasyonu (p_session_org_id) zorunludur.'
      USING ERRCODE = '42501';
  END IF;

  IF p_auto_convert_to_order AND NOT p_can_export_production THEN
    RAISE EXCEPTION 'Üretim kapısı kilitli (%): Doğrulanmamış tasarım siparişe dönüştürülemez.', p_compatibility_status
      USING ERRCODE = '22023';
  END IF;

  v_lock_key := hashtextextended(COALESCE(p_idempotency_key, v_quotation_id::text), 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Cross-tenant ownership guard BEFORE upsert on configurator_projects
  SELECT organization_id INTO v_owner_org
    FROM public.configurator_projects
   WHERE id = p_configurator_project_id;
  IF FOUND AND v_owner_org IS DISTINCT FROM p_session_org_id THEN
    RAISE EXCEPTION 'CROSS_TENANT_FORBIDDEN: Proje kimliği başka bir organizasyona ait.'
      USING ERRCODE = '42501';
  END IF;

  -- Cross-tenant ownership guard BEFORE upsert on saved_quotations
  IF p_quotation_id IS NOT NULL THEN
    SELECT organization_id INTO v_owner_org
      FROM public.saved_quotations
     WHERE id = p_quotation_id;
    IF FOUND AND v_owner_org IS DISTINCT FROM p_session_org_id THEN
      RAISE EXCEPTION 'CROSS_TENANT_FORBIDDEN: Teklif kimliği başka bir organizasyona ait.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, quotation_no, request_hash, subtotal, discount_total, tax_total, total_amount
      INTO v_existing
      FROM public.saved_quotations
     WHERE organization_id = p_session_org_id
       AND idempotency_key = p_idempotency_key
     LIMIT 1;
    IF FOUND THEN
      IF v_existing.request_hash IS DISTINCT FROM p_request_hash THEN
        RAISE EXCEPTION 'Idempotency-Key farklı bir teklif içeriğiyle yeniden kullanılamaz.'
          USING ERRCODE = '23505';
      END IF;
      RETURN jsonb_build_object(
        'quotationId', v_existing.id,
        'quotationNo', v_existing.quotation_no,
        'isUpdate', false,
        'organizationId', p_session_org_id,
        'branchId', COALESCE(p_branch_input, 'merkez'),
        'currency', p_currency,
        'subtotal', v_existing.subtotal,
        'discountTotal', v_existing.discount_total,
        'taxTotal', v_existing.tax_total,
        'totalAmount', v_existing.total_amount,
        'lineCount', v_line_count,
        'compatibilityStatus', p_compatibility_status,
        'canExportProduction', p_can_export_production,
        'syncedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      );
    END IF;
  END IF;

  FOR v_line_rec IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_subtotal := v_subtotal + GREATEST(0, COALESCE((v_line_rec->>'subtotal')::numeric, 0));
    v_discount_total := v_discount_total + GREATEST(0, COALESCE((v_line_rec->>'discountAmount')::numeric, 0));
    v_tax_total := v_tax_total + GREATEST(0, COALESCE((v_line_rec->>'vatAmount')::numeric, 0));
    v_total_amount := v_total_amount + GREATEST(0, COALESCE((v_line_rec->>'totalPrice')::numeric, 0));
  END LOOP;

  INSERT INTO public.configurator_projects (
    id, organization_id, branch_id, title, version,
    compatibility_status, can_export_production, project_payload, updated_by, updated_at
  ) VALUES (
    p_configurator_project_id, p_session_org_id, p_branch_input, p_project_title, p_configurator_version,
    p_compatibility_status, p_can_export_production, p_project_payload, p_session_username, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    version = EXCLUDED.version,
    compatibility_status = EXCLUDED.compatibility_status,
    can_export_production = EXCLUDED.can_export_production,
    project_payload = EXCLUDED.project_payload,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  WHERE public.configurator_projects.organization_id = p_session_org_id;

  v_quotation_no := upper('BRM-QT-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_quotation_id::text, '-', ''), 1, 6));

  INSERT INTO public.saved_quotations (
    id, organization_id, quotation_no, configurator_project_id, configurator_version,
    customer_id, customer_name, branch_id, currency,
    subtotal, discount_total, tax_total, total_amount,
    compatibility_status, can_export_production, quotation_data,
    idempotency_key, request_hash, created_by, updated_at
  ) VALUES (
    v_quotation_id, p_session_org_id, v_quotation_no, p_configurator_project_id, p_configurator_version,
    p_customer_id, p_customer_name, COALESCE(p_branch_input, 'merkez'), p_currency,
    v_subtotal, v_discount_total, v_tax_total, v_total_amount,
    p_compatibility_status, p_can_export_production,
    jsonb_build_object('lines', COALESCE(p_lines, '[]'::jsonb), 'rates', p_active_rates, 'orderDraft', p_order_draft),
    p_idempotency_key, p_request_hash, p_session_username, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    configurator_version = EXCLUDED.configurator_version,
    customer_name = COALESCE(EXCLUDED.customer_name, public.saved_quotations.customer_name),
    currency = EXCLUDED.currency,
    subtotal = EXCLUDED.subtotal,
    discount_total = EXCLUDED.discount_total,
    tax_total = EXCLUDED.tax_total,
    total_amount = EXCLUDED.total_amount,
    compatibility_status = EXCLUDED.compatibility_status,
    can_export_production = EXCLUDED.can_export_production,
    quotation_data = EXCLUDED.quotation_data,
    updated_at = now()
  WHERE public.saved_quotations.organization_id = p_session_org_id
  RETURNING quotation_no INTO v_quotation_no;

  RETURN jsonb_build_object(
    'quotationId', v_quotation_id,
    'quotationNo', v_quotation_no,
    'isUpdate', v_is_update,
    'version', p_configurator_version,
    'organizationId', p_session_org_id,
    'branchId', COALESCE(p_branch_input, 'merkez'),
    'currency', p_currency,
    'subtotal', v_subtotal,
    'discountTotal', v_discount_total,
    'taxTotal', v_tax_total,
    'totalAmount', v_total_amount,
    'lineCount', v_line_count,
    'compatibilityStatus', p_compatibility_status,
    'canExportProduction', p_can_export_production,
    'syncedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_configurator_store_quotation_atomic(
  uuid, text, integer, text, jsonb, jsonb, text, uuid, uuid, text, text, text, boolean, boolean, jsonb, jsonb, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_configurator_store_quotation_atomic(
  uuid, text, integer, text, jsonb, jsonb, text, uuid, uuid, text, text, text, boolean, boolean, jsonb, jsonb, text, text, uuid, text, text
) TO service_role;

-- 3. Harden RLS policies on immutable & billing-critical tables using app_public.has_tenant_role

-- 3a. modul_audit_logs: STRICTLY APPEND-ONLY / READ-ONLY FOR ADMINS (No UPDATE/DELETE)
DROP POLICY IF EXISTS tenant_isolation_policy ON public.modul_audit_logs;
DROP POLICY IF EXISTS tenant_audit_select_policy ON public.modul_audit_logs;
DROP POLICY IF EXISTS tenant_audit_insert_policy ON public.modul_audit_logs;
CREATE POLICY tenant_audit_select_policy ON public.modul_audit_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT app_public.current_tenant_id())
    AND app_public.has_tenant_role(tenant_id, ARRAY['platform_admin', 'org_owner', 'org_admin'])
  );
CREATE POLICY tenant_audit_insert_policy ON public.modul_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT app_public.current_tenant_id()));

-- 3b. modul_subscriptions, modul_entitlement_overrides, modul_usage_events:
--     Tenant members can SELECT their own tenant rows; mutations ONLY via service_role/BFF!
DO $$
DECLARE
  ro_tbl text;
BEGIN
  FOREACH ro_tbl IN ARRAY ARRAY[
    'modul_subscriptions',
    'modul_entitlement_overrides',
    'modul_usage_events'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I;', ro_tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_billing_readonly_policy ON public.%I;', ro_tbl);
    EXECUTE format(
      'CREATE POLICY tenant_billing_readonly_policy ON public.%I FOR SELECT TO authenticated USING (tenant_id = (SELECT app_public.current_tenant_id()));',
      ro_tbl
    );
  END LOOP;
END $$;

-- 3c. Admin-managed settings, rules, pricing, members: SELECT for tenant members, WRITE for org_owner/org_admin/platform_admin
DO $$
DECLARE
  adm_tbl text;
BEGIN
  FOREACH adm_tbl IN ARRAY ARRAY[
    'modul_tenant_settings',
    'modul_construction_rules',
    'modul_pricing_rules',
    'modul_organization_members',
    'modul_integration_connections'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I;', adm_tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_member_read_policy ON public.%I;', adm_tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_admin_write_policy ON public.%I;', adm_tbl);
    EXECUTE format(
      'CREATE POLICY tenant_member_read_policy ON public.%I FOR SELECT TO authenticated USING (tenant_id = (SELECT app_public.current_tenant_id()));',
      adm_tbl
    );
    EXECUTE format(
      'CREATE POLICY tenant_admin_write_policy ON public.%I FOR ALL TO authenticated USING (tenant_id = (SELECT app_public.current_tenant_id()) AND app_public.has_tenant_role(tenant_id, ARRAY[''platform_admin'',''org_owner'',''org_admin''])) WITH CHECK (tenant_id = (SELECT app_public.current_tenant_id()) AND app_public.has_tenant_role(tenant_id, ARRAY[''platform_admin'',''org_owner'',''org_admin'']));',
      adm_tbl
    );
  END LOOP;
END $$;

COMMIT;
