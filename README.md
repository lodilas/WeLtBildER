# Lehrplan Review – Supabase/GitHub-Pages-Pilot

Diese Anwendung ist die getrennte Cloud-Testversion des lokalen Lehrplan-Review-Prototyps. Sie enthält bewusst **keinen** PDF-Upload und **keinen** OCR-/Cleaning-Worker. Sie prüft bereits vorhandene Dokumente und Textversionen in drei Schritten:

1. Metadaten und OCR-/Manual-Text;
2. fach-, klassen- und schulformspezifische Textabschnitte;
3. Geo-NER per direktem Abgleich des aktuellen Manual-Texts mit dem gemeinsamen Geo-Lexikon sowie manuelle Entitäten.

## Architektur

- GitHub Pages liefert `index.html`, `styles.css`, `app.js` und `config.js` aus.
- Supabase liefert Auth, PostgreSQL und den privaten Storage-Bucket `curriculum-assets`.
- Die App nutzt ausschließlich den öffentlichen Supabase-Anon-Key. Dieser darf im Browser sichtbar sein; Schutz entsteht durch Row-Level Security.
- Der Geo-NER läuft direkt im Browser gegen `geo_lexicon`; dafür ist kein Worker erforderlich.
- Ein künftiger OCR-/Cleaning-Worker läuft getrennt und schreibt neue Textversionen in dieselben Tabellen. Eine optionale KI-Auswertung kann später nur Vorschläge zur Erweiterung des Geo-Lexikons erzeugen.

## Sicherheitsgrenzen des Piloten

Neue Registrierungen erhalten zunächst keinen Datenzugriff. Sie müssen in der Benutzerverwaltung durch einen Reviewer oder Admin freigeschaltet werden. Reviewer können die Rollen **Nur lesen** und **Reviewer** vergeben; nur Admins dürfen weitere Admins ernennen. Bei jeder Kontoanfrage erhalten alle Admins eine In-App-Benachrichtigung. Der Service-Role-Key gehört ausschließlich in spätere Admin-Import- oder Worker-Umgebungen, niemals in GitHub Pages, `config.js` oder Browser-Code.

Weitere Details stehen in [DEPLOYMENT.md](DEPLOYMENT.md).

Eine ausführliche, nichttechnische Erklärung von Datenstruktur und Bedienung steht in [WEBAPP_DATENMODELL_UND_BEDIENUNG.md](WEBAPP_DATENMODELL_UND_BEDIENUNG.md).
