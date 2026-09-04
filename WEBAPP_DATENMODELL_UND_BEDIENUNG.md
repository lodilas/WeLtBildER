# Lehrplan Review: Daten, Abläufe und Bedienung

Diese Handreichung erklärt die Web-App ohne Programmierkenntnisse. Sie beschreibt den gegenwärtigen Pilotstand: Dokumente und bereits erzeugte Textfassungen sind importiert; ein öffentlicher PDF-Upload, OCR und Cleaning gehören noch nicht zur Web-App.

## 1. Wozu dient die App?

Die App hilft dabei, Lehrpläne schrittweise zu prüfen und auswertbar zu machen. Für jeden Lehrplan werden vier Dinge miteinander verbunden:

1. das Original-PDF;
2. eine korrigierte Textfassung;
3. Angaben dazu, welcher Textabschnitt zu welchem Fach, welcher Klassenstufe oder Schulform gehört;
4. geprüfte geografische Erwähnungen wie `Frankreich`, `Europäische Union` oder `Rhein`.

Die Arbeitsfolge ist bewusst einfach:

```text
PDF → Text prüfen → Abschnitte zuordnen → geografische Erwähnungen prüfen → auswertbare Daten
```

Die App verändert das Original-PDF nie.

## 2. Wo liegen die Daten?

| Bereich | Inhalt | Zweck |
|---|---|---|
| GitHub Pages | Oberfläche der App (HTML, CSS und JavaScript) | Zeigt die App im Browser an. Sie enthält keine vertraulichen Datenbank-Schlüssel. |
| Supabase Storage | Original-PDFs | Die PDFs liegen in einem privaten Speicherbereich und werden angemeldeten Personen zeitweise angezeigt. |
| Supabase-Datenbank | Metadaten, Textfassungen, Abschnitte, Entitäten, Wörterbücher und Prüfprotokoll | Hält alle Arbeitsergebnisse dauerhaft fest. |
| Geo-Lexikon | bestätigte geografische Namen und Varianten | Grundlage der automatischen Vorschläge im Schritt Geo-NER. |

Das PDF ist also eine Datei im Storage. Der Text, die Markierungen und die Entscheidungen sind Datenbankeinträge.

## 3. Das wichtigste Grundprinzip: Versionen statt Überschreiben

Eine Textfassung wird nicht einfach ersetzt. Wenn ein Text wirklich verändert und gespeichert wird, legt die App eine neue `manual`-Version an. Die vorige Fassung bleibt als nachvollziehbare Vorgängerin erhalten.

Das hat zwei Vorteile:

- Der Bearbeitungsverlauf geht nicht verloren.
- Bestätigte geografische Fundstellen können nach einer Textänderung möglichst in die neue Textfassung übertragen werden.

Die App unterscheidet drei Textarten:

| Textart | Bedeutung |
|---|---|
| `ocr` | rohe, maschinell aus dem PDF gewonnene Fassung |
| `clean` | automatisch bereinigte Fassung |
| `manual` | durch eine Person geprüfte und ggf. korrigierte Fassung |

Für die weitere Prüfung und die Geo-Erkennung zählt stets die aktuelle `manual`-Fassung. Ist noch keine manuelle Fassung vorhanden, verweist der Dokumenteintrag zunächst auf die beste vorhandene Textfassung.

## 4. Die sichtbare Oberfläche

### Dokumentliste links

Die linke Leiste zeigt Dokument-ID, Titel und wichtige Metadaten. Die Zahlen darunter bedeuten:

- `Abschnitte`: gespeicherte fachliche bzw. schulformspezifische Textbereiche;
- `mentions`: aktive geografische Fundstellen im aktuellen Text;
- `offen`: noch nicht geprüfte Geo-NER-Vorschläge.

Die Suchzeile durchsucht Dokument-ID, Titel und vorhandene Metadaten. Die Schaltfläche zum Aktualisieren lädt die Übersicht erneut aus Supabase. Der Pfeil kann die linke Dokumentliste einklappen.

### Drei Arbeitsschritte

