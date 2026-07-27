import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadContent } from './lib/content.mjs';
import { bulkRedirectCsv, createRedirectPlan, readRedirectConfig } from './lib/redirects.mjs';

const { site, articles } = loadContent();
const plan = createRedirectPlan({ site, articles, config: readRedirectConfig(), checkTargets: false, enforcePagesLimit: false });
if (plan.errors.length) {
  console.error(`Bulk redirect export failed with ${plan.errors.length} issue(s):`);
  for (const error of plan.errors) console.error(`- ${error}`);
  process.exit(1);
}
const output = path.join(ROOT, 'deployment', 'bulk-redirects.csv');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, bulkRedirectCsv(plan, site.site_url), 'utf8');
console.log(`Exported ${plan.rules.length} redirect(s) to ${path.relative(ROOT, output)}.`);
