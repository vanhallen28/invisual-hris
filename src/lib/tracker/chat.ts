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
export async function markRead(supabase: SB, channelId: string, memberId: string, verifikasi = false) {
  const { error } = await supabase.from('chat_reads')
    .upsert({ channel_id: channelId, member_id: memberId, last_read_at: new Date().toISOString() },
            { onConflict: 'channel_id,member_id' });
  // Kalau gagal, lencana belum dibaca tidak akan hilang. Dilaporkan supaya
  // penyebabnya terlihat, bukan menghilang tanpa jejak.
  if (error) throw new Error(error.message);

  // Verifikasi opsional (dipakai sekali saat ruang dibuka, bukan tiap pesan).
  //
  // Kenapa perlu: kalau policy RLS mengizinkan INSERT/UPDATE tapi menutup
  // SELECT, upsert di atas BERHASIL dan tidak melempar apa pun — namun
  // pembacaan baliknya selalu kosong. Akibatnya semua pesan terhitung belum
  // dibaca dan lencana seolah "kembali ke angka awal", persis gejala lama.
  // Tanpa pemeriksaan ini kegagalan tersebut tidak meninggalkan jejak.
  if (!verifikasi) return;

  const { data } = await supabase.from('chat_reads')
    .select('last_read_at')
    .eq('channel_id', channelId)
    .eq('member_id', memberId)
    .maybeSingle();

  if (!data) {
    throw new Error(
      'Penanda "sudah dibaca" tersimpan tapi tidak bisa dibaca kembali. ' +
      'Kemungkinan policy RLS tabel chat_reads mengizinkan menulis tapi menutup SELECT.',
    );
  }
}

/**
 * Kapan channel ini terakhir dibaca oleh anggota tersebut.
 *
 * WAJIB dipanggil SEBELUM `markRead`, karena markRead menimpa nilainya.
 * Dipakai untuk menentukan pesan pertama yang belum dibaca.
 *
 * Gagal baca → null (dianggap tidak ada yang belum dibaca). Sengaja tidak
 * melempar: kegagalan di sini tidak boleh menggagalkan pembukaan ruang.
 */
export async function terakhirDibaca(supabase: SB, channelId: string, memberId: string) {
  try {
    const { data, error } = await supabase.from('chat_reads')
      .select('last_read_at')
      .eq('channel_id', channelId)
      .eq('member_id', memberId)
      .maybeSingle();
    if (error) return null;
    return (data?.last_read_at as string | undefined) || null;
  } catch { return null; }
}

/**
 * Jumlah pesan belum dibaca per channel.
 *
 * TIDAK LAGI memakai RPC `chat_unread_by_channel`. Bukti dari database:
 * `chat_reads` terisi (187 baris), indeks uniknya ada, dan RPC-nya memang
 * menyebut `chat_reads` + `last_read_at` — tapi lencananya tetap kembali
 * penuh setiap login. Artinya penandanya dibaca, hasilnya tidak dipakai
 * untuk menghitung. Sub-query penghitung yang sempat terlihat memang hanya
 * menyaring `channel_id` dan `author_id`, tanpa batas waktu sama sekali.
 *
 * Perhitungannya dipindah ke sini supaya bisa dibaca, diperiksa, dan
 * diperbaiki tanpa menyentuh database.
 *
 * Batas 30 hari + 1000 baris menjaga ongkosnya tetap kecil; lencana toh
 * ditampilkan "99+" di atas 99.
 */
export async function unreadByChannel(supabase: SB, memberId: string) {
  const hasil: { map: Record<string, number>; galat?: string } = { map: {} };
  if (!memberId) return hasil;

  // 1) Kapan tiap channel terakhir dibaca oleh SAYA.
  const { data: reads, error: galatReads } = await supabase
    .from('chat_reads')
    .select('channel_id, last_read_at')
    .eq('member_id', memberId);

  // Gagal baca di sini biasanya berarti RLS menutup SELECT. Tidak dibiarkan
  // senyap: tanpa penanda, semua pesan akan terhitung belum dibaca dan
  // gejalanya mirip bug lama — jadi sebabnya harus kelihatan.
  if (galatReads) hasil.galat = galatReads.message;

  const batas = new Map<string, number>();
  for (const r of (reads || []) as any[]) {
    const t = new Date(r.last_read_at).getTime();
    if (Number.isFinite(t)) batas.set(r.channel_id, t);
  }

  // 2) Pesan orang lain dalam 30 hari terakhir.
  const sejak = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: pesan, error: galatPesan } = await supabase
    .from('chat_messages')
    .select('channel_id, created_at')
    .neq('author_id', memberId)
    .gte('created_at', sejak)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (galatPesan) {
    hasil.galat = hasil.galat || galatPesan.message;
    return hasil;
  }

  // 3) Hitung yang lebih baru dari penandanya.
  //    Dibandingkan sebagai ANGKA — format waktu dari Postgres ("+00:00")
  //    dan dari browser ("Z") berbeda, perbandingan teks bisa meleset.
  for (const m of (pesan || []) as any[]) {
    const b = batas.get(m.channel_id);
    if (b !== undefined && new Date(m.created_at).getTime() <= b) continue;
    hasil.map[m.channel_id] = (hasil.map[m.channel_id] || 0) + 1;
  }

  return hasil;
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
    ? (labels?.[statusCol.id] || []).find((l: any) => l.text === status)?.color || 'bg-kartu-hover'
    : 'bg-kartu-hover';

  const people: string[] = peopleCol ? (item[peopleCol.id] || []) : [];
  const tl = timeCol ? item[timeCol.id] : null;
  const due = Array.isArray(tl) ? tl[1] : tl;

  return { status, statusColor, people, due };
}
