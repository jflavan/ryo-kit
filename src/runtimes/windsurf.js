import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { BaseRuntime } from './base.js';
import { ensureParentDir, readIfExists, exists } from '../utils/fs.js';

// Per-skill sentinels for Windsurf (no separate skills directory)
function skillBlockStart(name) { return `<!-- ryo-kit:${name}:start -->`; }
function skillBlockEnd(name) { return `<!-- ryo-kit:${name}:end -->`; }

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class WindsurfRuntime extends BaseRuntime {
  get name() { return 'windsurf'; }

  // Windsurf has no separate skills directory — skills go inline in .windsurfrules
  get skillsDir() { return null; }

  get configFile() {
    return join(this.projectDir, '.windsurfrules');
  }

  async installSkill(skillName, skillContent) {
    await ensureParentDir(this.configFile);
    const existing = await readIfExists(this.configFile) ?? '';
    const start = skillBlockStart(skillName);
    const end = skillBlockEnd(skillName);
    const block = `${start}\n${skillContent}\n${end}`;

    if (existing.includes(start)) {
      // Replace existing block
      const replaced = existing.replace(
        new RegExp(`${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`),
        block,
      );
      await writeFile(this.configFile, replaced, 'utf8');
    } else {
      const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n\n' : existing.length > 0 ? '\n' : '';
      await writeFile(this.configFile, existing + separator + block + '\n', 'utf8');
    }
  }

  // updateConfig is a no-op for Windsurf — skills are embedded directly
  async updateConfig(_contextRef) { /* no-op */ }

  async uninstall() {
    if (!await exists(this.configFile)) return;
    const content = await readIfExists(this.configFile) ?? '';
    // Remove all ryo-kit:<name>:start/end blocks
    const cleaned = content
      .replace(
        /\n?<!-- ryo-kit:[^:]+:start -->[\s\S]*?<!-- ryo-kit:[^:]+:end -->\n?/g,
        '',
      )
      .trimEnd();
    await writeFile(this.configFile, cleaned.length > 0 ? cleaned + '\n' : '', 'utf8');
  }
}
