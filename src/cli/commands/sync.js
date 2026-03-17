import { join } from 'node:path';
import { homedir } from 'node:os';
import { readdir, rename, unlink, rm, writeFile, mkdir } from 'node:fs/promises';
import { exists } from '../../utils/fs.js';
import { readYaml } from '../../utils/yaml.js';
import { getRuntimeForName } from '../../scaffolder/skill-writer.js';
import { parseFrontmatter } from '../../context/schema.js';
import { removeRyoKitSymlinks } from '../../utils/symlink.js';

/**
 * Migrate old layout conventions to the current layout.
 *
 * @param {string} projectDir
 */
export async function migrateOldLayout(projectDir) {
  // 1. Move .ryo/skills/ to .agents/skills/
  const oldSkillsDir = join(projectDir, '.ryo', 'skills');
  const newSkillsDir = join(projectDir, '.agents', 'skills');
  if (await exists(oldSkillsDir) && !await exists(newSkillsDir)) {
    await mkdir(join(projectDir, '.agents'), { recursive: true });
    await rename(oldSkillsDir, newSkillsDir);
    const markerPath = join(projectDir, '.agents', '.ryo-kit');
    if (!await exists(markerPath)) {
      await writeFile(markerPath, '', 'utf8');
    }
  }

  // 2. Remove old Copilot prompts: .github/prompts/ryo-*.prompt.md
  const copilotPromptsDir = join(projectDir, '.github', 'prompts');
  if (await exists(copilotPromptsDir)) {
    const entries = await readdir(copilotPromptsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /^ryo-.+\.prompt\.md$/.test(entry.name)) {
        await unlink(join(copilotPromptsDir, entry.name));
      }
    }
  }

  // 3. Remove old Codex root-level skills: skills/ryo-*
  const rootSkillsDir = join(projectDir, 'skills');
  if (await exists(rootSkillsDir)) {
    const entries = await readdir(rootSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('ryo-')) {
        await rm(join(rootSkillsDir, entry.name), { recursive: true, force: true });
      }
    }
  }
}

/**
 * Core sync logic, separated for testability.
 *
 * @param {{ projectDir: string, force?: boolean }} opts
 */
export async function syncAction({ projectDir, force } = {}) {
  // 0. Migrate old layout conventions
  await migrateOldLayout(projectDir);
  // 1. Locate org context — prefer repo-local, fall back to org-wide
  const repoContextPath = join(projectDir, '.ryo', 'org-context.yaml');
  const orgWideContextPath = join(homedir(), '.ryo', 'org-context.yaml');

  let contextPath;
  if (await exists(repoContextPath)) {
    contextPath = repoContextPath;
  } else if (await exists(orgWideContextPath)) {
    contextPath = orgWideContextPath;
  } else {
    throw new Error('No org context found. Run `ryo init` first.');
  }

  const orgContext = await readYaml(contextPath);
  const runtimeNames = orgContext?.tools?.ai ?? [];

  // 2. Conflict detection
  const agentsBaseDir = join(projectDir, '.agents');
  const markerPath = join(agentsBaseDir, '.ryo-kit');
  if (await exists(agentsBaseDir) && !await exists(markerPath) && !force) {
    throw new Error(
      '.agents/ directory exists but was not created by ryo-kit. Use --force to overwrite.',
    );
  }

  // 3. Scan .agents/skills/ for all skill directories
  const skillsSourceDir = join(projectDir, '.agents', 'skills');
  const skills = [];
  if (await exists(skillsSourceDir)) {
    const entries = await readdir(skillsSourceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        skills.push(entry.name);
      }
    }
  }

  // 4. Scan .ryo/agents/ for all agent files
  const agentsSourceDir = join(projectDir, '.ryo', 'agents');
  const agents = [];
  if (await exists(agentsSourceDir)) {
    const entries = await readdir(agentsSourceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.agent.md')) {
        const agentName = entry.name.replace(/\.agent\.md$/, '');
        const content = await (await import('node:fs/promises')).readFile(
          join(agentsSourceDir, entry.name), 'utf8',
        );
        const { data } = parseFrontmatter(content);
        agents.push({ name: agentName, meta: data });
      }
    }
  }

  // 5. For each active runtime: clean stale links, then install
  for (const runtimeName of runtimeNames) {
    const runtime = getRuntimeForName(runtimeName, projectDir);

    // Clean stale symlinks
    if (runtime.skillsDir) {
      await removeRyoKitSymlinks(runtime.skillsDir);
    }
    if (runtime.agentsDir) {
      await removeRyoKitSymlinks(runtime.agentsDir);
    }

    // Install skills
    for (const skillName of skills) {
      const canonicalDir = join(skillsSourceDir, skillName);
      await runtime.installSkill(skillName, canonicalDir);
    }

    // Install agents
    for (const agent of agents) {
      await runtime.installAgent(agent.name, agent.meta);
    }
  }
}

/**
 * Register the `ryo sync` command on the given Commander program.
 *
 * @param {import('commander').Command} program
 */
export function registerSync(program) {
  program
    .command('sync')
    .description('Sync agents and skills to all configured coding tool runtimes')
    .option('--force', 'overwrite even if .agents/ was not created by ryo-kit')
    .action(async (options) => {
      await syncAction({ projectDir: process.cwd(), force: !!options.force });
    });
}
