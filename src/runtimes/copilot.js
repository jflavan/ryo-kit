import { join } from 'node:path';
import { BaseRuntime } from './base.js';
import { upsertRyoBlock, removeRyoBlock } from './claude-code.js';
import { createSymlink, removeRyoKitSymlinks } from '../utils/symlink.js';

export class CopilotRuntime extends BaseRuntime {
  get name() { return 'copilot'; }

  get skillsDir() {
    return join(this.projectDir, '.github', 'skills');
  }

  get agentsDir() {
    return join(this.projectDir, '.github', 'agents');
  }

  get configFile() {
    return join(this.projectDir, '.github', 'copilot-instructions.md');
  }

  async installSkill(skillName, canonicalSkillDir) {
    const linkPath = join(this.skillsDir, skillName);
    await createSymlink(canonicalSkillDir, linkPath);
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
    await removeRyoKitSymlinks(this.skillsDir);
    await removeRyoKitSymlinks(this.agentsDir);
    await removeRyoBlock(this.configFile);
  }
}
