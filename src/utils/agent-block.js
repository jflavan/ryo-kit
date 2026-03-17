import { writeFile } from 'node:fs/promises';
import { ensureParentDir, readIfExists } from './fs.js';

const AGENT_BLOCK_START = '<!-- ryo-kit:agents:start -->';
const AGENT_BLOCK_END = '<!-- ryo-kit:agents:end -->';

export { AGENT_BLOCK_START, AGENT_BLOCK_END };

export function formatAgentBlock(agentMeta) {
  const { name, role, description, responsibilities = [], handoff_to = [] } = agentMeta;
  const lines = [`### ${name}${role ? ` — ${role}` : ''}`, '', description, ''];
  if (responsibilities.length) {
    lines.push('**Responsibilities:**');
    for (const r of responsibilities) lines.push(`- ${r}`);
    lines.push('');
  }
  if (handoff_to.length) {
    lines.push(`**Hands off to:** ${handoff_to.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

export async function upsertAgentBlock(configFile, agentMeta) {
  await ensureParentDir(configFile);
  const existing = await readIfExists(configFile) ?? '';

  let existingAgents = '';
  if (existing.includes(AGENT_BLOCK_START)) {
    const match = existing.match(
      new RegExp(`${escapeRegex(AGENT_BLOCK_START)}\\n([\\s\\S]*?)\\n${escapeRegex(AGENT_BLOCK_END)}`)
    );
    if (match) existingAgents = match[1];
  }

  const agentSection = formatAgentBlock(agentMeta);
  const allAgents = existingAgents ? `${existingAgents}\n${agentSection}` : `# ryo-kit Agents\n\n${agentSection}`;
  const block = `${AGENT_BLOCK_START}\n${allAgents}\n${AGENT_BLOCK_END}`;

  if (existing.includes(AGENT_BLOCK_START)) {
    const replaced = existing.replace(
      new RegExp(`${escapeRegex(AGENT_BLOCK_START)}[\\s\\S]*?${escapeRegex(AGENT_BLOCK_END)}`),
      block,
    );
    await writeFile(configFile, replaced, 'utf8');
  } else {
    const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n\n' : existing.length > 0 ? '\n' : '';
    await writeFile(configFile, existing + separator + block + '\n', 'utf8');
  }
}

export async function removeAgentBlock(configFile) {
  const content = await readIfExists(configFile);
  if (!content || !content.includes(AGENT_BLOCK_START)) return;
  const cleaned = content
    .replace(new RegExp(`\\n?${escapeRegex(AGENT_BLOCK_START)}[\\s\\S]*?${escapeRegex(AGENT_BLOCK_END)}\\n?`), '')
    .trimEnd();
  await writeFile(configFile, cleaned.length > 0 ? cleaned + '\n' : '', 'utf8');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
