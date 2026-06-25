'use client';

import HistoryView from '../components/HistoryView';

export default function HistoryPage() {
  return (
    <HistoryView
      filter="all"
      title="Riwayat"
      subtitle="Riwayat pembuatan UAC & tiket JIRA. Edit untuk reproduce, atau hapus."
      emptyText="Belum ada riwayat. Buat UAC atau tiket dulu di"
    />
  );
}
