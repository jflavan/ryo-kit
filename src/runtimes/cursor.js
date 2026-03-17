import { join } from 'node:path';
import { BaseRuntime } from './base.js';
import { upsertRyoBlock, removeRyoBlock } from './claude-code.js';
import { upsertAgentBlock, removeAgentBlock } from '../utils/agent-block.js';

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

  async uninstall() {
    await removeAgentBlock(this.agentConfigFile);
    await removeRyoBlock(this.configFile);
  }
}
