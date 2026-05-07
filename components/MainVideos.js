'use client';
import { useEffect, useRef } from 'react';


export default function MainVideos({
  localVideoRef,
  myName, muted, camOff,
  remoteStreams, participants, peerMedia,
  mySocketId, host, isAdmin,
}) {

  const amIHost = isAdmin;
  const hostSocketId = host?.socketId;
  const hostStream = hostSocketId ? remoteStreams[hostSocketId] : null;
  const hostName   = host?.name || 'Host';
  const hostMedia  = hostSocketId ? (peerMedia[hostSocketId] || {}) : {};

  return (
    <div style={S.wrap}>
      <div style={S.panel}>
        <div style={S.panelLabel}>
          {amIHost ? '👑 You (Host)' : `👑 ${hostName}`}
        </div>
        {amIHost ? (
           <LocalTile videoRef={localVideoRef} name={myName} camOff={camOff} muted={muted} isHost />
        ) : (
          hostStream
            ? <RemoteTile stream={hostStream} name={hostName} media={hostMedia} isHost />
            : <EmptyTile label={host ? 'Connecting to host…' : 'Waiting for host…'} />
        )}
      </div>

      <div style={S.divider} />

      <div style={S.panel}>
        <div style={S.panelLabel}>
          {amIHost ? '👤 First Participant' : `👤 You — ${myName}`}
        </div>
        {amIHost ? (
          (() => {
            const firstRemote = Object.entries(remoteStreams)[0];
            if (!firstRemote) return <EmptyTile label="No participants yet" />;
            const [rid, rs] = firstRemote;
            const rp = participants.find(p => p.socketId === rid);
            return <RemoteTile stream={rs} name={rp?.name || 'Participant'} media={peerMedia[rid] || {}} />;
          })()
        ) : (
          <LocalTile videoRef={localVideoRef} name={`${myName} (You)`} camOff={camOff} muted={muted} />
        )}
      </div>
    </div>
  );
}

function LocalTile({ videoRef, name, camOff, muted, isHost }) {
  const initials = name?.split(' ').map(w => w[0]?.toUpperCase()).slice(0, 2).join('') || '?';
  return (
    <div style={S.tile}>
      <video ref={videoRef} autoPlay muted playsInline
        style={{ ...S.video, display: camOff ? 'none' : 'block', transform: 'scaleX(-1)' }}
      />
      {camOff && <Avatar initials={initials} name={name} />}
      <div style={S.nameBar}>
        {isHost && <span style={S.crown}>👑</span>}
        <span style={S.nameTxt}>{name}</span>
        {muted && <span style={S.icon}>🔇</span>}
      </div>
    </div>
  );
}
function RemoteTile({ stream, name, media, isHost }) {
  const ref = useRef(null);
  const initials = name?.split(' ').map(w => w[0]?.toUpperCase()).slice(0, 2).join('') || '?';

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div style={S.tile}>
      <video ref={ref} autoPlay playsInline
        style={{ ...S.video, display: media.camOff ? 'none' : 'block' }}
      />
      {media.camOff && <Avatar initials={initials} name={name} />}
      <div style={S.nameBar}>
        {isHost && <span style={S.crown}>👑</span>}
        <span style={S.nameTxt}>{name}</span>
        {media.muted && <span style={S.icon}>🔇</span>}
      </div>
    </div>
  );
}

function EmptyTile({ label }) {
  return (
    <div style={{ ...S.tile, alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'10px' }}>
      <div style={{ fontSize:'32px', opacity:0.3 }}>📹</div>
      <span style={{ color:'#4a3a6a', fontSize:'11px' }}>{label}</span>
    </div>
  );
}

function Avatar({ initials, name }) {
  return (
    <div style={S.avatar}>
      <div style={S.avatarCircle}>{initials}</div>
      <span style={{ color:'#4a3a6a', fontSize:'11px', marginTop:'6px' }}>Camera off</span>
    </div>
  );
}

const S = {
  wrap: {
    flex: 1, display:'flex', overflow:'hidden',
    background:'#0c0c0c',
  },
  panel: {
    flex: 1, display:'flex', flexDirection:'column', overflow:'hidden',
  },
  panelLabel: {
    padding:'8px 14px', fontSize:'11px', fontWeight:'700',
    color:'#4a3a6a', background:'#0f0a1a',
    borderBottom:'2px solid #1a1033', letterSpacing:'0.04em',
    flexShrink: 0,
  },
  divider: { width:'2px', background:'#1a1033', flexShrink:0 },
  tile: {
    flex: 1, position:'relative', background:'#0a0818',
    display:'flex', overflow:'hidden',
  },
  video: { width:'100%', height:'100%', objectFit:'cover' },
  nameBar: {
    position:'absolute', bottom:0, left:0, right:0,
    display:'flex', alignItems:'center', gap:'6px',
    padding:'8px 12px',
    background:'linear-gradient(transparent, rgba(0,0,0,0.75))',
  },
  nameTxt: { color:'#fff', fontSize:'12px', fontWeight:'700', flex:1 },
  crown: { fontSize:'14px' },
  icon:  { fontSize:'13px' },
  avatar: {
    position:'absolute', inset:0, background:'#080614',
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
  },
  avatarCircle: {
    width:'56px', height:'56px', borderRadius:'50%',
    background:'#3b1f8c', color:'#a78bfa',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:'20px', fontWeight:'700',
  },
};
