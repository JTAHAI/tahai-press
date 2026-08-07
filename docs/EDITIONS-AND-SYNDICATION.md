# Editions and syndication

TAHAI Press treats an edition as an arrangement of canonical reporting, not a second copy of the reporting. Edition source files live in `content/editions/`; each section names article slugs and public evidence record IDs. The build validates all references and emits printable, no-JavaScript-readable pages at `/editions/`.

Supported edition templates are `daily`, `community-weekly`, `investigative-special`, `records-packet`, `arts`, and `developing-bulletin`. All use ordinary print CSS. There is no external print renderer, account, or hosted service.

Newsletter source files live in `content/newsletters/`. A published newsletter emits a browser archive plus an email-safe HTML export and a matching plain-text export. The generator never sends email. The email export contains no script, form, image/tracking pixel, remote font, tracking parameter, or provider API call. Before sending, an operator replaces its provider-neutral unsubscribe placeholder using their email provider’s approved mechanism.

The static syndication outputs are:

- `/feed.xml` — RSS 2.0;
- `/atom.xml` — Atom;
- `/feed.json` — JSON Feed 1.1;
- `/api/v1/` — versioned JSON collections and a manifest.

API collections contain published public fields only. They include a schema version, generated version, canonical URL, generated timestamp, checksum, count, and basic relationship IDs. Drafts, review flags, editor notes, source-file paths, deployment state, and other operator data are excluded by construction.
