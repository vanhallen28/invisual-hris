// ═══════════════════════════════════════════════════════════════
//  Service Worker — Invisual HRIS
//
//  Pasif: tidak mencegat request jaringan, jadi aman di development
//  maupun produksi. Tugasnya hanya tiga, dan ketiganya untuk
//  notifikasi chat:
//    1. Menampilkan notifikasi terbang berisi isi pesan (push event).
//    2. Menaikkan badge angka merah di ikon (setAppBadge).
//    3. Membuka/mefokuskan HRIS saat notifikasi diklik.
//
//  Badge dibersihkan oleh aplikasi (PwaSetup) tiap kali dibuka.
//  Angkanya disimpan di sini karena payload tidak membawa jumlah.
//
//  PENTING: file ini harus diletakkan di  public/sw.js
//  Ganti setiap kali ada perubahan, lalu tutup total lalu buka lagi
//  aplikasi/PWA agar service worker versi baru terpasang.
// ═══════════════════════════════════════════════════════════════

const BADGE_KEY = "invisual-badge-count";

// Aktif segera, tanpa menunggu tab lama tertutup. Tanpa ini,
// service worker baru bisa menganggur sampai semua tab ditutup.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ── Menyimpan hitungan badge lintas event ──
// Service worker bisa tidur di antara push, jadi angkanya dititipkan
// ke Cache Storage — satu-satunya penyimpanan yang tahan tidur di sini.
async function bacaBadge() {
  try {
    const c = await caches.open("invisual-meta");
    const r = await c.match(BADGE_KEY);
    if (!r) return 0;
    const n = Number(await r.text());
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function tulisBadge(n) {
  try {
    const c = await caches.open("invisual-meta");
    await c.put(BADGE_KEY, new Response(String(n)));
  } catch {
    /* abaikan */
  }
}

// ── Reset badge dari aplikasi ──
// PwaSetup mengirim pesan ini setiap HRIS dibuka/difokuskan, supaya
// hitungan kembali ke nol dan notifikasi berikutnya mulai dari 1.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "reset-badge") {
    event.waitUntil(
      (async () => {
        await tulisBadge(0);
        try {
          if (self.navigator && "clearAppBadge" in self.navigator) {
            await self.navigator.clearAppBadge();
          }
        } catch {
          /* abaikan */
        }
      })()
    );
  }
});

// ── Push masuk: notifikasi terbang + badge ──
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        data = event.data ? event.data.json() : {};
      } catch {
        data = { title: "Invisual HRIS", body: event.data ? event.data.text() : "" };
      }

      const title = data.title || "Invisual HRIS";
      const body = data.body || "";
      const url = data.url || "/";
      const tag = data.tag || "invisual";

      // Naikkan badge di ikon aplikasi.
      const jumlah = (await bacaBadge()) + 1;
      await tulisBadge(jumlah);
      try {
        if (self.navigator && "setAppBadge" in self.navigator) {
          await self.navigator.setAppBadge(jumlah);
        }
      } catch {
        /* sebagian browser belum dukung — abaikan */
      }

      // Tampilkan notifikasi terbang dengan isi pesan.
      await self.registration.showNotification(title, {
        body,
        tag,                       // pesan dari channel sama saling menggantikan, tak menumpuk
        renotify: true,            // tetap berdering walau tag sama
        badge: "/icon-192.png",    // ikon monokrom kecil di status bar Android
        icon: "/icon-192.png",     // ikon besar di dalam notifikasi
        data: { url },
        vibrate: [80, 40, 80],
      });
    })()
  );
});

// ── Klik notifikasi: buka atau fokuskan HRIS ──
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tujuan = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const semua = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Kalau HRIS sudah terbuka di salah satu tab, fokuskan itu dan
      // arahkan ke halaman tujuan — jangan buka tab baru menumpuk.
      for (const klien of semua) {
        if ("focus" in klien) {
          await klien.focus();
          if ("navigate" in klien && tujuan) {
            try { await klien.navigate(tujuan); } catch { /* abaikan */ }
          }
          return;
        }
      }
      // Belum ada tab HRIS — buka baru.
      if (self.clients.openWindow) await self.clients.openWindow(tujuan);
    })()
  );
});
