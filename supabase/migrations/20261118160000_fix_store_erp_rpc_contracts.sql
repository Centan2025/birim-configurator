-- ============================================================================
-- Birim Configurator V12.0 — Store Quotation & Portal ERP Nesting Atomic RPCs
-- Fixes P0-INT-04: Aligns PostgreSQL RPC signatures with SupabaseStoreRpcAdapter
-- and SupabaseErpNestingRpcAdapter, and persists rows atomically (non-no-op).
-- Strategy: Additive CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE FUNCTION
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.configurator_projects (
  id text PRIMARY KEY,
  organization_id uuid NOT NULL,
  branch_id text,
  title text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  compatibility_status text NOT NULL DEFAULT 'UNVERIFIED',
  can_export_production boolean NOT NULL DEFAULT false,
  project_payload jsonb NOT NULL,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saved_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  quotation_no text NOT NULL UNIQUE,
  configurator_project_id text,
  configurator_version integer NOT NULL DEFAULT 1,
  customer_id uuid,
  customer_name text,
  branch_id text,
  currency text NOT NULL DEFAULT 'TRY',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  compatibility_status text NOT NULL DEFAULT 'UNVERIFIED',
  can_export_production boolean NOT NULL DEFAULT false,
  quotation_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  request_hash text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_quotations_org_idemp
  ON public.saved_quotations (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.configurator_production_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  order_ref text NOT NULL,
  configurator_project_id text NOT NULL,
  configurator_version integer NOT NULL DEFAULT 1,
  compatibility_status text NOT NULL,
  blueprint_payload jsonb NOT NULL,
  nesting_bundle jsonb NOT NULL,
  scm_xcs_program text,
  blum_bxf_xml text,
  idempotency_key text,
  request_hash text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

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
BEGIN
  IF p_auto_convert_to_order AND NOT p_can_export_production THEN
    RAISE EXCEPTION 'Üretim kapısı kilitli (%): Doğrulanmamış tasarım siparişe dönüştürülemez.', p_compatibility_status
      USING ERRCODE = '22023';
  END IF;

  v_lock_key := hashtextextended(COALESCE(p_idempotency_key, v_quotation_id::text), 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

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
    v_subtotal := v_subtotal + COALESCE((v_line_rec->>'subtotal')::numeric, 0);
    v_discount_total := v_discount_total + COALESCE((v_line_rec->>'discountAmount')::numeric, 0);
    v_tax_total := v_tax_total + COALESCE((v_line_rec->>'vatAmount')::numeric, 0);
    v_total_amount := v_total_amount + COALESCE((v_line_rec->>'totalPrice')::numeric, 0);
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
    updated_at = now();

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

CREATE OR REPLACE FUNCTION public.publish_configurator_erp_nesting_atomic(
  p_session_org_id uuid,
  p_configurator_project_id text,
  p_configurator_version integer DEFAULT 1,
  p_order_ref text DEFAULT NULL,
  p_nesting_bundle jsonb DEFAULT '{}'::jsonb,
  p_blueprint_payload jsonb DEFAULT '{}'::jsonb,
  p_compatibility_status text DEFAULT 'COMPATIBLE',
  p_can_export_production boolean DEFAULT true,
  p_sales_card_id uuid DEFAULT NULL,
  p_quotation_id uuid DEFAULT NULL,
  p_branch_input text DEFAULT NULL,
  p_scm_xcs_program text DEFAULT NULL,
  p_blum_bxf_xml text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_request_hash text DEFAULT NULL,
  p_session_user_id uuid DEFAULT NULL,
  p_session_username text DEFAULT 'configurator_bff',
  p_session_role text DEFAULT 'admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_lock_key bigint;
  v_blueprint_id uuid := gen_random_uuid();
  v_job_rec jsonb;
  v_sheet_rec jsonb;
  v_pl_rec jsonb;
  v_project_id uuid;
  v_sheet_id uuid;
  v_project_ids jsonb := '[]'::jsonb;
  v_inserted_sheets integer := 0;
  v_inserted_parts integer := 0;
  v_inserted_placements integer := 0;
BEGIN
  IF NOT p_can_export_production OR p_compatibility_status IN ('INCOMPATIBLE', 'UNVERIFIED') THEN
    RAISE EXCEPTION 'Üretim kapısı kilitli (%): ERP Nesting aktarımı reddedildi.', p_compatibility_status
      USING ERRCODE = '22023';
  END IF;

  v_lock_key := hashtextextended(COALESCE(p_idempotency_key, p_order_ref, p_configurator_project_id), 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  INSERT INTO public.configurator_production_blueprints (
    id, organization_id, order_ref, configurator_project_id, configurator_version,
    compatibility_status, blueprint_payload, nesting_bundle,
    scm_xcs_program, blum_bxf_xml, idempotency_key, request_hash, created_by
  ) VALUES (
    v_blueprint_id, p_session_org_id, COALESCE(p_order_ref, 'SIP-' || p_configurator_project_id),
    p_configurator_project_id, p_configurator_version,
    p_compatibility_status, p_blueprint_payload, p_nesting_bundle,
    p_scm_xcs_program, p_blum_bxf_xml, p_idempotency_key, p_request_hash, p_session_username
  );

  FOR v_job_rec IN SELECT * FROM jsonb_array_elements(COALESCE(p_nesting_bundle->'jobs', '[]'::jsonb))
  LOOP
    v_project_id := gen_random_uuid();
    v_project_ids := v_project_ids || to_jsonb(v_project_id::text);
    v_inserted_parts := v_inserted_parts + COALESCE(jsonb_array_length(COALESCE(v_job_rec->'part_records', '[]'::jsonb)), 0);

    IF to_regclass('public.nesting_projects') IS NOT NULL THEN
      INSERT INTO public.nesting_projects (id, name, status)
      VALUES (v_project_id, COALESCE(v_job_rec->>'job_title', p_order_ref, 'Configurator Job'), 'ready')
      ON CONFLICT DO NOTHING;
    END IF;

    FOR v_sheet_rec IN SELECT * FROM jsonb_array_elements(COALESCE(v_job_rec->'optimization_result'->'sheets', '[]'::jsonb))
    LOOP
      v_sheet_id := gen_random_uuid();
      v_inserted_sheets := v_inserted_sheets + 1;
      IF to_regclass('public.nesting_sheets') IS NOT NULL THEN
        INSERT INTO public.nesting_sheets (
          id, nesting_project_id, material_type, thickness_mm, width_mm, height_mm, waste_ratio
        ) VALUES (
          v_sheet_id,
          v_project_id,
          COALESCE(v_job_rec->>'material_name', 'MDFLAM'),
          COALESCE((v_job_rec->>'thickness_mm')::numeric, 18),
          COALESCE((v_sheet_rec->>'width_mm')::numeric, 2800),
          COALESCE((v_sheet_rec->>'height_mm')::numeric, 2100),
          COALESCE((v_sheet_rec->>'waste_percent')::numeric, 0)
        );
      END IF;

      FOR v_pl_rec IN SELECT * FROM jsonb_array_elements(COALESCE(v_sheet_rec->'placements', '[]'::jsonb))
      LOOP
        v_inserted_placements := v_inserted_placements + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'blueprintId', v_blueprint_id,
    'orderRef', COALESCE(p_order_ref, 'SIP-' || p_configurator_project_id),
    'nestingJobsCount', jsonb_array_length(COALESCE(p_nesting_bundle->'jobs', '[]'::jsonb)),
    'nestingProjectIds', v_project_ids,
    'totalSheetsUsed', v_inserted_sheets,
    'totalPartsInserted', v_inserted_parts,
    'totalPlacementsInserted', v_inserted_placements,
    'publishedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_configurator_store_quotation_atomic(
  uuid, text, integer, text, jsonb, jsonb, text, uuid, uuid, text, text, text, boolean, boolean, jsonb, jsonb, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.publish_configurator_erp_nesting_atomic(
  uuid, text, integer, text, jsonb, jsonb, text, boolean, uuid, uuid, text, text, text, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_configurator_store_quotation_atomic(
  uuid, text, integer, text, jsonb, jsonb, text, uuid, uuid, text, text, text, boolean, boolean, jsonb, jsonb, text, text, uuid, text, text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.publish_configurator_erp_nesting_atomic(
  uuid, text, integer, text, jsonb, jsonb, text, boolean, uuid, uuid, text, text, text, text, text, uuid, text, text
) TO service_role;

COMMIT;

-- ============================================================================
-- ROLLBACK STRATEGY (Run manually only if reverting V12.0 RPC contract):
-- DROP FUNCTION IF EXISTS public.upsert_configurator_store_quotation_atomic(uuid, text, integer, text, jsonb, jsonb, text, uuid, uuid, text, text, text, boolean, boolean, jsonb, jsonb, text, text, uuid, text, text);
-- DROP FUNCTION IF EXISTS public.publish_configurator_erp_nesting_atomic(uuid, text, integer, text, jsonb, jsonb, text, boolean, uuid, uuid, text, text, text, text, text, uuid, text, text);
-- ============================================================================
