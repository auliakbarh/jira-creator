"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const prompts_1 = __importDefault(require("prompts"));
const promises_1 = require("fs/promises");
const jira_client_1 = require("./jira-client");
const file_reader_1 = require("./file-reader");
const templates_1 = require("./templates");
const uac_1 = require("./uac");
// ─── Guard: check required env vars ──────────────────────────────────────────
function checkEnv() {
    const missing = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'].filter(k => !process.env[k]);
    if (missing.length) {
        console.error(chalk_1.default.red(`\n✖ Missing environment variables: ${missing.join(', ')}`));
        console.error(chalk_1.default.gray('  Copy .env.example → .env and fill in your credentials.\n'));
        process.exit(1);
    }
}
// ─── Guard: Gemini env (only the UAC command needs this) ─────────────────────
function checkGeminiEnv() {
    if (!process.env.GEMINI_API_KEY) {
        console.error(chalk_1.default.red('\n✖ Missing environment variable: GEMINI_API_KEY'));
        console.error(chalk_1.default.gray('  Dapatkan API key di: https://aistudio.google.com/app/apikey'));
        console.error(chalk_1.default.gray('  Lalu isi GEMINI_API_KEY di file .env\n'));
        process.exit(1);
    }
}
// ─── Timestamp for output filenames (YYYY-MM-DD-HHmmss) ──────────────────────
function fileTimestamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
// ─── Header ───────────────────────────────────────────────────────────────────
function header() {
    console.log(chalk_1.default.bold.blue('\n╔══════════════════════════════════╗'));
    console.log(chalk_1.default.bold.blue('║   🎫  JIRA Creator  (no AI)      ║'));
    console.log(chalk_1.default.bold.blue('╚══════════════════════════════════╝\n'));
}
// ─── Ticket preview ───────────────────────────────────────────────────────────
function previewTicket(t) {
    console.log('\n' + chalk_1.default.bold('📋 Preview:'));
    console.log(chalk_1.default.cyan('  Summary:     ') + t.summary);
    console.log(chalk_1.default.cyan('  Type:        ') + (t.issuetype ?? 'Task'));
    console.log(chalk_1.default.cyan('  Priority:    ') + (t.priority ?? 'Medium'));
    console.log(chalk_1.default.cyan('  Labels:      ') + (t.labels?.join(', ') || '—'));
    console.log(chalk_1.default.cyan('  Components:  ') + (t.components?.join(', ') || '—'));
    if (t.story_points)
        console.log(chalk_1.default.cyan('  Story pts:   ') + t.story_points);
    console.log();
}
// ─── Command: whoami ──────────────────────────────────────────────────────────
async function cmdWhoami() {
    checkEnv();
    const spinner = (0, ora_1.default)('Connecting to JIRA…').start();
    try {
        const user = await (0, jira_client_1.validateCredentials)();
        spinner.succeed(chalk_1.default.green('Connected!'));
        console.log(chalk_1.default.cyan('  Name:   ') + user.name);
        console.log(chalk_1.default.cyan('  Email:  ') + user.email + '\n');
    }
    catch (err) {
        spinner.fail('Auth failed: ' + err.message);
    }
}
// ─── Command: list-projects ───────────────────────────────────────────────────
async function cmdListProjects() {
    checkEnv();
    const spinner = (0, ora_1.default)('Fetching projects…').start();
    try {
        const projects = await (0, jira_client_1.getProjects)();
        spinner.succeed(`Found ${projects.length} project(s)`);
        projects.forEach(p => console.log(`  ${chalk_1.default.cyan(p.key.padEnd(10))} ${p.name}`));
        console.log();
    }
    catch (err) {
        spinner.fail(err.message);
    }
}
// ─── Command: list-types ──────────────────────────────────────────────────────
async function cmdListTypes(projectKey) {
    checkEnv();
    const spinner = (0, ora_1.default)(`Fetching issue types for ${projectKey}…`).start();
    try {
        const types = await (0, jira_client_1.getIssueTypes)(projectKey);
        spinner.succeed(`Issue types in ${chalk_1.default.bold(projectKey)}:`);
        types.forEach(t => console.log(`  • ${t.name}` + (t.description ? chalk_1.default.gray(` — ${t.description}`) : '')));
        console.log();
    }
    catch (err) {
        spinner.fail(err.message);
    }
}
// ─── Command: create (interactive) ────────────────────────────────────────────
async function cmdCreate(opts) {
    checkEnv();
    header();
    const { summary } = await (0, prompts_1.default)({
        type: 'text', name: 'summary',
        message: 'Summary (judul tiket):',
        validate: v => v.trim().length > 0 || 'Wajib diisi',
    });
    if (!summary)
        return;
    const { description } = await (0, prompts_1.default)({
        type: 'text', name: 'description',
        message: 'Description (opsional, Enter untuk skip):',
    });
    const { issuetype } = await (0, prompts_1.default)({
        type: 'select', name: 'issuetype',
        message: 'Issue type:',
        choices: ['Task', 'Bug', 'Story', 'Epic'].map(v => ({ title: v, value: v })),
    });
    const { priority } = await (0, prompts_1.default)({
        type: 'select', name: 'priority',
        message: 'Priority:',
        choices: ['Highest', 'High', 'Medium', 'Low', 'Lowest'].map(v => ({ title: v, value: v })),
        initial: 2,
    });
    const { labelsRaw } = await (0, prompts_1.default)({
        type: 'text', name: 'labelsRaw',
        message: 'Labels (pisahkan dengan koma, opsional):',
    });
    const projectKey = opts.project ?? process.env.JIRA_PROJECT_KEY ?? 'ENG';
    const ticket = {
        summary,
        description: description || undefined,
        issuetype,
        priority,
        labels: labelsRaw ? labelsRaw.split(',').map((s) => s.trim()) : [],
        projectKey,
    };
    previewTicket(ticket);
    const { confirm } = await (0, prompts_1.default)({
        type: 'confirm', name: 'confirm',
        message: 'Buat tiket ini di JIRA?',
        initial: true,
    });
    if (!confirm) {
        console.log(chalk_1.default.yellow('Dibatalkan.\n'));
        return;
    }
    const spinner = (0, ora_1.default)('Membuat tiket…').start();
    try {
        const result = await (0, jira_client_1.createTicket)(ticket);
        spinner.succeed(chalk_1.default.green(`Tiket berhasil dibuat: ${result.key}`));
        console.log(chalk_1.default.underline.blue(`  ${result.url}\n`));
    }
    catch (err) {
        spinner.fail('Gagal: ' + err.message);
    }
}
// ─── Command: template ────────────────────────────────────────────────────────
async function cmdTemplate(opts) {
    checkEnv();
    header();
    const { tplKey } = await (0, prompts_1.default)({
        type: 'select', name: 'tplKey',
        message: 'Pilih template:',
        choices: Object.entries(templates_1.TEMPLATES).map(([k, v]) => ({ title: v.name, value: k })),
    });
    if (!tplKey)
        return;
    const tpl = templates_1.TEMPLATES[tplKey];
    const answers = {};
    for (const field of tpl.fields) {
        const type = field.textarea ? 'text' : 'text';
        const { value } = await (0, prompts_1.default)({
            type, name: 'value',
            message: field.prompt + (field.placeholder ? chalk_1.default.gray(` (cth: ${field.placeholder.split('\n')[0]})`) : '') + ':',
            validate: v => v.trim().length > 0 || 'Wajib diisi',
        });
        if (value === undefined) {
            console.log(chalk_1.default.yellow('Dibatalkan.\n'));
            return;
        }
        answers[field.key] = value;
    }
    const { priority } = await (0, prompts_1.default)({
        type: 'select', name: 'priority',
        message: 'Priority:',
        choices: ['Highest', 'High', 'Medium', 'Low', 'Lowest'].map(v => ({ title: v, value: v })),
        initial: ['Highest', 'High', 'Medium', 'Low', 'Lowest'].indexOf(tpl.defaultPriority),
    });
    const projectKey = opts.project ?? process.env.JIRA_PROJECT_KEY ?? 'ENG';
    const ticket = { ...(0, templates_1.applyTemplate)(tplKey, answers, { priority }), projectKey };
    previewTicket(ticket);
    const { confirm } = await (0, prompts_1.default)({
        type: 'confirm', name: 'confirm',
        message: 'Buat tiket ini di JIRA?',
        initial: true,
    });
    if (!confirm) {
        console.log(chalk_1.default.yellow('Dibatalkan.\n'));
        return;
    }
    const spinner = (0, ora_1.default)('Membuat tiket…').start();
    try {
        const result = await (0, jira_client_1.createTicket)(ticket);
        spinner.succeed(chalk_1.default.green(`Tiket berhasil dibuat: ${result.key}`));
        console.log(chalk_1.default.underline.blue(`  ${result.url}\n`));
    }
    catch (err) {
        spinner.fail('Gagal: ' + err.message);
    }
}
// ─── Command: bulk ────────────────────────────────────────────────────────────
async function cmdBulk(filePath, opts) {
    checkEnv();
    header();
    console.log(chalk_1.default.gray(`File: ${filePath}\n`));
    let items;
    try {
        items = await (0, file_reader_1.readInputFile)(filePath);
    }
    catch (err) {
        console.error(chalk_1.default.red('Gagal membaca file: ' + err.message));
        return;
    }
    const errors = (0, file_reader_1.validateItems)(items);
    if (errors.length) {
        errors.forEach(e => console.error(chalk_1.default.red('✖ ' + e)));
        return;
    }
    items = (0, file_reader_1.normalizeItems)(items);
    const projectKey = opts.project ?? process.env.JIRA_PROJECT_KEY ?? 'ENG';
    const tickets = items.map(i => ({ ...i, projectKey: i.projectKey ?? projectKey }));
    console.log(chalk_1.default.bold(`📋 Preview ${tickets.length} tiket:`));
    tickets.forEach((t, i) => {
        const type = String(t.issuetype ?? 'Task').padEnd(6);
        const prio = String(t.priority ?? 'Medium').padEnd(7);
        console.log(chalk_1.default.cyan(`  [${i + 1}] `) + `${type} | ${prio} | ${String(t.summary).slice(0, 55)}`);
    });
    console.log();
    const { confirm } = await (0, prompts_1.default)({
        type: 'confirm', name: 'confirm',
        message: `Buat semua ${tickets.length} tiket ke JIRA?`,
        initial: true,
    });
    if (!confirm) {
        console.log(chalk_1.default.yellow('Dibatalkan.\n'));
        return;
    }
    const spinner = (0, ora_1.default)('Membuat tiket…').start();
    const results = await (0, jira_client_1.createTicketsBulk)(tickets);
    spinner.stop();
    const created = results.filter(r => r.status === 'created');
    const failed = results.filter(r => r.status === 'failed');
    created.forEach(r => console.log(chalk_1.default.green(`  ✔ ${r.key}`) + chalk_1.default.gray(` — ${r.input?.slice(0, 50)}`)));
    failed.forEach(r => console.log(chalk_1.default.red(`  ✖ GAGAL`) + chalk_1.default.gray(` — ${r.input?.slice(0, 40)} (${r.error})`)));
    console.log(`\n${chalk_1.default.green(created.length + ' berhasil')}, ${chalk_1.default.red(failed.length + ' gagal')}\n`);
    if (opts.output) {
        await (0, promises_1.writeFile)(opts.output, JSON.stringify(results, null, 2));
        console.log(chalk_1.default.gray(`Hasil disimpan ke: ${opts.output}\n`));
    }
}
// ─── Command: uac (generate User Acceptance Criteria via Gemini) ─────────────
async function cmdUac(textArgs, opts) {
    checkGeminiEnv();
    header();
    // Resolve the requirement input: --file > --text > positional args > prompt.
    let input;
    let source = 'teks';
    try {
        if (opts.file) {
            input = await (0, uac_1.readUACInput)(opts.file);
            source = opts.file;
        }
        else if (opts.text) {
            input = opts.text;
        }
        else if (textArgs.length) {
            input = textArgs.join(' ');
        }
        else {
            const { mode } = await (0, prompts_1.default)({
                type: 'select', name: 'mode',
                message: 'Sumber requirement:',
                choices: [
                    { title: 'Ketik / paste teks', value: 'text' },
                    { title: 'Baca dari file (.md/.txt)', value: 'file' },
                ],
            });
            if (!mode) {
                console.log(chalk_1.default.yellow('Dibatalkan.\n'));
                return;
            }
            if (mode === 'file') {
                const { filePath } = await (0, prompts_1.default)({
                    type: 'text', name: 'filePath',
                    message: 'Path file requirement:',
                    validate: v => v.trim().length > 0 || 'Wajib diisi',
                });
                if (!filePath) {
                    console.log(chalk_1.default.yellow('Dibatalkan.\n'));
                    return;
                }
                input = await (0, uac_1.readUACInput)(filePath);
                source = filePath;
            }
            else {
                const { text } = await (0, prompts_1.default)({
                    type: 'text', name: 'text',
                    message: 'Tuliskan requirement / fitur:',
                    validate: v => v.trim().length > 0 || 'Wajib diisi',
                });
                if (!text) {
                    console.log(chalk_1.default.yellow('Dibatalkan.\n'));
                    return;
                }
                input = text;
            }
        }
    }
    catch (err) {
        console.error(chalk_1.default.red('Gagal membaca input: ' + err.message + '\n'));
        return;
    }
    if (!input || !input.trim()) {
        console.log(chalk_1.default.yellow('Input kosong. Dibatalkan.\n'));
        return;
    }
    const lang = opts.lang ?? 'en';
    const outDir = opts.outDir ?? uac_1.DEFAULT_OUTPUT_DIR;
    console.log(chalk_1.default.gray(`Sumber: ${source}  •  Bahasa: ${lang}  •  Model: ${opts.model ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'}\n`));
    const spinner = (0, ora_1.default)('Membuat UAC dengan Google Gemini…').start();
    try {
        const markdown = await (0, uac_1.generateUAC)({ input, lang, model: opts.model });
        const result = await (0, uac_1.saveUAC)(markdown, outDir, fileTimestamp());
        spinner.succeed(chalk_1.default.green(`UAC berhasil dibuat: ${result.title}`));
        console.log(chalk_1.default.cyan('  File: ') + chalk_1.default.underline(result.filePath) + '\n');
    }
    catch (err) {
        spinner.fail('Gagal: ' + err.message);
    }
}
// ─── CLI setup ────────────────────────────────────────────────────────────────
const projectOpt = ['-p, --project <key>', 'JIRA project key (override .env)'];
commander_1.program
    .name('jira-creator')
    .description('Buat tiket JIRA dari CLI — hanya butuh JIRA API token')
    .version('1.0.0');
