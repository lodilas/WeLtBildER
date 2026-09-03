# Lehrplan Review – Supabase/GitHub-Pages-Pilot

Diese Anwendung ist die getrennte Cloud-Testversion des lokalen Lehrplan-Review-Prototyps. Sie enthält bewusst **keinen** PDF-Upload und **keinen** OCR-/NER-Worker. Sie prüft bereits vorhandene Dokumente und Textversionen in drei Schritten:

1. Metadaten und OCR-/Manual-Text;
2. fach-, klassen- und schulformspezifische Textabschnitte;
3. vorhandene Geo-NER-Vorschläge und manuelle Entitäten.

## Architektur

- GitHub Pages liefert `index.html`, `styles.css`, `app.js` und `config.js` aus.
- Supabase liefert Auth, PostgreSQL und den privaten Storage-Bucket `curriculum-assets`.
- Die App nutzt ausschließlich den öffentlichen Supabase-Anon-Key. Dieser darf im Browser sichtbar sein; Schutz entsteht durch Row-Level Security.
- Ein künftiger OCR-/NER-Worker läuft getrennt und schreibt nur neue Textversionen bzw. Fundstellen in dieselben Tabellen.

## Einrichten

1. Neues Supabase-Projekt anlegen.
2. [Migration](supabase/migrations/001_review_app.sql) im SQL Editor ausführen.
3. Den bestehenden Zehn-Dokumente-Testbestand mit `scripts/import_existing_test_pilot.py` einmalig als Admin importieren. Dies ist kein Benutzer-Upload; eine Benutzer-Upload-Funktion existiert nicht.
4. `config.example.js` nach `config.js` übertragen und Supabase-URL sowie **Anon-Key** eintragen.
5. Einen Testnutzer in Supabase Auth anlegen oder die Anmeldefunktion für den Pilotbetrieb verwenden.
6. Statisch lokal testen, z. B. mit einem beliebigen lokalen Webserver, und anschließend über GitHub Pages deployen.

## Start lokal

Da der Browser ES-Module lädt, die Dateien nicht direkt per `file:///` öffnen. Beispielsweise mit einem lokalen statischen Server aus einem Python-3-Umfeld:

```powershell
cd C:\Users\wf371\Documents\Codex\LehrplanReview_Supabase_App
& "C:\Users\wf371\Documents\Codex\Lehrplantest\.ocr-venv\Scripts\python.exe" -m http.server 8780
```

Dann `http://127.0.0.1:8780/` öffnen.

## Sicherheitsgrenzen des Piloten

Die RLS-Policies erlauben allen angemeldeten Pilot-Rezensierenden Zugriff. Vor dem Import des vollständigen Korpus müssen sie durch projekt- bzw. mitgliedschaftsbezogene Policies ersetzt werden. Der Service-Role-Key gehört ausschließlich in spätere Admin-Import- oder Worker-Umgebungen, niemals in GitHub Pages, `config.js` oder Browser-Code.

Weitere Details stehen in [DEPLOYMENT.md](DEPLOYMENT.md).
