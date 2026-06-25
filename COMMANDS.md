# 🧾 Rangkuman Command — JIRA Creator

Semua cara menggunakan project: CLI, npm script, skill Claude Code, dan web UI.
Penjelasan lengkap tiap command CLI ada di **[GUIDE.md](GUIDE.md)**; cara pakai web UI di
**[WEB-GUIDE.md](WEB-GUIDE.md)**.

## 1. CLI (`src/index.ts`)

Jalankan dengan `npx ts-node src/index.ts <command>` (dev) atau `node dist/index.js <command>`
(setelah `npm run build`).

| Command | Fungsi | Butuh JIRA | Butuh AI key |
|---|---|:--:|:--:|
| `whoami` | Verifikasi kredensial (`GET /myself`) | ✅ | — |
| `list-projects` | Daftar project yang terlihat | ✅ | — |
| `list-types <projectKey>` | Daftar issue type sebuah project | ✅ | — |
| `create [-p KEY]` | Buat satu tiket via prompt interaktif | ✅ | — |
| `template [-p KEY]` | Flow template terstruktur (bug/story/task/epic) | ✅ | — |
| `bulk <file> [-p KEY] [-o out.json]` | Buat banyak tiket dari `.csv`/`.json`/`.txt` | ✅ | — |
| `uac [text] [-f file] [-o dir] [-l en\|id] [--provider ..] [-m model] [-p KEY] [--type T]` | Generate UAC → `output-uac/<slug>.md` + `.json` siap-`bulk` | — | ✅ |
| `epic [text] [-f file] [-l en\|id] [--provider ..] [-p KEY] [-m model] [-o dir] [--dry-run]` | Buat Epic + breakdown child task (tertaut ke epic) | ✅¹ | ✅ |

¹ `epic` butuh kredensial JIRA hanya saat benar-benar membuat tiket (tidak dengan `--dry-run`).

**Flag umum:** `-p/--project` project key · `-f/--file` file input · `-o/--output` output ·
`-l/--lang` bahasa prosa (`en`/`id`) · `--provider gemini|claude` · `-m/--model` override model.

**Resolusi project key** (semua command): `--project` → env `JIRA_PROJECT_KEY` → fallback `ENG`.

## 2. npm script (shortcut)

```bash
npm install            # install dependency
npm run build          # compile src/ → dist/ (typecheck tsc strict)
npm run dev            # ts-node src/index.ts
npm run create         # = ts-node src/index.ts create
npm run bulk           # = ts-node src/index.ts bulk
npm run template       # = ts-node src/index.ts template
npm run uac            # = ts-node src/index.ts uac
npm run epic           # = ts-node src/index.ts epic
npm run list-projects  # = ts-node src/index.ts list-projects
npm run list-types     # = ts-node src/index.ts list-types
```

## 3. Skill Claude Code

| Skill | Fungsi |
|---|---|
| `/uac <file.md \| teks>` | Buat UAC (markdown + JSON siap-`bulk`) **di sesi Claude Code** — tanpa Anthropic API, tanpa biaya API. |
| `/jira-web` | Nyalakan web UI **dan** proses job UAC/epic dari UI di sesi ini (tanpa biaya API). |

## 4. Web UI (`web/`)

```bash
npm install --prefix web     # sekali
npm run dev --prefix web     # http://localhost:3939
```

Atau cukup jalankan skill `/jira-web` di Claude Code — skill ini yang menyalakan server
sekaligus memproses job AI di sesi. Detail: **[WEB-GUIDE.md](WEB-GUIDE.md)**. Deploy:
**[DEPLOY.md](DEPLOY.md)**.

## Pemetaan jenis tiket (lihat `claude-planning/plan.md`)

- **Epic** → wadah; pakai mode `epic` (CLI/web) untuk pecah jadi child.
- **Story / Task / Bug / Spike** → level 0; pakai mode `uac` (satu tiket).
- **Sub-task** → wajib punya parent; di project ini child di-link ke Epic via field `parent`.
