-- Aggregation functions for the interactive map. They expose active current-
-- country, region and continent occurrences, but exclude rejected and stale
-- suggestions so the review state remains reflected in the visualization.

create or replace function public.map_metadata_matches(
  value_subject_complexes text[],
  value_school_types text[],
  value_grade_levels integer[],
  value_validity_start text,
  value_validity_end text,
  filter_subject_complexes text[] default '{}',
  filter_school_types text[] default '{}',
  filter_grade_levels integer[] default '{}',
  filter_validity_school_years text[] default '{}'
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    (coalesce(cardinality(filter_subject_complexes), 0) = 0 or coalesce(value_subject_complexes, '{}') && filter_subject_complexes)
    and (coalesce(cardinality(filter_school_types), 0) = 0 or coalesce(value_school_types, '{}') && filter_school_types)
    and (coalesce(cardinality(filter_grade_levels), 0) = 0 or coalesce(value_grade_levels, '{}') && filter_grade_levels)
    and (
      coalesce(cardinality(filter_validity_school_years), 0) = 0
      or exists (
        select 1
        from unnest(filter_validity_school_years) as requested(school_year)
        where substring(requested.school_year from '([0-9]{4})')::integer
          between coalesce(substring(nullif(value_validity_start, '') from '([0-9]{4})')::integer, 0)
              and coalesce(substring(nullif(value_validity_end, '') from '([0-9]{4})')::integer, 9999)
      )
    )
$$;

create or replace function public.map_entity_totals(
  filter_subject_complexes text[] default '{}',
  filter_federal_states text[] default '{}',
  filter_school_types text[] default '{}',
  filter_grade_levels integer[] default '{}',
  filter_validity_school_years text[] default '{}'
)
returns table (geographic_entity text, entity_type text, mentions bigint, documents bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with active_occurrences as (
    select occurrence.*, document.federal_state, document.subject_complexes as document_subject_complexes,
      document.school_types as document_school_types, document.grade_levels as document_grade_levels,
      document.validity_start as document_validity_start, document.validity_end as document_validity_end
    from public.entity_occurrences as occurrence
    join public.documents as document on document.id = occurrence.document_id
    where occurrence.text_version_id = document.current_text_version_id
      and occurrence.status in ('pending', 'accepted', 'changed')
      and occurrence.entity_type in ('country', 'region', 'continent')
      and (coalesce(cardinality(filter_federal_states), 0) = 0 or document.federal_state && filter_federal_states)
  ), eligible_occurrences as (
    select occurrence.*
    from active_occurrences as occurrence
    where case
      when exists (
        select 1 from public.text_sections as section
        where section.document_id = occurrence.document_id and section.text_version_id = occurrence.text_version_id
      ) then exists (
        select 1 from public.text_sections as section
        where section.document_id = occurrence.document_id
          and section.text_version_id = occurrence.text_version_id
          and occurrence.char_start >= section.char_start and occurrence.char_end <= section.char_end
          and public.map_metadata_matches(
            section.subject_complexes, section.school_types, section.grade_levels,
            coalesce(nullif(section.validity_start, ''), occurrence.document_validity_start),
            coalesce(nullif(section.validity_end, ''), occurrence.document_validity_end),
            filter_subject_complexes, filter_school_types, filter_grade_levels, filter_validity_school_years
          )
      ) else public.map_metadata_matches(
        occurrence.document_subject_complexes, occurrence.document_school_types, occurrence.document_grade_levels,
        occurrence.document_validity_start, occurrence.document_validity_end,
        filter_subject_complexes, filter_school_types, filter_grade_levels, filter_validity_school_years
      )
    end
  )
  select canonical_entity as geographic_entity,
    case when entity_type = 'country' then 'country' else 'region' end as entity_type,
    count(*)::bigint as mentions,
    count(distinct document_id)::bigint as documents
  from eligible_occurrences
  group by canonical_entity, case when entity_type = 'country' then 'country' else 'region' end
  order by mentions desc, geographic_entity
$$;

create or replace function public.map_entity_documents(
  selected_entity text,
  selected_entity_type text,
  filter_subject_complexes text[] default '{}',
  filter_federal_states text[] default '{}',
  filter_school_types text[] default '{}',
  filter_grade_levels integer[] default '{}',
  filter_validity_school_years text[] default '{}'
)
returns table (document_id text, title text, source_file text, federal_state text[], subjects text[], subject_complexes text[], school_types text[], grade_levels integer[], validity_start text, validity_end text, mentions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with active_occurrences as (
    select occurrence.*, document.title, document.source_file, document.federal_state, document.subjects,
      document.subject_complexes as document_subject_complexes, document.school_types as document_school_types,
      document.grade_levels as document_grade_levels, document.validity_start as document_validity_start,
      document.validity_end as document_validity_end
    from public.entity_occurrences as occurrence
    join public.documents as document on document.id = occurrence.document_id
    where occurrence.text_version_id = document.current_text_version_id
      and occurrence.status in ('pending', 'accepted', 'changed')
      and occurrence.canonical_entity = selected_entity
      and (case when occurrence.entity_type = 'country' then 'country' else 'region' end) = selected_entity_type
      and occurrence.entity_type in ('country', 'region', 'continent')
      and (coalesce(cardinality(filter_federal_states), 0) = 0 or document.federal_state && filter_federal_states)
  ), eligible_occurrences as (
    select occurrence.*
    from active_occurrences as occurrence
    where case
      when exists (
        select 1 from public.text_sections as section
        where section.document_id = occurrence.document_id and section.text_version_id = occurrence.text_version_id
      ) then exists (
        select 1 from public.text_sections as section
        where section.document_id = occurrence.document_id
          and section.text_version_id = occurrence.text_version_id
          and occurrence.char_start >= section.char_start and occurrence.char_end <= section.char_end
          and public.map_metadata_matches(
            section.subject_complexes, section.school_types, section.grade_levels,
            coalesce(nullif(section.validity_start, ''), occurrence.document_validity_start),
            coalesce(nullif(section.validity_end, ''), occurrence.document_validity_end),
            filter_subject_complexes, filter_school_types, filter_grade_levels, filter_validity_school_years
          )
      ) else public.map_metadata_matches(
        occurrence.document_subject_complexes, occurrence.document_school_types, occurrence.document_grade_levels,
        occurrence.document_validity_start, occurrence.document_validity_end,
        filter_subject_complexes, filter_school_types, filter_grade_levels, filter_validity_school_years
      )
    end
  )
  select document_id, title, source_file, federal_state, subjects,
    document_subject_complexes as subject_complexes, document_school_types as school_types,
    document_grade_levels as grade_levels, document_validity_start as validity_start,
    document_validity_end as validity_end, count(*)::bigint as mentions
  from eligible_occurrences
  group by document_id, title, source_file, federal_state, subjects, document_subject_complexes,
    document_school_types, document_grade_levels, document_validity_start, document_validity_end
  order by mentions desc, document_id
$$;
