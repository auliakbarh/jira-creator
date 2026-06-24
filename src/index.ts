import 'dotenv/config';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { writeFile } from 'fs/promises';

import { createTicket, createTicketsBulk, getProjects, getIssueTypes, validateCredentials } from './jira-client';
import { readInputFile, validateItems, normalizeItems } from './file-reader';
import { TEMPLATES, applyTemplate } from './templates';
import { TemplateKey, TicketInput, BulkResult } from './types';

// ─── Guard: check required env vars ──────────────────────────────────────────
function checkEnv() {
  const missing = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'].filter(k => !process.env[k]);
  if (missing.length) {
    console.error(chalk.red(`\n✖ Missing environment variables: ${missing.join(', ')}`));
    console.error(chalk.gray('  Copy .env.example → .env and fill in your credentials.\n'));
    process.exit(1);
  }
}

// ─── Header ───────────────────────────────────────────────────────────────────
function header() {
  console.log(chalk.bold.blue('\n╔══════════════════════════════════╗'));
  console.log(chalk.bold.blue('║   🎫  JIRA Creator  (no AI)      ║'));
  console.log(chalk.bold.blue('╚══════════════════════════════════╝\n'));
}

// ─── Ticket preview ───────────────────────────────────────────────────────────
function previewTicket(t: TicketInput) {
  console.log('\n' + chalk.bold('📋 Preview:'));
  console.log(chalk.cyan('  Summary:     ') + t.summary);
  console.log(chalk.cyan('  Type:        ') + (t.issuetype ?? 'Task'));
  console.log(chalk.cyan('  Priority:    ') + (t.priority  ?? 'Medium'));
  console.log(chalk.cyan('  Labels:      ') + ((t.labels as string[] | undefined)?.join(', ') || '—'));
  console.log(chalk.cyan('  Components:  ') + ((t.components as string[] | undefined)?.join(', ') || '—'));
  if (t.story_points) console.log(chalk.cyan('  Story pts:   ') + t.story_points);
  console.log();
}

// ─── Command: whoami ──────────────────────────────────────────────────────────
async function cmdWhoami() {
  checkEnv();
  const spinner = ora('Connecting to JIRA…').start();
  try {
    const user = await validateCredentials();
    spinner.succeed(chalk.green('Connected!'));
    console.log(chalk.cyan('  Name:   ') + user.name);
    console.log(chalk.cyan('  Email:  ') + user.email + '\n');
  } catch (err) {
    spinner.fail('Auth failed: ' + (err as Error).message);
  }
}

// ─── Command: list-projects ───────────────────────────────────────────────────
async function cmdListProjects() {
  checkEnv();
  const spinner = ora('Fetching projects…').start();
  try {
    const projects = await getProjects();
    spinner.succeed(`Found ${projects.length} project(s)`);
    projects.forEach(p => console.log(`  ${chalk.cyan(p.key.padEnd(10))} ${p.name}`));
    console.log();
  } catch (err) {
    spinner.fail((err as Error).message);
  }
}

// ─── Command: list-types ──────────────────────────────────────────────────────
async function cmdListTypes(projectKey: string) {
  checkEnv();
  const spinner = ora(`Fetching issue types for ${projectKey}…`).start();
  try {
    const types = await getIssueTypes(projectKey);
    spinner.succeed(`Issue types in ${chalk.bold(projectKey)}:`);
    types.forEach(t => console.log(`  • ${t.name}` + (t.description ? chalk.gray(` — ${t.description}`) : '')));
    console.log();
  } catch (err) {
    spinner.fail((err as Error).message);
  }
}

