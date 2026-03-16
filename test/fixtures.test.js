import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readYaml } from '../src/utils/yaml.js';
import { OrgContextSchema } from '../src/context/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

describe('test fixtures', () => {
  for (const fixture of ['solo-dev', 'small-scrum', 'enterprise-safe-hipaa']) {
    it(`${fixture} fixture validates against schema`, async () => {
      const data = await readYaml(join(FIXTURES_DIR, fixture, 'org-context.yaml'));
      const result = OrgContextSchema.safeParse(data);
      assert.equal(result.success, true, JSON.stringify(result.error?.issues));
    });
  }
});
