/* MEC CRM – «Mi disponibilidad» (teacher) y «Disponibilidad» (admin). Decisión del dueño (26-oct-2026):
   la disponibilidad se marca SEMANA POR SEMANA; si una semana no tiene bloques marcados, esa semana no se le pueden agendar clases.
   Bloques de 60 min en punto, lunes a sábado (hora Bogotá). Se guarda la semana completa con api.setWeekSlots (RPC set_week_slots).
   Horario: las 24 horas (00:00–24:00), lunes a sábado.
   Pantalla: por defecto BLOQUEADA (solo ver, se desliza normal). «Agenda tu disponibilidad» abre la edición:
   en el celular se elige el día y las horas salen en lista (sin deslizar hacia los lados); en el computador, cuadrícula con clic o arrastre. */
(function () {
  const M = window.MEC, esc = M.esc;
  const H0 = 0, H1 = 23;                       // 24 horas: 00:00 a 23:00 (pedido del dueño, 26-oct-2026)
  const hh = (h) => String(h).padStart(2, "0") + ":00";
  const narrow = () => matchMedia("(max-width: 700px)").matches;

  async function view(app, opts) {
    const api = M.api, admin = !!opts.admin;
    let week = M.weekStart(new Date()), tid = opts.teacherId, teachers = [];
    let saved = new Set(), cur = new Set(), classes = [], edit = false, day = 0;
    if (admin) { teachers = await api.listTeachers(); if (!tid || !teachers.some((t) => t.id === tid)) tid = (teachers[0] || {}).id; }
    const dirty = () => cur.size !== saved.size || [...cur].some((x) => !saved.has(x));
    const slotIso = (i, h) => { const d = M.bog(week.getTime() + i * 864e5 + 6 * 3600e3); return M.bogDate(d.y, d.m, d.d, h).toISOString(); };
    const leave = () => !dirty() || confirm("Tienes cambios sin guardar en esta semana. ¿Salir sin guardar?");
    const days = () => [0, 1, 2, 3, 4, 5].map((i) => M.bog(week.getTime() + i * 864e5 + 6 * 3600e3));
    const dlabel = (d) => `${M.DOW[d.dow]} ${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}`;
    const classAt = (iso) => classes.find((c) => new Date(c.starts_at).toISOString() === iso);

    async function load() {
      const to = new Date(week.getTime() + 7 * 864e5);
      if (!tid) { app.innerHTML = `<div class="dsp"><h1>Disponibilidad</h1><p class="muted">No hay teachers registrados.</p></div>`; return; }
      const [sl, cls] = await Promise.all([api.weekSlots(week, to, tid), api.listClasses({ from: week.toISOString(), to: to.toISOString() }).catch(() => [])]);
      saved = new Set(sl.filter((x) => x.starts_at).map((x) => new Date(x.starts_at).toISOString())); cur = new Set(saved);
      classes = cls.filter((c) => c.teacher_id === tid && c.status !== "cancelled");
      const now = Date.now(); day = Math.max(0, days().findIndex((d, i) => new Date(slotIso(i, H1)).getTime() > now)); if (day < 0) day = 0;
      draw();
    }

    /* cuadrícula: solo ver (divs) o editable (botones, computador) */
    function gridHtml(editable) {
      const now = Date.now(), ds = days();
      let g = `<div class="dsp-h dsp-hcol">Hora</div>` + ds.map((d, i) => editable ? `<button type="button" class="dsp-h dsp-day" data-day="${i}" title="Marcar o desmarcar todo el día">${dlabel(d)}</button>` : `<div class="dsp-h">${dlabel(d)}</div>`).join("");
      for (let h = H0; h <= H1; h++) {
        g += `<div class="dsp-hora">${hh(h)}</div>`;
        ds.forEach((d, i) => { const iso = slotIso(i, h), past = new Date(iso).getTime() < now, on = cur.has(iso), cl = classAt(iso);
          const cls = `dsp-c${on ? " on" : ""}${past ? " past" : ""}${cl ? " cls" : ""}`, txt = cl ? "Clase" : on ? "✓" : "";
          g += editable ? `<button type="button" class="${cls}" data-s="${iso}" ${past ? "disabled" : ""} aria-pressed="${on}" aria-label="${dlabel(d)} ${hh(h)}: ${on ? "disponible" : "no disponible"}${cl ? ", tiene clase" : ""}">${txt}</button>`
            : `<div class="${cls}" title="${dlabel(d)} ${hh(h)}${on ? " · disponible" : ""}${cl ? " · clase" : ""}">${txt}</div>`; });
      }
      return `<div class="dsp-scroll"><div class="dsp-grid${editable ? " edit" : ""}" style="grid-template-rows:38px repeat(${H1 - H0 + 1},34px)">${g}</div></div>`;
    }
    /* edición en el celular: día + lista de horas */
    function listHtml() {
      const now = Date.now(), ds = days();
      const chips = ds.map((d, i) => { const n = [...cur].filter((x) => { const p = M.bog(x); return p.d === d.d && p.m === d.m; }).length;
        return `<button type="button" class="dsp-chip${i === day ? " on" : ""}" data-chip="${i}">${dlabel(d)}${n ? `<small>${n} h</small>` : ""}</button>`; }).join("");
      let rows = "";
      for (let h = H0; h <= H1; h++) { const iso = slotIso(day, h), past = new Date(iso).getTime() < now, on = cur.has(iso), cl = classAt(iso);
        rows += `<button type="button" class="dsp-row${on ? " on" : ""}${past ? " past" : ""}" data-s="${iso}" ${past ? "disabled" : ""} aria-pressed="${on}">
          <b>${hh(h)} – ${hh(h + 1 > 23 ? 24 : h + 1)}</b><span>${cl ? '<i class="dsp-tag">Clase</i> ' : ""}${past ? "Ya pasó" : on ? "Disponible ✓" : "No disponible"}</span></button>`; }
      return `<div class="dsp-chips" role="tablist" aria-label="Día">${chips}</div>
        <p><button type="button" class="btn ghost sm" id="dsp-dia">Marcar / desmarcar todo el ${M.DOW[ds[day].dow]}</button></p><div class="dsp-list">${rows}</div>`;
    }

    function draw() {
      const wEnd = new Date(week.getTime() + 5 * 864e5), tname = admin ? ((teachers.find((t) => t.id === tid) || {}).full_name || "") : "";
      const n = cur.size, hrs = `${n} hora${n === 1 ? "" : "s"} disponible${n === 1 ? "" : "s"}`;
      const estado = dirty() ? ' · <b class="dsp-pend">sin guardar</b>' : saved.size ? " · guardada" : " · <b class='dsp-pend'>sin marcar: no se pueden agendar clases esta semana</b>";
      app.innerHTML = `<div class="dsp"><h1>${admin ? "Disponibilidad de los teachers" : "Mi disponibilidad"}</h1>
        ${admin ? `<label class="dsp-sel">Teacher <select id="dsp-t">${teachers.map((t) => `<option value="${t.id}" ${t.id === tid ? "selected" : ""}>${esc(t.full_name)}</option>`).join("")}</select></label>` : ""}
        <div class="dsp-tool"><div class="dsp-nav"><button type="button" class="btn ghost sm" id="dsp-prev">‹ Anterior</button><button type="button" class="btn ghost sm" id="dsp-hoy">Esta semana</button><button type="button" class="btn ghost sm" id="dsp-next">Siguiente ›</button></div>
          <strong class="dsp-rango">${M.fmtDate(week)} – ${M.fmtDate(wEnd)}${tname ? " · " + esc(tname) : ""}</strong></div>
        ${edit ? `<p class="muted small">${narrow() ? "Elige el día y toca cada hora para marcarla o desmarcarla." : "Clic en un bloque para marcarlo o desmarcarlo, o arrastra para marcar varios. Clic en el día para marcarlo completo."} Hora de Bogotá. Si desmarcas una hora con clase, la clase NO se cancela.</p>
          <div class="dsp-acc"><button type="button" class="btn ghost sm" id="dsp-copy">Copiar semana anterior</button><button type="button" class="btn ghost sm" id="dsp-clear">Limpiar semana</button>
            <span class="dsp-cnt" aria-live="polite">${hrs}${estado}</span></div>
          ${narrow() ? listHtml() : gridHtml(true)}
          <div class="dsp-fin"><button type="button" class="btn ok" id="dsp-save" ${dirty() ? "" : "disabled"}>Guardar semana</button><button type="button" class="btn ghost" id="dsp-cancel">${dirty() ? "Cancelar" : "Listo"}</button></div>`
        : `<p class="dsp-cnt">${hrs}${estado}</p>
          <p><button type="button" class="btn dsp-cta" id="dsp-edit">📅 Agenda tu disponibilidad</button></p>
          ${gridHtml(false)}
          <p class="muted small">✓ = disponible · «Clase» = clase agendada · hora de Bogotá. ${admin ? "Si una semana no tiene horas marcadas, ese teacher no recibe clases esa semana." : "Si no marcas nada en una semana, esa semana no te pueden agendar clases."}</p>`}</div>`;
      bind();
    }

    function bind() {
      const go = (fn) => () => { if (leave()) { fn(); edit = false; load().catch((e) => M.toast(e.message, true)); } };
      M.$("#dsp-prev").onclick = go(() => (week = new Date(week.getTime() - 7 * 864e5)));
      M.$("#dsp-next").onclick = go(() => (week = new Date(week.getTime() + 7 * 864e5)));
      M.$("#dsp-hoy").onclick = go(() => (week = M.weekStart(new Date())));
      const sel = M.$("#dsp-t"); if (sel) sel.onchange = () => { if (leave()) { tid = sel.value; edit = false; load().catch((e) => M.toast(e.message, true)); } else sel.value = tid; };
      if (!edit) { M.$("#dsp-edit").onclick = () => { edit = true; draw(); }; return; }
      M.$("#dsp-cancel").onclick = () => { if (!leave()) return; cur = new Set(saved); edit = false; draw(); };
      M.$("#dsp-clear").onclick = () => { const now = Date.now(); [...cur].forEach((x) => { if (new Date(x).getTime() >= now) cur.delete(x); }); draw(); };
      M.$("#dsp-copy").onclick = M.wrapErr(async () => {
        const pw = new Date(week.getTime() - 7 * 864e5), prev = await api.weekSlots(pw, week, tid), now = Date.now();
        const add = prev.filter((x) => x.starts_at).map((x) => new Date(new Date(x.starts_at).getTime() + 7 * 864e5).toISOString()).filter((x) => new Date(x).getTime() >= now);
        if (!add.length) return M.toast("La semana anterior no tiene horas marcadas", true);
        [...cur].forEach((x) => { if (new Date(x).getTime() >= now) cur.delete(x); }); add.forEach((x) => cur.add(x)); draw(); M.toast("Copiada: revisa y guarda");
      });
      M.$("#dsp-save").onclick = M.wrapErr(async () => { await api.setWeekSlots(tid, week, [...cur]); saved = new Set(cur); edit = false; draw(); M.toast("Disponibilidad guardada"); });
      const toggleDay = (i) => { const now = Date.now(), cells = []; for (let h = H0; h <= H1; h++) { const iso = slotIso(i, h); if (new Date(iso).getTime() >= now) cells.push(iso); }
        const all = cells.length && cells.every((x) => cur.has(x)); cells.forEach((x) => (all ? cur.delete(x) : cur.add(x))); draw(); };
      if (narrow()) { // celular: día + lista
        M.$$("[data-chip]").forEach((b) => (b.onclick = () => { day = +b.dataset.chip; draw(); }));
        M.$("#dsp-dia").onclick = () => toggleDay(day);
        M.$$(".dsp-row[data-s]").forEach((b) => (b.onclick = () => { const s = b.dataset.s; cur.has(s) ? cur.delete(s) : cur.add(s); draw(); }));
        return;
      }
      // computador: clic o arrastrar con el mouse
      M.$$(".dsp-day").forEach((b) => (b.onclick = () => toggleDay(+b.dataset.day)));
      let paint = null, mouse = false; const grid = M.$(".dsp-grid.edit");
      const apply = (el) => { if (!el || !el.dataset.s || el.disabled) return; paint ? cur.add(el.dataset.s) : cur.delete(el.dataset.s);
        el.classList.toggle("on", paint); el.setAttribute("aria-pressed", String(paint)); if (!el.classList.contains("cls")) el.textContent = paint ? "✓" : ""; };
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
