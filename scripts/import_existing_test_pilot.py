"""One-time, idempotence-safe import of the existing ten-document pilot.

This script does not offer a user-facing upload function and does not run OCR.
It reads only the already reviewed local test corpus and writes it to a new
Supabase project.  The service-role key is requested interactively and kept
only in process memory.

Usage (first inspect, then import):
  python import_existing_test_pilot.py --url https://<project>.supabase.co \
    --reviewer-id <uuid> --dry-run
  python import_existing_test_pilot.py --url https://<project>.supabase.co \
    --reviewer-id <uuid>
"""

from __future__ import annotations

import argparse
import csv
import getpass
import json
import sqlite3
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen


APP_ROOT = Path(__file__).resolve().parents[1]
CODEX_ROOT = APP_ROOT.parent
LOCAL_APP = CODEX_ROOT / "LehrplanReview_App"
LOCAL_DB = LOCAL_APP / "data" / "review_app.db"
SUBJECT_LEXICON = LOCAL_APP / "data" / "subject_lexicon.csv"
GEO_LEXICON = LOCAL_APP / "data" / "geo_lexicon.csv"
BUCKET = "curriculum-assets"
BATCH_SIZE = 250


def values(value: str | None) -> list[str]:
    return [item.strip() for item in str(value or "").split(";") if item.strip()]


def integer_values(value: str | None) -> list[int]:
    result: list[int] = []
    for item in values(value):
        try:
            result.append(int(item))
        except ValueError:
            pass
    return result


class SupabaseAdmin:
    def __init__(self, project_url: str, service_key: str) -> None:
        self.project_url = project_url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Accept": "application/json",
        }

    def request(
        self,
        method: str,
        path: str,
        payload: Any | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> Any:
        headers = dict(self.headers)
        headers.update(extra_headers or {})
        data = None
        if payload is not None:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            headers.setdefault("Content-Type", "application/json")
        request = Request(self.project_url + path, data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=120) as response:
                body = response.read()
                return json.loads(body.decode("utf-8")) if body else None
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase {method} {path}: HTTP {error.code}: {detail}") from error

    def upsert(self, table: str, rows: list[dict[str, Any]], conflict: str) -> Any:
        if not rows:
            return []
        return self.request(
            "POST",
            f"/rest/v1/{table}?on_conflict={quote(conflict)}",
            rows,
            {"Prefer": "resolution=merge-duplicates,return=representation"},
        )

    def insert(self, table: str, rows: list[dict[str, Any]], returning: bool = False) -> Any:
        if not rows:
            return []
        preference = "return=representation" if returning else "return=minimal"
        return self.request("POST", f"/rest/v1/{table}", rows, {"Prefer": preference})

    def upload_pdf(self, storage_path: str, source: Path) -> None:
        headers = {**self.headers, "Content-Type": "application/pdf", "x-upsert": "true"}
        request = Request(
            self.project_url + f"/storage/v1/object/{BUCKET}/{quote(storage_path, safe='/')}",
            data=source.read_bytes(),
            headers=headers,
            method="PUT",
        )
        try:
            with urlopen(request, timeout=300):
                return
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"PDF upload {source.name}: HTTP {error.code}: {detail}") from error


def chunks(rows: list[dict[str, Any]], size: int = BATCH_SIZE) -> Iterable[list[dict[str, Any]]]:
    for start in range(0, len(rows), size):
        yield rows[start : start + size]


def unique_rows(rows: list[dict[str, Any]], key: str, prefer_reviewed: bool = False) -> list[dict[str, Any]]:
    """Return one deterministic row per unique-key value for a PostgREST upsert.

    PostgreSQL rejects a bulk ``ON CONFLICT DO UPDATE`` when one request
    contains the same conflict key more than once.  The historic local
    geo-lexicon intentionally contains a few duplicate surface forms.  Keep
    the last occurrence, except that a confirmed row always outranks an
    unconfirmed one.
    """
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        value = str(row[key]).strip()
        existing = result.get(value)
        if existing is None or not prefer_reviewed or row.get("reviewed") or not existing.get("reviewed"):
            result[value] = row
    return list(result.values())


