import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../src/context/schema.js';
import { exists } from '../src/utils/fs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

const SKILL_DIRS = ['bootstrap', 'sub-skills', 'core-skills'];
const FRAGMENT_DIR = join(TEMPLATES_DIR, 'fragments');

describe('skill template validation', () => {
  for (const dir of SKILL_DIRS) {
    it(`all .skill.md files in ${dir}/ have valid YAML frontmatter`, async () => {
      const fullDir = join(TEMPLATES_DIR, dir);
      const files = await readdir(fullDir);
      for (const file of files.filter(f => f.endsWith('.skill.md'))) {
        const content = await readFile(join(fullDir, file), 'utf8');
        const { data } = parseFrontmatter(content);
        assert.ok(data.name, `${dir}/${file} missing frontmatter 'name'`);
        assert.ok(data.description, `${dir}/${file} missing frontmatter 'description'`);
      }
    });
  }

  it('all core-skills have a trigger field for slash command invocation', async () => {
    const coreDir = join(TEMPLATES_DIR, 'core-skills');
    const files = await readdir(coreDir);
    for (const file of files.filter(f => f.endsWith('.skill.md'))) {
      const content = await readFile(join(coreDir, file), 'utf8');
      const { data } = parseFrontmatter(content);
      assert.ok(data.trigger, `core-skills/${file} missing frontmatter 'trigger'`);
      assert.ok(
        data.trigger.startsWith('/ryo-'),
        `core-skills/${file} trigger should start with '/ryo-', got '${data.trigger}'`,
      );
    }
  });

  it('all fragment cross-references point to existing files', async () => {
    const fragmentFiles = await readdir(FRAGMENT_DIR);
    assert.ok(fragmentFiles.includes('org-context-prompt.md'));
    assert.ok(fragmentFiles.includes('decision-tree.md'));
    assert.ok(fragmentFiles.includes('validation.md'));
  });
});
