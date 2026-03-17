import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { BaseRuntime, RYO_BLOCK_START, RYO_BLOCK_END } from './base.js';
import { ensureDir, ensureParentDir, readIfExists, exists } from '../utils/fs.js';
import { createSymlink, removeRyoKitSymlinks } from '../utils/symlink.js';

export class ClaudeCodeRuntime extends BaseRuntime {
  get name() { return 'claude-code'; }

  get skillsDir() {
    return join(this.projectDir, '.claude', 'skills');
  }

  get agentsDir() {
    return join(this.projectDir, '.claude', 'agents');
  }

  get configFile() {
    return join(this.projectDir, 'CLAUDE.md');
  }

  async installSkill(skillName, canonicalSkillDir) {
    const linkPath = join(this.skillsDir, skillName);
    await createSymlink(canonicalSkillDir, linkPath);
  }

  async installAgent(agentName, agentMeta) {
    const source = join(this.projectDir, '.ryo', 'agents', `${agentName}.agent.md`);
    const linkPath = join(this.agentsDir, `${agentName}.md`);
    await createSymlink(source, linkPath);
  }

  async updateConfig(contextRef) {
    await upsertRyoBlock(this.configFile, contextRef);
  }

  async uninstall() {
    await removeRyoKitSymlinks(this.skillsDir);
    await removeRyoKitSymlinks(this.agentsDir);
    await removeRyoBlock(this.configFile);
  }
}

// ---- Shared helpers ----

export async function upsertRyoBlock(configFile, contextRef) {
  await ensureParentDir(configFile);
  const existing = await readIfExists(configFile) ?? '';
  const block = `${RYO_BLOCK_START}\n${contextRef}\n${RYO_BLOCK_END}`;

  if (existing.includes(RYO_BLOCK_START)) {
    const replaced = existing.replace(
      new RegExp(`${escapeRegex(RYO_BLOCK_START)}[\\s\\S]*?${escapeRegex(RYO_BLOCK_END)}`),
      block,
    );
    await writeFile(configFile, replaced, 'utf8');
  } else {
    const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n\n' : existing.length > 0 ? '\n' : '';
    await writeFile(configFile, existing + separator + block + '\n', 'utf8');
  }
}

export async function removeRyoBlock(configFile) {
  if (!await exists(configFile)) return;
  const content = await readFile(configFile, 'utf8');
  if (!content.includes(RYO_BLOCK_START)) return;
  const cleaned = content
    .replace(
      new RegExp(`\\n?${escapeRegex(RYO_BLOCK_START)}[\\s\\S]*?${escapeRegex(RYO_BLOCK_END)}\\n?`),
      '',
    )
    .trimEnd();
  await writeFile(configFile, cleaned.length > 0 ? cleaned + '\n' : '', 'utf8');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
