/* MEC · Términos y condiciones del evento de referidos (Plan de referidos / Evento de expansión: Plan de referidos) en Eventos + formulario público de la persona referida. Sin dependencias.
   Texto legal: js/promo-legal.js (generado, sin ediciones). Promotor y responsable: siempre «Mastery English Club» (decisión del dueño). La URL de la política sale de js/anuncios-config.js.
   Seguro por defecto: en producción solo se pinta si el anuncio está activo, completo y revisado, y si el texto ya no tiene ningún dato pendiente.
   En la vista previa (MEC_CRM_CONFIG.PREVIEW) se pinta con marcas visibles de pendiente (js/promo-preview.js).
   Dos modos: «web» (eventos.html: términos + FORMULARIO PÚBLICO del referido, js/promo-publico.js) y «portal» (pestaña Eventos del portal: el referidor o acudiente con cuenta). */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ID = "plan-de-referidos", ANCHOR = "terminos-plan-de-referidos", T = "terminos_y_condiciones_referidos.md", A = "texto_aceptacion_y_avisos.md";
  const isPreview = () => !!(window.MEC_CRM_CONFIG && window.MEC_CRM_CONFIG.PREVIEW === true);
  const LEFT = /\[(PENDIENTE|PROMOTOR|URL|RESPONSABLE|enlace)[^\]]*\]/gi;
  const okHref = (u) => typeof u === "string" && /^(https:\/\/[^\s"'<>]+|[a-z0-9_\-/]+\.html(#[a-z0-9_-]*)?)$/i.test(u);
  function state(now) {
    const ad = window.MEC_ADS && window.MEC_ADS.find(ID), L = window.MEC_PROMO_LEGAL;
    if (!L || !ad) return null;
    if (window.MEC_ADS.ready(ad, null, now) && okHref(ad.link)) {
      const vals = { url_tyc: ad.legalUrlPublic || ad.legalUrl, url_pol: ad.policyUrl };
      if (!leftovers(L, vals, ad).length && Array.isArray(L.pendientes) && !L.pendientes.length) return { mode: "live", ad, vals };
    }
    if (isPreview() && window.MEC_PROMO_PREVIEW) return { mode: "preview", ad, vals: { url_tyc: ad.legalUrlPublic || ad.legalUrl, url_pol: window.MEC_PROMO_PREVIEW.url_pol } };
    return null;
  }
  const fill = (html, v, preview) => String(html || "").replace(/<span class="pt-ph" data-ph="(\w+)">[^<]*<\/span>/g, (m, k) => {
    if (k === "url_tyc") return `<a href="${esc(v.url_tyc.replace(/^https:\/\/[^/]+\/mec-crm\//, ""))}">${esc(v.url_tyc)}</a>`;
    if (k === "url_pol") return preview ? `<mark class="pt-prev">${esc(v.url_pol)}</mark>` : `<a href="${esc(v.url_pol)}" target="_blank" rel="noopener">${esc(v.url_pol)}</a>`;
    return m;
  });
  /** Todo el texto legal visible al público (incluye el formulario) */
  const publicTexts = (L) => { const f = L.form || {}; return [L.meta, L.summary.html, L.sections.map((s) => s.html).join(""), L.accept.html, Object.keys(L.notices).map((k) => L.notices[k]).join(""), L.share.html, L.long.html,
    f.aviso, f.campos, f.despues, f.despues_texto, f.revocar, f.quien, f.derechos_txt, (f.casillas || []).map((c) => c.html).join(""), f.acudiente && f.acudiente.html, f.nota_opcionales].join(" "); };
  /** Marcas de pendiente que quedan en TODO el texto una vez puestos los datos (vacío = se puede publicar) */
  function leftovers(L, vals, ad) {
    const txt = fill(publicTexts(L), { url_tyc: "https://x/mec-crm/x.html", url_pol: "https://x" }, false).replace(/<[^>]+>/g, " ");
    return txt.match(LEFT) || [];
  }
  const chips = [["referidor", "Soy referidor (estudiante adulto)"], ["acudiente_referidor", "Soy acudiente: el estudiante es menor"]];
  const PARENT = [["padre", "Padre"], ["madre", "Madre"], ["representante_legal", "Representante legal"]];
  const FIELDS = { referidor: [], acudiente_referidor: [["acudiente_nombre", "Tu nombre completo (acudiente)", "text"], ["parentesco", "Tu parentesco con el estudiante menor", "parentesco"], ["for_student", "Estudiante menor", "menor"]] };
  const ROL = { referidor: "referidor", acudiente_referidor: "acudiente" };
  const fieldHtml = (k) => (FIELDS[k] || []).map(([n, lab, t]) => `<label class="pt-fld">${esc(lab)}${t === "parentesco" ? `<select data-pt-f="${n}" data-pt-req="1"><option value="">Elige…</option>${PARENT.map(([v, x]) => `<option value="${v}">${x}</option>`).join("")}</select>` :
    t === "menor" ? `<select data-pt-f="${n}" data-pt-req="1"><option value="">Cargando…</option></select>` : `<input type="text" maxlength="120" autocomplete="off" data-pt-f="${n}" data-pt-req="1">`}</label>`).join("");
  const fecha = (iso) => { try { return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }); } catch (e) { return iso; } };
  const ROLTXT = { referidor: "Referidor", acudiente: "Acudiente" };
  /** casilla (c) de transmisión a Zoho del aviso del referidor (§2); el acudiente (§4.2) no trae una propia, usa la misma */
  const transfLabel = (L) => { const m = /<label class="pt-chk"[^>]*data-block="transferencia"[\s\S]*?<\/label>/.exec(L.notices.referidor); return m ? m[0] : ""; };
  function build(st, pre) {
    const L = window.MEC_PROMO_LEGAL, v = st.vals, pv = st.mode === "preview", F = (h) => fill(h, v, pv), p = pre || "", portal = p === "p-";
    const toc = L.sections.map((s) => `<li><a href="#${ANCHOR}-s${s.id}" data-pt-go="${ANCHOR}-s${s.id}">${esc(s.title.replace(/^\d+\.\s*/, ""))}</a></li>`).join("");
    const accept = F(L.accept.html);
    const tabs = chips.map(([k, t], i) => `<button type="button" role="tab" class="pt-tab" id="${p}pt-tab-${k}" aria-selected="${i === 0}" aria-controls="${p}pt-pan-${k}" data-pt-tab="${k}">${t}</button>`).join("");
    const panHtml = (k) => { let h = F(L.notices[k]); if (k === "acudiente_referidor" && !/data-key="transferencia"/.test(h)) h += F(transfLabel(L)); return h; };
    const pans = chips.map(([k], i) => `<div role="tabpanel" class="pt-pan" id="${p}pt-pan-${k}" aria-labelledby="${p}pt-tab-${k}" ${i ? "hidden" : ""}>${panHtml(k)}<div class="pt-datos">${fieldHtml(k)}</div></div>`).join("");
    const participa = portal ? `<div class="pt-card pt-participa" id="${p}participar-plan-de-referidos"><h3>Antes de participar (estudiantes y acudientes con cuenta)</h3>
        <div class="pt-aceptar-t">${F(L.notices.terminos)}</div>
        <div class="pt-tabs" role="tablist" aria-label="Tipo de participante">${tabs}</div>${pans}
        <p class="pt-accion"><button type="button" class="pt-btn off" data-pt-submit aria-disabled="true">Quiero participar</button> <span class="pt-hint" data-pt-hint>Marca las casillas obligatorias para continuar.</span></p>
        <p class="pt-msg" data-pt-msg role="status" aria-live="polite" hidden></p><div class="pt-mias" data-pt-mias hidden></div>
        <details class="pt-share"><summary>Mensaje para compartir con quien quieras (lo envías tú; MEC no recibe ese contacto)</summary><blockquote class="pt-q" data-pt-share>${F(L.share.html)}</blockquote><button type="button" class="pt-btn sm" data-pt-copy>Copiar mensaje</button></details></div>` :
      `<div class="pt-card pt-participa" id="participar-plan-de-referidos"><h3>Quiero participar: formulario para la persona referida</h3>
        <p class="pt-sub">Llénalo <strong>tú mismo</strong>: nadie puede llenarlo por ti. Si te recomendó alguien, esa persona solo te comparte el enlace o su código. Si ya eres estudiante, entra a tu portal.</p>
        ${window.MEC_PROMO_PUB ? window.MEC_PROMO_PUB.formHtml(F, st.ad) : '<p class="pt-msg bad">El formulario no está disponible.</p>'}
        <details class="pt-share"><summary>Mensaje para compartir con quien quieras (lo envías tú; MEC no recibe ese contacto)</summary><blockquote class="pt-q" data-pt-share>${F(L.share.html)}</blockquote><button type="button" class="pt-btn sm" data-pt-copy>Copiar mensaje</button></details></div>`;
    return `<section class="pt" id="${p ? p + ANCHOR : ANCHOR}" data-pt-mode="${st.mode}" aria-labelledby="${p}pt-h">
      ${pv ? '<p class="pt-sello">Vista previa · hay datos pendientes (URL de la política y datos del texto legal) · no publicar</p>' : ""}
      <header class="pt-head"><span class="pt-kicker">Términos y condiciones</span><h2 id="${p}pt-h">${esc(st.ad.title || "Evento de expansión: Plan de referidos")}</h2><p class="pt-meta">${F(L.meta)}</p></header>
      <div class="pt-card pt-resumen"><h3>Resumen del evento</h3>${F(L.long.html)}</div>
      <div class="pt-card pt-summary"><h3>${esc(L.summary.title)}</h3>${F(L.summary.html)}</div>
      ${participa}
      <details class="pt-full" id="${p}${ANCHOR}-texto"><summary>Leer los términos y condiciones completos (${L.sections.length} secciones)</summary>
        <nav class="pt-toc" aria-label="Contenido de los términos"><ol>${toc}</ol></nav>
        ${L.sections.map((s) => `<section class="pt-sec" id="${p}${ANCHOR}-s${s.id}"><h3>${esc(s.title)}</h3>${F(s.html)}</section>`).join("")}
        <section class="pt-sec" id="${p}${ANCHOR}-aceptacion"><h3>${esc(L.accept.title)}</h3>${accept}</section>
        <p class="pt-ver">Términos versión ${esc(L.version)} · aviso versión ${esc(L.avisos_version)}${portal ? "" : ` · <a href="derechos.html" data-pt-derechos>Revocar, darme de baja o ejercer mis derechos</a>`}</p></details></section>`;
  }
  function wire(root, st) {
    const sec = root.querySelector(".pt"); if (!sec) return;
    const full = sec.querySelector(".pt-full"), openFor = () => { if (location.hash.indexOf("#" + ANCHOR) === 0 && full) { full.open = true; const t = document.getElementById(location.hash.slice(1)); if (t && t.scrollIntoView) t.scrollIntoView(); } };
    sec.querySelectorAll("[data-pt-go]").forEach((a) => (a.onclick = () => { full.open = true; }));
    const portal = sec.id.indexOf("p-") === 0, btn = sec.querySelector("[data-pt-submit]"), hint = sec.querySelector("[data-pt-hint]"), msg = sec.querySelector("[data-pt-msg]"), mias = sec.querySelector("[data-pt-mias]");
    const L = window.MEC_PROMO_LEGAL; let estado = null, busy = false;
    const tab = () => (sec.querySelector("[data-pt-tab][aria-selected=true]") || {}).dataset.ptTab, pan = () => sec.querySelector(".pt-pan:not([hidden])");
    sec.querySelectorAll("[data-pt-tab]").forEach((b) => (b.onclick = () => { sec.querySelectorAll("[data-pt-tab]").forEach((x) => x.setAttribute("aria-selected", x === b)); sec.querySelectorAll(".pt-pan").forEach((pn) => (pn.hidden = pn.id.slice(-b.dataset.ptTab.length) !== b.dataset.ptTab)); upd(); }));
    const say = (t, bad) => { if (!msg) return; msg.hidden = !t; msg.textContent = t || ""; msg.className = "pt-msg" + (bad ? " bad" : " good"); };
    const chk = (pn, key) => pn && pn.querySelector(`input[type=checkbox][data-key="${key}"]`);
    function upd() { if (!btn) return; const pn = pan(), req = [sec.querySelector(".pt-aceptar-t input"), chk(pn, "datos"), chk(pn, "transferencia")], fl = [...(pn ? pn.querySelectorAll("[data-pt-req]") : [])];
      const ok = req.every((c) => c && c.checked) && fl.every((x) => String(x.value || "").trim()) && estado && estado.active && !busy;
      btn.setAttribute("aria-disabled", ok ? "false" : "true"); btn.classList.toggle("off", !ok);
      hint.textContent = !estado ? "Comprobando…" : !estado.available ? "Todavía no está habilitado el registro de aceptación." : !estado.active ? "El registro de participación se abrirá cuando el evento esté activo." : ok ? "Listo: puedes registrar tu participación." : "Marca las casillas obligatorias (términos, datos y servidores en Estados Unidos) y completa tus datos. Ninguna casilla viene marcada de antemano."; }
    if (portal) { sec.addEventListener("input", upd); sec.addEventListener("change", upd); }
    const api = () => window.MEC && window.MEC.api;
    async function mostrarMias() { if (!mias || !api() || !api().promoMias) return; const rows = await api().promoMias().catch(() => []); mias.hidden = !rows.length;
      mias.innerHTML = rows.length ? `<h4>Tus aceptaciones registradas</h4><ul>${rows.map((r) => `<li>${esc(fecha(r.accepted_at))} · ${esc(ROLTXT[r.rol] || r.rol)} · términos ${esc(r.version)} · aviso ${esc(r.avisos_version)} · servidores en EE. UU.: ${r.acepta_transferencia ? "sí" : "no"} · promociones: ${r.acepta_promociones ? "sí" : "no"}</li>`).join("")}</ul>` : ""; }
    async function init() { if (!portal) return;
      if (!api() || !api().promoEstado) { estado = { available: false, active: false }; upd(); return; }
      const u = api().currentUser ? await api().currentUser().catch(() => null) : null;
      if (u && u.role !== "student") { const card = sec.querySelector(".pt-participa"); [...card.children].forEach((x) => { if (x.tagName !== "H3" && !x.classList.contains("pt-share")) x.hidden = true; });
        const n = document.createElement("p"); n.className = "pt-sub"; n.textContent = "El registro de participación lo hacen los estudiantes y acudientes desde su portal. Aquí puedes revisar los textos que ellos ven."; card.insertBefore(n, card.children[1] || null); return; }
      estado = await api().promoEstado().catch(() => ({ available: false, active: false }));
      const sel = sec.querySelector('select[data-pt-f="for_student"]');
      if (sel && api().promoMisMenores) { const ms = await api().promoMisMenores().catch(() => []); sel.innerHTML = `<option value="">${ms.length ? "Elige…" : "No tienes menores a tu cargo registrados"}</option>` + ms.map((m) => `<option value="${esc(m.id)}">${esc(m.full_name)}</option>`).join(""); }
      upd(); mostrarMias(); }
    if (btn) btn.addEventListener("click", async () => { if (btn.getAttribute("aria-disabled") === "true") return; busy = true; upd(); say("");
      const pn = pan(), k = tab(), pay = { rol: ROL[k], version: L.version, avisos_version: L.avisos_version, legal_sha256: L.sources[T], avisos_sha256: L.sources[A],
        terminos: !!sec.querySelector(".pt-aceptar-t input").checked, datos: !!(chk(pn, "datos") || {}).checked, transferencia: !!(chk(pn, "transferencia") || {}).checked, promociones: !!(chk(pn, "promociones") || {}).checked };
      pn.querySelectorAll("[data-pt-f]").forEach((x) => { pay[x.dataset.ptF] = String(x.value || "").trim(); });
      try { await api().promoAceptar(pay); say("Listo: registramos tu aceptación (fecha, hora, versión " + L.version + " de los términos y " + L.avisos_version + " del aviso). Gracias por participar.", false); mostrarMias(); }
      catch (e) { say(String((e && e.message) || e).replace(/^[a-z_]+:\s*/, "") || "No se pudo registrar.", true); }
      busy = false; upd(); });
    const cp = sec.querySelector("[data-pt-copy]"); if (cp) cp.onclick = () => { const t = sec.querySelector("[data-pt-share]").innerText; if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => (cp.textContent = "Copiado")); };
    if (!portal && window.MEC_PROMO_PUB) window.MEC_PROMO_PUB.wireForm(sec, st.ad);
    init(); openFor(); window.addEventListener("hashchange", openFor);
    if (location.hash === "#participar-plan-de-referidos" || (!portal && /[?&]v=/.test(location.search || ""))) { const t = document.getElementById("participar-plan-de-referidos"); if (t && t.scrollIntoView) t.scrollIntoView(); }
  }
  function mount(root) {
    (root || document).querySelectorAll("[data-promo-terminos]").forEach((el) => {
      const st = state(); if (!st) { el.hidden = true; el.innerHTML = ""; return; }
      el.hidden = false; el.innerHTML = build(st, el.dataset.promoTerminos === "portal" ? "p-" : ""); wire(el, st);
    });
    (root || document).querySelectorAll("[data-promo-derechos]").forEach((a) => { a.hidden = !state(); });
  }
  window.MEC_PROMO = { state, leftovers, mount, build, fill };
  if (document.readyState !== "loading") mount(); else document.addEventListener("DOMContentLoaded", () => mount());
})();