| Schritt | Aufgabe | Ergebnis |
|---|---|---|
| 1. Metadaten & OCR | Angaben kontrollieren und Text korrigieren | geprüfte Metadaten und ggf. neue Manual-Textversion |
| 2. Abschnitte | Textbereichen Fächer, Klassen usw. zuordnen | markierte, auswertbare Abschnitte |
| 3. Geo-NER | geografische Vorschläge prüfen und ergänzen | bestätigte bzw. verworfene geografische Fundstellen |

Die PDF-Ansicht kann in Schritt 1 und 2 eingeklappt werden. Das spart Platz, ändert aber keine Daten.

## 5. Schritt 1: Metadaten und Textprüfung

### Metadatenfelder

Die Metadaten beschreiben das gesamte Dokument. Die meisten Felder erlauben Mehrfachauswahl über ein Auswahlmenü mit Häkchen; damit werden Schreibvarianten vermieden. Neue Werte können bei Bedarf ergänzt werden.

| Feld | Beispiel | Speicherung |
|---|---|---|
| Dokument-ID | `48690` | eindeutige Kennung des Lehrplans |
| Titel | Titel des Dokuments | frei lesbarer Titel |
| Bundesland | Sachsen, Bayern | Mehrfachwert möglich |
| Fach | Geschichte, Erdkunde | ursprünglicher Fachname des Dokuments |
| Fachkomplex | Geschichte, Geographie, Sozialkunde/Politik | vereinheitlichte Auswertungsgruppe |
| Schulform | Gymnasium, Gesamtschule | Mehrfachwert möglich |
| Klassenstufen | 5, 6, 7, 8 | einzeln gespeicherte Zahlen, nicht nur ein Bereich wie `5–8` |
| Leistungsniveau | Grundkurs, Leistungskurs, Basisfach usw. | meist für die Oberstufe relevant |
| Veröffentlichungsjahr | 2016 | einzelne Jahreszahl |
| Gültigkeit Beginn/Ende | Schuljahr 2023/2024 | zwei getrennte Angaben |
| Sprache | Deutsch, Englisch, Französisch | Mehrfachwert möglich; Deutsch ist voreingestellt |
| Quellen-URL | Zotero- oder Web-Adresse | Herkunftshinweis |

Mit **„Metadaten speichern“** werden die Angaben am Dokument gespeichert. Die Quelle wird dann als manuell geprüft gekennzeichnet. Die Metadaten selbst sind keine Textmarkierungen und gelten zunächst für das ganze Dokument.

### Textbereich und Speichern als `manual.txt`

Rechts steht die aktuelle Textfassung in einem editierbaren Feld. Mit **„Als manual.txt speichern“** passiert Folgendes:

1. Die App prüft, ob der Text gegenüber der bisherigen aktuellen Fassung tatsächlich verändert wurde.
2. Bei einer Änderung wird eine neue unveränderliche Manual-Textversion gespeichert.
3. Vorhandene aktive Geo-Fundstellen werden auf die neue Textfassung übertragen, wenn ihre Schreibweise und ihr Kontext eindeutig wiedergefunden werden.
4. Nicht eindeutig übertragbare Fundstellen werden nicht blind verschoben. Sie werden beim nächsten Geo-NER-Lauf wieder als offene Vorschläge angeboten.
5. Das Dokument verweist anschließend auf die neue Textversion als aktuelle Fassung.

Damit ist eine Einfügung am Anfang eines langen Textes kein Problem: Eine bestätigte Fundstelle weiter unten kann dennoch bestätigt bleiben, sofern sie eindeutig wiedergefunden wird.

Die Textsuche startet erst mit `Enter`. Die Pfeile wechseln zwischen Treffern. Ein Klick in den Text beendet den reinen Suchmodus und ermöglicht wieder normales Bearbeiten.

### „NER-Review öffnen“

Dieser Knopf speichert zuerst ggf. Textänderungen und öffnet Schritt 3. Anschließend wird der aktuelle Text gegen das Geo-Lexikon abgeglichen. Dafür wird kein externer NER-Server und kein KI-Modell benötigt.

