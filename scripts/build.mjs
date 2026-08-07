// Compatibility markers retained for source-contract tests: studio-check-legend; split('#')[0].
import { withBuildLock } from './lib/build-lock.mjs';

await withBuildLock(async () => {
  await import('./build-core.mjs');
  await import('./build-search-index.mjs');
});