def load_local() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    if not LOCAL_DB.exists():
        raise FileNotFoundError(f"Lokale Testdatenbank fehlt: {LOCAL_DB}")
    with sqlite3.connect(LOCAL_DB) as connection:
        connection.row_factory = sqlite3.Row
        documents = [dict(row) for row in connection.execute("select * from documents order by id")]
        occurrences = [dict(row) for row in connection.execute("select * from entity_occurrences order by id")]
        sections = [dict(row) for row in connection.execute("select * from text_sections order by id")]
        actions = [dict(row) for row in connection.execute("select * from review_actions order by id")]
    return documents, occurrences, sections, actions


def document_payload(row: dict[str, Any], reviewer_id: str) -> dict[str, Any]:
    year = None
    try:
        year = int(row.get("publication_year") or "")
    except ValueError:
        pass
    return {
        "id": row["id"],
        "title": row["title"],
        "source_file": row["source_file"],
        "source_storage_path": f"documents/{row['id']}/source.pdf",
        "source_url": row.get("source_url") or "",
        "federal_state": values(row.get("federal_state")),
        "subjects": values(row.get("subjects")),
        "subject_complexes": values(row.get("subject_complexes")),
        "school_types": values(row.get("school_types")),
        "grade_levels": integer_values(row.get("grade_levels")),
        "performance_level": values(row.get("performance_level")),
        "publication_year": year,
        "validity_start": row.get("validity_start") or "",
        "validity_end": row.get("validity_end") or "",
        "languages": values(row.get("languages")),
        "metadata_source": row.get("metadata_source") or "",
        "status": row.get("status") or "machine_cleaned",
        "created_by": reviewer_id,
        "updated_by": reviewer_id,
    }


def read_text(path_text: str, label: str) -> str:
    path = Path(path_text)
    if not path.exists():
        raise FileNotFoundError(f"{label} fehlt: {path}")
    return path.read_text(encoding="utf-8")


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def require_empty_pilot(admin: SupabaseAdmin) -> None:
    existing = admin.request("GET", "/rest/v1/documents?select=id&limit=1")
    if existing:
        raise RuntimeError(
            "Das Supabase-Projekt enthält bereits Dokumente. Der Import bricht ab, um Duplikate "
            "und abweichende Textversionen zu verhindern."
        )


