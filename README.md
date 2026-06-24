# 🎫 JIRA Creator

Buat tiket JIRA dari CLI — **gratis, tanpa AI, hanya butuh JIRA API token**.

> 📖 Butuh panduan lengkap setiap command beserta fungsi & flag-nya? Lihat **[GUIDE.md](GUIDE.md)**.

---

## ✅ Prerequisite

| Kebutuhan | Keterangan |
|---|---|
| Node.js | v18+ |
| JIRA Cloud | Akun dengan akses ke project |
| JIRA API Token | [Buat di sini](https://id.atlassian.com/manage-profile/security/api-tokens) |

> Tidak perlu Anthropic API key, tidak perlu billing tambahan.

---

## 🚀 Setup

```bash
# 1. Install dependencies
npm install

# 2. Salin file konfigurasi
cp .env.example .env
```

Edit `.env`:
```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=kamu@perusahaan.com
JIRA_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx
JIRA_PROJECT_KEY=ENG

# Opsional — hanya untuk command `uac`
GEMINI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL=gemini-2.5-flash
```

**Cara dapat API token JIRA:**
1. Buka https://id.atlassian.com/manage-profile/security/api-tokens
2. Klik **Create API token**
3. Beri nama (misal: "jira-creator")
4. Salin token → paste ke `.env`

---

## 🎮 Perintah CLI

> Penjelasan detail tiap command (argumen, semua flag, contoh, troubleshooting) ada di **[GUIDE.md](GUIDE.md)**.

### Cek koneksi
```bash
npx ts-node src/index.ts whoami
```

### Lihat daftar project
```bash
npx ts-node src/index.ts list-projects
```

### Lihat issue types di sebuah project
```bash
npx ts-node src/index.ts list-types ENG
```

### Buat 1 tiket (interaktif)
```bash
npx ts-node src/index.ts create
npx ts-node src/index.ts create --project DEV
```

### Buat tiket dari template
```bash
npx ts-node src/index.ts template
```
Pilih template: **Bug Report**, **User Story**, **Technical Task**, atau **Epic**.

### Bulk create dari file
```bash
# Dari CSV
npx ts-node src/index.ts bulk input/sample.csv

# Dari JSON
npx ts-node src/index.ts bulk input/sample.json

# Dengan project berbeda + simpan hasil
npx ts-node src/index.ts bulk input/sample.csv --project DEV --output output/results.json
```

### Buat UAC (User Acceptance Criteria) dengan Google Gemini

Menghasilkan deskripsi tiket JIRA berisi UAC dari requirement berupa **teks** atau
**file markdown**. Output mengikuti template `claude-planning/JIRA-TICKET-DESCRIPTION-TEMPLATE.md`:
judul `[feature][sub] short description`, blok Description (link Figma/PRD/Postman/API), dan
skenario UAC bernomor dalam format Gherkin GIVEN/WHEN/THEN (huruf besar), lengkap dengan
tabel copy `| EN | ID |` dan placeholder gambar Figma.

Setiap run menghasilkan **dua file** di `output-uac/` (basename sama):

- `<slug>-<timestamp>.md` — UAC dalam markdown.
- `<slug>-<timestamp>.json` — **template tiket JIRA** (`summary` = judul, `description` =
  isi UAC, `issuetype`, `projectKey`, `labels: ["uac"]`). File ini langsung bisa dipakai
  oleh command `bulk` untuk membuat tiket.

Saat run, kamu akan ditanya **issue type** (Story/Task/Bug/Epic) untuk dimasukkan ke
template (atau lewati prompt dengan flag `--type`).

```bash
# Dari file markdown / teks
npx ts-node src/index.ts uac --file input/sample-feature.md

# Dari teks langsung
npx ts-node src/index.ts uac --text "Pengguna bisa login dengan Google OAuth2"

# Atau teks sebagai argumen
npx ts-node src/index.ts uac "Fitur reset password via email"

# Tanpa argumen → mode interaktif (paste teks / pilih file)
npx ts-node src/index.ts uac

# Skip prompt issue type + bahasa Indonesia + project & model kustom
npx ts-node src/index.ts uac -f input/sample-feature.md --type Story -l id -p DEV -m gemini-2.5-pro

# Lalu buat tiketnya dari template JSON yang dihasilkan:
npx ts-node src/index.ts bulk output-uac/<slug>-<timestamp>.json
```

> Butuh `GEMINI_API_KEY` di `.env`. Dapatkan di
> <https://aistudio.google.com/app/apikey>. Command `uac` sendiri **tidak** membutuhkan
> kredensial JIRA dan **tidak** membuat tiket — ia menghasilkan file markdown + template
> JSON. Pembuatan tiket dilakukan terpisah lewat `bulk` (butuh kredensial JIRA).
>
> Heading, tabel `| EN | ID |`, link, dan bullet di `description` akan ter-render dengan
> benar di JIRA — `toADF` mengonversi markdown tersebut ke Atlassian Document Format.

### Buat Epic + breakdown task otomatis (Google Gemini)

Dari satu deskripsi epic, Gemini memecahnya menjadi beberapa child task, lalu command
membuat **Epic + semua task-nya sekaligus** di JIRA (tiap task ditautkan ke epic via field
`parent`).

```bash
# Dari teks langsung
npx ts-node src/index.ts epic --text "Membangun fitur wishlist: simpan produk favorit, lihat daftar, hapus item, pindah ke keranjang"

# Dari file
npx ts-node src/index.ts epic --file input/epic.md --project DEV

# Preview & simpan rencana TANPA membuat tiket (tidak butuh kredensial JIRA)
npx ts-node src/index.ts epic -t "..." --dry-run
```

Alur: generate breakdown → preview epic + daftar task → simpan rencana ke
`output-uac/epic-<slug>-<timestamp>.json` → (kecuali `--dry-run`) konfirmasi → buat epic →
buat semua task tertaut ke epic. Butuh `GEMINI_API_KEY` **dan** kredensial JIRA (kecuali
`--dry-run` yang hanya butuh Gemini).

> Penautan epic memakai field `parent`. Pada sebagian project company-managed lama, relasi
> epic–task mungkin perlu "Epic Link" custom field — jika semua task gagal di field
> `parent`, cek tipe project JIRA-mu.

---

## 📁 Format File Input

### CSV
```csv
summary,description,issuetype,priority,labels,components
Login crash pada iOS,User tidak bisa login...,Bug,High,bug|ios,auth
Tambah dark mode,Toggle dark mode di settings,Story,Medium,feature,frontend
```

- **Wajib:** kolom `summary`
- **Labels & components:** pisahkan dengan `|` (pipe)
- **Field opsional:** `issuetype`, `priority`, `labels`, `components`, `story_points`

### JSON
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

---

## 🏗 Build untuk production

```bash
npm run build
node dist/index.js whoami
```

---

## 📌 Flag yang tersedia

| Flag | Perintah | Keterangan |
|---|---|---|
| `-p, --project <key>` | create, template, bulk | Override project key dari .env |
| `-o, --output <file>` | bulk | Simpan hasil ke file JSON |
| `-f, --file <path>` | uac | Baca requirement dari file `.md`/`.txt` |
| `-t, --text <text>` | uac | Requirement sebagai teks langsung |
| `-o, --out-dir <dir>` | uac | Folder output `.md` + `.json` (default `output-uac`) |
| `-l, --lang <en\|id>` | uac | Bahasa output UAC (default `en`) |
| `-m, --model <model>` | uac | Override model Gemini |
| `-p, --project <key>` | uac | Project key untuk template tiket (override .env) |
| `--type <type>` | uac | Issue type template tiket (skip prompt): Story\|Task\|Bug\|Epic |
| `-f, --file <path>` | epic | Baca deskripsi epic dari file `.md`/`.txt` |
| `-t, --text <text>` | epic | Deskripsi epic sebagai teks langsung |
| `-o, --out-dir <dir>` | epic | Folder simpan rencana breakdown JSON (default `output-uac`) |
| `-l, --lang <en\|id>` | epic | Bahasa output (default `en`) |
| `-m, --model <model>` | epic | Override model Gemini |
| `-p, --project <key>` | epic | Project key (override .env) |
| `--dry-run` | epic | Hanya generate & simpan rencana; tidak membuat tiket |
