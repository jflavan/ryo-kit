import { join } from 'node:path';
import { writeFile, readFile, readdir, unlink } from 'node:fs/promises';
import { BaseRuntime } from './base.js';
import { ensureDir, ensureParentDir, readIfExists, exists } from '../utils/fs.js';
import { upsertAgentBlock, removeAgentBlock } from '../utils/agent-block.js';

export class WindsurfRuntime extends BaseRuntime {
  get name() { return 'windsurf'; }

  get skillsDir() {
    return join(this.projectDir, '.windsurf', 'rules');
  }

  get agentsDir() { return null; }

  get agentConfigFile() {
    return join(this.projectDir, 'AGENTS.md');
  }

  get configFile() {
    return join(this.projectDir, '.windsurfrules');
  }

  async installSkill(skillName, canonicalSkillDir) {
    // Read SKILL.md from canonical dir
    const skillContent = await readFile(join(canonicalSkillDir, 'SKILL.md'), 'utf8');

    // Transform frontmatter: replace trigger: value with trigger: model_decision
    const transformed = skillContent.replace(
      /^(---\n[\s\S]*?)(trigger:\s*).+(\n[\s\S]*?---)/m,
      '$1$2model_decision$3',
    );

    await ensureDir(this.skillsDir);
    await writeFile(join(this.skillsDir, `${skillName}.md`), transformed, 'utf8');
  }

  async installAgent(agentName, agentMeta) {
    await upsertAgentBlock(this.agentConfigFile, agentMeta);
  }

  async updateConfig(_contextRef) { /* no-op */ }

  async uninstall() {
    // Remove copied skill files from .windsurf/rules/
    if (await exists(this.skillsDir)) {
      const entries = await readdir(this.skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.startsWith('ryo-') && entry.name.endsWith('.md')) {
          await unlink(join(this.skillsDir, entry.name));
        }
      }
    }

    // Remove agent block from AGENTS.md
    await removeAgentBlock(this.agentConfigFile);

    // Legacy cleanup of .windsurfrules blocks
    if (await exists(this.configFile)) {
      const content = await readIfExists(this.configFile) ?? '';
      const cleaned = content
        .replace(
          /\n?<!-- ryo-kit:[^:]+:start -->[\s\S]*?<!-- ryo-kit:[^:]+:end -->\n?/g,
          '',
        )
        .trimEnd();
      await writeFile(this.configFile, cleaned.length > 0 ? cleaned + '\n' : '', 'utf8');
    }
  }
}
