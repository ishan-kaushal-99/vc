'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '../lib/socket';

export default function Home() {
  const router = useRouter();
  const [tab,  setTab]  = useState('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err,  setErr]  = useState('');
  const [busy, setBusy] = useState(false);

  function submit() {
    if (!name.trim()) return setErr('Enter your name');
    if (tab === 'join' && !code.trim()) return setErr('Enter a room code');
    setErr(''); setBusy(true);

    const sock = getSocket();

    function run() {
      if (tab === 'create') {
        sock.emit('create-room', { name: name.trim() }, (res) => {
          setBusy(false);
          if (res.ok) { sessionStorage.setItem('vc_name', name.trim()); router.push('/call/' + res.code); }
          else setErr(res.error);
        });
      } else {
        sock.emit('join-room', { name: name.trim(), code: code.trim() }, (res) => {
          setBusy(false);
          if (res.ok) { sessionStorage.setItem('vc_name', name.trim()); router.push('/call/' + res.code); }
          else setErr(res.error);
        });
      }
    }

    if (sock.connected) run(); else sock.once('connect', run);
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#111' }}>
      <div style={{ width:360, background:'#1a1a1a', border:'1px solid #333', padding:32 }}>

        <h1 style={{ color:'#a78bfa', fontSize:20, marginBottom:4 }}>Video Call</h1>
        <p style={{ color:'#555', fontSize:12, marginBottom:24 }}>Real-time multi-user video conferencing</p>

        <div style={{ display:'flex', marginBottom:20, borderBottom:'1px solid #333' }}>
          {['create','join'].map(t => (
            <button key={t} onClick={() => { setTab(t); setErr(''); }} style={{
              flex:1, padding:'9px 0', border:'none', fontSize:12, fontWeight:700,
              background: tab===t ? '#6d28d9' : 'transparent',
              color: tab===t ? '#fff' : '#555',
            }}>{t === 'create' ? 'Create Room' : 'Join Room'}</button>
          ))}
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, color:'#555', marginBottom:5, textTransform:'uppercase', letterSpacing:1 }}>Your Name</div>
          <input value={name} onChange={e=>{setName(e.target.value);setErr('');}}
            onKeyDown={e=>e.key==='Enter'&&submit()}
            placeholder="Enter your name"
            style={{ width:'100%', padding:'9px 10px', background:'#111', border:'1px solid #333', color:'#ddd', fontSize:13, outline:'none' }}
          />
        </div>


        {tab === 'join' && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, color:'#555', marginBottom:5, textTransform:'uppercase', letterSpacing:1 }}>Room Code</div>
            <input value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setErr('');}}
              onKeyDown={e=>e.key==='Enter'&&submit()}
              placeholder="6-character code"
              maxLength={6}
              style={{ width:'100%', padding:'9px 10px', background:'#111', border:'1px solid #333', color:'#a78bfa', fontSize:16, fontWeight:700, letterSpacing:4, outline:'none' }}
            />
          </div>
        )}


        {err && <div style={{ background:'#2d0000', border:'1px solid #550000', color:'#f87171', padding:'8px 10px', fontSize:12, marginBottom:14 }}>{err}</div>}

        <button onClick={submit} disabled={busy} style={{
          width:'100%', padding:12, background: busy ? '#4a1d96' : '#6d28d9',
          border:'none', color:'#fff', fontSize:13, fontWeight:700,
        }}>
          {busy ? 'Connecting...' : tab==='create' ? 'Create & Enter' : 'Join Call'}
        </button>
      </div>
    </div>
  );
}