## 6. Schritt 2: Abschnittsprüfung

Manche PDFs enthalten Vorgaben für mehrere Fächer, Klassenstufen oder Schulformen. Die Metadaten des gesamten Dokuments reichen dann für spätere Auswertungen nicht aus. Deshalb werden relevante Textbereiche separat markiert.

### Einen Abschnitt anlegen

1. Im mittleren Textfeld den gewünschten Bereich markieren.
2. **„Textauswahl als Abschnitt“** wählen.
3. Rechts Titel und Zuordnungen festlegen, etwa Fach `Geschichte`, Klassenstufen `7; 8` oder Schulform `Gymnasium`.
4. Abschnitt speichern.

Die App speichert nicht den Text doppelt, sondern seine Start- und Endposition in der aktuellen Textversion. Ein Abschnitt gehört deshalb immer genau zu einer Textversion.

Weitere Knöpfe:

| Knopf | Wirkung |
|---|---|
| **Ganzes Dokument als Abschnitt** | legt einen Bereich vom ersten bis zum letzten Zeichen an |
| Eintrag in der Abschnittsliste | springt zum Beginn dieses Abschnitts im Text |
| **Abschnitt speichern** | legt einen neuen Abschnitt an oder aktualisiert den ausgewählten |
| **Abschnitt löschen** | entfernt nur die Abschnittszuordnung, niemals den Text oder das PDF |

Für spätere fachbezogene Auswertungen werden nur die Geo-Erwähnungen gezählt, deren Zeichenposition innerhalb eines passend zugeordneten Abschnitts liegt.

## 7. Schritt 3: Geo-NER und manuelle Prüfung

### Was bedeutet Geo-NER?

Geo-NER bedeutet hier: Die App sucht im Text Namen geografischer Einheiten und schlägt sie zur Prüfung vor. Sie nutzt dafür das gemeinsame Geo-Lexikon, nicht ein allgemeines Nachrichtenmodell.

Das Lexikon enthält beispielsweise:

- Staaten und historische Staaten;
- Regionen, Kontinente und historische Regionen;
- Bundesländer und andere Untereinheiten;
- Städte, Flüsse, Gebirge und Meere;
- Nationalitäts- und historische Adjektivformen, soweit sie im Lexikon bestätigt wurden.

Beim Öffnen von Schritt 3 und beim Klick auf **„NER neu ausführen“** geschieht Folgendes:

1. Die aktuelle Manual-Textfassung wird geladen.
2. Die App lädt alle bestätigten Lexikoneinträge.
3. Sie sucht passende Schreibweisen im Text, ohne Groß-/Kleinschreibung zu unterscheiden.
4. Überlappungen werden vermieden: Bei automatischen Treffern gewinnt die längere zusammengesetzte Einheit, z. B. `Europäische Union` statt zusätzlich `Union`.
5. Neue automatische Treffer werden als `pending` (= offen) gespeichert.
6. Frühere automatische offene Treffer derselben Textversion werden als `stale` (= historisch/veraltet) markiert und nicht mehr angezeigt.
7. Bereits von Menschen entschiedene oder manuell angelegte Fundstellen bleiben vorrangig erhalten.

### Die rechte Vorschlagsliste

Jeder Eintrag zeigt:

```text
Textform → vereinheitlichter Name
Entitätstyp · Prüfstatus · Herkunft
```

Beispiel:

```text
französischen → Frankreich
country · pending · shared_lexicon
```

Ein Klick auf einen Listeneintrag wählt ihn aus und springt zur entsprechenden markierten Stelle im Text. Die Liste ist nach Textposition geordnet. Doppelte oder überlappende aktive Fundstellen werden nicht gezeigt.

### Entscheidungen zu einem Vorschlag

