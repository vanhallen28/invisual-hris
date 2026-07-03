'use client';
import { useEffect, useRef } from 'react';
import { useDashboard } from '@/components/tracker/DashboardContext';

// Notifikasi realtime: dengarkan INSERT ke item_updates → toast saat ada pesan/lampiran baru.
// Lewati pesan sendiri; hanya untuk tugas yang ada di data user (member=tugasnya, manajer=semua).
export default function NotificationCenter() {
  const { supabase, currentUserId, teamMembers, boardsDataMap, pushToast, setDetailItem, setActiveBoardId }: any = useDashboard();
  const ref = useRef<any>({});
  ref.current = { currentUserId, teamMembers, boardsDataMap, pushToast, setDetailItem, setActiveBoardId };
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('notif-item-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'item_updates' }, (payload: any) => {
        const row = payload?.new;
        const { currentUserId, teamMembers, boardsDataMap, pushToast, setDetailItem, setActiveBoardId } = ref.current;
        if (!row || !row.id || row.author_id === currentUserId) return;
        if (seen.current.has(row.id)) return;
        seen.current.add(row.id);

        // Cari tugasnya di data user (kalau tak ada = bukan urusan user ini → lewati)
        let taskName: string | null = null;
        let loc: { boardId: string; groupId: string; itemId: string } | null = null;
        for (const bId of Object.keys(boardsDataMap || {})) {
          for (const g of (boardsDataMap[bId].groups || [])) {
            for (const it of (g.items || [])) {
              if (it.id === row.item_id) { taskName = it.name; loc = { boardId: bId, groupId: g.id, itemId: it.id }; }
              else for (const s of (it.subItems || [])) if (s.id === row.item_id) { taskName = s.name; loc = { boardId: bId, groupId: g.id, itemId: it.id }; }
              if (taskName) break;
            }
            if (taskName) break;
          }
          if (taskName) break;
        }
        if (!taskName) return;

        const author = (teamMembers || []).find((m: any) => m.id === row.author_id)?.name || 'Seseorang';
        const isFile = /^https?:\/\//i.test(row.text || '');
        const preview = isFile ? '📎 mengirim lampiran' : (row.text.length > 45 ? row.text.slice(0, 45) + '…' : row.text);

        pushToast(`💬 ${author} di "${taskName}": ${preview}`, loc ? () => { setActiveBoardId(loc!.boardId); setDetailItem({ groupId: loc!.groupId, itemId: loc!.itemId }); } : undefined, 'Buka', 15000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  return null;
}
