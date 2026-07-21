// Pengganti klien Supabase milik proyek kanvas.
// Kanvas dulu membuat kliennya sendiri lewat @supabase/ssr dan punya
// halaman login terpisah. Di dalam HRIS itu tak diperlukan: pengguna
// sudah masuk lewat portal, jadi kanvas cukup menumpang sesi yang sama.
import { supabase } from '@/lib/supabase';

export function createBrowserSupabase() {
  return supabase;
}
