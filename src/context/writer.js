import { readFile, writeFile, copyFile } from 'node:fs/promises';
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
 * Copy the default constitution.md template to targetDir.
 *
 * @param {string} targetDir - Directory to write constitution.md into.
 */
export async function writeConstitution(targetDir) {
  await ensureDir(targetDir);
  const src = join(TEMPLATES_DIR, 'constitution.md');
  const dest = join(targetDir, 'constitution.md');
  await copyFile(src, dest);
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
