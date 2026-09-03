import { writeFile } from 'node:fs/promises';
import { ensureParentDir, readIfExists } from './fs.js';

/**
 * Read a JSON config file, returning {} when missing or empty.
 * Throws when the file exists but is not valid JSON — we never clobber a
 * file we cannot understand.
 */
export async function readJsonConfig(path) {
  const raw = await readIfExists(path);
  if (raw === null || raw.trim() === '') return {};
  return JSON.parse(raw);
}

export async function writeJsonConfig(path, data) {
  await ensureParentDir(path);
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
