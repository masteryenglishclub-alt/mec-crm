/* MEC · Espacio para anuncios, impulsado por datos (js/anuncios-config.js). Sin dependencias. Seguro por defecto: solo pinta un anuncio activo y COMPLETO.
   Uso: <div data-ad-slot="portal-eventos"></div> y window.MEC_ADS.mount(raíz, { role }). También MEC_ADS.pick(sitio) para pruebas. */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const okLink = (u) => typeof u === "string" && /^(https:\/\/[^\s"'<>]+|#[a-z0-9_-]*|[a-z0-9_\-/]+\.html(\?[^\s"'<>]*)?(#[a-z0-9_-]*)?)$/i.test(u);
  const okImg = (u) => typeof u === "string" && /^(https:\/\/[^\s"'<>]+|img\/[a-z0-9_\-/.]+\.(svg|webp|png|jpe?g))$/i.test(u);
  /* Marcas de «dato pendiente» que NUNCA deben llegar a producción */
  const PLACEHOLDER = /\[(PENDIENTE|PROMOTOR|URL|RESPONSABLE|enlace)/i;
  const filled = (s) => typeof s === "string" && s.trim().length > 0;
  /** ¿Se puede mostrar este anuncio? (activo, en fechas, completo; con T&C, política y revisión legal si requireLegal) */
  function ready(a, placement, now) {
    if (!a || a.active !== true) return false;
    if (placement && !(a.placements || []).includes(placement)) return false;
    if (!filled(a.title) || !filled(a.text) || !okLink(a.link)) return false;
    if (a.image && !okImg(a.image)) return false;
    if (a.requireLegal !== false && (!okLink(a.legalUrl) || !okLink(a.policyUrl) || a.legalReviewed !== true)) return false;
    if (Object.keys(a).some((k) => typeof a[k] === "string" && PLACEHOLDER.test(a[k]))) return false;
    const t = now || Date.now();
    if (a.starts && t < Date.parse(a.starts)) return false;
    if (a.ends && t > Date.parse(a.ends)) return false;
    return true;
  }
  const isPreview = () => !!(window.MEC_CRM_CONFIG && window.MEC_CRM_CONFIG.PREVIEW === true); // solo la vista previa local activa la muestra
  function pick(placement, now) {
    const real = (window.MEC_ANUNCIOS || []).find((a) => ready(a, placement, now));
    if (real) return { ad: real, sample: false };
    if (isPreview() && window.MEC_ANUNCIOS_MUESTRA) return { ad: window.MEC_ANUNCIOS_MUESTRA, sample: true };
    return null;
  }
  function html(p, top) {
    const a = p.ad, ext = /^https:/.test(a.link);
    const mob = a.imageMobile && okImg(a.imageMobile) ? `<source media="(max-width:640px)" srcset="${esc(a.imageMobile)}">` : "";
    const img = a.image && okImg(a.image) ? `<picture>${mob}<img src="${esc(a.image)}" alt="${esc(a.imageAlt || "")}" loading="lazy" decoding="async"></picture>` : "";
    const legal = a.legalUrl && okLink(a.legalUrl) ? `<a href="${esc(a.legalUrl)}" target="_blank" rel="noopener">${esc(a.legalLabel || "Términos y condiciones")}</a>` : esc(a.legalLabel || "");
    return `<aside class="ad-card${img ? "" : " sin-img"}${a.wide ? " ad-ancha" : ""}${p.sample ? " ad-muestra" : ""}" aria-label="Anuncio${p.sample ? " de muestra" : ""}" data-ad-id="${esc(a.id)}">
      ${p.sample ? '<span class="ad-marca">Muestra · no publicar</span>' : ""}${img}
      <div><span class="ad-kicker">${esc(a.kicker || "Anuncio")}</span><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p>
      <a class="${top ? "btn sm" : "sp-btn oro btn"}" href="${esc(a.link)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(a.linkLabel || "Más información")}</a>
      <p class="ad-legal">Mastery English Club · ${legal}</p></div></aside>`;
  }
  function mount(root) {
    (root || document).querySelectorAll("[data-ad-slot]").forEach((el) => {
      const p = pick(el.dataset.adSlot), top = el.classList.contains("ad-top");
      if (!p) { el.hidden = true; el.innerHTML = ""; return; }
      el.hidden = false; el.innerHTML = html(p, top);
    });
  }
  window.MEC_ADS = { PLACEHOLDER, find: (id) => (window.MEC_ANUNCIOS || []).find((a) => a.id === id), ready, pick, mount, html };
  if (document.readyState !== "loading") mount(); else document.addEventListener("DOMContentLoaded", () => mount());
})();
