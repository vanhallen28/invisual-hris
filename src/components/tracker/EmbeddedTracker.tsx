'use client';
import { DashboardProvider, useDashboard } from '@/components/tracker/DashboardContext';
import ManagerBoard from '@/components/tracker/ManagerBoard';
import MyTasks from '@/components/tracker/MyTasks';
import ItemDetailPanel from '@/components/tracker/ItemDetailPanel';

// Pintu masuk Tracker yang disematkan. Menampilkan konten sesuai PERAN (members.role):
//  - manager -> board penuh (Sidebar + semua view)
//  - member  -> My Tasks miliknya
function Inner() {
  const { currentUserRole }: any = useDashboard();
  if (currentUserRole === 'manager') return <ManagerBoard />;
  return (
    <div className="font-sans text-gray-200">
      <MyTasks />
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
