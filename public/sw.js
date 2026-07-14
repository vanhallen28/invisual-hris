// public/sw.js
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// PENTING: handler ini sengaja DIBIARKAN KOSONG.
// Sebelumnya kami memakai event.respondWith(fetch(event.request)) yang mencegat
// SEMUA request (termasuk ke Supabase). Kalau satu request gagal / dibatalkan
// saat pindah halaman, hasilnya "TypeError: Failed to fetch".
// Handler kosong tetap memenuhi syarat installability PWA, tapi membiarkan
// browser menangani jaringan seperti biasa.
self.addEventListener('fetch', () => {});
