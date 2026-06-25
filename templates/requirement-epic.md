<!--
  TEMPLATE INPUT — EPIC (breakdown jadi child issue)
  Isi bagian di bawah, simpan sebagai .md, lalu feed ke:
    • CLI:  npx ts-node src/index.ts epic -f templates/requirement-epic.md --dry-run
    • Web UI: tempel isinya ke kolom "Requirement" (mode Epic)
  Hapus baris komentar ini bila mau.
-->

# Epic: <nama inisiatif besar>

## Objektif
<2–4 kalimat: tujuan epic, masalah yang diselesaikan, definisi sukses.>

## Scope (yang termasuk)
- <area kerja 1>
- <area kerja 2>
- <area kerja 3>

## Out of scope (yang TIDAK termasuk)
- <hal yang sengaja dikecualikan>

## Komponen / pekerjaan yang diketahui
- <fitur user-facing → biasanya jadi Story>
- <pekerjaan teknis/enabling → biasanya jadi Task>
- <riset/ketidakpastian → pertimbangkan Spike>

## Constraint / dependency (opsional)
- <integrasi pihak ketiga, tenggat, prasyarat teknis>
