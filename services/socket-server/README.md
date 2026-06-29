# TCM Socket Server

The Champion Manager canlı maç için Socket.io WebSocket sunucusu. Railway'e (veya herhangi bir Node host) deploy edilir.

## Çalıştırma (yerel)

```bash
cd services/socket-server
npm install
npm start   # :4000
```

## Ortam Değişkenleri

| Değişken | Açıklama |
|---|---|
| `PORT` | Dinlenen port (varsayılan 4000) |
| `EMIT_SECRET` | `/emit` uçunu korur (maç motoru `Authorization: Bearer <secret>` ile çağırır) |
| `CORS_ORIGIN` | İzin verilen origin (varsayılan `*`) |

## Protokol

**İstemci (tarayıcı):**
```js
socket.emit("match:join", matchId);
socket.on("match:event", (e) => { /* olay animasyonu */ });
socket.on("match:update", (u) => { /* skor/dakika */ });
socket.on("match:end", (r) => { /* sonuç overlay */ });
```

**Maç motoru (sunucu → yayın):**
```
POST /emit
Authorization: Bearer <EMIT_SECRET>
{ "matchId": "...", "type": "match:event", "payload": { ... } }
```

## Railway Deploy

1. Railway'de yeni servis → bu klasörü kök al (`services/socket-server`) veya Dockerfile'ı kullan.
2. Ortam değişkenlerini ekle (`EMIT_SECRET`, `CORS_ORIGIN`).
3. Üretilen public URL'i frontend'de `NEXT_PUBLIC_SOCKET_URL` olarak ayarla.

## Frontend Entegrasyonu

`lib/match-socket.ts` içindeki `connectMatch()` yardımcısı `NEXT_PUBLIC_SOCKET_URL` ayarlıysa bu sunucuya bağlanır. Sunucu ayarlı değilse maç sayfası kayıtlı `match_events`'i client-side replay ile gösterir (altyapı gerektirmez).
