import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectProjectContext } from '../src/context/detector.js';

async function makeTempDir() {
  return await mkdtemp(join(tmpdir(), 'ryo-kit-test-'));
}

describe('detectProjectContext', () => {
  test('returns empty results for a bare directory', async () => {
    const dir = await makeTempDir();
    const result = await detectProjectContext(dir);
    assert.deepEqual(result.existing, []);
    assert.deepEqual(result.runtimes, []);
    assert.deepEqual(result.languages, []);
  });

  test('detects CLAUDE.md → runtime claude-code', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'CLAUDE.md'), '# Claude config');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('CLAUDE.md'));
    assert.ok(result.runtimes.includes('claude-code'));
  });

  test('detects .claude directory → runtime claude-code', async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, '.claude'));
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('.claude'));
    assert.ok(result.runtimes.includes('claude-code'));
  });

  test('detects .cursorrules → runtime cursor', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, '.cursorrules'), 'cursor rules');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('.cursorrules'));
    assert.ok(result.runtimes.includes('cursor'));
  });

  test('detects .cursor directory → runtime cursor', async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, '.cursor'));
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('.cursor'));
    assert.ok(result.runtimes.includes('cursor'));
  });

  test('detects .github/copilot-instructions.md → runtime copilot', async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, '.github'));
    await writeFile(join(dir, '.github', 'copilot-instructions.md'), '# Copilot');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('.github/copilot-instructions.md'));
    assert.ok(result.runtimes.includes('copilot'));
  });

  test('detects .github/prompts directory → runtime copilot', async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, '.github', 'prompts'), { recursive: true });
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('.github/prompts'));
    assert.ok(result.runtimes.includes('copilot'));
  });

  test('detects AGENTS.md → runtime codex', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'AGENTS.md'), '# Agents');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('AGENTS.md'));
    assert.ok(result.runtimes.includes('codex'));
  });

  test('detects .windsurfrules → runtime windsurf', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, '.windsurfrules'), 'windsurf rules');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('.windsurfrules'));
    assert.ok(result.runtimes.includes('windsurf'));
  });

  test('detects GEMINI.md → runtime gemini-cli', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'GEMINI.md'), '# Gemini');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('GEMINI.md'));
    assert.ok(result.runtimes.includes('gemini-cli'));
  });

  test('detects .gemini directory → runtime gemini-cli', async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, '.gemini'));
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('.gemini'));
    assert.ok(result.runtimes.includes('gemini-cli'));
  });

  test('detects package.json → language javascript', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'package.json'), '{"name":"test"}');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('package.json'));
    assert.ok(result.languages.includes('javascript'));
  });

  test('detects tsconfig.json → language typescript', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'tsconfig.json'), '{}');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('tsconfig.json'));
    assert.ok(result.languages.includes('typescript'));
  });

  test('detects requirements.txt → language python', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'requirements.txt'), 'flask');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('requirements.txt'));
    assert.ok(result.languages.includes('python'));
  });

  test('detects pyproject.toml → language python', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'pyproject.toml'), '[tool.poetry]');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('pyproject.toml'));
    assert.ok(result.languages.includes('python'));
  });

  test('detects go.mod → language go', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'go.mod'), 'module example.com/app');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('go.mod'));
    assert.ok(result.languages.includes('go'));
  });

  test('detects Cargo.toml → language rust', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'Cargo.toml'), '[package]');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('Cargo.toml'));
    assert.ok(result.languages.includes('rust'));
  });

  test('detects pom.xml → language java', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'pom.xml'), '<project/>');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('pom.xml'));
    assert.ok(result.languages.includes('java'));
  });

  test('detects build.gradle → language java', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'build.gradle'), 'apply plugin: "java"');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('build.gradle'));
    assert.ok(result.languages.includes('java'));
  });

  test('detects Gemfile → language ruby', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'Gemfile'), 'source "https://rubygems.org"');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.includes('Gemfile'));
    assert.ok(result.languages.includes('ruby'));
  });

  test('detects *.csproj via readdir → language csharp', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'MyApp.csproj'), '<Project/>');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.some(f => f.endsWith('.csproj')));
    assert.ok(result.languages.includes('csharp'));
  });

  test('detects *.sln via readdir → language csharp', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'MyApp.sln'), 'Microsoft Visual Studio Solution File');
    const result = await detectProjectContext(dir);
    assert.ok(result.existing.some(f => f.endsWith('.sln')));
    assert.ok(result.languages.includes('csharp'));
  });

  test('does not duplicate runtimes when multiple artifacts found', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'CLAUDE.md'), '# Claude');
    await mkdir(join(dir, '.claude'));
    const result = await detectProjectContext(dir);
    assert.equal(result.runtimes.filter(r => r === 'claude-code').length, 1);
  });

  test('does not duplicate languages when multiple artifacts found', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'requirements.txt'), 'flask');
    await writeFile(join(dir, 'pyproject.toml'), '[tool.poetry]');
    const result = await detectProjectContext(dir);
    assert.equal(result.languages.filter(l => l === 'python').length, 1);
  });
});
