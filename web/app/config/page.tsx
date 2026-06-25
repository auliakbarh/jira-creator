'use client';

import { useEffect, useState } from 'react';

interface Cfg {
  baseUrl: string; email: string; apiToken: string;
  projectKey: string; defaultIssueType: string; defaultPriority: string;
  hasToken?: boolean;
}

const EMPTY: Cfg = { baseUrl: '', email: '', apiToken: '', projectKey: '', defaultIssueType: 'Task', defaultPriority: 'Medium' };

export default function ConfigPage() {
  const [cfg, setCfg] = useState<Cfg>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/config').then((r) => r.json()).then((d) => { setCfg({ ...EMPTY, ...d }); setLoading(false); });
  }, []);

  const set = (k: keyof Cfg) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCfg((c) => ({ ...c, [k]: e.target.value }));

  async function save() {
    setSaving(true); setMsg(null);
    const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
    const d = await r.json();
    setCfg({ ...EMPTY, ...d });
    setSaving(false);
    setMsg({ kind: 'ok', text: 'Konfigurasi tersimpan.' });
  }

  async function test() {
    setTesting(true); setMsg(null);
    await save();
    const r = await fetch('/api/jira/whoami');
    const d = await r.json();
    setTesting(false);
    setMsg(d.ok
      ? { kind: 'ok', text: `Terhubung sebagai ${d.name} (${d.email}).` }
      : { kind: 'err', text: `Gagal: ${d.error}` });
  }

  if (loading) return <p className="muted">Memuat…</p>;

  return (
    <>
      <h1>Konfigurasi JIRA</h1>
      <p className="subtitle">Kredensial disimpan di server (file <code>.data/config.json</code>), bukan di browser. Token tidak pernah dikirim balik ke browser.</p>

      <div className="card">
        <h2>Kredensial</h2>
        <p className="hint">Wajib untuk membuat tiket. Token bisa dibuat di Atlassian → Security → API tokens.</p>

        <label>JIRA_BASE_URL</label>
        <input type="text" placeholder="https://your-domain.atlassian.net" value={cfg.baseUrl} onChange={set('baseUrl')} />

        <label>JIRA_EMAIL</label>
        <input type="text" placeholder="kamu@perusahaan.com" value={cfg.email} onChange={set('email')} />

        <label>JIRA_API_TOKEN {cfg.hasToken && <span className="opt">— tersimpan, kosongkan untuk pertahankan</span>}</label>
        <input type="password" placeholder={cfg.hasToken ? '•••••••• (tersimpan)' : 'API token'} value={cfg.apiToken} onChange={set('apiToken')} />
      </div>

      <div className="card">
        <h2>Default (opsional)</h2>
        <p className="hint">Dipakai bila tiket tidak menentukannya sendiri.</p>
        <div className="row">
          <div>
            <label>JIRA_PROJECT_KEY</label>
            <input type="text" placeholder="ENG" value={cfg.projectKey} onChange={set('projectKey')} />
          </div>
          <div>
            <label>JIRA_DEFAULT_ISSUE_TYPE</label>
            <input type="text" placeholder="Task" value={cfg.defaultIssueType} onChange={set('defaultIssueType')} />
          </div>
          <div>
            <label>JIRA_DEFAULT_PRIORITY</label>
            <input type="text" placeholder="Medium" value={cfg.defaultPriority} onChange={set('defaultPriority')} />
          </div>
        </div>
      </div>

      {msg && <div className={`alert ${msg.kind}`}>{msg.text}</div>}

      <div className="btn-row">
        <button className="green" onClick={test} disabled={testing || saving}>
          {testing ? <><span className="spinner" /> Menguji…</> : '✓ Simpan & Uji Koneksi'}
        </button>
        <button className="secondary" onClick={save} disabled={saving || testing}>
          {saving ? 'Menyimpan…' : 'Simpan saja'}
        </button>
      </div>
    </>
  );
}
