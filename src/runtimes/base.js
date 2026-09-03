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
   * Register the ryo-kit hooks with this runtime.
   * Runtimes without a hook mechanism leave this as a no-op.
   *
   * @param {{ sessionStart: string, guard: string }} hookPaths - Project-relative hook script paths
   */
  async installHooks(_hookPaths) { /* no-op by default */ }
  async uninstallHooks() { /* no-op by default */ }
}

/** Marker every ryo-kit hook command contains, used for idempotent upsert/removal. */
export const RYO_HOOK_MARKER = '.ryo/hooks/';

/** True when a hook entry (command string plus optional args array) was written by ryo-kit. */
export function isRyoHookCommand(entry) {
  const parts = [entry?.command, ...(Array.isArray(entry?.args) ? entry.args : [])];
  return parts.some(p => typeof p === 'string' && p.includes(RYO_HOOK_MARKER));
}

/** Shell-form hook command using the project-dir placeholder the runtime exports. */
export function hookCommand(relPath, format, placeholder) {
  return `node "${placeholder}/${relPath.replace(/\\/g, '/')}" --format ${format}`;
}

export const RYO_BLOCK_START = '<!-- ryo-kit:start -->';
export const RYO_BLOCK_END = '<!-- ryo-kit:end -->';