// ─── Command: create (interactive) ────────────────────────────────────────────
async function cmdCreate(opts: { project?: string }) {
  checkEnv();
  header();

  const { summary } = await prompts({
    type: 'text', name: 'summary',
    message: 'Summary (judul tiket):',
    validate: v => v.trim().length > 0 || 'Wajib diisi',
  });
  if (!summary) return;

  const { description } = await prompts({
    type: 'text', name: 'description',
    message: 'Description (opsional, Enter untuk skip):',
  });

  const { issuetype } = await prompts({
    type: 'select', name: 'issuetype',
    message: 'Issue type:',
    choices: ['Task', 'Bug', 'Story', 'Epic'].map(v => ({ title: v, value: v })),
  });

  const { priority } = await prompts({
    type: 'select', name: 'priority',
    message: 'Priority:',
    choices: ['Highest', 'High', 'Medium', 'Low', 'Lowest'].map(v => ({ title: v, value: v })),
    initial: 2,
  });

  const { labelsRaw } = await prompts({
    type: 'text', name: 'labelsRaw',
    message: 'Labels (pisahkan dengan koma, opsional):',
  });

  const projectKey = opts.project ?? process.env.JIRA_PROJECT_KEY ?? 'ENG';
  const ticket: TicketInput = {
    summary,
    description: description || undefined,
    issuetype,
    priority,
    labels: labelsRaw ? labelsRaw.split(',').map((s: string) => s.trim()) : [],
    projectKey,
  };

  previewTicket(ticket);

  const { confirm } = await prompts({
    type: 'confirm', name: 'confirm',
    message: 'Buat tiket ini di JIRA?',
    initial: true,
  });
  if (!confirm) { console.log(chalk.yellow('Dibatalkan.\n')); return; }

  const spinner = ora('Membuat tiket…').start();
  try {
    const result = await createTicket(ticket);
    spinner.succeed(chalk.green(`Tiket berhasil dibuat: ${result.key}`));
    console.log(chalk.underline.blue(`  ${result.url}\n`));
  } catch (err) {
    spinner.fail('Gagal: ' + (err as Error).message);
  }
}

// ─── Command: template ────────────────────────────────────────────────────────
async function cmdTemplate(opts: { project?: string }) {
  checkEnv();
  header();

  const { tplKey } = await prompts({
    type: 'select', name: 'tplKey',
    message: 'Pilih template:',
    choices: (Object.entries(TEMPLATES) as [TemplateKey, typeof TEMPLATES[TemplateKey]][]).map(
      ([k, v]) => ({ title: v.name, value: k })
    ),
  });
  if (!tplKey) return;

  const tpl = TEMPLATES[tplKey as TemplateKey];
  const answers: Record<string, string> = {};

  for (const field of tpl.fields) {
    const type = field.textarea ? 'text' : 'text';
    const { value } = await prompts({
      type, name: 'value',
      message: field.prompt + (field.placeholder ? chalk.gray(` (cth: ${field.placeholder.split('\n')[0]})`) : '') + ':',
      validate: v => v.trim().length > 0 || 'Wajib diisi',
    });
    if (value === undefined) { console.log(chalk.yellow('Dibatalkan.\n')); return; }
    answers[field.key] = value;
  }

  const { priority } = await prompts({
    type: 'select', name: 'priority',
    message: 'Priority:',
    choices: ['Highest', 'High', 'Medium', 'Low', 'Lowest'].map(v => ({ title: v, value: v })),
    initial: ['Highest','High','Medium','Low','Lowest'].indexOf(tpl.defaultPriority),
  });

  const projectKey = opts.project ?? process.env.JIRA_PROJECT_KEY ?? 'ENG';
  const ticket = { ...applyTemplate(tplKey as TemplateKey, answers, { priority }), projectKey };

  previewTicket(ticket);

  const { confirm } = await prompts({
    type: 'confirm', name: 'confirm',
    message: 'Buat tiket ini di JIRA?',
    initial: true,
  });
  if (!confirm) { console.log(chalk.yellow('Dibatalkan.\n')); return; }

  const spinner = ora('Membuat tiket…').start();
  try {
    const result = await createTicket(ticket);
    spinner.succeed(chalk.green(`Tiket berhasil dibuat: ${result.key}`));
    console.log(chalk.underline.blue(`  ${result.url}\n`));
  } catch (err) {
    spinner.fail('Gagal: ' + (err as Error).message);
  }
}

