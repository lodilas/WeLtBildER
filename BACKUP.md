# Pilot-Backup

Der Ordner `backups/` ist absichtlich nicht versioniert. Ein Export enthält den
vollständigen Datenbankstand des Supabase-Piloten, die zehn privaten PDF-Dateien
und eine SHA-256-Prüfsummenliste.

```powershell
cd C:\Users\wf371\Documents\Codex\LehrplanReview_Supabase_App
& "C:\Users\wf371\Documents\Codex\Lehrplantest\.ocr-venv\Scripts\python.exe" .\scripts\export_supabase_pilot_backup.py `
  --url "https://DEINE-PROJEKT-ID.supabase.co" `
  --output ".\backups\2026-09-03_cloud-pilot"
```

Den Service-Role-Key ausschließlich in den verdeckten Terminal-Prompt eingeben.
Er wird weder in `manifest.json` noch in anderen Exportdateien gespeichert.
