import { join } from 'node:path';
import { BaseRuntime, isRyoHookCommand, hookCommand } from './base.js';
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

  /**
   * Upsert the ryo-kit hooks into .cursor/hooks.json:
   *  - sessionStart → session-start.js
   *  - beforeShellExecution → guard.js (protected branches; Cursor has no
   *    pre-edit hook, so forbidden_paths are enforced for shell writes only)
   * Cursor runs hook commands from the workspace root, so paths are relative.
   */
  async installHooks(hookPaths) {
    const config = await readJsonConfig(this.hooksFile);
    config.version ??= 1;
    config.hooks ??= {};
    const upsert = (event, relPath) => {
      const entries = (config.hooks[event] ??= []).filter(e => !isRyoHookCommand(e));
      entries.push({ command: hookCommand(relPath, 'cursor', '.') });
      config.hooks[event] = entries;
    };
    upsert('sessionStart', hookPaths.sessionStart);
    upsert('beforeShellExecution', hookPaths.guard);
    await writeJsonConfig(this.hooksFile, config);
  }

  async uninstallHooks() {
    if (!await exists(this.hooksFile)) return;
    const config = await readJsonConfig(this.hooksFile);
    if (!config.hooks) return;
    for (const event of ['sessionStart', 'beforeShellExecution']) {
      if (!config.hooks[event]) continue;
      config.hooks[event] = config.hooks[event].filter(e => !isRyoHookCommand(e));
      if (config.hooks[event].length === 0) delete config.hooks[event];
    }
    await writeJsonConfig(this.hooksFile, config);
  }

  async uninstall() {
    await removeAgentBlock(this.agentConfigFile);
    await removeRyoBlock(this.configFile);
    await this.uninstallHooks();
  }
}

