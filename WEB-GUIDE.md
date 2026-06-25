# 🖥️ Panduan Web UI — JIRA Creator

Cara memakai aplikasi web yang sudah jadi. Fokusnya: buat **UAC** & **breakdown Epic** lewat
**Claude Code (tanpa API berbayar)**, **tinjau & edit** visualisasi tiket, lalu **buat ke JIRA**.

## Menyalakan

Pilih salah satu:

- **Dengan AI otomatis (rekomendasi):** di terminal Claude Code (root project) jalankan
  `/jira-web`. Server menyala di **http://localhost:3939** dan sesi ini memproses job dari UI.
- **Server saja:** `npm run dev --prefix web` → buka **http://localhost:3939** (generate AI
  pakai tombol *Tempel hasil Claude manual*).

## Prasyarat auto-trigger Claude (bridge)

Saat klik **⚡ Generate** / **🔄 Trigger ulang Claude**, server menjalankan
`claude -p "/jira-web"` otomatis untuk memproses job — **tanpa perlu buka terminal**. Syaratnya:

1. **Web server jalan lokal** (`npm run dev --prefix web`) di mesin yang sama dengan Claude Code.
   Auto-spawn pakai `child_process`, jadi tidak berfungsi di hosting remote.
2. **CLI `claude` ada di PATH** server (cek: `claude --version`). Kalau tidak, tombol akan
   memberi tahu — jalankan bridge manual: `/jira-web` di Claude Code atau `npm run bridge`.
3. **Sesi Claude Code sudah login** (langganan). Pakai login langganan = **tanpa biaya API**.
4. Spawn pakai `--permission-mode acceptEdits`; tool Write/Bash sudah di-allow lewat frontmatter
   command `/jira-web`, jadi headless tidak minta konfirmasi.

Trigger manual cross-platform (kalau auto-spawn tak tersedia):

- mac/linux: `./bin/jira-web.sh` (`--once` untuk headless sekali jalan)
- windows: `bin\jira-web.cmd` atau `.\bin\jira-web.ps1` (`-Once`)
- npm: `npm run bridge` (interaktif) / `npm run bridge:once` (headless)

## Langkah 0 — Konfigurasi (sekali)

1. Buka menu **Konfigurasi**.
2. Isi `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`. Opsional: project key & default
   issue type/priority.
3. Klik **Simpan & Uji Koneksi** → harus hijau ("Terhubung sebagai …").
   Indikator status juga tampil di pojok kanan navbar.

> Token disimpan di server (`web/.data/config.json`), **tidak** dikirim balik ke browser.

## Langkah 1 — Pilih jenis & isi requirement

Di halaman **Buat Tiket**:

| Mode | Untuk | Hasil |
|---|---|---|
| 📝 **UAC — satu tiket** | Story / Task / Bug / Spike | Satu tiket + UAC gaya Gherkin |
| 🗂️ **Epic — breakdown** | Inisiatif besar | Satu Epic + beberapa child issue tertaut |

Lalu:
- Tempel **requirement** (boleh markdown). Bisa pakai template
  [`templates/requirement-uac.md`](templates/requirement-uac.md) /
  [`templates/requirement-epic.md`](templates/requirement-epic.md).
- Pilih **bahasa prosa** (ID/EN), **project key** (kosong = default), dan untuk UAC pilih
  **issue type**.

## Langkah 2 — Generate

- **⚡ Generate via Claude Code** → membuat *job*, lalu server otomatis menjalankan
  `claude -p "/jira-web"` (lihat **Prasyarat auto-trigger** di atas). Hasil muncul otomatis
  dalam beberapa detik; status job tampil di layar. Tombol **🔄 Trigger ulang Claude** mengantri
  & menjalankan ulang job bila tersangkut/gagal.
- **Tempel hasil Claude manual** → kalau kamu sudah punya output Claude:
  - mode UAC: tempel **dokumen markdown**-nya;
  - mode Epic: tempel **JSON** `{ "epic": {...}, "tasks": [...] }`.

## Langkah 3 — Tinjau & edit (visualisasi)

Sebelum dibuat ke JIRA, tiket divisualisasikan dan **bisa diedit**:

- **UAC:** ubah summary, issue type, priority, project key, dan body UAC (markdown).
  Tab **Preview** menampilkan render markdown (heading, tabel EN/ID, link) seperti di JIRA.
- **Epic:** ubah summary/description Epic, dan tiap **child issue** (summary, type Story/Task,
  description). Bisa **tambah** atau **hapus** child.

## Langkah 4 — Buat ke JIRA

Klik **🚀 Buat ke JIRA**:
- Mode UAC → satu tiket dibuat.
- Mode Epic → Epic dibuat dulu, lalu tiap child dibuat dengan `parent` = Epic (tertaut).

Layar **Selesai** menampilkan key + tautan tiap tiket. Child yang gagal ditampilkan dengan
pesan errornya (sisanya tetap dibuat). Klik **Buat tiket lain** untuk mengulang.

## Riwayat (history)

Menu **Riwayat** menyimpan setiap UAC/breakdown yang digenerate dan tiket yang dibuat
(disimpan server-side di `.data/history/`). Tiap item:

- **♻️ Reproduce** → memuat ulang isi tiket ke halaman Buat Tiket (step tinjau) untuk diedit
  & dibuat lagi. Re-create dicatat sebagai entri riwayat baru.
- **✏️ Edit** → ubah requirement & isi tiket (UAC/Epic) langsung di kartu riwayat, lalu
  **Simpan perubahan** (atau langsung *Reproduce versi ini*).
- **🗑️ Hapus** → menghapus item riwayat itu.

Badge **✓ dibuat** = sudah dipush ke JIRA (dengan tautan key); **draft** = baru digenerate.

## Konfigurasi: clear env & kembali

Di halaman **Konfigurasi**: **🗑️ Clear env** menghapus semua kredensial tersimpan
(`.data/config.json`), dan **← Kembali ke Buat Tiket** membawa balik ke alur pembuatan tiket.

## Troubleshooting

| Gejala | Sebab & solusi                                                                                                                                         |
|---|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| Navbar "Belum terhubung" | Kredensial salah/kosong → cek **Konfigurasi**, Uji Koneksi.                                                                                            |
| Job stuck di `pending` | Auto-spawn gagal (CLI `claude` tak di PATH / server remote / belum login). Jalankan bridge manual: `/jira-web` di Claude Code, `npm run bridge`, atau `./bin/jira-web.sh`. Bisa juga `/loop 10s /jira-web` (`stop` untuk berhenti), atau paste manual. |
| "CLI 'claude' tidak ditemukan" saat trigger | `claude` tidak ada di PATH server → pasang/login Claude Code, atau jalankan bridge manual. |
| `JIRA 400: priority ...` | Project tak punya field priority → kosongkan/ubah default priority.                                                                                    |
| `JIRA 400: issuetype` | Issue type tak ada di project → samakan nama (cek `list-types`).                                                                                       |
| Markdown tampil mentah di JIRA | Pastikan konstruk didukung `toADF` (heading, bullet, tabel pipa, link, bold).                                                                          |

Detail command CLI: [GUIDE.md](GUIDE.md) · ringkasan command: [COMMANDS.md](COMMANDS.md) ·
deploy: [DEPLOY.md](DEPLOY.md).
