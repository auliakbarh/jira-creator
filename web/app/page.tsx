'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import UacEditor, { UacTicket } from './components/UacEditor';
import EpicEditor, { EpicPlan } from './components/EpicEditor';
import EnvModal, { EnvCfg, isConfigured } from './components/EnvModal';

type Mode = 'uac' | 'epic';
type Step = 'input' | 'generating' | 'review' | 'done';
type InputTab = 'generate' | 'paste';

// Split UAC markdown into summary (first `# ` heading) + description (the rest).
function splitUAC(md: string): { summary: string; description: string } {
  const lines = md.split('\n');
  const idx = lines.findIndex((l) => /^#\s+/.test(l));
  if (idx === -1) return { summary: (lines.find((l) => l.trim()) ?? 'UAC').trim().slice(0, 255), description: md.trim() };
  return { summary: lines[idx].replace(/^#\s+/, '').trim().slice(0, 255), description: lines.slice(idx + 1).join('\n').trim() };
}

export default function Home() {
  const [step, setStep] = useState<Step>('input');
  const [mode, setMode] = useState<Mode>('uac');
  const [requirement, setRequirement] = useState('');
  const [lang, setLang] = useState<'en' | 'id'>('id');
  const [projectKey, setProjectKey] = useState('');
  const [issuetype, setIssuetype] = useState('Story');

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('');
  const [inputTab, setInputTab] = useState<InputTab>('generate');
  const [pasteText, setPasteText] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // Environment / credentials gate.
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [showEnv, setShowEnv] = useState(false);

  const [uac, setUac] = useState<UacTicket | null>(null);
  const [plan, setPlan] = useState<EpicPlan | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ epic?: any; created?: any; children?: any[] } | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  // Reproduce from history: the Riwayat page stashes an entry then routes here.
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem('jira-repro') : null;
    if (!raw) return;
    sessionStorage.removeItem('jira-repro');
    try {
      const e = JSON.parse(raw);
      setMode(e.mode);
      setLang(e.lang === 'id' ? 'id' : 'en');
      setProjectKey(e.projectKey || '');
      if (e.issuetype) setIssuetype(e.issuetype);
      setRequirement(e.requirement || '');
      setHistoryId(null); // a re-create logs a new history entry
      if (e.mode === 'uac') { setUac(e.payload); setStep('review'); }
      else { setPlan(e.payload); setStep('review'); }
    } catch { /* ignore malformed repro */ }
  }, []);

  // On load, check env. If creds missing → force the env modal open.
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d: EnvCfg) => {
        const ok = isConfigured(d);
        setConfigured(ok);
        if (!ok) setShowEnv(true);
      })
      .catch(() => { setConfigured(false); setShowEnv(true); });
  }, []);

  // ── Build editable models from a generation result ──
  function loadUac(markdown: string, ticket?: any): UacTicket {
    const { summary, description } = splitUAC(markdown);
    const u: UacTicket = {
      summary: ticket?.summary || summary,
      description: ticket?.description ?? description,
      issuetype: ticket?.issuetype || issuetype,
      priority: ticket?.priority || 'Medium',
      labels: ticket?.labels || ['uac'],
      projectKey: ticket?.projectKey || projectKey,
    };
    setUac(u);
    setStep('review');
    return u;
  }
  function loadPlan(r: { epic: any; tasks: any[] }): EpicPlan {
    const p: EpicPlan = {
      epic: { summary: r.epic.summary, description: r.epic.description || '' },
      tasks: (r.tasks || []).map((t) => ({ summary: t.summary, description: t.description || '', issuetype: t.issuetype || 'Task' })),
      projectKey,
    };
    setPlan(p);
    setStep('review');
    return p;
  }

  // ── Record a freshly generated/pasted result into history ──
  async function recordHistory(m: Mode, payload: UacTicket | EpicPlan) {
    try {
      const r = await fetch('/api/history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: m, lang, projectKey, issuetype, requirement, payload, created: false }),
      });
      const d = await r.json();
      if (d.ok) setHistoryId(d.entry.id);
    } catch { /* history is best-effort */ }
  }

  // ── Submit a generation job for the Claude Code bridge to process ──
  async function generate() {
    setErr(null);
    if (!requirement.trim()) { setErr('Isi requirement dulu.'); return; }
    const r = await fetch('/api/jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, lang, projectKey, issuetype, requirement }),
    });
    const d = await r.json();
    if (!d.ok) { setErr(d.error); return; }
    setJobId(d.job.id);
    setStep('generating');
    setJobStatus('pending');
    poll.current = setInterval(async () => {
      const jr = await fetch(`/api/jobs/${d.job.id}`).then((x) => x.json());
      if (!jr.ok) return;
      setJobStatus(jr.job.status);
      if (jr.job.status === 'done') {
        clearInterval(poll.current!);
        if (mode === 'uac') recordHistory('uac', loadUac(jr.job.result.markdown, jr.job.result.ticket));
        else recordHistory('epic', loadPlan(jr.job.result));
      } else if (jr.job.status === 'error') {
        clearInterval(poll.current!);
        setErr(jr.job.error || 'Generation gagal.');
        setStep('input');
      }
    }, 2000);
  }

  // ── Manual paste fallback (paste Claude output directly) ──
  function applyPaste() {
    setErr(null);
    try {
      if (mode === 'uac') {
        if (!pasteText.trim()) throw new Error('Tempel markdown UAC dulu.');
        recordHistory('uac', loadUac(pasteText.trim()));
      } else {
        const parsed = JSON.parse(pasteText.trim());
        if (!parsed.epic || !Array.isArray(parsed.tasks)) throw new Error('JSON harus punya { epic, tasks }.');
        recordHistory('epic', loadPlan(parsed));
      }
    } catch (e) {
      setErr(`Gagal memproses: ${(e as Error).message}`);
    }
  }

  // ── Create the ticket(s) in JIRA ──
  async function create() {
    if (!configured) { setErr('Isi konfigurasi environment JIRA dulu.'); setShowEnv(true); return; }
    setCreating(true); setErr(null);
    let body: any;
    if (mode === 'uac' && uac) {
      body = { mode: 'single', ticket: { ...uac, projectKey: uac.projectKey || undefined } };
    } else if (mode === 'epic' && plan) {
      body = {
        mode: 'epic',
        epic: { summary: plan.epic.summary, description: plan.epic.description, projectKey: plan.projectKey || undefined },
        children: plan.tasks.map((t) => ({ ...t, projectKey: plan.projectKey || undefined })),
      };
    }
    const r = await fetch('/api/jira/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json();
    setCreating(false);
    if (!d.ok) { setErr(d.error); return; }
    setResult(d);
    setStep('done');
    persistCreated(d);
  }

  // Update the history entry as created (or create one if none yet), with the
  // final edited payload and the JIRA result.
  async function persistCreated(result: any) {
    const payload = mode === 'uac' ? uac : plan;
    if (!payload) return;
    try {
      if (historyId) {
        await fetch(`/api/history/${historyId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload, created: true, result }),
        });
      } else {
        await fetch('/api/history', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, lang, projectKey, issuetype, requirement, payload, created: true, result }),
        });
      }
    } catch { /* best-effort */ }
  }

  function reset() {
    setStep('input'); setUac(null); setPlan(null); setResult(null); setHistoryId(null);
    setRequirement(''); setPasteText(''); setInputTab('generate'); setJobId(null); setErr(null);
  }

  // ─────────────────────────── render ───────────────────────────
  return (
    <>
      {showEnv && (
        <EnvModal
          required={!configured}
          onClose={() => setShowEnv(false)}
          onSaved={(c) => { setConfigured(isConfigured(c)); if (isConfigured(c)) setShowEnv(false); }}
        />
      )}

      <div className="page-head">
        <div>
          <h1>Buat Tiket JIRA</h1>
          <p className="subtitle">UAC & breakdown dibuat lewat Claude Code (tanpa API berbayar). Tinjau & edit dulu, baru dikirim ke JIRA.</p>
        </div>
        <button className="secondary small" onClick={() => setShowEnv(true)}>⚙️ Environment</button>
      </div>

      {configured === false && (
        <div className="alert warn">Environment JIRA belum diisi. <button className="toggle-link" onClick={() => setShowEnv(true)}>Isi sekarang</button>.</div>
      )}

      {err && <div className="alert err">{err}</div>}

      {step === 'input' && (
        <>
          <div className="card">
            <h2>1. Pilih jenis</h2>
            <div className="mode-grid">
              <div className={`mode-card ${mode === 'uac' ? 'active' : ''}`} onClick={() => setMode('uac')}>
                <h3>📝 UAC — satu tiket</h3>
                <p>Hasilkan satu tiket (Story/Task/Bug/Spike) lengkap dengan User Acceptance Criteria gaya Gherkin.</p>
              </div>
              <div className={`mode-card ${mode === 'epic' ? 'active' : ''}`} onClick={() => setMode('epic')}>
                <h3>🗂️ Epic — breakdown</h3>
                <p>Pecah sebuah Epic menjadi beberapa child issue (Story/Task) yang langsung tertaut ke Epic.</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>2. Requirement</h2>
            <div className="tabs">
              <div className={`tab ${inputTab === 'generate' ? 'active' : ''}`} onClick={() => setInputTab('generate')}>⚡ Generate via Claude Code</div>
              <div className={`tab ${inputTab === 'paste' ? 'active' : ''}`} onClick={() => setInputTab('paste')}>📋 Tempel Manual</div>
            </div>

            {inputTab === 'generate' ? (
              <>
                <p className="hint">
                  Tempel deskripsi fitur / requirement (bisa markdown). Dikirim ke Claude Code untuk diproses.
                  {mode === 'uac' && ' Tiap skenario UAC ditulis dalam bentuk Gherkin GIVEN / WHEN / THEN.'}
                </p>
                <textarea style={{ minHeight: 180 }} value={requirement} onChange={(e) => setRequirement(e.target.value)}
                  placeholder={mode === 'uac' ? 'mis. Sebagai user saya ingin reset password lewat email…' : 'mis. Modul pembayaran: integrasi gateway, riwayat transaksi, refund…'} />
              </>
            ) : (
              <>
                <p className="hint">
                  Sudah punya hasil dari Claude (chat / CLI)? Tempel di sini.{' '}
                  {mode === 'uac' ? 'Untuk UAC: tempel dokumen markdown (skenario GIVEN/WHEN/THEN).' : 'Untuk Epic: tempel JSON { epic, tasks }.'}
                </p>
                <textarea style={{ minHeight: 180 }} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                  placeholder={mode === 'uac' ? '# [feature] judul\n\n## Description\n…\n\n## User Acceptance Criteria (UAC)\n\n# 1. JUDUL\n\nGIVEN …,\nWHEN …,\nTHEN ….' : '{ "epic": { "summary": "…", "description": "…" }, "tasks": [ … ] }'} />
              </>
            )}

            <div className="row">
              <div>
                <label>Bahasa prosa</label>
                <select value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'id')}>
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label>Project Key <span className="opt">(kosong = default)</span></label>
                <input type="text" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} placeholder="default dari konfigurasi" />
              </div>
              {mode === 'uac' && (
                <div>
                  <label>Issue Type</label>
                  <select value={issuetype} onChange={(e) => setIssuetype(e.target.value)}>
                    {['Story', 'Task', 'Bug', 'Spike'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="btn-row">
              {inputTab === 'generate'
                ? <button onClick={generate}>⚡ Generate via Claude Code</button>
                : <button onClick={applyPaste}>Proses & tinjau</button>}
            </div>
          </div>
        </>
      )}

      {step === 'generating' && (
        <div className="card">
          <h2><span className="spinner" /> Menunggu Claude Code…</h2>
          <p className="hint">Job <code className="mono">{jobId}</code> — status: <strong>{jobStatus}</strong></p>
          <div className="alert info">
            Pastikan sesi Claude Code menjalankan skill bridge. Di terminal Claude Code, jalankan:
            <pre className="mono" style={{ marginTop: 8 }}>/jira-web</pre>
            Skill akan memproses job ini di sesi (tanpa biaya API), lalu hasilnya muncul di sini otomatis.
          </div>
          <button className="secondary" onClick={() => { if (poll.current) clearInterval(poll.current); reset(); }}>Batal</button>
        </div>
      )}

      {step === 'review' && (
        <>
          <div className="alert ok">Hasil siap. Tinjau & edit di bawah, lalu buat tiketnya.</div>
          {mode === 'uac' && uac && <UacEditor ticket={uac} onChange={setUac} />}
          {mode === 'epic' && plan && <EpicEditor plan={plan} onChange={setPlan} />}
          <div className="btn-row">
            <button className="green" onClick={create} disabled={creating}>
              {creating ? <><span className="spinner" /> Membuat…</> : '🚀 Buat ke JIRA'}
            </button>
            <button className="secondary" onClick={reset}>Mulai ulang</button>
          </div>
        </>
      )}

      {step === 'done' && result && (
        <>
          <div className="alert ok">Selesai! Tiket berhasil dibuat.</div>
          {result.created && (
            <div className="ticket"><div className="head"><span className="summary">{result.created.key}</span>
              <a href={result.created.url} target="_blank" rel="noreferrer">Buka di JIRA →</a></div></div>
          )}
          {result.epic && (
            <div className="ticket"><div className="head"><span className="badge epic">Epic</span>
              <span className="summary">{result.epic.key}</span>
              <a href={result.epic.url} target="_blank" rel="noreferrer">Buka →</a></div></div>
          )}
          {result.children?.map((c, i) => (
            <div key={i} className="ticket child"><div className="head">
              <span className="summary">{c.status === 'created' ? c.key : `❌ ${c.input}`}</span>
              {c.status === 'created' ? <a href={c.url} target="_blank" rel="noreferrer">Buka →</a> : <span className="muted">{c.error}</span>}
            </div></div>
          ))}
          <div className="btn-row"><button onClick={reset}>Buat tiket lain</button></div>
        </>
      )}

      <hr />
      <p className="muted" style={{ fontSize: 13 }}>
        Belum mengisi kredensial JIRA? Buka <Link href="/config">Konfigurasi</Link> dulu.
      </p>
    </>
  );
}
