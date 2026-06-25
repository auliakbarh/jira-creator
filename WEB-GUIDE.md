# 🖥️ Panduan Web UI — JIRA Creator

Cara memakai aplikasi web yang sudah jadi. Fokusnya: buat **UAC** & **breakdown Epic** lewat
**Claude Code (tanpa API berbayar)**, **tinjau & edit** visualisasi tiket, lalu **buat ke JIRA**.

## Menyalakan

Pilih salah satu:

- **Dengan AI otomatis (rekomendasi):** di terminal Claude Code (root project) jalankan
  `/jira-web`. Server menyala di **http://localhost:3939** dan sesi ini memproses job dari UI.
- **Server saja:** `npm run dev --prefix web` → buka **http://localhost:3939** (generate AI
  pakai tombol *Tempel hasil Claude manual*).

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

- **⚡ Generate via Claude Code** → membuat *job*. Bila `/jira-web` aktif, hasilnya muncul
  otomatis dalam beberapa detik. (Layar menampilkan status job.)
- **Tempel hasil Claude manual** → kalau kamu sudah punya output Claude:
  - mode UAC: tempel **dokumen markdown**-nya;
  - mode Epic: tempel **JSON** `{ "epic": {...}, "tasks": [...] }`.

## Langkah 3 — Tinjau & edit (visualisasi)

Sebelum dibuat ke JIRA, tiket divisualisasikan dan **bisa diedit**:

- **UAC:** ubah summary, issue type, priority, label, project key, dan body UAC (markdown).
  Tab **Preview** menampilkan render markdown (heading, tabel EN/ID, link) seperti di JIRA.
- **Epic:** ubah summary/description Epic, dan tiap **child issue** (summary, type Story/Task,
  description). Bisa **tambah** atau **hapus** child.

## Langkah 4 — Buat ke JIRA

Klik **🚀 Buat ke JIRA**:
- Mode UAC → satu tiket dibuat.
- Mode Epic → Epic dibuat dulu, lalu tiap child dibuat dengan `parent` = Epic (tertaut).

Layar **Selesai** menampilkan key + tautan tiap tiket. Child yang gagal ditampilkan dengan
pesan errornya (sisanya tetap dibuat). Klik **Buat tiket lain** untuk mengulang.

## Troubleshooting

| Gejala | Sebab & solusi                                                                                                                                         |
|---|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| Navbar "Belum terhubung" | Kredensial salah/kosong → cek **Konfigurasi**, Uji Koneksi.                                                                                            |
| Job stuck di `pending` | Skill `/jira-web` belum jalan → jalankan di Claude Code, atau pakai paste manual. Atau jalankan `/loop 10s /jira-web`. `stop` untuk menghentikan cron |
| `JIRA 400: priority ...` | Project tak punya field priority → kosongkan/ubah default priority.                                                                                    |
| `JIRA 400: issuetype` | Issue type tak ada di project → samakan nama (cek `list-types`).                                                                                       |
| Markdown tampil mentah di JIRA | Pastikan konstruk didukung `toADF` (heading, bullet, tabel pipa, link, bold).                                                                          |

Detail command CLI: [GUIDE.md](GUIDE.md) · ringkasan command: [COMMANDS.md](COMMANDS.md) ·
deploy: [DEPLOY.md](DEPLOY.md).
