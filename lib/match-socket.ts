// Opsiyonel canlı maç bağlantısı. NEXT_PUBLIC_SOCKET_URL ayarlıysa Socket.io
// sunucusuna bağlanır; değilse null döner ve maç sayfası replay moduna düşer.
import { io, type Socket } from "socket.io-client";

export function connectMatch(matchId: string): Socket | null {
  const url = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (!url) return null;

  const socket = io(url, { transports: ["websocket"], autoConnect: true });
  socket.on("connect", () => socket.emit("match:join", matchId));
  return socket;
}

export function disconnectMatch(socket: Socket | null, matchId: string) {
  if (!socket) return;
  socket.emit("match:leave", matchId);
  socket.disconnect();
}
