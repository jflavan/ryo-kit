import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import * as p from '@clack/prompts';
import {
  AgentDefSchema,
  SkillDefSchema,
  WorkflowDefSchema,
  ProcessDefSchema,
  parseFrontmatter,
} from '../../context/schema.js';
import { readIfExists, exists } from '../../utils/fs.js';

/**
 * Register the `ryo check` command on the given Commander program.
 *
 * @param {import('commander').Command} program
 */
export function registerCheck(program) {
  program
    .command('check')
    .description('Validate framework files against schemas and check cross-references')
    .option('--dir <dir>', 'directory to check (defaults to .ryo/ in cwd)')
    .action(async (options) => {
      const ryoDir = options.dir ?? join(process.cwd(), '.ryo');
      const errors = await checkFramework(ryoDir);

      if (errors.length === 0) {
        p.log.success('No errors found. Framework is valid.');
      } else {
        p.log.error(`Found ${errors.length} error(s):`);
        for (const { file, message } of errors) {
          p.log.warn(`  ${file}: ${message}`);
        }
        process.exit(1);
      }
    });
}

/**
 * Validate all framework files in the given .ryo directory.
 * Returns an array of error objects with `file` and `message` properties.
 *
 * @param {string} ryoDir - Absolute path to the .ryo/ directory.
 * @returns {Promise<Array<{ file: string, message: string }>>}
 */
export async function checkFramework(ryoDir) {
  const errors = [];

  // --- Collect valid agent names for cross-reference ---
  const agentNames = new Set();
  const skillNames = new Set();

  // --- Validate agents/ ---
  const agentsDir = join(ryoDir, 'agents');
  if (await exists(agentsDir)) {
    let agentFiles = [];
    try {
      agentFiles = (await readdir(agentsDir)).filter(f => f.endsWith('.agent.md'));
    } catch {
      // directory unreadable — skip
    }

    for (const file of agentFiles) {
      const filePath = join(agentsDir, file);
      const content = await readIfExists(filePath);
      if (content === null) continue;

      const { data } = parseFrontmatter(content);
      const result = AgentDefSchema.safeParse(data);

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            file: join('agents', file),
            message: `${issue.path.join('.') || 'root'}: ${issue.message}`,
          });
        }
      } else {
        agentNames.add(result.data.name);
      }
    }
  }

  // --- Validate skills/ ---
  const skillsDir = join(ryoDir, 'skills');
  if (await exists(skillsDir)) {
    let skillDirs = [];
    try {
      const entries = await readdir(skillsDir, { withFileTypes: true });
      skillDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {
      // skip
    }

    for (const skillDir of skillDirs) {
      const filePath = join(skillsDir, skillDir, 'SKILL.md');
      const content = await readIfExists(filePath);
      if (content === null) continue;

      const { data } = parseFrontmatter(content);
      const result = SkillDefSchema.safeParse(data);

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            file: join('skills', skillDir, 'SKILL.md'),
            message: `${issue.path.join('.') || 'root'}: ${issue.message}`,
          });
        }
      } else {
        skillNames.add(result.data.name);
      }
    }
  }

  // --- Validate workflows/ ---
  const workflowsDir = join(ryoDir, 'workflows');
  const workflows = [];
  if (await exists(workflowsDir)) {
    let workflowFiles = [];
    try {
      workflowFiles = (await readdir(workflowsDir)).filter(f => f.endsWith('.workflow.md'));
    } catch {
      // skip
    }

    for (const file of workflowFiles) {
      const filePath = join(workflowsDir, file);
      const content = await readIfExists(filePath);
      if (content === null) continue;

      const { data } = parseFrontmatter(content);
      const result = WorkflowDefSchema.safeParse(data);

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            file: join('workflows', file),
            message: `${issue.path.join('.') || 'root'}: ${issue.message}`,
          });
        }
      } else {
        workflows.push({ file: join('workflows', file), data: result.data });
      }
    }
  }

  // --- Validate process.md ---
  const processFile = join(ryoDir, 'process.md');
  let processDef = null;
  if (await exists(processFile)) {
    const content = await readIfExists(processFile);
    if (content !== null) {
      const { data } = parseFrontmatter(content);
      const result = ProcessDefSchema.safeParse(data);

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            file: 'process.md',
            message: `${issue.path.join('.') || 'root'}: ${issue.message}`,
          });
        }
      } else {
        processDef = result.data;
      }
    }
  }

  // --- Cross-reference checks ---
  // Workflows: agents and skills referenced must exist
  for (const { file, data } of workflows) {
    for (const step of data.steps) {
      if (step.agent && agentNames.size > 0 && !agentNames.has(step.agent)) {
        errors.push({
          file,
          message: `step references unknown agent: "${step.agent}"`,
        });
      }

      for (const skill of step.skills) {
        if (skillNames.size > 0 && !skillNames.has(skill)) {
          errors.push({
            file,
            message: `step references unknown skill: "${skill}"`,
          });
        }
      }
    }
  }

  return errors;
}
