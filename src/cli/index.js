import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { registerInit } from './commands/init.js';
import { registerGen } from './commands/gen.js';
import { registerEvolve } from './commands/evolve.js';
import { registerAdd } from './commands/add.js';
import { registerCheck } from './commands/check.js';
import { registerUpdate } from './commands/update.js';
import { registerSync } from './commands/sync.js';
import { registerConference } from './commands/conference.js';
import { registerDocs } from './commands/docs.js';
import { registerClassify } from './commands/classify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function packageVersion() {
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}

export function run(argv) {
  const program = new Command();
  program
    .name('ryo')
    .description('Roll Your Own AI-driven development framework')
    .version(packageVersion());

  registerInit(program);
  registerGen(program);
  registerEvolve(program);
  registerAdd(program);
  registerCheck(program);
  registerUpdate(program);
  registerSync(program);
  registerConference(program);
  registerDocs(program);
  registerClassify(program);

  program.parse(argv);
}
