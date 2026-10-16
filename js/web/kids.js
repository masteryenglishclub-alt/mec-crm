/* Kids: placeholder "Ver video" (aún no hay video) y sección de material solo para admin/profesores. */
(function () {
  const v = document.getElementById("ver-video"), n = document.getElementById("video-pronto");
  if (v && n) v.addEventListener("click", (e) => { e.preventDefault(); n.hidden = false; });
})();
/* Material Kids público: lectura anónima (RLS: select para todos) desde Supabase REST + Storage público. */
(function () {
  const el = document.getElementById("kids-material"), sec = document.getElementById("material"); if (!el || !sec) return;
  const cfg0 = window.MEC_CRM_CONFIG || {};
  // Rol del usuario con sesión de Supabase (localStorage sb-*-auth-token); solo admin/teacher ven la sección.
  let tok = null; try { for (const k of Object.keys(localStorage)) if (/^sb-.*-auth-token$/.test(k)) { const j = JSON.parse(localStorage.getItem(k)); tok = j && (j.access_token || (j.currentSession || {}).access_token); } } catch (e) {}
  if (!tok || !cfg0.SUPABASE_URL) return;
  let uid = null; try { uid = JSON.parse(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub; } catch (e) { return; }
  fetch(cfg0.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/profiles?select=role&id=eq." + encodeURIComponent(uid), { headers: { apikey: cfg0.SUPABASE_ANON_KEY, Authorization: "Bearer " + tok } })
    .then((r) => (r.ok ? r.json() : [])).then((r) => { if (r[0] && ["admin", "teacher"].includes(r[0].role)) { sec.hidden = false; cargar(); } }).catch(() => {});
  function cargar() {
  const cfg = cfg0, esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const empty = () => (el.innerHTML = '<div class="card vacio" style="grid-column:1/-1"><span class="medallon" aria-hidden="true"></span><p class="big">Pronto</p><p class="muted">Muy pronto publicaremos material para practicar en casa.</p></div>');
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return empty();
  const base = cfg.SUPABASE_URL.replace(/\/$/, "");
  fetch(base + "/rest/v1/kids_materials?select=id,title,description,file_path,mime_type,size_bytes,created_at&order=created_at.desc",
    { headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY } })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((rows) => {
      if (!rows.length) return empty();
      el.innerHTML = rows.map((m) => { const url = base + "/storage/v1/object/public/kids-material/" + m.file_path.split("/").map(encodeURIComponent).join("/");
        return `<article class="card mat-item"><h3 style="font-family:var(--display);margin:0">${esc(m.title)}</h3>
          ${m.description ? `<p class="muted small" style="margin:0">${esc(m.description)}</p>` : ""}
          <p class="small muted" style="margin:0">${esc(m.file_path.split(".").pop().toUpperCase())} · ${(m.size_bytes / 1048576).toFixed(1)} MB</p>
          <div class="acciones"><a class="btn sm" href="${url}" target="_blank" rel="noopener">Ver</a><a class="btn ghost sm" href="${url}?download=" download>Descargar</a></div></article>`; }).join("");
    })
    .catch(empty);
}
})();
