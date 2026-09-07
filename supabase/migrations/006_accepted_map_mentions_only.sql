-- A public visualization must reflect reviewed data only.  Replace the two
-- aggregation functions installed by migration 005 so pending, changed and
-- rejected suggestions never enter maps, treemaps or their document lists.

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.visualization_entity_totals(text,text[],text[],text[],integer[],text[])'::regprocedure
  ) into definition;
  execute replace(
    definition,
    'occurrence.status in (''pending'', ''accepted'', ''changed'')',
    'occurrence.status = ''accepted'''
  );

  select pg_get_functiondef(
    'public.visualization_entity_documents(text,text,text,text[],text[],text[],integer[],text[])'::regprocedure
  ) into definition;
  execute replace(
    definition,
    'occurrence.status in (''pending'', ''accepted'', ''changed'')',
    'occurrence.status = ''accepted'''
  );
end
$$;
