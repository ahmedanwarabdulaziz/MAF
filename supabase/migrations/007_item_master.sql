-- ============================================================
-- P05 Migration 007: Item Master
-- Tables: item_groups, units, items, item_units, item_cost_profiles
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Item Groups (hierarchical item categories)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.item_groups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  group_code          text NOT NULL,
  arabic_name         text NOT NULL,
  english_name        text,
  parent_group_id     uuid REFERENCES public.item_groups(id) ON DELETE RESTRICT,
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_by          uuid REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, group_code)
);

-- ─────────────────────────────────────────────────────────────
-- 2. Units of Measure (global — shared across all items)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.units (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  unit_code           text NOT NULL,
  arabic_name         text NOT NULL,
  english_name        text,
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_by          uuid REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, unit_code)
);

-- ─────────────────────────────────────────────────────────────
-- 3. Items (item master records)
-- is_stocked = false means the item is a service / non-stock item
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.items (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  item_group_id             uuid NOT NULL REFERENCES public.item_groups(id) ON DELETE RESTRICT,
  item_code                 text NOT NULL,
  arabic_name               text NOT NULL,
  english_name              text,
  primary_unit_id           uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  default_purchase_unit_id  uuid REFERENCES public.units(id) ON DELETE SET NULL,
  is_stocked                boolean NOT NULL DEFAULT true,
  min_stock_level           numeric(18,4),
  notes                     text,
  is_active                 boolean NOT NULL DEFAULT true,
  archived_at               timestamptz,
  archived_by               uuid REFERENCES public.users(id),
  created_by                uuid REFERENCES public.users(id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, item_code)
);

-- ─────────────────────────────────────────────────────────────
-- 4. Item Units (additional / alternative units with conversion factors)
-- conversion_factor: how many primary units = 1 of this unit
-- e.g. if primary unit = pcs and this unit = box of 12: factor = 12
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.item_units (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id             uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  unit_id             uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  conversion_factor   numeric(18,6) NOT NULL DEFAULT 1,
  is_default_purchase boolean NOT NULL DEFAULT false,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, unit_id)
);

-- ─────────────────────────────────────────────────────────────
-- 5. Item Cost Profiles (costing method per item)
-- method: weighted_average is the default; system is ready for others
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.item_cost_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id             uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  costing_method      text NOT NULL DEFAULT 'weighted_average'
                        CHECK (costing_method IN ('weighted_average','fifo','fixed')),
  fixed_cost          numeric(18,2),       -- used only if costing_method = 'fixed'
  effective_from      date NOT NULL DEFAULT CURRENT_DATE,
  notes               text,
  created_by          uuid REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, effective_from)
);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.item_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_units         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_cost_profiles ENABLE ROW LEVEL SECURITY;

-- item_groups
CREATE POLICY "item_groups_read" ON public.item_groups
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "item_groups_write" ON public.item_groups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- units
CREATE POLICY "units_read" ON public.units
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "units_write" ON public.units
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- items
CREATE POLICY "items_read" ON public.items
  FOR SELECT USING (auth.role() = 'authenticated' AND archived_at IS NULL);

CREATE POLICY "items_write" ON public.items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- item_units
CREATE POLICY "item_units_read" ON public.item_units
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "item_units_write" ON public.item_units
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- item_cost_profiles
CREATE POLICY "item_cost_profiles_read" ON public.item_cost_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "item_cost_profiles_write" ON public.item_cost_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- ─────────────────────────────────────────────────────────────
-- Seed: default item groups and units
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT id INTO v_company_id FROM public.companies WHERE short_code = 'MAIN' LIMIT 1;

  -- Item groups
  INSERT INTO public.item_groups (company_id, group_code, arabic_name, english_name)
  VALUES
    (v_company_id, 'CIVIL',    'أعمال مدنية',         'Civil Works'),
    (v_company_id, 'ELEC',     'أعمال كهربائية',      'Electrical Works'),
    (v_company_id, 'MECH',     'أعمال ميكانيكية',     'Mechanical Works'),
    (v_company_id, 'FIN',      'أعمال تشطيبات',       'Finishing Works'),
    (v_company_id, 'TOOLS',    'أدوات ومعدات',        'Tools & Equipment'),
    (v_company_id, 'SAFETY',   'متطلبات السلامة',     'Safety Materials'),
    (v_company_id, 'CONSUMED', 'مواد استهلاكية',      'Consumables'),
    (v_company_id, 'OTHER',    'أخرى',                'Other')
  ON CONFLICT (company_id, group_code) DO NOTHING;

  -- Units of measure
  INSERT INTO public.units (company_id, unit_code, arabic_name, english_name)
  VALUES
    (v_company_id, 'PCS',    'قطعة',        'Piece'),
    (v_company_id, 'M',      'متر',         'Meter'),
    (v_company_id, 'M2',     'متر مربع',    'Square Meter'),
    (v_company_id, 'M3',     'متر مكعب',    'Cubic Meter'),
    (v_company_id, 'KG',     'كيلوجرام',    'Kilogram'),
    (v_company_id, 'TON',    'طن',          'Ton'),
    (v_company_id, 'LTR',    'لتر',         'Liter'),
    (v_company_id, 'ROLL',   'رول',         'Roll'),
    (v_company_id, 'BOX',    'صندوق',       'Box'),
    (v_company_id, 'BAG',    'كيس',         'Bag'),
    (v_company_id, 'SET',    'طقم',         'Set'),
    (v_company_id, 'HR',     'ساعة',        'Hour'),
    (v_company_id, 'DAY',    'يوم',         'Day'),
    (v_company_id, 'LS',     'مقطوعية',     'Lump Sum')
  ON CONFLICT (company_id, unit_code) DO NOTHING;
END $$;
