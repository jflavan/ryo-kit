import { symlink, lstat, readlink, unlink, readdir } from 'node:fs/promises';
import { relative, dirname, resolve } from 'node:path';
import { ensureParentDir, exists } from './fs.js';

export async function createSymlink(target, linkPath) {
  await ensureParentDir(linkPath);
  try {
    const stats = await lstat(linkPath);
    if (stats.isSymbolicLink()) await unlink(linkPath);
  } catch { /* does not exist */ }

  const relTarget = relative(dirname(linkPath), target);
  const targetStat = await lstat(target);
  const isDir = targetStat.isDirectory();

  try {
    if (process.platform === 'win32' && isDir) {
      await symlink(resolve(target), linkPath, 'junction');
    } else {
      await symlink(relTarget, linkPath, isDir ? 'dir' : 'file');
    }
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'ENOTSUP') {
      const { cpSync } = await import('node:fs');
      cpSync(target, linkPath, { recursive: isDir });
    } else {
      throw err;
    }
  }
}

export async function isRyoKitSymlink(linkPath) {
  try {
    const stats = await lstat(linkPath);
    if (!stats.isSymbolicLink()) return false;
    const target = await readlink(linkPath);
    const resolvedTarget = resolve(dirname(linkPath), target);
    return resolvedTarget.includes('.agents/skills/') ||
           resolvedTarget.includes('.agents\\skills\\') ||
           resolvedTarget.includes('.ryo/agents/') ||
           resolvedTarget.includes('.ryo\\agents\\');
  } catch {
    return false;
  }
}

export async function removeRyoKitSymlinks(dirPath) {
  if (!await exists(dirPath)) return;
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = resolve(dirPath, entry.name);
    if (await isRyoKitSymlink(fullPath)) {
      await unlink(fullPath);
    }
  }
}
