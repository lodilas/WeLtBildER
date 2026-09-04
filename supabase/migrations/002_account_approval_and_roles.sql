-- Account approval and role-based access for the review app.
-- Run this migration once in the Supabase SQL editor after 001_review_app.sql.
-- Existing pilot accounts remain approved; new registrations start as pending.

alter table public.reviewer_profiles
  add column if not exists email text not null default '',
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz;

-- Everyone who existed before this migration was already part of the pilot.
update public.reviewer_profiles
set approval_status = 'approved'
where approval_status = 'pending';

update public.reviewer_profiles as profile
set email = user_record.email
from auth.users as user_record
where profile.id = user_record.id and profile.email = '';

create table if not exists public.admin_notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.reviewer_profiles(id) on delete cascade,
  notification_type text not null default 'account_request',
  message text not null default '',
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists admin_notifications_recipient_open_idx
  on public.admin_notifications(recipient_id, is_read, created_at desc);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.reviewer_profiles
  where id = auth.uid() and approval_status = 'approved'
$$;

create or replace function public.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() is not null
$$;

create or replace function public.is_reviewer_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('reviewer', 'admin')
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin'
$$;

-- Newly registered users have no data access. The trigger also creates one
-- in-app notification for every currently approved administrator.
create or replace function public.create_reviewer_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reviewer_profiles (id, display_name, email, role, approval_status)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), coalesce(new.email, ''), 'viewer', 'pending')
  on conflict (id) do nothing;

  insert into public.admin_notifications (recipient_id, profile_id, notification_type, message)
  select profile.id, new.id, 'account_request', 'Neue Kontoanfrage wartet auf Freigabe.'
  from public.reviewer_profiles as profile
  where profile.role = 'admin' and profile.approval_status = 'approved';
  return new;
end;
$$;

-- Reviewers may grant reading or reviewing rights. Only an admin can create
-- another admin. The function is the sole write path for account approval.
create or replace function public.review_account_request(
  target_profile_id uuid,
  decision text,
  assigned_role text default 'viewer'
)
returns public.reviewer_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text;
  target_role text;
  saved public.reviewer_profiles;
begin
  requester_role := public.current_app_role();
  if requester_role not in ('reviewer', 'admin') then
    raise exception 'Nicht berechtigt, Kontoanfragen zu verwalten.';
  end if;
  if target_profile_id = auth.uid() then
    raise exception 'Das eigene Konto kann nicht selbst freigeschaltet oder umgestuft werden.';
  end if;
  if decision not in ('approve', 'reject') then
    raise exception 'Unbekannte Entscheidung.';
  end if;
  if assigned_role not in ('viewer', 'reviewer', 'admin') then
    raise exception 'Unbekannte Rolle.';
  end if;

  select role into target_role from public.reviewer_profiles where id = target_profile_id;
  if target_role is null then
    raise exception 'Kontoanfrage nicht gefunden.';
  end if;
  if requester_role = 'reviewer' and (assigned_role = 'admin' or target_role = 'admin') then
    raise exception 'Nur Admins dürfen Adminrollen vergeben oder verwalten.';
  end if;

  update public.reviewer_profiles
  set approval_status = case when decision = 'approve' then 'approved' else 'rejected' end,
      role = case when decision = 'approve' then assigned_role else role end,
      approved_by = auth.uid(),
      approved_at = now()
  where id = target_profile_id
  returning * into saved;

  update public.admin_notifications
  set is_read = true, read_at = now()
  where profile_id = target_profile_id and notification_type = 'account_request' and not is_read;
  return saved;
end;
$$;

alter table public.admin_notifications enable row level security;

