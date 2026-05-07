const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

/*
  ROOMS = {
    [code]: {
      participants: [ { id: socketId, name, isAdmin } ]
    }
  }
*/
const ROOMS = {};

function makeCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {

    socket.on('create-room', ({ name }, cb) => {
      let code;
      do { code = makeCode(); } while (ROOMS[code]);

      ROOMS[code] = { participants: [] };
      _join(socket, io, code, name, true);
      cb({ ok: true, code });
    });

    socket.on('join-room', ({ name, code }, cb) => {
      const c = (code || '').toUpperCase().trim();
      if (!ROOMS[c]) return cb({ ok: false, error: 'Room not found.' });
      _join(socket, io, c, name, false);
      cb({ ok: true, code: c });
    });

    /*
      Home page joins the socket room before Next.js navigates to /call/[code].
      The server already emitted `joined` while no listener existed on the client.
      The call page emits this so we replay `joined` (same payload as _join).
    */
    socket.on('call-sync', (payload, cb) => {
      const c = (payload?.code || '').toString().toUpperCase().trim();
      if (!c || !ROOMS[c] || socket._room !== c) {
        if (typeof cb === 'function') cb({ ok: false });
        return;
      }
      const room = ROOMS[c];
      const me = room.participants.find(p => p.id === socket.id);
      if (!me) {
        if (typeof cb === 'function') cb({ ok: false });
        return;
      }
      const existing = room.participants.filter(p => p.id !== socket.id).map(p => ({ id: p.id, name: p.name }));
      socket.emit('joined', {
        myId: socket.id,
        code: c,
        isAdmin: me.isAdmin,
        participants: room.participants,
        callThese: existing,
      });
      if (typeof cb === 'function') cb({ ok: true });
    });

    socket.on('offer', ({ to, offer }) => {
      socket.to(to).emit('offer', { from: socket.id, offer });
    });

      socket.on('answer', ({ to, answer }) => {
      socket.to(to).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice', ({ to, candidate }) => {
      socket.to(to).emit('ice', { from: socket.id, candidate });
    });

    socket.on('media', ({ code, muted, camOff }) => {
      socket.to(code).emit('peer-media', { id: socket.id, muted, camOff });
    });

    socket.on('kick', ({ code, target }) => {
      const room = ROOMS[code];
      if (!room) return;
      const me = room.participants.find(p => p.id === socket.id);
      if (!me?.isAdmin) return;

      const tgt = io.sockets.sockets.get(target);
      if (tgt) {
        tgt.emit('kicked');
        tgt.leave(code);
        room.participants = room.participants.filter(p => p.id !== target);
        io.to(code).emit('peer-left', { id: target });
        io.to(code).emit('room-peers', { participants: room.participants });
      }
    });

    socket.on('disconnect', () => {
      const code = socket._room;
      if (!code || !ROOMS[code]) return;

      ROOMS[code].participants = ROOMS[code].participants.filter(p => p.id !== socket.id);

      const r = ROOMS[code];
      if (r.participants.length > 0 && !r.participants.some(p => p.isAdmin)) {
        r.participants[0].isAdmin = true;
        io.to(r.participants[0].id).emit('you-are-admin');
      }

      io.to(code).emit('peer-left', { id: socket.id });
      io.to(code).emit('room-peers', { participants: r.participants });

      if (r.participants.length === 0) delete ROOMS[code];
    });
  });

  function _join(socket, io, code, name, isAdmin) {
    const room = ROOMS[code];

    const existing = room.participants.map(p => ({ id: p.id, name: p.name }));

    socket.join(code);
    socket._room = code;
    socket._name = name;

    room.participants.push({ id: socket.id, name, isAdmin });

    socket.emit('joined', {
      myId: socket.id,
      code,
      isAdmin,
      participants: room.participants,
      callThese: existing,          
    });

    socket.to(code).emit('new-peer', { id: socket.id, name, isAdmin });

    io.to(code).emit('room-peers', { participants: room.participants });
  }

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => console.log(`> http://localhost:${PORT}`));
});
