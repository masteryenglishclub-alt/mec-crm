/* MEC CRM – portal Estudiante (nunca muestra evaluaciones internas) */
(async () => {
  const M = MEC, api = M.api, app = M.$("#app");
  const me = await M.requireRole("student");
  let tab = "inicio";
  let week = M.weekStart(new Date(Date.now() + 864e5 * 7));  // semana siguiente por defecto
  if (location.hash === "#solicitar") tab = "solicitar";
  M.header(me, [["inicio", "Inicio"], ["solicitar", "Solicitar clase"], ["camino", "Mi camino"], ["clases", "Mis clases"], ["feedback", "Feedback"], ["libros", "Libros"]], (t) => { tab = t; render(); });
  const render = M.wrapErr(async () => { app.innerHTML = '<p class="muted">Cargando…</p>'; await views[tab](); });
  const data = async () => { const [s] = await api.listStudents(); return s; };
  const nice = (c) => c.class_type === "conversation_lab" ? "Conversation Lab · conversación guiada" : M.TYPE_LABEL[c.class_type];
  const clsRow = (c) => `<div class="cls"><div><b>${M.esc(c.title)}</b> <span class="tag">${nice(c)}</span><br><span class="muted small">${M.fmtDateTime(c.starts_at)} · ${M.esc(c.teacher_name)}</span></div>
    <div>${c.status === "scheduled" && c.meet_url ? `<a class="btn sm" href="${M.esc(c.meet_url)}" target="_blank" rel="noopener">Entrar a Google Meet</a>` : M.tagStatus(c.status)}
    ${c.status === "scheduled" && new Date(c.starts_at) > new Date() ? ` <button class="btn ghost sm" data-cancel="${c.id}" data-at="${c.starts_at}">Cancelar</button>` : ""}
    ${c.late_penalty && c.late_penalty !== "none" ? `<br><span class="small muted">${M.PENALTY_LABEL[c.late_penalty]}</span>` : ""}</div></div>`;
  const bindCancel = (b) => M.$$("[data-cancel]").forEach((el) => (el.onclick = () => {
    const h = (new Date(el.dataset.at) - Date.now()) / 3600e3, late = h < b.late_cancel_hours;
    const what = !late ? `Faltan más de ${b.late_cancel_hours} h: <b>cancelas sin cargo</b>.`
      : b.passes_remaining > 0 ? `Faltan menos de ${b.late_cancel_hours} h: se usará <b>1 de tus ${b.passes_remaining} pases libres</b> (no se descuenta la clase).`
      : `Faltan menos de ${b.late_cancel_hours} h y ya usaste tus pases libres: <b>la clase se descuenta de tu paquete</b>.`;
    M.modal(`<h2>Cancelar clase</h2><p>${what}</p><label>Motivo (opcional)</label><input id="cr">
      <p style="margin-top:14px"><button class="btn red" id="ok">Confirmar cancelación</button> <button class="btn ghost" onclick="MEC.closeModal()">Volver</button></p>`, () => {
      M.$("#ok").onclick = M.wrapErr(async () => { const r = await api.cancelClass(el.dataset.cancel, M.$("#cr").value.trim());
        M.closeModal(); M.toast("Clase cancelada · " + M.PENALTY_LABEL[r]); render(); });
    });
  }));

  const views = {
    async inicio() {
      const s = await data(), r = s.remaining, now = new Date().toISOString();
      const up = (await api.listClasses({ from: now })).filter((c) => c.status === "scheduled").slice(0, 3);
      const pr = (await api.listProgress())[0], b = await api.bookingStatus();
      const done = s.start_class_number - 1 + s.classes_completed;
      app.innerHTML = `<h1>Hola, ${M.esc(s.full_name.split(" ")[0])}</h1>${M.paymentBanner(b)}
        <div class="grid g4" style="margin-bottom:18px">
          <div class="panel kpi"><div style="margin:6px 0 10px">${M.passes(b)}</div><span>Pases libres · cancelación tardía o inasistencia</span></div>
          <div class="panel kpi blue rune"><b>${r.classes_remaining}</b><span>Clases disponibles en tu paquete</span></div>
          <div class="panel kpi"><b>${done}<small style="font-size:1rem" class="muted">/160</small></b><span>Clases del programa</span></div>
          <div class="panel kpi red"><b>${M.esc(s.level_name)}${s.current_sublevel ? "." + s.current_sublevel : ""}</b><span>Tu nivel actual</span></div></div>
        <div class="panel"><div class="bar"><i style="width:${(done / 160) * 100}%"></i></div><p class="small muted" style="margin-top:6px">Próxima: clase #${r.next_class_number} · ${M.esc(M.classInfo(r.next_class_number, s.program).title)}</p></div>
        <div class="grid g2"><div class="panel"><h3>Próximas clases</h3>${up.map(clsRow).join("") || '<p class="muted">No tienes clases agendadas.</p>'}
          <p><a class="btn sm" href="#solicitar" id="goreq">${b.payment_blocked ? "Ver estado de mi paquete" : "Solicitar una clase"}</a></p></div>
        <div class="panel"><h3>Tu mes</h3>${pr ? `<div class="grid g3"><div class="kpi"><b>${pr.speaking_minutes}</b><span>min hablando</span></div><div class="kpi"><b>${pr.speaking_pct ?? "—"}%</b><span>del tiempo</span></div><div class="kpi"><b>${pr.fluency ?? "—"}/5</b><span>fluidez</span></div></div>
          <p class="small muted">Vocabulario nuevo:</p><div class="chips">${(pr.new_vocabulary || []).map((w) => `<span class="chip">${M.esc(w)}</span>`).join("")}</div>` : '<p class="muted">Tu teacher registrará tu progreso de este mes.</p>'}</div></div>`;
      M.$("#goreq").onclick = (e) => { e.preventDefault(); M.$('nav.tabs [data-tab="solicitar"]').click(); };
      bindCancel(b);
    },
    async solicitar() {
      const [s, b, reqs, mine] = await Promise.all([data(), api.bookingStatus(), api.listRequests(), api.listClasses()]);
      const to = new Date(week.getTime() + 7 * 864e5), cal = s.teacher_id ? await api.teacherCalendar(s.teacher_id, week.toISOString(), to.toISOString()) : { availability: [], busy: [] };
      const days = [1, 2, 3, 4, 5, 6].map((i) => new Date(week.getTime() + (i - 1) * 864e5));
      const minT = Date.now() + b.min_request_hours * 3600e3, locked = b.payment_blocked || b.available_to_request < 1;
      const pend = reqs.filter((r) => r.status === "pending");
      const state = (slot) => {
        const p = M.bog(slot), iso = slot.toISOString();
        if (!M.isValidSlot(slot)) return "off";
        if (cal.availability.length && !cal.availability.some(([d, a, z]) => d === p.dow && p.h >= a && p.h < z)) return "off";
        if (mine.some((c) => c.status === "scheduled" && c.starts_at === iso)) return "mine";
        if (pend.some((r) => r.starts_at === iso)) return "pend";
        if (cal.busy.includes(iso)) return "busy";
        if (slot.getTime() < minT) return "soon";
        return "free";
      };
      const LBL = { off: "", mine: "Tu clase", pend: "Solicitada", busy: "Ocupado", soon: "—", free: "Libre" };
      let g = '<div class="hd">Hora</div>' + days.map((d) => `<div class="hd">${M.DOW[M.bog(d).dow]} ${M.bog(d).d}/${M.bog(d).m}</div>`).join("");
      let list = "";
      for (let h = 6; h < 18; h++) {
        g += `<div class="hr">${String(h).padStart(2, "0")}:00</div>`;
        days.forEach((d) => { const p = M.bog(d), slot = M.bogDate(p.y, p.m, p.d, h), st = state(slot);
          g += `<div class="${st === "free" ? "free req" : st}" ${st === "free" ? `data-slot="${slot.toISOString()}"` : ""}>${LBL[st]}</div>`; });
      }
      days.forEach((d) => { const p = M.bog(d), sl = [];
        for (let h = 6; h < 18; h++) { const slot = M.bogDate(p.y, p.m, p.d, h), st = state(slot);
          if (st === "free") sl.push(`<button data-slot="${slot.toISOString()}">${String(h).padStart(2, "0")}:00</button>`);
          if (st === "pend" || st === "mine") sl.push(`<span class="chip pend">${String(h).padStart(2, "0")}:00 · ${LBL[st]}</span>`); }
        list += `<div class="day"><b>${M.DOW[p.dow]} ${p.d}/${p.m}</b><div class="chips" style="margin-top:6px">${sl.join("") || '<span class="muted small">Sin bloques libres</span>'}</div></div>`; });
      const wEnd = new Date(week.getTime() + 5 * 864e5);
      app.innerHTML = `<h1>Solicitar clase</h1>${M.paymentBanner(b)}
        <div class="grid g3" style="margin-bottom:18px">
          <div class="panel kpi blue"><b>${b.available_to_request}</b><span>Clases que puedes solicitar</span></div>
          <div class="panel kpi"><b>${b.pending_requests}</b><span>Solicitudes pendientes</span></div>
          <div class="panel kpi"><div style="margin:6px 0 10px">${M.passes(b)}</div><span>Pases libres</span></div></div>
        <div class="panel rune"><div class="row">
          <div style="flex:0 0 auto"><button class="btn ghost sm" id="prev">◀</button> <button class="btn ghost sm" id="next">▶</button></div>
          <div><b>Calendario de ${M.esc(s.teacher_name || "tu teacher")}</b> · ${M.fmtDate(week)} – ${M.fmtDate(wEnd)} <span class="muted small">· hora Bogotá · bloques de 60 min</span></div></div>
          <div class="legend"><span><i style="background:rgba(60,207,142,.25)"></i>Libre (clic para solicitar)</span><span><i style="background:rgba(231,176,74,.3)"></i>Tu solicitud pendiente</span>
            <span><i style="background:rgba(58,160,255,.3)"></i>Tu clase</span><span><i style="background:rgba(255,255,255,.08)"></i>Ocupado</span><span><i class="off" style="background:repeating-linear-gradient(45deg,#333 0 3px,transparent 3px 6px)"></i>Fuera de horario</span></div>
          <div class="cal-desk table-wrap"><div class="sched ${locked ? "locked" : ""}">${g}</div></div>
          <div class="daylist">${list}</div>
          <p class="muted small">Tu solicitud queda <b>pendiente</b> hasta que tu teacher o el admin la apruebe. Se solicita con al menos ${b.min_request_hours} h de anticipación.
          Puedes cancelar sin cargo hasta ${b.late_cancel_hours} h antes; después (o si no asistes) se usa un pase libre y, sin pases, se descuenta la clase.</p></div>
        <div class="panel"><h3>Mis solicitudes</h3>${reqs.slice().reverse().map((r) => `<div class="cls"><div><b>${M.fmtDateTime(r.starts_at)}</b> ${M.tagReq(r.status)}
          ${r.student_note ? `<br><span class="small muted">Tu nota: ${M.esc(r.student_note)}</span>` : ""}${r.decision_note ? `<br><span class="small">Respuesta: ${M.esc(r.decision_note)}</span>` : ""}</div>
          <div>${r.status === "pending" ? `<button class="btn ghost sm" data-wd="${r.id}">Retirar</button>` : ""}</div></div>`).join("") || '<p class="muted">Aún no has enviado solicitudes.</p>'}</div>`;
      M.$("#prev").onclick = () => { week = new Date(week.getTime() - 7 * 864e5); render(); };
      M.$("#next").onclick = () => { week = new Date(week.getTime() + 7 * 864e5); render(); };
      M.$$("[data-slot]").forEach((el) => (el.onclick = () => {
        if (b.payment_blocked) return M.toast("Pago pendiente: no puedes solicitar clases hasta que el admin confirme el pago de tu paquete.", true);
        if (b.available_to_request < 1) return M.toast("No te quedan clases disponibles para solicitar en tu paquete.", true);
        M.modal(`<h2>Solicitar clase</h2><p><b>${M.fmtDateTime(el.dataset.slot)}</b> con ${M.esc(s.teacher_name || "tu teacher")} · 60 min</p>
          <label>Nota para tu teacher (opcional)</label><textarea id="rn" rows="2" maxlength="500"></textarea>
          <p class="small muted">La clase se confirma cuando tu teacher o el admin aprueben la solicitud.</p>
          <p><button class="btn" id="ok">Enviar solicitud</button> <button class="btn ghost" onclick="MEC.closeModal()">Cancelar</button></p>`, () => {
          M.$("#ok").onclick = M.wrapErr(async () => { await api.createRequest({ starts_at: el.dataset.slot, note: M.$("#rn").value.trim() }); M.closeModal(); M.toast("Solicitud enviada"); render(); });
        });
      }));
      M.$$("[data-wd]").forEach((el) => (el.onclick = M.wrapErr(async () => { await api.cancelRequest(el.dataset.wd); M.toast("Solicitud retirada"); render(); })));
    },
    async camino() {
      const s = await data(), done = s.start_class_number - 1 + s.classes_completed, next = Math.min(160, done + 1);
      const rows = [0, 1, 2, 3, 4].map((li) => {
        const base = li * 32, subs = [1, 2, 3, 4, 5].map((k) => { const a = base + (k - 1) * 6, d = Math.max(0, Math.min(6, done - a)), now = next > a && next <= a + 6;
          return `<div class="sub ${d === 6 ? "done" : ""} ${now ? "now" : ""}" title="${M.LEVELS[li]}.${k}: ${d}/6"><i style="width:${(d / 6) * 100}%"></i><span>${M.LEVELS[li]}.${k} · ${d}/6</span></div>`; }).join("");
        const rv = Math.max(0, Math.min(2, done - base - 30));
        return `<div class="lvl"><div class="ln">${M.esc(M.LEVEL_NAMES[s.program][li])}</div>${subs}<div class="sub rv ${rv === 2 ? "done" : ""}"><i style="width:${rv * 50}%"></i><span>Repaso ${rv}/2</span></div></div>`;
      }).join("");
      app.innerHTML = `<h1>Mi camino</h1><div class="panel rune"><p class="muted">5 niveles · 5 subniveles de 6 clases (4 de contenido, Practice Studio y Conversation Lab) · 2 repasos por nivel. Cada clase se habilita al completar la anterior.</p>
        <div class="levels">${rows}</div></div>
        <div class="panel"><h3>Subnivel actual</h3>${(() => { const i = M.classInfo(next, s.program); if (!i.sub) return `<p>${M.esc(i.title)}</p>`;
          const a = (i.level - 1) * 32 + (i.sub - 1) * 6; return [1, 2, 3, 4, 5, 6].map((k) => { const n = a + k, st = n <= done ? "✔" : n === next ? "▶" : "🔒";
            return `<div class="cls"><div>${st} <b>#${n}</b> · ${M.esc(M.classInfo(n, s.program).title)}</div><span class="tag">${M.TYPE_LABEL[M.classInfo(n).type] === "Conversation Lab" ? "Conversación guiada" : M.TYPE_LABEL[M.classInfo(n).type]}</span></div>`; }).join(""); })()}</div>`;
    },
    async clases() {
      const cls = await api.listClasses(), now = new Date().toISOString(), b = await api.bookingStatus();
      const up = cls.filter((c) => c.status === "scheduled" && c.starts_at >= now), past = cls.filter((c) => !(c.status === "scheduled" && c.starts_at >= now)).reverse();
      app.innerHTML = `<h1>Mis clases</h1><div class="panel rune"><h3>Próximas</h3>${up.map(clsRow).join("") || '<p class="muted">Sin clases agendadas.</p>'}
        <p class="small muted">Horario en hora de Bogotá. El enlace de Google Meet se activa a la hora de tu clase. Cancelación sin cargo hasta ${b.late_cancel_hours} h antes · pases libres: ${b.passes_remaining} de ${b.passes_total}.</p></div>
        <div class="panel"><h3>Historial</h3>${past.map(clsRow).join("")}</div>`;
      bindCancel(b);
    },
    async feedback() {
      const cls = (await api.listClasses()).filter((c) => c.sentences || c.teacher_note).reverse();
      app.innerHTML = `<h1>Feedback de tus clases</h1>${cls.map((c) => `<div class="panel"><h3>${M.esc(c.title)}</h3><p class="muted small">${M.fmtDateTime(c.starts_at)} · ${M.esc(c.teacher_name)}</p>
        ${c.teacher_note ? `<p>${M.esc(c.teacher_note)}</p>` : ""}${c.sentences ? `<p class="small muted" style="margin:0;text-transform:uppercase;letter-spacing:.12em">My sentences today</p><ul class="sentences">${c.sentences.map((s) => `<li>${M.esc(s)}</li>`).join("")}</ul>` : ""}</div>`).join("") || '<div class="panel muted">Aún no hay feedback.</div>'}`;
    },
    async libros() {
      const s = await data(), b = (await api.listBooks()).filter((x) => !x.teacher_only && (x.program === s.program || x.program === "ambos"));
      app.innerHTML = `<h1>Libros y materiales</h1><div class="grid g2">${[1, 2, 3, 4, 5].map((li) => { const l = b.filter((x) => x.level_index === li); if (!l.length) return "";
        return `<div class="panel ${li === s.current_level ? "rune" : ""}"><h3>${M.esc(M.LEVEL_NAMES[s.program][li - 1])}${li === s.current_level ? " · tu nivel" : ""}</h3>${l.map((x) => `<div class="cls"><span>${M.esc(x.title)}</span>${x.url ? `<a class="btn sm" href="${M.esc(x.url)}" target="_blank" rel="noopener">Abrir</a>` : '<span class="muted small">Próximamente</span>'}</div>`).join("")}</div>`; }).join("")}</div>`;
    }
  };
  render();
})();
