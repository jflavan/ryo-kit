import { join } from 'node:path';
import { BaseRuntime } from './base.js';
import { upsertRyoBlock, removeRyoBlock } from './claude-code.js';
import { upsertAgentBlock, removeAgentBlock } from '../utils/agent-block.js';

export class GeminiCliRuntime extends BaseRuntime {
  get name() { return 'gemini-cli'; }

  get skillsDir() { return null; }

  get agentsDir() { return null; }

  get agentConfigFile() {
    return join(this.projectDir, 'GEMINI.md');
  }

  get configFile() {
    return join(this.projectDir, 'GEMINI.md');
  }

  async installSkill(_skillName, _canonicalSkillDir) {
    // No-op — Gemini CLI auto-discovers from .agents/skills/
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
