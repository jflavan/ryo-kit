import { join } from 'node:path';
import { writeFile, unlink, readdir } from 'node:fs/promises';
import { BaseRuntime } from './base.js';
import { ensureDir, ensureParentDir, exists } from '../utils/fs.js';
import { upsertRyoBlock, removeRyoBlock } from './claude-code.js';

export class CopilotRuntime extends BaseRuntime {
  get name() { return 'copilot'; }

  get skillsDir() {
    return join(this.projectDir, '.github', 'prompts');
  }

  get configFile() {
    return join(this.projectDir, '.github', 'copilot-instructions.md');
  }

  async installSkill(skillName, skillContent) {
    await ensureDir(this.skillsDir);
    await writeFile(join(this.skillsDir, `ryo-${skillName}.prompt.md`), skillContent, 'utf8');
  }

  async updateConfig(contextRef) {
    await upsertRyoBlock(this.configFile, contextRef);
  }

  async uninstall() {
    await removeRyoCopilotPrompts(this.skillsDir);
    await removeRyoBlock(this.configFile);
  }
}

async function removeRyoCopilotPrompts(skillsDir) {
  if (!await exists(skillsDir)) return;
  const entries = await readdir(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.startsWith('ryo-') && entry.name.endsWith('.prompt.md')) {
      await unlink(join(skillsDir, entry.name));
    }
  }
}
