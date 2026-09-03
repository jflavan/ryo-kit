import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import YAML from 'yaml';
import { writeOrgContext, writeConstitution, writeDefaultTemplates, tuneConstitution } from '../src/context/writer.js';
import { ConstitutionSchema, parseFrontmatter } from '../src/context/schema.js';

async function makeTempDir() {
  return await mkdtemp(join(tmpdir(), 'ryo-kit-writer-test-'));
}

const validContext = {
  methodology: 'none',
  stack: { languages: ['javascript'], frameworks: [], cloud: 'none' },
  team: { size: 'solo' },
  compliance: [],
  tools: { ai: ['claude-code'], scm: 'github' },
};

describe('writeOrgContext', () => {
  test('writes org-context.yaml to the target directory', async () => {
    const dir = await makeTempDir();
    await writeOrgContext(dir, validContext);
    const filePath = join(dir, 'org-context.yaml');
    await access(filePath); // throws if file doesn't exist
  });

  test('written YAML parses back to the original context (round-trip)', async () => {
    const dir = await makeTempDir();
    await writeOrgContext(dir, validContext);
    const content = await readFile(join(dir, 'org-context.yaml'), 'utf8');
    const parsed = YAML.parse(content);
    assert.deepEqual(parsed.methodology, validContext.methodology);
    assert.deepEqual(parsed.stack.languages, validContext.stack.languages);
    assert.deepEqual(parsed.stack.cloud, validContext.stack.cloud);
    assert.deepEqual(parsed.team.size, validContext.team.size);
    assert.deepEqual(parsed.compliance, validContext.compliance);
    assert.deepEqual(parsed.tools.ai, validContext.tools.ai);
    assert.deepEqual(parsed.tools.scm, validContext.tools.scm);
  });

  test('creates parent directory if it does not exist', async () => {
    const dir = await makeTempDir();
    const nested = join(dir, 'nested', 'deep');
    await writeOrgContext(nested, validContext);
    await access(join(nested, 'org-context.yaml'));
  });

  test('throws on invalid context (Zod validation)', async () => {
    const dir = await makeTempDir();
    const badContext = { ...validContext, methodology: 'invalid-method' };
    await assert.rejects(() => writeOrgContext(dir, badContext));
  });

  test('includes optional name field when provided', async () => {
    const dir = await makeTempDir();
    const ctx = { ...validContext, name: 'Acme Corp' };
    await writeOrgContext(dir, ctx);
    const content = await readFile(join(dir, 'org-context.yaml'), 'utf8');
    const parsed = YAML.parse(content);
    assert.equal(parsed.name, 'Acme Corp');
  });
});

describe('writeConstitution', () => {
  test('creates constitution.md in the target directory', async () => {
    const dir = await makeTempDir();
    await writeConstitution(dir);
    await access(join(dir, 'constitution.md'));
  });

  test('constitution.md contains expected headings', async () => {
    const dir = await makeTempDir();
    await writeConstitution(dir);
    const content = await readFile(join(dir, 'constitution.md'), 'utf8');
    assert.ok(content.includes('# Constitution'));
    assert.ok(content.includes('Non-Negotiable Principles'));
  });

  test('constitution.md contains Code Quality section', async () => {
    const dir = await makeTempDir();
    await writeConstitution(dir);
    const content = await readFile(join(dir, 'constitution.md'), 'utf8');
    assert.ok(content.includes('Code Quality'));
  });

  test('constitution.md contains Security section', async () => {
    const dir = await makeTempDir();
    await writeConstitution(dir);
    const content = await readFile(join(dir, 'constitution.md'), 'utf8');
    assert.ok(content.includes('Security'));
  });

  test('creates parent directory if it does not exist', async () => {
    const dir = await makeTempDir();
    const nested = join(dir, 'nested');
    await writeConstitution(nested);
    await access(join(nested, 'constitution.md'));
  });
});

describe('writeDefaultTemplates', () => {
  test('creates templates/agent-base.yaml', async () => {
    const dir = await makeTempDir();
    await writeDefaultTemplates(dir);
    await access(join(dir, 'templates', 'agent-base.yaml'));
  });

  test('creates templates/process-base.yaml', async () => {
    const dir = await makeTempDir();
    await writeDefaultTemplates(dir);
    await access(join(dir, 'templates', 'process-base.yaml'));
  });

  test('agent-base.yaml contains expected fields', async () => {
    const dir = await makeTempDir();
    await writeDefaultTemplates(dir);
    const content = await readFile(join(dir, 'templates', 'agent-base.yaml'), 'utf8');
    assert.ok(content.includes('name:'));
    assert.ok(content.includes('role:'));
    assert.ok(content.includes('responsibilities:'));
  });

  test('process-base.yaml contains expected fields', async () => {
    const dir = await makeTempDir();
    await writeDefaultTemplates(dir);
    const content = await readFile(join(dir, 'templates', 'process-base.yaml'), 'utf8');
    assert.ok(content.includes('name:'));
    assert.ok(content.includes('phases:'));
  });

  test('creates templates subdirectory if it does not exist', async () => {
    const dir = await makeTempDir();
    const nested = join(dir, 'new-location');
    await writeDefaultTemplates(nested);
    await access(join(nested, 'templates', 'agent-base.yaml'));
    await access(join(nested, 'templates', 'process-base.yaml'));
  });
});

describe('tuneConstitution', () => {
  const template = [
    '---', '# keep this comment', 'version: 1', 'protected_branches:', '  - main', '  - release/*',
    'required_reviewers:', '  default: 1', 'evidence:', '  review: required', '  tests: required', '---', '', '# Constitution', '', 'Prose.', '',
  ].join('\n');

  it('drops protected branches for a solo developer without required reviews', () => {
    const out = tuneConstitution(template, { team: { size: 'solo' }, compliance: [], conventions: {} });
    const { data, content } = parseFrontmatter(out);
    assert.ok(ConstitutionSchema.safeParse(data).success);
    assert.deepEqual(data.protected_branches, []);
    assert.equal(data.required_reviewers.default, 0);
    assert.equal(data.evidence.review, 'optional');
    assert.equal(data.evidence.tests, 'required', 'untouched fields survive');
    assert.match(out, /# keep this comment/, 'frontmatter comments survive');
    assert.match(content, /^# Constitution/);
  });

  it('keeps protection for a solo developer who requires reviews', () => {
    const { data } = parseFrontmatter(tuneConstitution(template, { team: { size: 'solo' }, compliance: [], conventions: { reviews: 'required' } }));
    assert.deepEqual(data.protected_branches, ['main', 'release/*']);
  });

  it('raises reviewer count and adds compliance evidence for regulated orgs', () => {
    const { data } = parseFrontmatter(tuneConstitution(template, { team: { size: 'small' }, compliance: ['hipaa'] }));
    assert.equal(data.required_reviewers.default, 2);
    assert.deepEqual(data.evidence.additional, ['compliance-checklist']);
    assert.deepEqual(data.protected_branches, ['main', 'release/*']);
  });

  it('leaves a template without frontmatter untouched', () => {
    assert.equal(tuneConstitution('# Just prose\n', { team: { size: 'solo' } }), '# Just prose\n');
  });
});
