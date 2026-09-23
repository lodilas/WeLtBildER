# Markdown-Pilot, 23. September 2026

Die zehn Dokumente 16118, 16478, 16508, 18458, 18459, 18562, 25803,
41888, 48690 und 48699 erhalten jeweils Mistral-Rohfassung (version_kind=ocr)
und manuelle Ausgangsfassung (version_kind=manual), content_format=markdown.
Weitere manuelle Speichervorgänge erzeugen weiterhin unveränderliche Versionen.

## Bedienung

Schritt 1: Markdown-Quelltext bearbeiten; die aufklappbare formatierte Vorschau
zeigt Überschriften, Fettdruck, Code und Pipe-Tabellen. Zum Aktualisieren erneut
öffnen. Die PDF bleibt die Referenz. Schritt 2 und 3 sowie die Karten-Textansicht
zeigen die formatierte Fassung. Die vorhandene Auswahl und Suche verwenden
weiterhin Zeichenpositionen im gespeicherten Quelltext (UTF-16 in JavaScript).
Syntax bleibt dazu als unsichtbarer Text im DOM erhalten; nicht aus textContent
entfernen. Der Renderer verarbeitet bewusst keine aktiven HTML-Inhalte.
Dies ist eine auf den Mistral-Piloten abgestimmte Markdown-Darstellung, kein
vollständiger CommonMark-Renderer (z.B. keine eingebetteten Bilder/HTML-Tabellen).
NER maskiert Bildreferenzen, HTML-Tags und Linkziele positionsgetreu.

## Import und Rücksetzung

008_markdown_text_format.sql ergänzt das Textformat, bestehende Daten bleiben
dadurch kompatibel. scripts/prepare_markdown_pilot.py prüft die Prüfsummen des
frischen Backups und erzeugt backups/markdown-pilot-2026-09-23.sql. Diese lokale
Datei enthält bereits Migration 008 UND alle zehn Markdown-Texte. Nicht ins
öffentliche Repository aufnehmen. Im Supabase SQL-Editor einmal ausführen.

Die Transaktion sperrt konkurrierende Schreibzugriffe während des Imports und
prüft die aktuellen Textversions-IDs gegen die Sicherung. Bei Abweichung bricht
sie ab. Für genau die zehn IDs werden alte text_sections, entity_occurrences
und text_versions entfernt. PDFs, Dokumentmetadaten, Lexika und Nutzer bleiben
erhalten. review_actions bleibt als Historie erhalten; verwaiste Versions- und
Fundstellenverweise werden über bestehende Fremdschlüssel auf NULL gesetzt.
Es gibt keine separaten NER-Vektordateien im bisherigen Datenmodell.

Der Startzustand enthält 20 Markdown-Versionen und keine Abschnitte/Fundstellen
für die zehn Dokumente. Die Karte zeigt sie erst nach neuer NER-Prüfung wieder.
Der Import ist absichtlich nicht wiederholbar: ein erneuter Lauf wird durch
die Prüfung der alten Versions-IDs verhindert.

## Prüfung

scripts/test_markdown_view.cjs läuft mit Playwright/Edge und allen zehn lokalen
Rohfassungen. Geprüft werden unverändertes textContent, Auswahlpositionen,
erhaltene Markierungen, URL-Maskierung und unschädliche HTML-Anzeige.
Online-End-to-End-Prüfung mit Anmeldung erst nach Durchführung des SQL-Imports.
