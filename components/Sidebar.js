'use client';
import { useEffect, useRef, useState } from 'react';

export default function Sidebar({ remoteStreams, participants, peerMedia, myId, isAdmin, onKick, code }) {

  const hostId = participants.find(p => p.isAdmin)?.id;
  const others  = participants.filter(p => p.id !== myId && p.id !== hostId);

  return (
    <div style={{ width:200, flexShrink:0, background:'#161616', borderLeft:'1px solid #2a2a2a', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      <div style={{ padding:'8px 12px', borderBottom:'1px solid #2a2a2a' }}>
        <div style={{ color:'#666', fontSize:10, textTransform:'uppercase', letterSpacing:1, marginBottom:2 }}>Participants</div>
        <div style={{ color:'#a78bfa', fontSize:16, fontWeight:700 }}>{participants.length}</div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:8 }}>
        {others.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px 8px', color:'#333', fontSize:11 }}>
            No other participants.<br /><br />
            Share code <b style={{ color:'#6d28d9' }}>{code}</b> to invite.
          </div>
        ) : (
          others.map(p => (
            <PersonCard
              key={p.id}
              participant={p}
              stream={remoteStreams[p.id]}
              media={peerMedia[p.id] || {}}
              isAdmin={isAdmin}
              onKick={() => onKick(p.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PersonCard({ participant, stream, media, isAdmin, onKick }) {
  const vRef     = useRef(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (vRef.current && stream) vRef.current.srcObject = stream;
  }, [stream]);

  const initial = participant.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div style={{ marginBottom:8, background:'#111', border:'1px solid #222' }}>
      <div style={{ position:'relative', aspectRatio:'16/9', background:'#0a0a0a', overflow:'hidden' }}>
        {stream && !media.camOff ? (
          <video ref={vRef} autoPlay playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'#2d1b69', color:'#a78bfa', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 }}>
              {initial}
            </div>
          </div>
        )}
        {media.muted && (
          <div style={{ position:'absolute', top:3, right:3, fontSize:10 }}>🔇</div>
        )}
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 8px' }}>
        <span style={{ color:'#ccc', fontSize:11, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:100 }}>
          {participant.name}
          {participant.isAdmin && ' (admin)'}
        </span>

        {isAdmin && (
          <button
            onClick={() => { if (!confirm) { setConfirm(true); setTimeout(()=>setConfirm(false), 3000); } else onKick(); }}
            style={{
              background: confirm ? '#7f1d1d' : 'transparent',
              border: `1px solid ${confirm ? '#991b1b' : '#333'}`,
              color: confirm ? '#fca5a5' : '#555',
              padding:'2px 6px', fontSize:10, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
            }}
          >
            {confirm ? 'Sure?' : 'Kick'}
          </button>
        )}
      </div>
    </div>
  );
}
