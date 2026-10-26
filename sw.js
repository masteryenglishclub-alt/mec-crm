/* MEC · service worker de la app instalable (26-oct-2026).
   - Solo maneja peticiones GET del MISMO sitio. Supabase (datos, audios, inicio de sesión) nunca pasa por aquí ni se guarda.
   - Páginas: primero la red (siempre lo más nuevo); sin conexión, la última copia o un aviso.
   - css/js/img/fuentes: copia rápida y se actualiza por detrás (los ?v= de cada archivo evitan versiones viejas).
   Para forzar a todos a limpiar la caché: cambiar VERSION. */
const VERSION = "mec-20261026a";
const STATIC = /\.(css|js|webp|png|jpe?g|svg|ico|ttf|woff2?|webmanifest)$/i;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
  await self.clients.claim();
})()));
const OFFLINE = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión · MEC</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#07101c;color:#e8edf3;font:16px system-ui,sans-serif;text-align:center;padding:24px">
<div><img src="img/app/icon-192.png" width="96" height="96" alt="" style="border-radius:50%"><h1 style="color:#f0c46a;font-size:1.3rem">Sin conexión</h1>
<p>Revisa tu internet y vuelve a intentarlo.</p><p><button onclick="location.reload()" style="background:#f0c46a;border:0;border-radius:6px;padding:10px 18px;font-weight:700">Reintentar</button></p></div></body></html>`;
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin) return;
  if (r.mode === "navigate") {
    e.respondWith((async () => {
      try { const res = await fetch(r); if (res.ok) (await caches.open(VERSION)).put(r, res.clone()); return res; }
      catch (err) { return (await caches.match(r, { ignoreSearch: true })) || new Response(OFFLINE, { headers: { "content-type": "text/html; charset=utf-8" } }); }
    })());
    return;
  }
  if (STATIC.test(u.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION), hit = await c.match(r);
      const net = fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || Response.error();
    })());
  }
});
