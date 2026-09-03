export class BaseRuntime {
  constructor(projectDir) {
    this.projectDir = projectDir;
  }

  get name() { throw new Error('Not implemented'); }
  get skillsDir() { throw new Error('Not implemented'); }
  get agentsDir() { return null; }
  get agentConfigFile() { return null; }
  get configFile() { throw new Error('Not implemented'); }

  async installSkill(skillName, canonicalSkillDir) { throw new Error('Not implemented'); }
  async installAgent(agentName, agentMeta) { throw new Error('Not implemented'); }
  async updateConfig(contextRef) { throw new Error('Not implemented'); }
  async uninstall() { throw new Error('Not implemented'); }

  /**
   * Register the ryo-kit SessionStart hook with this runtime.
   * Runtimes without a hook mechanism leave this as a no-op.
   *
   * @param {string} hookScriptRelPath - Project-relative path to the hook script
   */
  async installHooks(_hookScriptRelPath) { /* no-op by default */ }
  async uninstallHooks() { /* no-op by default */ }
}

/** Marker every ryo-kit hook command contains, used for idempotent upsert/removal. */
export const RYO_HOOK_MARKER = '.ryo/hooks/session-start.js';

export const RYO_BLOCK_START = '<!-- ryo-kit:start -->';
export const RYO_BLOCK_END = '<!-- ryo-kit:end -->';
