---
description: Buat UAC tiket JIRA (markdown + template JSON siap-bulk) dari requirement, memakai sesi Claude Code ini (tanpa Anthropic API / tanpa biaya API)
argument-hint: <path file .md/.txt | atau teks requirement>
allowed-tools: Read, Write, Bash(date:*)
---

Kamu sedang membuat **User Acceptance Criteria (UAC)** untuk sebuah tiket JIRA, langsung di
sesi Claude Code ini — **tidak** memanggil Anthropic API, jadi tidak ada biaya API.

## Input

Requirement diberikan di: `$ARGUMENTS`

- Jika `$ARGUMENTS` kosong → minta user memberikan requirement (path file atau teks), lalu berhenti.
- Jika menunjuk ke file yang ada (mis. berakhiran `.md`/`.txt`, atau path yang valid) → baca file itu dengan tool Read dan pakai isinya sebagai requirement.
- Selain itu → perlakukan `$ARGUMENTS` apa adanya sebagai teks requirement.

## Format output (IKUTI PERSIS template rumah)

**Pertama `Read` file `EXAMPLE-JIRA-TICKET-DESCRIPTION-TEMPLATE.md`** (root project) dan tiru
strukturnya PERSIS. Lalu hasilkan SATU dokumen Markdown:

1. Baris judul (HARUS baris pertama): `# [feature_name][sub_feature_name] short description` (sub opsional).
2. `## Description` — daftar bullet: `Overview:` (1–2 kalimat) + `Figma:`, `PRD / Confluence:`, `Postman:`, `API contract & path:`. Isi `TBD` kecuali input memberi nilai nyata (jangan mengarang URL).
3. `## User Acceptance Criteria (UAC)` — satu blok per skenario:
   - Heading `# N. JUDUL SKENARIO HURUF BESAR` (N mulai dari 1).
   - Klausa Gherkin keyword HURUF BESAR INGGRIS (`GIVEN/AND/WHEN/THEN`). **Tulis tiap kelompok klausa MENYATU dalam satu blok — TANPA baris kosong antar klausa** (GIVEN→AND→WHEN→THEN→AND berurutan, satu baris masing-masing). Akhiri tiap klausa dengan koma, klausa terakhir titik. (Single newline antar klausa di-render jadi line break oleh `toADF`.)
   - **Baris kosong HANYA**: antara heading dan blok, sebelum & sesudah tabel `| EN | ID |`, dan sebelum `[image-...]`. Kelompok WHEN/THEN baru setelah tabel = blok terpisah. JANGAN sisipkan baris kosong di tengah satu kelompok GIVEN→WHEN→THEN.
   - **WAJIB tabel `| EN | ID |`** untuk SETIAP teks/label/pesan UI (tombol, judul, copy, error) — satu baris tabel per string.
   - Akhiri skenario terkait UI dengan baris `[image-or-design-ui-from-figma](https://example-image.com)`.
- Cakup: happy path, alur alternatif/entry-point, permission/auth, loading state, error handling, dan edge case.
- Tulis prosa dalam **bahasa Inggris** secara default (atau Bahasa Indonesia bila user memintanya / requirement jelas berbahasa Indonesia). Keyword Gherkin tetap huruf besar Inggris.

## Menyimpan (pakai tool Bash + Write)

1. Ambil timestamp: jalankan `date +%Y-%m-%d-%H%M%S`.
2. Slug = judul di-lowercase, karakter non-alfanumerik → `-` (mis. `[Auth][Password] Reset Password` → `auth-password-reset-password`), maks ~60 char.
3. Tulis markdown ke `output-uac/<slug>-<timestamp>.md`.
4. Tulis juga **template tiket JIRA kompatibel-`bulk`** ke `output-uac/<slug>-<timestamp>.json`:
   ```json
   {
     "summary": "<teks baris judul, tanpa '# ' di depan>",
     "description": "<isi UAC LENGKAP setelah baris judul = blok ## Description + seluruh ## UAC>",
     "issuetype": "Story",
     "projectKey": "<JIRA_PROJECT_KEY dari .env bila ada, jika tidak ENG>"
   }
   ```
   - `description` HARUS identik dengan body markdown (dikurangi baris judul) — SEMUA skenario Gherkin,
     tabel `| EN | ID |`, dan placeholder image ikut. JANGAN diringkas.
   - Default `issuetype` = `Story`; jika user menyebut tipe (Story/Task/Bug/Epic) di pesannya, pakai itu.
   - Untuk `projectKey`: baca HANYA baris `JIRA_PROJECT_KEY` dari `.env` bila ada; selain itu `ENG`. Jangan tampilkan/ungkap nilai `.env` lainnya.
5. Cetak: kedua path file + perintah membuat tiketnya:
   `npx ts-node src/index.ts bulk output-uac/<slug>-<timestamp>.json`

Catatan: heading, tabel, link, dan bullet di `description` akan ter-render benar di JIRA lewat konverter `toADF` milik project (jadi outputnya identik dengan hasil command `uac` CLI).
