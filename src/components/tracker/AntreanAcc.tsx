'use client';
import React from 'react';
// Semua ikon di bawah sudah terbukti dipakai berkas lain di proyek ini —
// ikon yang tak terbukti ada bisa menggagalkan `npm run build`.
import { CheckCircle2, Inbox, CornerDownRight, X } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import Avatar from '@/components/Avatar';
import { kumpulkanBrief, cariBentrok, labelSetelahAcc, labelSetelahUpload, type Brief } from '@/lib/tracker/acc';

/**
 * Antrean ACC — layar project manager.
 *
 * Lintas papan secara sengaja (lihat catatan di lib/tracker/acc.ts):
 * bentrok justru lahir ketika satu PM hanya melihat satu papan.
 */
export default function AntreanAcc() {
  const {
    boardsDataMap, workspaces, labels, teamMembers, isManager, canAcc,
    handleUpdateItem, handleUpdateSubItem, setActiveBoardId, setActiveViewId,
    setDetailItem, pushToast,
  } = useDashboard();

  const boardMeta: Record<string, any> = {};
  (workspaces || []).forEach((y: any) =>
    (y.months || []).forEach((mo: any) =>
      (mo.boards || []).forEach((b: any) => { boardMeta[b.id] = { name: b.name }; })));

  const { menunggu, disetujui, perluUpload } = kumpulkanBrief(boardsDataMap, boardMeta);

  // Dua gerbang di alur ini: PM menyetujui brief, lalu admin menaikkan
  // hasilnya ke marketplace. Keduanya butuh antrean lintas papan.
  const [gerbang, setGerbang] = React.useState<'acc' | 'upload'>('acc');
  const daftar = gerbang === 'acc' ? menunggu : perluUpload;

  const anggota = (id: string) => (teamMembers || []).find((m: any) => m.id === id);

  const tglLabel = (t: string | null) => {
    if (!t) return 'Tanpa tanggal';
    const d = new Date(t);
    if (isNaN(d.getTime())) return 'Tanpa tanggal';
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // Dikelompokkan per tanggal — pertanyaan PM memang "hari itu siapa sibuk?",
  // bukan "brief mana yang tertunda".
  const perTanggal: Record<string, Brief[]> = {};
  daftar.forEach((b) => { (perTanggal[b.tanggal || ''] ||= []).push(b); });
  const urutTanggal = Object.keys(perTanggal).sort((a, b) => (a && b ? (a < b ? -1 : 1) : a ? -1 : 1));

  const tujuanLabel = (b: Brief) => {
    const daftarLabel = labels[b.statusColId || ''] || [];
    return gerbang === 'acc' ? labelSetelahAcc(daftarLabel) : labelSetelahUpload(daftarLabel);
  };

  const majukan = (b: Brief) => {
    const tujuan = tujuanLabel(b);
    if (!b.statusColId || !tujuan) {
      pushToast(gerbang === 'acc'
        ? 'Kolom Status papan ini belum punya label tujuan setelah ACC.'
        : 'Kolom Status papan ini belum punya label "Uploaded".');
      return;
    }
    if (b.isSub && b.subId) handleUpdateSubItem(b.groupId, b.itemId, b.subId, b.statusColId, tujuan);
    else handleUpdateItem(b.groupId, b.itemId, b.statusColId, tujuan);
    pushToast(`"${b.nama}" masuk ke ${tujuan}`);
  };

  const bukaBrief = (b: Brief) => {
    setActiveBoardId(b.boardId);
    const tabel = (boardsDataMap[b.boardId]?.views || []).find((v: any) => v.type === 'table');
    setActiveViewId(tabel?.id || '');
    setDetailItem({ groupId: b.groupId, itemId: b.itemId, subItemId: b.isSub ? b.subId : undefined });
  };

  if (!isManager && !canAcc) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
        <Inbox size={40} className="text-blue-500/20 mb-1" />
        <p className="text-sm font-bold text-gray-300">Khusus project manager</p>
        <p className="text-xs text-gray-500 max-w-sm">Halaman ini dipakai untuk menyetujui brief sebelum sampai ke karyawan.</p>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-100">Antrean</h2>
        <p className="text-sm text-gray-500 mt-1">
          {gerbang === 'acc'
            ? 'Brief dari semua papan yang menunggu persetujuan. Karyawan belum bisa melihatnya.'
            : 'Pekerjaan yang sudah selesai dan menunggu dinaikkan ke marketplace.'}
        </p>
      </div>

      <div className="flex gap-1.5 mb-5">
        {([['acc', 'Menunggu ACC', menunggu.length], ['upload', 'Siap Upload', perluUpload.length]] as const).map(
          ([nilai, label, jml]) => (
            <button key={nilai} onClick={() => setGerbang(nilai as 'acc' | 'upload')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                gerbang === nilai ? 'bg-primer text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
              {label}
              {jml > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  gerbang === nilai ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-300'}`}>{jml}</span>
              )}
            </button>
          ))}
      </div>

      {daftar.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-1">
            <CheckCircle2 size={20} className="text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-gray-200">Tidak ada yang menunggu</p>
          <p className="text-xs text-gray-500 max-w-md">
            {gerbang === 'acc'
              ? 'Brief akan muncul di sini kalau statusnya diisi “Menunggu ACC”.'
              : 'Pekerjaan akan muncul di sini kalau statusnya sudah “Done” dan belum dinaikkan.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {urutTanggal.map((tgl) => (
            <div key={tgl || 'kosong'}>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 capitalize">
                {tglLabel(tgl)} ({perTanggal[tgl].length})
              </div>

              <div className="flex flex-col gap-1.5">
                {perTanggal[tgl].map((b) => {
                  // Bentrok jadwal hanya relevan saat MENYETUJUI. Saat upload,
                  // pekerjaannya sudah selesai — tidak ada kapasitas yang direbut.
                  const bentrok = gerbang === 'acc' ? cariBentrok(b, disetujui) : [];
                  const labelTujuan = tujuanLabel(b);
                  return (
                    <div key={b.kunci} className="bg-kartu border border-white/10 rounded-xl p-3.5 hover:border-white/20 transition-colors">
                      <div className="flex items-start gap-3 flex-wrap">
                        <span className="w-1 self-stretch min-h-[34px] rounded-full shrink-0"
                          style={{ background: b.groupColor || '#124bce' }} />

                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-black uppercase tracking-wider mb-1 truncate"
                            style={{ color: b.groupColor || '#8ba7ff' }}>
                            {b.boardName} · {b.groupTitle}
                          </div>
                          <div className="text-sm font-semibold text-gray-100 flex items-center gap-1.5">
                            {b.isSub && <CornerDownRight size={12} className="text-gray-600 shrink-0" />}
                            <span className="truncate">{b.nama}</span>
                          </div>
                          {b.namaInduk && (
                            <div className="text-[11px] text-gray-600 mt-0.5 truncate">{b.namaInduk}</div>
                          )}
                        </div>

                        <div className="flex -space-x-1 shrink-0">
                          {b.pic.map((id) => {
                            const m = anggota(id);
                            return (
                              <Avatar key={id} url={m?.avatarUrl} name={m?.name} initials={m?.initials}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white border border-white/10 ${m?.color || 'bg-kartu-hover'}`} />
                            );
                          })}
                          {!b.pic.length && <span className="text-[11px] text-gray-600">Tanpa PIC</span>}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => bukaBrief(b)}
                            className="px-2.5 py-1.5 rounded-lg border border-white/10 text-[11.5px] font-semibold text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                            Buka
                          </button>
                          <button onClick={() => majukan(b)}
                            title={labelTujuan ? `Ubah status ke ${labelTujuan}` : 'Label tujuan belum ada'}
                            className="px-3 py-1.5 rounded-lg bg-primer hover:bg-primer-terang text-[11.5px] font-bold text-white transition-colors">
                            {gerbang === 'acc' ? 'ACC' : 'Upload'}{labelTujuan ? ` → ${labelTujuan}` : ''}
                          </button>
                        </div>
                      </div>

                      {bentrok.length > 0 && (
                        <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                          <X size={13} className="text-amber-400 shrink-0 mt-0.5" />
                          <div className="text-[12px] text-amber-100/85 leading-relaxed">
                            PIC ini sudah punya {bentrok.length} brief lain di tanggal yang sama —{' '}
                            {bentrok.slice(0, 2).map((x) => `${x.nama} (${x.boardName})`).join(', ')}
                            {bentrok.length > 2 ? `, +${bentrok.length - 2} lagi` : ''}.
                            <span className="text-amber-200/60"> Tetap bisa di-ACC kalau memang disengaja.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
