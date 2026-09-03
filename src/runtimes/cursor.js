import { join } from 'node:path';
import { BaseRuntime, RYO_HOOK_MARKER } from './base.js';
import { upsertRyoBlock, removeRyoBlock } from './claude-code.js';
import { upsertAgentBlock, removeAgentBlock } from '../utils/agent-block.js';
import { readJsonConfig, writeJsonConfig } from '../utils/json-config.js';
import { exists } from '../utils/fs.js';

export class CursorRuntime extends BaseRuntime {
  get name() { return 'cursor'; }

  get skillsDir() { return null; }

  get agentsDir() { return null; }

  get agentConfigFile() {
    return join(this.projectDir, 'AGENTS.md');
  }

  get configFile() {
    return join(this.projectDir, '.cursorrules');
  }

  async installSkill(_skillName, _canonicalSkillDir) {
    // No-op — Cursor auto-discovers from .agents/skills/
  }

  async installAgent(agentName, agentMeta) {
    await upsertAgentBlock(this.agentConfigFile, agentMeta);
  }

  async updateConfig(contextRef) {
    await upsertRyoBlock(this.configFile, contextRef);
  }

  get hooksFile() {
    return join(this.projectDir, '.cursor', 'hooks.json');
  }

  /** Upsert a sessionStart hook into .cursor/hooks.json, preserving other hooks. */
  async installHooks(hookScriptRelPath) {
    const config = await readJsonConfig(this.hooksFile);
    config.version ??= 1;
    config.hooks ??= {};
    const entries = (config.hooks.sessionStart ??= []).filter(e => !isRyoHook(e));
    entries.push({ command: `node "${hookScriptRelPath.replace(/\\/g, '/')}" --format cursor` });
    config.hooks.sessionStart = entries;
    await writeJsonConfig(this.hooksFile, config);
  }

  async uninstallHooks() {
    if (!await exists(this.hooksFile)) return;
    const config = await readJsonConfig(this.hooksFile);
    if (!config.hooks?.sessionStart) return;
    config.hooks.sessionStart = config.hooks.sessionStart.filter(e => !isRyoHook(e));
    if (config.hooks.sessionStart.length === 0) delete config.hooks.sessionStart;
    await writeJsonConfig(this.hooksFile, config);
  }

  async uninstall() {
    await removeAgentBlock(this.agentConfigFile);
    await removeRyoBlock(this.configFile);
    await this.uninstallHooks();
  }
}

function isRyoHook(entry) {
  return typeof entry?.command === 'string' && entry.command.includes(RYO_HOOK_MARKER);
}
