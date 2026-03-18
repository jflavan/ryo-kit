import { join } from 'node:path';
import { BaseRuntime } from './base.js';
import { upsertRyoBlock, removeRyoBlock } from './claude-code.js';
import { createSymlink, removeRyoKitSymlinks } from '../utils/symlink.js';

export class CopilotRuntime extends BaseRuntime {
  get name() { return 'copilot'; }

  get skillsDir() { return null; }

  get agentsDir() {
    return join(this.projectDir, '.github', 'agents');
  }

  get configFile() {
    return join(this.projectDir, '.github', 'copilot-instructions.md');
  }

  async installSkill(_skillName, _canonicalSkillDir) {
    // No-op — VS Code auto-discovers skills from .agents/skills/
  }

  async installAgent(agentName, agentMeta) {
    const source = join(this.projectDir, '.ryo', 'agents', `${agentName}.agent.md`);
    const linkPath = join(this.agentsDir, `${agentName}.agent.md`);
    await createSymlink(source, linkPath);
  }

  async updateConfig(contextRef) {
    await upsertRyoBlock(this.configFile, contextRef);
  }

  async uninstall() {
    // Clean up legacy .github/skills/ symlinks from previous versions
    const legacySkillsDir = join(this.projectDir, '.github', 'skills');
    await removeRyoKitSymlinks(legacySkillsDir);
    await removeRyoKitSymlinks(this.agentsDir);
    await removeRyoBlock(this.configFile);
  }
}
