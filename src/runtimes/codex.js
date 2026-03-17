import { join } from 'node:path';
import { writeFile, readdir, unlink } from 'node:fs/promises';
import { BaseRuntime } from './base.js';
import { ensureDir, exists, readIfExists } from '../utils/fs.js';
import { upsertRyoBlock, removeRyoBlock } from './claude-code.js';
import { upsertAgentBlock, removeAgentBlock } from '../utils/agent-block.js';
import { agentMetaToToml, isRyoKitToml } from '../utils/toml-agent.js';

export class CodexRuntime extends BaseRuntime {
  get name() { return 'codex'; }

  get skillsDir() { return null; }

  get agentsDir() {
    return join(this.projectDir, '.codex', 'agents');
  }

  get agentConfigFile() {
    return join(this.projectDir, 'AGENTS.md');
  }

  get configFile() {
    return join(this.projectDir, 'AGENTS.md');
  }

  async installSkill(_skillName, _canonicalSkillDir) {
    // No-op — Codex auto-discovers from .agents/skills/
  }

  async installAgent(agentName, agentMeta) {
    // Generate TOML file
    await ensureDir(this.agentsDir);
    const tomlContent = agentMetaToToml(agentMeta);
    await writeFile(join(this.agentsDir, `${agentName}.toml`), tomlContent, 'utf8');

    // Also upsert agent block in AGENTS.md for general context
    await upsertAgentBlock(this.configFile, agentMeta);
  }

  async updateConfig(contextRef) {
    await upsertRyoBlock(this.configFile, contextRef);
  }

  async uninstall() {
    // Remove ryo-kit TOML files from .codex/agents/
    if (await exists(this.agentsDir)) {
      const entries = await readdir(this.agentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.toml')) {
          const filePath = join(this.agentsDir, entry.name);
          const content = await readIfExists(filePath);
          if (content && isRyoKitToml(content)) {
            await unlink(filePath);
          }
        }
      }
    }

    // Remove agent block from AGENTS.md
    await removeAgentBlock(this.configFile);

    // Remove ryo config block from AGENTS.md
    await removeRyoBlock(this.configFile);
  }
}
