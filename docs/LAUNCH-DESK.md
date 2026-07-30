# Launch Desk

Launch Desk is the TAHAI Press first-day newsroom experience. It converts the technical sequence of editing configuration, removing example content, preparing an author record, and creating a first article into seven short browser screens.

## User experience contract

Launch Desk must preserve these rules:

- **One primary action per screen.**
- **No screen presents more decisions than necessary.**
- **Recommended settings are always available.**
- **Progress persists on the current device.**
- **Every material change is previewed before application.**
- **The most recent change can be undone.**
- **A backup is offered before destructive work.**
- **The first article begins as Draft.**
- **Meaningful images cannot proceed without a description.**
- **No publication data is transmitted to TAHAI Press.**

The target is a customized, publishable first deployment in ten minutes or less.

## Browser storage

Launch Desk uses two local-storage keys:

```text
tahai-press-launch-desk-v1
tahai-press-launch-progress-v1
```

The first stores the working configuration, first-story draft, connection confirmations, current step, and a bounded undo history. The second stores only the completion count used by the persistent `Start here` link.

Resetting Launch Desk removes both records.

## Direct local application

When `window.showDirectoryPicker` is available, Launch Desk offers **Apply to a local repository**.

The publisher selects the repository root. Launch Desk then:

1. opens `content/`, `content/articles/`, and `content/authors/`;
2. creates `.launch-backups/<timestamp>/`;
3. copies the current `site.json`, generic author, and sample article files into that backup;
4. removes the four sample article files;
5. writes the final `content/site.json`;
6. creates the first article as Draft;
7. writes the publisher-named `editorial-team.json` record.

The File System Access API is progressive enhancement. It is not required for Launch Desk.

## Downloaded application

All supported browsers can download `tahai-press-launch-package.json` and apply it through:

```bash
npm run launch:apply -- --package tahai-press-launch-package.json --confirm
```

The command performs the same backup and replacement sequence under `.artifacts/`, which is ignored by Git.

## Demonstration boundaries

Launch Desk is generated only while `template_mode` is enabled. Publisher builds remove:

- `/setup/`;
- `assets/setup-wizard.js`;
- `assets/launch-progress.js`;
- visible `Start here` progress controls;
- demo-only homepage modules;
- visible TAHAI Press project attribution.

Non-visible technical provenance remains as documented in `docs/PROVENANCE.md`. Apache 2.0 source-distribution requirements remain in the repository. No visible platform banner, footer credit, backlink, logo, or “Powered by” notice is required on the publisher's website.

## Accessibility

Launch Desk uses native forms, buttons, progress, details/disclosure controls, semantic headings, and status regions. It provides:

- keyboard-accessible step navigation and module ordering;
- visible focus styles;
- text progress in addition to the progress element;
- no color-only completion state;
- descriptive help beside unfamiliar concepts;
- high-contrast and reduced-motion compatibility;
- narrow-screen horizontal step navigation without document overflow;
- explicit image-description requirements;
- preview text that remains ordinary HTML.

Automated coverage lives in `tests/launch-desk.test.mjs`, `tests/accessibility.test.mjs`, and the generated-page accessibility audit.
