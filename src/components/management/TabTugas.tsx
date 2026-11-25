// src/components/management/TabTugas.tsx
// Management → Tugas (tugas.sql). Alur harian yang SEARAH di satu halaman:
//   1 Pagi: pilih maks. 3 Fokus hari ini → 2 Kerjakan: ubah status, centang tugas rutin, selesaikan tugas →
//   3 Sore: Ringkasan Harian terisi dari fokus & tugas yang selesai (leader) → 4 Dibaca management.
// Sub "Tim" (SM/PM, termasuk akun @invisual.studio): kepatuhan semua orang, papan semua tugas, beri tugas,
// dan "Lihat sebagai" (tampilan orang lain, hanya baca — tidak ada yang tersimpan).
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { muatPetaLibur } from "@/lib/hariLiburData";
import { DIVISI_LABEL, PERAN_LABEL, type PeranManagement } from "@/lib/management/akses";
import { hitungPerluTindakan, type DataTindakan, type ItemTindakan } from "@/lib/management/perluTindakan";
import { muatDampak, muatUsulan } from "@/lib/management/usulan";
import { tambahHariIso } from "@/lib/management/hariKerja";
import { muatSerahTerima } from "@/lib/management/serahTerima";
import { MAKS_BUTIR, MAKS_KARAKTER, hariDihitung, kirimRingkasan, muatCutiLeader, muatRingkasan, petaCutiLeader, ringkasanTepatWaktu } from "@/lib/management/harian";
import {
  LABEL_RITME, LABEL_STATUS_FOKUS, MAKS_FOKUS, batalkanTugas, menitWib, beriTugas, centangRutin, hapusFokus, hariIniWib, hitungKepatuhan, isiRingkasan,
  kalenderDiajukan, kolomPapan, langkahSekarang, muatDataTugas, selesaikanTugas, statusOtomatis, statusRutin, tambahFokus, tugasTepatWaktu,
  ubahFokus, validasiTugasBaru, warnaTugas,
  type Anggota, type DataTugas, type Fokus, type Ritme, type StatusFokus, type Tugas,
} from "@/lib/management/tugas";
import type { PetaLibur } from "@/lib/hariLibur";
import type { Fitur } from "./Management";
import { Kosong, Lencana, PesanGalat, kelasInput, kelasLabel, kelasTombol, kelasTombolUtama, type Warna } from "./ui";

const LEADER = ["leader_sosmed", "leader_service", "leader_marketplace"];
const SUMBER_LABEL: Record<string, string> = {
  ringkasan_harian: "Ringkasan Harian terkirim", serah_terima: "Kartu serah terima Anda tidak terlambat", tindak_lanjut: "Kartu merah sudah ditindaklanjuti",
  teruskan_usulan: "Usulan baru sudah diteruskan", putuskan_usulan: "Usulan siap diputuskan sudah diputuskan", review_dea: "Review Dea sudah diputuskan",
  kalender_bulanan: "Kalender/jadwal bulan depan diajukan", cuti: "Dipantau dari data cuti",
};
type Konteks = {
  usulan: DataTindakan["usulan"]; dampak: DataTindakan["dampak"]; st: NonNullable<DataTindakan["serahTerima"]> | null;
  rh: NonNullable<DataTindakan["ringkasanHariIni"]> | null; peta: PetaLibur | null; cuti: Map<string, Set<string>>;
};

const jam = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).replace(":", ".");
const tgl = (iso: string) => new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).replace(":", ".");
const namaOrang = (a?: Anggota) => (a ? a.nama.replace(/(^|\s)\p{Ll}/gu, (m) => m.toUpperCase()) : "—");
const labelPeran = (a: Anggota) => PERAN_LABEL[a.peran as PeranManagement] || a.peran;
const divisiDari = (a: Anggota): string[] => (LEADER.includes(a.peran) && a.divisi ? [a.divisi] : a.peran === "hr" ? ["hr"] : []);

/** Konteks satu orang: item "Perlu tindakan", status ringkasan, status otomatis rutin. */
function konteksOrang(a: Anggota, k: Konteks, hari: string, sekarang: Date) {
  const leader = LEADER.includes(a.peran);
  const rhSaya = leader && k.rh ? k.rh.find((r) => r.divisi === a.divisi) || null : null;
  const dihitung = leader && a.divisi ? hariDihitung(hari, k.peta, k.cuti.get(a.divisi) || new Set()) : false;
  const items: ItemTindakan[] = hitungPerluTindakan({
    usulan: k.usulan, dampak: k.dampak, tautanPedoman: [], pedomanBelumDibaca: false, peta: k.peta,
    serahTerima: k.st || undefined, ringkasanHariIni: k.rh || undefined, sudahKirimRingkasan: k.rh ? !!rhSaya : undefined, hariIniDihitung: dihitung,
  }, [a.peran as PeranManagement], divisiDari(a), sekarang);
  const oto = statusOtomatis({ items, ringkasanTerkirim: leader && k.rh ? (dihitung ? !!rhSaya : null) : null, kalenderDiajukan: kalenderDiajukan(k.st, divisiDari(a), hari), leader });
  return { leader, rhSaya, dihitung, items, oto };
}

