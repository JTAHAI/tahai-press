#!/usr/bin/env node
import path from 'node:path';
import { ROOT } from './lib/content.mjs';
import { importContent, rollbackImportTransaction, IMPORT_TYPES, CONFLICT_MODES } from './lib/importers.mjs';

function help() {
  console.log(`TAHAI Press importer

Usage:
  npm run import -- --input <file-or-folder> [options]

Supported inputs:
  WordPress WXR/XML, Markdown with optional frontmatter, JSON, CSV, and PDF folders.

Options:
  --type <auto|wordpress|markdown|json|csv|pdf>  Input format (default: auto)
  --input <path>                                File or folder to import
  --output <path>                               Article output (default: content/articles)
  --media-output <path>                         PDF output (default: public/uploads/documents)
  --report <path>                               JSON report path
  --transaction-dir <path>                      Private reversible-import transaction directory
  --quarantine-dir <path>                       Private rejected-record quarantine directory
  --rollback <transaction.json>                 Restore a completed import transaction
  --force-rollback                              Permit rollback after a target was modified
  --status <draft|published|archived|preserve>  Imported status (default: draft)
  --author <slug>                               Default author (default: editorial-team)
  --category <slug>                             Default category (default: community-reporting)
  --hub <slug>                                  Optional default hub
  --conflict <skip|suffix|overwrite>            Slug collision policy (default: skip)
  --mark-reviewed                                Required when importing directly as Published
  --dry-run                                     Plan without writing articles or PDFs
  --write-dry-run-report                        Save a report during dry run
  --help                                        Show this help

Safety defaults:
  Imports are drafts, noindexed, and have all publication-review gates turned off.
  Existing article slugs are skipped unless another conflict policy is explicit.
  Every non-dry-run import writes a private transaction manifest; rollback verifies bytes before changing anything.
`);
}

function argsFrom(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--dry-run' || token === '--write-dry-run-report' || token === '--mark-reviewed' || token === '--force-rollback' || token === '--help') options[token.slice(2).replaceAll('-', '_')] = true;
    else if (token.startsWith('--')) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${token} requires a value`);
      options[token.slice(2).replaceAll('-', '_')] = value;
      index += 1;
    } else throw new Error(`Unexpected argument: ${token}`);
  }
  return options;
}

try {
  const args = argsFrom(process.argv.slice(2));
  if (args.help) {
    help();
    process.exit(0);
  }
  if (args.rollback) {
    if (args.input) throw new Error('--rollback cannot be combined with --input');
    const result = rollbackImportTransaction(args.rollback, { force: Boolean(args.force_rollback) });
    console.log(JSON.stringify(result, null, 2));
    console.log('Rollback complete.');
    process.exit(0);
  }
  if (!args.input) throw new Error('--input is required');
  const type = args.type || 'auto';
  if (!IMPORT_TYPES.has(type)) throw new Error(`--type must be one of: ${[...IMPORT_TYPES].join(', ')}`);
  const conflictMode = args.conflict || 'skip';
  if (!CONFLICT_MODES.has(conflictMode)) throw new Error(`--conflict must be one of: ${[...CONFLICT_MODES].join(', ')}`);
  const status = args.status || 'draft';
  if (!['draft', 'published', 'archived', 'preserve'].includes(status)) throw new Error('--status must be draft, published, archived, or preserve');
  if (status === 'published' && !args.mark_reviewed) throw new Error('--status published requires --mark-reviewed');
  const reportFile = args.report || path.join(ROOT, 'imports/reports/import-report.json');
  const report = importContent({
    input: args.input,
    type,
    outputDirectory: args.output,
    mediaDirectory: args.media_output,
    reportFile,
    transactionDirectory: args.transaction_dir,
    quarantineDirectory: args.quarantine_dir,
    dryRun: Boolean(args.dry_run),
    writeDryRunReport: Boolean(args.write_dry_run_report),
    conflictMode,
    defaults: {
      status,
      author: args.author || 'editorial-team',
      category: args.category || 'community-reporting',
      hub: args.hub || '',
      markReviewed: Boolean(args.mark_reviewed)
    }
  });
  console.log(JSON.stringify(report.summary, null, 2));
  const reportLabel = args.dry_run && !args.write_dry_run_report ? 'No report file written during dry run.' : `Report: ${path.relative(ROOT, path.resolve(reportFile)).replaceAll('\\', '/')}`;
  console.log(`${args.dry_run ? 'Dry run complete' : 'Import complete'}. ${reportLabel}`);
  if (report.summary.failed) process.exitCode = 1;
} catch (error) {
  console.error(`Import failed: ${error.message}`);
  console.error('Run npm run import:help for usage.');
  process.exitCode = 1;
}
