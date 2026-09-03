import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { BaseRuntime, RYO_BLOCK_START, RYO_BLOCK_END, RYO_HOOK_MARKER } from './base.js';
import { ensureDir, ensureParentDir, readIfExists, exists } from '../utils/fs.js';
import { createSymlink, removeRyoKitSymlinks } from '../utils/symlink.js';
import { readJsonConfig, writeJsonConfig } from '../utils/json-config.js';

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

  get settingsFile() {
    return join(this.projectDir, '.claude', 'settings.json');
  }

  /**
   * Upsert a SessionStart hook into .claude/settings.json. Existing hooks and
   * settings are preserved; the ryo-kit entry is identified by RYO_HOOK_MARKER
   * so repeated syncs never duplicate it.
   */
  async installHooks(hookScriptRelPath) {
    const settings = await readJsonConfig(this.settingsFile);
    settings.hooks ??= {};
    const entries = (settings.hooks.SessionStart ??= []).filter(e => !hookEntryIsRyo(e));
    entries.push({
      matcher: 'startup|clear|compact',
      hooks: [{
        type: 'command',
        command: `node "${hookScriptRelPath.replace(/\\/g, '/')}" --format claude`,
      }],
    });
    settings.hooks.SessionStart = entries;
    await writeJsonConfig(this.settingsFile, settings);
  }

  async uninstallHooks() {
    if (!await exists(this.settingsFile)) return;
    const settings = await readJsonConfig(this.settingsFile);
    if (!settings.hooks?.SessionStart) return;
    settings.hooks.SessionStart = settings.hooks.SessionStart.filter(e => !hookEntryIsRyo(e));
    if (settings.hooks.SessionStart.length === 0) delete settings.hooks.SessionStart;
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
    await writeJsonConfig(this.settingsFile, settings);
  }

  async uninstall() {
    await removeRyoKitSymlinks(this.skillsDir);
    await removeRyoKitSymlinks(this.agentsDir);
    await removeRyoBlock(this.configFile);
    await this.uninstallHooks();
  }
}

function hookEntryIsRyo(entry) {
  return (entry?.hooks ?? []).some(h => typeof h?.command === 'string' && h.command.includes(RYO_HOOK_MARKER));
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
