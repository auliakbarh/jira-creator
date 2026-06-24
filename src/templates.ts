import { Template, TemplateKey } from './types';

export const TEMPLATES: Record<TemplateKey, Template> = {
  bug: {
    name: 'Bug Report',
    issuetype: 'Bug',
    defaultPriority: 'High',
    labels: ['bug', 'needs-triage'],
    fields: [
      { key: 'summary',   prompt: 'Judul bug (singkat & jelas)',              placeholder: 'Login crash pada iOS Safari 17' },
      { key: 'steps',     prompt: 'Langkah-langkah reproduksi',               placeholder: '1. Buka app\n2. Tap login\n3. App crash', textarea: true },
      { key: 'expected',  prompt: 'Perilaku yang diharapkan',                 placeholder: 'Login berhasil dan redirect ke dashboard' },
      { key: 'actual',    prompt: 'Perilaku aktual',                          placeholder: 'App crash dengan error NullPointerException' },
      { key: 'env',       prompt: 'Environment (OS, browser, versi app)',     placeholder: 'iOS 17.4, Safari, App v2.3.1' },
    ],
    buildDescription: (a) =>
      `**Steps to reproduce:**\n${a['steps']}\n\n**Expected behavior:**\n${a['expected']}\n\n**Actual behavior:**\n${a['actual']}\n\n**Environment:** ${a['env']}`,
  },

  story: {
    name: 'User Story',
    issuetype: 'Story',
    defaultPriority: 'Medium',
    labels: ['feature'],
    fields: [
      { key: 'role',      prompt: 'As a... (siapa penggunanya)',    placeholder: 'registered customer' },
      { key: 'goal',      prompt: 'I want to... (apa tujuannya)',   placeholder: 'filter produk berdasarkan harga' },
      { key: 'benefit',   prompt: 'So that... (apa manfaatnya)',    placeholder: 'saya bisa menemukan produk sesuai budget lebih cepat' },
      { key: 'ac',        prompt: 'Acceptance criteria',            placeholder: '- Filter tersedia di halaman produk\n- Range bisa diatur manual\n- Hasil update tanpa reload', textarea: true },
    ],
    buildSummary: (a) => `[Story] ${a['role']} dapat ${a['goal']}`,
    buildDescription: (a) =>
      `**As a** ${a['role']},\n**I want to** ${a['goal']},\n**So that** ${a['benefit']}\n\n**Acceptance Criteria:**\n${a['ac']}`,
  },

  task: {
    name: 'Technical Task',
    issuetype: 'Task',
    defaultPriority: 'Medium',
    labels: ['engineering'],
    fields: [
      { key: 'summary',   prompt: 'Judul task',                               placeholder: 'Upgrade PostgreSQL dari v14 ke v16' },
      { key: 'what',      prompt: 'Apa yang perlu dilakukan?',                placeholder: 'Database PostgreSQL 14 sudah EOL...', textarea: true },
      { key: 'dod',       prompt: 'Definition of Done',                       placeholder: '- Berhasil di staging\n- Zero downtime\n- Rollback plan ada', textarea: true },
    ],
    buildDescription: (a) =>
      `**What needs to be done:**\n${a['what']}\n\n**Definition of Done:**\n${a['dod']}`,
  },

  epic: {
    name: 'Epic',
    issuetype: 'Epic',
    defaultPriority: 'High',
    labels: ['epic'],
    fields: [
      { key: 'summary',    prompt: 'Judul epic',                              placeholder: 'Redesign checkout flow' },
      { key: 'objective',  prompt: 'Business objective',                      placeholder: 'Tingkatkan conversion rate checkout dari 60% → 75%' },
      { key: 'scope',      prompt: 'In scope',                                placeholder: 'Cart page, checkout steps, payment confirmation', textarea: true },
      { key: 'outscope',   prompt: 'Out of scope',                            placeholder: 'Payment gateway, refund flow' },
      { key: 'kpi',        prompt: 'Success metric / KPI',                    placeholder: 'Checkout conversion >= 75% dalam 30 hari' },
    ],
    buildDescription: (a) =>
      `**Objective:**\n${a['objective']}\n\n**In Scope:**\n${a['scope']}\n\n**Out of Scope:**\n${a['outscope']}\n\n**Success Metric:**\n${a['kpi']}`,
  },
};

export function applyTemplate(
  key: TemplateKey,
  answers: Record<string, string>,
  overrides: { priority?: string; components?: string[] } = {}
) {
  const tpl = TEMPLATES[key];
  const summary     = answers['summary'] ?? (tpl.buildSummary ? tpl.buildSummary(answers) : '');
  const description = tpl.buildDescription(answers);

  return {
    summary,
    description,
    issuetype:  tpl.issuetype,
    priority:   overrides.priority ?? tpl.defaultPriority,
    labels:     tpl.labels,
    components: overrides.components ?? [],
  };
}
