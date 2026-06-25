'use client';

import HistoryView from '../components/HistoryView';

export default function DraftPage() {
  return (
    <HistoryView
      filter="draft"
      title="Draft"
      subtitle="UAC & breakdown yang sudah dibuat tapi belum dikirim ke JIRA. Lanjutkan, edit, atau hapus."
      emptyText="Belum ada draft. Generate UAC atau breakdown dulu di"
    />
  );
}
