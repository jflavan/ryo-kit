import * as p from '@clack/prompts';

export const log = {
  info: (msg) => p.log.info(msg),
  success: (msg) => p.log.success(msg),
  warn: (msg) => p.log.warn(msg),
  error: (msg) => p.log.error(msg),
  step: (msg) => p.log.step(msg),
};

export const spinner = () => p.spinner();

export { p as prompts };
