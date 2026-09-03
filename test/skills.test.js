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
    for (const f of ['org-context-prompt.md', 'decision-tree.md', 'validation.md',
      'scope-classification.md', 'ledger.md', 'verification.md']) {
      assert.ok(fragmentFiles.includes(f), `missing fragment ${f}`);
    }

    // Every "**name** fragment" reference in a skill template must name a real fragment.
    const fragmentNames = new Set(fragmentFiles.map(f => f.replace(/\.md$/, '')));
    for (const dir of SKILL_DIRS) {
      const fullDir = join(TEMPLATES_DIR, dir);
      for (const file of (await readdir(fullDir)).filter(f => f.endsWith('.skill.md'))) {
        const content = await readFile(join(fullDir, file), 'utf8');
        for (const m of content.matchAll(/\*\*([a-z-]+)\*\*\s+fragment/g)) {
          assert.ok(fragmentNames.has(m[1]), `${dir}/${file} references unknown fragment "${m[1]}"`);
        }
      }
    }
  });

  it('governance fragments are embedded by the generation templates', async () => {
    const wf = await readFile(join(TEMPLATES_DIR, 'sub-skills', 'workflow-generation.skill.md'), 'utf8');
    for (const name of ['scope-classification', 'ledger', 'verification']) {
      assert.match(wf, new RegExp(`\\*\\*${name}\\*\\*\\s+fragment`), `workflow-generation missing ${name}`);
    }
    assert.ok(wf.includes('separation_of_duties'));
    assert.ok(wf.includes('skippable_for'));
    const proc = await readFile(join(TEMPLATES_DIR, 'sub-skills', 'process-generation.skill.md'), 'utf8');
    assert.ok(proc.includes('skippable_for: []'));
    const sk = await readFile(join(TEMPLATES_DIR, 'sub-skills', 'skill-generation.skill.md'), 'utf8');
    for (const s of ['DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED', 'Global Constraints']) {
      assert.ok(sk.includes(s), `skill-generation missing ${s}`);
    }
  });

  it('ryo-gen plan template phases match its phase sections', async () => {
    const gen = await readFile(join(TEMPLATES_DIR, 'bootstrap', 'ryo-gen.skill.md'), 'utf8');
    const planned = [...gen.matchAll(/^- \[ \] Phase (\d+): (.+)$/gm)].map(m => `Phase ${m[1]}: ${m[2]}`);
    assert.equal(planned.length, 7);
    const headings = [...gen.matchAll(/^## Phase (\d+): (.+)$/gm)].map(m => m[1]);
    assert.equal(new Set(headings).size, headings.length, 'duplicate Phase headings in ryo-gen');
    for (const n of ['5', '6', '7']) assert.ok(headings.includes(n), `missing Phase ${n} heading`);
  });

  it('ryo-session bootstrap skill exists with the session rules', async () => {
    const content = await readFile(join(TEMPLATES_DIR, 'core-skills', 'ryo-session.skill.md'), 'utf8');
    const { data } = parseFrontmatter(content);
    assert.equal(data.trigger, '/ryo-session');
    for (const s of ['Classify before you act', 'ryo-kit classify', 'Rulings, not stalls', 'forbidden_paths', 'Red Flags']) {
      assert.ok(content.includes(s), `ryo-session missing "${s}"`);
    }
  });

  it('default constitution has valid frontmatter', async () => {
    const { ConstitutionSchema } = await import('../src/context/schema.js');
    const content = await readFile(join(TEMPLATES_DIR, 'defaults', 'constitution.md'), 'utf8');
    const { data, content: body } = parseFrontmatter(content);
    const result = ConstitutionSchema.safeParse(data);
    assert.equal(result.success, true, JSON.stringify(result.error?.issues));
    assert.deepEqual(result.data.protected_branches, ['main', 'release/*']);
    assert.match(body, /Non-Negotiable Principles/);
  });
});
