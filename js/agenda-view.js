/* Agenda semanal compartida (admin y estudiante): mismo fondo, marcos de hilo dorado, panel "Nuestros teachers" y filtro por teacher.
   El llamador decide qué bloques se muestran (el estudiante solo recibe "Ocupado" sin identidad de otros estudiantes). */
(() => {
  const M = window.MEC;
  const IC = { one: '<path d="M12 7a2.3 2.3 0 1 1 0 4.6A2.3 2.3 0 0 1 12 7zM7.5 17c.6-2.3 2.4-3.6 4.5-3.6s3.9 1.3 4.5 3.6" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    grp: '<path d="M9 8.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM15 8.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM5.5 16.5c.5-1.8 1.8-2.8 3.5-2.8s3 1 3.5 2.8M11.5 16.5c.5-1.8 1.8-2.8 3.5-2.8s3 1 3.5 2.8" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    conv: '<path d="M6 7h12v7h-7l-3.5 3v-3H6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    star: '<path d="M12 6.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    clock: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v4.3l3 1.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    cal: '<rect x="4.5" y="6" width="15" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.5 10h15M8.5 4v4M15.5 4v4M8 13h2M11 13h2M14 13h2M8 16h2M11 16h2" stroke="currentColor" stroke-width="1.5"/>',
    shield: '<path d="M12 4l6.5 2.5v5c0 4-2.8 6.8-6.5 8.5-3.7-1.7-6.5-4.5-6.5-8.5v-5z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    compass: '<g fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="6.2"/><circle cx="12" cy="12" r="8.6" stroke-dasharray="1 1.2"/></g><path d="M12 1.5l1.6 8.9L12 12l-1.6-1.6zM12 22.5l-1.6-8.9L12 12l1.6 1.6zM1.5 12l8.9-1.6L12 12l-1.6 1.6zM22.5 12l-8.9 1.6L12 12l1.6-1.6z" fill="currentColor"/><path d="M5 5l5.6 5.6M19 19l-5.6-5.6M19 5l-5.6 5.6M5 19l5.6-5.6" stroke="currentColor" stroke-width=".9"/>',
    mount: '<path d="M3 19l6-9 3.5 5 2.5-3.5L21 19z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    lock: '<rect x="6.5" y="11" width="11" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 11V8.5a3 3 0 0 1 6 0V11" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    hour: '<path d="M8 4.5h8M8 19.5h8M9 4.5c0 4 6 4.5 6 7.5s-6 3.5-6 7.5M15 4.5c0 4-6 4.5-6 7.5s6 3.5 6 7.5" fill="none" stroke="currentColor" stroke-width="1.4"/>' };
  const svg = (k, cl = "") => `<svg viewBox="0 0 24 24" class="${cl}" aria-hidden="true">${IC[k]}</svg>`;
  const ini = (n) => String(n || "?").replace(/^Teacher\s+/i, "").split(/\s+/).filter(Boolean).slice(-2).map((x) => x[0]).join("").toUpperCase();
  const hh = (h) => String(h).padStart(2, "0") + ":00";
  /* o = { week, teachers:[{id,full_name}], colors, filter, blocks:[{id, starts_at, kind, icon, title, sub, teacher_id, tip, status, extra}],
           cell(slot, valid) -> {cls, attrs}, pergamino, help, hint, cta, ariaMain } */
  function render(o) {
    const esc = M.esc, days = [1, 2, 3, 4, 5, 6].map((i) => new Date(o.week.getTime() + (i - 1) * 864e5)), H0 = 6, H1 = 17;
    const today = M.bog(new Date());
    let g = `<div class="agv-hd agv-hcol">${svg("clock")}<span>Hora</span></div>` + days.map((d) => { const p = M.bog(d), now = p.y === today.y && p.m === today.m && p.d === today.d;
      return `<div class="agv-hd${now ? " hoy" : ""}">${M.DOW[p.dow]} ${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}</div>`; }).join("");
    for (let h = H0; h <= H1; h++) {
      g += `<div class="agv-hora" style="grid-row:${h - H0 + 2}">${hh(h)}</div>`;
      days.forEach((d, i) => { const p = M.bog(d), slot = M.bogDate(p.y, p.m, p.d, h), valid = M.isValidSlot(slot);
        const c = o.cell ? o.cell(slot, valid, p, h) : { cls: valid ? "free" : "off", attrs: valid ? `data-slot="${slot.toISOString()}" title="Agendar ${M.DOW[p.dow]} ${hh(h)}"` : "" };
        g += `<div class="agv-celda ${c.cls}" style="grid-row:${h - H0 + 2};grid-column:${i + 2}" ${c.attrs || ""}></div>`; });
    }
    (o.blocks || []).forEach((b) => { const p = M.bog(b.starts_at), di = days.findIndex((d) => { const q = M.bog(d); return q.y === p.y && q.m === p.m && q.d === p.d; });
      if (di < 0 || p.h < H0 || p.h > H1) return;
      g += `<button type="button" class="agv-b t-${b.kind} st-${b.status || "scheduled"}" data-id="${esc(b.id)}" style="grid-row:${p.h - H0 + 2};grid-column:${di + 2};--tc:${(b.teacher_id && o.colors[b.teacher_id]) || "#5d6b80"}" title="${esc(b.tip || "")}">
          ${svg(b.icon)}<span class="agv-b-t">${b.title}</span>${b.sub ? `<span class="agv-b-s">${b.sub}</span>` : ""}<span class="agv-b-h">${hh(p.h)} – ${hh(p.h + 1)}</span>${b.teacher_id ? `<i class="agv-dot" title="${esc(b.teacher_name || "")}"></i>` : ""}</button>`; });
    const wEnd = new Date(o.week.getTime() + 5 * 864e5);
    return `<div class="agv${o.cls ? " " + o.cls : ""}">
        <div class="agv-bg" aria-hidden="true"><img src="img/web/hero-agenda-1280.jpg" alt="" width="1536" height="911" decoding="async"></div>
        <div class="agv-top"><header class="agv-hero">${svg("compass", "agv-rosa")}<div><span class="agv-tag">${o.tag || "Tu camino en inglés"}</span><h1>${o.title || "Agenda semanal"}</h1><p>Cada clase te acerca a tus metas. Organiza tu tiempo, vive el proceso y construye tu futuro.</p></div></header>
        <aside class="agv-pergamino">${svg("compass")}<div><strong>Tu esfuerzo hoy, es tu libertad mañana</strong><small>${o.pergamino}</small></div><span aria-hidden="true">→</span></aside></div>
        ${o.above || ""}<div class="agv-wrap"><section class="agv-main" aria-label="Calendario semanal">
          <div class="agv-tool"><div class="agv-nav"><button type="button" class="agv-btn" id="prev"><b>‹</b> Semana anterior</button><button type="button" class="agv-btn oro" id="today">Hoy</button><button type="button" class="agv-btn" id="next">Semana siguiente <b>›</b></button></div>
            <div class="agv-rango">${svg("cal", "agv-ic")}<div><strong>${M.fmtDate(o.week)} – ${M.fmtDate(wEnd)}</strong><small>Hora: Bogotá (UTC-5) · Bloques de 60 min (55 + 5)</small></div></div>
            <label class="agv-sel">${svg("one", "agv-ic")}<span class="sr-only">Filtrar por teacher</span><select id="tf"><option value="">Todos los teachers</option>${o.teachers.map((t) => `<option value="${t.id}" ${t.id === o.filter ? "selected" : ""}>${esc(t.full_name)}</option>`).join("")}</select></label></div>
          ${o.legend || ""}<div class="agv-scroll"><div class="agv-grid" style="grid-template-rows:42px repeat(${H1 - H0 + 1},92px)">${g}</div></div>
          <p class="agv-ayuda">${o.help}</p></section>
        <aside class="agv-side" aria-labelledby="agv-t-h"><div class="agv-marco"><h2 id="agv-t-h">Nuestros teachers</h2>
          <ul class="agv-teachers">${o.teachers.map((t) => `<li><a href="profesor.html?id=${encodeURIComponent(t.id)}" target="_blank" rel="noopener" style="--tc:${o.colors[t.id]}" title="Ver perfil de ${esc(t.full_name)} (pestaña nueva)"><span class="agv-av">${esc(ini(t.full_name))}</span><span class="agv-tn">${esc(t.full_name)}</span></a></li>`).join("") || '<li class="muted">Sin teachers</li>'}</ul>
          <p class="agv-hint">Clic en un teacher para ver su perfil</p></div>
          <blockquote class="agv-quote"><p>“Cada clase cuenta: la constancia de hoy es la fluidez de mañana.”</p><footer>— Mastery English Club</footer></blockquote>
          <ul class="agv-feat"><li>${svg("cal")}<span>Clases dinámicas y personalizadas</span></li><li>${svg("grp")}<span>Profesores con experiencia</span></li><li>${svg("shield")}<span>Metodología comprobada</span></li><li>${svg("star")}<span>Acompañamiento constante</span></li></ul>
          <button type="button" class="agv-cta" id="agv-cta">${svg("cal")} Tu clase, tu momento →</button></aside></div>${o.below || ""}</div>`;
  }
  M.agenda = { IC, svg, ini, hh, render };
})();