-- Replace the open pilot policies with approval- and role-aware policies.
drop policy if exists "authenticated reviewers can read profiles" on public.reviewer_profiles;
drop policy if exists "reviewers can update own profile" on public.reviewer_profiles;
drop policy if exists "authenticated reviewers can read documents" on public.documents;
drop policy if exists "authenticated reviewers can update documents" on public.documents;
drop policy if exists "authenticated reviewers can read text versions" on public.text_versions;
drop policy if exists "authenticated reviewers can create text versions" on public.text_versions;
drop policy if exists "authenticated reviewers can read subject lexicon" on public.subject_lexicon;
drop policy if exists "authenticated reviewers can read geo lexicon" on public.geo_lexicon;
drop policy if exists "authenticated reviewers can add geo lexicon" on public.geo_lexicon;
drop policy if exists "authenticated reviewers can update geo lexicon" on public.geo_lexicon;
drop policy if exists "authenticated reviewers can read sections" on public.text_sections;
drop policy if exists "authenticated reviewers can create sections" on public.text_sections;
drop policy if exists "authenticated reviewers can update sections" on public.text_sections;
drop policy if exists "authenticated reviewers can delete sections" on public.text_sections;
drop policy if exists "authenticated reviewers can read occurrences" on public.entity_occurrences;
drop policy if exists "authenticated reviewers can create occurrences" on public.entity_occurrences;
drop policy if exists "authenticated reviewers can update occurrences" on public.entity_occurrences;
drop policy if exists "authenticated reviewers can create audit actions" on public.review_actions;
drop policy if exists "authenticated reviewers can read audit actions" on public.review_actions;
drop policy if exists "reviewers can read curriculum assets" on storage.objects;

create policy "approved users read own profile or managers read all" on public.reviewer_profiles
  for select to authenticated
  using (id = auth.uid() or public.is_reviewer_or_admin());
create policy "approved users read documents" on public.documents for select to authenticated using (public.is_approved_user());
create policy "reviewers update documents" on public.documents for update to authenticated using (public.is_reviewer_or_admin()) with check (public.is_reviewer_or_admin());
create policy "approved users read text versions" on public.text_versions for select to authenticated using (public.is_approved_user());
create policy "reviewers create text versions" on public.text_versions for insert to authenticated with check (public.is_reviewer_or_admin() and created_by = auth.uid());
create policy "approved users read subject lexicon" on public.subject_lexicon for select to authenticated using (public.is_approved_user());
create policy "approved users read geo lexicon" on public.geo_lexicon for select to authenticated using (public.is_approved_user());
create policy "reviewers add geo lexicon" on public.geo_lexicon for insert to authenticated with check (public.is_reviewer_or_admin() and created_by = auth.uid());
create policy "reviewers update geo lexicon" on public.geo_lexicon for update to authenticated using (public.is_reviewer_or_admin()) with check (public.is_reviewer_or_admin());
create policy "approved users read sections" on public.text_sections for select to authenticated using (public.is_approved_user());
create policy "reviewers create sections" on public.text_sections for insert to authenticated with check (public.is_reviewer_or_admin() and created_by = auth.uid());
create policy "reviewers update sections" on public.text_sections for update to authenticated using (public.is_reviewer_or_admin()) with check (public.is_reviewer_or_admin());
create policy "reviewers delete sections" on public.text_sections for delete to authenticated using (public.is_reviewer_or_admin());
create policy "approved users read occurrences" on public.entity_occurrences for select to authenticated using (public.is_approved_user());
create policy "reviewers create occurrences" on public.entity_occurrences for insert to authenticated with check (public.is_reviewer_or_admin() and created_by = auth.uid());
create policy "reviewers update occurrences" on public.entity_occurrences for update to authenticated using (public.is_reviewer_or_admin()) with check (public.is_reviewer_or_admin());
create policy "reviewers create audit actions" on public.review_actions for insert to authenticated with check (public.is_reviewer_or_admin() and reviewer_id = auth.uid());
create policy "approved users read audit actions" on public.review_actions for select to authenticated using (public.is_approved_user());
create policy "recipients read own account notifications" on public.admin_notifications for select to authenticated using (recipient_id = auth.uid());
create policy "recipients mark own account notifications read" on public.admin_notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "approved users read curriculum assets" on storage.objects for select to authenticated using (bucket_id = 'curriculum-assets' and public.is_approved_user());
