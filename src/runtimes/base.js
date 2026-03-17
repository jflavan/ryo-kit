export class BaseRuntime {
  constructor(projectDir) {
    this.projectDir = projectDir;
  }

  get name() { throw new Error('Not implemented'); }
  get skillsDir() { throw new Error('Not implemented'); }
  get agentsDir() { return null; }
  get configFile() { throw new Error('Not implemented'); }

  async installSkill(skillName, canonicalSkillDir) { throw new Error('Not implemented'); }
  async installAgent(agentName, agentMeta) { throw new Error('Not implemented'); }
  async updateConfig(contextRef) { throw new Error('Not implemented'); }
  async uninstall() { throw new Error('Not implemented'); }
}

export const RYO_BLOCK_START = '<!-- ryo-kit:start -->';
export const RYO_BLOCK_END = '<!-- ryo-kit:end -->';
