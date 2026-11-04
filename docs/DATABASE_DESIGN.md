# Veritabanı Mimarisi ve Şema Tasarımı (DATABASE_DESIGN.md)

## 1. Veritabanı İzolasyon Prensibi

Mevcut Birim ERP (`birim-portal`) ve Birim Store (`birim-store`) platformlarında devam eden güvenlik ve RLS güncellemelerini korumak amacıyla:
- **Mevcut veritabanlarına hiçbir doğrudan migration veya DDL/DML uygulanmamıştır.**
- İleride aynı Supabase PostgreSQL kümesinde devreye alınmak üzere izole bir `configurator` şeması tasarlanmıştır.

---

## 2. Önerilen `configurator` Şeması

```sql
-- Configurator schema isolation
create schema if not exists configurator;

-- 1. Designs (Tasarım Başlığı)
create table configurator.designs (
    id uuid default gen_random_uuid() primary key,
    branch_id text not null, -- references public.locations(id)
    customer_id text,
    title text not null,
    category text not null default 'wardrobe', -- 'wardrobe', 'kitchen', 'custom'
    current_version integer not null default 1,
    status text not null default 'draft', -- 'draft', 'quoted', 'confirmed', 'archived'
    created_by text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2. Design Versions (İmmutable Tasarım Versiyonları)
create table configurator.design_versions (
    id uuid default gen_random_uuid() primary key,
    design_id uuid not null references configurator.designs(id) on delete cascade,
    version integer not null,
    project_payload jsonb not null, -- DesignProject JSON yapısı
    pricing_snapshot jsonb not null, -- PricingBreakdown verisi
    bom_snapshot jsonb not null, -- ManufacturingBOM verisi
    is_locked boolean not null default false, -- Teklife bağlandığında true olur
    locked_at timestamptz,
    created_by text not null,
    created_at timestamptz default now(),
    unique(design_id, version)
);

-- 3. Module Templates (Katalog Şablonları)
create table configurator.module_templates (
    id text primary key,
    name text not null,
    category text not null,
    default_dimensions jsonb not null, -- {width, height, depth}
    template_structure jsonb not null,
    is_active boolean default true,
    created_at timestamptz default now()
);

-- 4. Manufacturing Snapshots (ERP Köprüsü)
create table configurator.manufacturing_snapshots (
    id uuid default gen_random_uuid() primary key,
    design_version_id uuid not null references configurator.design_versions(id),
    order_id text, -- references public.orders(id)
    blueprint_id uuid, -- references public.production_blueprints(id)
    cut_list jsonb not null,
    hardware_list jsonb not null,
    status text default 'pending_approval', -- 'pending_approval', 'exported_to_erp'
    exported_at timestamptz
);
```

---

## 3. Mevcut ERP ve Store Tabloları ile İlişkiler

| Configurator Alanı | Mevcut ERP/Store Tablosu | İlişki Tipi | Amaç |
| :--- | :--- | :--- | :--- |
| `branch_id` | `public.locations.id` | Dış Anahtar (FK) | Şube bazlı teklif ve tasarım izolasyonu |
| `order_id` | `public.orders.id` | Dış Anahtar (FK) | Siparişleşen tasarımın üretim emriyle bağı |
| `blueprint_id` | `public.production_blueprints.id` | Dış Anahtar (FK) | ERP üretim reçetesi ile kesim listesi eşleşmesi |
| `materialId` | `dbo.Malzemeler / dbo.Ahsap_Urunler` | Kod Eşlemesi | Fabrika hammadde stok kodları ile entegrasyon |
