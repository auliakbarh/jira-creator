# 🚀 Panduan Deploy — JIRA Creator Web

Web UI ada di folder `web/` (Next.js 14, App Router). Self-contained — JIRA REST + konverter
ADF di-vendor di `web/lib/jira.ts`, jadi bisa di-deploy tanpa folder `src/`.

> **Penting soal AI.** Pembuatan UAC/breakdown dirancang berjalan **di sesi Claude Code**
> (tanpa API berbayar) lewat skill `/jira-web`. Skill itu membaca/menulis antrian job di
> `web/.data/jobs/` di **mesin yang sama** dengan server. Maka:
> - **Lokal (rekomendasi penuh):** UI + bridge AI otomatis jalan.
> - **Cloud (mis. Vercel):** server tetap bisa buat tiket ke JIRA, tapi job AI otomatis
>   **tidak** jalan (tidak ada sesi Claude Code di server). Pakai jalur **"Tempel hasil
>   Claude manual"** di UI — generate UAC/JSON di Claude (chat/CLI), lalu tempel ke UI.

---

## A. Lokal — paling lengkap

### Cara 1: lewat skill (server + AI bridge sekaligus)
Di terminal Claude Code pada root project:
```
/jira-web
```
Skill akan `npm install --prefix web` (sekali), menyalakan server di **http://localhost:3939**,
lalu memproses tiap job dari UI di sesi ini.

### Cara 2: server saja (AI manual)
```bash
npm install --prefix web
npm run dev --prefix web      # dev, http://localhost:3939
# atau produksi:
npm run build --prefix web
npm run start --prefix web
```
Tanpa skill, generate-otomatis tidak jalan — gunakan tombol **"Tempel hasil Claude manual"**.

Kredensial JIRA diisi di halaman **Konfigurasi** (disimpan ke `web/.data/config.json`,
gitignored) atau lewat env var (lihat bagian C).

---

## B. Vercel

1. Set **Root Directory** = `web` di project settings Vercel.
2. Build command `next build` (default), output otomatis.
3. **Environment Variables** (Settings → Environment Variables) — karena filesystem Vercel
   read-only (kecuali `/tmp` yang efemeral), simpan kredensial sebagai env, bukan via UI:
   ```
   JIRA_BASE_URL=https://your-domain.atlassian.net
   JIRA_EMAIL=kamu@perusahaan.com
   JIRA_API_TOKEN=xxxxxxxx
   JIRA_PROJECT_KEY=ENG
   JIRA_DEFAULT_ISSUE_TYPE=Task
   JIRA_DEFAULT_PRIORITY=Medium
   JIRA_CREATOR_DATA_DIR=/tmp/jira-creator   # tulis config/job ke /tmp (efemeral)
   ```
   Env var menjadi nilai awal; menyimpan dari UI Konfigurasi hanya bertahan selama
   instance hidup (efemeral di serverless).
4. Deploy. Alur di Vercel: isi requirement → **Tempel hasil Claude manual** → tinjau/edit →
   **Buat ke JIRA**.

> Mau auto-generate AI tetap jalan di server? Butuh host yang menjalankan proses sesi Claude
> Code berkelanjutan (mis. VM/VPS dengan `/jira-web` aktif), bukan serverless.

---

## C. Konfigurasi via environment

Web UI membaca env ini sebagai nilai awal (file `web/.data/config.json` menimpanya bila ada):

| Env | Wajib | Keterangan |
|---|:--:|---|
| `JIRA_BASE_URL` | ✅ | mis. `https://your-domain.atlassian.net` |
| `JIRA_EMAIL` | ✅ | email akun Atlassian |
| `JIRA_API_TOKEN` | ✅ | API token Atlassian |
| `JIRA_PROJECT_KEY` | — | project key default |
| `JIRA_DEFAULT_ISSUE_TYPE` | — | default issue type (mis. `Task`) |
| `JIRA_DEFAULT_PRIORITY` | — | default priority (mis. `Medium`) |
| `JIRA_CREATOR_DATA_DIR` | — | lokasi config + antrian job (default `web/.data`) |

Untuk lokal, bisa juga taruh env ini di `web/.env.local` (otomatis dibaca Next.js).

---

## D. Docker (opsional)

```dockerfile
# web/Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3939
CMD ["npm", "run", "start"]
```
```bash
docker build -t jira-creator-web -f web/Dockerfile .
docker run -p 3939:3939 --env-file web/.env.local \
  -v "$PWD/web/.data:/app/.data" jira-creator-web
```
Mount volume `.data` agar config & job persist. (AI auto tetap perlu sesi Claude Code.)

---

## Checklist sebelum produksi
- [ ] `npm run build --prefix web` sukses (typecheck lulus).
- [ ] Halaman Konfigurasi → **Simpan & Uji Koneksi** hijau.
- [ ] Coba buat satu tiket UAC → muncul di JIRA.
- [ ] `web/.data/` tidak ter-commit (sudah di `web/.gitignore`).
