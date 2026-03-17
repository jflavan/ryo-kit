import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';

import {
  AGENT_BLOCK_START,
  AGENT_BLOCK_END,
  formatAgentBlock,
  upsertAgentBlock,
  removeAgentBlock,
} from '../src/utils/agent-block.js';

async function makeTempDir() {
  return await mkdtemp(join(tmpdir(), 'ryo-kit-agent-block-test-'));
}

describe('AGENT_BLOCK sentinels', () => {
  test('AGENT_BLOCK_START is correct', () => {
    assert.equal(AGENT_BLOCK_START, '<!-- ryo-kit:agents:start -->');
  });

  test('AGENT_BLOCK_END is correct', () => {
    assert.equal(AGENT_BLOCK_END, '<!-- ryo-kit:agents:end -->');
  });
});

describe('formatAgentBlock', () => {
  test('formats agent with name and description', () => {
    const result = formatAgentBlock({ name: 'reviewer', description: 'Reviews code.' });
    assert.ok(result.includes('### reviewer'));
    assert.ok(result.includes('Reviews code.'));
  });

  test('formats agent with role', () => {
    const result = formatAgentBlock({ name: 'reviewer', role: 'Code Reviewer', description: 'Reviews code.' });
    assert.ok(result.includes('### reviewer — Code Reviewer'));
  });

  test('formats agent with responsibilities', () => {
    const result = formatAgentBlock({
      name: 'reviewer',
      description: 'Reviews code.',
      responsibilities: ['Check style', 'Check logic'],
    });
    assert.ok(result.includes('**Responsibilities:**'));
    assert.ok(result.includes('- Check style'));
    assert.ok(result.includes('- Check logic'));
  });

  test('formats agent with handoff_to', () => {
    const result = formatAgentBlock({
      name: 'reviewer',
      description: 'Reviews code.',
      handoff_to: ['deployer', 'tester'],
    });
    assert.ok(result.includes('**Hands off to:** deployer, tester'));
  });

  test('omits responsibilities section when empty', () => {
    const result = formatAgentBlock({ name: 'reviewer', description: 'Reviews code.' });
    assert.ok(!result.includes('**Responsibilities:**'));
  });

  test('omits handoff_to section when empty', () => {
    const result = formatAgentBlock({ name: 'reviewer', description: 'Reviews code.' });
    assert.ok(!result.includes('**Hands off to:**'));
  });
});

describe('upsertAgentBlock', () => {
  let dir;

  beforeEach(async () => {
    dir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('creates file with agent block when file does not exist', async () => {
    const configFile = join(dir, 'AGENTS.md');
    await upsertAgentBlock(configFile, { name: 'reviewer', description: 'Reviews code.' });

    const content = await readFile(configFile, 'utf8');
    assert.ok(content.includes(AGENT_BLOCK_START));
    assert.ok(content.includes(AGENT_BLOCK_END));
    assert.ok(content.includes('# ryo-kit Agents'));
    assert.ok(content.includes('### reviewer'));
  });

  test('appends agent block to existing file without clobbering', async () => {
    const configFile = join(dir, 'AGENTS.md');
    await writeFile(configFile, '# My Project Agents\n\nExisting content.\n', 'utf8');
    await upsertAgentBlock(configFile, { name: 'reviewer', description: 'Reviews code.' });

    const content = await readFile(configFile, 'utf8');
    assert.ok(content.includes('# My Project Agents'));
    assert.ok(content.includes('Existing content.'));
    assert.ok(content.includes(AGENT_BLOCK_START));
    assert.ok(content.includes('### reviewer'));
  });

  test('appends second agent to existing block', async () => {
    const configFile = join(dir, 'AGENTS.md');
    await upsertAgentBlock(configFile, { name: 'reviewer', description: 'Reviews code.' });
    await upsertAgentBlock(configFile, { name: 'deployer', description: 'Deploys code.' });

    const content = await readFile(configFile, 'utf8');
    assert.ok(content.includes('### reviewer'));
    assert.ok(content.includes('### deployer'));
    // Should only have one block pair
    assert.equal(content.split(AGENT_BLOCK_START).length - 1, 1);
    assert.equal(content.split(AGENT_BLOCK_END).length - 1, 1);
  });

  test('creates parent directories for config file', async () => {
    const configFile = join(dir, 'nested', 'deep', 'AGENTS.md');
    await upsertAgentBlock(configFile, { name: 'reviewer', description: 'Reviews code.' });

    const content = await readFile(configFile, 'utf8');
    assert.ok(content.includes('### reviewer'));
  });

  test('handles existing file without trailing newline', async () => {
    const configFile = join(dir, 'AGENTS.md');
    await writeFile(configFile, '# No trailing newline', 'utf8');
    await upsertAgentBlock(configFile, { name: 'reviewer', description: 'Reviews code.' });

    const content = await readFile(configFile, 'utf8');
    assert.ok(content.includes('# No trailing newline'));
    assert.ok(content.includes(AGENT_BLOCK_START));
  });
});

describe('removeAgentBlock', () => {
  let dir;

  beforeEach(async () => {
    dir = await makeTempDir();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('removes agent block from file', async () => {
    const configFile = join(dir, 'AGENTS.md');
    await writeFile(configFile, '# Keep\n', 'utf8');
    await upsertAgentBlock(configFile, { name: 'reviewer', description: 'Reviews code.' });
    await removeAgentBlock(configFile);

    const content = await readFile(configFile, 'utf8');
    assert.ok(!content.includes(AGENT_BLOCK_START));
    assert.ok(!content.includes(AGENT_BLOCK_END));
    assert.ok(!content.includes('### reviewer'));
    assert.ok(content.includes('Keep'));
  });

  test('preserves other content in file', async () => {
    const configFile = join(dir, 'AGENTS.md');
    const preamble = '# My Agents\n\nSome instructions here.\n';
    await writeFile(configFile, preamble, 'utf8');
    await upsertAgentBlock(configFile, { name: 'reviewer', description: 'Reviews code.' });
    await removeAgentBlock(configFile);

    const content = await readFile(configFile, 'utf8');
    assert.ok(content.includes('# My Agents'));
    assert.ok(content.includes('Some instructions here.'));
  });

  test('safe when file does not exist', async () => {
    // Should not throw
    await removeAgentBlock(join(dir, 'nonexistent.md'));
  });

  test('safe when file has no agent block', async () => {
    const configFile = join(dir, 'AGENTS.md');
    await writeFile(configFile, '# No block here\n', 'utf8');
    await removeAgentBlock(configFile);

    const content = await readFile(configFile, 'utf8');
    assert.equal(content, '# No block here\n');
  });

  test('writes empty string when file only contained the block', async () => {
    const configFile = join(dir, 'AGENTS.md');
    await upsertAgentBlock(configFile, { name: 'reviewer', description: 'Reviews code.' });
    await removeAgentBlock(configFile);

    const content = await readFile(configFile, 'utf8');
    assert.equal(content, '');
  });
});
