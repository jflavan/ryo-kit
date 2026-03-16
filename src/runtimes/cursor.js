import { join } from 'node:path';
import { writeFile, unlink, readdir } from 'node:fs/promises';
import { BaseRuntime } from './base.js';
import { ensureDir, exists } from '../utils/fs.js';
import { upsertRyoBlock, removeRyoBlock } from './claude-code.js';

export class CursorRuntime extends BaseRuntime {
  get name() { return 'cursor'; }

  get skillsDir() {
    return join(this.projectDir, '.cursor', 'rules');
  }

  get configFile() {
    return join(this.projectDir, '.cursorrules');
  }

  async installSkill(skillName, skillContent) {
    await ensureDir(this.skillsDir);
    await writeFile(join(this.skillsDir, `ryo-${skillName}.md`), skillContent, 'utf8');
  }

  async updateConfig(contextRef) {
    await upsertRyoBlock(this.configFile, contextRef);
  }

  async uninstall() {
    await removeRyoCursorRules(this.skillsDir);
    await removeRyoBlock(this.configFile);
  }
}

async function removeRyoCursorRules(skillsDir) {
  if (!await exists(skillsDir)) return;
  const entries = await readdir(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.startsWith('ryo-') && entry.name.endsWith('.md')) {
      await unlink(join(skillsDir, entry.name));
    }
  }
}
