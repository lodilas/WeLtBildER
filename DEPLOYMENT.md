# Bereitstellung: Supabase und GitHub Pages

## 1. Supabase

1. Neues Projekt anlegen und E-Mail-Anmeldung aktivieren.
2. `supabase/migrations/001_review_app.sql` ausführen.
3. In Storage den privaten Bucket `curriculum-assets` verwenden.
4. Vor dem Pilotstart nur die zehn vorhandenen Testdokumente samt ihren bereits erzeugten Textversionen und NER-Fundstellen mit `scripts/import_existing_test_pilot.py` importieren. Das Skript fragt den Service-Role-Key verdeckt ab und speichert ihn nicht.
5. Testkonto anlegen und RLS mit diesem Konto prüfen.

### Erforderliche Datenreihenfolge

1. `documents`;
2. `text_versions` (`ocr`, `clean`, ggf. `manual`);
3. `documents.current_text_version_id`;
4. `subject_lexicon` und `geo_lexicon`;
5. `text_sections` und `entity_occurrences` mit der jeweils passenden `text_version_id`.

PDFs werden unter einem dokumentbezogenen Pfad wie `documents/16118/source.pdf` in `curriculum-assets` abgelegt; dieser Pfad steht in `documents.source_storage_path`.

## 2. Konfiguration

`config.js` enthält ausschließlich:

```js
window.LEHRPLAN_REVIEW_CONFIG = {
  supabaseUrl: 'https://<projekt>.supabase.co',
  supabaseAnonKey: '<öffentlicher-anon-key>',
  storageBucket: 'curriculum-assets',
};
```

Der Anon-Key ist für Browser-Clients vorgesehen. Sicherheit kommt aus Auth und RLS. Den Service-Role-Key nie in diese Datei schreiben.

## 3. GitHub Pages

1. Dieses Verzeichnis in ein neues, privates GitHub-Repository übernehmen.
2. Unter **Settings → Pages** als Source „GitHub Actions“ auswählen.
3. Nach Push auf `main` veröffentlicht [deploy-pages.yml](.github/workflows/deploy-pages.yml) die statischen Dateien.
4. Die in Supabase konfigurierten Auth-Redirect-URLs um die GitHub-Pages-URL ergänzen.

## 4. Späterer OCR-/Cleaning-Worker

Ein separater Docker-Python-Worker nutzt einen geheimen Service-Role-Key, liest Jobs aus einer späteren `processing_jobs`-Tabelle und schreibt neue OCR- und Cleaning-Textversionen. Er ist nicht Bestandteil dieses Piloten und läuft nicht auf GitHub Pages.

Der regelbasierte Geo-NER benötigt keinen Worker: Die statische App gleicht den jeweils aktuellen Manual-Text im Browser mit dem bestätigten Supabase-Geo-Lexikon ab. Eine optionale KI-Komponente kann später ausschließlich Kandidaten für die Erweiterung dieses Lexikons erzeugen.
