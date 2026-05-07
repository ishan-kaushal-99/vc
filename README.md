# Video Call — Next.js

Real-time multi-user video conferencing built with Next.js + Socket.io + WebRTC.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## How It Works

1. Enter your name → Create & Enter (you = admin)
2. Share the 6-character room code with others
3. Others enter name + code → Join Call
4. Everyone connects via WebRTC (peer-to-peer)
5. Admin can kick participants (click once to confirm, again to kick)

## Layout

LEFT panel  = Admin's video
RIGHT panel = Your own camera (if participant) / First participant (if admin)
SIDEBAR     = All other participants, with mini video previews

## WebRTC Flow

- New joiner receives `callThese` list (existing peers) and sends them OFFERS
- Existing peers receive offers and send back ANSWERS
- ICE candidates flow bidirectionally through Socket.io signalling
- If admin leaves, next person is auto-promoted to admin
