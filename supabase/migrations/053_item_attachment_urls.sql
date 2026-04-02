-- Migration 053: Item Attachment Images
-- Add attachment_urls column to store up to 5 additional item images

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] DEFAULT '{}';
