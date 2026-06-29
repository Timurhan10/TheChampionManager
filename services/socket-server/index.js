// The Champion Manager — Socket.io canlı maç sunucusu (Railway)
// Oda sistemi: match-{matchId}. Maç motoru olayları HTTP /emit ile yayınlar,
// istemciler WebSocket ile dinler.

const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const EMIT_SECRET = process.env.EMIT_SECRET || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  // İstemci bir maç odasına katılır
  socket.on("match:join", (matchId) => {
    if (typeof matchId === "string") socket.join(`match-${matchId}`);
  });
  socket.on("match:leave", (matchId) => {
    if (typeof matchId === "string") socket.leave(`match-${matchId}`);
  });
});

// Sağlık kontrolü
app.get("/", (_req, res) => res.json({ ok: true, service: "tcm-socket" }));

// Maç motoru bu uçtan olay yayınlar.
// Body: { matchId, type: 'match:start'|'match:event'|'match:update'|'match:end', payload }
app.post("/emit", (req, res) => {
  if (EMIT_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${EMIT_SECRET}`) return res.status(401).json({ error: "unauthorized" });
  }
  const { matchId, type, payload } = req.body || {};
  if (!matchId || !type) return res.status(400).json({ error: "matchId ve type gerekli" });
  io.to(`match-${matchId}`).emit(type, payload ?? {});
  return res.json({ ok: true });
});

server.listen(PORT, () => {
  console.log(`TCM socket server listening on :${PORT}`);
});
