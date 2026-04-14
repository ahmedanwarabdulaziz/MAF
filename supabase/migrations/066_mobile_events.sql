-- ============================================================
-- Migration 066: Mobile Events (GPS / Diagnostics)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mobile_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action_type     text NOT NULL,                   -- e.g. 'review_action', 'upload_photo'
  entity_type     text,                            -- e.g. 'purchase_request'
  entity_id       text,                            -- The ID of the item affected
  latitude        double precision,                -- GPS Lat
  longitude       double precision,                -- GPS Lng
  accuracy        double precision,                -- GPS Accuracy in meters
  device_context  jsonb,                           -- OS, version, app version
  metadata        jsonb,                           -- Additional event details
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_events_user ON public.mobile_events (user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_events_entity ON public.mobile_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_mobile_events_created_at ON public.mobile_events (created_at DESC);

ALTER TABLE public.mobile_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mobile_events_super_admin_read" ON public.mobile_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- Service role / Server API will insert
CREATE POLICY "mobile_events_authenticated_insert" ON public.mobile_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
