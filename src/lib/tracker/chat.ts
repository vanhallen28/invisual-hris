// src/lib/tracker/chat.ts — lapisan data Chat (ala Discord)
type SB = any;

export const EMOJIS = ['👍', '❤️', '🔥', '✅', '👀', '🎉', '😂', '🙏'];

/* ═══════════ CHANNEL ═══════════ */
export async function loadChannels(supabase: SB) {
  const { data, error } = await supabase.from('chat_channels').select('*').order('position').order('name');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function loadChannelMembers(supabase: SB) {
  const { data } = await supabase.from('chat_channel_members').select('*');
  return data || [];
}

// (is_voice ditambahkan lewat payload dari modal)
export async function createChannel(supabase: SB, p: any) {
  const { data, error } = await supabase.from('chat_channels').insert(p).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateChannel(supabase: SB, id: string, patch: any) {
  const { error } = await supabase.from('chat_channels').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteChannel(supabase: SB, id: string) {
  const { error } = await supabase.from('chat_channels').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setChannelMembers(supabase: SB, channelId: string, memberIds: string[]) {
  await supabase.from('chat_channel_members').delete().eq('channel_id', channelId);
  if (memberIds.length) {
    const { error } = await supabase.from('chat_channel_members')
      .insert(memberIds.map((id) => ({ channel_id: channelId, member_id: id })));
    if (error) throw new Error(error.message);
  }
}

/* ═══════════ PESAN ═══════════ */
export async function loadMessages(supabase: SB, channelId: string, limit = 60) {
  const { data, error } = await supabase
    .from('chat_messages').select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).slice().reverse();
}

export async function sendMessage(supabase: SB, p: any) {
  const { data, error } = await supabase.from('chat_messages').insert(p).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function editMessage(supabase: SB, id: string, content: string) {
  const { error } = await supabase.from('chat_messages')
    .update({ content, edited_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteMessage(supabase: SB, id: string) {
  const { error } = await supabase.from('chat_messages').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setPinned(supabase: SB, id: string, pinned: boolean) {
  const { error } = await supabase.from('chat_messages').update({ pinned }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setTaskRef(supabase: SB, id: string, taskRef: string | null) {
  const { error } = await supabase.from('chat_messages').update({ task_ref: taskRef }).eq('id', id);
  if (error) throw new Error(error.message);
}

/* ═══════════ REACTION ═══════════ */
export async function loadReactions(supabase: SB, messageIds: string[]) {
  if (!messageIds.length) return [];
  const { data } = await supabase.from('chat_reactions').select('*').in('message_id', messageIds);
  return data || [];
}

export async function toggleReaction(supabase: SB, messageId: string, memberId: string, emoji: string, on: boolean) {
  if (on) {
    const { error } = await supabase.from('chat_reactions').insert({ message_id: messageId, member_id: memberId, emoji });
    if (error && !String(error.message).includes('duplicate')) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('chat_reactions').delete()
      .eq('message_id', messageId).eq('member_id', memberId).eq('emoji', emoji);
    if (error) throw new Error(error.message);
  }
}

/* ═══════════ BELUM DIBACA ═══════════ */
export async function markRead(supabase: SB, channelId: string, memberId: string) {
  const { error } = await supabase.from('chat_reads')
    .upsert({ channel_id: channelId, member_id: memberId, last_read_at: new Date().toISOString() },
            { onConflict: 'channel_id,member_id' });
  // Kalau gagal, lencana belum dibaca tidak akan hilang. Dilaporkan supaya
  // penyebabnya terlihat, bukan menghilang tanpa jejak.
  if (error) throw new Error(error.message);
}

export async function unreadByChannel(supabase: SB) {
  const { data, error } = await supabase.rpc('chat_unread_by_channel');
  if (error) return {};
  const map: Record<string, number> = {};
  (data || []).forEach((r: any) => { map[r.channel_id] = Number(r.unread || 0); });
  return map;
}

/* ═══════════ LAMPIRAN ═══════════ */
export async function uploadChatFile(supabase: SB, file: File) {
  const safe = file.name.replace(/[^\w.\-]/g, '_');
  const path = `chat/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const { error } = await supabase.storage.from('doc-assets').upload(path, file);
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('doc-assets').getPublicUrl(path);
  return { name: file.name, url: data.publicUrl, type: file.type || '' };
}

/* ═══════════ INTEGRASI DAILY TASK ═══════════ */
export function findTask(boardsDataMap: any, itemId: string) {
  for (const boardId of Object.keys(boardsDataMap || {})) {
    for (const g of boardsDataMap[boardId].groups || []) {
      for (const it of g.items || []) {
        if (it.id === itemId) return { boardId, groupId: g.id, item: it };
        for (const s of it.subItems || []) {
          if (s.id === itemId) return { boardId, groupId: g.id, item: s, parentName: it.name };
        }
      }
    }
  }
  return null;
}

export function searchTasks(boardsDataMap: any, q: string, limit = 10) {
  const out: any[] = [];
  const ql = q.trim().toLowerCase();
  for (const boardId of Object.keys(boardsDataMap || {})) {
    for (const g of boardsDataMap[boardId].groups || []) {
      for (const it of g.items || []) {
        if (!ql || String(it.name || '').toLowerCase().includes(ql)) {
          out.push({ boardId, groupId: g.id, item: it, groupTitle: g.title, groupColor: g.color });
          if (out.length >= limit) return out;
        }
      }
    }
  }
  return out;
}

// Ambil ringkasan tugas (status, PIC, deadline) untuk kartu di dalam pesan
export function taskMeta(boardsDataMap: any, boardId: string, item: any, labels: any) {
  const cols = boardsDataMap?.[boardId]?.columns || [];
  const statusCol = cols.find((c: any) => c.type === 'status');
  const peopleCol = cols.find((c: any) => c.type === 'people');
  const timeCol = cols.find((c: any) => c.type === 'timeline' || c.type === 'date');

  const status = statusCol ? item[statusCol.id] : '';
  const statusColor = statusCol
    ? (labels?.[statusCol.id] || []).find((l: any) => l.text === status)?.color || 'bg-zinc-700'
    : 'bg-zinc-700';

  const people: string[] = peopleCol ? (item[peopleCol.id] || []) : [];
  const tl = timeCol ? item[timeCol.id] : null;
  const due = Array.isArray(tl) ? tl[1] : tl;

  return { status, statusColor, people, due };
}