| Knopf | Wirkung | späterer Status |
|---|---|---|
| **Akzeptieren** | Vorschlag stimmt | `accepted` |
| **Verwerfen** | Stelle ist keine passende Geo-Entität | `rejected` |
| **Ändern** | Name, Typ oder Hinweis werden korrigiert und gespeichert | `changed` |
| **Alle offenen Vorschläge akzeptieren** | akzeptiert alle momentan offenen Vorschläge des Dokuments nach Sicherheitsabfrage | `accepted` |

Nach Akzeptieren, Verwerfen oder Ändern springt die App direkt zur nächsten offenen Fundstelle. Die Entscheidung und ihre vorherige Fassung werden zusätzlich im Prüfprotokoll gesichert.

### Eine neue Entität ergänzen

Wenn die App eine Entität nicht erkannt hat:

1. Die betreffende Textstelle markieren.
2. **„Markierung übernehmen“** wählen.
3. Den vereinheitlichten Namen und einen Typ aus dem Auswahlmenü wählen.
4. Speichern.

Die konkrete Fundstelle wird direkt als `accepted` gespeichert. Zugleich wird die Schreibweise in das gemeinsame Geo-Lexikon übernommen und als geprüft markiert. Künftige NER-Läufe können diese Schreibweise damit auch in anderen Dokumenten erkennen.

Die verfügbaren Typen sind:

`country`, `region`, `continent`, `substate`, `historical_country`, `historical_region`, `city`, `river`, `mountain_range`, `sea`, `other_geographic`.

In der Oberfläche können diese als Land, Region, Kontinent, Untereinheit, historisches Land, historische Region, Stadt, Fluss, Gebirge, Meer oder sonstige geografische Einheit erläutert werden.

## 8. Die Datenbanktabellen in Alltagssprache

### `documents`: der Steckbrief eines Lehrplans

Eine Zeile entspricht einem Lehrplan. Neben den Metadaten enthält sie:

| Variable/Feld | Bedeutung |
|---|---|
| `id` | Dokument-ID, z. B. `48690` |
| `source_file` | ursprünglicher Dateiname |
| `source_storage_path` | Speicherort der PDF im privaten Bucket |
| `current_text_version_id` | Verweis auf die momentan gültige Textfassung |
| `status` | grober Bearbeitungsstand, z. B. maschinell bereinigt, manuell geprüft oder NER ausgeführt |
| `created_at`, `updated_at` | Zeitstempel für Anlage und letzte Änderung |

### `text_versions`: alle Textfassungen

Eine Zeile ist eine bestimmte Fassung eines Textes. Das Feld `content` enthält den vollständigen Text. `parent_version_id` verweist auf die vorherige Fassung. Die Prüfsumme `content_sha256` hilft, identische Inhalte technisch zu erkennen.

### `text_sections`: fachliche Textbereiche

Eine Zeile markiert einen Bereich innerhalb einer bestimmten Textversion. Wichtige Felder sind `char_start` und `char_end`: Das sind die Zeichenpositionen, an denen der Bereich beginnt und endet. Dazu kommen die zugeordneten Fächer, Fachkomplexe, Klassenstufen, Schulformen und Leistungsniveaus.

### `entity_occurrences`: einzelne geografische Fundstellen

Eine Zeile entspricht einer Fundstelle im Text, nicht einem Ort als solchem. Derselbe Ort kann deshalb in einem Dokument mehrfach vorkommen.

| Variable/Feld | Bedeutung |
|---|---|
| `surface_form` | Schreibweise, wie sie konkret im Text steht, z. B. `Europas` |
| `canonical_entity` | vereinheitlichte Auswertungsform, z. B. `Europa` |
| `entity_type` | Art der Einheit, z. B. `country` oder `river` |
| `char_start`, `char_end` | genaue Position im zugehörigen Text |
| `source` | Herkunft: gemeinsames Lexikon, manuelle Ergänzung oder importierter Bestand |
| `status` | offen, akzeptiert, verworfen, geändert oder historisch/veraltet |
| `note` | optionaler Kommentar |

### `geo_lexicon`: das gemeinsame Orts- und Regionenwörterbuch

Eine Zeile ordnet eine Schreibweise (`surface_form`) einer vereinheitlichten Entität (`canonical_entity`) und einem Typ zu. Nur Einträge mit `reviewed = true` werden für den automatischen Abgleich verwendet.

