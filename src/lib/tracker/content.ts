// src/lib/tracker/content.ts
// Lapisan data Content Hub (divisi Marketing & Social Media).
type SB = any;

export const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', color: 'bg-[#E1306C]' },
  { id: 'tiktok', label: 'TikTok', color: 'bg-[#00c2cb]' },
  { id: 'facebook', label: 'Facebook', color: 'bg-[#1877F2]' },
  { id: 'linkedin', label: 'LinkedIn', color: 'bg-[#0A66C2]' },
  { id: 'youtube', label: 'YouTube', color: 'bg-[#FF0000]' },
  { id: 'threads', label: 'Threads', color: 'bg-zinc-500' },
  { id: 'x', label: 'X / Twitter', color: 'bg-zinc-700' },
  { id: 'marketplace', label: 'Marketplace', color: 'bg-[#f59e0b]' },
];

export const CONTENT_TYPES = ['Feed', 'Carousel', 'Reels / Video', 'Story', 'Artikel / Blog', 'Ads / Iklan'];

export const CONTENT_STATUS = [
  { id: 'Brief', color: 'bg-zinc-600', ring: 'border-zinc-600' },
  { id: 'Produksi', color: 'bg-[#579bfc]', ring: 'border-[#579bfc]' },
  { id: 'Review', color: 'bg-amber-500', ring: 'border-amber-500' },
  { id: 'Revisi', color: 'bg-red-500', ring: 'border-red-500' },
  { id: 'Approved', color: 'bg-emerald-500', ring: 'border-emerald-500' },
  { id: 'Tayang', color: 'bg-purple-500', ring: 'border-purple-500' },
];

export const statusColor = (s: string) => CONTENT_STATUS.find((x) => x.id === s)?.color || 'bg-zinc-600';
export const platformMeta = (p: string) => PLATFORMS.find((x) => x.id === p) || { id: p, label: p, color: 'bg-zinc-600' };

// Engagement Rate = (likes + comments + shares + saves) / reach * 100
export const engagementRate = (c: any) => {
  const reach = Number(c?.reach || 0);
  if (!reach) return 0;
  const eng = Number(c?.likes || 0) + Number(c?.comments || 0) + Number(c?.shares || 0) + Number(c?.saves || 0);
  return Math.round((eng / reach) * 1000) / 10; // 1 desimal
};

export async function loadContent(supabase: SB, boardId: string) {
  const { data, error } = await supabase
    .from('content_posts')
    .select('*')
    .eq('board_id', boardId)
    .order('publish_at', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data || [];
}

// Konten yang ditugaskan ke seorang anggota (dipakai di My Tasks)
export async function loadMyContent(supabase: SB, memberId: string) {
  const { data, error } = await supabase
    .from('content_posts')
    .select('*')
    .eq('assignee_id', memberId)
    .order('publish_at', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addContent(supabase: SB, payload: any) {
  const { data, error } = await supabase.from('content_posts').insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateContent(supabase: SB, id: string, patch: any) {
  const { error } = await supabase
    .from('content_posts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteContent(supabase: SB, id: string) {
  const { error } = await supabase.from('content_posts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