def import_data(admin: SupabaseAdmin, reviewer_id: str) -> None:
    documents, occurrences, sections, actions = load_local()
    print(f"Lokaler Bestand: {len(documents)} Dokumente, {len(occurrences)} Fundstellen, {len(sections)} Abschnitte.")
    require_empty_pilot(admin)

    subject_rows = unique_rows([
        {"subject_label": row["subject_label"], "subject_complex": row["subject_complex"], "notes": row.get("notes", ""), "reviewed": True, "updated_by": reviewer_id}
        for row in read_csv(SUBJECT_LEXICON)
    ], "subject_label")
    admin.upsert("subject_lexicon", subject_rows, "subject_label")

    geo_rows = unique_rows([
        {
            "surface_form": row["surface_form"],
            "canonical_entity": row["canonical_entity"],
            "entity_type": row["entity_type"],
            "source": row.get("source") or "previous_corpus_ner",
            "reviewed": (row.get("status") or "").casefold() == "confirmed",
            "created_by": reviewer_id,
        }
        for row in read_csv(GEO_LEXICON)
        if row.get("surface_form") and row.get("canonical_entity") and row.get("entity_type")
    ], "surface_form", prefer_reviewed=True)
    for group in chunks(geo_rows):
        admin.upsert("geo_lexicon", group, "surface_form")

    version_ids: dict[str, str] = {}
    for document in documents:
        source = Path(document["source_path"])
        if not source.exists():
            raise FileNotFoundError(f"PDF fehlt: {source}")
        admin.upload_pdf(f"documents/{document['id']}/source.pdf", source)
        admin.upsert("documents", [document_payload(document, reviewer_id)], "id")

        parent_id: str | None = None
        created: dict[str, str] = {}
        for kind, field in (("ocr", "ocr_text_path"), ("clean", "clean_text_path")):
            row = admin.insert(
                "text_versions",
                [{"document_id": document["id"], "version_kind": kind, "content": read_text(document[field], kind), "parent_version_id": parent_id, "created_by": reviewer_id}],
                returning=True,
            )[0]
            parent_id = row["id"]
            created[kind] = row["id"]
        manual = Path(document["manual_text_path"])
        if manual.exists():
            row = admin.insert(
                "text_versions",
                [{"document_id": document["id"], "version_kind": "manual", "content": read_text(str(manual), "manual"), "parent_version_id": parent_id, "created_by": reviewer_id}],
                returning=True,
            )[0]
            parent_id = row["id"]
            created["manual"] = row["id"]
        version_ids[document["id"]] = parent_id or created["clean"]
        admin.request(
            "PATCH",
            f"/rest/v1/documents?id=eq.{quote(document['id'])}",
            {"current_text_version_id": version_ids[document["id"]], "updated_by": reviewer_id},
            {"Prefer": "return=minimal"},
        )

    section_rows = [
        {
            "document_id": row["document_id"], "text_version_id": version_ids[row["document_id"]],
            "char_start": row["char_start"], "char_end": row["char_end"],
            "section_title": row.get("section_title") or "", "subjects": values(row.get("subjects")),
            "subject_complexes": values(row.get("subject_complexes")), "school_types": values(row.get("school_types")),
            "grade_levels": integer_values(row.get("grade_levels")), "performance_level": values(row.get("performance_level")),
            "note": row.get("note") or "", "status": row.get("status") or "reviewed",
            "created_by": reviewer_id, "updated_by": reviewer_id,
        }
        for row in sections
    ]
    for group in chunks(section_rows):
        admin.insert("text_sections", group)

    occurrence_rows = [
        {
            "document_id": row["document_id"], "text_version_id": version_ids[row["document_id"]],
            "char_start": row["char_start"], "char_end": row["char_end"],
            "surface_form": row["surface_form"], "canonical_entity": row["canonical_entity"],
            "entity_type": row["entity_type"], "source": row["source"], "status": row["status"],
            "note": row.get("note") or "", "created_by": reviewer_id, "updated_by": reviewer_id,
        }
        for row in occurrences
    ]
    for group in chunks(occurrence_rows):
        admin.insert("entity_occurrences", group)

    # Local occurrence IDs differ from Supabase identity IDs. Preserve the
    # audit payload but intentionally omit the unportable occurrence reference.
    action_rows = [
        {
            "document_id": row["document_id"], "text_version_id": version_ids[row["document_id"]],
            "action_type": row["action_type"],
            "before_json": json.loads(row.get("before_json") or "{}"),
            "after_json": json.loads(row.get("after_json") or "{}"),
            "reviewer_id": reviewer_id,
        }
        for row in actions
    ]
    for group in chunks(action_rows):
        admin.insert("review_actions", group)

    remote = admin.request("GET", "/rest/v1/documents?select=id")
    print(f"Fertig: {len(remote)} Dokumente in Supabase. PDFs, Textversionen, Abschnitte und NER-Fundstellen wurden importiert.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="Supabase Project URL, ohne /rest/v1")
    parser.add_argument("--reviewer-id", required=True, help="UUID des bereits angemeldeten Review-Kontos")
    parser.add_argument("--dry-run", action="store_true", help="Nur lokalen Bestand prüfen; keine Netzwerkzugriffe")
    args = parser.parse_args()
    if not args.url.startswith("https://") or "/rest/" in args.url.rstrip("/"):
        parser.error("--url muss die reine Project URL sein, etwa https://abc.supabase.co")
    documents, occurrences, sections, actions = load_local()
    print(f"Importvorschau: {len(documents)} Dokumente, {len(occurrences)} Fundstellen, {len(sections)} Abschnitte, {len(actions)} Audit-Einträge.")
    if args.dry_run:
        print("Dry run erfolgreich. Es wurden keine Daten übertragen.")
        return
    service_key = getpass.getpass("Supabase Service-Role-Key (wird nicht gespeichert): ").strip()
    if not service_key:
        parser.error("Kein Service-Role-Key eingegeben.")
    import_data(SupabaseAdmin(args.url, service_key), args.reviewer_id)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"IMPORT FEHLGESCHLAGEN: {error}", file=sys.stderr)
        raise SystemExit(1)
