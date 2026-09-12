// src/app/admin/keuangan/pendapatan/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import LoadingLogo from '@/components/LoadingLogo';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { loadFullState } from '@/lib/tracker/load';
import { hitungPerMarketplaceAkun, type HitunganMarketplace } from '@/lib/tracker/pendapatan';
import { rp } from '@/lib/keuangan/format';
import { ambilKategori, ambilAkun, simpanTransaksi } from '@/lib/keuangan/data';
import type { Kategori, Akun } from '@/lib/keuangan/tipe';

const usd = (n: number) =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type BoardOpt = { id: string; label: string };
type ServiceRow = { id: string; board_id: string; keterangan: string; jumlah: number; mata_uang: string };

export default function PendapatanPage() {
  const toast = useToast();
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');

  const [boards, setBoards] = useState<BoardOpt[]>([]);
  const [boardMap, setBoardMap] = useState<Record<string, any>>({});
  const [boardId, setBoardId] = useState('');

  const [harga, setHarga] = useState<Record<string, number>>({}); // MARKETPLACE -> harga USD
  const [kurs, setKurs] = useState<number>(16000);
  const [service, setService] = useState<ServiceRow[]>([]);

  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [pemilikAkun, setPemilikAkun] = useState<Record<string, { pemilik: string; persentasi: number; biaya_operasional: number }>>({});
  const [akun, setAkun] = useState<Akun[]>([]);

  const [modalCatat, setModalCatat] = useState(false);
  const [catatKategori, setCatatKategori] = useState('');
  const [catatAkun, setCatatAkun] = useState('');
  const [catatTanggal, setCatatTanggal] = useState('');
  const [menyimpanCatat, setMenyimpanCatat] = useState(false);

  // ---- muat awal ----
  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const [fs, kats, akns] = await Promise.all([loadFullState(supabase), ambilKategori(), ambilAkun()]);

        const opts: BoardOpt[] = [];
        for (const ws of (fs.workspaces || []))
          for (const y of (ws.years || []))
            for (const m of (y.months || []))
              for (const b of (m.boards || []))
                if (/marketplace/i.test(b.name || '')) opts.push({ id: b.id, label: `${m.name} ${y.name}` });

        const { data: hrg } = await supabase.from('harga_template_marketplace').select('*');
        const petaHarga: Record<string, number> = {};
        (hrg || []).forEach((r: any) => { petaHarga[String(r.marketplace).toUpperCase()] = Number(r.harga_usd) || 0; });

        const { data: pgn } = await supabase.from('pengaturan').select('nilai').eq('kunci', 'kurs_usd_idr').maybeSingle();
        const { data: pa } = await supabase.from('pemilik_akun').select('*');
        const petaPemilik: Record<string, any> = {};
        (pa || []).forEach((r: any) => { petaPemilik[r.akun] = { pemilik: r.pemilik || '', persentasi: Number(r.persentasi) || 0, biaya_operasional: Number(r.biaya_operasional) || 0 }; });

        if (!hidup) return;
        setBoardMap(fs.boardsDataMap || {});
        setBoards(opts);
        setBoardId(opts[0]?.id || '');
        setHarga(petaHarga);
        setKurs(Number(pgn?.nilai) || 16000);
        setKategori((kats || []).filter((k: any) => k.kind === 'in'));
        setPemilikAkun(petaPemilik);
        setAkun(akns || []);
      } catch (e: any) {
        if (hidup) setGalat(e?.message || 'Gagal memuat data.');
      } finally {
        if (hidup) setMemuat(false);
      }
    })();
    return () => { hidup = false; };
  }, []);

  // ---- muat service saat board berganti ----
  useEffect(() => {
    if (!boardId) { setService([]); return; }
    let hidup = true;
    (async () => {
      const { data } = await supabase.from('pendapatan_service').select('*').eq('board_id', boardId);
      if (hidup) setService((data as ServiceRow[]) || []);
    })();
    return () => { hidup = false; };
  }, [boardId]);

  // ---- hitung per marketplace -> akun ----
  const hitung: HitunganMarketplace = useMemo(() => {
    const bd = boardMap[boardId];
    if (!bd) return {};
    return hitungPerMarketplaceAkun(bd.groups || [], bd.columns || [], bd.subColumns || []);
  }, [boardMap, boardId]);

  const rincian = useMemo(() => {
    const perMkt: { marketplace: string; hargaUsd: number; akun: { nama: string; approved: number; usd: number }[]; totalUsd: number }[] = [];
    let totalUsd = 0;
    Object.keys(hitung).sort().forEach((mkt) => {
      const h = harga[mkt] ?? 0;
      const akunArr = Object.keys(hitung[mkt]).sort().map((a) => {
        const approved = hitung[mkt][a].approved || 0;
        return { nama: a, approved, usd: approved * h };
      });
      const sub = akunArr.reduce((s, x) => s + x.usd, 0);
      totalUsd += sub;
      perMkt.push({ marketplace: mkt, hargaUsd: h, akun: akunArr, totalUsd: sub });
    });
    return { perMkt, totalUsd };
  }, [hitung, harga]);

  const serviceUsd = service.filter((s) => s.mata_uang === 'USD').reduce((s, x) => s + (Number(x.jumlah) || 0), 0);
  const serviceIdr = service.filter((s) => s.mata_uang === 'IDR').reduce((s, x) => s + (Number(x.jumlah) || 0), 0);
  const marketplaceIdr = rincian.totalUsd * kurs;
  const serviceTotalIdr = serviceUsd * kurs + serviceIdr;
  const grandTotalIdr = marketplaceIdr + serviceTotalIdr;
  const pendapatanPemilikAkun = (a: { nama: string; usd: number }) => {
    const pa: any = pemilikAkun[a.nama] || { persentasi: 0, biaya_operasional: 0 };
    return (a.usd * kurs - (Number(pa.biaya_operasional) || 0)) * ((Number(pa.persentasi) || 0) / 100);
  };

  // ---- persist ----
  const simpanHarga = async (mkt: string, val: number) => {
    setHarga((h) => ({ ...h, [mkt]: val }));
    try { await supabase.from('harga_template_marketplace').upsert({ marketplace: mkt, harga_usd: val }, { onConflict: 'marketplace' }); }
    catch { toast.gagal('Gagal menyimpan harga.'); }
  };
  const simpanKurs = async (val: number) => {
    setKurs(val);
    try { await supabase.from('pengaturan').upsert({ kunci: 'kurs_usd_idr', nilai: String(val) }, { onConflict: 'kunci' }); }
    catch { toast.gagal('Gagal menyimpan kurs.'); }
  };
  const simpanPemilik = async (akun: string, patch: Partial<{ pemilik: string; persentasi: number; biaya_operasional: number }>) => {
    const merged = { pemilik: '', persentasi: 0, biaya_operasional: 0, ...(pemilikAkun[akun] || {}), ...patch };
    setPemilikAkun((p) => ({ ...p, [akun]: merged }));
    try { await supabase.from('pemilik_akun').upsert({ akun, pemilik: merged.pemilik, persentasi: merged.persentasi, biaya_operasional: merged.biaya_operasional }, { onConflict: 'akun' }); }
    catch { toast.gagal('Gagal menyimpan data pemilik.'); }
  };
  const tambahService = async () => {
    const baris: ServiceRow = { id: 'svc-' + Date.now(), board_id: boardId, keterangan: '', jumlah: 0, mata_uang: 'IDR' };
    setService((s) => [...s, baris]);
    try { await supabase.from('pendapatan_service').insert(baris); } catch { toast.gagal('Gagal menambah entri.'); }
  };
  const ubahService = async (id: string, patch: Partial<ServiceRow>) => {
    setService((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    try { await supabase.from('pendapatan_service').update(patch).eq('id', id); } catch { /* diamkan */ }
  };
  const hapusService = async (id: string) => {
    setService((s) => s.filter((x) => x.id !== id));
    try { await supabase.from('pendapatan_service').delete().eq('id', id); } catch { /* diamkan */ }
  };

  // ---- catat ke transaksi ----
  const labelBulan = boards.find((b) => b.id === boardId)?.label || '';
  const bukaCatat = () => {
    if (!kategori.length) return toast.gagal('Belum ada kategori pemasukan. Buat dulu di tab Kategori.');
    if (!akun.length) return toast.gagal('Belum ada akun keuangan.');
    setCatatKategori(kategori[0]?.id || '');
    setCatatAkun(akun[0]?.id || '');
    setCatatTanggal(new Date().toISOString().split('T')[0]);
    setModalCatat(true);
  };
  const jalankanCatat = async () => {
    setMenyimpanCatat(true);
    try {
      const tugas: Promise<void>[] = [];
      if (marketplaceIdr > 0)
        tugas.push(simpanTransaksi({ occurred_on: catatTanggal, kind: 'in', category_id: catatKategori, account_id: catatAkun, amount: Math.round(marketplaceIdr), note: `Pendapatan Marketplace ${labelBulan}`.trim() }));
      if (serviceTotalIdr > 0)
        tugas.push(simpanTransaksi({ occurred_on: catatTanggal, kind: 'in', category_id: catatKategori, account_id: catatAkun, amount: Math.round(serviceTotalIdr), note: `Pendapatan Service ${labelBulan}`.trim() }));
      if (!tugas.length) { toast.info('Tidak ada nilai untuk dicatat.'); setMenyimpanCatat(false); return; }
      await Promise.all(tugas);
      toast.sukses('Pendapatan tercatat ke buku Keuangan.');
      setModalCatat(false);
    } catch (e: any) {
      toast.gagal(e?.message || 'Gagal mencatat.');
    } finally {
      setMenyimpanCatat(false);
    }
  };

  if (memuat)
    return <div className="flex min-h-[50vh] items-center justify-center"><LoadingLogo size={44} text="Memuat data pendapatan" /></div>;
  if (galat)
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-amber-500/25 bg-amber-500/10 p-5">
        <p className="text-sm font-bold text-amber-300">Gagal memuat</p>
        <p className="mt-1.5 text-[13px] text-amber-100/80">{galat}</p>
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      {/* Header + pilih bulan */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Pendapatan Marketplace &amp; Service</h1>
          <p className="text-[12px] text-gray-500">Estimasi otomatis dari template Approved per akun. Harga &amp; kurs bisa diedit.</p>
        </div>
        <select
          value={boardId}
          onChange={(e) => setBoardId(e.target.value)}
          className="bg-input border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primer"
        >
          {boards.length === 0 && <option value="">— tak ada board marketplace —</option>}
          {boards.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </div>

      {boards.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-gray-400">
          Belum ada board bernama &quot;Marketplace&quot; di daily-task. Buat board-nya dulu, lalu buka lagi halaman ini.
        </div>
      ) : (
        <>
          {/* Kurs */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <span className="text-sm font-bold text-white">Kurs USD → IDR</span>
            <span className="text-gray-500 text-sm">$1 =</span>
            <span className="text-gray-500 text-sm">Rp</span>
            <input
              type="number" min={0} defaultValue={kurs}
              onBlur={(e) => simpanKurs(Number(e.target.value) || 0)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="w-32 bg-input border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white text-right outline-none focus:border-primer"
            />
            <span className="ml-auto text-[11px] text-gray-500">Dipakai untuk konversi semua nilai USD.</span>
          </div>

          {/* Per marketplace */}
          {rincian.perMkt.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-gray-400">
              Tidak ada template ber-status Approved (dengan kolom AKUN &amp; STATUS terisi) di board ini.
            </div>
          )}

          {rincian.perMkt.map((m) => (
            <div key={m.marketplace} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-bold text-tint uppercase tracking-wide">{m.marketplace}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-gray-500">Harga / template (USD)</span>
                  <span className="text-gray-500 text-sm">$</span>
                  <input
                    type="number" min={0} step="0.01" defaultValue={m.hargaUsd}
                    onBlur={(e) => simpanHarga(m.marketplace, Number(e.target.value) || 0)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-24 bg-input border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white text-right outline-none focus:border-primer"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase text-gray-500 border-b border-white/5">
                      <th className="px-4 py-2 font-semibold">Akun</th>
                      <th className="px-4 py-2 font-semibold">Data</th>
                      <th className="px-4 py-2 font-semibold text-center">Persentasi</th>
                      <th className="px-4 py-2 font-semibold text-right">Biaya Ops (Rp)</th>
                      <th className="px-4 py-2 font-semibold text-center">Approved</th>
                      <th className="px-4 py-2 font-semibold text-right">Estimasi (USD)</th>
                      <th className="px-4 py-2 font-semibold text-right">Estimasi (Rp)</th>
                      <th className="px-4 py-2 font-semibold text-right">Pendapatan Pemilik (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.akun.map((a) => {
                      const pa = pemilikAkun[a.nama] || { pemilik: '', persentasi: 0, biaya_operasional: 0 };
                      return (
                      <tr key={a.nama} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-2.5 text-white whitespace-nowrap">{a.nama}</td>
                        <td className="px-4 py-2.5">
                          <input type="text" defaultValue={pa.pemilik} onBlur={(e) => simpanPemilik(a.nama, { pemilik: e.target.value })} placeholder="—" className="w-28 bg-input border border-white/10 rounded px-2 py-1 text-sm text-white outline-none focus:border-primer" />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-flex items-center gap-1">
                            <input type="number" min={0} max={100} defaultValue={pa.persentasi} onBlur={(e) => simpanPemilik(a.nama, { persentasi: Number(e.target.value) || 0 })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className="w-16 bg-input border border-white/10 rounded px-2 py-1 text-sm text-white text-right outline-none focus:border-primer" />
                            <span className="text-gray-500 text-xs">%</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <input type="number" min={0} defaultValue={pa.biaya_operasional} onBlur={(e) => simpanPemilik(a.nama, { biaya_operasional: Number(e.target.value) || 0 })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className="w-28 bg-input border border-white/10 rounded px-2 py-1 text-sm text-white text-right outline-none focus:border-primer" />
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono text-emerald-400">{a.approved}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-white">{usd(a.usd)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-400">{rp(a.usd * kurs)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-tint">{rp(pendapatanPemilikAkun(a))}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white/[0.03]">
                      <td className="px-4 py-2.5 font-bold text-white" colSpan={5}>Subtotal {m.marketplace}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-white">{usd(m.totalUsd)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-tint">{rp(m.totalUsd * kurs)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-tint">{rp(m.akun.reduce((s, a) => s + pendapatanPemilikAkun(a), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          {/* Total marketplace */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primer/30 bg-primer/10 px-4 py-3">
            <span className="text-sm font-bold text-white">Total Pendapatan Marketplace</span>
            <span className="text-right font-mono font-bold text-white">
              {usd(rincian.totalUsd)} <span className="text-tint">· {rp(marketplaceIdr)}</span>
            </span>
          </div>

          {/* Service */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h3 className="text-sm font-bold text-white">Pendapatan Service (manual)</h3>
              <button onClick={tambahService} className="rounded-lg bg-primer px-3 py-1.5 text-xs font-bold text-white hover:bg-primer-terang">+ Tambah</button>
            </div>
            <div className="flex flex-col divide-y divide-white/5">
              {service.length === 0 && <p className="px-4 py-4 text-[12px] italic text-gray-500">Belum ada entri service untuk bulan ini.</p>}
              {service.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <input
                    type="text" defaultValue={s.keterangan} placeholder="Keterangan (mis. Jasa desain klien X)"
                    onBlur={(e) => ubahService(s.id, { keterangan: e.target.value })}
                    className="min-w-0 flex-1 bg-input border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-primer"
                  />
                  <select
                    defaultValue={s.mata_uang}
                    onChange={(e) => ubahService(s.id, { mata_uang: e.target.value })}
                    className="bg-input border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-primer"
                  >
                    <option value="IDR">Rp</option>
                    <option value="USD">$</option>
                  </select>
                  <input
                    type="number" min={0} defaultValue={s.jumlah}
                    onBlur={(e) => ubahService(s.id, { jumlah: Number(e.target.value) || 0 })}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-36 bg-input border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white text-right outline-none focus:border-primer"
                  />
                  <button onClick={() => hapusService(s.id)} className="rounded-lg px-2 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10">Hapus</button>
                </div>
              ))}
            </div>
            {service.length > 0 && (
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5">
                <span className="text-sm font-bold text-white">Total Service</span>
                <span className="font-mono font-bold text-tint">{rp(serviceTotalIdr)}</span>
              </div>
            )}
          </div>

          {/* Grand total + catat */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
            <div>
              <p className="text-[12px] uppercase tracking-wide text-emerald-300/80">Total Pendapatan {labelBulan}</p>
              <p className="text-2xl font-black text-white">{rp(grandTotalIdr)}</p>
            </div>
            <button
              onClick={bukaCatat}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
            >
              Catat ke Transaksi
            </button>
          </div>
        </>
      )}

      {/* Modal catat */}
      {modalCatat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !menyimpanCatat && setModalCatat(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-kartu p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white">Catat ke Buku Keuangan</h3>
            <p className="mt-1 text-[12px] text-gray-500">
              Akan dibuat transaksi pemasukan: Marketplace {rp(marketplaceIdr)}{serviceTotalIdr > 0 ? ` dan Service ${rp(serviceTotalIdr)}` : ''}.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-gray-500">Kategori pemasukan</label>
                <select value={catatKategori} onChange={(e) => setCatatKategori(e.target.value)} className="w-full bg-input border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primer">
                  {kategori.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-gray-500">Akun</label>
                <select value={catatAkun} onChange={(e) => setCatatAkun(e.target.value)} className="w-full bg-input border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primer">
                  {akun.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-gray-500">Tanggal</label>
                <input type="date" value={catatTanggal} onChange={(e) => setCatatTanggal(e.target.value)} className="w-full bg-input border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primer [color-scheme:dark]" />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setModalCatat(false)} disabled={menyimpanCatat} className="rounded-lg px-4 py-2 text-sm font-bold text-gray-400 hover:text-white disabled:opacity-50">Batal</button>
              <button onClick={jalankanCatat} disabled={menyimpanCatat} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
                {menyimpanCatat ? 'Menyimpan…' : 'Catat sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
