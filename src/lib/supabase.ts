// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Client Supabase — dipanggil setiap kali butuh berkomunikasi dengan database.
//
// Opsi auth di bawah dulu tidak diisi, sehingga bergantung pada default
// yang bisa berbeda antar versi. Untuk portal yang harus tetap login di
// ponsel, ketiganya dikunci eksplisit:
//
//   persistSession     — sesi disimpan ke localStorage, bertahan melewati
//                        penutupan tab dan restart browser. Tanpa ini,
//                        sesi hilang begitu tab ditutup.
//   autoRefreshToken   — token diperpanjang otomatis sebelum kedaluwarsa.
//                        Inilah kunci "tetap login": tanpa ini token mati
//                        setelah masa berlakunya dan pengguna tertendang.
//   detectSessionInUrl — menangkap sesi dari URL setelah alur OAuth
//                        (login Google di halaman callback).
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'invisual-auth',   // nama tetap, agar tidak bentrok antar versi
  },
});
