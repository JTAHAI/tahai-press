# Public evidence records and packets

`content/records/` stores small, reviewable metadata ledgers for material that a publisher has cleared for public release. A record may link to a published article and public source URLs, but it must never contain credentials, private editor notes, financial-account details, or copied private source material.

Published records require both `public_release_confirmed` and `rights_confirmed`. Redacted records state a public scope and reason for every declared redaction. The static build exposes published records at `/records/` and connects a linked article to its Receipts Mode page. The validator rejects unknown fields and common secret/private field names so a record cannot become an accidental scratchpad.

Validate the ledger with `npm run evidence:validate`. Create a deterministic packet with `npm run evidence:packet -- build sample-meeting-record`. The ZIP contains only `manifest.json`, a human-readable `README.md`, and checksums for those packet files; it deliberately does not mirror, fetch, OCR, or repackage source documents.

Evidence packets are a citation and transfer artifact, not a truth score or a chain-of-custody claim. The linked public source remains authoritative, and the publisher remains responsible for rights, redaction, and retention decisions.
