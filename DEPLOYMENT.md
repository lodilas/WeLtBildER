# Bereitstellung: Supabase und GitHub Pages

## 1. Supabase

1. Neues Projekt anlegen und E-Mail-Anmeldung aktivieren.
2. `supabase/migrations/001_review_app.sql`, danach `supabase/migrations/002_account_approval_and_roles.sql`, `003_section_metadata.sql` und `004_map_visualization.sql` ausführen.
3. In Storage den privaten Bucket `curriculum-assets` verwenden.
4. Vor dem Pilotstart nur die zehn vorhandenen Testdokumente samt ihren bereits erzeugten Textversionen und NER-Fundstellen mit `scripts/import_existing_test_pilot.py` importieren. Das Skript fragt den Service-Role-Key verdeckt ab und speichert ihn nicht.
5. Testkonto anlegen und RLS mit diesem Konto prüfen.

### Konto-Freigabe und Rollen

Nach Migration 002 bleiben die schon vorhandenen Pilotkonten freigeschaltet. Prüfe in `reviewer_profiles`, dass mindestens die Projektleitung die Rolle `admin` besitzt; falls nötig, kann die Rolle dort einmalig im Supabase Table Editor auf `admin` gesetzt werden. Neue Konten starten als `pending` und können keine Dokumente lesen.

In der Web-App sehen Reviewer und Admins die **Benutzerverwaltung**. Ein Reviewer kann ein wartendes Konto als **Nur lesen** oder **Reviewer** freischalten. Nur ein Admin kann eine Adminrolle vergeben. Jede neue Kontoanfrage erzeugt eine In-App-Benachrichtigung für alle bestehenden Admins.

Die Benachrichtigung erscheint beim nächsten Öffnen der App als Zahl am Knopf **Benutzerverwaltung**. Eine E-Mail-Benachrichtigung ist bewusst nicht Teil der statischen GitHub-Pages-App, weil sie einen separaten Maildienst und einen geheimen Server-Schlüssel voraussetzt.

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

## 5. Weltkarten-Auswertung

`004_map_visualization.sql` legt zwei lesende RPC-Funktionen an. Sie zählen nur Fundstellen der aktuellen Textversionen und schließen verworfene sowie veraltete NER-Vorschläge aus. Wenn ein Dokument bereits Abschnittsmarkierungen besitzt, werden nur Fundstellen innerhalb passender Abschnitte gezählt; ansonsten greift die Dokumentmetadaten-Zuordnung.

Die Karte filtert nach Fachkomplex, Bundesland, Schulform, Klassenstufe und dem Schuljahr innerhalb des Gültigkeitsbereichs. Ein Klick auf ein Land oder einen Regionenmarker lädt die passende Lehrplanliste; ein Klick auf einen Lehrplan öffnet diesen in Schritt 1.
