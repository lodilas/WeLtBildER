-- Repair installations where the earlier version of migration 006 was run.
-- `changed` is a human-reviewed correction, not an open NER suggestion.

do $$
declare
  definition text;
  reviewed_filter text := 'occurrence.status in (''accepted'', ''changed'')';
begin
  select pg_get_functiondef(
    'public.visualization_entity_totals(text,text[],text[],text[],integer[],text[])'::regprocedure
  ) into definition;
  definition := replace(
    definition,
    'occurrence.status in (''pending'', ''accepted'', ''changed'')',
    reviewed_filter
  );
  execute replace(definition, 'occurrence.status = ''accepted''', reviewed_filter);

  select pg_get_functiondef(
    'public.visualization_entity_documents(text,text,text,text[],text[],text[],integer[],text[])'::regprocedure
  ) into definition;
  definition := replace(
    definition,
    'occurrence.status in (''pending'', ''accepted'', ''changed'')',
    reviewed_filter
  );
  execute replace(definition, 'occurrence.status = ''accepted''', reviewed_filter);
end
$$;
