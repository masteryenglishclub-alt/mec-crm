/* MEC CRM – «Mi disponibilidad» (teacher) y «Disponibilidad» (admin). Decisión del dueño (26-oct-2026):
   la disponibilidad se marca SEMANA POR SEMANA; si una semana no tiene bloques marcados, esa semana no se le pueden agendar clases.
   Bloques de 60 min en punto, lunes a sábado (hora Bogotá). Se guarda la semana completa con api.setWeekSlots (RPC set_week_slots). */
(function () {
  const M = window.MEC, esc = M.esc;
  const H0 = 5, H1 = 23;                       // filas: 5:00 a 23:00
  const hh = (h) => String(h).padStart(2, "0") + ":00";

  async function view(app, opts) {
    const api = M.api, admin = !!opts.admin;
    let week = M.weekStart(new Date()), tid = opts.teacherId, teachers = [];
    let saved = new Set(), cur = new Set(), classes = [];
    if (admin) { teachers = await api.listTeachers(); if (!tid || !teachers.some((t) => t.id === tid)) tid = (teachers[0] || {}).id; }
    const dirty = () => cur.size !== saved.size || [...cur].some((x) => !saved.has(x));
    const slotIso = (i, h) => { const d = M.bog(week.getTime() + i * 864e5 + 6 * 3600e3); return M.bogDate(d.y, d.m, d.d, h).toISOString(); };
    const leave = () => !dirty() || confirm("Tienes cambios sin guardar en esta semana. ¿Salir sin guardar?");

    async function load() {
      const to = new Date(week.getTime() + 7 * 864e5);
      if (!tid) { app.innerHTML = `<div class="dsp"><h1>Disponibilidad</h1><p class="muted">No hay teachers registrados.</p></div>`; return; }
      const [sl, cls] = await Promise.all([api.weekSlots(week, to, tid), api.listClasses({ from: week.toISOString(), to: to.toISOString() }).catch(() => [])]);
      saved = new Set(sl.filter((x) => x.starts_at).map((x) => new Date(x.starts_at).toISOString())); cur = new Set(saved);
      classes = cls.filter((c) => c.teacher_id === tid && c.status !== "cancelled");
      draw();
    }

    function draw() {
      const now = Date.now(), wEnd = new Date(week.getTime() + 5 * 864e5);
      const days = [0, 1, 2, 3, 4, 5].map((i) => M.bog(week.getTime() + i * 864e5 + 6 * 3600e3));
      const tname = admin ? ((teachers.find((t) => t.id === tid) || {}).full_name || "") : "";
      let grid = `<div class="dsp-h dsp-hcol">Hora</div>` + days.map((d, i) => `<button type="button" class="dsp-h dsp-day" data-day="${i}" title="Marcar o desmarcar todo el día">${M.DOW[d.dow]} ${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}</button>`).join("");
      for (let h = H0; h <= H1; h++) {
        grid += `<div class="dsp-hora">${hh(h)}</div>`;
        days.forEach((d, i) => {
          const iso = slotIso(i, h), past = new Date(iso).getTime() < now, on = cur.has(iso), cl = classes.find((c) => new Date(c.starts_at).toISOString() === iso);
          grid += `<button type="button" class="dsp-c${on ? " on" : ""}${past ? " past" : ""}${cl ? " cls" : ""}" data-s="${iso}" ${past ? "disabled" : ""} aria-pressed="${on}" aria-label="${M.DOW[d.dow]} ${hh(h)}: ${on ? "disponible" : "no disponible"}${cl ? ", tiene clase" : ""}">${cl ? "Clase" : on ? "✓" : ""}</button>`;
        });
      }
      const n = cur.size, hrs = `${n} hora${n === 1 ? "" : "s"} disponible${n === 1 ? "" : "s"}`;
      app.innerHTML = `<div class="dsp"><h1>${admin ? "Disponibilidad de los teachers" : "Mi disponibilidad"}</h1>
        <p class="muted">${admin ? "Elige el teacher y marca las horas en que puede dar clase <b>esa semana</b>." : "Marca las horas en que puedes dar clase <b>esta semana</b>."} Toca un bloque para marcarlo o desmarcarlo (o arrastra para marcar varios). ${admin ? "Si una semana no tiene horas marcadas, ese teacher no recibe clases esa semana." : "Si no marcas nada en una semana, esa semana no te pueden agendar clases."} Hora de Bogotá.</p>
        ${admin ? `<label class="dsp-sel">Teacher <select id="dsp-t">${teachers.map((t) => `<option value="${t.id}" ${t.id === tid ? "selected" : ""}>${esc(t.full_name)}</option>`).join("")}</select></label>` : ""}
        <div class="dsp-tool"><div class="dsp-nav"><button type="button" class="btn ghost sm" id="dsp-prev">‹ Semana anterior</button><button type="button" class="btn ghost sm" id="dsp-hoy">Esta semana</button><button type="button" class="btn ghost sm" id="dsp-next">Semana siguiente ›</button></div>
          <strong class="dsp-rango">${M.fmtDate(week)} – ${M.fmtDate(wEnd)}${tname ? " · " + esc(tname) : ""}</strong></div>
        <div class="dsp-acc"><button type="button" class="btn ghost sm" id="dsp-copy">Copiar semana anterior</button><button type="button" class="btn ghost sm" id="dsp-clear">Limpiar semana</button>
          <span class="dsp-cnt" aria-live="polite">${hrs}${dirty() ? ' · <b class="dsp-pend">sin guardar</b>' : saved.size ? " · guardada" : " · <b class='dsp-pend'>sin marcar: no se pueden agendar clases esta semana</b>"}</span>
          <button type="button" class="btn ok" id="dsp-save" ${dirty() ? "" : "disabled"}>Guardar semana</button></div>
        <div class="dsp-scroll"><div class="dsp-grid" style="grid-template-rows:38px repeat(${H1 - H0 + 1},34px)">${grid}</div></div>
        <p class="muted small">✓ = disponible · «Clase» = ya tienes una clase en ese bloque (si lo desmarcas, la clase NO se cancela) · los bloques pasados no se pueden cambiar.</p></div>`;
      bind();
    }

    function bind() {
      const go = (fn) => () => { if (leave()) { fn(); load().catch((e) => M.toast(e.message, true)); } };
      M.$("#dsp-prev").onclick = go(() => (week = new Date(week.getTime() - 7 * 864e5)));
      M.$("#dsp-next").onclick = go(() => (week = new Date(week.getTime() + 7 * 864e5)));
      M.$("#dsp-hoy").onclick = go(() => (week = M.weekStart(new Date())));
      const sel = M.$("#dsp-t"); if (sel) sel.onchange = () => { if (leave()) { tid = sel.value; load().catch((e) => M.toast(e.message, true)); } else sel.value = tid; };
      M.$("#dsp-clear").onclick = () => { const now = Date.now(); [...cur].forEach((x) => { if (new Date(x).getTime() >= now) cur.delete(x); }); draw(); };
      M.$("#dsp-copy").onclick = M.wrapErr(async () => {
        const pw = new Date(week.getTime() - 7 * 864e5), prev = await api.weekSlots(pw, week, tid), now = Date.now();
        const add = prev.filter((x) => x.starts_at).map((x) => new Date(new Date(x.starts_at).getTime() + 7 * 864e5).toISOString()).filter((x) => new Date(x).getTime() >= now);
        if (!add.length) return M.toast("La semana anterior no tiene horas marcadas", true);
        [...cur].forEach((x) => { if (new Date(x).getTime() >= now) cur.delete(x); }); add.forEach((x) => cur.add(x)); draw(); M.toast("Copiada: revisa y guarda");
      });
      M.$("#dsp-save").onclick = M.wrapErr(async () => { await api.setWeekSlots(tid, week, [...cur]); saved = new Set(cur); draw(); M.toast("Disponibilidad guardada"); });
      M.$$(".dsp-day").forEach((b) => (b.onclick = () => { const i = +b.dataset.day, now = Date.now(), cells = [];
        for (let h = H0; h <= H1; h++) { const iso = slotIso(i, h); if (new Date(iso).getTime() >= now) cells.push(iso); }
        const all = cells.length && cells.every((x) => cur.has(x)); cells.forEach((x) => (all ? cur.delete(x) : cur.add(x))); draw(); }));
      // tocar / arrastrar para marcar varios bloques
      let paint = null; const grid = M.$(".dsp-grid");
      const apply = (el) => { if (!el || !el.dataset.s || el.disabled) return; paint ? cur.add(el.dataset.s) : cur.delete(el.dataset.s);
        el.classList.toggle("on", paint); el.setAttribute("aria-pressed", String(paint)); if (!el.classList.contains("cls")) el.textContent = paint ? "✓" : ""; };
      // Mouse: clic o arrastrar para marcar varios. Celular/tablet: el dedo DESLIZA la cuadrícula y un toque marca o desmarca.
      let mouse = false;
      grid.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; const el = e.target.closest(".dsp-c"); if (!el || el.disabled) return;
        e.preventDefault(); mouse = true; paint = !cur.has(el.dataset.s); apply(el); });
      grid.addEventListener("pointermove", (e) => { if (paint === null) return; apply(document.elementFromPoint(e.clientX, e.clientY)?.closest(".dsp-c")); });
      const end = () => { setTimeout(() => (mouse = false), 0); if (paint !== null) { paint = null; draw(); } }; addEventListener("pointerup", end, { once: true }); addEventListener("pointercancel", end, { once: true });
      grid.addEventListener("click", (e) => { const el = e.target.closest(".dsp-c"); if (!el || el.disabled || mouse) return; paint = !cur.has(el.dataset.s); apply(el); paint = null; draw(); });
    }
    await load();
    return { dirty };
  }
  M.disponibilidad = { view };
})();
