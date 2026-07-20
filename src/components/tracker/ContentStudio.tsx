'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  CalendarDays, LayoutGrid, BarChart3, Table, Pencil, Plus, X, Trash2, Check, RotateCcw,
  ExternalLink, Megaphone, Target, Users, MessageSquare, Hash, Image as ImageIcon,
  ChevronLeft, ChevronRight, Sparkles, Eye, Heart, Share2, Bookmark,
  ChevronDown, User, Search, Send, PenLine,
} from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import LoadingLogo from '@/components/LoadingLogo';
import PlatformIcon from '@/components/tracker/PlatformIcon';
import Avatar from '@/components/Avatar';
import { pushNotify } from '@/lib/push';
import {
  PLATFORMS, CONTENT_TYPES, CONTENT_STATUS, statusColor, platformMeta, CONTENT_PILLARS,
  engagementRate, loadContent, addContent, updateContent, deleteContent,
} from '@/lib/tracker/content';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—');
const mColor = (m: any) => (m?.color && String(m.color).startsWith('bg-') ? m.color : 'bg-[#579bfc]');

/* Dropdown PIC: avatar + pencarian — menggantikan <select> polos yang berdempetan */
function PicPicker({ value, members, disabled, onChange }: any) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const sel = members.find((m: any) => m.id === value);
  const filtered = members.filter((m: any) => String(m.name || '').toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="relative">
      <button
        type="button" disabled={disabled}
        onClick={() => { setOpen(!open); setQ(''); }}
        className="w-full flex items-center gap-2.5 bg-[#1a1c23] border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 py-2.5 text-left transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {sel ? (
          <>
            <Avatar url={sel.avatarUrl} name={sel.name} initials={sel.initials} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${mColor(sel)}`} />
            <span className="text-xs text-zinc-100 flex-1 truncate">{sel.name}</span>
          </>
        ) : (
          <>
            <span className="w-6 h-6 rounded-full border border-dashed border-zinc-700 flex items-center justify-center shrink-0"><User size={11} className="text-zinc-600" /></span>
            <span className="text-xs text-zinc-500 flex-1">Belum ditugaskan</span>
          </>
        )}
        <ChevronDown size={14} className={`text-zinc-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-[95]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1.5 z-[100] bg-[#2a2c38] border border-zinc-700 rounded-xl shadow-2xl p-2">
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 mb-1.5">
              <Search size={12} className="text-zinc-500 shrink-0" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…"
                className="bg-transparent text-[11px] text-white outline-none w-full placeholder:text-zinc-600" />
            </div>
            <div className="max-h-64 overflow-y-auto overscroll-contain flex flex-col gap-0.5">
              <button type="button" onClick={() => { onChange(null); setOpen(false); }}
                className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-zinc-700/60 text-left">
                <span className="w-6 h-6 rounded-full border border-dashed border-zinc-700 flex items-center justify-center shrink-0"><User size={11} className="text-zinc-600" /></span>
                <span className="text-[11px] text-zinc-500 flex-1">Belum ditugaskan</span>
                {!value && <Check size={13} className="text-blue-400 shrink-0" />}
              </button>
              {filtered.map((m: any) => (
                <button key={m.id} type="button" onClick={() => { onChange(m.id); setOpen(false); }}
                  className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors ${value === m.id ? 'bg-blue-500/10' : 'hover:bg-zinc-700/60'}`}>
                  <Avatar url={m.avatarUrl} name={m.name} initials={m.initials} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${mColor(m)}`} />
                  <span className={`text-[11px] truncate flex-1 ${value === m.id ? 'text-white font-semibold' : 'text-zinc-300'}`}>{m.name}</span>
                  {value === m.id && <Check size={13} className="text-blue-400 shrink-0" />}
                </button>
              ))}
              {filtered.length === 0 && <span className="text-[11px] text-zinc-600 px-2 py-3">Tidak ada nama yang cocok.</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// PENTING: Field harus berada di tingkat modul, bukan di dalam ContentDetail.
// Bila dibuat ulang tiap render, React menganggapnya komponen berbeda lalu
// memasang ulang seluruh isinya — sehingga input kehilangan fokus tiap ketukan.
const Field = ({ icon, label, children }: any) => (
  <div className="mb-4">
    <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">{icon}{label}</div>
    {children}
  </div>
);
const inputCls = "w-full bg-[#1a1c23] border border-zinc-800 focus:border-blue-500/60 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none transition-colors placeholder:text-zinc-600";

const toLocalInput = (d: any) => {
  if (!d) return '';
  const dt = new Date(d);
  const off = dt.getTimezoneOffset();
  return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 16);
};

/* ══════════════ PANEL DETAIL KONTEN (brief + produksi + review + performa) ══════════════ */
export function ContentDetail({ post, members, canManage, currentUserId, onClose, onSave, onDelete, onCreate }: any) {
  const { pushToast, supabase }: any = useDashboard();
  const [f, setF] = useState<any>(post);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  useEffect(() => setF(post), [post?.id]);
  if (!f) return null;

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const togglePlatform = (p: string) => {
    const arr: string[] = f.platform || [];
    set('platform', arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]);
  };
  const save = async (extra: any = {}) => {
    setSaving(true);
    await onSave({ ...f, ...extra });
    setSaving(false);
  };
  // Tutup panel — kalau masih draft (belum di-apply), konfirmasi dulu agar tak ada brief kosong.
  const handleClose = () => {
    if (f._draft) setConfirmClose(true);
    else onClose();
  };
  const er = engagementRate(f);

  // Manager: simpan brief dan kirim pemberitahuan ke PIC.
  // Status TIDAK dipaksa berubah — brief baru tetap berstatus 'Brief'
  // sampai tim sendiri memindahkannya ke Produksi.
  const applyBrief = async () => {
    const kirimBaru = canManage && !!f._draft;   // hanya saat brief pertama kali dibuat
    if (kirimBaru) {
      if (!f.assignee_id) { pushToast('Pilih PIC dulu agar brief bisa dikerjakan tim.'); return; }
      if (!(f.platform || []).length) { pushToast('Pilih minimal satu platform.'); return; }
    }
    let newId = f.id;
    setSaving(true);
    try {
      if (f._draft) {
        // Draft baru disimpan ke DB apa adanya — statusnya tetap seperti yang dipilih.
        const row = await onCreate({ ...f });
        newId = row?.id || f.id;
      } else {
        await save();
      }
    } finally { setSaving(false); }

    if (kirimBaru) {
      const nama = members.find((m: any) => m.id === f.assignee_id)?.name || 'tim';
      pushToast(`Brief dikirim ke ${nama} — status tetap Brief sampai tim memulai`);
      // 🔔 Notifikasi ke PIC
      pushNotify(supabase, {
        memberIds: [f.assignee_id],
        title: '📣 Brief Konten Baru',
        body: f.title || 'Ada brief konten baru untukmu',
        url: '/user/daily-task',
        tag: `brief-${newId}`,
      });
    } else {
      pushToast(f._draft ? 'Brief disimpan' : 'Perubahan disimpan');
    }
    onClose();
  };


  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[85]" onClick={handleClose} />
      <div className="fixed top-0 right-0 h-full w-full sm:w-[520px] bg-[#1e2029] border-l border-zinc-800 z-[90] flex flex-col shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex-1 min-w-0">
            <input
              value={f.title || ''} onChange={(e) => set('title', e.target.value)} onBlur={() => save()}
              disabled={!canManage}
              className="w-full bg-transparent text-lg font-bold text-white outline-none focus:bg-zinc-800/40 rounded px-1 -ml-1 disabled:opacity-100"
            />
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className={`text-[9px] font-bold text-white px-2 py-0.5 rounded-full ${statusColor(f.status)}`}>{f.status}</span>
              {(f.platform || []).map((p: string) => (
                <span key={p} className={`text-[9px] font-semibold text-white px-2 py-0.5 rounded-full ${platformMeta(p).color}`}>{platformMeta(p).label}</span>
              ))}
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 shrink-0"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {/* ── PENJADWALAN ── */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Jadwal Tayang</div>
              <input type="datetime-local" disabled={!canManage} value={toLocalInput(f.publish_at)} onChange={(e) => set('publish_at', e.target.value ? new Date(e.target.value).toISOString() : null)} onBlur={() => save()} className={`${inputCls} [color-scheme:dark]`} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Tipe Konten</div>
              <select disabled={!canManage} value={f.content_type || 'Feed'} onChange={(e) => { set('content_type', e.target.value); save({ content_type: e.target.value }); }} className={inputCls}>
                {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <Field icon={<Target size={11} />} label="Content Pillar">
            <select disabled={!canManage} value={f.content_pillar || ''} onChange={(e) => { set('content_pillar', e.target.value); save({ content_pillar: e.target.value }); }} className={inputCls}>
              <option value="">— Pilih pillar —</option>
              {CONTENT_PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>

          {canManage && (
            <Field icon={<Sparkles size={11} />} label="Platform">
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => {
                  const on = (f.platform || []).includes(p.id);
                  return (
                    <button key={p.id} onClick={() => { const arr: string[] = f.platform || []; const next = arr.includes(p.id) ? arr.filter((x) => x !== p.id) : [...arr, p.id]; setF((s: any) => ({ ...s, platform: next })); save({ platform: next }); }}
                      className={`text-[10px] px-2.5 py-1 rounded-full font-semibold transition-all border ${on ? `${p.color} text-white border-transparent` : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                      <span className="inline-flex items-center gap-1"><PlatformIcon id={p.id} className="w-3 h-3" />{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <Field icon={<Users size={11} />} label="PIC / Penanggung Jawab">
            <PicPicker
              value={f.assignee_id} members={members} disabled={!canManage}
              onChange={(id: string | null) => { setF((s: any) => ({ ...s, assignee_id: id })); save({ assignee_id: id }); }}
            />
          </Field>

          {/* ── BRIEF (manager) ── */}
          <div className="bg-[#191b22] border border-zinc-800 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-3.5">
              <Megaphone size={13} className="text-blue-400" />
              <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">Brief dari Manager</span>
            </div>
            <Field icon={<Target size={11} />} label="Tujuan Konten">
              <textarea disabled={!canManage} rows={2} value={f.objective || ''} onChange={(e) => set('objective', e.target.value)} onBlur={() => save()} placeholder="Contoh: meningkatkan awareness produk baru…" className={inputCls} />
            </Field>
            <Field icon={<Users size={11} />} label="Target Audiens">
              <input disabled={!canManage} value={f.audience || ''} onChange={(e) => set('audience', e.target.value)} onBlur={() => save()} placeholder="Contoh: pria/wanita 20–30 th, urban…" className={inputCls} />
            </Field>
            <Field icon={<MessageSquare size={11} />} label="Key Message">
              <textarea disabled={!canManage} rows={2} value={f.key_message || ''} onChange={(e) => set('key_message', e.target.value)} onBlur={() => save()} placeholder="Pesan utama yang harus tersampaikan…" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field icon={<Sparkles size={11} />} label="Call To Action">
                <input disabled={!canManage} value={f.cta || ''} onChange={(e) => set('cta', e.target.value)} onBlur={() => save()} placeholder="Swipe up, DM, klik link…" className={inputCls} />
              </Field>
              <Field icon={<ExternalLink size={11} />} label="Referensi">
                <div className="flex gap-1.5">
                  <input disabled={!canManage} value={f.reference_url || ''} onChange={(e) => set('reference_url', e.target.value)} onBlur={() => save()} placeholder="Link moodboard…" className={inputCls} />
                  {f.reference_url && <a href={f.reference_url} target="_blank" rel="noreferrer" className="p-2 text-blue-400 hover:text-blue-300 shrink-0"><ExternalLink size={14} /></a>}
                </div>
              </Field>
            </div>
          </div>

          {/* ── PRODUKSI (tim) ── */}
          <div className="bg-[#191b22] border border-zinc-800 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-3.5">
              <ImageIcon size={13} className="text-emerald-400" />
              <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Produksi Tim</span>
            </div>
            <Field icon={<MessageSquare size={11} />} label="Caption">
              <textarea rows={4} value={f.caption || ''} onChange={(e) => set('caption', e.target.value)} onBlur={() => save()} placeholder="Tulis caption di sini…" className={inputCls} />
              <div className="text-[9px] text-zinc-600 mt-1 text-right">{(f.caption || '').length} karakter</div>
            </Field>
            <Field icon={<PenLine size={11} />} label="Copywriting">
              <textarea rows={5} value={f.copywriting || ''} onChange={(e) => set('copywriting', e.target.value)} onBlur={() => save()} placeholder="Naskah lengkap: hook, isi, penutup…" className={inputCls} />
              <div className="text-[9px] text-zinc-600 mt-1 text-right">{(f.copywriting || '').length} karakter</div>
            </Field>
            <Field icon={<Hash size={11} />} label="Hashtag">
              <textarea rows={2} value={f.hashtags || ''} onChange={(e) => set('hashtags', e.target.value)} onBlur={() => save()} placeholder="#invisual #desain …" className={inputCls} />
            </Field>
            <Field icon={<ImageIcon size={11} />} label="Link Aset (Canva / Drive / Figma)">
              <div className="flex gap-1.5">
                <input value={f.asset_url || ''} onChange={(e) => set('asset_url', e.target.value)} onBlur={() => save()} placeholder="https://…" className={inputCls} />
                {f.asset_url && <a href={f.asset_url} target="_blank" rel="noreferrer" className="p-2 text-blue-400 hover:text-blue-300 shrink-0"><ExternalLink size={14} /></a>}
              </div>
            </Field>
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Status Pengerjaan</div>
              <div className="flex flex-wrap gap-1.5">
                {CONTENT_STATUS.map((s) => (
                  <button key={s.id} onClick={() => { set('status', s.id); save({ status: s.id }); }}
                    className={`text-[10px] px-2.5 py-1 rounded-full font-semibold transition-all border ${f.status === s.id ? `${s.color} text-white border-transparent` : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                    {s.id}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── REVIEW & APPROVAL (manager) ── */}
          {canManage && (
            <div className="bg-[#191b22] border border-zinc-800 rounded-xl p-4 mb-5">
              <div className="flex items-center gap-2 mb-3.5">
                <Check size={13} className="text-amber-400" />
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Review Manager</span>
              </div>
              <Field icon={<MessageSquare size={11} />} label="Catatan Revisi">
                <textarea rows={2} value={f.review_note || ''} onChange={(e) => set('review_note', e.target.value)} onBlur={() => save()} placeholder="Tulis apa yang perlu diperbaiki…" className={inputCls} />
              </Field>
              <div className="flex gap-2">
                <button onClick={() => save({ status: 'Approved', approved_by: currentUserId, approved_at: new Date().toISOString() })}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 text-[11px] font-bold py-2 rounded-lg transition-all">
                  <Check size={13} /> Approve
                </button>
                <button onClick={() => save({ status: 'Revisi' })}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/25 text-[11px] font-bold py-2 rounded-lg transition-all">
                  <RotateCcw size={13} /> Minta Revisi
                </button>
              </div>
              {f.approved_at && <p className="text-[9px] text-emerald-500/70 mt-2 text-center">Disetujui {new Date(f.approved_at).toLocaleString('id-ID')}</p>}
            </div>
          )}

          {!canManage && f.review_note && (
            <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-3.5 mb-5">
              <div className="text-[10px] font-bold text-red-300 uppercase tracking-wider mb-1.5">Catatan Revisi Manager</div>
              <p className="text-xs text-zinc-300 leading-relaxed">{f.review_note}</p>
            </div>
          )}

          {/* ── PERFORMA ── */}
          <div className="bg-[#191b22] border border-zinc-800 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <BarChart3 size={13} className="text-purple-400" />
                <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">Performa</span>
              </div>
              {er > 0 && <span className="text-[10px] font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full">ER {er}%</span>}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[
                { k: 'reach', label: 'Reach', icon: <Eye size={10} /> },
                { k: 'likes', label: 'Likes', icon: <Heart size={10} /> },
                { k: 'comments', label: 'Komen', icon: <MessageSquare size={10} /> },
                { k: 'shares', label: 'Share', icon: <Share2 size={10} /> },
                { k: 'saves', label: 'Save', icon: <Bookmark size={10} /> },
              ].map((m) => (
                <div key={m.k}>
                  <div className="flex items-center gap-1 text-[9px] text-zinc-500 mb-1">{m.icon}{m.label}</div>
                  <input type="number" min={0} value={f[m.k] ?? 0} onChange={(e) => set(m.k, Number(e.target.value))} onBlur={() => save()} className="w-full bg-[#1a1c23] border border-zinc-800 focus:border-purple-500/50 rounded-lg px-2 py-1.5 text-xs text-zinc-100 outline-none" />
                </div>
              ))}
            </div>
          </div>

          {canManage && (
            <button onClick={() => onDelete(f.id)} className="w-full flex items-center justify-center gap-1.5 text-[11px] text-zinc-600 hover:text-red-400 py-2.5 transition-colors">
              <Trash2 size={13} /> Hapus konten ini
            </button>
          )}
        </div>

        {/* ══ FOOTER AKSI ══ */}
        <div className="shrink-0 border-t border-zinc-800 bg-[#191b22] px-5 py-3.5 flex items-center gap-2">
          <button
            onClick={applyBrief} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-[#2b5cd5] hover:bg-blue-600 disabled:opacity-60 text-white text-xs font-bold py-3 rounded-xl transition-all shadow-[0_0_16px_rgba(43,92,213,0.35)] active:scale-[0.98]"
          >
            {saving ? 'Menyimpan…' : (canManage && f._draft
              ? <><Send size={14} /> Apply Brief &amp; Kirim ke Tim</>
              : <><Check size={14} /> Simpan Perubahan</>)}
          </button>
          <button onClick={handleClose} className="px-4 py-3 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors">
            Tutup
          </button>
        </div>
      </div>

      {confirmClose && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setConfirmClose(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-[#1e2029] p-5 shadow-2xl animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-500/25 bg-amber-500/15 text-amber-400"><Trash2 size={18} /></span>
              <div>
                <h3 className="text-sm font-bold text-white">Buang draft brief?</h3>
                <p className="mt-1 text-xs text-zinc-400">Brief ini belum disimpan. Kalau ditutup sekarang, isinya akan hilang.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmClose(false)} className="h-9 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-700">Batal</button>
              <button onClick={() => { setConfirmClose(false); onClose(); }} className="h-9 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-red-500">Buang draft</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════ CONTENT HUB (manager) ══════════════ */
export default function ContentStudio() {
  const { supabase, activeBoardId, teamMembers, currentUserId, currentUserRole, pushToast }: any = useDashboard();
  const canManage = currentUserRole === 'manager';

  const [tab, setTab] = useState<'kalender' | 'maintable' | 'pipeline' | 'performa'>('kalender');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<any>(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [fPlatform, setFPlatform] = useState('');
  const [fPlatOpen, setFPlatOpen] = useState(false); // dropdown filter platform (kustom, ber-ikon)
  const [dayPopup, setDayPopup] = useState<number | null>(null); // tanggal yang popup daftar brief-nya terbuka

  const refresh = useCallback(async () => {
    if (!supabase || !activeBoardId) return;
    setLoading(true);
    try { setPosts(await loadContent(supabase, activeBoardId)); }
    catch (e: any) { pushToast('Gagal memuat konten: ' + (e?.message || e)); }
    setLoading(false);
    // pushToast sengaja tidak dimasukkan agar refresh tidak berubah identitas tiap render
    // (yang tadinya menyebabkan reload berulang / "layar refresh sendiri").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, activeBoardId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Tutup popup tanggal saat scroll atau Escape (tanpa overlay fixed yang memblokir scroll).
  useEffect(() => {
    if (dayPopup === null) return;
    const close = () => setDayPopup(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDayPopup(null); };
    window.addEventListener('wheel', close, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('wheel', close); window.removeEventListener('keydown', onKey); };
  }, [dayPopup]);

  const shown = posts.filter((p) => (!fPlatform || (p.platform || []).includes(fPlatform)));

  const create = () => {
    if (!canManage) return;
    // Default: dijadwalkan pada tanggal aktif di kalender (jam 10.00). Masih DRAFT (di memori) —
    // baru masuk DB saat "Apply Brief". Jadi klik "Buat Brief" tak lagi bikin baris kosong.
    const fallback = new Date(cursor.y, cursor.m, new Date().getMonth() === cursor.m ? new Date().getDate() : 1, 10, 0);
    setOpen({
      id: 'draft-' + Date.now(),
      board_id: activeBoardId, title: 'Brief Konten Baru', status: 'Brief',
      platform: [], content_type: 'Feed', created_by: currentUserId,
      publish_at: fallback.toISOString(),
      _draft: true,
    });
  };

  // Simpan draft ke DB (dipanggil dari panel saat "Apply Brief").
  const commitDraft = async (draft: any) => {
    const { id, _draft, created_at, updated_at, ...payload } = draft;
    const row = await addContent(supabase, payload);
    setPosts((p) => [...p, row]);
    setOpen(row);
    return row;
  };

  const save = async (next: any) => {
    if (next._draft) { setOpen(next); return; } // draft: cukup di memori sampai di-apply
    const { id, board_id, created_at, updated_at, _draft, ...patch } = next;
    setPosts((p) => p.map((x) => (x.id === id ? next : x)));
    setOpen(next);
    try { await updateContent(supabase, id, patch); }
    catch (e: any) { pushToast('Gagal menyimpan: ' + (e?.message || e)); }
  };

  const remove = async (id: string) => {
    setPosts((p) => p.filter((x) => x.id !== id));
    setOpen(null);
    try { await deleteContent(supabase, id); pushToast('Konten dihapus'); }
    catch (e: any) { pushToast('Gagal hapus: ' + (e?.message || e)); }
  };

  const member = (id: string) => teamMembers.find((m: any) => m.id === id);
  const unscheduled = shown.filter((p) => !p.publish_at);

  // Update satu field tanpa membuka panel (dipakai checklist di Main Table).
  const patchPost = async (id: string, patch: any) => {
    setPosts((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    try { await updateContent(supabase, id, patch); }
    catch (e: any) { pushToast('Gagal menyimpan: ' + (e?.message || e)); }
  };

  // Checklist produksi + progress otomatis (dari jumlah centang).
  const CHECKS: { key: string; label: string }[] = [
    { key: 'planning', label: 'Planning' },
    { key: 'briefing', label: 'Briefing' },
    { key: 'editing', label: 'Editing' },
    { key: 'posting', label: 'Posting' },
    { key: 'finished', label: 'Finished' },
  ];
  const progressOf = (p: any) => Math.round((CHECKS.filter((c) => p[c.key]).length / CHECKS.length) * 100);

  /* ── KALENDER ── */
  /* ── MAIN TABLE ── */
  const renderMainTable = () => (
    <div className="overflow-x-auto mt-scroll rounded-xl border border-zinc-800">
      <style>{`.mt-scroll::-webkit-scrollbar{height:8px;width:8px}.mt-scroll::-webkit-scrollbar-track{background:transparent}.mt-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:9999px}.mt-scroll::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.22)}`}</style>
      <table className="w-full text-xs whitespace-nowrap">
        <thead>
          <tr className="border-b border-zinc-800 bg-[#20222b] text-left text-zinc-500">
            <th className="px-3 py-2.5 font-semibold">Judul</th>
            <th className="px-3 py-2.5 font-semibold">Content Pillar</th>
            <th className="px-3 py-2.5 font-semibold">Platform</th>
            <th className="px-3 py-2.5 font-semibold">Format</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-3 py-2.5 font-semibold">PIC</th>
            <th className="px-3 py-2.5 font-semibold">Jadwal</th>
            {CHECKS.map((c) => <th key={c.key} className="px-2 py-2.5 font-semibold text-center">{c.label}</th>)}
            <th className="px-3 py-2.5 font-semibold">Progress</th>
            <th className="px-3 py-2.5 font-semibold text-center">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {shown.length === 0 ? (
            <tr><td colSpan={9 + CHECKS.length} className="px-3 py-10 text-center text-zinc-600">Belum ada brief. Klik "Buat Brief" untuk menambah.</td></tr>
          ) : shown.map((p) => {
            const pic = member(p.assignee_id);
            const prog = progressOf(p);
            return (
              <tr key={p.id} className="hover:bg-zinc-800/40">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor(p.status)}`} />
                    <span className="font-medium text-zinc-100 truncate max-w-[200px]">{p.title}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-zinc-400">{p.content_pillar || <span className="text-zinc-600">—</span>}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {(p.platform || []).length
                      ? (p.platform || []).slice(0, 4).map((pl: string) => <PlatformIcon key={pl} id={pl} className="w-3.5 h-3.5 text-zinc-400" />)
                      : <span className="text-zinc-600">—</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-zinc-400">{p.content_type || <span className="text-zinc-600">—</span>}</td>
                <td className="px-3 py-2.5"><span className={`text-[10px] text-white px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>{p.status}</span></td>
                <td className="px-3 py-2.5">{pic ? <span className="text-zinc-300">{pic.name}</span> : <span className="text-zinc-600">—</span>}</td>
                <td className="px-3 py-2.5 text-zinc-400">{p.publish_at ? fmtDate(p.publish_at) : <span className="text-zinc-600">—</span>}</td>
                {CHECKS.map((c) => (
                  <td key={c.key} className="px-2 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={!!p[c.key]}
                      disabled={!canManage}
                      onChange={() => patchPost(p.id, { [c.key]: !p[c.key] })}
                      className="w-4 h-4 rounded accent-[#2b5cd5] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </td>
                ))}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-[96px]">
                    <div className="flex-1 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${prog}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-400 w-8 text-right">{prog}%</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setOpen(p)} title="Edit brief" className="p-1.5 rounded-lg text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"><Pencil size={13} /></button>
                    {canManage && <button onClick={() => remove(p.id)} title="Hapus brief" className="p-1.5 rounded-lg text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"><Trash2 size={13} /></button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderKalender = () => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startDay = (first.getDay() + 6) % 7; // Senin = 0
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: any[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const postsOn = (d: number) => shown.filter((p) => {
      if (!p.publish_at) return false;
      const dt = new Date(p.publish_at);
      return dt.getFullYear() === cursor.y && dt.getMonth() === cursor.m && dt.getDate() === d;
    });
    const today = new Date();

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setCursor((c) => ({ y: c.m === 0 ? c.y - 1 : c.y, m: c.m === 0 ? 11 : c.m - 1 }))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400"><ChevronLeft size={15} /></button>
            <span className="text-sm font-bold text-zinc-100 w-40 text-center">{MONTHS[cursor.m]} {cursor.y}</span>
            <button onClick={() => setCursor((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: c.m === 11 ? 0 : c.m + 1 }))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400"><ChevronRight size={15} /></button>
          </div>
          <span className="text-[11px] text-zinc-500">{shown.filter((p) => p.publish_at && new Date(p.publish_at).getMonth() === cursor.m).length} konten bulan ini</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {DAYS.map((d) => <div key={d} className="text-[10px] font-bold text-zinc-600 uppercase text-center py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} className="min-h-[92px] rounded-lg bg-transparent" />;
            const list = postsOn(d);
            const isToday = today.getFullYear() === cursor.y && today.getMonth() === cursor.m && today.getDate() === d;
            return (
              <div key={d} onClick={() => list.length > 0 && setDayPopup(dayPopup === d ? null : d)}
                className={`relative min-h-[92px] rounded-lg border p-1.5 flex flex-col gap-1 transition-colors ${list.length > 0 ? 'cursor-pointer' : ''} ${isToday ? 'border-blue-500/50 bg-blue-500/[0.05]' : 'border-zinc-800 bg-[#20222b] hover:border-zinc-700'}`}>
                <span className={`text-[10px] font-bold ${isToday ? 'text-blue-400' : 'text-zinc-500'}`}>{d}</span>
                {list.slice(0, 3).map((p) => (
                  <div key={p.id} className={`text-[9px] leading-tight text-white px-1.5 py-1 rounded ${statusColor(p.status)} truncate`}>{p.title}</div>
                ))}
                {list.length > 3 && <span className="text-[9px] text-zinc-600 px-1">+{list.length - 3} lagi</span>}

                {dayPopup === d && (
                  <div data-day-popup className="absolute bottom-full left-0 mb-1.5 z-50 w-60 max-w-[80vw] bg-[#2a2c38] border border-zinc-700 rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 pb-1.5">{d} {MONTHS[cursor.m]} · {list.length} brief</div>
                    <div className="max-h-56 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                      {list.length === 0
                        ? <div className="text-[11px] text-zinc-500 px-1 py-2">Belum ada brief di hari ini.</div>
                        : list.map((p) => (
                          <div key={p.id} className={`flex items-center gap-1 rounded-lg ${statusColor(p.status)}`}>
                            <button onClick={(e) => { e.stopPropagation(); setOpen(p); setDayPopup(null); }} className="flex-1 min-w-0 text-left px-2 py-1.5 hover:opacity-90">
                              <span className="block text-[11px] text-white truncate">{p.title}</span>
                            </button>
                            {canManage && (
                              <button onClick={(e) => { e.stopPropagation(); remove(p.id); }} title="Hapus brief" className="shrink-0 p-1.5 mr-0.5 text-white/70 hover:text-white hover:bg-black/25 rounded-md transition-colors">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {canManage && <p className="text-[10px] text-zinc-600 mt-3 text-center">Klik tanggal untuk melihat &amp; mengedit brief pada hari itu.</p>}

        {/* Konten yang belum punya jadwal tayang */}
        {unscheduled.length > 0 && (
          <div className="mt-6 bg-[#20222b] border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <CalendarDays size={12} className="text-amber-400" />
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Belum Dijadwalkan ({unscheduled.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unscheduled.map((p) => (
                <button key={p.id} onClick={() => setOpen(p)} className={`text-[10px] text-white px-2.5 py-1.5 rounded-lg ${statusColor(p.status)} hover:ring-2 ring-white/30 transition-all`}>
                  {p.title}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-zinc-600 mt-2.5">Buka kontennya lalu isi Jadwal Tayang agar muncul di kalender.</p>
          </div>
        )}
      </div>
    );
  };

  /* ── PIPELINE ── */
  const renderPipeline = () => (
    <div className="flex gap-3 overflow-x-auto mt-scroll pb-4">
      <style>{`.mt-scroll::-webkit-scrollbar{height:8px;width:8px}.mt-scroll::-webkit-scrollbar-track{background:transparent}.mt-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:9999px}.mt-scroll::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.22)}`}</style>
      {CONTENT_STATUS.map((s) => {
        const list = shown.filter((p) => p.status === s.id);
        return (
          <div key={s.id} className="w-64 shrink-0">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${s.color}`} />
                <span className="text-xs font-bold text-zinc-200">{s.id}</span>
              </div>
              <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">{list.length}</span>
            </div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData('cid'); const p = posts.find((x) => x.id === id); if (p && p.status !== s.id && canManage) save({ ...p, status: s.id }); }}
              className="flex flex-col gap-2 min-h-[160px] bg-[#1a1c23]/60 rounded-xl p-2 border border-zinc-800/60"
            >
              {list.map((p) => {
                const m = member(p.assignee_id);
                return (
                  <div key={p.id} draggable={canManage} onDragStart={(e) => e.dataTransfer.setData('cid', p.id)} onClick={() => setOpen(p)}
                    className="bg-[#262934] hover:bg-[#2c2f3b] border border-zinc-700/60 rounded-lg p-2.5 cursor-pointer transition-colors">
                    <p className="text-xs text-zinc-100 font-medium leading-snug mb-2">{p.title}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(p.platform || []).slice(0, 3).map((pl: string) => (
                        <span key={pl} className={`text-[8px] font-bold text-white px-1.5 py-0.5 rounded ${platformMeta(pl).color}`}>{platformMeta(pl).label}</span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-zinc-500 flex items-center gap-1"><CalendarDays size={9} />{fmtDate(p.publish_at)}</span>
                      {m && <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${m.color?.startsWith('bg-') ? m.color : 'bg-[#579bfc]'}`}>{m.initials}</span>}
                    </div>
                  </div>
                );
              })}
              {list.length === 0 && <p className="text-[10px] text-zinc-700 text-center py-6">Kosong</p>}
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ── PERFORMA ── */
  const renderPerforma = () => {
    const tayang = shown.filter((p) => p.status === 'Tayang');
    const sum = (k: string) => tayang.reduce((a, p) => a + Number(p[k] || 0), 0);
    const totalReach = sum('reach');
    const totalEng = sum('likes') + sum('comments') + sum('shares') + sum('saves');
    const avgER = totalReach ? Math.round((totalEng / totalReach) * 1000) / 10 : 0;
    const top = [...tayang].sort((a, b) => engagementRate(b) - engagementRate(a)).slice(0, 5);

    return (
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Konten Tayang', val: tayang.length, color: 'text-purple-400' },
            { label: 'Total Reach', val: totalReach.toLocaleString('id-ID'), color: 'text-blue-400' },
            { label: 'Total Engagement', val: totalEng.toLocaleString('id-ID'), color: 'text-emerald-400' },
            { label: 'Rata-rata ER', val: `${avgER}%`, color: 'text-amber-400' },
          ].map((s) => (
            <div key={s.label} className="bg-[#20222b] border border-zinc-800 rounded-xl p-4">
              <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Konten Terbaik (Engagement Rate)</div>
        <div className="flex flex-col gap-1.5">
          {top.map((p, i) => {
            const er = engagementRate(p);
            return (
              <button key={p.id} onClick={() => setOpen(p)} className="flex items-center gap-3 bg-[#20222b] hover:bg-[#262934] border border-zinc-800 rounded-lg px-4 py-3 text-left transition-colors">
                <span className="text-sm font-bold text-zinc-600 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-100 font-medium truncate">{p.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                    <span className="flex items-center gap-1"><Eye size={9} />{Number(p.reach || 0).toLocaleString('id-ID')}</span>
                    <span className="flex items-center gap-1"><Heart size={9} />{Number(p.likes || 0).toLocaleString('id-ID')}</span>
                    <span>{fmtDate(p.publish_at)}</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-full shrink-0">{er}%</span>
              </button>
            );
          })}
          {top.length === 0 && <p className="text-xs text-zinc-600 py-8 text-center bg-[#20222b] border border-zinc-800 rounded-xl">Belum ada konten berstatus "Tayang" dengan metrik.</p>}
        </div>
      </div>
    );
  };

  if (!activeBoardId) return <p className="text-sm text-zinc-500 py-16 text-center">Pilih board terlebih dahulu.</p>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1 bg-[#20222b] border border-zinc-800 rounded-xl p-1">
          {[
            { id: 'kalender', label: 'Kalender', icon: <CalendarDays size={13} /> },
            { id: 'maintable', label: 'Table', icon: <Table size={13} /> },
            { id: 'pipeline', label: 'Pipeline', icon: <LayoutGrid size={13} /> },
            { id: 'performa', label: 'Performa', icon: <BarChart3 size={13} /> },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-all ${tab === t.id ? 'bg-[#2b5cd5] text-white shadow-[0_0_14px_rgba(43,92,213,0.35)]' : 'text-zinc-400 hover:text-white'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>


        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setFPlatOpen((v) => !v)} className="flex items-center gap-2 bg-[#20222b] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none hover:border-zinc-700 min-w-[160px]">
              {fPlatform
                ? <><PlatformIcon id={fPlatform} className="w-3.5 h-3.5 shrink-0" /><span className="flex-1 text-left truncate">{platformMeta(fPlatform).label}</span></>
                : <span className="flex-1 text-left">Semua platform</span>}
              <ChevronDown size={13} className="shrink-0 text-zinc-500" />
            </button>
            {fPlatOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFPlatOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-50 w-52 bg-[#2a2c38] border border-zinc-700 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95">
                  <button onClick={() => { setFPlatform(''); setFPlatOpen(false); }} className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${!fPlatform ? 'bg-blue-500/10 text-white' : 'text-zinc-300 hover:bg-zinc-700/60'}`}>
                    <span className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1">Semua platform</span>
                    {!fPlatform && <Check size={13} className="text-blue-400 shrink-0" />}
                  </button>
                  {PLATFORMS.map((p) => {
                    const on = fPlatform === p.id;
                    return (
                      <button key={p.id} onClick={() => { setFPlatform(p.id); setFPlatOpen(false); }} className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${on ? 'bg-blue-500/10 text-white' : 'text-zinc-300 hover:bg-zinc-700/60'}`}>
                        <PlatformIcon id={p.id} className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1 truncate">{p.label}</span>
                        {on && <Check size={13} className="text-blue-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          {canManage && (
            <button onClick={() => create()} className="flex items-center gap-1.5 bg-[#2b5cd5] hover:bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-[0_0_16px_rgba(43,92,213,0.35)] active:scale-[0.97]">
              <Plus size={15} /> Buat Brief
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="min-h-[60vh] flex items-center justify-center"><LoadingLogo size={56} withRing text="Memuat konten" /></div>
      ) : (
        <>
          {tab === 'kalender' && renderKalender()}
          {tab === 'maintable' && renderMainTable()}
          {tab === 'pipeline' && renderPipeline()}
          {tab === 'performa' && renderPerforma()}
        </>
      )}

      {open && (
        <ContentDetail
          post={open} members={teamMembers} canManage={canManage} currentUserId={currentUserId}
          onClose={() => setOpen(null)} onSave={save} onDelete={remove} onCreate={commitDraft}
        />
      )}
    </div>
  );
}
