import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readlink, lstat, symlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';

import { createSymlink, isRyoKitSymlink, removeRyoKitSymlinks } from '../src/utils/symlink.js';

async function makeTempDir() {
  return await mkdtemp(join(tmpdir(), 'ryo-kit-symlink-test-'));
}

describe('createSymlink', () => {
  let dir;

  beforeEach(async () => {
    dir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('creates a file symlink with relative path', async () => {
    const target = join(dir, 'source.txt');
    const linkPath = join(dir, 'link.txt');
    await writeFile(target, 'hello', 'utf8');

    await createSymlink(target, linkPath);

    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
    const linkTarget = await readlink(linkPath);
    assert.equal(linkTarget, 'source.txt');
  });

  test('creates a directory symlink with relative path', async () => {
    const target = join(dir, 'source-dir');
    const linkPath = join(dir, 'link-dir');
    await mkdir(target);

    await createSymlink(target, linkPath);

    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
    const linkTarget = await readlink(linkPath);
    assert.equal(linkTarget, 'source-dir');
  });

  test('replaces existing symlink', async () => {
    const target1 = join(dir, 'a.txt');
    const target2 = join(dir, 'b.txt');
    const linkPath = join(dir, 'link.txt');
    await writeFile(target1, 'a', 'utf8');
    await writeFile(target2, 'b', 'utf8');

    await createSymlink(target1, linkPath);
    await createSymlink(target2, linkPath);

    const linkTarget = await readlink(linkPath);
    assert.equal(linkTarget, 'b.txt');
  });

  test('creates parent directories for link path', async () => {
    const target = join(dir, 'source.txt');
    const linkPath = join(dir, 'nested', 'deep', 'link.txt');
    await writeFile(target, 'hello', 'utf8');

    await createSymlink(target, linkPath);

    const stats = await lstat(linkPath);
    assert.ok(stats.isSymbolicLink());
  });

  test('uses relative path for nested structures', async () => {
    const target = join(dir, 'src', 'file.txt');
    const linkPath = join(dir, 'dest', 'link.txt');
    await mkdir(join(dir, 'src'));
    await writeFile(target, 'data', 'utf8');

    await createSymlink(target, linkPath);

    const linkTarget = await readlink(linkPath);
    assert.equal(linkTarget, join('..', 'src', 'file.txt'));
  });
});

describe('isRyoKitSymlink', () => {
  let dir;

  beforeEach(async () => {
    dir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('returns true for symlink pointing into .agents/skills/', async () => {
    const skillsDir = join(dir, '.agents', 'skills', 'my-skill');
    await mkdir(skillsDir, { recursive: true });
    const linkPath = join(dir, 'my-link');
    await symlink(join('.agents', 'skills', 'my-skill'), linkPath);

    assert.equal(await isRyoKitSymlink(linkPath), true);
  });

  test('returns true for symlink pointing into .ryo/agents/', async () => {
    const agentsDir = join(dir, '.ryo', 'agents', 'my-agent');
    await mkdir(agentsDir, { recursive: true });
    const linkPath = join(dir, 'my-link');
    await symlink(join('.ryo', 'agents', 'my-agent'), linkPath);

    assert.equal(await isRyoKitSymlink(linkPath), true);
  });

  test('returns false for regular file', async () => {
    const filePath = join(dir, 'regular.txt');
    await writeFile(filePath, 'hello', 'utf8');

    assert.equal(await isRyoKitSymlink(filePath), false);
  });

  test('returns false for non-ryo-kit symlink', async () => {
    const target = join(dir, 'other.txt');
    await writeFile(target, 'hello', 'utf8');
    const linkPath = join(dir, 'other-link');
    await symlink('other.txt', linkPath);

    assert.equal(await isRyoKitSymlink(linkPath), false);
  });

  test('returns false for nonexistent path', async () => {
    assert.equal(await isRyoKitSymlink(join(dir, 'nope')), false);
  });
});

describe('removeRyoKitSymlinks', () => {
  let dir;

  beforeEach(async () => {
    dir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('removes ryo-kit symlinks from a directory', async () => {
    const linksDir = join(dir, 'links');
    await mkdir(linksDir);

    // Create a ryo-kit symlink
    const skillsDir = join(dir, '.agents', 'skills', 'my-skill');
    await mkdir(skillsDir, { recursive: true });
    await symlink(join('..', '.agents', 'skills', 'my-skill'), join(linksDir, 'ryo-link'));

    // Create a non-ryo-kit symlink
    const regularTarget = join(dir, 'regular.txt');
    await writeFile(regularTarget, 'hi', 'utf8');
    await symlink(join('..', 'regular.txt'), join(linksDir, 'other-link'));

    await removeRyoKitSymlinks(linksDir);

    // ryo-kit symlink should be gone
    await assert.rejects(() => access(join(linksDir, 'ryo-link')));
    // other symlink preserved
    const stats = await lstat(join(linksDir, 'other-link'));
    assert.ok(stats.isSymbolicLink());
  });

  test('safe when directory does not exist', async () => {
    // Should not throw
    await removeRyoKitSymlinks(join(dir, 'nonexistent'));
  });

  test('preserves regular files', async () => {
    const linksDir = join(dir, 'links');
    await mkdir(linksDir);
    await writeFile(join(linksDir, 'keep.txt'), 'keep', 'utf8');

    await removeRyoKitSymlinks(linksDir);

    const content = await access(join(linksDir, 'keep.txt'));
    // access does not throw means file exists
  });
});
