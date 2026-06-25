'use client';

import { useEffect, useState } from 'react';

export interface EnvCfg {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  defaultIssueType: string;
  defaultPriority: string;
  hasToken?: boolean;
}

const EMPTY: EnvCfg = {
  baseUrl: '', email: '', apiToken: '', projectKey: '', defaultIssueType: 'Task', defaultPriority: 'Medium',
};

export function isConfigured(c: EnvCfg | null): boolean {
  return Boolean(c && c.baseUrl && c.email && (c.hasToken || c.apiToken));
}

/**
 * Environment / credential modal. Shown on first visit (or when creds are
 * missing) so the user fills JIRA env before anything else. When `required`
 * is true the modal cannot be dismissed until a valid connection is saved.
 */
export default function EnvModal({
  required,
  onClose,
  onSaved,
}: {
  required: boolean;
  onClose: () => void;
  onSaved: (cfg: EnvCfg) => void;
}) {
  const [cfg, setCfg] = useState<EnvCfg>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => { setCfg({ ...EMPTY, ...d }); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const set = (k: keyof EnvCfg) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCfg((c) => ({ ...c, [k]: e.target.value }));

  async function saveAndTest() {
    setBusy(true); setMsg(null);
    const r = await fetch('/api/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg),
    });
    const saved = (await r.json()) as EnvCfg;
    setCfg({ ...EMPTY, ...saved });

    const wr = await fetch('/api/jira/whoami').then((x) => x.json());
    setBusy(false);
    if (wr.ok) {
      setMsg({ kind: 'ok', text: `Terhubung sebagai ${wr.name} (${wr.email}).` });
      onSaved({ ...EMPTY, ...saved });
    } else {
      setMsg({ kind: 'err', text: `Tersimpan, tapi koneksi gagal: ${wr.error}` });
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => { if (!required) onClose(); }}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>⚙️ Konfigurasi Environment JIRA</h2>
          {!required && <button className="modal-x" onClick={onClose} aria-label="Tutup">×</button>}
        </div>

        <p className="hint">
          Isi kredensial JIRA dulu sebelum membuat tiket. Disimpan di server
          (<code>.data/config.json</code>), tidak dikirim balik ke browser. Token dibuat di
          Atlassian → Security → API tokens.
        </p>

        {loading ? (
          <p className="muted">Memuat…</p>
        ) : (
          <>
            <label>JIRA_BASE_URL</label>
            <input type="text" placeholder="https://your-domain.atlassian.net" value={cfg.baseUrl} onChange={set('baseUrl')} />

            <label>JIRA_EMAIL</label>
            <input type="text" placeholder="kamu@perusahaan.com" value={cfg.email} onChange={set('email')} />

            <label>JIRA_API_TOKEN {cfg.hasToken && <span className="opt">— tersimpan, kosongkan untuk pertahankan</span>}</label>
            <input type="password" placeholder={cfg.hasToken ? '•••••••• (tersimpan)' : 'API token'} value={cfg.apiToken} onChange={set('apiToken')} />

            <div className="row" style={{ marginTop: 6 }}>
              <div>
                <label>Project Key <span className="opt">(default)</span></label>
                <input type="text" placeholder="ENG" value={cfg.projectKey} onChange={set('projectKey')} />
              </div>
              <div>
                <label>Default Issue Type</label>
                <input type="text" placeholder="Task" value={cfg.defaultIssueType} onChange={set('defaultIssueType')} />
              </div>
              <div>
                <label>Default Priority</label>
                <input type="text" placeholder="Medium" value={cfg.defaultPriority} onChange={set('defaultPriority')} />
              </div>
            </div>

            {msg && <div className={`alert ${msg.kind}`}>{msg.text}</div>}

            <div className="btn-row">
              <button className="green" onClick={saveAndTest} disabled={busy}>
                {busy ? <><span className="spinner" /> Menyimpan & menguji…</> : '✓ Simpan & Uji Koneksi'}
              </button>
              {!required && <button className="secondary" onClick={onClose} disabled={busy}>Tutup</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
