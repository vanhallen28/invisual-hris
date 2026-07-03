'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDashboard } from '@/components/tracker/DashboardContext';
import Sidebar from '@/components/tracker/Sidebar';
import MainTable from '@/components/tracker/MainTable';
import KanbanBoard from '@/components/tracker/KanbanBoard';
import Overview from '@/components/tracker/Overview';
import TimelineView from '@/components/tracker/TimelineView';
import ItemDetailPanel from '@/components/tracker/ItemDetailPanel';
import MyTasks from '@/components/tracker/MyTasks';
import ViewTabs from '@/components/tracker/ViewTabs';
import CalendarView from '@/components/tracker/CalendarView';
import WorkloadView from '@/components/tracker/WorkloadView';
import { LayoutGrid, Download, X, Copy, Trash2, Menu, ChevronLeft } from 'lucide-react';

// Konten board (breadcrumb + tombol kembali + view aktif + panel detail + toolbar massal).
function BoardContent({ onMenuClick }: any) {
  const {
    activeView, activeViewId, activeBoardName, activeBoardId, activeBoardPath,
    handleExportCSV, selectedItems, setSelectedItems, triggerConfirm, handleBulkDelete, handleBulkDuplicate,
  }: any = useDashboard();
  const pathname = usePathname();
  const backHref = pathname && pathname.startsWith('/admin') ? '/admin/dashboard' : '/user/dashboard';

  return (
    <div className="flex-1 flex flex-col bg-[#181b24] overflow-hidden min-w-0">
      <div className="h-12 border-b border-zinc-800/60 bg-[#1a1d24] flex items-center gap-2 px-3 shrink-0 z-30">
        <Link href={backHref} title="Kembali ke Portal HRIS" className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#2b5cd5] hover:bg-[#2450bd] px-3 py-1.5 rounded-lg transition-all shrink-0 shadow-[0_0_14px_rgba(43,92,213,0.45)] hover:shadow-[0_0_18px_rgba(43,92,213,0.6)]"><ChevronLeft size={15} /> Portal</Link>
        <button onClick={onMenuClick} className="md:hidden p-1.5 text-zinc-400 hover:text-white rounded transition-colors shrink-0"><Menu size={18} /></button>
        <div className="w-px h-5 bg-zinc-800 mx-1 hidden sm:block" />
        <div className="flex items-center gap-2 text-xs font-semibold min-w-0">
          {activeBoardPath ? (
            <>
              <span className="text-zinc-500 truncate hidden sm:inline">{activeBoardPath.year}</span>
              <span className="text-zinc-600 hidden sm:inline">›</span>
              <span className="text-zinc-500 truncate hidden sm:inline">{activeBoardPath.month}</span>
              <span className="text-zinc-600 hidden sm:inline">›</span>
              <span className="text-zinc-100 font-bold truncate">{activeBoardPath.board}</span>
            </>
          ) : (
            <span className="text-zinc-200 font-bold uppercase tracking-widest">Daily Work Tracker</span>
          )}
        </div>
      </div>

      {!activeBoardId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-6">
          <div className="bg-zinc-900/30 p-10 rounded-3xl flex flex-col items-center border border-zinc-800/50 shadow-2xl">
            <LayoutGrid size={64} className="mb-6 text-blue-500/20" />
            <h2 className="text-xl font-bold text-zinc-300 mb-2">Belum Ada Project Terpilih</h2>
            <p className="text-sm text-zinc-500 max-w-sm text-center">Pilih atau buat project baru di menu Sidebar sebelah kiri.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pt-5 px-4 sm:px-8 pb-24 flex flex-col">
          <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-col">
            <div className="flex flex-col gap-4 mb-6 border-b border-zinc-800/60 pb-0 shrink-0">
              <div className="flex justify-between items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold tracking-wide uppercase text-zinc-100 truncate">{activeViewId === 'mytasks' ? 'My Tasks' : activeBoardName}</h1>
                {activeViewId !== 'mytasks' && <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700/60 rounded text-xs font-semibold hover:bg-zinc-700 transition-colors shrink-0"><Download size={14}/> <span className="hidden sm:inline">Export CSV</span></button>}
              </div>
              <ViewTabs />
            </div>

            {activeViewId === 'mytasks' && <MyTasks />}
            {activeViewId !== 'mytasks' && activeView?.type === 'table' && <MainTable />}
            {activeViewId !== 'mytasks' && activeView?.type === 'kanban' && <KanbanBoard />}
            {activeViewId !== 'mytasks' && activeView?.type === 'gantt' && <TimelineView />}
            {activeViewId !== 'mytasks' && activeView?.type === 'chart' && <Overview />}
            {activeViewId !== 'mytasks' && activeView?.type === 'calendar' && <CalendarView />}
            {activeViewId !== 'mytasks' && activeView?.type === 'workload' && <WorkloadView />}
          </div>
        </div>
      )}

      <ItemDetailPanel />

      {selectedItems.length > 0 && activeViewId !== 'mytasks' && activeView?.type === 'table' && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#2a2c38] border border-blue-500/50 shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-5 z-[80]">
          <div className="flex items-center gap-2"><div className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold">{selectedItems.length}</div><span className="text-zinc-300 text-xs font-semibold">Selected</span></div>
          <div className="w-[1px] h-5 bg-zinc-700"></div>
          <button onClick={() => handleBulkDuplicate(selectedItems)} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-zinc-700/50 rounded-full text-zinc-300 text-xs font-bold"><Copy size={14} /> Duplicate</button>
          <button onClick={() => triggerConfirm('Bulk Delete', `Hapus ${selectedItems.length} item secara massal?`, () => handleBulkDelete(selectedItems))} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-500/10 text-red-400 rounded-full text-xs font-bold"><Trash2 size={14} /> Delete</button>
          <button onClick={() => setSelectedItems([])} className="p-1 text-zinc-500 hover:text-zinc-300 rounded-full"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}

// Board penuh manajer — FULL-SCREEN (menutupi shell HRIS). z-[70]: di atas nav HRIS,
// di bawah overlay Tracker (dokumen/chat/toast z-100+). Tombol "Portal" untuk kembali.
export default function ManagerBoard() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <div className="fixed inset-0 z-[70] flex bg-[#181b24] text-zinc-100 font-sans overflow-hidden animate-in fade-in duration-200">
      <Sidebar mobileOpen={mobileNavOpen} setMobileOpen={setMobileNavOpen} />
      <BoardContent onMenuClick={() => setMobileNavOpen(true)} />
    </div>
  );
}
