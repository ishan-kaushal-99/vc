'use client';
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io({ transports: ['websocket'] });
  }
  return socket;
}

export function killSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
