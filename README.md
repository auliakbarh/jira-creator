# 🎫 JIRA Creator

Buat tiket JIRA dari CLI — **gratis, tanpa AI, hanya butuh JIRA API token**.

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
```

**Cara dapat API token JIRA:**
1. Buka https://id.atlassian.com/manage-profile/security/api-tokens
2. Klik **Create API token**
3. Beri nama (misal: "jira-creator")
4. Salin token → paste ke `.env`

---

## 🎮 Perintah CLI

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