function Langkah({ aktif, leader }: { aktif: 1 | 2 | 3 | 4; leader: boolean }) {
  const L = [
    { n: 1, j: "Rencana pagi", s: "Pilih maks. 3 fokus", ke: "tugas-fokus" },
    { n: 2, j: "Kerjakan", s: "Status fokus, tugas rutin, tugas", ke: "tugas-rutin" },
    ...(leader ? [{ n: 3, j: "Ringkasan Harian", s: "Terisi dari fokus · sebelum 18.00", ke: "tugas-ringkasan" }, { n: 4, j: "Dibaca management", s: "SM, PM, HR, Dea", ke: "tugas-ringkasan" }] : []),
  ];
  return (
    <nav aria-label="Alur harian" className={`grid gap-2 ${leader ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`} data-langkah>
      {L.map((x) => (
        <a key={x.n} href={`#${x.ke}`} aria-current={aktif === x.n ? "step" : undefined}
          className={`grid gap-0.5 rounded-xl border px-3.5 py-3 transition-colors ${aktif === x.n ? "border-tint bg-white/[0.04] ring-1 ring-tint" : "border-white/10 bg-kartu hover:border-white/25"}`}>
          <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">{x.n}{aktif > x.n ? " · selesai" : ""}</span>
          <span className="text-sm font-semibold text-white">{x.j}</span>
          <span className="text-xs text-gray-400">{x.s}</span>
        </a>
      ))}
    </nav>
  );
}

function KartuTugas({ t, untuk, dariNama, sekarang, aksi }: { t: Tugas; untuk?: string; dariNama?: string; sekarang: Date; aksi?: React.ReactNode }) {
  const w = warnaTugas(t, sekarang);
  const garis = w === "merah" ? "border-l-red-400" : w === "kuning" ? "border-l-amber-300" : w === "selesai" ? (tugasTepatWaktu(t) ? "border-l-emerald-400" : "border-l-red-400") : "border-l-white/20";
  const lencana: [Warna, string] | null = w === "merah" ? ["merah", "Terlambat"] : w === "kuning" ? ["kuning", "Hampir tenggat"] : w === "selesai" ? (tugasTepatWaktu(t) ? ["hijau", "Tepat waktu"] : ["merah", "Selesai terlambat"]) : null;
  return (
    <div className={`grid gap-1.5 rounded-lg border border-white/10 border-l-[3px] bg-white/[0.03] p-3 ${garis}`} data-kartu-tugas={t.id}>
      <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-white">{t.judul}</span>{lencana && <Lencana warna={lencana[0]}>{lencana[1]}</Lencana>}</div>
      <span className="text-xs text-gray-400">{untuk ? `Untuk ${untuk} · ` : ""}dari {dariNama || t.dari_email}</span>
      {t.catatan ? <span className="text-xs text-gray-500">{t.catatan}</span> : null}
      <span className="font-mono text-[11px] text-gray-400">{t.status === "selesai" && t.selesai_pada ? `Selesai ${tgl(t.selesai_pada)} · tenggat ${tgl(t.tenggat)}` : `Tenggat ${tgl(t.tenggat)}`}</span>
      {aksi}
    </div>
  );
}

function Papan({ tugas, sekarang, anggota, tampilUntuk, aksi }: { tugas: Tugas[]; sekarang: Date; anggota: Anggota[]; tampilUntuk: boolean; aksi: (t: Tugas) => React.ReactNode }) {
  const k = kolomPapan(tugas, sekarang);
  const nama = (id: string) => namaOrang(anggota.find((a) => a.id === id));
  const dari = (email: string) => { const a = anggota.find((x) => x.email.toLowerCase() === email.toLowerCase()); return a ? `${namaOrang(a)} (${PERAN_LABEL[a.peran as PeranManagement] || a.peran})` : email; };
  const kol: [keyof typeof k, string][] = [["berjalan", "Berjalan"], ["terlambat", "Terlambat"], ["selesai", "Selesai minggu ini"]];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {kol.map(([kunci, label]) => (
        <div key={kunci} className="grid content-start gap-2 rounded-xl border border-white/10 bg-white/[0.015] p-3" data-kolom-tugas={kunci}>
          <div className="flex justify-between font-mono text-[10.5px] uppercase tracking-wider text-gray-500"><span>{label}</span><span>{k[kunci].length}</span></div>
          {k[kunci].length ? k[kunci].map((t) => <KartuTugas key={t.id} t={t} untuk={tampilUntuk ? nama(t.untuk_anggota) : undefined} dariNama={dari(t.dari_email)} sekarang={sekarang} aksi={aksi(t)} />)
            : <p className="text-xs text-gray-600">Kosong</p>}
        </div>
      ))}
    </div>
  );
}

