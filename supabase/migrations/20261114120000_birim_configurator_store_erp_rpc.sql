-- ============================================================================
-- Birim Configurator V7.3 — Birim-Store Quotation & Birim-Portal ERP Nesting
-- Atomic Supabase PostgreSQL RPC Bridge (K-03 Security Hardened)
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_configurator_store_quotation_atomic(
  p_project jsonb,
  p_bom jsonb,
  p_pricing jsonb,
  p_reconciled_lines jsonb,
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
  p_session_role text DEFAULT 'sales_consultant'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_lock_key bigint;
  v_quotation_id uuid := COALESCE(p_quotation_id, gen_random_uuid());
  v_quotation_no text;
  v_total_amount numeric(14,2) := COALESCE((p_pricing->>'totalWithVatEur')::numeric, 0);
  v_line_count integer := COALESCE(jsonb_array_length(COALESCE(p_reconciled_lines, '[]'::jsonb)), 0);
BEGIN
  v_lock_key := hashtextextended(COALESCE(p_idempotency_key, v_quotation_id::text), 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  v_quotation_no := 'BRM-QT-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_quotation_id::text, '-', ''), 1, 6);

  RETURN jsonb_build_object(
    'quotationId', v_quotation_id,
    'quotationNo', upper(v_quotation_no),
    'branchId', COALESCE(p_branch_input, 'merkez'),
    'totalAmount', v_total_amount,
    'lineCount', v_line_count,
    'compatibilityStatus', p_compatibility_status,
    'canExportProduction', p_can_export_production,
    'syncedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_configurator_erp_nesting_atomic(
  p_project jsonb,
  p_nesting_bundle jsonb,
  p_organization_id text DEFAULT 'org_birim_fabrika',
  p_order_ref text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_request_hash text DEFAULT NULL,
  p_session_user_id uuid DEFAULT NULL,
  p_session_username text DEFAULT 'configurator_bff'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_lock_key bigint;
  v_nesting_project_id uuid := gen_random_uuid();
  v_sheet_rec jsonb;
  v_pl_rec jsonb;
  v_sheet_id uuid;
  v_part_id uuid;
  v_inserted_sheets integer := 0;
  v_inserted_placements integer := 0;
BEGIN
  v_lock_key := hashtextextended(COALESCE(p_idempotency_key, p_order_ref, v_nesting_project_id::text), 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  IF to_regclass('public.nesting_sheets') IS NOT NULL THEN
    FOR v_sheet_rec IN SELECT * FROM jsonb_array_elements(COALESCE(p_nesting_bundle->'sheets', '[]'::jsonb))
    LOOP
      v_sheet_id := gen_random_uuid();
      INSERT INTO public.nesting_sheets (
        id,
        nesting_project_id,
        material_type,
        thickness_mm,
        width_mm,
        height_mm,
        waste_ratio
      ) VALUES (
        v_sheet_id,
        v_nesting_project_id,
        COALESCE(v_sheet_rec->>'material_type', 'MDFLAM'),
        COALESCE((v_sheet_rec->>'thickness_mm')::numeric, 18),
        COALESCE((v_sheet_rec->>'width_mm')::numeric, 2800),
        COALESCE((v_sheet_rec->>'height_mm')::numeric, 2100),
        COALESCE((v_sheet_rec->>'waste_ratio')::numeric, 0)
      );
      v_inserted_sheets := v_inserted_sheets + 1;

      IF to_regclass('public.nesting_placements') IS NOT NULL THEN
        FOR v_pl_rec IN SELECT * FROM jsonb_array_elements(COALESCE(v_sheet_rec->'placements', '[]'::jsonb))
        LOOP
          v_part_id := COALESCE(NULLIF(v_pl_rec->>'part_id', '')::uuid, gen_random_uuid());
          INSERT INTO public.nesting_placements (
            id,
            sheet_id,
            part_id,
            x_mm,
            y_mm,
            placed_width_mm,
            placed_height_mm,
            rotated
          ) VALUES (
            gen_random_uuid(),
            v_sheet_id,
            v_part_id,
            COALESCE((v_pl_rec->>'x_mm')::numeric, 0),
            COALESCE((v_pl_rec->>'y_mm')::numeric, 0),
            COALESCE((v_pl_rec->>'placed_width_mm')::numeric, 0),
            COALESCE((v_pl_rec->>'placed_height_mm')::numeric, 0),
            COALESCE((v_pl_rec->>'rotated')::boolean, false)
          );
          v_inserted_placements := v_inserted_placements + 1;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'nestingProjectId', v_nesting_project_id,
    'insertedSheets', v_inserted_sheets,
    'insertedPlacements', v_inserted_placements,
    'publishedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_configurator_store_quotation_atomic FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_configurator_erp_nesting_atomic FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_configurator_store_quotation_atomic TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_configurator_erp_nesting_atomic TO service_role;

COMMIT;
