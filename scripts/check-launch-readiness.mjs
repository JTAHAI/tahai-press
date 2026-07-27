import { loadContent } from './lib/content.mjs';
import { launchReadiness } from './lib/launch-readiness.mjs';

const result = launchReadiness(loadContent());
for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
if (!result.ok) {
  for (const error of result.errors) console.error(`ERROR: ${error}`);
  console.error(`\nLaunch readiness failed with ${result.errors.length} blocking issue(s). The template remains safe to deploy for testing because template_mode keeps it out of search indexes.`);
  process.exit(1);
}
console.log('Launch readiness passed: placeholder identity and sample-content blockers are cleared.');
