<!--
  TEMPLATE INPUT — UAC (satu tiket)
  Isi bagian di bawah, simpan sebagai .md, lalu feed ke:
    • CLI:  npx ts-node src/index.ts uac -f templates/requirement-uac.md
    • Skill: /uac templates/requirement-uac.md
    • Web UI: tempel isinya ke kolom "Requirement" (mode UAC)
  Hapus baris komentar ini bila mau. Makin detail input → makin akurat UAC.
-->

# Feature: <nama fitur singkat>

## Konteks
<1–3 kalimat: apa fitur ini, untuk siapa, kenapa dibutuhkan.>

## User story
Sebagai <peran user>, saya ingin <kemampuan>, agar <manfaat>.

## Cakupan / requirement
- <requirement fungsional 1>
- <requirement fungsional 2>
- <aturan bisnis / validasi penting>

## Status & peran user yang relevan
- <mis. user login / belum login / sudah/belum verifikasi KYC / role admin>

## Skenario yang harus tercakup
- Happy path: <...>
- Alur alternatif / entry point: <...>
- Permission / auth: <...>
- Loading state: <...>
- Error handling: <...>
- Edge / negative case: <...>

## Teks UI (opsional, untuk tabel EN/ID)
- <copy yang muncul di layar, mis. pesan error, label tombol>

## Resource (opsional — biarkan kosong/TBD bila belum ada)
- Figma: <url>
- PRD / Confluence: <url>
- Postman: <url>
- API contract & path: <method + path>
