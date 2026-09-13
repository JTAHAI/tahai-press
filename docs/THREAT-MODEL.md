# Threat model

Primary risks are accidental publication of drafts or private notes, unsafe content and theme packages, dependency compromise, misconfigured optional services, and account-level deployment mistakes. Controls include strict content validation, draft-first defaults, deterministic package validation, private artifact boundaries, static output verification, exact-origin CORS, bearer-gated optional private operations, and reproducible release evidence.

Residual risks include compromised source-control accounts, a malicious site administrator, Cloudflare account compromise, and the operator choosing to connect an external provider. Those require owner-level controls, backups, access review, and deployment approval; they are not silently delegated to the static site.
