'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Megaphone, CalendarDays, ChevronRight } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import { loadMyContent, updateContent, statusColor, platformMeta } from '@/lib/tracker/content';
import { ContentDetail } from '@/components/tracker/ContentStudio';

const fmt = (d: any) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—');

// Konten sosmed/marketing yang ditugaskan ke anggota tim — tampil di halaman My Tasks.
export default function MyContent() {
  const { supabase, currentUserId, teamMembers, pushToast }: any = useDashboard();
  const [posts, setPosts] = useState<any[]>([]);
  const [open, setOpen] = useState<any>(null);

  const refresh = useCallback(async () => {
    if (!supabase || !currentUserId) return;
    try { setPosts(await loadMyContent(supabase, currentUserId)); } catch { /* tabel belum ada */ }
  }, [supabase, currentUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async (next: any) => {
    const { id, board_id, created_at, updated_at, ...patch } = next;
    setPosts((p) => p.map((x) => (x.id === id ? next : x)));
    setOpen(next);
    try { await updateContent(supabase, id, patch); }
    catch (e: any) { pushToast('Gagal menyimpan: ' + (e?.message || e)); }
  };

  if (posts.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-2.5">
        <Megaphone size={13} className="text-blue-400" />
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Konten Saya ({posts.length})</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {posts.map((p) => (
          <button key={p.id} onClick={() => setOpen(p)}
            className="group/c w-full flex items-center gap-3 bg-kartu hover:bg-kartu border border-white/10 hover:border-white/10 rounded-lg px-4 py-3 text-left transition-colors">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColor(p.status)}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-gray-200 font-medium truncate">{p.title}</span>
                {p.status === 'Revisi' && <span className="text-[9px] font-bold text-red-300 bg-red-500/15 px-1.5 py-0.5 rounded shrink-0">PERLU REVISI</span>}
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {(p.platform || []).slice(0, 3).map((pl: string) => (
                  <span key={pl} className={`text-[8px] font-bold text-white px-1.5 py-0.5 rounded ${platformMeta(pl).color}`}>{platformMeta(pl).label}</span>
                ))}
                <span className="text-[10px] text-gray-500">{p.content_type}</span>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold text-white shrink-0 ${statusColor(p.status)}`}>{p.status}</span>
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-gray-500 shrink-0 w-20 justify-end"><CalendarDays size={11} />{fmt(p.publish_at)}</span>
            <ChevronRight size={14} className="text-gray-600 group-hover/c:text-gray-300 shrink-0 transition-colors" />
          </button>
        ))}
      </div>

      {open && (
        <ContentDetail
          post={open} members={teamMembers} canManage={false} currentUserId={currentUserId}
          onClose={() => setOpen(null)} onSave={save} onDelete={() => {}}
        />
      )}
    </div>
  );
}
