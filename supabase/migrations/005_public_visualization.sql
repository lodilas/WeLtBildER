-- Public, aggregated visualization data.  These functions deliberately return
-- no PDF links, raw text or reviewer decisions.  They are safe to call from
-- the anonymous GitHub Pages map; opening a document remains protected by RLS.

create or replace function public.visualization_filter_options()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'subject_complexes', coalesce((select jsonb_agg(value order by value) from (
      select distinct unnest(subject_complexes) as value from documents where cardinality(subject_complexes) > 0
    ) values_), '[]'::jsonb),
    'federal_states', coalesce((select jsonb_agg(value order by value) from (
      select distinct unnest(federal_state) as value from documents where cardinality(federal_state) > 0
    ) values_), '[]'::jsonb),
    'school_types', coalesce((select jsonb_agg(value order by value) from (
      select distinct unnest(school_types) as value from documents where cardinality(school_types) > 0
    ) values_), '[]'::jsonb),
    'grade_levels', coalesce((select jsonb_agg(value order by value) from (
      select distinct unnest(grade_levels) as value from documents where cardinality(grade_levels) > 0
    ) values_), '[]'::jsonb),
    'validity_years', to_jsonb(array(
      select format('Schuljahr %s/%s', year, year + 1)
      from generate_series(1996, 2030) as year
    ))
  )
$$;

create or replace function public.visualization_entity_totals(
  view_name text default 'countries',
  filter_subject_complexes text[] default '{}',
  filter_federal_states text[] default '{}',
  filter_school_types text[] default '{}',
  filter_grade_levels integer[] default '{}',
  filter_validity_school_years text[] default '{}'
)
returns table (geographic_entity text, entity_type text, mentions bigint, documents bigint)
language sql
stable
security definer
set search_path = public
as $$
  with active_occurrences as (
    select occurrence.*, document.federal_state, document.subject_complexes as document_subject_complexes,
      document.school_types as document_school_types, document.grade_levels as document_grade_levels,
      document.validity_start as document_validity_start, document.validity_end as document_validity_end
    from entity_occurrences as occurrence
    join documents as document on document.id = occurrence.document_id
    where occurrence.text_version_id = document.current_text_version_id
      and occurrence.status in ('pending', 'accepted', 'changed')
      and (case view_name
        when 'countries' then occurrence.entity_type = 'country'
        when 'regions' then occurrence.entity_type in ('region', 'continent')
        when 'historical' then occurrence.entity_type in ('historical_country', 'historical_region')
        else false end)
      and (coalesce(cardinality(filter_federal_states), 0) = 0 or document.federal_state && filter_federal_states)
  ), eligible_occurrences as (
    select occurrence.* from active_occurrences as occurrence
    where case when exists (
      select 1 from text_sections as section
      where section.document_id = occurrence.document_id and section.text_version_id = occurrence.text_version_id
    ) then exists (
      select 1 from text_sections as section
      where section.document_id = occurrence.document_id and section.text_version_id = occurrence.text_version_id
        and occurrence.char_start >= section.char_start and occurrence.char_end <= section.char_end
        and map_metadata_matches(section.subject_complexes, section.school_types, section.grade_levels,
          coalesce(nullif(section.validity_start, ''), occurrence.document_validity_start),
          coalesce(nullif(section.validity_end, ''), occurrence.document_validity_end),
          filter_subject_complexes, filter_school_types, filter_grade_levels, filter_validity_school_years)
    ) else map_metadata_matches(occurrence.document_subject_complexes, occurrence.document_school_types,
      occurrence.document_grade_levels, occurrence.document_validity_start, occurrence.document_validity_end,
      filter_subject_complexes, filter_school_types, filter_grade_levels, filter_validity_school_years) end
  )
  select canonical_entity as geographic_entity,
    case when entity_type = 'continent' then 'region' else entity_type end as entity_type,
    count(*)::bigint as mentions, count(distinct document_id)::bigint as documents
  from eligible_occurrences
  group by canonical_entity, case when entity_type = 'continent' then 'region' else entity_type end
  order by mentions desc, geographic_entity
$$;

create or replace function public.visualization_entity_documents(
  selected_entity text,
  selected_entity_type text,
  view_name text default 'countries',
  filter_subject_complexes text[] default '{}',
  filter_federal_states text[] default '{}',
  filter_school_types text[] default '{}',
  filter_grade_levels integer[] default '{}',
  filter_validity_school_years text[] default '{}'
)
returns table (document_id text, title text, source_file text, federal_state text[], subjects text[], subject_complexes text[], school_types text[], grade_levels integer[], validity_start text, validity_end text, mentions bigint)
language sql
stable
security definer
set search_path = public
as $$
  with active_occurrences as (
    select occurrence.*, document.title, document.source_file, document.federal_state, document.subjects,
      document.subject_complexes as document_subject_complexes, document.school_types as document_school_types,
      document.grade_levels as document_grade_levels, document.validity_start as document_validity_start,
      document.validity_end as document_validity_end
    from entity_occurrences as occurrence join documents as document on document.id = occurrence.document_id
    where occurrence.text_version_id = document.current_text_version_id
      and occurrence.status in ('pending', 'accepted', 'changed') and occurrence.canonical_entity = selected_entity
      and (case when occurrence.entity_type = 'continent' then 'region' else occurrence.entity_type end) = selected_entity_type
      and (case view_name when 'countries' then occurrence.entity_type = 'country'
        when 'regions' then occurrence.entity_type in ('region', 'continent')
        when 'historical' then occurrence.entity_type in ('historical_country', 'historical_region') else false end)
      and (coalesce(cardinality(filter_federal_states), 0) = 0 or document.federal_state && filter_federal_states)
  ), eligible_occurrences as (
    select occurrence.* from active_occurrences as occurrence
    where case when exists (select 1 from text_sections as section where section.document_id = occurrence.document_id and section.text_version_id = occurrence.text_version_id)
      then exists (select 1 from text_sections as section where section.document_id = occurrence.document_id and section.text_version_id = occurrence.text_version_id
        and occurrence.char_start >= section.char_start and occurrence.char_end <= section.char_end
        and map_metadata_matches(section.subject_complexes, section.school_types, section.grade_levels,
          coalesce(nullif(section.validity_start, ''), occurrence.document_validity_start), coalesce(nullif(section.validity_end, ''), occurrence.document_validity_end),
          filter_subject_complexes, filter_school_types, filter_grade_levels, filter_validity_school_years))
      else map_metadata_matches(occurrence.document_subject_complexes, occurrence.document_school_types, occurrence.document_grade_levels,
        occurrence.document_validity_start, occurrence.document_validity_end, filter_subject_complexes, filter_school_types, filter_grade_levels, filter_validity_school_years) end
  )
  select document_id, title, source_file, federal_state, subjects, document_subject_complexes as subject_complexes,
    document_school_types as school_types, document_grade_levels as grade_levels, document_validity_start as validity_start,
    document_validity_end as validity_end, count(*)::bigint as mentions
  from eligible_occurrences
  group by document_id, title, source_file, federal_state, subjects, document_subject_complexes, document_school_types,
    document_grade_levels, document_validity_start, document_validity_end
  order by mentions desc, document_id
$$;

grant execute on function public.visualization_filter_options() to anon, authenticated;
grant execute on function public.visualization_entity_totals(text, text[], text[], text[], integer[], text[]) to anon, authenticated;
grant execute on function public.visualization_entity_documents(text, text, text, text[], text[], text[], integer[], text[]) to anon, authenticated;
