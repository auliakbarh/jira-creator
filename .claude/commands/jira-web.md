---
description: Jalankan web UI JIRA Creator + proses job UAC/epic dari UI di sesi Claude Code ini (tanpa Anthropic API / tanpa biaya API)
argument-hint: (tanpa argumen) — opsional "stop" untuk berhenti
allowed-tools: Read, Write, Bash(npm:*), Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(node:*), Bash(curl:*), Bash(mkdir:*)
---

Kamu adalah **bridge** antara web UI JIRA Creator dan sesi Claude Code ini. Web UI mengirim
"job" (requirement + mode), dan **kamu** yang membuat UAC / breakdown epic-nya **langsung di
sesi ini** — tidak memanggil Anthropic API, jadi tidak ada biaya API.

## Langkah 0 — Nyalakan server (sekali)

1. Jika `web/node_modules` belum ada → jalankan `npm install --prefix web`.
2. Jalankan server di background: `npm run dev --prefix web` (port 3939).
   - Beri tahu user: buka **http://localhost:3939**.
   - Jika port dipakai, server tetap dev — laporkan port aktual dari output.
3. Folder job ada di `web/.data/jobs/`. Buat bila belum ada: `mkdir -p web/.data/jobs`.

## Langkah 1 — Loop pemrosesan job

Ulangi terus (sampai user bilang **stop**):

1. Daftar file job: `ls web/.data/jobs/*.json 2>/dev/null`. Untuk tiap file, baca dengan Read.
2. Proses **hanya** job dengan `"status": "pending"`. Lewati `processing`/`done`/`error`.
3. Jika tidak ada job pending → kabari user singkat ("menunggu job…") dan cek lagi beberapa detik
   kemudian. (Untuk otomatis penuh, user bisa pasangkan dengan `/loop 10s /jira-web`.)

Untuk tiap job pending, **tulis ulang file job itu** (Write, JSON valid) dengan **mempertahankan**
semua field asli (`id`, `mode`, `lang`, `projectKey`, `issuetype`, `requirement`, `createdAt`),
dan **mengubah** `status` + menambah `result` + `updatedAt` (ISO time dari `date -u +%Y-%m-%dT%H:%M:%SZ`).
Bila gagal, set `"status":"error"` + `"error":"<pesan>"`.

### Jika `mode` = `uac`

**Pertama `Read` file `EXAMPLE-JIRA-TICKET-DESCRIPTION-TEMPLATE.md`** dan tiru strukturnya PERSIS
(judul, Description, gaya skenario Gherkin, tabel EN|ID, placeholder image). Lalu buat SATU dokumen
Markdown UAC:

1. Baris pertama = judul: `# [feature][sub] short description` (sub opsional).
2. `## Description` — bullet: `Overview:` (1–2 kalimat) + `Figma:`, `PRD / Confluence:`, `Postman:`,
   `API contract & path:`. Isi `TBD` kecuali requirement memberi nilai nyata (jangan mengarang URL).
3. `## User Acceptance Criteria (UAC)` — satu blok per skenario:
   - Heading `# N. JUDUL SKENARIO HURUF BESAR` (N mulai 1).
   - Klausa Gherkin keyword HURUF BESAR INGGRIS (`GIVEN/AND/WHEN/THEN`). **Tulis tiap kelompok
     klausa MENYATU dalam satu blok — TANPA baris kosong antar klausa** (GIVEN→AND→WHEN→THEN→AND
     berurutan, satu baris masing-masing). Akhiri tiap klausa dengan koma, klausa terakhir titik.
     (Single newline antar klausa di-render jadi line break oleh `toADF`.)
   - **Baris kosong HANYA**: antara heading dan blok, sebelum & sesudah tabel `| EN | ID |`, dan
     sebelum `[image-...]`. Kalau ada kelompok WHEN/THEN baru setelah tabel, itu jadi blok terpisah
     (dipisah baris kosong). JANGAN sisipkan baris kosong di tengah satu kelompok GIVEN→WHEN→THEN.
   - **WAJIB tabel `| EN | ID |`** untuk SETIAP teks/label/pesan UI yang muncul (tombol, judul, copy,
     error message) — satu baris tabel per string. Tutup skenario UI dengan
     `[image-or-design-ui-from-figma](https://example-image.com)`.
   - Cakup: happy path, alur alternatif, permission/auth, loading, error, edge case.
