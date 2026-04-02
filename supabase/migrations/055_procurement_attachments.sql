-- Migration 055: Procurement Attachments
-- Add attachment_urls column to store up to 2 files for purchase requests and supplier invoices

ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] DEFAULT '{}';

ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] DEFAULT '{}';
