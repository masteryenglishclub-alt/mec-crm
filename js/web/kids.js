/* Material Kids público: lectura anónima (RLS: select para todos) desde Supabase REST + Storage público. */
(function () {
  const el = document.getElementById("kids-material"); if (!el) return;
  const cfg = window.MEC_CRM_CONFIG || {}, esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
})();
