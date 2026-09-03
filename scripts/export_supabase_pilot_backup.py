"""Create a local, non-secret backup of the Supabase cloud pilot.

The service-role key is requested only through a hidden terminal prompt. The
result contains database-table JSON files, source PDFs from the private bucket,
and a SHA-256 manifest. It must remain outside Git (``backups/`` is ignored).

Example:
  python scripts/export_supabase_pilot_backup.py \
    --url https://<project>.supabase.co \
    --output backups/2026-09-03_cloud-pilot
"""

from __future__ import annotations

import argparse
import getpass
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


TABLES: dict[str, str] = {
    "documents": "id.asc",
    "text_versions": "created_at.asc",
    "reviewer_profiles": "id.asc",
    "subject_lexicon": "subject_label.asc",
    "geo_lexicon": "surface_form.asc",
    "text_sections": "id.asc",
    "entity_occurrences": "id.asc",
    "review_actions": "id.asc",
}
BUCKET = "curriculum-assets"
PAGE_SIZE = 1000


class SupabaseBackup:
    def __init__(self, project_url: str, key: str) -> None:
        self.project_url = project_url.rstrip("/")
        self.headers = {"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"}

    def request(self, path: str, binary: bool = False) -> bytes:
        request = Request(self.project_url + path, headers=self.headers, method="GET")
        try:
            with urlopen(request, timeout=300) as response:
                return response.read()
        except HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase GET {path}: HTTP {error.code}: {details}") from error

    def table_rows(self, table: str, order: str) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for offset in range(0, 10_000_000, PAGE_SIZE):
            query = urlencode({"select": "*", "order": order, "limit": PAGE_SIZE, "offset": offset})
            page = json.loads(self.request(f"/rest/v1/{table}?{query}").decode("utf-8"))
            rows.extend(page)
            if len(page) < PAGE_SIZE:
                return rows
        raise RuntimeError(f"Abbruch: unerwartet viele Zeilen in {table}.")

    def download_object(self, storage_path: str) -> bytes:
        return self.request(f"/storage/v1/object/{BUCKET}/{quote(storage_path, safe='/')}", binary=True)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="Supabase Project URL, without /rest/v1")
    parser.add_argument("--output", required=True, type=Path, help="New or empty local backup folder")
    args = parser.parse_args()
    if not args.url.startswith("https://") or "/rest/" in args.url.rstrip("/"):
        parser.error("--url must be the project URL, e.g. https://abc.supabase.co")
    destination: Path = args.output.resolve()
    if destination.exists() and any(destination.iterdir()):
        parser.error(f"Backup target must be empty: {destination}")
    destination.mkdir(parents=True, exist_ok=True)
    key = getpass.getpass("Supabase Service-Role-Key (not stored): ").strip()
    if not key:
        parser.error("No Service-Role-Key entered.")

    client = SupabaseBackup(args.url, key)
    database_dir = destination / "database"
    storage_dir = destination / "storage"
    row_counts: dict[str, int] = {}
    documents: list[dict[str, Any]] = []
    for table, order in TABLES.items():
        rows = client.table_rows(table, order)
        write_json(database_dir / f"{table}.json", rows)
        row_counts[table] = len(rows)
        if table == "documents":
            documents = rows
        print(f"Exported {table}: {len(rows)} rows")

    pdf_count = 0
    for document in documents:
        storage_path = document.get("source_storage_path")
        if not storage_path:
            continue
        target = storage_dir / storage_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(client.download_object(storage_path))
        pdf_count += 1
        print(f"Downloaded {storage_path}")

    files = [path for path in destination.rglob("*") if path.is_file()]
    manifest = {
        "format": "lehrplan-review-supabase-pilot-backup-v1",
        "created_at": datetime.now(UTC).isoformat(),
        "project_url": args.url.rstrip("/"),
        "bucket": BUCKET,
        "row_counts": row_counts,
        "pdf_count": pdf_count,
        "files": [{"path": str(path.relative_to(destination)).replace("\\", "/"), "sha256": sha256(path), "bytes": path.stat().st_size} for path in files],
    }
    write_json(destination / "manifest.json", manifest)
    print(f"Backup complete: {destination}")


if __name__ == "__main__":
    main()
