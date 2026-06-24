import 'dotenv/config';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { writeFile } from 'fs/promises';

import { createTicket, createTicketsBulk, getProjects, getIssueTypes, validateCredentials } from './jira-client';
import { readInputFile, validateItems, normalizeItems } from './file-reader';
import { TEMPLATES, applyTemplate } from './templates';
import { generateUAC, saveUAC, readUACInput, buildTicketTemplate, saveTicketTemplate, DEFAULT_OUTPUT_DIR } from './uac';
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

// ─── Guard: Gemini env (only the UAC command needs this) ─────────────────────
function checkGeminiEnv() {
  if (!process.env.GEMINI_API_KEY) {
    console.error(chalk.red('\n✖ Missing environment variable: GEMINI_API_KEY'));
    console.error(chalk.gray('  Dapatkan API key di: https://aistudio.google.com/app/apikey'));
    console.error(chalk.gray('  Lalu isi GEMINI_API_KEY di file .env\n'));
    process.exit(1);
  }
}

// ─── Timestamp for output filenames (YYYY-MM-DD-HHmmss) ──────────────────────
function fileTimestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
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

// ─── Command: uac (generate User Acceptance Criteria via Gemini) ─────────────
async function cmdUac(
  textArgs: string[],
  opts: { file?: string; text?: string; outDir?: string; model?: string; lang?: string; project?: string; type?: string }
) {
  checkGeminiEnv();
  header();

  // Resolve the requirement input: --file > --text > positional args > prompt.
  let input: string | undefined;
  let source = 'teks';

  try {
    if (opts.file) {
      input = await readUACInput(opts.file);
      source = opts.file;
    } else if (opts.text) {
      input = opts.text;
    } else if (textArgs.length) {
      input = textArgs.join(' ');
    } else {
      const { mode } = await prompts({
        type: 'select', name: 'mode',
        message: 'Sumber requirement:',
        choices: [
          { title: 'Ketik / paste teks',        value: 'text' },
          { title: 'Baca dari file (.md/.txt)',  value: 'file' },
        ],
      });
      if (!mode) { console.log(chalk.yellow('Dibatalkan.\n')); return; }

      if (mode === 'file') {
        const { filePath } = await prompts({
          type: 'text', name: 'filePath',
          message: 'Path file requirement:',
          validate: v => v.trim().length > 0 || 'Wajib diisi',
        });
        if (!filePath) { console.log(chalk.yellow('Dibatalkan.\n')); return; }
        input = await readUACInput(filePath);
        source = filePath;
      } else {
        const { text } = await prompts({
          type: 'text', name: 'text',
          message: 'Tuliskan requirement / fitur:',
          validate: v => v.trim().length > 0 || 'Wajib diisi',
        });
        if (!text) { console.log(chalk.yellow('Dibatalkan.\n')); return; }
        input = text;
      }
    }
  } catch (err) {
    console.error(chalk.red('Gagal membaca input: ' + (err as Error).message + '\n'));
    return;
  }

  if (!input || !input.trim()) { console.log(chalk.yellow('Input kosong. Dibatalkan.\n')); return; }

  const lang   = opts.lang ?? 'en';
  const outDir = opts.outDir ?? DEFAULT_OUTPUT_DIR;
  console.log(chalk.gray(`Sumber: ${source}  •  Bahasa: ${lang}  •  Model: ${opts.model ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'}\n`));

  const spinner = ora('Membuat UAC dengan Google Gemini…').start();
  let markdown: string;
  let mdPath: string;
  let title: string;
  try {
    markdown   = await generateUAC({ input, lang, model: opts.model });
    const result = await saveUAC(markdown, outDir, fileTimestamp());
    mdPath = result.filePath;
    title  = result.title;
    spinner.succeed(chalk.green(`UAC berhasil dibuat: ${title}`));
    console.log(chalk.cyan('  Markdown: ') + chalk.underline(mdPath));
  } catch (err) {
    spinner.fail('Gagal: ' + (err as Error).message);
    return;
  }

  // ── Build a bulk-compatible JIRA ticket template (JSON) ──
  let issuetype = opts.type ?? '';
  if (!issuetype) {
    const r = await prompts({
      type: 'select', name: 'issuetype',
      message: 'Issue type untuk template tiket JIRA:',
      choices: ['Story', 'Task', 'Bug', 'Epic'].map(v => ({ title: v, value: v })),
    });
    issuetype = r.issuetype ?? 'Story'; // default if the prompt is skipped/cancelled
  }

  const projectKey = opts.project ?? process.env.JIRA_PROJECT_KEY ?? 'ENG';
  const ticket     = buildTicketTemplate(markdown, { issuetype, projectKey });

  try {
    const jsonPath = await saveTicketTemplate(ticket, mdPath);
    console.log(chalk.cyan('  Template: ') + chalk.underline(jsonPath) +
      chalk.gray(`  (issuetype: ${issuetype}, project: ${projectKey})`));
    console.log(chalk.gray('\n  Buat tiket dari template ini:'));
    console.log('  ' + chalk.bold(`npx ts-node src/index.ts bulk ${jsonPath}`) + '\n');
  } catch (err) {
    console.error(chalk.red('  Gagal menyimpan template JSON: ' + (err as Error).message + '\n'));
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

program.command('uac [text...]')
  .description('Buat User Acceptance Criteria (UAC) dari teks/markdown via Google Gemini')
  .option('-f, --file <path>', 'Baca requirement dari file .md atau .txt')
  .option('-t, --text <text>', 'Requirement sebagai teks langsung')
  .option('-o, --out-dir <dir>', `Folder output markdown + template JSON (default: ${DEFAULT_OUTPUT_DIR})`)
  .option('-m, --model <model>', 'Override model Gemini (default dari GEMINI_MODEL)')
  .option('-l, --lang <lang>', 'Bahasa output: en | id (default: en)')
  .option('-p, --project <key>', 'JIRA project key untuk template tiket (override .env)')
  .option('--type <type>', 'Issue type untuk template tiket (skip prompt): Story|Task|Bug|Epic')
  .action(cmdUac);

program.parse();
