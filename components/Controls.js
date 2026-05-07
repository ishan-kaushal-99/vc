'use client';
import { useState } from 'react';

export default function Controls({ muted, camOff, onToggleMute, onToggleCam, onLeave, code }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={S.bar}>
      <CtrlGroup
        onClick={onToggleMute}
        icon={muted ? '🔇' : '🎙️'}
        label={muted ? 'Unmute' : 'Mute'}
        state={muted ? 'off' : ''}
      />

      <CtrlGroup
        onClick={onToggleCam}
        icon={camOff ? '📷' : '🎥'}
        label={camOff ? 'Start Cam' : 'Stop Cam'}
        state={camOff ? 'off' : ''}
      />

      <CtrlGroup
        onClick={copy}
        icon={copied ? '✓' : '🔗'}
        label={copied ? 'Copied!' : 'Share'}
        state={copied ? 'on' : ''}
      />

      <div style={S.gap} />

      <div style={S.group}>
        <button
          className="ctrl off"
          onClick={onLeave}
          style={{ width:'52px', height:'52px', fontSize:'20px' }}
          title="Leave call"
        >✕</button>
        <span style={{ ...S.lbl, color:'#ef4444' }}>Leave</span>
      </div>
    </div>
  );
}

function CtrlGroup({ onClick, icon, label, state }) {
  return (
    <div style={S.group}>
      <button className={`ctrl ${state}`} onClick={onClick} title={label}>
        {icon}
      </button>
      <span style={S.lbl}>{label}</span>
    </div>
  );
}

const S = {
  bar: {
    display:'flex', alignItems:'center', justifyContent:'center',
    gap:'28px', padding:'12px 24px',
    background:'#0f0a1a', borderTop:'2px solid #1a1033',
    flexShrink:0,
  },
  group: { display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' },
  lbl: { color:'#4a3a6a', fontSize:'9px', fontWeight:'700', letterSpacing:'0.06em', textTransform:'uppercase' },
  gap: { width:'2px', height:'40px', background:'#1a1033', margin:'0 4px' },
};
