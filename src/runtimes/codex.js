import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { BaseRuntime } from './base.js';
import { ensureDir } from '../utils/fs.js';
import { upsertRyoBlock, removeRyoBlock, removeRyoSkillDirs } from './claude-code.js';

export class CodexRuntime extends BaseRuntime {
  get name() { return 'codex'; }

  get skillsDir() {
    return join(this.projectDir, 'skills');
  }

  get configFile() {
    return join(this.projectDir, 'AGENTS.md');
  }

  async installSkill(skillName, skillContent) {
    const dir = join(this.skillsDir, `ryo-${skillName}`);
    await ensureDir(dir);
    await writeFile(join(dir, 'SKILL.md'), skillContent, 'utf8');
  }

  async updateConfig(contextRef) {
    await upsertRyoBlock(this.configFile, contextRef);
  }

  async uninstall() {
    await removeRyoSkillDirs(this.skillsDir);
    await removeRyoBlock(this.configFile);
  }
}
