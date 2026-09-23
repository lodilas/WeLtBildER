"""Build a local transactional SQL import from the verified pre-migration backup.

The generated SQL contains curriculum texts and must stay in ignored backups/.
Run it once through the Supabase SQL editor. It replaces only the ten explicit
pilot IDs and aborts if their current versions changed since the backup.
"""
import hashlib
import json
from pathlib import Path

app = Path(__file__).resolve().parents[1]
root = app.parent
backup = root / 'LehrplanReview_PreMarkdown_Snapshot_2026-09-23/current_cloud_export'
manifest = json.loads((backup / 'manifest.json').read_text(encoding='utf-8'))
for item in manifest['files']:
    p = backup / item['path']
    assert hashlib.sha256(p.read_bytes()).hexdigest() == item['sha256'], f'Backup checksum failed: {p}'
ids = ['16118','16478','16508','18458','18459','18562','25803','41888','48690','48699']
docs = {d['id']: d for d in json.loads((backup / 'database/documents.json').read_text(encoding='utf-8'))}
assert all(i in docs for i in ids)
sql = ['-- PRIVATE: curriculum content; execute once in Supabase SQL Editor.', 'begin;',
       (app / 'supabase/migrations/008_markdown_text_format.sql').read_text(encoding='utf-8'),
       'lock table public.documents, public.text_versions, public.text_sections, public.entity_occurrences in share row exclusive mode;',
       'create temporary table markdown_pilot_input (id text primary key, previous_id uuid, content text) on commit drop;']
for doc_id in ids:
    paths = list((root / 'Lehrplantest/files' / doc_id).glob('*.mistral.raw.md'))
    assert len(paths) == 1
    md = paths[0].read_text(encoding='utf-8')
    assert md.strip() and '$curriculum_md$' not in md
    previous = docs[doc_id]['current_text_version_id']
    sql.append(f"insert into markdown_pilot_input values ('{doc_id}', '{previous}', $curriculum_md${md}$curriculum_md$);")
sql.append('''
do $migration$
declare item record; raw_id uuid; manual_id uuid;
begin
  if (select count(*) from public.documents d join markdown_pilot_input p using(id)) <> 10 then
    raise exception 'Expected all ten pilot documents; nothing changed';
  end if;
  if exists (select 1 from public.documents d join markdown_pilot_input p using(id)
             where d.current_text_version_id is distinct from p.previous_id) then
    raise exception 'Current text differs from backup; refresh backup before import';
  end if;
  for item in select * from markdown_pilot_input loop
    delete from public.entity_occurrences where document_id = item.id;
    delete from public.text_sections where document_id = item.id;
    update public.documents set current_text_version_id = null where id = item.id;
    update public.text_versions set parent_version_id = null where document_id = item.id;
    delete from public.text_versions where document_id = item.id;
    insert into public.text_versions(document_id,version_kind,content,content_format,note)
      values(item.id,'ocr',item.content,'markdown','Mistral OCR 4.0 raw; 2026-09-23') returning id into raw_id;
    insert into public.text_versions(document_id,version_kind,content,content_format,parent_version_id,note)
      values(item.id,'manual',item.content,'markdown',raw_id,'Initial manual Markdown; review required') returning id into manual_id;
    update public.documents set current_text_version_id = manual_id, status = 'machine_cleaned' where id = item.id;
  end loop;
end $migration$;
commit;
select d.id, t.content_format, length(t.content) as characters
from public.documents d join public.text_versions t on t.id=d.current_text_version_id
where d.id in ('16118','16478','16508','18458','18459','18562','25803','41888','48690','48699') order by d.id;
''')
target = app / 'backups/markdown-pilot-2026-09-23.sql'
target.parent.mkdir(exist_ok=True)
target.write_text('\n'.join(sql), encoding='utf-8')
print(f'Backup checksums verified. SQL prepared for {len(ids)} documents: {target}')
