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

export function run(argv) {
  const program = new Command();
  program
    .name('ryo')
    .description('Roll Your Own AI-driven development framework')
    .version('0.1.0');

  registerInit(program);
  registerGen(program);
  registerEvolve(program);
  registerAdd(program);
  registerCheck(program);
  registerUpdate(program);
  registerSync(program);
  registerConference(program);
  registerDocs(program);

  program.parse(argv);
}
