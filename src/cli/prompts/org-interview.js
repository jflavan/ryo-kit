import * as p from '@clack/prompts';
import { detectProjectContext } from '../../context/detector.js';

/**
 * Parse a comma-separated string into a trimmed, non-empty array.
 *
 * @param {string} str
 * @returns {string[]}
 */
function parseCSV(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Handle a potentially-cancelled clack prompt value.
 * If the user pressed Ctrl+C, cancel gracefully and exit.
 *
 * @param {unknown} value
 * @returns {unknown} The unwrapped value if not cancelled.
 */
function handle(value) {
  if (p.isCancel(value)) {
    p.cancel('Interview cancelled.');
    process.exit(0);
  }
  return value;
}

/**
 * Run the org-level TUI interview.
 *
 * @param {{ yes: boolean, projectDir: string }} opts
 * @returns {Promise<{
 *   context: object,
 *   installLocation: string,
 *   detected: { existing: string[], runtimes: string[], languages: string[] }
 * }>}
 */
export async function runInterview({ yes, projectDir }) {
  // Non-interactive / CI mode — return defaults immediately
  if (yes) {
    return {
      context: {
        methodology: 'none',
        stack: { languages: ['javascript'], frameworks: [], cloud: 'none' },
        team: { size: 'solo' },
        compliance: [],
        tools: { ai: ['claude-code'], scm: 'github' },
      },
      installLocation: 'repo-only',
      detected: { existing: [], runtimes: [], languages: [] },
    };
  }

  // ─── Step 1: Welcome ────────────────────────────────────────────────────────
  p.intro(
    'ryo-kit — Roll Your Own AI-driven development framework.\n' +
    'This interview collects your org context so ryo-kit can generate agents, skills, and processes tailored to your team.',
  );

  // ─── Step 2: Optional org name ──────────────────────────────────────────────
  const orgName = handle(
    await p.text({
      message: 'What is your organization or project name? (optional)',
      placeholder: 'e.g. Acme Corp',
    }),
  );

  // ─── Step 3: AI tools ───────────────────────────────────────────────────────
  const aiTools = handle(
    await p.multiselect({
      message: 'Which AI coding tools does your team use?',
      options: [
        { value: 'claude-code', label: 'Claude Code' },
        { value: 'copilot', label: 'GitHub Copilot' },
        { value: 'cursor', label: 'Cursor' },
        { value: 'codex', label: 'Codex (OpenAI)' },
        { value: 'windsurf', label: 'Windsurf' },
        { value: 'gemini-cli', label: 'Gemini CLI' },
      ],
      required: true,
    }),
  );

  // ─── Step 4: Methodology ────────────────────────────────────────────────────
  const methodology = handle(
    await p.select({
      message: 'What development methodology does your team follow?',
      options: [
        { value: 'scrum', label: 'Scrum' },
        { value: 'safe', label: 'SAFe (Scaled Agile Framework)' },
        { value: 'kanban', label: 'Kanban' },
        { value: 'hybrid', label: 'Hybrid' },
        { value: 'none', label: 'None / Ad-hoc' },
      ],
    }),
  );

  // ─── Step 5: Tech stack ─────────────────────────────────────────────────────
  const languagesRaw = handle(
    await p.text({
      message: 'What programming languages does your team use? (comma-separated)',
      placeholder: 'e.g. typescript, python, go',
    }),
  );
  const languages = parseCSV(languagesRaw);

  const frameworksRaw = handle(
    await p.text({
      message: 'What frameworks or platforms? (comma-separated, optional)',
      placeholder: 'e.g. react, dotnet, fastapi',
    }),
  );
  const frameworks = parseCSV(frameworksRaw);

  const cloud = handle(
    await p.select({
      message: 'What cloud provider does your team primarily use?',
      options: [
        { value: 'azure', label: 'Azure' },
        { value: 'aws', label: 'AWS' },
        { value: 'gcp', label: 'Google Cloud' },
        { value: 'multi', label: 'Multi-cloud' },
        { value: 'none', label: 'None / On-prem' },
      ],
    }),
  );

  const cicdRaw = handle(
    await p.text({
      message: 'What CI/CD tools do you use? (comma-separated, optional)',
      placeholder: 'e.g. github-actions, azure-devops',
    }),
  );
  const cicd = parseCSV(cicdRaw);

  // ─── Step 6: Team size + roles ──────────────────────────────────────────────
  const teamSize = handle(
    await p.select({
      message: 'What is your team size?',
      options: [
        { value: 'solo', label: 'Solo developer' },
        { value: 'small', label: 'Small (2–10)' },
        { value: 'medium', label: 'Medium (11–50)' },
        { value: 'large', label: 'Large (50+)' },
        { value: 'enterprise', label: 'Enterprise (200+)' },
      ],
    }),
  );

  const rolesRaw = handle(
    await p.text({
      message: 'What roles are on the team? (comma-separated, optional)',
      placeholder: 'e.g. developers, architects, qe, pm',
    }),
  );
  const roles = parseCSV(rolesRaw);

  // ─── Step 7: Compliance ─────────────────────────────────────────────────────
  const complianceRaw = handle(
    await p.multiselect({
      message: 'What compliance requirements apply?',
      options: [
        { value: 'soc2', label: 'SOC 2' },
        { value: 'hipaa', label: 'HIPAA' },
        { value: 'pci-dss', label: 'PCI DSS' },
        { value: 'iso27001', label: 'ISO 27001' },
        { value: 'fedramp', label: 'FedRAMP' },
        { value: 'internal', label: 'Internal standards only' },
        { value: 'none', label: 'None' },
      ],
      required: false,
    }),
  );
  // Filter out the 'none' sentinel value
  const compliance = (complianceRaw ?? []).filter(v => v !== 'none');

  // ─── Step 8: Source control + PM tool ───────────────────────────────────────
  const scm = handle(
    await p.select({
      message: 'What source control platform does your team use?',
      options: [
        { value: 'github', label: 'GitHub' },
        { value: 'gitlab', label: 'GitLab' },
        { value: 'azure-devops', label: 'Azure DevOps' },
        { value: 'bitbucket', label: 'Bitbucket' },
      ],
    }),
  );

  const pm = handle(
    await p.select({
      message: 'What project management tool does your team use?',
      options: [
        { value: 'jira', label: 'Jira' },
        { value: 'linear', label: 'Linear' },
        { value: 'azure-boards', label: 'Azure Boards' },
        { value: 'github-issues', label: 'GitHub Issues' },
        { value: 'none', label: 'None' },
      ],
    }),
  );

  // ─── Step 9: Conventions ────────────────────────────────────────────────────
  const branching = handle(
    await p.text({
      message: 'What branching strategy do you use? (optional)',
      placeholder: 'e.g. gitflow, trunk-based, github-flow',
    }),
  );

  const testing = handle(
    await p.text({
      message: 'What testing approach do you use? (optional)',
      placeholder: 'e.g. tdd, bdd, post-hoc',
    }),
  );

  const reviews = handle(
    await p.text({
      message: 'What is your code review policy? (optional)',
      placeholder: 'e.g. required, optional, pair-review',
    }),
  );

  // ─── Step 10: Install location ──────────────────────────────────────────────
  const installLocation = handle(
    await p.select({
      message: 'Where should ryo-kit write context files?',
      options: [
        {
          value: 'org-wide',
          label: 'Org-wide (~/.ryo/) — shared across all repos',
        },
        {
          value: 'repo-only',
          label: 'This repo only (.ryo/) — good for single projects or trying out ryo-kit',
        },
      ],
    }),
  );

  // ─── Step 11: Auto-detect project artifacts ─────────────────────────────────
  const detected = await detectProjectContext(projectDir);

  if (detected.runtimes.length > 0) {
    p.note(
      `Detected runtimes: ${detected.runtimes.join(', ')}\n` +
      `Detected languages: ${detected.languages.length > 0 ? detected.languages.join(', ') : 'none'}`,
      'Auto-detected',
    );
  }

  // ─── Step 12: Assemble and return ───────────────────────────────────────────
  const context = {
    ...(orgName ? { name: orgName } : {}),
    methodology,
    stack: {
      languages,
      frameworks,
      cloud,
      ...(cicd.length > 0 ? { cicd } : {}),
    },
    team: {
      size: teamSize,
      ...(roles.length > 0 ? { roles } : {}),
    },
    compliance,
    tools: {
      ai: aiTools,
      scm,
      ...(pm && pm !== 'none' ? { pm } : {}),
    },
    conventions: {
      ...(branching ? { branching } : {}),
      ...(testing ? { testing } : {}),
      ...(reviews ? { reviews } : {}),
    },
  };

  // Remove empty conventions object
  if (Object.keys(context.conventions).length === 0) {
    delete context.conventions;
  }

  return { context, installLocation, detected };
}
