'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff, PhoneOff, Loader2, Volume2, MonitorUp,
} from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';

const mColor = (m: any) => (m?.color && String(m.color).startsWith('bg-') ? m.color : 'bg-[#579bfc]');

/* Satu ubin untuk satu sumber video: 'camera' atau 'screen_share'.
   Ubin kamera juga menempelkan audio mikrofon peserta (sekali per orang). */
function MediaTile({ participant, source, isLocal, teamMembers }: any) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(true);
  const isScreen = source === 'screen_share';
  const member = teamMembers.find((m: any) => m.id === participant.identity);

  useEffect(() => {
    const vEl = videoRef.current;

    const attachVideo = () => {
      const pub = [...participant.videoTrackPublications.values()].find((p: any) => p.source === source);
      if (pub?.track && vEl) {
        try { pub.track.attach(vEl); setHasVideo(true); } catch { setHasVideo(false); }
      } else {
        setHasVideo(false);
      }
    };

    // Audio mikrofon: hanya di ubin kamera, bukan lokal (cegah echo)
    const attachAudio = () => {
      if (isLocal || isScreen || !audioRef.current) return;
      const micPub = [...participant.audioTrackPublications.values()].find((p: any) => p.track && p.source === 'microphone');
      if (micPub?.track) { try { micPub.track.attach(audioRef.current); } catch {} }
    };

    const update = () => {
      attachVideo();
      attachAudio();
      const micPub = [...participant.audioTrackPublications.values()].find((p: any) => p.source === 'microphone');
      setMuted(micPub ? micPub.isMuted : true);
    };

    update();
    const evs = ['trackSubscribed', 'trackUnsubscribed', 'trackMuted', 'trackUnmuted', 'trackPublished', 'trackUnpublished', 'localTrackPublished', 'localTrackUnpublished'];
    evs.forEach((e) => participant.on(e, update));
    const spk = (s: boolean) => setSpeaking(s);
    participant.on('isSpeakingChanged', spk);

    return () => {
      evs.forEach((e) => participant.off(e, update));
      participant.off('isSpeakingChanged', spk);
    };
  }, [participant, source, isLocal, isScreen]);

  return (
    <div className={`relative rounded-xl overflow-hidden bg-[#15171c] border-2 transition-colors aspect-video ${isScreen ? 'border-[#124bce] col-span-full lg:col-span-2 row-span-2' : speaking ? 'border-emerald-500' : 'border-zinc-800'}`}>
      <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full ${isScreen ? 'object-contain bg-black' : 'object-cover'} ${hasVideo ? '' : 'hidden'} ${(!isScreen && isLocal) ? 'scale-x-[-1]' : ''}`} />
      {!isScreen && !isLocal && <audio ref={audioRef} autoPlay />}

      {isScreen ? (
        <>
          {!hasVideo && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs">Memuat layar…</div>
          )}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-[#124bce]/90 backdrop-blur px-2 py-1 rounded-lg z-10">
            <MonitorUp size={11} className="text-white" />
            <span className="text-[10px] text-white font-semibold truncate max-w-[160px]">Layar · {member?.name?.split(' ')[0] || 'Anggota'}{isLocal ? ' (Anda)' : ''}</span>
          </div>
        </>
      ) : (
        <>
          {!hasVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white ${mColor(member)} ${speaking ? 'ring-4 ring-emerald-500/60' : ''}`}>
                {member?.initials || '?'}
              </span>
            </div>
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur px-2 py-1 rounded-lg z-10">
            {muted ? <MicOff size={11} className="text-red-400" /> : <Mic size={11} className="text-emerald-400" />}
            <span className="text-[10px] text-white font-medium truncate max-w-[120px]">{member?.name || 'Anggota'}{isLocal ? ' (Anda)' : ''}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function VoiceRoom({ channel, onLeave }: any) {
  const { supabase, teamMembers, currentUserId, pushToast }: any = useDashboard();
  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const roomRef = useRef<any>(null);

  const sync = useCallback((r: any) => {
    setParticipants([r.localParticipant, ...Array.from(r.remoteParticipants.values())]);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ channelId: channel.id }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || 'Gagal mendapatkan token');
        if (!j.url) throw new Error('URL LiveKit belum diset.');

        const LK = await import('livekit-client');
        const r = new LK.Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = r;

        const resync = () => { if (mounted) sync(r); };
        r.on('participantConnected', resync);
        r.on('participantDisconnected', resync);
        r.on('trackSubscribed', resync);
        r.on('trackUnsubscribed', resync);
        r.on('trackPublished', resync);
        r.on('trackUnpublished', resync);
        r.on('localTrackPublished', resync);
        r.on('localTrackUnpublished', (pub: any) => {
          // Bila layar berhenti dibagikan (mis. lewat tombol "Stop sharing" bawaan browser)
          if (pub?.source === 'screen_share' || pub?.track?.source === 'screen_share') {
            if (mounted) setScreenOn(false);
          }
          resync();
        });
        r.on('disconnected', () => { if (mounted) onLeave(); });

        await r.connect(j.url, j.token);
        await r.localParticipant.setMicrophoneEnabled(true);
        try { await r.startAudio(); } catch {}
        if (!mounted) { r.disconnect(); return; }
        setRoom(r); setMicOn(true); setConnecting(false); sync(r);
      } catch (e: any) {
        if (mounted) { setError(e?.message || 'Gagal bergabung ke voice'); setConnecting(false); }
      }
    })();

    return () => { mounted = false; if (roomRef.current) roomRef.current.disconnect(); };
  }, [channel.id]); // eslint-disable-line

  const toggleMic = async () => {
    if (!room) return;
    const on = !micOn; await room.localParticipant.setMicrophoneEnabled(on); setMicOn(on);
  };
  const toggleCam = async () => {
    if (!room) return;
    const on = !camOn; await room.localParticipant.setCameraEnabled(on); setCamOn(on); sync(room);
  };
  const toggleScreen = async () => {
    if (!room) return;
    const on = !screenOn;
    try {
      await room.localParticipant.setScreenShareEnabled(on);
      setScreenOn(on); sync(room);
    } catch (e: any) {
      setScreenOn(false);
      const name = String(e?.name || '');
      const msg = String(e?.message || '');
      // Pengguna menutup dialog pemilih layar → itu bukan error, diamkan saja.
      if (name === 'NotAllowedError' || name === 'AbortError' || name === 'NotFoundError' || /permission denied|cancell?ed|the request is not allowed/i.test(msg)) {
        return;
      }
      // Error sungguhan → tampilkan pesan aslinya agar bisa didiagnosis.
      pushToast('Gagal berbagi layar: ' + (msg || 'coba lagi'));
    }
  };
  const leave = () => { if (roomRef.current) roomRef.current.disconnect(); onLeave(); };

  // Susun ubin: layar (bila ada) + kamera/avatar untuk tiap peserta
  const tiles: any[] = [];
  participants.forEach((p) => {
    const sharingScreen = [...p.videoTrackPublications.values()].some((pub: any) => pub.source === 'screen_share' && pub.track);
    if (sharingScreen) tiles.push({ key: `${p.identity}-screen`, p, source: 'screen_share' });
    tiles.push({ key: `${p.identity}-cam`, p, source: 'camera' });
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#1a1c22]">
      {/* header */}
      <div className="h-12 border-b border-zinc-800 flex items-center gap-2 px-4 shrink-0">
        <Volume2 size={16} className="text-emerald-400" />
        <span className="text-sm font-bold text-zinc-100">{channel.name}</span>
        <span className="text-[11px] text-zinc-500">· {participants.length} terhubung</span>
      </div>

      {/* grid peserta */}
      <div className="flex-1 overflow-y-auto p-4">
        {error ? (
          <div className="h-full min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center px-6 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <Volume2 size={26} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Voice belum bisa digunakan</p>
              <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{error}</p>
            </div>
            {/(dikonfigurasi|belum diset|LIVEKIT)/i.test(error) && (
              <p className="text-[11px] text-zinc-600 leading-relaxed bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3">
                Admin perlu mengatur kunci <b>LiveKit</b> (URL, API Key, API Secret) di environment server, lalu men-deploy ulang. Fitur teks chat tetap berjalan normal.
              </p>
            )}
            <button onClick={onLeave} className="mt-1 flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all">
              Kembali ke Chat
            </button>
          </div>
        ) : connecting ? (
          <div className="h-full min-h-[50vh] flex flex-col items-center justify-center gap-3 text-zinc-500">
            <Loader2 size={28} className="animate-spin text-emerald-400" />
            <p className="text-sm">Menghubungkan ke ruang suara…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-min gap-3 max-w-5xl mx-auto">
            {tiles.map((t) => (
              <MediaTile key={t.key} participant={t.p} source={t.source} teamMembers={teamMembers} isLocal={t.p.identity === currentUserId} />
            ))}
          </div>
        )}
      </div>

      {/* bilah kontrol */}
      <div className="shrink-0 border-t border-zinc-800 bg-[#15171c] px-4 py-3 flex items-center justify-center gap-2.5">
        <button onClick={toggleMic} title={micOn ? 'Matikan mic' : 'Nyalakan mic'}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${micOn ? 'bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-red-500 text-white'}`}>
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <button onClick={toggleCam} title={camOn ? 'Matikan kamera' : 'Nyalakan kamera'}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${camOn ? 'bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
          {camOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>
        <button onClick={toggleScreen} title={screenOn ? 'Stop berbagi layar' : 'Bagikan layar'}
          className={`w-11 h-11 rounded-full items-center justify-center transition-all active:scale-90 hidden sm:flex ${screenOn ? 'bg-[#124bce] text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
          {screenOn ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}
        </button>
        <button onClick={leave} title="Keluar dari voice"
          className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all active:scale-90 ml-2">
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
