// src/lib/lokasi.ts — util lokasi untuk absen (geofence).

/** Koordinat kantor Invisual = DEFAULT geofence absen. Bisa ditimpa admin lewat Pengaturan. */
export const KANTOR_DEFAULT = { lat: -6.914764366993911, lng: 107.67126202481019, radius: 150 };

/** Jarak dua koordinat dalam METER (haversine). */
export function jarakMeter(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Ambil posisi GPS sekarang (Promise). Tolak dengan pesan jelas bila gagal. */
export function ambilPosisi(timeoutMs = 12000): Promise<{ lat: number; lng: number; akurasi: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Perangkat tidak mendukung lokasi."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: pos.coords.accuracy }),
      (err) => reject(new Error(err.code === 1 ? "Izin lokasi ditolak. Aktifkan lokasi di browser/HP." : "Gagal mendapatkan lokasi. Coba lagi.")),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}