4. Tulis prosa dalam bahasa sesuai field `lang` (`id` = Bahasa Indonesia, `en` = English). Keyword
   Gherkin tetap huruf besar Inggris.

Lalu set `result`. **`ticket.description` HARUS = seluruh isi UAC LENGKAP** (blok `## Description`
+ blok `## User Acceptance Criteria (UAC)` dengan SEMUA skenario Gherkin, tabel `| EN | ID |`, dan
placeholder image) — yaitu `markdown` persis dikurangi baris judul `# ...` pertama. JANGAN diringkas,
JANGAN cuma overview; harus identik dengan body markdown.
```json
{
  "markdown": "<seluruh dokumen markdown (judul + body)>",
  "ticket": {
    "summary": "<teks baris judul tanpa '# '>",
    "description": "<markdown LENGKAP setelah baris judul = blok ## Description + seluruh ## UAC>",
    "issuetype": "<field issuetype job, default Story>",
    "projectKey": "<field projectKey job bila ada, selain itu kosongkan>"
  }
}
```

### Jika `mode` = `epic`

**Pertama `Read` file `EXAMPLE-JIRA-TICKET-DESCRIPTION-TEMPLATE.md`** dan tiru strukturnya.
Pecah requirement jadi Epic + 4–8 child issue.

**SETIAP `description` (epic DAN tiap child) HARUS mengikuti template UAC penuh** — sama persis
aturan UAC di atas (lihat bagian `mode = uac`): blok `## Description` (Overview + `Figma:` /
`PRD / Confluence:` / `Postman:` / `API contract & path:`, default `TBD`) + blok
`## User Acceptance Criteria (UAC)` dengan skenario `# N. JUDUL` HURUF BESAR, klausa Gherkin
`GIVEN/AND/WHEN/THEN` menyatu satu blok (tanpa baris kosong di tengah kelompok), tabel `| EN | ID |`
WAJIB untuk tiap teks UI, dan placeholder `[image-or-design-ui-from-figma](https://example-image.com)`.
- Epic: UAC level tinggi / lintas-fitur (acceptance keseluruhan epic).
- Tiap child: UAC spesifik untuk kapabilitas child itu — cakup happy path, alur alternatif,
  permission/auth, loading, error, edge case.

Set `result` (TANPA baris judul `# ...` di dalam `description` — judul ada di `summary`):
```json
{
  "epic": { "summary": "[Feature] judul ringkas", "description": "<UAC penuh: ## Description + ## UAC>" },
  "tasks": [
    { "summary": "imperatif & spesifik", "description": "<UAC penuh: ## Description + ## UAC>", "issuetype": "Story" }
  ]
}
```
Aturan: `issuetype` tiap task hanya `"Story"` (kapabilitas user-facing) atau `"Task"` (teknis/enabling).
Child saling independen, non-overlapping, urut logis (fondasi dulu). Jangan mengarang URL/nama produk.
Tulis prosa dalam bahasa sesuai `lang`; keyword Gherkin tetap huruf besar Inggris.

## Setelah memproses

Kabari user singkat per job (`<id>` → done/error + judul). Lalu kembali ke Langkah 1. Web UI akan
men-poll file ini dan otomatis menampilkan hasilnya untuk ditinjau & diedit user sebelum dibuat ke JIRA.

Jika `$ARGUMENTS` = `stop` → hentikan loop dan beri tahu user cara menyalakan lagi (`/jira-web`).
