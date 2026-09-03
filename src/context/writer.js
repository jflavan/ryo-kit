import { readFile, writeFile, copyFile } from 'node:fs/promises';
import YAML from 'yaml';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OrgContextSchema } from './schema.js';
import { ensureDir } from '../utils/fs.js';
import { writeYaml } from '../utils/yaml.js';

// Resolve path to the templates/defaults directory relative to this module
const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', '..', 'templates', 'defaults');

/**
 * Validate context against OrgContextSchema and write org-context.yaml to targetDir.
 *
 * @param {string} targetDir - Directory to write org-context.yaml into.
 * @param {object} context - Org context object to validate and write.
 */
export async function writeOrgContext(targetDir, context) {
  // Validate with Zod — throws ZodError on invalid input
  const validated = OrgContextSchema.parse(context);
  await ensureDir(targetDir);
  await writeYaml(join(targetDir, 'org-context.yaml'), validated);
}

/**
 * Write constitution.md to targetDir from the default template, tuning the
 * machine-checkable frontmatter to the org context when one is given:
 *
 *  - solo team without required reviews: no protected branches (a solo
 *    developer pushes to main; the guard would otherwise block every push)
 *  - compliance requirements: two reviewers by default and a
 *    compliance-checklist evidence artifact
 *  - large/enterprise teams: two reviewers by default
 *
 * The prose body and the frontmatter comments are preserved.
 *
 * @param {string} targetDir - Directory to write constitution.md into.
 * @param {object} [context] - Validated org context, if available.
 */
export async function writeConstitution(targetDir, context) {
  await ensureDir(targetDir);
  const src = join(TEMPLATES_DIR, 'constitution.md');
  const dest = join(targetDir, 'constitution.md');
  if (!context) {
    await copyFile(src, dest);
    return;
  }
  const template = await readFile(src, 'utf8');
  await writeFile(dest, tuneConstitution(template, context), 'utf8');
}

/**
 * Apply org-aware defaults to a constitution template's frontmatter.
 * Exported for tests.
 */
export function tuneConstitution(template, context) {
  const match = template.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return template;
  const doc = YAML.parseDocument(match[1]);
  const body = template.slice(match[0].length);

  const solo = context.team?.size === 'solo';
  const reviewsRequired = context.conventions?.reviews === 'required';
  const compliance = Array.isArray(context.compliance) && context.compliance.length > 0;
  const bigTeam = ['large', 'enterprise'].includes(context.team?.size);

  if (solo && !reviewsRequired) {
    doc.set('protected_branches', []);
    doc.setIn(['required_reviewers', 'default'], 0);
    doc.setIn(['evidence', 'review'], 'optional');
  }
  if (compliance || bigTeam) {
    doc.setIn(['required_reviewers', 'default'], 2);
  }
  if (compliance) {
    doc.setIn(['evidence', 'additional'], ['compliance-checklist']);
  }
  return `---\n${doc.toString().trimEnd()}\n---\n${body}`;
}

/**
 * Copy the default agent-base.yaml and process-base.yaml templates
 * into targetDir/templates/.
 *
 * @param {string} targetDir - Base directory; templates go into targetDir/templates/.
 */
export async function writeDefaultTemplates(targetDir) {
  const templatesOut = join(targetDir, 'templates');
  await ensureDir(templatesOut);

  await copyFile(
    join(TEMPLATES_DIR, 'agent-base.yaml'),
    join(templatesOut, 'agent-base.yaml'),
  );

  await copyFile(
    join(TEMPLATES_DIR, 'process-base.yaml'),
    join(templatesOut, 'process-base.yaml'),
  );
}
