-- Migration 054: Company Purchase Attachments
-- Add attachment_urls column to store up to 2 files

ALTER TABLE public.company_purchase_invoices
  ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] DEFAULT '{}';
