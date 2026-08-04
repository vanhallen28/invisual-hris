'use client';
import { useState } from 'react';
import { DashboardProvider, useDashboard } from '@/components/tracker/DashboardContext';
import ManagerBoard from '@/components/tracker/ManagerBoard';
import MyTasks from '@/components/tracker/MyTasks';
import AntreanAcc from '@/components/tracker/AntreanAcc';
import ItemDetailPanel from '@/components/tracker/ItemDetailPanel';

// Pintu masuk Tracker yang disematkan. Menampilkan konten sesuai PERAN (members.role):
//  - manager        -> board penuh (Sidebar + semua view, termasuk Antrean)
//  - member + ACC   -> Tugas Saya + tab Antrean (akses "tanggung": boleh ACC brief,
//                      tanpa board penuh)
//  - member biasa   -> Tugas Saya miliknya
function Inner() {
  const { currentUserRole, canAcc }: any = useDashboard();
  const [tab, setTab] = useState<'tugas' | 'antrean'>('tugas');

  if (currentUserRole === 'manager') return <ManagerBoard />;

  return (
    <div className="font-sans text-gray-200">
      {canAcc && (
        <div className="flex gap-1.5 px-4 pt-4 max-w-3xl mx-auto">
          {([['tugas', 'Tugas Saya'], ['antrean', 'Antrean ACC']] as const).map(([nilai, label]) => (
            <button
              key={nilai}
              onClick={() => setTab(nilai)}
              className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                tab === nilai ? 'bg-primer text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {canAcc && tab === 'antrean' ? (
        <div className="max-w-3xl mx-auto px-4 py-6">
          <AntreanAcc />
        </div>
      ) : (
        <MyTasks />
      )}
      <ItemDetailPanel />
    </div>
  );
}

export default function EmbeddedTracker() {
  return (
    <DashboardProvider embedded>
      <Inner />
    </DashboardProvider>
  );
}