// ─── Command: bulk ────────────────────────────────────────────────────────────
async function cmdBulk(filePath: string, opts: { project?: string; output?: string }) {
  checkEnv();
  header();
  console.log(chalk.gray(`File: ${filePath}\n`));

  let items: TicketInput[];
  try {
    items = await readInputFile(filePath);
  } catch (err) {
    console.error(chalk.red('Gagal membaca file: ' + (err as Error).message));
    return;
  }

  const errors = validateItems(items);
  if (errors.length) {
    errors.forEach(e => console.error(chalk.red('✖ ' + e)));
    return;
  }

  items = normalizeItems(items);
  const projectKey = opts.project ?? process.env.JIRA_PROJECT_KEY ?? 'ENG';
  const tickets    = items.map(i => ({ ...i, projectKey: i.projectKey ?? projectKey }));

  console.log(chalk.bold(`📋 Preview ${tickets.length} tiket:`));
  tickets.forEach((t, i) => {
    const type = String(t.issuetype ?? 'Task').padEnd(6);
    const prio = String(t.priority  ?? 'Medium').padEnd(7);
    console.log(chalk.cyan(`  [${i + 1}] `) + `${type} | ${prio} | ${String(t.summary).slice(0, 55)}`);
  });
  console.log();

  const { confirm } = await prompts({
    type: 'confirm', name: 'confirm',
    message: `Buat semua ${tickets.length} tiket ke JIRA?`,
    initial: true,
  });
  if (!confirm) { console.log(chalk.yellow('Dibatalkan.\n')); return; }

  const spinner = ora('Membuat tiket…').start();
  const results: BulkResult[] = await createTicketsBulk(tickets);
  spinner.stop();

  const created = results.filter(r => r.status === 'created');
  const failed  = results.filter(r => r.status === 'failed');

  created.forEach(r => console.log(chalk.green(`  ✔ ${r.key}`) + chalk.gray(` — ${r.input?.slice(0, 50)}`)));
  failed.forEach(r  => console.log(chalk.red(`  ✖ GAGAL`) + chalk.gray(` — ${r.input?.slice(0, 40)} (${r.error})`)));

  console.log(`\n${chalk.green(created.length + ' berhasil')}, ${chalk.red(failed.length + ' gagal')}\n`);

  if (opts.output) {
    await writeFile(opts.output, JSON.stringify(results, null, 2));
    console.log(chalk.gray(`Hasil disimpan ke: ${opts.output}\n`));
  }
}

// ─── CLI setup ────────────────────────────────────────────────────────────────
const projectOpt = ['-p, --project <key>', 'JIRA project key (override .env)'] as const;

program
  .name('jira-creator')
  .description('Buat tiket JIRA dari CLI — hanya butuh JIRA API token')
  .version('1.0.0');

program.command('whoami')
  .description('Cek koneksi & kredensial JIRA')
  .action(cmdWhoami);

program.command('list-projects')
  .description('Tampilkan daftar project JIRA')
  .action(cmdListProjects);

program.command('list-types <projectKey>')
  .description('Tampilkan issue types di sebuah project')
  .action(cmdListTypes);

program.command('create')
  .description('Buat satu tiket secara interaktif')
  .option(...projectOpt)
  .action(cmdCreate);

program.command('template')
  .description('Buat tiket menggunakan template terstruktur (Bug/Story/Task/Epic)')
  .option(...projectOpt)
  .action(cmdTemplate);

program.command('bulk <file>')
  .description('Buat banyak tiket dari file .csv atau .json')
  .option(...projectOpt)
  .option('-o, --output <file>', 'Simpan hasil ke file JSON')
  .action(cmdBulk);

program.parse();
