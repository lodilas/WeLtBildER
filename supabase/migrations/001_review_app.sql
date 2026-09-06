-- Lehrplan Review: GitHub-Pages/Supabase pilot, without upload or OCR worker.
-- Run in a new Supabase project's SQL editor or via the Supabase CLI.

create extension if not exists pgcrypto;

create table if not exists public.reviewer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'reviewer' check (role in ('admin', 'reviewer', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id text primary key,
  title text not null,
  source_file text not null,
  source_storage_path text not null,
  source_url text not null default '',
  federal_state text[] not null default '{}',
  subjects text[] not null default '{}',
  subject_complexes text[] not null default '{}',
  school_types text[] not null default '{}',
  grade_levels integer[] not null default '{}',
  performance_level text[] not null default '{}',
  publication_year integer,
  validity_start text not null default '',
  validity_end text not null default '',
  languages text[] not null default '{}',
  metadata_source text not null default '',
  status text not null default 'machine_cleaned',
  current_text_version_id uuid,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.text_versions (
  id uuid primary key default gen_random_uuid(),
  document_id text not null references public.documents(id) on delete cascade,
  version_kind text not null check (version_kind in ('ocr', 'clean', 'manual')),
  content text not null,
  content_sha256 text generated always as (encode(digest(content, 'sha256'), 'hex')) stored,
  parent_version_id uuid references public.text_versions(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  note text not null default ''
);

alter table public.documents
  drop constraint if exists documents_current_text_version_id_fkey;
alter table public.documents
  add constraint documents_current_text_version_id_fkey
  foreign key (current_text_version_id) references public.text_versions(id) on delete set null;

create table if not exists public.subject_lexicon (
  subject_label text primary key,
  subject_complex text not null,
  notes text not null default '',
  reviewed boolean not null default false,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.geo_lexicon (
  surface_form text primary key,
  canonical_entity text not null,
  entity_type text not null check (entity_type in (
    'country', 'region', 'continent', 'substate', 'historical_country',
    'historical_region', 'city', 'river', 'mountain_range', 'sea', 'other_geographic'
  )),
  source text not null default 'manual',
  reviewed boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.text_sections (
  id bigint generated always as identity primary key,
  document_id text not null references public.documents(id) on delete cascade,
  text_version_id uuid not null references public.text_versions(id) on delete cascade,
  char_start integer not null check (char_start >= 0),
  char_end integer not null check (char_end > char_start),
  section_title text not null default '',
  section_type text not null default '',
  subjects text[] not null default '{}',
  subject_complexes text[] not null default '{}',
  school_types text[] not null default '{}',
  grade_levels integer[] not null default '{}',
  performance_level text[] not null default '{}',
  validity_start text not null default '',
  validity_end text not null default '',
  note text not null default '',
  status text not null default 'reviewed',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_occurrences (
  id bigint generated always as identity primary key,
  document_id text not null references public.documents(id) on delete cascade,
  text_version_id uuid not null references public.text_versions(id) on delete cascade,
  char_start integer not null check (char_start >= 0),
  char_end integer not null check (char_end > char_start),
  surface_form text not null,
  canonical_entity text not null,
  entity_type text not null check (entity_type in (
    'country', 'region', 'continent', 'substate', 'historical_country',
    'historical_region', 'city', 'river', 'mountain_range', 'sea', 'other_geographic'
  )),
  source text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'changed', 'stale')),
  note text not null default '',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_actions (
  id bigint generated always as identity primary key,
  document_id text not null references public.documents(id) on delete cascade,
  text_version_id uuid references public.text_versions(id) on delete set null,
  occurrence_id bigint references public.entity_occurrences(id) on delete set null,
  action_type text not null,
  before_json jsonb not null default '{}'::jsonb,
  after_json jsonb not null default '{}'::jsonb,
  reviewer_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists text_versions_document_created_idx on public.text_versions(document_id, created_at desc);
create index if not exists sections_document_version_idx on public.text_sections(document_id, text_version_id, char_start);
create index if not exists occurrences_document_version_idx on public.entity_occurrences(document_id, text_version_id, char_start);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.create_reviewer_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.reviewer_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.create_reviewer_profile();

drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at before update on public.documents for each row execute procedure public.set_updated_at();
drop trigger if exists profiles_updated_at on public.reviewer_profiles;
create trigger profiles_updated_at before update on public.reviewer_profiles for each row execute procedure public.set_updated_at();
drop trigger if exists sections_updated_at on public.text_sections;
create trigger sections_updated_at before update on public.text_sections for each row execute procedure public.set_updated_at();
drop trigger if exists occurrences_updated_at on public.entity_occurrences;
create trigger occurrences_updated_at before update on public.entity_occurrences for each row execute procedure public.set_updated_at();

-- The cloud pilot is for invited, authenticated reviewers. Tighten these
-- policies to per-project membership before opening the production corpus.
alter table public.reviewer_profiles enable row level security;
alter table public.documents enable row level security;
alter table public.text_versions enable row level security;
alter table public.subject_lexicon enable row level security;
alter table public.geo_lexicon enable row level security;
alter table public.text_sections enable row level security;
alter table public.entity_occurrences enable row level security;
alter table public.review_actions enable row level security;

create policy "authenticated reviewers can read profiles" on public.reviewer_profiles for select to authenticated using (true);
create policy "reviewers can update own profile" on public.reviewer_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "authenticated reviewers can read documents" on public.documents for select to authenticated using (true);
create policy "authenticated reviewers can update documents" on public.documents for update to authenticated using (true) with check (true);
create policy "authenticated reviewers can read text versions" on public.text_versions for select to authenticated using (true);
create policy "authenticated reviewers can create text versions" on public.text_versions for insert to authenticated with check (created_by = auth.uid());
create policy "authenticated reviewers can read subject lexicon" on public.subject_lexicon for select to authenticated using (true);
create policy "authenticated reviewers can read geo lexicon" on public.geo_lexicon for select to authenticated using (true);
create policy "authenticated reviewers can add geo lexicon" on public.geo_lexicon for insert to authenticated with check (created_by = auth.uid());
create policy "authenticated reviewers can update geo lexicon" on public.geo_lexicon for update to authenticated using (true) with check (true);
create policy "authenticated reviewers can read sections" on public.text_sections for select to authenticated using (true);
create policy "authenticated reviewers can create sections" on public.text_sections for insert to authenticated with check (created_by = auth.uid());
create policy "authenticated reviewers can update sections" on public.text_sections for update to authenticated using (true) with check (true);
create policy "authenticated reviewers can delete sections" on public.text_sections for delete to authenticated using (true);
create policy "authenticated reviewers can read occurrences" on public.entity_occurrences for select to authenticated using (true);
create policy "authenticated reviewers can create occurrences" on public.entity_occurrences for insert to authenticated with check (created_by = auth.uid());
create policy "authenticated reviewers can update occurrences" on public.entity_occurrences for update to authenticated using (true) with check (true);
create policy "authenticated reviewers can create audit actions" on public.review_actions for insert to authenticated with check (reviewer_id = auth.uid());
create policy "authenticated reviewers can read audit actions" on public.review_actions for select to authenticated using (true);

insert into storage.buckets (id, name, public)
values ('curriculum-assets', 'curriculum-assets', false)
on conflict (id) do nothing;

create policy "reviewers can read curriculum assets"
  on storage.objects for select to authenticated
  using (bucket_id = 'curriculum-assets');