// ── Tampilan satu orang (Tugas saya / Lihat sebagai) ──────────────────────────────
function TampilanOrang({ a, data, k, sekarang, hari, bisaUbah, fiturHarian, muatUlang }: {
  a: Anggota; data: DataTugas; k: Konteks; sekarang: Date; hari: string; bisaUbah: boolean; fiturHarian: boolean; muatUlang: () => Promise<void>;
}) {
  const ko = konteksOrang(a, k, hari, sekarang);
  const fokus: Fokus[] = (a.id === data.idSaya ? data.fokusSaya || [] : data.fokusHariIni.filter((f) => f.anggota_id === a.id)).slice().sort((x, y) => x.urutan - y.urutan);
  const rutin = data.rutinPeran.find((r) => r.peran === a.peran)?.rutin || [];
  const st = statusRutin(rutin, data.cek.filter((c) => c.anggota_id === a.id), ko.oto, hari);
  const hit = hitungKepatuhan(st);
  const tugasSaya = data.tugas.filter((t) => t.untuk_anggota === a.id);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [tambah, setTambah] = useState(false);
  const [teksFokus, setTeksFokus] = useState("");

  const jalankan = async (kunci: string, f: () => Promise<{ ok: boolean; pesan?: string }>) => {
    setSibuk(kunci); setGalat(null);
    const h = await f();
    if (!h.ok) setGalat(h.pesan || "Gagal menyimpan.");
    await muatUlang();
    setSibuk(null);
  };
  // Pilihan fokus: tugas berjalan untuk saya + serah terima saya (dari item Perlu tindakan) yang belum jadi fokus.
  const sudahRef = new Set(fokus.map((f) => `${f.asal}:${f.ref_id}`));
  const pilihan = [
    ...tugasSaya.filter((t) => t.status === "berjalan").map((t) => ({ asal: "tugas" as const, ref: t.id, judul: t.judul, ket: `Tugas · tenggat ${tgl(t.tenggat)}` })),
    ...ko.items.filter((i) => i.kunci.startsWith("st-masuk:")).map((i) => ({ asal: "serah_terima" as const, ref: i.kunci.slice(9), judul: i.ket || i.judul, ket: `Serah terima${i.tenggat ? ` · tenggat ${tgl(i.tenggat)}` : ""}` })),
  ].filter((p) => !sudahRef.has(`${p.asal}:${p.ref}`));

  const terkirim = !!ko.rhSaya;
  const langkah = langkahSekarang(sekarang, terkirim);
  const mendesak = ko.items.filter((i) => i.mendesak).length;

  return (
    <div className="grid min-w-0 gap-4" data-tampilan-orang={a.id}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm text-gray-400"><span className="font-semibold text-white">{namaOrang(a)}</span> · {labelPeran(a)}{a.divisi && LEADER.includes(a.peran) ? ` · ${DIVISI_LABEL[a.divisi] || a.divisi}` : ""}</p>
        {mendesak > 0 && <Lencana warna="kuning">{mendesak} hal mendesak</Lencana>}
      </div>
      <Langkah aktif={ko.leader ? langkah : (langkah > 2 ? 2 : langkah) as 1 | 2} leader={ko.leader} />
      <PesanGalat pesan={galat} />

      {/* 1 · Fokus hari ini */}
      <section id="tugas-fokus" className="scroll-mt-24 rounded-xl border border-white/10 bg-kartu p-5" data-fokus>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h2 className="text-base font-bold text-white">Fokus hari ini</h2>
            <p className="text-xs text-gray-400">Yang sedang dikerjakan. Pilih pagi (maks. {MAKS_FOKUS}); yang belum selesai terbawa ke hari kerja berikutnya. PM dan SM melihatnya.</p></div>
          {bisaUbah && <button type="button" className={kelasTombol} onClick={() => setTambah((v) => !v)} disabled={fokus.length >= MAKS_FOKUS} data-tambah-fokus>{tambah ? "Tutup" : "+ Tambah fokus"}</button>}
        </div>
        {tambah && bisaUbah && (
          <div className="mt-3 grid gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3" data-pilih-fokus>
            {pilihan.length > 0 && <p className="text-xs font-semibold text-gray-400">Dari tugas & serah terima Anda</p>}
            {pilihan.map((p) => (
              <button key={`${p.asal}:${p.ref}`} type="button" disabled={!!sibuk} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-gray-200 hover:border-white/30"
                onClick={() => jalankan("tambah", async () => { const h = await tambahFokus(supabase, p.judul, p.asal, p.ref); if (h.ok) setTambah(false); return h; })}>
                <span>{p.judul}</span><span className="text-xs text-gray-500">{p.ket}</span>
              </button>
            ))}
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const j = teksFokus.trim(); if (!j) return; jalankan("tambah", async () => { const h = await tambahFokus(supabase, j, "sendiri", null); if (h.ok) { setTeksFokus(""); setTambah(false); } return h; }); }}>
              <input className={`${kelasInput} min-w-0 flex-1`} value={teksFokus} maxLength={200} onChange={(e) => setTeksFokus(e.target.value)} placeholder="Atau tulis sendiri, mis. Balas DM campaign Harbolnas" aria-label="Fokus baru" />
              <button type="submit" className={kelasTombolUtama} disabled={!teksFokus.trim() || !!sibuk}>Tambah</button>
            </form>
          </div>
        )}
        <ul className="mt-3 grid gap-2">
          {fokus.length === 0 && <li><Kosong>{bisaUbah ? "Belum ada fokus hari ini. Tekan \"+ Tambah fokus\"." : "Belum memilih fokus hari ini."}</Kosong></li>}
          {fokus.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5" data-fokus-item={f.id}>
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${f.status === "selesai" ? "text-gray-500 line-through" : "text-white"}`}>{f.judul}</div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-gray-500">{f.asal === "tugas" ? "tugas diberikan" : f.asal === "serah_terima" ? "serah terima" : "ditulis sendiri"}{f.terbawa ? " · terbawa dari kemarin" : ""}</div>
              </div>
              {bisaUbah ? (
                <div className="flex items-center gap-1.5">
                  <select className="rounded-md border border-white/10 bg-input px-2 py-1.5 text-xs text-white" value={f.status} disabled={!!sibuk} aria-label={`Status ${f.judul}`}
                    onChange={(e) => jalankan(f.id, () => ubahFokus(supabase, f.id, e.target.value as StatusFokus))}>
                    {(Object.keys(LABEL_STATUS_FOKUS) as StatusFokus[]).map((s) => <option key={s} value={s}>{LABEL_STATUS_FOKUS[s]}</option>)}
                  </select>
                  <button type="button" className={kelasTombol} disabled={!!sibuk} onClick={() => jalankan(f.id, () => hapusFokus(supabase, f.id))} aria-label={`Hapus fokus ${f.judul}`}>Hapus</button>
                </div>
              ) : <Lencana warna={f.status === "selesai" ? "hijau" : f.status === "sedang" ? "biru" : "abu"}>{LABEL_STATUS_FOKUS[f.status]}</Lencana>}
            </li>
          ))}
        </ul>
      </section>

      {/* 2 · Tugas rutin */}
      <section id="tugas-rutin" className="scroll-mt-24" aria-label="Tugas rutin">
        {rutin.length === 0 ? <Kosong>Belum ada tugas rutin untuk peran ini. Akun @invisual.studio bisa menambahkannya di Struktur → peran ini → Tugas rutin.</Kosong> : (
          <div className="grid gap-3 md:grid-cols-3" data-rutin>
            {(["harian", "mingguan", "bulanan"] as Ritme[]).map((r) => {
              const isi = st.filter((s) => s.butir.ritme === r);
              const h = hit[r];
              return (
                <div key={r} className="rounded-xl border border-white/10 bg-kartu p-4" data-rutin-ritme={r}>
                  <div className="flex items-baseline justify-between"><h3 className="text-sm font-bold text-white">{LABEL_RITME[r]}</h3><span className="font-mono text-xs text-gray-400">{h.selesai}/{h.total}</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${h.total ? (h.selesai / h.total) * 100 : 0}%` }} /></div>
                  <ul className="mt-3 grid gap-1">
                    {isi.length === 0 && <li className="text-xs text-gray-600">Tidak ada.</li>}
                    {isi.map((s) => (
                      <li key={s.butir.id} className="flex items-start gap-2.5 rounded-lg px-1.5 py-1.5">
                        <button type="button" role="checkbox" aria-checked={s.selesai === true} aria-label={s.butir.judul} data-rutin-butir={s.butir.id}
                          disabled={s.otomatis || !bisaUbah || !!sibuk} title={s.otomatis ? "Dicentang otomatis oleh sistem" : undefined}
                          onClick={() => jalankan(`r:${s.butir.id}`, () => centangRutin(supabase, s.butir.id, !s.selesai))}
                          className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border text-[12px] font-black ${s.selesai ? "border-emerald-400 bg-emerald-400 text-black" : s.otomatis ? "border-dashed border-white/25" : "border-white/25"} ${!s.otomatis && bisaUbah ? "cursor-pointer" : ""}`}>
                          {s.selesai ? "✓" : ""}
                        </button>
                        <div className="min-w-0">
                          <div className={`text-sm ${s.selesai ? "text-gray-500 line-through" : "text-gray-200"}`}>{s.butir.judul}</div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                            {s.butir.waktu ? <span className="font-mono">{s.butir.waktu}</span> : null}
                            {s.otomatis && <Lencana warna="biru">otomatis</Lencana>}
                          </div>
                          {s.otomatis && <div className="text-[11px] text-gray-500">{s.selesai === null ? "Tidak bisa dicek di sini" : `${SUMBER_LABEL[s.butir.otomatis!]}: ${s.selesai ? "ya" : "belum"}`}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Tugas yang diberikan */}
      <section className="rounded-xl border border-white/10 bg-kartu p-5" data-papan-saya>
        <h2 className="text-base font-bold text-white">Tugas yang diberikan</h2>
        <p className="mb-3 text-xs text-gray-400">Dari Studio Manager, PM, atau akun @invisual.studio. Lewat tenggat otomatis merah dan muncul di panel pemberinya.</p>
        <Papan tugas={tugasSaya} sekarang={sekarang} anggota={data.anggota} tampilUntuk={false}
          aksi={(t) => bisaUbah && t.status === "berjalan" ? <div><button type="button" className={kelasTombol} disabled={!!sibuk} onClick={() => jalankan(t.id, () => selesaikanTugas(supabase, t.id))} data-selesaikan-tugas={t.id}>Selesaikan</button></div> : null} />
      </section>

      {/* 3–4 · Ringkasan Harian (leader) */}
      {ko.leader && fiturHarian && <RingkasanDariTugas a={a} ko={ko} fokus={fokus} data={data} k={k} hari={hari} sekarang={sekarang} bisaUbah={bisaUbah} muatUlang={muatUlang} />}
    </div>
  );
}

function RingkasanDariTugas({ a, ko, fokus, data, k, hari, sekarang, bisaUbah, muatUlang }: {
  a: Anggota; ko: ReturnType<typeof konteksOrang>; fokus: Fokus[]; data: DataTugas; k: Konteks; hari: string; sekarang: Date; bisaUbah: boolean; muatUlang: () => Promise<void>;
}) {
  const hariIni = (iso?: string | null) => !!iso && hariIniWib(new Date(iso)) === hari;
  const awal = ko.rhSaya
    ? { selesai: ko.rhSaya.selesai || [], hambatan: ko.rhSaya.hambatan || [] }
    : isiRingkasan({
        fokus,
        tugasSelesai: data.tugas.filter((t) => t.untuk_anggota === a.id && t.status === "selesai" && hariIni(t.selesai_pada)).map((t) => t.judul),
        serahTerimaSelesai: (k.st || []).filter((x) => x.status === "selesai" && hariIni(x.selesai_pada)
          && ((!!a.divisi && x.ke_divisi === a.divisi) || x.penanggung_jawab_peran === a.peran)).map((x) => x.judul),
      });
  const isi = (xs: string[]) => [0, 1, 2].map((i) => xs[i] || "");
  // Selama belum disentuh, isian mengikuti data terbaru (fokus yang baru diselesaikan langsung masuk).
  const [ubahan, setUbahan] = useState<{ selesai: string[]; hambatan: string[] } | null>(null);
  const nilai = ubahan || { selesai: isi(awal.selesai), hambatan: isi(awal.hambatan) };
  const ubah = (bagian: "selesai" | "hambatan", i: number, v: string) => setUbahan({ ...nilai, [bagian]: nilai[bagian].map((x, j) => (j === i ? v : x)) });
  const [butuh, setButuh] = useState<string>(ko.rhSaya?.butuh_divisi || "");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const tepat = ko.rhSaya ? ringkasanTepatWaktu(ko.rhSaya.dikirim_pertama_pada, hari) : null;
  const lewat18 = menitWib(sekarang) >= 18 * 60;

  if (!ko.dihitung) {
    return (
      <section id="tugas-ringkasan" className="scroll-mt-24 rounded-xl border border-white/10 bg-kartu p-5" data-ringkasan-tugas>
        <h2 className="text-base font-bold text-white">Ringkasan Harian</h2>
        <p className="mt-1 text-sm text-gray-400">Hari ini tidak dihitung (hari libur, atau cuti/izin yang disetujui). Tidak perlu mengirim ringkasan.</p>
      </section>
    );
  }
  const kirim = async () => {
    const s = nilai.selesai.map((x) => x.trim()).filter(Boolean), h = nilai.hambatan.map((x) => x.trim().replace(/\s*—\s*$/, "")).filter(Boolean);
    if (!s.length && !h.length) return setGalat("Isi minimal satu butir Selesai atau Hambatan.");
    if ([...s, ...h].some((x) => x.length > MAKS_KARAKTER)) return setGalat(`Setiap butir paling banyak ${MAKS_KARAKTER} karakter.`);
    setSibuk(true); setGalat(null);
    const r = await kirimRingkasan(supabase, { tanggal: hari, selesai: s, hambatan: h, butuhDivisi: butuh || null });
    setSibuk(false);
    if (!r.ok) return setGalat(r.pesan || "Gagal mengirim.");
    setUbahan(null);
    await muatUlang();
  };
  return (
    <section id="tugas-ringkasan" className="scroll-mt-24 rounded-xl border border-white/10 bg-kartu p-5" data-ringkasan-tugas>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="text-base font-bold text-white">Ringkasan Harian</h2>
          <p className="text-xs text-gray-400">{ko.rhSaya ? "Sudah terkirim. Boleh diperbarui sampai 23.59; waktu kirim pertama yang dihitung." : "Langkah terakhir hari ini. Isian sudah disiapkan dari fokus, tugas, dan serah terima yang selesai hari ini. Ubah seperlunya, lalu kirim sebelum 18.00."}</p></div>
        {ko.rhSaya ? <Lencana warna={tepat ? "hijau" : "merah"} data-status-ringkasan="terkirim">{tepat ? "Tepat waktu" : "Terlambat"} · {jam(ko.rhSaya.dikirim_pertama_pada)}</Lencana>
          : <Lencana warna={lewat18 ? "merah" : "kuning"} data-status-ringkasan="belum">{lewat18 ? "Belum dikirim · lewat 18.00" : "Belum dikirim · sebelum 18.00"}</Lencana>}
      </div>
      <fieldset disabled={!bisaUbah || sibuk} className="mt-4 grid gap-4">
        <div className="grid gap-1.5">
          <span className={kelasLabel}>Selesai (maks. {MAKS_BUTIR})</span>
          {nilai.selesai.map((v, i) => <input key={`s${i}`} className={kelasInput} value={v} maxLength={MAKS_KARAKTER} placeholder={i === 0 ? "Apa yang selesai hari ini" : "Opsional"} aria-label={`Selesai ${i + 1}`} onChange={(e) => ubah("selesai", i, e.target.value)} />)}
        </div>
        <div className="grid gap-1.5">
          <span className={kelasLabel}>Hambatan (maks. {MAKS_BUTIR}) · fokus yang belum selesai, lengkapi alasannya</span>
          {nilai.hambatan.map((v, i) => <input key={`h${i}`} className={kelasInput} value={v} maxLength={MAKS_KARAKTER} placeholder="Opsional" aria-label={`Hambatan ${i + 1}`} onChange={(e) => ubah("hambatan", i, e.target.value)} />)}
        </div>
        <label className={`${kelasLabel} max-w-xs`}>Butuh bantuan dari
          <select className={kelasInput} value={butuh} onChange={(e) => setButuh(e.target.value)}>
            <option value="">— tidak ada</option>
            {["sosmed", "service", "marketplace", "hr"].filter((d) => d !== a.divisi).map((d) => <option key={d} value={d}>{DIVISI_LABEL[d] || d}</option>)}
          </select>
        </label>
        <PesanGalat pesan={galat} />
        {bisaUbah
          ? <div className="flex flex-wrap items-center gap-2"><button type="button" className={kelasTombolUtama} onClick={kirim} data-kirim-ringkasan-tugas>{sibuk ? "Mengirim…" : ko.rhSaya ? "Perbarui ringkasan" : "Kirim ringkasan"}</button>
              {ubahan && !ko.rhSaya && <button type="button" className={kelasTombol} onClick={() => setUbahan(null)} data-isi-ulang>Isi ulang dari fokus &amp; tugas</button>}
              <span className="text-xs text-gray-500">Fokus yang belum selesai otomatis terbawa ke rencana besok pagi.</span></div>
          : <p className="text-xs text-amber-300">Mode lihat sebagai: isian tidak bisa dikirim dari sini.</p>}
      </fieldset>
    </section>
  );
}

// ── Sub "Tim" (SM/PM) ────────────────────────────────────────────────────────────
function Tim({ data, k, sekarang, hari, peran, emailSaya, fiturHarian, muatUlang }: {
  data: DataTugas; k: Konteks; sekarang: Date; hari: string; peran: PeranManagement[]; emailSaya: string; fiturHarian: boolean; muatUlang: () => Promise<void>;
}) {
  const [baru, setBaru] = useState(false);
  const besok18 = `${tambahHariIso(hari, 1)}T18:00`;
  const [form, setForm] = useState({ untuk: "", judul: "", catatan: "", tenggat: besok18 });
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [batal, setBatal] = useState<{ id: string; alasan: string } | null>(null);
  const [lihat, setLihat] = useState<string>("");
  const orang = data.anggota;
  const dilihat = orang.find((a) => a.id === lihat);

  const beri = async () => {
    const tenggatIso = form.tenggat ? new Date(`${form.tenggat}:00+07:00`).toISOString() : "";
    const v = validasiTugasBaru({ ...form, tenggat: tenggatIso }, new Date());
    if (v) return setGalat(v);
    setSibuk("beri"); setGalat(null);
    const h = await beriTugas(supabase, { untuk: form.untuk, judul: form.judul.trim(), catatan: form.catatan.trim() || null, tenggat: tenggatIso });
    setSibuk(null);
    if (!h.ok) return setGalat(h.pesan || "Gagal memberi tugas.");
    setForm({ untuk: "", judul: "", catatan: "", tenggat: besok18 }); setBaru(false);
    await muatUlang();
  };
  const aksiTugas = async (kunci: string, f: () => Promise<{ ok: boolean; pesan?: string }>) => {
    setSibuk(kunci); setGalat(null);
    const h = await f();
    if (!h.ok) setGalat(h.pesan || "Gagal menyimpan.");
    else setBatal(null);
    await muatUlang();
    setSibuk(null);
  };
  const bolehBatal = (t: Tugas) => t.dari_email.toLowerCase() === emailSaya || peran.includes("studio_manager");

  return (
    <div className="grid min-w-0 gap-4" data-tim>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-gray-400">Lihat sebagai
          <select className="rounded-md border border-white/10 bg-input px-2 py-1.5 text-xs text-white" value={lihat} onChange={(e) => setLihat(e.target.value)} data-lihat-sebagai>
            <option value="">— tampilan tim</option>
            {orang.map((a) => <option key={a.id} value={a.id}>{namaOrang(a)} · {PERAN_LABEL[a.peran as PeranManagement] || a.peran}</option>)}
          </select>
        </label>
        {!dilihat && <button type="button" className={kelasTombolUtama} onClick={() => { setBaru((v) => !v); setGalat(null); }} data-tugas-baru>{baru ? "Tutup" : "+ Tugas baru"}</button>}
      </div>

      {dilihat ? (
        <>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" data-mode-lihat>
            <b>Lihat sebagai {namaOrang(dilihat)}.</b> Tampilan sama dengan yang dilihat {namaOrang(dilihat)}, tetapi tidak ada yang bisa diubah atau dikirim dari sini.
          </div>
          <TampilanOrang key={dilihat.id} a={dilihat} data={data} k={k} sekarang={sekarang} hari={hari} bisaUbah={false} fiturHarian={fiturHarian} muatUlang={muatUlang} />
        </>
      ) : (
        <>
          {baru && (
            <section className="grid gap-3 rounded-xl border border-white/10 bg-kartu p-5" data-form-tugas>
              <h2 className="text-base font-bold text-white">Tugas baru</h2>
              <label className={kelasLabel}>Judul<input className={kelasInput} value={form.judul} maxLength={200} onChange={(e) => setForm({ ...form, judul: e.target.value })} placeholder="Mis. Rekap data reach November untuk Review Bulanan" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={kelasLabel}>Untuk
                  <select className={kelasInput} value={form.untuk} onChange={(e) => setForm({ ...form, untuk: e.target.value })}>
                    <option value="">Pilih anggota</option>
                    {orang.map((a) => <option key={a.id} value={a.id}>{namaOrang(a)} · {PERAN_LABEL[a.peran as PeranManagement] || a.peran}</option>)}
                  </select></label>
                <label className={kelasLabel}>Tenggat (WIB)<input type="datetime-local" className={kelasInput} value={form.tenggat} onChange={(e) => setForm({ ...form, tenggat: e.target.value })} /></label>
              </div>
              <label className={kelasLabel}>Catatan (opsional)<input className={kelasInput} value={form.catatan} maxLength={1000} onChange={(e) => setForm({ ...form, catatan: e.target.value })} /></label>
              <PesanGalat pesan={galat} />
              <div className="flex gap-2"><button type="button" className={kelasTombolUtama} onClick={beri} disabled={sibuk === "beri"} data-beri-tugas>{sibuk === "beri" ? "Menyimpan…" : "Berikan tugas"}</button>
                <button type="button" className={kelasTombol} onClick={() => setBaru(false)}>Batal</button></div>
              <p className="text-xs text-gray-500">Penerima melihatnya di Tugas dan di panel &quot;Perlu tindakan&quot;. Bila lewat tenggat, Anda mendapat item &quot;Tugas yang Anda berikan terlambat&quot;.</p>
            </section>
          )}
          {!baru && <PesanGalat pesan={galat} />}

          <section className="min-w-0 rounded-xl border border-white/10 bg-kartu p-5" data-pantau>
            <h2 className="text-base font-bold text-white">Kepatuhan tim hari ini</h2>
            <p className="mb-3 text-xs text-gray-400">Fokus yang sedang dikerjakan, Ringkasan Harian, dan tugas rutin (centang + otomatis). Pilih nama di &quot;Lihat sebagai&quot; untuk rinciannya.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className="border-b border-white/10 text-left font-mono text-[10.5px] uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-3 font-medium">Orang</th><th className="py-2 pr-3 font-medium">Fokus hari ini</th><th className="py-2 pr-3 font-medium">Ringkasan</th>
                  <th className="py-2 pr-3 font-medium">Hari ini</th><th className="py-2 pr-3 font-medium">Minggu ini</th><th className="py-2 pr-3 font-medium">Bulan ini</th><th className="py-2 font-medium">Tugas</th></tr></thead>
                <tbody>
                  {orang.map((a) => {
                    const ko = konteksOrang(a, k, hari, sekarang);
                    const rutin = data.rutinPeran.find((r) => r.peran === a.peran)?.rutin || [];
                    const hit = hitungKepatuhan(statusRutin(rutin, data.cek.filter((c) => c.anggota_id === a.id), ko.oto, hari));
                    const fk = data.fokusHariIni.filter((f) => f.anggota_id === a.id).sort((x, y) => x.urutan - y.urutan);
                    const tg = kolomPapan(data.tugas.filter((t) => t.untuk_anggota === a.id), sekarang);
                    const sel = (h: { selesai: number; total: number }) => (h.total ? `${h.selesai}/${h.total}` : "—");
                    return (
                      <tr key={a.id} className="border-b border-white/5 align-top" data-baris-pantau={a.id}>
                        <td className="py-2.5 pr-3"><button type="button" className="text-left font-semibold text-white hover:underline" onClick={() => setLihat(a.id)}>{namaOrang(a)}</button><div className="text-xs text-gray-500">{PERAN_LABEL[a.peran as PeranManagement] || a.peran}</div></td>
                        <td className="py-2.5 pr-3">{fk.length ? <ul className="grid gap-1">{fk.map((f) => <li key={f.id} className="flex flex-wrap items-center gap-1.5 text-xs text-gray-300"><Lencana warna={f.status === "selesai" ? "hijau" : f.status === "sedang" ? "biru" : "abu"}>{f.status === "sedang" ? "sedang" : f.status === "selesai" ? "selesai" : "belum"}</Lencana>{f.judul}</li>)}</ul> : <span className="text-xs text-gray-600">Belum memilih</span>}</td>
                        <td className="py-2.5 pr-3">{!ko.leader || !fiturHarian ? <span className="text-xs text-gray-600">—</span> : !ko.dihitung ? <Lencana warna="biru">Tidak dihitung</Lencana>
                          : ko.rhSaya ? <Lencana warna={ringkasanTepatWaktu(ko.rhSaya.dikirim_pertama_pada, hari) ? "hijau" : "merah"}>{jam(ko.rhSaya.dikirim_pertama_pada)}</Lencana> : <Lencana warna="kuning">Belum</Lencana>}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-gray-300">{sel(hit.harian)}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-gray-300">{sel(hit.mingguan)}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-gray-300">{sel(hit.bulanan)}</td>
                        <td className="py-2.5 text-xs text-gray-300">{tg.berjalan.length} berjalan{tg.terlambat.length ? <> · <span className="font-semibold text-red-300">{tg.terlambat.length} terlambat</span></> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-kartu p-5" data-papan-tim>
            <h2 className="mb-3 text-base font-bold text-white">Semua tugas yang diberikan</h2>
            <Papan tugas={data.tugas} sekarang={sekarang} anggota={orang} tampilUntuk
              aksi={(t) => t.status !== "berjalan" ? null : batal?.id === t.id ? (
                <div className="grid gap-1.5">
                  <input className={kelasInput} value={batal.alasan} maxLength={200} onChange={(e) => setBatal({ id: t.id, alasan: e.target.value })} placeholder="Alasan pembatalan" aria-label="Alasan pembatalan" />
                  <div className="flex gap-1.5"><button type="button" className={kelasTombolUtama} disabled={!batal.alasan.trim() || !!sibuk} onClick={() => aksiTugas(t.id, () => batalkanTugas(supabase, t.id, batal.alasan.trim()))}>Batalkan tugas</button>
                    <button type="button" className={kelasTombol} onClick={() => setBatal(null)}>Kembali</button></div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className={kelasTombol} disabled={!!sibuk} onClick={() => aksiTugas(t.id, () => selesaikanTugas(supabase, t.id))}>Selesaikan</button>
                  {bolehBatal(t) && <button type="button" className={kelasTombol} disabled={!!sibuk} onClick={() => setBatal({ id: t.id, alasan: "" })} data-batal-tugas={t.id}>Batalkan</button>}
                </div>
              )} />
          </section>
        </>
      )}
    </div>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────────────────
export default function TabTugas({ peran, fitur, subAwal }: { peran: PeranManagement[]; divisi: string[]; fitur: Fitur; subAwal: string | null }) {
  const pathname = usePathname();
  const [data, setData] = useState<{ d: DataTugas | null; k: Konteks; sekarang: Date; email: string } | undefined>(undefined);
  const bolehTim = peran.includes("studio_manager") || peran.includes("pm");
  const [sub, setSub] = useState<"saya" | "tim" | null>(subAwal === "tim" ? "tim" : subAwal === "saya" ? "saya" : null);

  const muat = async () => {
    const sekarang = new Date();
    const hari = hariIniWib(sekarang);
    const [d, usulan, dampak, st, rh, peta, cuti, au] = await Promise.all([
      muatDataTugas(supabase, hari), muatUsulan(supabase), muatDampak(supabase),
      fitur.serahTerima ? muatSerahTerima(supabase, tambahHariIso(hari, -31)) : Promise.resolve(null),
      fitur.harian ? muatRingkasan(supabase, hari, hari) : Promise.resolve(null),
      muatPetaLibur(supabase, tambahHariIso(hari, -30), tambahHariIso(hari, 7)).catch(() => null),
      fitur.harian ? muatCutiLeader(supabase, hari, hari) : Promise.resolve([]),
      supabase.auth.getUser().catch(() => ({ data: { user: null } })),
    ]);
    setData({ d, k: { usulan: usulan || [], dampak, st, rh, peta, cuti: petaCutiLeader(cuti) }, sekarang, email: String(au?.data?.user?.email || "").toLowerCase() });
  };
  useEffect(() => {
    let hidup = true;
    (async () => { if (hidup) await muat(); })();
    return () => { hidup = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- muat sekali saat tab dibuka
  }, []);

  if (data === undefined) return <div className="py-16 text-center text-sm text-gray-500" aria-busy="true">Memuat tugas…</div>;
  if (!data.d) return <PesanGalat pesan="Tugas tidak bisa dimuat. Coba muat ulang halaman." />;
  const d = data.d;
  const hari = hariIniWib(data.sekarang);
  const saya = d.anggota.find((a) => a.id === d.idSaya);
  const subAktif = sub || (saya ? "saya" : bolehTim ? "tim" : "saya");

  return (
    <div className="grid min-w-0 gap-4" data-tab-tugas>
      {(saya && bolehTim) && (
        <div role="tablist" aria-label="Bagian Tugas" className="flex gap-1">
          {([["saya", "Tugas saya"], ["tim", "Tim"]] as const).map(([kunci, label]) => (
            <button key={kunci} type="button" role="tab" aria-selected={subAktif === kunci} data-sub-tugas={kunci} onClick={() => setSub(kunci)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${subAktif === kunci ? "border-white bg-white text-black" : "border-white/10 text-gray-400 hover:text-white"}`}>{label}</button>
          ))}
        </div>
      )}
      {subAktif === "tim" && bolehTim
        ? <Tim data={d} k={data.k} sekarang={data.sekarang} hari={hari} peran={peran} emailSaya={data.email} fiturHarian={fitur.harian} muatUlang={muat} />
        : saya
          ? <TampilanOrang a={saya} data={d} k={data.k} sekarang={data.sekarang} hari={hari} bisaUbah fiturHarian={fitur.harian} muatUlang={muat} />
          : <Kosong>Tugas harian hanya untuk anggota Management yang terdaftar di tab Anggota.{bolehTim ? " Buka bagian Tim untuk memantau dan memberi tugas." : ""} <Link href={`${pathname}?tab=ringkasan`} className="text-tint underline">Kembali ke Ringkasan</Link></Kosong>}
    </div>
  );
}
