-- ============================================================================
-- MIGRATION: 20261114120000_birim_configurator_store_erp_rpc.sql
-- AMAÇ     : Birim Configurator V7.3 <-> Birim-Store Teklif Akışı &
--            Birim-Portal ERP Nesting Tabloları Canlı Atomik Supabase RPC Köprüsü
-- UYUMLULUK:
--   1. Centan2025/birim-store & Centan2025/birim-portal ortak veritabanı sözleşmesi
--      (20261111160000_store_portal_contract_alignment.sql ile %100 uyumlu).
--   2. convert_store_quotation_to_order_atomic ile sıfır kuruş farkı (0.00 delta)
--      garantili quotation_data.lines ve saved_quotation_items üretimi.
--   3. Birim-Portal lib/nestingService.ts ile birebir uyumlu nesting_sheets
--      (material_type '[grain:vertical|none]' formatı), nesting_projects (NST-YYYY-XXXX),
--      nesting_parts (serializeEdgeBanding JSON) ve nesting_placements (UUID part_id FK)
--      tek-işlem (single-transaction) atomik yazımı.
--   4. K-03 Güvenlik Standardı: SECURITY DEFINER + SET search_path TO 'public', 'pg_temp'
--      + REVOKE ALL FROM PUBLIC, anon, authenticated + GRANT EXECUTE TO service_role.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. İdempotensi Tablosu Güvencesi (Mevcutsa dokunmaz, taze ortamda oluşturur)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_idempotency_keys (
  idempotency_key text NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  request_hash text NOT NULL,
  response_payload jsonb,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT pk_store_idempotency_keys PRIMARY KEY (organization_id, idempotency_key),
  CONSTRAINT chk_store_idempotency_status CHECK (status IN ('processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_store_idempotency_expires
  ON public.store_idempotency_keys(expires_at);

ALTER TABLE public.store_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Configurator Proje & Üretim Reçetesi İzlenebilirlik Tabloları (Forward-Only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configurator_projects (
  id text PRIMARY KEY,
  organization_id uuid,
  branch_id uuid,
  branch_code text NOT NULL DEFAULT 'branch_main',
  quotation_id uuid,
  sales_card_id uuid,
  title text NOT NULL,
  customer_name text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  compatibility_status text NOT NULL DEFAULT 'COMPATIBLE',
  can_export_production boolean NOT NULL DEFAULT true,
  total_with_vat_eur numeric(14,2) NOT NULL DEFAULT 0,
  total_with_vat_try numeric(14,2) NOT NULL DEFAULT 0,
  modules_count integer NOT NULL DEFAULT 1,
  scene_objects_count integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configurator_projects
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS quotation_id uuid,
  ADD COLUMN IF NOT EXISTS sales_card_id uuid,
  ADD COLUMN IF NOT EXISTS compatibility_status text DEFAULT 'COMPATIBLE',
  ADD COLUMN IF NOT EXISTS can_export_production boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_with_vat_try numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch_code text DEFAULT 'branch_main',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_configurator_projects_org_updated
  ON public.configurator_projects(organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_configurator_projects_quotation
  ON public.configurator_projects(quotation_id)
  WHERE quotation_id IS NOT NULL;

ALTER TABLE public.configurator_projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.configurator_production_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  branch_id uuid,
  configurator_project_id text NOT NULL,
  configurator_version integer NOT NULL DEFAULT 1,
  order_ref text NOT NULL,
  sales_card_id uuid,
  quotation_id uuid,
  compatibility_status text NOT NULL,
  items_count integer NOT NULL DEFAULT 0,
  nesting_jobs_count integer NOT NULL DEFAULT 0,
  total_sheets_used integer NOT NULL DEFAULT 0,
  overall_utilization_percent numeric(6,2) NOT NULL DEFAULT 0,
  reclaimable_remnants_count integer NOT NULL DEFAULT 0,
  nesting_project_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  nesting_project_nos text[] NOT NULL DEFAULT '{}'::text[],
  combined_selco_csv text,
  combined_cnc_gcode text,
  scm_xcs_program text,
  blum_bxf_xml text,
  blueprint_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'birim-configurator',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conf_blueprints_org_order
  ON public.configurator_production_blueprints(organization_id, order_ref);

CREATE INDEX IF NOT EXISTS idx_conf_blueprints_sales_card
  ON public.configurator_production_blueprints(sales_card_id)
  WHERE sales_card_id IS NOT NULL;

ALTER TABLE public.configurator_production_blueprints ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. Yardımcı Fonksiyon: Şube UUID / Kod Çözümleyici (22P02 UUID Hatasını Önler)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_birim_branch_uuid(
  p_org_id uuid,
  p_branch_input text,
  p_fallback_branch uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_clean text;
  v_resolved uuid;
BEGIN
  v_clean := trim(COALESCE(p_branch_input, ''));
  IF v_clean = '' THEN
    RETURN p_fallback_branch;
  END IF;

  IF v_clean ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN v_clean::uuid;
  END IF;

  IF to_regclass('public.branches') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'SELECT id FROM public.branches
         WHERE organization_id = $1
           AND (lower(COALESCE(code, '''')) = lower($2) OR lower(COALESCE(name, '''')) = lower($2))
         LIMIT 1'
      INTO v_resolved
      USING p_org_id, replace(v_clean, 'branch_', '');
    EXCEPTION WHEN OTHERS THEN
      v_resolved := NULL;
    END;
  END IF;

  RETURN COALESCE(v_resolved, p_fallback_branch);
END;
$function$;

-- ----------------------------------------------------------------------------
-- 4. RPC 1: Atomik Birim-Store Teklif Kalemi Oluşturma / Güncelleme (+ İsteğe Bağlı Sipariş Dönüşümü)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_configurator_store_quotation_atomic(
  p_session_org_id uuid,
  p_configurator_project_id text,
  p_configurator_version integer,
  p_project_title text,
  p_project_payload jsonb,
  p_lines jsonb,
  p_currency text DEFAULT 'TRY'::text,
  p_quotation_id uuid DEFAULT NULL::uuid,
  p_customer_id uuid DEFAULT NULL::uuid,
  p_customer_name text DEFAULT NULL::text,
  p_branch_input text DEFAULT NULL::text,
  p_compatibility_status text DEFAULT 'COMPATIBLE'::text,
  p_can_export_production boolean DEFAULT true,
  p_auto_convert_to_order boolean DEFAULT false,
  p_order_draft jsonb DEFAULT NULL::jsonb,
  p_active_rates jsonb DEFAULT NULL::jsonb,
  p_idempotency_key text DEFAULT NULL::text,
  p_request_hash text DEFAULT NULL::text,
  p_session_user_id uuid DEFAULT NULL::uuid,
  p_session_username text DEFAULT NULL::text,
  p_session_role text DEFAULT 'sales_rep'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_profile record;
  v_effective_role text;
  v_effective_branch uuid;
  v_requested_branch uuid;
  v_sales_person text;
  v_existing_idemp record;
  v_quote public.saved_quotations%ROWTYPE;
  v_is_update boolean := false;
  v_quote_id uuid;
  v_quote_no text;
  v_revision integer := 0;
  v_version integer := 1;
  v_currency text;
  v_existing_qd jsonb := '{}'::jsonb;
  v_kept_lines jsonb := '[]'::jsonb;
  v_merged_lines jsonb := '[]'::jsonb;
  v_line record;
  v_line_count integer := 0;
  v_subtotal numeric(14,2) := 0;
  v_discount_total numeric(14,2) := 0;
  v_tax_total numeric(14,2) := 0;
  v_total_amount numeric(14,2) := 0;
  v_expected_net numeric(14,2);
  v_expected_vat numeric(14,2);
  v_expected_tot numeric(14,2);
  v_new_qd jsonb;
  v_total_eur numeric(14,2) := 0;
  v_order_result jsonb := NULL;
  v_sales_card_id uuid := NULL;
  v_sales_no text := NULL;
  v_result_json jsonb;
BEGIN
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '15s';

  IF p_session_org_id IS NULL THEN
    RAISE EXCEPTION 'Organizasyon ID (p_session_org_id) zorunludur.' USING ERRCODE = '22023';
  END IF;

  IF p_configurator_project_id IS NULL OR trim(p_configurator_project_id) = '' THEN
    RAISE EXCEPTION 'Konfigüratör proje kimliği zorunludur.' USING ERRCODE = '22023';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Teklife aktarılacak en az bir geçerli konfigüratör satırı bulunmalıdır.' USING ERRCODE = '22023';
  END IF;

  -- 1. Kullanıcı profili ve kiracı/rol doğrulaması
  IF p_session_user_id IS NOT NULL AND to_regclass('public.profiles') IS NOT NULL THEN
    SELECT id, username, role, branch_id, organization_id, is_active
    INTO v_user_profile
    FROM public.profiles
    WHERE id = p_session_user_id;

    IF FOUND THEN
      IF v_user_profile.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Kullanıcı hesabı pasif durumdadır.' USING ERRCODE = '42501';
      END IF;
      IF v_user_profile.organization_id <> p_session_org_id THEN
        RAISE EXCEPTION 'Kiracı uyuşmazlığı: Kullanıcı bu organizasyona ait değil.' USING ERRCODE = '42501';
      END IF;
      v_effective_role := COALESCE(v_user_profile.role, p_session_role);
      v_effective_branch := v_user_profile.branch_id;
      v_sales_person := COALESCE(NULLIF(p_session_username, ''), v_user_profile.username, 'Birim Configurator');
    ELSE
      v_effective_role := p_session_role;
      v_effective_branch := NULL;
      v_sales_person := COALESCE(NULLIF(p_session_username, ''), 'Birim Configurator');
    END IF;
  ELSE
    v_effective_role := p_session_role;
    v_effective_branch := NULL;
    v_sales_person := COALESCE(NULLIF(p_session_username, ''), 'Birim Configurator');
  END IF;

  v_requested_branch := public.resolve_birim_branch_uuid(
    p_session_org_id,
    p_branch_input,
    v_effective_branch
  );
  v_effective_branch := COALESCE(v_effective_branch, v_requested_branch);

  IF COALESCE(v_effective_role, '') IN ('operator', 'receptionist') OR v_sales_person LIKE 'opr_%' THEN
    RAISE EXCEPTION 'Forbidden — Operatör/kiosk hesaplarının mağaza teklifi oluşturma yetkisi yoktur.'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_effective_role, '') NOT IN (
    'store_manager', 'branch_manager', 'sales_rep', 'sales_manager',
    'admin', 'super_admin', 'executive', 'owner'
  ) THEN
    RAISE EXCEPTION 'Forbidden — Bu işlem için yetkiniz bulunmamaktadır (Rol: %).', COALESCE(v_effective_role, 'tanımsız')
      USING ERRCODE = '42501';
  END IF;

  -- 2. Dağıtık İdempotensi Kontrolü (FOR UPDATE)
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_idemp
    FROM public.store_idempotency_keys
    WHERE organization_id = p_session_org_id
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
      IF v_existing_idemp.status = 'completed' THEN
        IF p_request_hash IS NULL OR v_existing_idemp.request_hash = p_request_hash THEN
          RETURN v_existing_idemp.response_payload;
        ELSE
          RAISE EXCEPTION 'Conflict — Bu Idempotency-Key farklı tasarım/fiyat parametreleriyle daha önce kullanılmıştır.'
            USING ERRCODE = '23505';
        END IF;
      ELSIF v_existing_idemp.status = 'processing' THEN
        RAISE EXCEPTION 'Conflict — Bu teklif aktarımı için eşzamanlı bir işlem devam etmektedir.'
          USING ERRCODE = '55P03';
      END IF;
    END IF;
  END IF;

  -- Siparişe otomatik dönüşüm istendiyse mühendislik üretim kapısı açık olmalıdır
  IF p_auto_convert_to_order IS TRUE AND (
    p_can_export_production IS NOT TRUE
    OR COALESCE(p_compatibility_status, 'UNVERIFIED') IN ('INCOMPATIBLE', 'UNVERIFIED')
  ) THEN
    RAISE EXCEPTION 'Mühendislik kapısı kilitli (Durum: %): Doğrulanmamış veya P0 hatalı tasarım doğrudan siparişe dönüştürülemez.',
      COALESCE(p_compatibility_status, 'UNVERIFIED')
      USING ERRCODE = '22023';
  END IF;

  v_currency := UPPER(COALESCE(NULLIF(trim(p_currency), ''), 'TRY'));

  -- 3. Mevcut Teklif Güncelleme mi Yeni Teklif mi?
  IF p_quotation_id IS NOT NULL THEN
    SELECT * INTO v_quote
    FROM public.saved_quotations
    WHERE id = p_quotation_id
      AND organization_id = p_session_org_id
      AND COALESCE(is_deleted, false) = false
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Güncellenecek mağaza teklifi bulunamadı (%).', p_quotation_id
        USING ERRCODE = 'P0002';
    END IF;

    IF COALESCE(v_quote.is_sold, false) = true OR v_quote.status IN ('sold', 'converted_to_order') THEN
      RAISE EXCEPTION 'Conflict — Siparişe dönüştürülmüş teklif güncellenemez; lütfen önce yeni revizyon açın.'
        USING ERRCODE = '23505';
    END IF;

    IF COALESCE(v_quote.is_superseded, false) = true OR v_quote.status = 'superseded' THEN
      RAISE EXCEPTION 'Conflict — Geçersiz kılınmış (superseded) eski teklif revizyonu güncellenemez.'
        USING ERRCODE = '23505';
    END IF;

    IF v_effective_role IN ('store_manager', 'branch_manager', 'sales_rep') THEN
      IF v_effective_branch IS NULL OR v_quote.branch_id IS NULL OR v_quote.branch_id <> v_effective_branch THEN
        RAISE EXCEPTION 'Forbidden — Başka şubeye ait teklif güncellenemez.'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    v_is_update := true;
    v_quote_id := v_quote.id;
    v_quote_no := v_quote.quotation_no;
    v_revision := COALESCE(v_quote.revision, 0);
    v_version := COALESCE(v_quote.version, 1) + 1;
    v_currency := UPPER(COALESCE(NULLIF(v_quote.currency, ''), v_currency));

    IF v_quote.quotation_data IS NOT NULL THEN
      IF jsonb_typeof(v_quote.quotation_data) = 'string' THEN
        v_existing_qd := (v_quote.quotation_data #>> '{}')::jsonb;
      ELSE
        v_existing_qd := v_quote.quotation_data;
      END IF;
    END IF;

    -- Aynı teklifteki diğer mağaza ürünlerini koru, sadece bu konfigüratör projesine ait eski satırları yenileriyle değiştir
    IF jsonb_typeof(v_existing_qd->'lines') = 'array' THEN
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      INTO v_kept_lines
      FROM jsonb_array_elements(v_existing_qd->'lines') AS elem
      WHERE COALESCE(elem->>'configuratorProjectId', '') <> p_configurator_project_id;
    END IF;
  ELSE
    v_quote_id := gen_random_uuid();
    BEGIN
      v_quote_no := public.generate_sequence_number(
        'TKL-' || to_char(now(), 'YYYY') || '-',
        4,
        p_session_org_id
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Teklif sıra numarası üretilemedi (fail-closed): %', SQLERRM
        USING ERRCODE = 'XX000';
    END;

    IF v_quote_no IS NULL OR trim(v_quote_no) = '' THEN
      RAISE EXCEPTION 'Teklif sıra numarası boş döndü.' USING ERRCODE = 'XX000';
    END IF;
  END IF;

  v_merged_lines := v_kept_lines || p_lines;

  -- 4. convert_store_quotation_to_order_atomic ile %100 Birebir Satır Aritmetiği Doğrulaması & Toplam Hesabı
  FOR v_line IN
    SELECT
      (row_number() OVER () - 1)::integer AS idx,
      COALESCE(elem->>'sku', elem->>'base_sku', 'CFG-ITEM') AS sku,
      COALESCE(elem->>'name', elem->>'title', 'Özel Üretim Modül') AS title,
      COALESCE(elem->>'unit', 'adet') AS unit,
      COALESCE(NULLIF(elem->>'quantity', '')::numeric, 0) AS quantity,
      COALESCE(NULLIF(elem->>'unitPrice', '')::numeric, 0) AS unit_price,
      UPPER(COALESCE(elem->>'currency', v_currency)) AS currency,
      COALESCE(NULLIF(elem->>'discountRate', '')::numeric, 0) AS discount_rate,
      COALESCE(NULLIF(elem->>'discountAmount', '')::numeric, 0) AS discount_amount,
      COALESCE(NULLIF(elem->>'vatRate', '')::numeric, 20) AS vat_rate,
      COALESCE(NULLIF(elem->>'subtotal', '')::numeric, 0) AS subtotal,
      COALESCE(NULLIF(elem->>'vatAmount', '')::numeric, 0) AS vat_amount,
      COALESCE(NULLIF(elem->>'totalPrice', '')::numeric, 0) AS total_price,
      COALESCE(NULLIF(elem->>'calculatedPriceEur', '')::numeric, 0) AS calc_eur
    FROM jsonb_array_elements(v_merged_lines) AS elem
    WHERE COALESCE((elem->>'isSectionHeader')::boolean, false) = false
  LOOP
    IF v_line.quantity <= 0 THEN
      RAISE EXCEPTION 'Satır % (%): Miktar pozitif olmalıdır.', v_line.idx + 1, v_line.sku
        USING ERRCODE = '22023';
    END IF;
    IF v_line.unit_price <= 0 OR v_line.total_price <= 0 THEN
      RAISE EXCEPTION 'Satır % (%): Birim fiyat ve toplam tutar pozitif olmalıdır.', v_line.idx + 1, v_line.sku
        USING ERRCODE = '22023';
    END IF;
    IF v_line.vat_rate < 0 OR v_line.vat_rate > 25 OR v_line.discount_amount < 0 THEN
      RAISE EXCEPTION 'Satır % (%): Geçersiz KDV veya iskonto değeri.', v_line.idx + 1, v_line.sku
        USING ERRCODE = '22023';
    END IF;
    IF v_line.currency <> v_currency THEN
      RAISE EXCEPTION 'Satır % (%): Para birimi uyumsuzluğu (% vs %).',
        v_line.idx + 1, v_line.sku, v_line.currency, v_currency
        USING ERRCODE = '22023';
    END IF;

    v_expected_net := round(GREATEST(0, v_line.unit_price * v_line.quantity - v_line.discount_amount), 2);
    v_expected_vat := round(v_expected_net * (v_line.vat_rate / 100.0), 2);
    v_expected_tot := round(v_expected_net + v_expected_vat, 2);

    IF abs(v_line.subtotal - v_expected_net) > 0.05 OR abs(v_line.total_price - v_expected_tot) > 0.10 THEN
      RAISE EXCEPTION 'Satır % (%): Satır aritmetiği tutarsız (beklenen: %, gelen: %).',
        v_line.idx + 1, v_line.sku, v_expected_tot, v_line.total_price
        USING ERRCODE = '22023';
    END IF;

    v_subtotal := round(v_subtotal + v_line.subtotal, 2);
    v_discount_total := round(v_discount_total + v_line.discount_amount, 2);
    v_tax_total := round(v_tax_total + v_line.vat_amount, 2);
    v_total_amount := round(v_total_amount + v_line.total_price, 2);
    v_total_eur := round(v_total_eur + v_line.calc_eur, 2);
    v_line_count := v_line_count + 1;
  END LOOP;

  v_new_qd := v_existing_qd || jsonb_build_object(
    'lines', v_merged_lines,
    'studioLines', v_merged_lines,
    'vatMode', 'bottom',
    'currency', v_currency,
    'customerName', COALESCE(NULLIF(p_customer_name, ''), v_existing_qd->>'customerName', 'Müşteri'),
    'activeRates', COALESCE(p_active_rates, v_existing_qd->'activeRates', jsonb_build_object('EUR', 41.80, 'USD', 38.50)),
    'configuratorMeta', jsonb_build_object(
      'projectId', p_configurator_project_id,
      'version', p_configurator_version,
      'compatibilityStatus', COALESCE(p_compatibility_status, 'COMPATIBLE'),
      'canExportProduction', COALESCE(p_can_export_production, true),
      'syncedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );

  IF p_order_draft IS NOT NULL AND jsonb_typeof(p_order_draft) = 'object' THEN
    v_new_qd := jsonb_set(v_new_qd, '{orderDraft}', p_order_draft, true);
  END IF;

  -- 5. saved_quotations Kayıt / Güncelleme
  IF v_is_update THEN
    UPDATE public.saved_quotations
    SET project_name = COALESCE(NULLIF(p_project_title, ''), project_name),
        customer_id = COALESCE(p_customer_id, customer_id),
        subtotal = v_subtotal,
        discount_total = v_discount_total,
        tax_total = v_tax_total,
        total_amount = v_total_amount,
        currency = v_currency,
        sales_person = COALESCE(NULLIF(v_sales_person, ''), sales_person),
        quotation_data = v_new_qd,
        version = v_version,
        updated_at = now()
    WHERE id = v_quote_id
      AND organization_id = p_session_org_id;
  ELSE
    INSERT INTO public.saved_quotations (
      id,
      organization_id,
      branch_id,
      quotation_no,
      customer_id,
      project_name,
      revision,
      status,
      is_sold,
      is_superseded,
      is_deleted,
      subtotal,
      discount_total,
      tax_total,
      total_amount,
      currency,
      sales_person,
      user_id,
      quotation_data,
      valid_until,
      version,
      created_at,
      updated_at
    ) VALUES (
      v_quote_id,
      p_session_org_id,
      v_requested_branch,
      v_quote_no,
      p_customer_id,
      COALESCE(NULLIF(p_project_title, ''), 'Birim Configurator Projesi'),
      0,
      'draft',
      false,
      false,
      false,
      v_subtotal,
      v_discount_total,
      v_tax_total,
      v_total_amount,
      v_currency,
      v_sales_person,
      p_session_user_id,
      v_new_qd,
      now() + interval '30 days',
      1,
      now(),
      now()
    );
  END IF;

  -- 6. saved_quotation_items Tablosu Mevcutsa Senkronize Et
  IF to_regclass('public.saved_quotation_items') IS NOT NULL THEN
    DELETE FROM public.saved_quotation_items
    WHERE quotation_id = v_quote_id
      AND organization_id = p_session_org_id;

    INSERT INTO public.saved_quotation_items (
      quotation_id,
      organization_id,
      sku,
      title,
      quantity,
      unit,
      unit_price,
      unit_cost,
      expected_margin,
      discount_rate,
      vat_rate,
      total_price,
      currency
    )
    SELECT
      v_quote_id,
      p_session_org_id,
      NULLIF(COALESCE(elem->>'sku', ''), ''),
      COALESCE(elem->>'name', elem->>'title', 'Ürün'),
      GREATEST(1, COALESCE(NULLIF(elem->>'quantity', '')::numeric, 1)),
      COALESCE(elem->>'unit', 'adet'),
      COALESCE(NULLIF(elem->>'unitPrice', '')::numeric, 0),
      COALESCE(NULLIF(elem->>'unitCost', '')::numeric, 0),
      COALESCE(NULLIF(elem->>'expectedMargin', '')::numeric, 35),
      COALESCE(NULLIF(elem->>'discountRate', '')::numeric, 0),
      COALESCE(NULLIF(elem->>'vatRate', '')::numeric, 20),
      COALESCE(NULLIF(elem->>'totalPrice', '')::numeric, 0),
      v_currency
    FROM jsonb_array_elements(v_merged_lines) AS elem
    WHERE COALESCE((elem->>'isSectionHeader')::boolean, false) = false;
  END IF;

  -- 7. İsteğe Bağlı Atomik Sipariş Dönüşümü (convert_store_quotation_to_order_atomic Zinciri)
  IF p_auto_convert_to_order IS TRUE THEN
    v_order_result := public.convert_store_quotation_to_order_atomic(
      v_quote_id,
      CASE WHEN p_idempotency_key IS NOT NULL AND p_idempotency_key <> ''
           THEN p_idempotency_key || ':convert_order'
           ELSE NULL
      END,
      p_request_hash,
      p_session_user_id,
      v_sales_person,
      p_session_org_id,
      COALESCE(v_requested_branch, v_effective_branch),
      v_effective_role
    );
    v_sales_card_id := NULLIF(v_order_result->>'salesCardId', '')::uuid;
    v_sales_no := NULLIF(v_order_result->>'salesNo', '');
  END IF;

  -- 8. configurator_projects Snapshot Güncellemesi
  INSERT INTO public.configurator_projects (
    id,
    organization_id,
    branch_id,
    branch_code,
    quotation_id,
    sales_card_id,
    title,
    customer_name,
    version,
    status,
    compatibility_status,
    can_export_production,
    total_with_vat_eur,
    total_with_vat_try,
    modules_count,
    scene_objects_count,
    payload,
    updated_at
  ) VALUES (
    p_configurator_project_id,
    p_session_org_id,
    v_requested_branch,
    COALESCE(NULLIF(p_branch_input, ''), 'branch_main'),
    v_quote_id,
    v_sales_card_id,
    COALESCE(NULLIF(p_project_title, ''), 'Birim Configurator Projesi'),
    p_customer_name,
    COALESCE(p_configurator_version, 1),
    CASE WHEN v_sales_card_id IS NOT NULL THEN 'ordered' ELSE 'quoted' END,
    COALESCE(p_compatibility_status, 'COMPATIBLE'),
    COALESCE(p_can_export_production, true),
    v_total_eur,
    CASE WHEN v_currency = 'TRY' THEN v_total_amount ELSE 0 END,
    COALESCE(jsonb_array_length(COALESCE(p_project_payload->'modules', '[]'::jsonb)), 1),
    COALESCE(jsonb_array_length(COALESCE(p_project_payload->'sceneObjects', '[]'::jsonb)), 0),
    COALESCE(p_project_payload, '{}'::jsonb),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET organization_id = EXCLUDED.organization_id,
      branch_id = COALESCE(EXCLUDED.branch_id, public.configurator_projects.branch_id),
      branch_code = EXCLUDED.branch_code,
      quotation_id = EXCLUDED.quotation_id,
      sales_card_id = COALESCE(EXCLUDED.sales_card_id, public.configurator_projects.sales_card_id),
      title = EXCLUDED.title,
      customer_name = COALESCE(EXCLUDED.customer_name, public.configurator_projects.customer_name),
      version = EXCLUDED.version,
      status = EXCLUDED.status,
      compatibility_status = EXCLUDED.compatibility_status,
      can_export_production = EXCLUDED.can_export_production,
      total_with_vat_eur = EXCLUDED.total_with_vat_eur,
      total_with_vat_try = EXCLUDED.total_with_vat_try,
      modules_count = EXCLUDED.modules_count,
      scene_objects_count = EXCLUDED.scene_objects_count,
      payload = EXCLUDED.payload,
      updated_at = now();

  v_result_json := jsonb_build_object(
    'success', true,
    'isUpdate', v_is_update,
    'quotationId', v_quote_id,
    'quotationNo', v_quote_no,
    'revision', v_revision,
    'version', v_version,
    'organizationId', p_session_org_id,
    'branchId', v_requested_branch,
    'subtotal', v_subtotal,
    'discountTotal', v_discount_total,
    'taxTotal', v_tax_total,
    'totalAmount', v_total_amount,
    'currency', v_currency,
    'lineCount', v_line_count,
    'configuratorProjectId', p_configurator_project_id,
    'compatibilityStatus', COALESCE(p_compatibility_status, 'COMPATIBLE'),
    'autoConvertedOrder', COALESCE(p_auto_convert_to_order, false),
    'salesCardId', v_sales_card_id,
    'salesNo', v_sales_no,
    'orderResult', v_order_result,
    'syncedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    INSERT INTO public.store_idempotency_keys (
      idempotency_key,
      organization_id,
      user_id,
      request_hash,
      response_payload,
      status,
      created_at,
      expires_at
    ) VALUES (
      p_idempotency_key,
      p_session_org_id,
      COALESCE(p_session_user_id, gen_random_uuid()),
      COALESCE(p_request_hash, ''),
      v_result_json,
      'completed',
      now(),
      now() + interval '24 hours'
    )
    ON CONFLICT (organization_id, idempotency_key) DO UPDATE
    SET response_payload = EXCLUDED.response_payload,
        status = 'completed';
  END IF;

  RETURN v_result_json;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 5. RPC 2: Atomik Birim-Portal ERP Nesting İş Emirleri & Üretim Reçetesi Aktarımı
--    (nesting_sheets + nesting_projects + nesting_parts + nesting_placements + blueprint)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_configurator_erp_nesting_atomic(
  p_session_org_id uuid,
  p_configurator_project_id text,
  p_configurator_version integer,
  p_order_ref text,
  p_nesting_bundle jsonb,
  p_blueprint_payload jsonb,
  p_compatibility_status text,
  p_can_export_production boolean,
  p_sales_card_id uuid DEFAULT NULL::uuid,
  p_quotation_id uuid DEFAULT NULL::uuid,
  p_branch_input text DEFAULT NULL::text,
  p_scm_xcs_program text DEFAULT NULL::text,
  p_blum_bxf_xml text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_request_hash text DEFAULT NULL::text,
  p_session_user_id uuid DEFAULT NULL::uuid,
  p_session_username text DEFAULT NULL::text,
  p_session_role text DEFAULT 'admin'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_profile record;
  v_effective_role text;
  v_effective_branch uuid;
  v_created_by text;
  v_existing_idemp record;
  v_sales_card record;
  v_year_prefix text;
  v_last_project_no text;
  v_next_seq integer := 1;
  v_jobs_json jsonb;
  v_job jsonb;
  v_sheet_input jsonb;
  v_proj_rec jsonb;
  v_opt_res jsonb;
  v_formatted_material text;
  v_sheet_w numeric;
  v_sheet_h numeric;
  v_sheet_t numeric;
  v_sheet_kerf numeric;
  v_sheet_margin numeric;
  v_sheet_cost numeric;
  v_sheet_name text;
  v_sheet_id uuid;
  v_nesting_project_id uuid;
  v_project_no text;
  v_part jsonb;
  v_part_idx integer;
  v_part_uuid uuid;
  v_client_part_id text;
  v_part_map_by_id jsonb;
  v_part_map_by_idx jsonb;
  v_part_map_by_label jsonb;
  v_placement jsonb;
  v_raw_pl_part_id text;
  v_matched_idx text;
  v_resolved_part_uuid uuid;
  v_job_parts_count integer;
  v_job_placements_count integer;
  v_total_parts_inserted integer := 0;
  v_total_placements_inserted integer := 0;
  v_total_sheets_used integer := 0;
  v_created_project_ids uuid[] := '{}'::uuid[];
  v_created_project_nos text[] := '{}'::text[];
  v_created_jobs_summary jsonb := '[]'::jsonb;
  v_blueprint_id uuid;
  v_effective_order_ref text;
  v_result_json jsonb;
BEGIN
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '20s';

  IF p_session_org_id IS NULL THEN
    RAISE EXCEPTION 'Organizasyon ID (p_session_org_id) zorunludur.' USING ERRCODE = '22023';
  END IF;

  -- 1. P0 Mühendislik ve Üretim Kapısı Kontrolü (Veritabanı Seviyesinde Fail-Closed!)
  IF p_can_export_production IS NOT TRUE
     OR COALESCE(p_compatibility_status, 'UNVERIFIED') IN ('INCOMPATIBLE', 'UNVERIFIED') THEN
    RAISE EXCEPTION 'Üretim kapısı kilitli (Durum: %): Fiziksel olarak doğrulanmamış veya P0 hatası içeren tasarımlar ERP Nesting tablolarına aktarılamaz.',
      COALESCE(p_compatibility_status, 'UNVERIFIED')
      USING ERRCODE = '22023';
  END IF;

  IF p_nesting_bundle IS NULL OR jsonb_typeof(p_nesting_bundle->'jobs') <> 'array'
     OR jsonb_array_length(p_nesting_bundle->'jobs') = 0 THEN
    RAISE EXCEPTION 'ERP Nesting paketinde işlenecek en az bir plaka grubu (jobs) bulunmalıdır.'
      USING ERRCODE = '22023';
  END IF;

  -- 2. Kullanıcı ve Rol Doğrulaması
  IF p_session_user_id IS NOT NULL AND to_regclass('public.profiles') IS NOT NULL THEN
    SELECT id, username, role, branch_id, organization_id, is_active
    INTO v_user_profile
    FROM public.profiles
    WHERE id = p_session_user_id;

    IF FOUND THEN
      IF v_user_profile.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Kullanıcı hesabı pasif durumdadır.' USING ERRCODE = '42501';
      END IF;
      IF v_user_profile.organization_id <> p_session_org_id THEN
        RAISE EXCEPTION 'Kiracı uyuşmazlığı: Kullanıcı bu organizasyona ait değil.' USING ERRCODE = '42501';
      END IF;
      v_effective_role := COALESCE(v_user_profile.role, p_session_role);
      v_effective_branch := v_user_profile.branch_id;
      v_created_by := COALESCE(NULLIF(p_session_username, ''), v_user_profile.username, 'birim-configurator');
    ELSE
      v_effective_role := p_session_role;
      v_effective_branch := NULL;
      v_created_by := COALESCE(NULLIF(p_session_username, ''), 'birim-configurator');
    END IF;
  ELSE
    v_effective_role := p_session_role;
    v_effective_branch := NULL;
    v_created_by := COALESCE(NULLIF(p_session_username, ''), 'birim-configurator');
  END IF;

  v_effective_branch := public.resolve_birim_branch_uuid(
    p_session_org_id,
    p_branch_input,
    v_effective_branch
  );

  IF COALESCE(v_effective_role, '') IN ('receptionist') THEN
    RAISE EXCEPTION 'Forbidden — Bu kullanıcı rolünün ERP üretim/nesting iş emri oluşturma yetkisi yoktur.'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Dağıtık İdempotensi Kontrolü (FOR UPDATE)
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_idemp
    FROM public.store_idempotency_keys
    WHERE organization_id = p_session_org_id
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
      IF v_existing_idemp.status = 'completed' THEN
        IF p_request_hash IS NULL OR v_existing_idemp.request_hash = p_request_hash THEN
          RETURN v_existing_idemp.response_payload;
        ELSE
          RAISE EXCEPTION 'Conflict — Bu Idempotency-Key farklı üretim paketiyle daha önce kullanılmıştır.'
            USING ERRCODE = '23505';
        END IF;
      ELSIF v_existing_idemp.status = 'processing' THEN
        RAISE EXCEPTION 'Conflict — Bu ERP nesting aktarımı için eşzamanlı bir işlem devam etmektedir.'
          USING ERRCODE = '55P03';
      END IF;
    END IF;
  END IF;

  -- 4. Sipariş Kartı (sales_cards) Bağlantısı Varsa Kiracı Doğrulaması
  v_effective_order_ref := COALESCE(NULLIF(trim(p_order_ref), ''), p_configurator_project_id || '_v' || COALESCE(p_configurator_version, 1)::text);

  IF p_sales_card_id IS NOT NULL AND to_regclass('public.sales_cards') IS NOT NULL THEN
    SELECT id, sales_no, organization_id, is_deleted
    INTO v_sales_card
    FROM public.sales_cards
    WHERE id = p_sales_card_id
      AND organization_id = p_session_org_id
      AND COALESCE(is_deleted, false) = false;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Bağlanmak istenen satış siparişi (%) bu organizasyonda bulunamadı.', p_sales_card_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_sales_card.sales_no IS NOT NULL AND v_sales_card.sales_no <> '' THEN
      v_effective_order_ref := v_sales_card.sales_no;
    END IF;
  END IF;

  -- 5. NST-YYYY-XXXX Sıra Numarası Üretimi İçin Kiracı Bazlı İşlem Kilidi (Yarış Koşulunu Engeller)
  PERFORM pg_advisory_xact_lock(hashtext('birim_nesting_seq_' || p_session_org_id::text));

  v_year_prefix := 'NST-' || to_char(now(), 'YYYY') || '-';
  SELECT project_no
  INTO v_last_project_no
  FROM public.nesting_projects
  WHERE organization_id = p_session_org_id
    AND project_no LIKE (v_year_prefix || '%')
  ORDER BY project_no DESC
  LIMIT 1;

  IF v_last_project_no IS NOT NULL THEN
    BEGIN
      v_next_seq := regexp_replace(replace(v_last_project_no, v_year_prefix, ''), '[^0-9]', '', 'g')::integer + 1;
    EXCEPTION WHEN OTHERS THEN
      v_next_seq := 1;
    END;
  END IF;

  -- 6. Her Malzeme/Kalınlık Grubu İçin nesting_sheets -> nesting_projects -> nesting_parts -> nesting_placements Yazımı
  v_jobs_json := p_nesting_bundle->'jobs';

  FOR v_job IN SELECT * FROM jsonb_array_elements(v_jobs_json)
  LOOP
    v_sheet_input := COALESCE(v_job->'sheet_input', '{}'::jsonb);
    v_proj_rec := COALESCE(v_job->'project_record', '{}'::jsonb);
    v_opt_res := COALESCE(v_job->'optimization_result', '{}'::jsonb);

    v_sheet_name := COALESCE(NULLIF(v_sheet_input->>'name', ''), 'Standart MDF/Suntalam Plaka');
    v_formatted_material := COALESCE(NULLIF(v_sheet_input->>'material_type', ''), 'MDF 18mm [grain:vertical]');
    v_sheet_w := COALESCE(NULLIF(v_sheet_input->>'width_mm', '')::numeric, 2800);
    v_sheet_h := COALESCE(NULLIF(v_sheet_input->>'height_mm', '')::numeric, 2100);
    v_sheet_t := COALESCE(NULLIF(v_sheet_input->>'thickness_mm', '')::numeric, 18);
    v_sheet_kerf := COALESCE(NULLIF(v_sheet_input->>'kerf_mm', '')::numeric, 4);
    v_sheet_margin := COALESCE(NULLIF(v_sheet_input->>'edge_margin_mm', '')::numeric, 15);
    v_sheet_cost := NULLIF(v_sheet_input->>'cost_per_sheet', '')::numeric;

    -- 6a. Aktif Plaka Tanımını Bul veya Oluştur (Not: nesting_sheets tablosunda grain_direction sütunu yoktur; material_type içinde [grain:...] olarak saklanır)
    SELECT id INTO v_sheet_id
    FROM public.nesting_sheets
    WHERE organization_id = p_session_org_id
      AND COALESCE(is_active, true) = true
      AND material_type = v_formatted_material
      AND width_mm = v_sheet_w
      AND height_mm = v_sheet_h
      AND thickness_mm = v_sheet_t
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_sheet_id IS NULL THEN
      INSERT INTO public.nesting_sheets (
        organization_id,
        name,
        material_type,
        width_mm,
        height_mm,
        thickness_mm,
        kerf_mm,
        edge_margin_mm,
        cost_per_sheet,
        is_active
      ) VALUES (
        p_session_org_id,
        v_sheet_name,
        v_formatted_material,
        v_sheet_w,
        v_sheet_h,
        v_sheet_t,
        v_sheet_kerf,
        v_sheet_margin,
        v_sheet_cost,
        true
      )
      RETURNING id INTO v_sheet_id;
    END IF;

    -- 6b. Nesting Projesi Oluştur (NST-YYYY-XXXX)
    v_project_no := v_year_prefix || lpad(v_next_seq::text, 4, '0');
    v_next_seq := v_next_seq + 1;

    INSERT INTO public.nesting_projects (
      organization_id,
      project_no,
      name,
      status,
      sheet_id,
      source_type,
      source_ref,
      created_by,
      optimization_data,
      total_sheets_used,
      utilization_percent,
      waste_area_mm2,
      notes
    ) VALUES (
      p_session_org_id,
      v_project_no,
      COALESCE(NULLIF(v_proj_rec->>'name', ''), p_configurator_project_id || ' — ' || v_sheet_name),
      CASE WHEN COALESCE(NULLIF(v_proj_rec->>'total_sheets_used', '')::integer, 0) > 0 THEN 'optimized' ELSE 'draft' END,
      v_sheet_id,
      'production_order',
      v_effective_order_ref,
      v_created_by,
      v_opt_res,
      COALESCE(NULLIF(v_proj_rec->>'total_sheets_used', '')::integer, 0),
      COALESCE(NULLIF(v_proj_rec->>'utilization_percent', '')::numeric, 0),
      COALESCE(NULLIF(v_proj_rec->>'waste_area_mm2', '')::numeric, 0),
      COALESCE(NULLIF(v_proj_rec->>'notes', ''), 'Birim Configurator V7.3 otomatik CNC nesting iş emri')
    )
    RETURNING id INTO v_nesting_project_id;

    -- 6c. Parçaları (nesting_parts) Ekle ve İstemci Parça Kimliği -> Gerçek DB UUID Haritası Kur
    v_part_map_by_id := '{}'::jsonb;
    v_part_map_by_idx := '{}'::jsonb;
    v_part_map_by_label := '{}'::jsonb;
    v_part_idx := 0;
    v_job_parts_count := 0;

    FOR v_part IN SELECT * FROM jsonb_array_elements(COALESCE(v_job->'part_records', '[]'::jsonb))
    LOOP
      v_part_uuid := gen_random_uuid();
      v_client_part_id := COALESCE(v_part->>'id', 'part_' || v_part_idx::text);

      INSERT INTO public.nesting_parts (
        id,
        project_id,
        part_label,
        width_mm,
        height_mm,
        quantity,
        can_rotate,
        grain_direction,
        edge_banding,
        material_code,
        color,
        priority
      ) VALUES (
        v_part_uuid,
        v_nesting_project_id,
        COALESCE(NULLIF(v_part->>'part_label', ''), 'Parça ' || (v_part_idx + 1)::text),
        COALESCE(NULLIF(v_part->>'width_mm', '')::numeric, 100),
        COALESCE(NULLIF(v_part->>'height_mm', '')::numeric, 100),
        GREATEST(1, COALESCE(NULLIF(v_part->>'quantity', '')::integer, 1)),
        COALESCE((v_part->>'can_rotate')::boolean, true),
        NULLIF(v_part->>'grain_direction', ''),
        NULLIF(v_part->>'edge_banding', ''),
        NULLIF(v_part->>'material_code', ''),
        COALESCE(NULLIF(v_part->>'color', ''), '#3b82f6'),
        COALESCE(NULLIF(v_part->>'priority', '')::integer, 0)
      );

      v_part_map_by_id := jsonb_set(v_part_map_by_id, ARRAY[v_client_part_id], to_jsonb(v_part_uuid::text), true);
      v_part_map_by_idx := jsonb_set(v_part_map_by_idx, ARRAY[v_part_idx::text], to_jsonb(v_part_uuid::text), true);
      IF v_part->>'part_label' IS NOT NULL AND NOT (v_part_map_by_label ? (v_part->>'part_label')) THEN
        v_part_map_by_label := jsonb_set(v_part_map_by_label, ARRAY[v_part->>'part_label'], to_jsonb(v_part_uuid::text), true);
      END IF;

      v_part_idx := v_part_idx + 1;
      v_job_parts_count := v_job_parts_count + 1;
      v_total_parts_inserted := v_total_parts_inserted + 1;
    END LOOP;

    -- 6d. Yerleşimleri (nesting_placements) Gerçek UUID part_id FK İle Ekle
    v_job_placements_count := 0;

    FOR v_placement IN SELECT * FROM jsonb_array_elements(COALESCE(v_job->'placement_records', '[]'::jsonb))
    LOOP
      v_raw_pl_part_id := COALESCE(v_placement->>'part_id', '');
      v_resolved_part_uuid := NULL;

      IF v_part_map_by_id ? v_raw_pl_part_id THEN
        v_resolved_part_uuid := (v_part_map_by_id->>v_raw_pl_part_id)::uuid;
      ELSE
        v_matched_idx := substring(v_raw_pl_part_id FROM '^part[_-]([0-9]+)[_-][0-9]+$');
        IF v_matched_idx IS NOT NULL AND (v_part_map_by_idx ? v_matched_idx) THEN
          v_resolved_part_uuid := (v_part_map_by_idx->>v_matched_idx)::uuid;
        ELSIF (v_placement->'part'->>'part_label') IS NOT NULL
              AND (v_part_map_by_label ? (v_placement->'part'->>'part_label')) THEN
          v_resolved_part_uuid := (v_part_map_by_label->>(v_placement->'part'->>'part_label'))::uuid;
        ELSIF v_part_map_by_idx ? '0' THEN
          v_resolved_part_uuid := (v_part_map_by_idx->>'0')::uuid;
        END IF;
      END IF;

      IF v_resolved_part_uuid IS NULL THEN
        RAISE EXCEPTION 'Nesting yerleşim satırı için eşleşen nesting_parts UUID kaydı bulunamadı (part_id: %).',
          v_raw_pl_part_id
          USING ERRCODE = '22023';
      END IF;

      INSERT INTO public.nesting_placements (
        project_id,
        part_id,
        sheet_index,
        x_mm,
        y_mm,
        placed_width_mm,
        placed_height_mm,
        is_rotated
      ) VALUES (
        v_nesting_project_id,
        v_resolved_part_uuid,
        COALESCE(NULLIF(v_placement->>'sheet_index', '')::integer, 0),
        COALESCE(NULLIF(v_placement->>'x_mm', '')::numeric, 0),
        COALESCE(NULLIF(v_placement->>'y_mm', '')::numeric, 0),
        COALESCE(NULLIF(v_placement->>'placed_width_mm', '')::numeric, 0),
        COALESCE(NULLIF(v_placement->>'placed_height_mm', '')::numeric, 0),
        COALESCE((v_placement->>'is_rotated')::boolean, false)
      );

      v_job_placements_count := v_job_placements_count + 1;
      v_total_placements_inserted := v_total_placements_inserted + 1;
    END LOOP;

    v_total_sheets_used := v_total_sheets_used + COALESCE(NULLIF(v_proj_rec->>'total_sheets_used', '')::integer, 0);
    v_created_project_ids := array_append(v_created_project_ids, v_nesting_project_id);
    v_created_project_nos := array_append(v_created_project_nos, v_project_no);

    v_created_jobs_summary := v_created_jobs_summary || jsonb_build_array(
      jsonb_build_object(
        'nestingProjectId', v_nesting_project_id,
        'projectNo', v_project_no,
        'sheetId', v_sheet_id,
        'materialName', COALESCE(v_job->>'material_name', v_sheet_name),
        'thicknessMm', v_sheet_t,
        'partsInserted', v_job_parts_count,
        'placementsInserted', v_job_placements_count,
        'sheetsUsed', COALESCE(NULLIF(v_proj_rec->>'total_sheets_used', '')::integer, 0),
        'utilizationPercent', COALESCE(NULLIF(v_proj_rec->>'utilization_percent', '')::numeric, 0)
      )
    );
  END LOOP;

  -- 7. Ana Üretim Reçetesi (configurator_production_blueprints) Kaydı
  INSERT INTO public.configurator_production_blueprints (
    organization_id,
    branch_id,
    configurator_project_id,
    configurator_version,
    order_ref,
    sales_card_id,
    quotation_id,
    compatibility_status,
    items_count,
    nesting_jobs_count,
    total_sheets_used,
    overall_utilization_percent,
    reclaimable_remnants_count,
    nesting_project_ids,
    nesting_project_nos,
    combined_selco_csv,
    combined_cnc_gcode,
    scm_xcs_program,
    blum_bxf_xml,
    blueprint_payload,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    p_session_org_id,
    v_effective_branch,
    p_configurator_project_id,
    COALESCE(p_configurator_version, 1),
    v_effective_order_ref,
    p_sales_card_id,
    p_quotation_id,
    p_compatibility_status,
    COALESCE(jsonb_array_length(COALESCE(p_blueprint_payload->'items', '[]'::jsonb)), v_total_parts_inserted),
    COALESCE(array_length(v_created_project_ids, 1), 0),
    v_total_sheets_used,
    COALESCE(NULLIF(p_nesting_bundle->'summary'->>'overall_utilization_percent', '')::numeric, 0),
    COALESCE(NULLIF(p_nesting_bundle->'summary'->>'reclaimable_remnants_count', '')::integer, 0),
    v_created_project_ids,
    v_created_project_nos,
    p_nesting_bundle->>'combined_selco_csv',
    p_nesting_bundle->>'combined_cnc_gcode',
    p_scm_xcs_program,
    p_blum_bxf_xml,
    COALESCE(p_blueprint_payload, '{}'::jsonb),
    v_created_by,
    now(),
    now()
  )
  RETURNING id INTO v_blueprint_id;

  -- Varsa configurator_projects kaydının durumunu güncelle
  UPDATE public.configurator_projects
  SET status = 'in_production',
      sales_card_id = COALESCE(p_sales_card_id, sales_card_id),
      quotation_id = COALESCE(p_quotation_id, quotation_id),
      updated_at = now()
  WHERE id = p_configurator_project_id
    AND (organization_id IS NULL OR organization_id = p_session_org_id);

  v_result_json := jsonb_build_object(
    'success', true,
    'blueprintId', v_blueprint_id,
    'organizationId', p_session_org_id,
    'branchId', v_effective_branch,
    'orderRef', v_effective_order_ref,
    'salesCardId', p_sales_card_id,
    'quotationId', p_quotation_id,
    'configuratorProjectId', p_configurator_project_id,
    'configuratorVersion', COALESCE(p_configurator_version, 1),
    'nestingJobsCount', COALESCE(array_length(v_created_project_ids, 1), 0),
    'nestingProjectIds', to_jsonb(v_created_project_ids),
    'nestingProjectNos', to_jsonb(v_created_project_nos),
    'nestingJobs', v_created_jobs_summary,
    'totalSheetsUsed', v_total_sheets_used,
    'totalPartsInserted', v_total_parts_inserted,
    'totalPlacementsInserted', v_total_placements_inserted,
    'overallUtilizationPercent', COALESCE(NULLIF(p_nesting_bundle->'summary'->>'overall_utilization_percent', '')::numeric, 0),
    'reclaimableRemnantsCount', COALESCE(NULLIF(p_nesting_bundle->'summary'->>'reclaimable_remnants_count', '')::integer, 0),
    'publishedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    INSERT INTO public.store_idempotency_keys (
      idempotency_key,
      organization_id,
      user_id,
      request_hash,
      response_payload,
      status,
      created_at,
      expires_at
    ) VALUES (
      p_idempotency_key,
      p_session_org_id,
      COALESCE(p_session_user_id, gen_random_uuid()),
      COALESCE(p_request_hash, ''),
      v_result_json,
      'completed',
      now(),
      now() + interval '24 hours'
    )
    ON CONFLICT (organization_id, idempotency_key) DO UPDATE
    SET response_payload = EXCLUDED.response_payload,
        status = 'completed';
  END IF;

  RETURN v_result_json;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 6. K-03 Güvenlik İzinleri: PUBLIC / anon / authenticated Erişimini Kapat,
--    Yalnızca BFF Sunucu Katmanına (service_role) Yetki Ver
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.resolve_birim_branch_uuid(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_birim_branch_uuid(uuid, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.upsert_configurator_store_quotation_atomic(
  uuid, text, integer, text, jsonb, jsonb, text, uuid, uuid, text, text, text, boolean, boolean, jsonb, jsonb, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_configurator_store_quotation_atomic(
  uuid, text, integer, text, jsonb, jsonb, text, uuid, uuid, text, text, text, boolean, boolean, jsonb, jsonb, text, text, uuid, text, text
) TO service_role;

REVOKE ALL ON FUNCTION public.publish_configurator_erp_nesting_atomic(
  uuid, text, integer, text, jsonb, jsonb, text, boolean, uuid, uuid, text, text, text, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_configurator_erp_nesting_atomic(
  uuid, text, integer, text, jsonb, jsonb, text, boolean, uuid, uuid, text, text, text, text, text, uuid, text, text
) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
