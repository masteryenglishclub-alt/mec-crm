/* Sitio público MEC: nav compartido, avatares SVG, casos de éxito y globo. Sin dependencias externas. */
(function () {
  const D = window.MEC_WEB, $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const wa = () => "https://wa.me/" + D.whatsapp + "?text=" + encodeURIComponent(D.whatsappText);
  // Nav
  const page = (location.pathname.split("/").pop() || "index.html");
  const links = [["index.html", "Inicio"], ["metodologia.html", "Metodología y material"], ["kids.html", "Mastery4Kids"], ["precios.html", "Precios"], ["eventos.html", "Eventos"], ["staff.html", "Staff"], ["contacto.html", "Contáctanos"]];
  const nav = $("#site-nav");
  if (nav) {
    nav.innerHTML = `<div class="wrap navbar"><a class="nav-brand" href="index.html"><img src="img/mec-logo-escudo-96.webp" alt="" width="40" height="40"><span>Mastery English Club</span></a>
      <button class="nav-toggle" aria-label="Menú" aria-expanded="false">☰</button>
      <ul class="nav-links">${links.map(([h, t]) => `<li><a href="${h}"${h === page ? ' aria-current="page"' : ""}>${t}</a></li>`).join("")}
      <li><a class="btn sm" href="login.html">Ingresar</a></li></ul></div>`;
    const t = $(".nav-toggle", nav); t.onclick = () => { const o = nav.classList.toggle("open"); t.setAttribute("aria-expanded", o); };
  }
  document.querySelectorAll("[data-wa]").forEach((a) => { a.href = wa(); a.target = "_blank"; a.rel = "noopener"; });
  document.querySelectorAll("[data-ig]").forEach((a) => { a.href = D.instagram; a.target = "_blank"; a.rel = "noopener"; });
  document.querySelectorAll("[data-fb]").forEach((a) => { a.href = D.facebook; });
  const y = $("#year"); if (y) y.textContent = new Date().getFullYear();

  // Eventos públicos (MEC_WEB.eventos): tarjetas con fecha; si no hay ninguno futuro se queda la tarjeta «Pronto»
  const evl = $("#eventos-lista");
  if (evl) {
    const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"], DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
    const fut = (D.eventos || []).filter((e) => e && e.titulo && Date.parse(e.fecha) >= Date.now()).sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha));
    if (fut.length) {
      const bog = (iso) => { const p = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)); const g = (t) => (p.find((x) => x.type === t) || {}).value; return { d: g("day"), m: +g("month"), w: g("weekday").replace(".", ""), h: g("hour") + ":" + g("minute") }; };
      evl.innerHTML = fut.map((e) => { const b = bog(e.fecha); return `<article class="ev-pub"><div class="ev-fecha" aria-hidden="true"><span class="ev-dow">${esc(b.w)}</span><b>${esc(b.d)}</b><span class="ev-mes">${MES[b.m - 1]}</span></div>
        <span class="ev-hora">${esc(b.h)} · hora de Bogotá</span><h2>${esc(e.titulo)}</h2>${e.tema ? `<p>Tema: <b>${esc(e.tema)}</b></p>` : ""}${e.texto ? `<p>${esc(e.texto)}</p>` : ""}
        ${/^https:\/\//.test(e.enlace || "") ? `<p><a class="btn sm" href="${esc(e.enlace)}" target="_blank" rel="noopener">Más información</a></p>` : ""}</article>`; }).join("");
      evl.hidden = false; const pr = $("#eventos"); if (pr) pr.hidden = true;
    }
  }

  // Avatar ilustrado (SVG propio, claramente no fotográfico)
  function avatar(a) {
    const hair = a.peinado === "largo" ? `<path d="M22 46c0-22 12-32 28-32s28 10 28 32v34H68V48H32v32H22z" fill="${a.pelo}"/>`
      : a.peinado === "moño" ? `<circle cx="50" cy="14" r="9" fill="${a.pelo}"/><path d="M26 44c0-18 10-26 24-26s24 8 24 26c-8-8-40-8-48 0z" fill="${a.pelo}"/>`
      : `<path d="M27 42c0-16 10-24 23-24s23 8 23 24c-6-6-40-6-46 0z" fill="${a.pelo}"/>`;
    return `<svg viewBox="0 0 100 100" class="avatar" role="img" aria-label="Ilustración de ejemplo"><circle cx="50" cy="50" r="50" fill="#16202d"/>
      <path d="M14 100c2-20 18-30 36-30s34 10 36 30z" fill="${a.ropa}"/>${a.peinado === "largo" ? hair : ""}
      <rect x="43" y="56" width="14" height="14" rx="4" fill="${a.piel}"/><circle cx="50" cy="44" r="21" fill="${a.piel}"/>${a.peinado !== "largo" ? hair : ""}
      <circle cx="42" cy="46" r="2.4" fill="#1d1d1d"/><circle cx="58" cy="46" r="2.4" fill="#1d1d1d"/><path d="M43 54q7 6 14 0" stroke="#7a3b2e" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
  }
  const casos = $("#casos");
  if (casos) casos.innerHTML = D.testimonios.map((t) => `<!-- PLACEHOLDER: testimonio de EJEMPLO inventado; reemplazar por uno real -->
    <figure class="card testimonio" data-placeholder="${t.placeholder}">${avatar(t.avatar)}
      <blockquote>“${esc(t.texto)}”</blockquote><figcaption><strong>${esc(t.nombre)}</strong> · ${esc(t.pais)} · Nivel ${esc(t.nivel)}</figcaption>
      <span class="ejemplo">Testimonio de ejemplo</span></figure>`).join("");

  // Globo: proyección ortográfica, puntos de tierra (contornos simplificados propios) + marcadores
  const cv = $("#globo");
  if (cv) {
    const LAND = [ // polígonos muy simplificados [lon,lat]
      [[-168,66],[-140,70],[-110,73],[-80,73],[-62,60],[-55,50],[-66,44],[-76,35],[-81,25],[-87,30],[-97,26],[-97,18],[-87,16],[-83,9],[-78,8],[-80,0],[-81,-6],[-71,-18],[-71,-30],[-74,-45],[-69,-55],[-65,-55],[-58,-38],[-48,-26],[-39,-14],[-35,-6],[-50,0],[-60,9],[-72,12],[-77,9],[-82,9],[-86,13],[-92,15],[-96,16],[-105,20],[-110,24],[-117,32],[-124,40],[-124,48],[-132,55],[-150,60],[-165,62]],
      [[-10,36],[-9,43],[-2,44],[-4,48],[2,51],[8,54],[10,58],[5,62],[15,69],[28,71],[40,67],[60,69],[80,73],[105,77],[140,72],[170,70],[180,66],[160,60],[142,52],[140,45],[130,42],[122,40],[121,31],[110,21],[106,10],[100,13],[98,8],[93,16],[90,22],[80,15],[77,8],[72,20],[67,25],[57,25],[50,30],[56,26],[59,22],[52,16],[43,12],[35,28],[32,31],[27,37],[22,40],[18,40],[12,44],[8,44],[3,43],[-1,37]],
      [[-17,21],[-16,12],[-8,4],[6,4],[9,-1],[13,-13],[12,-17],[18,-34],[26,-34],[33,-26],[40,-15],[40,-4],[51,11],[43,12],[33,31],[25,32],[10,37],[-6,36],[-10,30]],
      [[114,-22],[122,-18],[130,-12],[137,-12],[143,-11],[153,-25],[150,-37],[140,-38],[132,-32],[115,-34]],
      [[-45,60],[-20,70],[-20,80],[-60,82],[-70,77],[-55,68]], [[-5,50],[2,52],[-3,58],[-6,56]], [[130,31],[141,36],[142,44],[136,36]],
      [[95,6],[105,-6],[120,-9],[118,0],[110,2]], [[44,-13],[50,-15],[48,-25],[44,-23]]
    ];
    const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
    const pts = []; for (let lat = -58; lat <= 82; lat += 3) { const step = 3 / Math.max(Math.cos(lat * Math.PI / 180), 0.25);
      for (let lon = -180; lon < 180; lon += step) if (LAND.some((p) => inPoly(lon, lat, p))) pts.push([lon, lat]); }
    const ctx = cv.getContext("2d"), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => { const w = cv.clientWidth; cv.width = w * dpr; cv.height = w * dpr; };
    size(); addEventListener("resize", size);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rot = 75, tilt = -12;
    function proj(lon, lat) { const l = (lon + rot) * Math.PI / 180, p = lat * Math.PI / 180, t = tilt * Math.PI / 180;
      const x = Math.cos(p) * Math.sin(l), y0 = Math.sin(p), z0 = Math.cos(p) * Math.cos(l);
      const y = y0 * Math.cos(t) - z0 * Math.sin(t), z = y0 * Math.sin(t) + z0 * Math.cos(t); return [x, -y, z]; }
    function draw() {
      const W = cv.width, R = W * 0.46, c = W / 2; ctx.clearRect(0, 0, W, W);
      const g = ctx.createRadialGradient(c - R * .3, c - R * .3, R * .1, c, c, R); g.addColorStop(0, "rgba(58,160,255,.14)"); g.addColorStop(1, "rgba(58,160,255,.03)");
      ctx.beginPath(); ctx.arc(c, c, R, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = "rgba(58,160,255,.35)"; ctx.lineWidth = dpr; ctx.stroke();
      for (const [lon, lat] of pts) { const [x, y, z] = proj(lon, lat); if (z < 0) continue;
        ctx.fillStyle = `rgba(160,200,240,${0.25 + z * 0.55})`; ctx.fillRect(c + x * R - dpr, c + y * R - dpr, 2 * dpr, 2 * dpr); }
      ctx.font = `${11 * dpr}px Segoe UI, Arial`;
      for (const [n, lat, lon] of D.paises) { const [x, y, z] = proj(lon, lat); if (z < 0.05) continue; const X = c + x * R, Y = c + y * R;
        ctx.beginPath(); ctx.arc(X, Y, 4.5 * dpr, 0, 7); ctx.fillStyle = "#e4242b"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2 * dpr; ctx.stroke();
        ctx.fillStyle = `rgba(230,236,244,${Math.min(1, z * 1.6)})`; ctx.fillText(n, X + 7 * dpr, Y + 4 * dpr); }
    }
    const loop = () => { rot -= 0.12; draw(); requestAnimationFrame(loop); };
    if (reduce) draw(); else loop();
    const list = $("#paises"); if (list) list.textContent = D.paises.map((p) => p[0]).join(" · ");
  }
})();
