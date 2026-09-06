-- Add formal section labels and validity periods to each reviewed text section.
-- Run after 002_account_approval_and_roles.sql.

alter table public.text_sections
  add column if not exists section_type text not null default '',
  add column if not exists validity_start text not null default '',
  add column if not exists validity_end text not null default '';

