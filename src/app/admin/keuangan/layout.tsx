// src/app/admin/keuangan/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoadingLogo from '@/components/LoadingLogo';
import { ambilPeran, jelaskanGalat, type PeranKeuangan } from '@/lib/keuangan/klien';
import { KeuanganProvider } from '@/lib/keuangan/konteks';

const TABS = [
  { href: '/admin/keuangan', label: 'Ringkasan', tepat: true },
  { href: '/admin/keuangan/transaksi', label: 'Transaksi' },
  { href: '/admin/keuangan/anggaran', label: 'Anggaran' },
  { href: '/admin/keuangan/kategori', label: 'Kategori' },
  { href: '/admin/keuangan/laporan', label: 'Laporan' },
];

const LABEL_PERAN: Record<PeranKeuangan, string> = {
  admin: 'Akses penuh',
  finance: 'Bisa mencatat',
  viewer: 'Hanya melihat',
};

export default function KeuanganLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const [peran, setPeran] = useState<PeranKeuangan | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');

  // Penjaga akses. Sengaja TIDAK mengandalkan status "admin" HRIS: di HRIS
  // semua email @invisual.studio otomatis admin, sedangkan keuangan hanya
  // untuk yang terdaftar di finance.app_roles.
  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const p = await ambilPeran();
        if (hidup) setPeran(p);
      } catch (e: unknown) {
        if (hidup) setGalat(jelaskanGalat(e instanceof Error ? e.message : String(e)));
      } finally {
        if (hidup) setMemuat(false);
      }
    })();
    return () => { hidup = false; };
  }, []);

  if (memuat) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingLogo size={48} text="Memeriksa akses keuangan" />
      </div>
    );
  }

  if (galat) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-5">
          <p className="text-sm font-bold text-amber-300">Modul Keuangan belum siap</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-amber-100/80">{galat}</p>
        </div>
      </div>
    );
  }

  if (!peran) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center kartu-glow">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
            <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-white">Akses ditolak</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-gray-400">
            Akun Anda belum terdaftar di modul Keuangan. Halaman ini hanya
            terbuka untuk Owner dan HR. Hubungi Owner kalau Anda memang
            perlu aksesnya.
          </p>
        </div>
      </div>
    );
  }

  return (
    <KeuanganProvider peran={peran}>
      <div>
        <div className="mb-6 flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-3">
          {TABS.map((t) => {
            const aktif = t.tepat ? pathname === t.href : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                  aktif ? 'bg-primer text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {t.label}
              </Link>
            );
          })}

          <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-tint">
            {LABEL_PERAN[peran]}
          </span>
        </div>

        {children}
      </div>
    </KeuanganProvider>
  );
}
