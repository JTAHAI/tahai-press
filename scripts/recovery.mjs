#!/usr/bin/env node
import { createSafetyCopy, planSafetyCopyRestore, recoveryHistory, restoreSafetyCopy, undoSafetyCopyRestore, verifySafetyCopy } from './lib/recovery.mjs';

const [command, ...args] = process.argv.slice(2);
const confirmed = args.includes('--confirm');
const transactionIndex = args.indexOf('--transaction');
const transactionId = transactionIndex >= 0 ? args[transactionIndex + 1] : undefined;
try {
  let result;
  if (command === 'create') result = createSafetyCopy();
  else if (command === 'verify') result = verifySafetyCopy();
  else if (command === 'plan') result = planSafetyCopyRestore();
  else if (command === 'restore') result = restoreSafetyCopy({ confirm: confirmed });
  else if (command === 'undo') result = undoSafetyCopyRestore({ transactionId, confirm: confirmed });
  else if (command === 'history') result = recoveryHistory();
  else throw new Error('Usage: node scripts/recovery.mjs <create|verify|plan|restore|undo|history> [--confirm] [--transaction <id>]');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`Recovery failed: ${error.message}`);
  process.exitCode = 1;
}
