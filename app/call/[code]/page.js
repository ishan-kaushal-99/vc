'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocket, killSocket } from '../../../lib/socket';
import Sidebar from '../../../components/Sidebar';

const STUN = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function CallPage() {
  const { code }  = useParams();
  const router    = useRouter();

  const myName    = typeof window !== 'undefined' ? (sessionStorage.getItem('vc_name') || 'You') : 'You';

  // ── state ────────────────────────────────────────────────────
  const [myId,         setMyId]         = useState('');
  const [isAdmin,      setIsAdmin]      = useState(false);
  const [participants, setParticipants] = useState([]);
  const [muted,        setMuted]        = useState(false);
  const [camOff,       setCamOff]       = useState(false);
  const [kicked,       setKicked]       = useState(false);

  // remoteStreams: { socketId -> MediaStream }
  const [remoteStreams, setRemoteStreams] = useState({});
  // peerMedia: { socketId -> { muted, camOff } }
  const [peerMedia, setPeerMedia] = useState({});

  // ── refs ─────────────────────────────────────────────────────
  const localStreamRef  = useRef(null);
  const myVideoRef      = useRef(null);   // always: my own local camera
  const hostVideoRef    = useRef(null);   // participant only: host's remote video
  const pcs             = useRef({});     // { socketId -> RTCPeerConnection }

  // ── build a peer connection ───────────────────────────────────
  function buildPC(remoteId, sock) {
    // Close any stale PC first
    if (pcs.current[remoteId]) {
      pcs.current[remoteId].close();
      delete pcs.current[remoteId];
    }

    const pc = new RTCPeerConnection(STUN);
    pcs.current[remoteId] = pc;

    // Add our local tracks so the remote peer gets our video/audio
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t =>
        pc.addTrack(t, localStreamRef.current)
      );
    }

    // When we receive the remote stream
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream) return;
      setRemoteStreams(prev => ({ ...prev, [remoteId]: stream }));
    };

    // Send ICE candidates through the signalling server
    pc.onicecandidate = (e) => {
      if (e.candidate) sock.emit('ice', { to: remoteId, candidate: e.candidate });
    };

    return pc;
  }

  // ── main effect ───────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function init() {
      // 1. Get local camera/mic FIRST
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;
      } catch (e) {
        console.warn('Camera error:', e.message);
      }

      // 2. Get socket
      const sock = getSocket();

      function attach() {
        if (!active) return;

        /*
          'joined' fires for THIS user only.
          callThese = list of people ALREADY in the room.
          We must send an offer to each of them.
        */
        sock.on('joined', ({ myId: id, isAdmin: admin, participants: ps, callThese }) => {
          setMyId(id);
          setIsAdmin(admin);
          setParticipants(ps);

          // Initiate WebRTC offer to each existing peer
          callThese.forEach(({ id: peerId }) => {
            const pc = buildPC(peerId, sock);
            pc.createOffer()
              .then(offer => pc.setLocalDescription(offer))
              .then(() => sock.emit('offer', { to: peerId, offer: pc.localDescription }))
              .catch(err => console.error('createOffer failed:', err));
          });
        });

        /*
          'offer' = someone new joined and is calling us.
          We are an existing peer. We receive their offer and send back an answer.
        */
        sock.on('offer', async ({ from, offer }) => {
          const pc = buildPC(from, sock);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sock.emit('answer', { to: from, answer });
          } catch (err) {
            console.error('handle offer failed:', err);
          }
        });

        /*
          'answer' = response to OUR offer.
        */
        sock.on('answer', async ({ from, answer }) => {
          const pc = pcs.current[from];
          if (!pc) return;
          try {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
            }
          } catch (err) {
            console.error('handle answer failed:', err);
          }
        });

        // ICE candidates
        sock.on('ice', ({ from, candidate }) => {
          const pc = pcs.current[from];
          if (pc && candidate) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        });

        // A peer left (disconnect or kick)
        sock.on('peer-left', ({ id }) => {
          pcs.current[id]?.close();
          delete pcs.current[id];
          setRemoteStreams(prev => { const n = {...prev}; delete n[id]; return n; });
          setPeerMedia(prev => { const n = {...prev}; delete n[id]; return n; });
        });

        // Updated participant list
        sock.on('room-peers', ({ participants: ps }) => setParticipants(ps));

        // Peer muted/unmuted their camera or mic
        sock.on('peer-media', ({ id, muted: m, camOff: c }) => {
          setPeerMedia(prev => ({ ...prev, [id]: { muted: m, camOff: c } }));
        });

        // Admin promotion
        sock.on('you-are-admin', () => setIsAdmin(true));

        // We got kicked
        sock.on('kicked', () => {
          setKicked(true);
          setTimeout(() => router.push('/'), 2500);
        });
      }

      if (sock.connected) attach(); else sock.once('connect', attach);
    }

    init();

    return () => {
      active = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(pcs.current).forEach(pc => pc.close());
      pcs.current = {};
      const s = getSocket();
      ['joined','offer','answer','ice','peer-left','room-peers','peer-media','you-are-admin','kicked']
        .forEach(ev => s.off(ev));
    };
  }, []);

  // ── Attach host's remote stream to hostVideoRef ───────────────
  // We find who is admin from participants, then get their stream
  const hostParticipant = participants.find(p => p.isAdmin && p.id !== myId);
  const hostStream      = hostParticipant ? remoteStreams[hostParticipant.id] : null;

  useEffect(() => {
    if (hostVideoRef.current && hostStream) {
      hostVideoRef.current.srcObject = hostStream;
    }
  }, [hostStream]);

  // ── Controls ──────────────────────────────────────────────────
  function toggleMute() {
    if (!localStreamRef.current) return;
    const next = !muted;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
    setMuted(next);
    getSocket().emit('media', { code, muted: next, camOff });
  }

  function toggleCam() {
    if (!localStreamRef.current) return;
    const next = !camOff;
    localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !next; });
    setCamOff(next);
    getSocket().emit('media', { code, muted, camOff: next });
  }

  function leave() {
    killSocket();
    router.push('/');
  }

  function kickUser(targetId) {
    getSocket().emit('kick', { code, target: targetId });
  }

  // ── Kicked screen ─────────────────────────────────────────────
  if (kicked) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#111' }}>
      <div style={{ textAlign:'center', padding:32, background:'#1a1a1a', border:'1px solid #333' }}>
        <p style={{ color:'#f87171', fontSize:18, fontWeight:700 }}>You were removed from the call.</p>
        <p style={{ color:'#555', fontSize:12, marginTop:8 }}>Redirecting...</p>
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#111' }}>

      {/* ── TOP BAR ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', height:44, background:'#1a1a1a', borderBottom:'1px solid #2a2a2a', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ color:'#a78bfa', fontWeight:700, fontSize:14 }}>Video Call</span>
          <span style={{ color:'#555', fontSize:11 }}>|</span>
          <span style={{ color:'#888', fontSize:12 }}>Room: <b style={{ color:'#a78bfa', letterSpacing:2 }}>{code}</b></span>
          {isAdmin && <span style={{ background:'#2d1b69', color:'#a78bfa', padding:'2px 8px', fontSize:10, fontWeight:700 }}>ADMIN</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ color:'#555', fontSize:11 }}>{myName}</span>
          <span style={{ color:'#555', fontSize:11 }}>{participants.length} in call</span>
          <button onClick={leave} style={{ background:'#7f1d1d', border:'none', color:'#fca5a5', padding:'5px 14px', fontSize:11, fontWeight:700 }}>Leave</button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* ── LEFT: HOST video ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', borderRight:'1px solid #2a2a2a' }}>
          <div style={{ padding:'6px 12px', background:'#161616', borderBottom:'1px solid #2a2a2a', fontSize:11, color:'#666' }}>
            {isAdmin ? `You — ${myName} (admin)` : (hostParticipant ? `${hostParticipant.name} (admin)` : 'Waiting for admin...')}
          </div>
          <div style={{ flex:1, position:'relative', background:'#0a0a0a' }}>
            {/* Admin sees their OWN camera on the left */}
            {isAdmin && (
              <>
                <video ref={myVideoRef} autoPlay muted playsInline
                  style={{ width:'100%', height:'100%', objectFit:'cover', display: camOff ? 'none' : 'block', transform:'scaleX(-1)' }}
                />
                {camOff && <CamOffPlaceholder name={myName} />}
                {muted && <MutedBadge />}
              </>
            )}
            {/* Participant sees host's remote video on the left */}
            {!isAdmin && (
              <>
                <video ref={hostVideoRef} autoPlay playsInline
                  style={{ width:'100%', height:'100%', objectFit:'cover', display: (hostParticipant && !peerMedia[hostParticipant?.id]?.camOff) ? 'block' : 'none' }}
                />
                {(!hostParticipant || peerMedia[hostParticipant?.id]?.camOff) && (
                  <CamOffPlaceholder name={hostParticipant?.name || 'Host'} empty={!hostParticipant} />
                )}
                {hostParticipant && peerMedia[hostParticipant.id]?.muted && <MutedBadge />}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: YOUR own video ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', borderRight:'1px solid #2a2a2a' }}>
          <div style={{ padding:'6px 12px', background:'#161616', borderBottom:'1px solid #2a2a2a', fontSize:11, color:'#666' }}>
            {isAdmin
              ? (Object.keys(remoteStreams).length > 0
                  ? (() => { const firstId = Object.keys(remoteStreams)[0]; const p = participants.find(x=>x.id===firstId); return p?.name || 'Participant'; })()
                  : 'Waiting for participants...')
              : `You — ${myName}`}
          </div>
          <div style={{ flex:1, position:'relative', background:'#0a0a0a' }}>
            {/* Participant sees their OWN camera on the right */}
            {!isAdmin && (
              <>
                <video ref={myVideoRef} autoPlay muted playsInline
                  style={{ width:'100%', height:'100%', objectFit:'cover', display: camOff ? 'none' : 'block', transform:'scaleX(-1)' }}
                />
                {camOff && <CamOffPlaceholder name={myName} />}
                {muted && <MutedBadge />}
              </>
            )}
            {/* Admin sees first participant on the right */}
            {isAdmin && <AdminFirstParticipant remoteStreams={remoteStreams} participants={participants} peerMedia={peerMedia} myId={myId} />}
          </div>
        </div>

        {/* ── SIDEBAR ── */}
        <Sidebar
          remoteStreams={remoteStreams}
          participants={participants}
          peerMedia={peerMedia}
          myId={myId}
          isAdmin={isAdmin}
          onKick={kickUser}
          code={code}
        />
      </div>

      {/* ── CONTROLS ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:24, padding:'12px 0', background:'#161616', borderTop:'1px solid #2a2a2a', flexShrink:0 }}>
        <CtrlBtn onClick={toggleMute} active={muted} label={muted ? 'Unmute' : 'Mute'} icon={muted ? '🔇' : '🎙️'} danger={muted} />
        <CtrlBtn onClick={toggleCam} active={camOff} label={camOff ? 'Start Cam' : 'Stop Cam'} icon={camOff ? '📷' : '🎥'} danger={camOff} />
        <CtrlBtn
          onClick={() => { navigator.clipboard.writeText(code); }}
          label="Copy Code" icon="🔗"
        />
        <CtrlBtn onClick={leave} label="Leave" icon="✕" danger />
      </div>
    </div>
  );
}

/* ── Admin's right panel: first remote participant ── */
function AdminFirstParticipant({ remoteStreams, participants, peerMedia, myId }) {
  const entries = Object.entries(remoteStreams);
  if (entries.length === 0) {
    return (
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
        <div style={{ fontSize:32, opacity:0.2 }}>📹</div>
        <span style={{ color:'#333', fontSize:11 }}>Waiting for participants...</span>
      </div>
    );
  }
  const [firstId, stream] = entries[0];
  const p = participants.find(x => x.id === firstId);
  return <RemoteVideoBox stream={stream} name={p?.name || 'Participant'} media={peerMedia[firstId] || {}} />;
}

/* ── Remote video box (attaches stream via ref) ── */
function RemoteVideoBox({ stream, name, media }) {
  const vRef = useRef(null);
  useEffect(() => {
    if (vRef.current && stream) vRef.current.srcObject = stream;
  }, [stream]);
  return (
    <>
      <video ref={vRef} autoPlay playsInline
        style={{ width:'100%', height:'100%', objectFit:'cover', display: media.camOff ? 'none' : 'block' }}
      />
      {media.camOff && <CamOffPlaceholder name={name} />}
      {media.muted && <MutedBadge />}
    </>
  );
}

/* ── Camera off placeholder ── */
function CamOffPlaceholder({ name, empty }) {
  const initial = name?.charAt(0)?.toUpperCase() || '?';
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, background:'#0a0a0a' }}>
      {empty ? (
        <span style={{ color:'#333', fontSize:12 }}>{name}</span>
      ) : (
        <>
          <div style={{ width:52, height:52, borderRadius:'50%', background:'#2d1b69', display:'flex', alignItems:'center', justifyContent:'center', color:'#a78bfa', fontSize:20, fontWeight:700 }}>
            {initial}
          </div>
          <span style={{ color:'#444', fontSize:11 }}>Camera off</span>
        </>
      )}
    </div>
  );
}

/* ── Muted badge ── */
function MutedBadge() {
  return (
    <div style={{ position:'absolute', top:8, left:8, background:'rgba(127,29,29,0.85)', padding:'2px 7px', fontSize:11 }}>
      🔇 Muted
    </div>
  );
}

/* ── Control button ── */
function CtrlBtn({ onClick, icon, label, danger, active }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:4,
      background: danger ? (active ? '#7f1d1d' : '#7f1d1d') : '#1e1e1e',
      border: `1px solid ${danger ? '#991b1b' : '#333'}`,
      color: danger ? '#fca5a5' : '#aaa',
      padding:'8px 14px', minWidth:60,
    }}>
      <span style={{ fontSize:18 }}>{icon}</span>
      <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>{label}</span>
    </button>
  );
}
