// src/lib/tracker/emoji.ts
type SB = any;

export const EMOJI_GROUPS: { id: string; label: string; list: string[] }[] = [
  {
    id: 'wajah', label: 'Wajah',
    list: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😋','😛','😜','🤪','🤨','🧐','🤓','😎','🥳','😏','😒','😔','😟','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤯','😳','🥵','🥶','😱','😨','😰','😥','🤗','🤔','🤭','🤫','😶','😐','😑','😬','🙄','😯','😲','🥱','😴','🤤','🤐','🥴','🤢','🤧','😷','🤒'],
  },
  {
    id: 'gestur', label: 'Gestur',
    list: ['👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤝','🙏','💪','✍️','👏','🙌','👐','🤲','🫡','🫰','🤝'],
  },
  {
    id: 'hati', label: 'Hati',
    list: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💯'],
  },
  {
    id: 'kerja', label: 'Kerja',
    list: ['💼','📁','📂','📅','📆','🗓️','📊','📈','📉','📋','📌','📎','✏️','🖊️','🖌️','💻','🖥️','⌨️','🖱️','📱','📞','📧','✉️','📩','📤','📥','🗂️','⏰','⏱️','⏳','🔔','🔕','🔒','🔓','🔑','💡','🔍','🔎','🗒️','📝'],
  },
  {
    id: 'objek', label: 'Objek',
    list: ['🔥','⭐','🌟','✨','⚡','💥','💫','🎉','🎊','🎁','🏆','🥇','🎯','🚀','☕','🍕','🍔','🍟','🌮','🍰','🎂','🍺','🍻','🥂','🎵','🎶','📷','📸','🎬','🎮','🎨','🖼️','📢','📣'],
  },
  {
    id: 'simbol', label: 'Simbol',
    list: ['✅','❌','⭕','❗','❓','⚠️','🚫','🆗','🆕','🔴','🟠','🟡','🟢','🔵','🟣','⚪','⚫','➕','➖','✔️','☑️','🔁','🔄','⬆️','⬇️','➡️','⬅️'],
  },
];

// Stiker bawaan: emoji besar (dikirim sendiri → tampil jumbo)
export const BUILTIN_STICKERS = ['👍','🔥','🎉','✅','❤️','😂','🙏','💪','👏','🚀','☕','😴','🤯','💯','👀','🥳'];

// Deteksi pesan yang isinya hanya emoji (untuk ditampilkan besar/jumbo)
export const isOnlyEmoji = (s: string) => {
  const t = String(s || '').trim();
  if (!t || t.length > 8) return false;
  return /^[\p{Extended_Pictographic}\u200d\uFE0F]+$/u.test(t);
};

/* ═══════ STIKER KUSTOM (diunggah manajer) ═══════ */
export async function loadStickers(supabase: SB) {
  const { data, error } = await supabase.from('chat_stickers').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function addSticker(supabase: SB, file: File, memberId: string) {
  const safe = file.name.replace(/[^\w.\-]/g, '_');
  const path = `stickers/${Date.now()}-${safe}`;
  const up = await supabase.storage.from('doc-assets').upload(path, file);
  if (up.error) throw new Error(up.error.message);
  const { data } = supabase.storage.from('doc-assets').getPublicUrl(path);
  const { data: row, error } = await supabase.from('chat_stickers')
    .insert({ name: file.name.replace(/\.[^.]+$/, '').slice(0, 40), url: data.publicUrl, created_by: memberId })
    .select().single();
  if (error) throw new Error(error.message);
  return row;
}

export async function deleteSticker(supabase: SB, id: string) {
  const { error } = await supabase.from('chat_stickers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