Beispiel:

```text
surface_form: französischen
canonical_entity: Frankreich
entity_type: country
reviewed: true
```

### `subject_lexicon`: die Fachzuordnung

Dieses Lexikon ordnet konkrete Fachnamen einem Fachkomplex zu, etwa `Erdkunde` → `Geographie`. Die ursprüngliche Bezeichnung im Dokument bleibt dennoch als Fachangabe erhalten.

### `review_actions`: das Prüfprotokoll

Hier wird festgehalten, welche prüfende Person wann etwas entschieden hat. Bei einer Entitätsentscheidung enthält das Protokoll den Stand davor und danach. So lassen sich spätere Rückfragen nachvollziehen, ohne die Textfassung zurücksetzen zu müssen.

### `reviewer_profiles`: Benutzerinnen und Benutzer

Zu jedem Supabase-Konto gibt es ein Profil mit Anzeigename und Rolle (`admin`, `reviewer`, `viewer`). Im aktuellen Pilotbetrieb ist die Rolle vor allem eine vorbereitete Information; die Datenbankrechte unterscheiden die Rollen noch nicht vollständig.

## 9. Wie sehen die Daten am Ende aus?

Für eine belastbare Auswertung werden normalerweise nur aktive Fundstellen mit den Status `accepted` und `changed` verwendet. `rejected` wird nicht gezählt; `pending` kann je nach Analyse als ungeprüft ausgewiesen oder ausgeschlossen werden; `stale` ist reine Historie.

Eine auswertbare Zeile lässt sich gedanklich so lesen:

| Dokument | Abschnitt | Fachkomplex | Klassenstufe | Entität | Typ | Status |
|---|---|---|---:|---|---|---|
| 48690 | Geschichte, Klassen 11–12 | Geschichte | 12 | Europäische Union | region | accepted |

Für Weltkarten oder Häufigkeitstabellen werden diese Zeilen anschließend gruppiert, beispielsweise nach:

- vereinheitlichter Entität;
- Entitätstyp;
- Fach bzw. Fachkomplex;
- Bundesland;
- Klassenstufe;
- Schulform;
- Gültigkeitszeitraum.

Die Karten- und Aggregationsansicht ist der nächste geplante Bestandteil. Die Web-App speichert bereits alle dafür benötigten Grunddaten, erzeugt aber im aktuellen Pilotstand noch keine endgültigen Ergebniskarten.

## 10. Sicherheit, Zusammenarbeit und Grenzen des Piloten

- Die PDFs sind nicht öffentlich; angemeldete Personen erhalten zeitlich begrenzte Zugriffslinks.
- Das Geo-NER läuft im Browser. Es wird kein Text an einen externen KI-Dienst geschickt.
- Der öffentliche Publishable-Key darf technisch im Browser vorhanden sein. Er ist kein Administrationsschlüssel.
- Der Service-Role-Key wird nur für Admin-Importe und Backups verwendet, nie in GitHub Pages oder im Browser.
- Im derzeitigen Pilotbetrieb können alle angemeldeten Reviewer die Testdaten lesen und bearbeiten. Vor einem breiteren Einsatz sollten die Rechte auf Projekte bzw. Teams begrenzt werden.
- Zwei Personen sollten nicht gleichzeitig denselben Lehrplantext bearbeiten oder gleichzeitig den NER-Lauf desselben Dokuments starten. Die Versionierung verhindert Datenverlust weitgehend, ersetzt aber keine gemeinsame Bearbeitungssperre.

## 11. Was geschieht nicht automatisch?

Die aktuelle Web-App führt keinen PDF-Upload, keine OCR und kein Text-Cleaning aus. Diese Schritte bleiben bis zum Aufbau eines getrennten OCR-/Cleaning-Workers außerhalb der veröffentlichten GitHub-Pages-App. Ebenso werden die endgültigen Karten und Häufigkeitstabellen erst in einem späteren Auswertungsschritt erzeugt.
