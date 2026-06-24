# 📖 Panduan Penggunaan — JIRA Creator

Panduan lengkap setiap command CLI, fungsinya, flag-nya, dan contoh penggunaan.

`jira-creator` punya dua kelompok command:

1. **Pembuatan tiket JIRA** — `whoami`, `list-projects`, `list-types`, `create`, `template`, `bulk`. Hanya butuh **JIRA API token** (tanpa AI).
2. **Generate UAC** — `uac`. Memakai **Google Gemini API** untuk membuat User Acceptance Criteria; hanya butuh `GEMINI_API_KEY`.

---

## ⚙️ Persiapan

```bash
npm install           # install dependencies
cp .env.example .env  # salin konfigurasi, lalu isi kredensialnya
```

### Variabel `.env`

| Variabel | Wajib | Untuk | Keterangan |
|---|---|---|---|
| `JIRA_BASE_URL` | ✅ | command JIRA | mis. `https://your-domain.atlassian.net` |
| `JIRA_EMAIL` | ✅ | command JIRA | email akun Atlassian |
| `JIRA_API_TOKEN` | ✅ | command JIRA | [buat token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_PROJECT_KEY` | — | default | project key default (mis. `ENG`) |
| `JIRA_DEFAULT_ISSUE_TYPE` | — | default | issue type default (mis. `Task`) |
| `JIRA_DEFAULT_PRIORITY` | — | default | priority default (mis. `Medium`) |
| `GEMINI_API_KEY` | ✅* | command `uac` | [buat di Google AI Studio](https://aistudio.google.com/app/apikey) |
| `GEMINI_MODEL` | — | command `uac` | default `gemini-2.5-flash` |

> \* `GEMINI_API_KEY` hanya wajib untuk command `uac`. Command JIRA tidak membutuhkannya, dan command `uac` tidak membutuhkan kredensial JIRA.

### Cara menjalankan

```bash
# Mode dev (ts-node, tanpa build)
npx ts-node src/index.ts <command> [args] [flags]

# Mode production (setelah build)
npm run build
node dist/index.js <command> [args] [flags]
```

**Resolusi project key** konsisten di semua command: flag `--project` → env `JIRA_PROJECT_KEY` → fallback `ENG`.

---

## 🩺 `whoami` — Cek koneksi & kredensial

Memverifikasi `.env` dengan memanggil `GET /myself`. Pakai ini dulu untuk memastikan kredensial benar.

```bash
npx ts-node src/index.ts whoami
```

**Output:** nama & email akun bila berhasil; pesan error bila gagal autentikasi.

---

## 📂 `list-projects` — Daftar project

Menampilkan semua project JIRA yang bisa kamu akses (key + nama).

```bash
npx ts-node src/index.ts list-projects
```

Gunakan untuk menemukan **project key** yang dipakai di command lain.

---

## 🏷️ `list-types <projectKey>` — Daftar issue type

Menampilkan issue type yang tersedia pada sebuah project (Task, Bug, Story, Epic, dst.).

```bash
npx ts-node src/index.ts list-types ENG
```

| Argumen | Wajib | Keterangan |
|---|---|---|
| `<projectKey>` | ✅ | project key yang mau diperiksa |

Berguna untuk memastikan nama issue type valid sebelum membuat tiket.

---

## ✍️ `create` — Buat satu tiket (interaktif)

Tanya-jawab interaktif untuk membuat **satu** tiket: summary, description, issue type, priority, labels. Menampilkan preview lalu minta konfirmasi sebelum membuat.

```bash
npx ts-node src/index.ts create
npx ts-node src/index.ts create --project DEV
```

| Flag | Keterangan |
|---|---|
| `-p, --project <key>` | override project key dari `.env` |

---

## 🧩 `template` — Buat tiket dari template terstruktur

Memandu pengisian field sesuai template, lalu menyusun summary & description yang rapi dan konsisten. Tersedia 4 template:

| Template | Issue type | Field yang ditanyakan |
|---|---|---|
| **Bug Report** | Bug | langkah reproduksi, expected, actual, environment |
| **User Story** | Story | role, goal, benefit, acceptance criteria |
| **Technical Task** | Task | deskripsi pekerjaan, Definition of Done |
| **Epic** | Epic | objective, in/out scope, success metric/KPI |

```bash
npx ts-node src/index.ts template
npx ts-node src/index.ts template --project DEV
```

| Flag | Keterangan |
|---|---|
| `-p, --project <key>` | override project key dari `.env` |

Description ditulis dengan format markdown (`**bold**`, dll.) yang otomatis dikonversi ke ADF saat dikirim ke JIRA.

---

## 📦 `bulk <file>` — Buat banyak tiket dari file

Membaca banyak tiket dari file `.csv`, `.json`, atau `.txt`, menampilkan preview semua tiket, lalu membuat semuanya sekaligus. Tidak gagal-total bila satu tiket error — hasilnya dilaporkan per-tiket (berhasil/gagal).

```bash
# Dari CSV / JSON / TXT
npx ts-node src/index.ts bulk input/sample.csv
npx ts-node src/index.ts bulk input/sample.json

# Project berbeda + simpan hasil ke file
npx ts-node src/index.ts bulk input/sample.csv --project DEV --output output/results.json
```

| Argumen / Flag | Keterangan |
|---|---|
| `<file>` | file input `.csv` / `.json` / `.txt` (wajib) |
| `-p, --project <key>` | override project key dari `.env` |
| `-o, --output <file>` | simpan hasil pembuatan (per-tiket) ke file JSON |

### Format file input

**CSV** — kolom `summary` wajib; `labels` & `components` dipisah `|` (pipe):

```csv
summary,description,issuetype,priority,labels,components
Login crash di iOS,User tidak bisa login...,Bug,High,bug|ios,auth
Tambah dark mode,Toggle dark mode di settings,Story,Medium,feature,frontend
```

**JSON** — array objek tiket (atau objek tunggal, atau `{ "tickets": [...] }`):

```json
[
  {
    "summary": "Implementasi OAuth2 Google",
    "issuetype": "Story",
    "priority": "High",
    "labels": ["feature", "auth"],
    "components": ["backend"]
  }
]
```

**TXT** — baris pertama jadi summary, seluruh isi jadi description.

> Field opsional: `issuetype`, `priority`, `labels`, `components`, `story_points`, `projectKey`. Bila `summary` kosong tapi ada `description`, summary diturunkan dari kalimat pertama description.

---

## 🤖 `uac [text...]` — Generate User Acceptance Criteria (Google Gemini)

Membuat **deskripsi tiket JIRA berisi UAC** dari requirement (teks atau file markdown) memakai Google Gemini. Setiap run menghasilkan **dua file** di `output-uac/` dengan basename sama:

- `<slug>-<timestamp>.md` — UAC dalam markdown.
- `<slug>-<timestamp>.json` — **template tiket JIRA** siap dipakai command `bulk`.

Output markdown mengikuti template `claude-planning/JIRA-TICKET-DESCRIPTION-TEMPLATE.md`:

- Judul: `# [feature][sub] short description`
- Blok `## Description` (link Figma / PRD / Postman / API — default `TBD`)
- `## User Acceptance Criteria (UAC)` berisi skenario bernomor `# N. JUDUL` dalam format Gherkin **GIVEN / AND / WHEN / THEN** (keyword huruf besar, tiap blok di baris baru), lengkap dengan tabel copy `| EN | ID |` dan placeholder gambar Figma.

Saat run, kamu akan ditanya **issue type** untuk template tiket (kecuali pakai `--type`).

### Sumber input (urutan prioritas)

`--file` → `--text` → argumen posisi `[text...]` → prompt interaktif.

```bash
# Dari file markdown / teks
npx ts-node src/index.ts uac --file input/sample-feature.md

# Dari teks langsung
npx ts-node src/index.ts uac --text "Pengguna bisa login dengan Google OAuth2"

# Teks sebagai argumen posisi
npx ts-node src/index.ts uac "Fitur reset password via email"

# Tanpa argumen → mode interaktif (paste teks / pilih file)
npx ts-node src/index.ts uac

# Skip prompt issue type + bahasa Indonesia + project & model kustom
npx ts-node src/index.ts uac -f input/sample-feature.md --type Story -l id -p DEV -m gemini-2.5-pro
```

| Argumen / Flag | Keterangan |
|---|---|
| `[text...]` | requirement sebagai argumen posisi (opsional) |
| `-f, --file <path>` | baca requirement dari file `.md` / `.txt` |
| `-t, --text <text>` | requirement sebagai teks langsung |
| `-o, --out-dir <dir>` | folder output `.md` + `.json` (default `output-uac`) |
| `-l, --lang <en\|id>` | bahasa output UAC (default `en`) |
| `-m, --model <model>` | override model Gemini (default dari `GEMINI_MODEL`) |
| `-p, --project <key>` | project key untuk template tiket |
| `--type <type>` | issue type template (skip prompt): `Story` / `Task` / `Bug` / `Epic` |

> Catatan: kalau Gemini sempat membalas `503` (model sedang sibuk), client otomatis retry beberapa kali dengan backoff. Bila tetap gagal, coba lagi atau pakai model lain via `-m`.

---

## 🔗 Alur lengkap: dari requirement → tiket JIRA

Gabungkan `uac` (Gemini) dengan `bulk` (JIRA) untuk membuat tiket berisi UAC:

```bash
# 1. Generate UAC + template tiket dari requirement
npx ts-node src/index.ts uac -f input/feature.md --type Story
#    → output-uac/<slug>.md   (untuk review/dokumentasi)
#    → output-uac/<slug>.json (template tiket)

# 2. Buat tiketnya di JIRA dari template JSON
npx ts-node src/index.ts bulk output-uac/<slug>.json
```

Heading, tabel `| EN | ID |`, link, dan bullet di description akan **ter-render dengan benar** di JIRA — `toADF` mengonversi markdown ke Atlassian Document Format (ADF).

---

## 🧰 Ringkasan semua command

| Command | Fungsi | Butuh JIRA | Butuh Gemini |
|---|---|:---:|:---:|
| `whoami` | Cek koneksi & kredensial | ✅ | — |
| `list-projects` | Daftar project | ✅ | — |
| `list-types <key>` | Daftar issue type sebuah project | ✅ | — |
| `create` | Buat 1 tiket interaktif | ✅ | — |
| `template` | Buat tiket dari template terstruktur | ✅ | — |
| `bulk <file>` | Buat banyak tiket dari file | ✅ | — |
| `uac [text]` | Generate UAC → `.md` + template `.json` | — | ✅ |

### Shortcut npm script

Tersedia di `package.json` (untuk `whoami` jalankan langsung via `npx ts-node`):

```bash
npm run create
npm run template
npm run uac
npm run bulk -- input/sample.csv
npm run list-projects
npm run list-types -- ENG
```

---

## ❓ Troubleshooting

| Masalah | Solusi |
|---|---|
| `Missing environment variables: ...` | Salin `.env.example` → `.env`, isi `JIRA_BASE_URL`/`JIRA_EMAIL`/`JIRA_API_TOKEN`. |
| `Missing environment variable: GEMINI_API_KEY` | Isi `GEMINI_API_KEY` di `.env` untuk command `uac`. |
| `JIRA 401 / 403` | Token salah/kedaluwarsa, atau tidak punya akses ke project. |
| `JIRA 400: ... issuetype` | Issue type tidak ada di project — cek dengan `list-types <key>`. |
| `Gemini 503` berulang | Model sedang sibuk; sudah ada retry otomatis, coba lagi atau ganti model via `-m`. |
| Build error | Jalankan `npm run build` — `tsc` (strict) adalah satu-satunya static check. |
