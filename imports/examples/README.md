# Import examples

These neutral files document the supported article shapes. Copy source exports into `imports/inbox/` for local work; that folder is ignored by Git so private or third-party migration material is not accidentally committed.

Always begin with a dry run:

```bash
npm run import -- --input imports/inbox --dry-run --write-dry-run-report
```

Then inspect `imports/reports/import-report.json`. A normal import creates **draft**, **noindex** records with publication review gates turned off.
