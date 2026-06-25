'use client';

import { useState } from 'react';
import Markdown from './Markdown';

export interface UacTicket {
  summary: string;
  description: string;
  issuetype: string;
  priority: string;
  projectKey: string;
}

export default function UacEditor({ ticket, onChange, keyPlaceholder }: { ticket: UacTicket; onChange: (t: UacTicket) => void; keyPlaceholder?: string }) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const set = <K extends keyof UacTicket>(k: K, v: UacTicket[K]) => onChange({ ...ticket, [k]: v });

  return (
    <div className="ticket">
      <div className="head">
        <span className={`badge ${ticket.issuetype.toLowerCase()}`}>{ticket.issuetype}</span>
        <span className="summary">{ticket.summary || 'Tanpa judul'}</span>
      </div>
      <div className="body">
        <label>Summary (judul tiket)</label>
        <input type="text" value={ticket.summary} onChange={(e) => set('summary', e.target.value)} />

        <div className="row">
          <div>
            <label>Issue Type</label>
            <select value={ticket.issuetype} onChange={(e) => set('issuetype', e.target.value)}>
              {['Story', 'Task', 'Bug', 'Spike', 'Epic'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label>Priority</label>
            <select value={ticket.priority} onChange={(e) => set('priority', e.target.value)}>
              {['Highest', 'High', 'Medium', 'Low', 'Lowest'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label>Project Key <span className="opt">(kosong = default)</span></label>
            <input type="text" value={ticket.projectKey} onChange={(e) => set('projectKey', e.target.value)} placeholder={keyPlaceholder || 'default'} />
          </div>
        </div>

        <label>Description (UAC) — markdown</label>
        <div className="tabs">
          <span className={`tab ${tab === 'edit' ? 'active' : ''}`} onClick={() => setTab('edit')}>Edit</span>
          <span className={`tab ${tab === 'preview' ? 'active' : ''}`} onClick={() => setTab('preview')}>Preview</span>
        </div>
        {tab === 'edit'
          ? <textarea style={{ minHeight: 320 }} value={ticket.description} onChange={(e) => set('description', e.target.value)} />
          : <Markdown md={ticket.description} />}
      </div>
    </div>
  );
}
