import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './content.mjs';

const DEFAULT_LOCK_PATH = path.join(ROOT, '.artifacts', 'build.lock');

function readHolder(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(lockPath, 'holder.json'), 'utf8'));
  } catch {
    return null;
  }
}

function isRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function acquire(lockPath) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    fs.mkdirSync(lockPath);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const holder = readHolder(lockPath);
    if (isRunning(holder?.pid)) {
      throw new Error(`A TAHAI Press build is already running (pid ${holder.pid}). Wait for it to finish before starting another build.`);
    }
    fs.rmSync(lockPath, { recursive: true, force: true });
    fs.mkdirSync(lockPath);
  }
  fs.writeFileSync(path.join(lockPath, 'holder.json'), `${JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }, null, 2)}\n`, 'utf8');
}

export async function withBuildLock(work, { lockPath = DEFAULT_LOCK_PATH } = {}) {
  acquire(lockPath);
  try {
    return await work();
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
  }
}
