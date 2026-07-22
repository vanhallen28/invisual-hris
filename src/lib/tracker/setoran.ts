// src/lib/tracker/setoran.ts
// Setoran Daily — bukti laporan harian berupa tangkapan layar.
// Nama & foto TIDAK disimpan di sini; diambil dari employees lewat user_id.

type SB = any;

export const SETORAN_BUCKET = 'setoran';
export const SETORAN_HARI = 30;

const batasWaktu = () =>
  new Date(Date.now() - SETORAN_HARI * 86400000).toISOString();

/* ═══════════ ANGGOTA ═══════════ */

export async function loadSetoranMembers(supabase: SB) {
  const { data, error } = await supabase
    .from('setoran_members')
    .select('user_id, created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addSetoranMember(supabase: SB, userId: string, olehId: string) {
  const { error } = await supabase
    .from('setoran_members')
    .insert({ user_id: userId, ditambah_oleh: olehId });
  if (error) throw new Error(error.message);
}

export async function removeSetoranMember(supabase: SB, userId: string) {
  const { error } = await supabase.from('setoran_members').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/* ═══════════ SETORAN ═══════════ */

// Hanya 30 hari terakhir — jadi yang kedaluwarsa tak pernah tampil,
// bahkan bila pembersihan otomatis belum sempat berjalan.
export async function loadSetoranPosts(supabase: SB) {
  const { data, error } = await supabase
    .from('setoran_posts')
    .select('id, user_id, image_url, storage_path, caption, created_at')
    .gte('created_at', batasWaktu())
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

// Tandai seluruh setoran seseorang sudah dicek. Dipanggil saat manager
// membuka aliran orang itu. Penandanya di database, jadi berlaku untuk
// semua manager sekaligus — bukan per perangkat.
export async function tandaiSetoranDicek(supabase: SB, userId: string) {
  const { error } = await supabase
    .from('setoran_posts')
    .update({ dilihat_pada: new Date().toISOString() })
    .eq('user_id', userId)
    .is('dilihat_pada', null);
  if (error) throw new Error(error.message);
}

// Berkas boleh kosong — setoran tanpa gambar dipakai sebagai catatan QC.
export async function uploadSetoran(supabase: SB, file: File | null, userId: string, caption?: string) {
  let imageUrl: string | null = null;
  let path: string | null = null;

  if (file) {
    const aman = file.name.replace(/[^\w.\-]/g, '_');
    path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${aman}`;

    const { error: upErr } = await supabase.storage
      .from(SETORAN_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: pub } = supabase.storage.from(SETORAN_BUCKET).getPublicUrl(path);
    imageUrl = pub.publicUrl;
  } else if (!caption?.trim()) {
    throw new Error('Tulis catatan atau lampirkan gambar dulu');
  }

  const { data, error } = await supabase
    .from('setoran_posts')
    .insert({
      user_id: userId,
      image_url: imageUrl,
      storage_path: path,
      caption: caption?.trim() || null,
    })
    .select()
    .single();
  if (error) {
    // Baris gagal dibuat → jangan tinggalkan berkas yatim di storage.
    await supabase.storage.from(SETORAN_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return data;
}

export async function deleteSetoran(supabase: SB, post: any) {
  if (post?.storage_path) {
    await supabase.storage.from(SETORAN_BUCKET).remove([post.storage_path]);
  }
  const { error } = await supabase.from('setoran_posts').delete().eq('id', post.id);
  if (error) throw new Error(error.message);
}

// Jumlah setoran orang lain yang masuk sejak terakhir ruang ini dibuka.
// Dipakai untuk lencana notifikasi di sidebar chat.
export async function countSetoranBaru(supabase: SB, sejakISO: string, kecualiUserId: string) {
  const { count, error } = await supabase
    .from('setoran_posts')
    .select('id', { count: 'exact', head: true })
    .gt('created_at', sejakISO)
    .neq('user_id', kecualiUserId);
  if (error) return 0;
  return count || 0;
}

/* ═══════════ PENANDA SUDAH DILIHAT ═══════════ */
// Kunci ini dipakai bersama oleh ChatApp (lencana) dan SetoranRoom.

export const SETORAN_SEEN_KEY = 'invisual_setoran_seen';

export function tandaiSetoranDilihat() {
  // +1 detik ke depan: countSetoranBaru membandingkan dengan "gt" (lebih
  // besar dari), jadi margin ini mencegah setoran yang tercatat di detik
  // yang sama terhitung ulang saat halaman dimuat kembali.
  try { localStorage.setItem(SETORAN_SEEN_KEY, new Date(Date.now() + 1000).toISOString()); } catch { /* abaikan */ }
}

/* ═══════════ PEMBERSIHAN 30 HARI ═══════════ */
// Menghapus berkas lewat Storage API (bukan sekadar baris database),
// supaya storage benar-benar tidak menumpuk.
// Dipanggil otomatis saat manajer membuka Setoran Daily.
export async function purgeSetoranKedaluwarsa(supabase: SB) {
  const { data, error } = await supabase
    .from('setoran_posts')
    .select('id, storage_path')
    .lt('created_at', batasWaktu());
  if (error || !data || data.length === 0) return 0;

  const paths = data.map((d: any) => d.storage_path).filter(Boolean);
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from(SETORAN_BUCKET).remove(paths.slice(i, i + 100));
  }
  await supabase.from('setoran_posts').delete().in('id', data.map((d: any) => d.id));
  return data.length;
}
