import { mkdir, readFile, access, readdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function readIfExists(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureParentDir(filePath) {
  await ensureDir(dirname(filePath));
}
