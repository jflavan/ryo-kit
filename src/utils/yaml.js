import { readFile, writeFile } from 'node:fs/promises';
import YAML from 'yaml';

export async function readYaml(filePath) {
  const content = await readFile(filePath, 'utf8');
  return YAML.parse(content);
}

export async function writeYaml(filePath, data) {
  const content = YAML.stringify(data, { indent: 2 });
  await writeFile(filePath, content, 'utf8');
}
