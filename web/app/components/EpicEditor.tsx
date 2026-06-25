'use client';

import { useState } from 'react';
import Markdown from './Markdown';

export interface EpicTask { summary: string; description: string; issuetype: string; }
export interface EpicPlan {
  epic: { summary: string; description: string };
  tasks: EpicTask[];
  projectKey: string;
}

function TaskCard({ task, onChange, onRemove, index }: { task: EpicTask; index: number; onChange: (t: EpicTask) => void; onRemove: () => void }) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const set = <K extends keyof EpicTask>(k: K, v: EpicTask[K]) => onChange({ ...task, [k]: v });
  return (
    <div className="ticket child">
      <div className="head">
        <span className={`badge ${task.issuetype.toLowerCase()}`}>{task.issuetype}</span>
        <span className="summary">#{index + 1} {task.summary || 'Tanpa judul'}</span>
        <button className="danger" onClick={onRemove}>Hapus</button>
      </div>
      <div className="body">
        <div className="row">
          <div style={{ flex: 3 }}>
            <label>Summary</label>
            <input type="text" value={task.summary} onChange={(e) => set('summary', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label>Type</label>
            <select value={task.issuetype} onChange={(e) => set('issuetype', e.target.value)}>
              {['Story', 'Task', 'Bug', 'Spike'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <label>Description</label>
        <div className="tabs">
          <span className={`tab ${tab === 'edit' ? 'active' : ''}`} onClick={() => setTab('edit')}>Edit</span>
          <span className={`tab ${tab === 'preview' ? 'active' : ''}`} onClick={() => setTab('preview')}>Preview</span>
        </div>
        {tab === 'edit'
          ? <textarea value={task.description} onChange={(e) => set('description', e.target.value)} />
          : <Markdown md={task.description} />}
      </div>
    </div>
  );
}

export default function EpicEditor({ plan, onChange }: { plan: EpicPlan; onChange: (p: EpicPlan) => void }) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const setEpic = (k: 'summary' | 'description', v: string) => onChange({ ...plan, epic: { ...plan.epic, [k]: v } });
  const setTask = (i: number, t: EpicTask) => onChange({ ...plan, tasks: plan.tasks.map((x, j) => (j === i ? t : x)) });
  const removeTask = (i: number) => onChange({ ...plan, tasks: plan.tasks.filter((_, j) => j !== i) });
  const addTask = () => onChange({ ...plan, tasks: [...plan.tasks, { summary: '', description: '', issuetype: 'Task' }] });

  return (
    <>
      <div className="ticket">
        <div className="head">
          <span className="badge epic">Epic</span>
          <span className="summary">{plan.epic.summary || 'Tanpa judul'}</span>
        </div>
        <div className="body">
          <div className="row">
            <div style={{ flex: 3 }}>
              <label>Epic Summary</label>
              <input type="text" value={plan.epic.summary} onChange={(e) => setEpic('summary', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Project Key <span className="opt">(default jika kosong)</span></label>
              <input type="text" value={plan.projectKey} onChange={(e) => onChange({ ...plan, projectKey: e.target.value })} placeholder="default" />
            </div>
          </div>
          <label>Epic Description</label>
          <div className="tabs">
            <span className={`tab ${tab === 'edit' ? 'active' : ''}`} onClick={() => setTab('edit')}>Edit</span>
            <span className={`tab ${tab === 'preview' ? 'active' : ''}`} onClick={() => setTab('preview')}>Preview</span>
          </div>
          {tab === 'edit'
            ? <textarea value={plan.epic.description} onChange={(e) => setEpic('description', e.target.value)} />
            : <Markdown md={plan.epic.description} />}
        </div>
      </div>

      <h3 style={{ margin: '18px 0 10px' }}>Child issues ({plan.tasks.length})</h3>
      {plan.tasks.map((t, i) => (
        <TaskCard key={i} task={t} index={i} onChange={(nt) => setTask(i, nt)} onRemove={() => removeTask(i)} />
      ))}
      <button className="secondary small" onClick={addTask}>+ Tambah child issue</button>
    </>
  );
}
