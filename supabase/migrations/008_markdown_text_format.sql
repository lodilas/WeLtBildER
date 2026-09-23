-- Existing TXT versions remain readable. Markdown offsets use the stored source.
alter table public.text_versions
  add column if not exists content_format text not null default 'plain'
  check (content_format in ('plain', 'markdown'));
