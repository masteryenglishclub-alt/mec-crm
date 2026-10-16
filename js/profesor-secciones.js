/* MEC CRM – Render puro de las secciones v3 del perfil del teacher (testeable en Node). Sin datos inventados: solo pinta lo que recibe. */
(function (root) {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
  const COLORS = { A1: "#3F8F5A", A2: "#4FB3D9", B1: "#D4A017", B2: "#8E6BBF", C1: "#B8C2CC" };
  const card = (cls, title, body) => `<section class="sp-card pf3-card ${cls}"><h2>${title}</h2>${body}</section>`;
  const stars = (v) => { let s = ""; for (let i = 1; i <= 5; i++) { const f = Math.max(0, Math.min(1, v - i + 1)); s += `<span class="pf3-st" style="--f:${Math.round(f * 100)}%">★</span>`; } return `<span class="pf3-stars" aria-hidden="true">${s}</span>`; };
  const fecha = (d) => { try { return new Date(d).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }); } catch (e) { return ""; } };
  function reviews(list) {
    const r = (list || []).filter((x) => Number.isInteger(+x.rating) && +x.rating >= 1 && +x.rating <= 5);
    if (!r.length) return card("pf3-rev", "Valoraciones de estudiantes", '<p class="sp-pend pf3-empty">Aún no hay reseñas.</p>');
    const n = r.length, avg = r.reduce((a, x) => a + +x.rating, 0) / n, dist = [5, 4, 3, 2, 1].map((k) => [k, r.filter((x) => +x.rating === k).length]);
    const recent = r.filter((x) => x.comment && String(x.comment).trim()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 3);
    return card("pf3-rev", "Valoraciones de estudiantes", `<div class="pf3-rev-grid"><div class="pf3-avg"><strong>${avg.toFixed(1).replace(".", ",")}</strong>${stars(avg)}
      <span class="sr-only">Promedio ${avg.toFixed(1)} de 5</span><small>${n} ${n === 1 ? "reseña" : "reseñas"}</small></div>
      <ul class="pf3-dist" aria-label="Distribución de estrellas">${dist.map(([k, c]) => `<li><span>${k} ★</span><span class="pf3-bar"><i style="width:${Math.round((c / n) * 100)}%"></i></span><b>${c}</b></li>`).join("")}</ul></div>
      <h3>Comentarios recientes</h3>${recent.length ? `<ul class="pf3-com">${recent.map((x) => `<li><div class="pf3-com-h">${stars(+x.rating)}<span>${esc(x.author_name || "Estudiante")}</span><time>${esc(fecha(x.created_at))}</time></div><p>${esc(x.comment)}</p></li>`).join("")}</ul>` : '<p class="sp-pend">Aún no hay comentarios.</p>'}`);
  }
  function certs(list) {
    const c = list || [];
    if (!c.length) return card("pf3-cert", "Certificaciones y logros", '<p class="sp-pend pf3-empty">Aún no hay certificaciones registradas.</p>');
    return card("pf3-cert", "Certificaciones y logros", `<ul class="pf3-badges">${c.map((x) => `<li class="pf3-badge ${x.kind === "logro" ? "logro" : "cert"}"><span class="pf3-ico" aria-hidden="true">${x.kind === "logro" ? "✦" : "◆"}</span><span><strong>${esc(x.title)}</strong>${x.issuer || x.year ? `<small>${esc([x.issuer, x.year].filter(Boolean).join(" · "))}</small>` : ""}</span></li>`).join("")}</ul>`);
  }
  /* Reseñas = internas: solo admin o el propio teacher. Decisión por rol (no CSS). */
  const canSeeReviews = (me, tid) => !!me && (me.role === "admin" || (me.role === "teacher" && me.id === tid));
  function sections(me, tid, data) { const d = data || {}, staff = canSeeReviews(me, tid);
    return `<div class="pf3${staff ? "" : " pf3-pub"}">${staff ? reviews(d.reviews) : ""}${certs(d.certs)}${levels(d.levels, staff ? null : "Aún no hay datos de niveles para mostrar.")}</div>`; }
  function levels(counts, emptyMsg) {
    const m = {}; (Array.isArray(counts) ? counts : []).forEach((x) => { if (LEVELS.includes(x.level)) m[x.level] = (m[x.level] || 0) + (+x.count || 0); });
    const tot = LEVELS.reduce((a, l) => a + (m[l] || 0), 0);
    if (!tot) return card("pf3-lvl", "Estudiantes por nivel", `<p class="sp-pend pf3-empty">${esc(emptyMsg || "Aún no hay estudiantes activos para mostrar.")}</p>`);
    const max = Math.max(...LEVELS.map((l) => m[l] || 0)), H = 150;
    const bars = LEVELS.map((l, i) => { const v = m[l] || 0, h = Math.round((v / max) * H), x = 30 + i * 70;
      return `<g><rect x="${x}" y="${20 + H - h}" width="44" height="${h}" rx="4" fill="${COLORS[l]}"/><text x="${x + 22}" y="${14 + H - h}" class="v">${v}</text><text x="${x + 22}" y="${H + 40}" class="l">${l}</text></g>`; }).join("");
    return card("pf3-lvl", "Estudiantes por nivel", `<svg class="pf3-chart" viewBox="0 0 390 200" role="img" aria-label="Estudiantes por nivel: ${LEVELS.map((l) => `${l} ${m[l] || 0}`).join(", ")}">
      <line x1="20" x2="380" y1="${20 + H}" y2="${20 + H}" stroke="#8a6a30"/>${bars}</svg><p class="sp-small">${tot} ${tot === 1 ? "estudiante" : "estudiantes"} en total.</p>`);
  }

  /* ===== Sobre mí: bio + gustos y hobbies + temas de interés (lo ven estudiantes y admin; lo edita solo el propio teacher) ===== */
  const LIM = { bio: 1500, item: 80, items: 10 };
  const GUSTOS = [["hobbies", "Hobbies favoritos"], ["favorite_foods", "Comida favorita"], ["favorite_countries", "Países favoritos"], ["favorite_books", "Libros favoritos"], ["favorite_movies", "Películas favoritas"]];
  const TEMAS = ["Negocios", "Marketing", "Bolsa de valores", "Geografía", "Literatura", "Anime", "Ciencias y tecnología"];
  const clean = (v, max) => String(v == null ? "" : v).normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "").replace(/<[^>]*>/g, "").trim().slice(0, max);
  const items = (v) => { const raw = Array.isArray(v) ? v : String(v == null ? "" : v).split(/\n|,/); const out = [];
    raw.forEach((x) => { const c = clean(x, LIM.item).replace(/\s+/g, " "); if (c && !out.some((o) => o.toLowerCase() === c.toLowerCase())) out.push(c); }); return out.slice(0, LIM.items); };
  /* Normaliza lo que escribe el teacher. Devuelve { data, warnings }; nunca deja HTML ni caracteres de control. */
  function normalizePersonal(inp, prevTopics) { const i = inp || {}, warnings = [];
    const rawBio = String(i.bio == null ? "" : i.bio); const bio = clean(rawBio.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n"), LIM.bio);
    if (rawBio.trim().length > LIM.bio) warnings.push(`La bio se recortó a ${LIM.bio} caracteres.`);
    const data = { bio: bio || null };
    GUSTOS.forEach(([k, label]) => { const all = Array.isArray(i[k]) ? i[k] : String(i[k] == null ? "" : i[k]).split(/\n|,/).filter((x) => x.trim()); data[k] = items(i[k]);
      if (all.length > LIM.items) warnings.push(`${label}: máximo ${LIM.items} elementos.`); });
    const legacy = (prevTopics || []).filter((t) => !TEMAS.includes(t));  // temas antiguos de texto libre se conservan
    data.topics = TEMAS.filter((t) => (i.topics || []).includes(t)).concat(legacy);
    return { data, warnings };
  }
  function personal(t) { const x = t || {};
    const gustos = GUSTOS.map(([k, label]) => [label, items(x[k])]).filter(([, v]) => v.length);
    const temas = items(x.topics);
    const parts = [];
    if (x.bio && String(x.bio).trim()) parts.push(`<div class="pf4-blk"><h3>Bio</h3><p class="pf4-bio">${esc(String(x.bio).trim())}</p></div>`);
    if (gustos.length) parts.push(`<div class="pf4-blk"><h3>Gustos y hobbies</h3><dl class="pf4-gustos">${gustos.map(([l, v]) => `<div><dt>${l}</dt><dd>${v.map(esc).join(" · ")}</dd></div>`).join("")}</dl></div>`);
    if (temas.length) parts.push(`<div class="pf4-blk"><h3>Temas de interés</h3><ul class="pf4-tags">${temas.map((v) => `<li>${esc(v)}</li>`).join("")}</ul></div>`);
    return parts.length ? `<section class="sp-card pf3-card pf4-about"><h2>Sobre mí</h2>${parts.join("")}</section>` : "";
  }
  function editor(t) { const x = t || {}, val = (k) => esc(items(x[k]).join("\n"));
    return `<section class="sp-card pf3-card pf4-edit"><h2>Editar mi perfil</h2><form id="pf4-f" novalidate>
      <label for="pf4-bio">Bio <small>(máx. ${LIM.bio} caracteres)</small></label>
      <textarea id="pf4-bio" name="bio" rows="6" maxlength="${LIM.bio}" placeholder="Cuéntales a tus estudiantes quién eres…">${esc(x.bio || "")}</textarea>
      <p class="sp-small" id="pf4-cnt" aria-live="polite">${String(x.bio || "").length} / ${LIM.bio}</p>
      <h3>Gustos y hobbies <small>(uno por línea · máx. ${LIM.items} · ${LIM.item} caracteres cada uno)</small></h3>
      <div class="pf4-grid">${GUSTOS.map(([k, l]) => `<div><label for="pf4-${k}">${l}</label><textarea id="pf4-${k}" name="${k}" rows="3">${val(k)}</textarea></div>`).join("")}</div>
      <fieldset class="pf4-temas"><legend>Temas de interés</legend>${TEMAS.map((v, n) => `<label class="pf4-chk"><input type="checkbox" name="topics" value="${esc(v)}" ${(x.topics || []).includes(v) ? "checked" : ""}> <span>${esc(v)}</span></label>`).join("")}</fieldset>
      <p class="pf4-acc"><button class="sp-btn" type="submit">Guardar cambios</button> <a class="sp-btn ghost" href="?id=${encodeURIComponent(x.teacher_id || "")}">Ver mi perfil</a></p>
      <div id="pf4-msg" role="status" aria-live="polite"></div></form></section>`;
  }
  const canEditPersonal = (me, tid) => !!me && me.role === "teacher" && me.id === tid;
  const api = { personal, editor, normalizePersonal, canEditPersonal, LIM, GUSTOS, TEMAS, reviews, certs, levels, sections, canSeeReviews, COLORS, LEVELS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root.MEC) root.MEC.prof3 = api;
})(typeof window !== "undefined" ? window : globalThis);
