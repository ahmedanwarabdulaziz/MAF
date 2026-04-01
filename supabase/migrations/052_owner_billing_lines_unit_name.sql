-- Migration 052: Add unit_name to owner_billing_lines
-- Allows storing a free-text unit label (e.g. م², م طولي, طن) alongside each line

ALTER TABLE public.owner_billing_lines
  ADD COLUMN IF NOT EXISTS unit_name text;