commander_1.program.command('whoami')
    .description('Cek koneksi & kredensial JIRA')
    .action(cmdWhoami);
commander_1.program.command('list-projects')
    .description('Tampilkan daftar project JIRA')
    .action(cmdListProjects);
commander_1.program.command('list-types <projectKey>')
    .description('Tampilkan issue types di sebuah project')
    .action(cmdListTypes);
commander_1.program.command('create')
    .description('Buat satu tiket secara interaktif')
    .option(...projectOpt)
    .action(cmdCreate);
commander_1.program.command('template')
    .description('Buat tiket menggunakan template terstruktur (Bug/Story/Task/Epic)')
    .option(...projectOpt)
    .action(cmdTemplate);
commander_1.program.command('bulk <file>')
    .description('Buat banyak tiket dari file .csv atau .json')
    .option(...projectOpt)
    .option('-o, --output <file>', 'Simpan hasil ke file JSON')
    .action(cmdBulk);
commander_1.program.command('uac [text...]')
    .description('Buat User Acceptance Criteria (UAC) dari teks/markdown via Google Gemini')
    .option('-f, --file <path>', 'Baca requirement dari file .md atau .txt')
    .option('-t, --text <text>', 'Requirement sebagai teks langsung')
    .option('-o, --out-dir <dir>', `Folder output markdown (default: ${uac_1.DEFAULT_OUTPUT_DIR})`)
    .option('-m, --model <model>', 'Override model Gemini (default dari GEMINI_MODEL)')
    .option('-l, --lang <lang>', 'Bahasa output: en | id (default: en)')
    .action(cmdUac);
commander_1.program.parse();
