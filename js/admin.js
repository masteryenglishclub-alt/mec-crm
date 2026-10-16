/* MEC CRM – portal Admin */
(async () => {
  const M = MEC, api = M.api, app = M.$("#app");
  const me = await M.requireRole("admin");
  let tab = "agenda", week = M.weekStart(new Date()), teacherFilter = "", reqStatus = "pending", estMode = "perfiles";
  if (location.hash === "#solicitudes") tab = "solicitudes";
  M.header(me, [["agenda", "Agenda"], ["solicitudes", "Solicitud de clases"], ["estudiantes", "Estudiantes"], ["asistencia", "Asistencia"], ["paquetes", "Paquetes"], ["teachers", "Teachers"], ["kids", "Material Kids"]], (t) => { tab = t; render(); });
  const render = M.wrapErr(async () => { app.innerHTML = '<p class="muted">Cargando…</p>'; await views[tab](); });

  const views = {
    async kids() { await M.kidsMaterialView(app); },
    async agenda() {
      const to = new Date(week.getTime() + 7 * 864e5);
      const [cls, teachers, students, tps] = await Promise.all([api.listClasses({ from: week.toISOString(), to: to.toISOString() }), api.listTeachers(), api.listStudents(), api.listTeacherProfiles().catch(() => [])]);
      const colors = M.teacherColors(teachers, tps), esc = M.esc;
      const shown = cls.filter((c) => !teacherFilter || c.teacher_id === teacherFilter);
      const days = [1, 2, 3, 4, 5, 6].map((i) => new Date(week.getTime() + (i - 1) * 864e5)), H0 = 6, H1 = 17;
      const today = M.bog(new Date()), hh = (h) => String(h).padStart(2, "0") + ":00";
      const IC = { one: '<path d="M12 7a2.3 2.3 0 1 1 0 4.6A2.3 2.3 0 0 1 12 7zM7.5 17c.6-2.3 2.4-3.6 4.5-3.6s3.9 1.3 4.5 3.6" fill="none" stroke="currentColor" stroke-width="1.5"/>',
        grp: '<path d="M9 8.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM15 8.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM5.5 16.5c.5-1.8 1.8-2.8 3.5-2.8s3 1 3.5 2.8M11.5 16.5c.5-1.8 1.8-2.8 3.5-2.8s3 1 3.5 2.8" fill="none" stroke="currentColor" stroke-width="1.4"/>',
        conv: '<path d="M6 7h12v7h-7l-3.5 3v-3H6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
        star: '<path d="M12 6.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
        clock: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v4.3l3 1.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
        cal: '<rect x="4.5" y="6" width="15" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.5 10h15M8.5 4v4M15.5 4v4M8 13h2M11 13h2M14 13h2M8 16h2M11 16h2" stroke="currentColor" stroke-width="1.5"/>',
        shield: '<path d="M12 4l6.5 2.5v5c0 4-2.8 6.8-6.5 8.5-3.7-1.7-6.5-4.5-6.5-8.5v-5z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
        compass: '<g fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="6.2"/><circle cx="12" cy="12" r="8.6" stroke-dasharray="1 1.2"/></g><path d="M12 1.5l1.6 8.9L12 12l-1.6-1.6zM12 22.5l-1.6-8.9L12 12l1.6 1.6zM1.5 12l8.9-1.6L12 12l-1.6 1.6zM22.5 12l-8.9 1.6L12 12l1.6-1.6z" fill="currentColor"/><path d="M5 5l5.6 5.6M19 19l-5.6-5.6M19 5l-5.6 5.6M5 19l5.6-5.6" stroke="currentColor" stroke-width=".9"/>',
        mount: '<path d="M3 19l6-9 3.5 5 2.5-3.5L21 19z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' };
      const svg = (k, cl = "") => `<svg viewBox="0 0 24 24" class="${cl}" aria-hidden="true">${IC[k]}</svg>`;
      const prog = (c) => (students.find((x) => x.id === c.student_id) || {}).program;
      const kind = (c) => prog(c) === "kids" ? ["kids", "Kids", "star"] : c.class_type === "conversation_lab" ? ["conv", "Conversación", "conv"]
        : c.class_type === "extra_reinforcement" ? ["grp", "Refuerzo", "grp"] : ["gen", "Inglés General", "one"];
      let g = `<div class="agv-hd agv-hcol">${svg("clock")}<span>Hora</span></div>` + days.map((d) => { const p = M.bog(d), now = p.y === today.y && p.m === today.m && p.d === today.d;
        return `<div class="agv-hd${now ? " hoy" : ""}">${M.DOW[p.dow]} ${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}</div>`; }).join("");
      for (let h = H0; h <= H1; h++) {
        g += `<div class="agv-hora" style="grid-row:${h - H0 + 2}">${hh(h)}</div>`;
        days.forEach((d, i) => { const p = M.bog(d), slot = M.bogDate(p.y, p.m, p.d, h), valid = M.isValidSlot(slot);
          g += `<div class="agv-celda ${valid ? "free" : "off"}" style="grid-row:${h - H0 + 2};grid-column:${i + 2}" ${valid ? `data-slot="${slot.toISOString()}" title="Agendar ${M.DOW[p.dow]} ${hh(h)}"` : ""}></div>`; });
      }
      shown.forEach((c) => { const p = M.bog(c.starts_at), di = days.findIndex((d) => { const q = M.bog(d); return q.y === p.y && q.m === p.m && q.d === p.d; });
        if (di < 0 || p.h < H0 || p.h > H1) return; const k = kind(c);
        g += `<button type="button" class="agv-b t-${k[0]} st-${c.status}" data-id="${c.id}" style="grid-row:${p.h - H0 + 2};grid-column:${di + 2};--tc:${colors[c.teacher_id] || "#5d6b80"}" title="${esc(k[1])} · ${esc(c.student_name)} · ${esc(c.teacher_name || "")} · ${M.STATUS_LABEL[c.status] || ""}">
          ${svg(k[2])}<span class="agv-b-t">${k[1]}</span><span class="agv-b-s">(${c.class_type === "extra_reinforcement" ? "extra" : "1 a 1"}) · ${esc(c.student_name)}</span><span class="agv-b-h">${hh(p.h)} – ${hh(p.h + 1)}</span><i class="agv-dot" title="${esc(c.teacher_name || "")}"></i></button>`; });
      const ini = (n) => String(n || "?").replace(/^Teacher\s+/i, "").split(/\s+/).filter(Boolean).slice(-2).map((x) => x[0]).join("").toUpperCase();
      const wEnd = new Date(week.getTime() + 5 * 864e5);
      app.innerHTML = `<div class="agv">
        <div class="agv-bg" aria-hidden="true"><img src="img/web/hero-agenda-1280.jpg" alt="" width="1536" height="911" decoding="async"></div>
        <div class="agv-top"><header class="agv-hero">${svg("compass", "agv-rosa")}<div><span class="agv-tag">Tu camino en inglés</span><h1>Agenda semanal</h1><p>Cada clase te acerca a tus metas. Organiza tu tiempo, vive el proceso y construye tu futuro.</p></div></header>
        <aside class="agv-pergamino">${svg("compass")}<div><strong>Tu esfuerzo hoy, es tu libertad mañana</strong><small>${(() => { const n = cls.filter((c) => { const q = M.bog(c.starts_at); return q.y === today.y && q.m === today.m && q.d === today.d && c.status !== "cancelled"; }).length; return n ? `Hoy: ${n} clase${n === 1 ? "" : "s"} agendada${n === 1 ? "" : "s"}` : "Hoy: sin clases agendadas"; })()}</small></div><span aria-hidden="true">→</span></aside></div>
        <div class="agv-wrap"><section class="agv-main" aria-label="Calendario semanal">
          <div class="agv-tool"><div class="agv-nav"><button type="button" class="agv-btn" id="prev"><b>‹</b> Semana anterior</button><button type="button" class="agv-btn oro" id="today">Hoy</button><button type="button" class="agv-btn" id="next">Semana siguiente <b>›</b></button></div>
            <div class="agv-rango">${svg("cal", "agv-ic")}<div><strong>${M.fmtDate(week)} – ${M.fmtDate(wEnd)}</strong><small>Hora: Bogotá (UTC-5) · Bloques de 60 min (55 + 5)</small></div></div>
            <label class="agv-sel">${svg("one", "agv-ic")}<span class="sr-only">Filtrar por teacher</span><select id="tf"><option value="">Todos los teachers</option>${teachers.map((t) => `<option value="${t.id}" ${t.id === teacherFilter ? "selected" : ""}>${esc(t.full_name)}</option>`).join("")}</select></label></div>
          <div class="agv-scroll"><div class="agv-grid" style="grid-template-rows:42px repeat(${H1 - H0 + 1},92px)">${g}</div></div>
          <p class="agv-ayuda">Clic en un bloque libre para agendar · clic en una clase para ver detalles · franjas rayadas: fuera del horario (L-V 6:00-18:00, sáb 10:00-16:00). El punto de color indica el teacher.</p></section>
        <aside class="agv-side" aria-labelledby="agv-t-h"><div class="agv-marco"><h2 id="agv-t-h">Nuestros teachers</h2>
          <ul class="agv-teachers">${teachers.map((t) => `<li><a href="profesor.html?id=${encodeURIComponent(t.id)}" target="_blank" rel="noopener" style="--tc:${colors[t.id]}" title="Ver perfil de ${esc(t.full_name)} (pestaña nueva)"><span class="agv-av">${esc(ini(t.full_name))}</span><span class="agv-tn">${esc(t.full_name)}</span></a></li>`).join("") || '<li class="muted">Sin teachers</li>'}</ul>
          <p class="agv-hint">Clic en un teacher para ver su perfil</p></div>
          <blockquote class="agv-quote"><p>“Cada clase cuenta: la constancia de hoy es la fluidez de mañana.”</p><footer>— Mastery English Club</footer></blockquote>
          <ul class="agv-feat"><li>${svg("cal")}<span>Clases dinámicas y personalizadas</span></li><li>${svg("grp")}<span>Profesores certificados</span></li><li>${svg("shield")}<span>Metodología comprobada</span></li><li>${svg("star")}<span>Acompañamiento constante</span></li></ul>
          <button type="button" class="agv-cta" id="agv-cta">${svg("cal")} Tu clase, tu momento →</button></aside></div></div>`;
      M.$("#prev").onclick = () => { week = new Date(week.getTime() - 7 * 864e5); render(); };
      M.$("#next").onclick = () => { week = new Date(week.getTime() + 7 * 864e5); render(); };
      M.$("#today").onclick = () => { week = M.weekStart(new Date()); render(); };
      M.$("#tf").onchange = (e) => { teacherFilter = e.target.value; render(); };
      M.$$(".agv-celda.free").forEach((cell) => (cell.onclick = () => newClass(cell.dataset.slot, teachers, students)));
      M.$$(".agv-b").forEach((el) => (el.onclick = () => classDetail(cls.find((c) => c.id === el.dataset.id))));
      M.$("#agv-cta").onclick = () => { const f = M.$$(".agv-celda.free").find((c) => new Date(c.dataset.slot) > new Date()); if (f) newClass(f.dataset.slot, teachers, students); else M.toast("No hay bloques libres esta semana", true); };
    },
    async solicitudes() {
      const [reqs, teachers, tps] = await Promise.all([api.listRequests(), api.listTeachers(), api.listTeacherProfiles().catch(() => [])]);
      const colors = M.teacherColors(teachers, tps);
      const shown = reqs.filter((r) => (!teacherFilter || r.teacher_id === teacherFilter) && (!reqStatus || r.status === reqStatus));
      const cnt = (st) => reqs.filter((r) => (!teacherFilter || r.teacher_id === teacherFilter) && (!st || r.status === st)).length;
      app.innerHTML = `<div class="gbg bg-sol"><div class="stt-in"><h1>Solicitud de clases</h1><p class="muted">Solo el admin aprueba o rechaza. Los teachers ven el estado en modo lectura.</p>
        <div class="row" role="group" aria-label="Filtrar por estado" style="margin-bottom:10px;gap:6px;flex-wrap:wrap">${[["", "Todas"], ["pending", "Pendientes"], ["approved", "Aprobadas"], ["rejected", "Rechazadas"], ["cancelled", "Retiradas"]].map(([k, n]) => `<button type="button" class="sp-btn sol-f" data-rs="${k}" aria-pressed="${k === reqStatus}">${n} (${cnt(k)})</button>`).join("")}</div>
        <div class="panel"><div class="row"><div class="muted">Un calendario por teacher. Las solicitudes pendientes no bloquean el bloque; al aprobar se vuelve a verificar todo.</div>
        <div style="flex:0 0 240px"><select id="tf"><option value="">Todos los teachers</option>${teachers.map((t) => `<option value="${t.id}" ${t.id === teacherFilter ? "selected" : ""}>${M.esc(t.full_name)} (${reqs.filter((r) => r.teacher_id === t.id && r.status === "pending").length})</option>`).join("")}</select></div></div></div>
        <div class="legend">${teachers.map((t) => `<span><i style="background:${colors[t.id]}"></i>${M.esc(t.full_name)}</span>`).join("")}</div><div class="panel sol-tw">${M.requestsTable(shown, colors)}</div></div></div>`;
      M.$("#tf").onchange = (e) => { teacherFilter = e.target.value; render(); };
      M.$$("[data-rs]").forEach((b) => (b.onclick = () => { reqStatus = b.dataset.rs; render(); }));
      M.bindRequests(api, render);
    },
    async estudiantes() {
      const [st, teachers, pk] = await Promise.all([api.listStudents(), api.listTeachers(), api.listStudentPackages()]);
      const sw = `<div class="row" role="group" aria-label="Vista" style="margin-bottom:12px;gap:6px"><button type="button" class="btn sm ${estMode === "perfiles" ? "" : "ghost"}" data-em="perfiles" style="flex:0 0 auto" aria-pressed="${estMode === "perfiles"}">Perfiles</button><button type="button" class="btn sm ${estMode === "gestion" ? "" : "ghost"}" data-em="gestion" style="flex:0 0 auto" aria-pressed="${estMode === "gestion"}">Gestión y paquetes</button></div>`;
      const bindSw = () => M.$$("[data-em]").forEach((b) => (b.onclick = () => { estMode = b.dataset.em; render(); }));
      if (estMode === "perfiles") {
        app.innerHTML = `<h1>Estudiantes</h1>${sw}<div id="pf-root"></div>`; bindSw();
        return M.perfil.studentsBrowser(M.$("#pf-root"), { students: st, showTeacher: true });
      }
      app.innerHTML = `<h1>Estudiantes y paquetes</h1>${sw}
        <div class="grid g4" style="margin-bottom:18px">
          <div class="panel kpi"><b>${st.length}</b><span>Estudiantes</span></div>
          <div class="panel kpi blue"><b>${st.reduce((a, s) => a + s.remaining.classes_remaining, 0)}</b><span>Clases por dictar (pagadas/vigentes)</span></div>
          <div class="panel kpi red"><b>${st.filter((s) => !s.teacher_id).length}</b><span>Sin teacher asignado</span></div>
          <div class="panel kpi"><b>${pk.filter((p) => p.payment_status === "pending").length}</b><span>Paquetes sin pagar (bloqueados)</span></div></div>
        <div class="panel"><div class="table-wrap"><table><thead><tr><th>Estudiante</th><th>Programa</th><th>Nivel actual</th><th>Avance 160</th><th>Teacher</th><th>Clases restantes</th><th></th></tr></thead><tbody>
        ${st.map((s) => `<tr><td><b>${M.esc(s.full_name)}</b><br><span class="muted small">${M.esc(s.email || "")}</span></td><td>${s.program}</td>
          <td>${M.esc(s.level_name)}${s.current_sublevel ? "." + s.current_sublevel : " · Repaso"}<br><span class="muted small">próxima #${s.remaining.next_class_number}</span></td>
          <td style="min-width:120px"><div class="bar"><i style="width:${((s.start_class_number - 1 + s.classes_completed) / 160) * 100}%"></i></div><span class="small muted">${s.start_class_number - 1 + s.classes_completed}/160</span></td>
          <td><select data-assign="${s.id}"><option value="">— sin asignar —</option>${teachers.map((t) => `<option value="${t.id}" ${t.id === s.teacher_id ? "selected" : ""}>${M.esc(t.full_name)}</option>`).join("")}</select></td>
          <td><b style="font-size:1.2rem">${s.remaining.classes_remaining}</b> <span class="muted small">de ${s.remaining.classes_purchased}</span></td>
          <td><button class="btn sm" data-pkg="${s.id}">+ Paquete</button></td></tr>`).join("")}</tbody></table></div></div>
        <h2>Paquetes comprados</h2>
        <div class="panel"><div class="table-wrap"><table><thead><tr><th>Estudiante</th><th>Paquete</th><th>Usadas</th><th>Restantes</th><th>Compra</th><th>Vence</th><th>Pago</th><th>Próx. cobro (Zoho)</th></tr></thead><tbody>
        ${pk.map((p) => `<tr><td>${M.esc((st.find((s) => s.id === p.student_id) || {}).full_name)}</td><td>${M.esc(p.package_code)} · ${p.classes_total} clases${p.amount_cop ? `<br><span class="muted small">${M.cop(p.amount_cop)}</span>` : ""}</td><td>${p.classes_used}</td><td><b>${p.classes_remaining}</b></td>
          <td>${M.fmtDate(p.purchase_date)}</td><td>${p.expiry_date ? M.fmtDate(p.expiry_date) : "—"}</td><td><select data-pay="${p.id}" style="min-width:120px">${Object.entries(M.PAY_LABEL).map(([k, v]) => `<option value="${k}" ${k === p.payment_status ? "selected" : ""}>${v}</option>`).join("")}</select>
          ${p.usable ? "" : `<br><span class="small" style="color:var(--warn)">No usable: ${p.payment_status === "pending" ? "pago pendiente" : p.payment_status === "refunded" || p.payment_status === "cancelled" ? "anulado" : "vencido"}</span>`}</td>
          <td>${p.next_billing_date ? M.fmtDate(p.next_billing_date) : '<span class="muted">—</span>'}</td></tr>`).join("") || '<tr><td colspan="8" class="muted">Sin paquetes</td></tr>'}</tbody></table></div></div>`;
      bindSw();
      M.$$("[data-assign]").forEach((s) => (s.onchange = M.wrapErr(async () => { await api.assignTeacher(s.dataset.assign, s.value); M.toast("Teacher asignado"); render(); })));
      M.$$("[data-pay]").forEach((el) => (el.onchange = M.wrapErr(async () => { await api.setPaymentStatus(el.dataset.pay, el.value); M.toast("Estado de pago actualizado"); render(); })));
      M.$$("[data-pkg]").forEach((b) => (b.onclick = () => addPackage(st.find((s) => s.id === b.dataset.pkg))));
    },
    async asistencia() {
      const now = new Date(), from = new Date(now.getTime() - 14 * 864e5), to = new Date(now.getTime() + 1 * 864e5);
      const cls = await api.listClasses({ from: from.toISOString(), to: to.toISOString() });
      const pend = cls.filter((c) => c.status === "scheduled" && new Date(c.starts_at) <= to).reverse();
      const done = cls.filter((c) => c.status !== "scheduled").reverse();
      const rowP = (c) => `<div class="cls"><div><b>${M.esc(c.student_name)}</b> · ${M.esc(c.title)} ${M.tagType(c.class_type)}<br><span class="muted small">${M.fmtDateTime(c.starts_at)} · ${M.esc(c.teacher_name)}</span></div>
        <div><button class="btn ok sm" data-a="present" data-id="${c.id}">Presente</button> <button class="btn ghost sm" data-a="late" data-id="${c.id}">Tarde</button>
        <button class="btn ghost sm" data-a="absent" data-id="${c.id}">No asistió</button> <button class="btn red sm" data-a="cancel" data-id="${c.id}">Cancelar (a cargo del estudiante)</button>
        <button class="btn ghost sm" data-a="cancel-free" data-id="${c.id}">Cancelar sin cargo (causa MEC/teacher)</button></div></div>`;
      app.innerHTML = `<h1>Asistencia</h1><div class="panel rune"><h3>Pendientes de marcar (hasta hoy)</h3>${pend.map(rowP).join("") || '<p class="muted">Nada pendiente.</p>'}</div>
        <div class="panel"><h3>Últimos 14 días</h3><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Estudiante</th><th>Clase</th><th>Teacher</th><th>Estado</th></tr></thead><tbody>
        ${done.map((c) => `<tr><td>${M.fmtDateTime(c.starts_at)}</td><td>${M.esc(c.student_name)}</td><td>${M.esc(c.title)}</td><td>${M.esc(c.teacher_name)}</td><td>${M.tagStatus(c.status)}${c.late_penalty && c.late_penalty !== "none" ? `<br><span class="small muted">${M.PENALTY_LABEL[c.late_penalty]}</span>` : ""}</td></tr>`).join("")}</tbody></table></div>
        <p class="muted small">Presente/Tarde completa la clase y descuenta 1 del paquete pagado. "No asistió" o cancelación con menos de 12 h: usa un pase libre del estudiante (2 cada 4 meses); sin pases, descuenta la clase.</p></div>`;
      M.$$("[data-a]").forEach((b) => (b.onclick = M.wrapErr(async () => {
        if (b.dataset.a.startsWith("cancel")) { const r = await api.cancelClass(b.dataset.id, null, b.dataset.a === "cancel"); M.toast("Cancelada · " + M.PENALTY_LABEL[r]); }
        else { await api.markAttendance(b.dataset.id, b.dataset.a); M.toast("Guardado"); }
        render();
      })));
    },
    async paquetes() {
      const [p, cfg] = await Promise.all([api.listPackages(), api.settings()]);
      const KIND = { personalizada: "Personalizadas", grupal: "Grupales", combinado: "Combinado", suelta: "Clase suelta" };
      app.innerHTML = `<h1>Catálogo de paquetes</h1><div class="panel"><div class="table-wrap"><table><thead><tr><th>Código</th><th>Nombre (Zoho)</th><th>Tipo</th><th>Clases</th><th>Precio (COP, IVA incluido)</th><th>Por clase</th><th>Vigencia</th></tr></thead><tbody>
        ${p.map((x) => `<tr><td><b>${M.esc(x.code)}</b></td><td>${M.esc(x.name)}</td><td>${KIND[x.kind] || ""}</td><td>${x.kind === "combinado" ? `${x.personal_classes} pers. + ${x.group_classes} grup.` : x.classes}</td>
          <td><b>${M.cop(x.price_cop)}</b>${x.list_price_cop ? ` <s class="muted small">${M.cop(x.list_price_cop)}</s>` : ""}</td><td>${M.cop(Math.round(x.price_cop / x.classes))}</td><td>${x.validity_months === 12 ? "1 año" : "6 meses"}</td></tr>`).join("")}
        </tbody></table></div><p class="muted small">Tabla oficial v3. Vigencia: 20 clases o menos, 6 meses; más de 20, 1 año. Los paquetes grupales y combinados existen, aunque el modelo de grupos sigue desactivado. El catálogo antiguo en USD está desactivado y solo se conserva en el historial. La facturación real vive en Zoho.</p></div>
        <h2>Política de cancelación</h2><div class="panel"><div class="row">
          <div><label>Pases libres por estudiante y periodo</label><input id="fp" type="number" min="0" max="20" value="${cfg.free_passes_per_period}"></div>
          <div><label>Duración del periodo (meses)</label><input id="pm" type="number" min="1" max="24" value="${cfg.pass_period_months}"></div>
          <div><label>Horas mínimas para cancelar sin cargo</label><input id="lh" type="number" min="1" max="72" value="${cfg.late_cancel_hours}"></div>
          <div><label>Anticipación mínima para solicitar (h)</label><input id="mh" type="number" min="0" max="168" value="${cfg.min_request_hours}"></div>
          <div style="flex:0 0 auto"><button class="btn" id="cs">Guardar</button></div></div>
          <p class="muted small">Los pases son por estudiante, no se acumulan y se renuevan cada periodo móvil contado desde su primer paquete. Solo un paquete con pago "Pendiente" (nuevo, sin pagar) queda bloqueado; parcial y vencido se pueden usar.</p></div>`;
      M.$("#cs").onclick = M.wrapErr(async () => { await api.setSetting("free_passes_per_period", M.$("#fp").value); await api.setSetting("pass_period_months", M.$("#pm").value); await api.setSetting("late_cancel_hours", M.$("#lh").value);
        await api.setSetting("min_request_hours", M.$("#mh").value); M.toast("Configuración guardada"); });
    },
    async teachers() {
      const [t, tp] = await Promise.all([api.listTeachers(), api.listTeacherProfiles()]);
      app.innerHTML = `<h1>Teachers</h1>` + t.map((x) => { const pf = tp.find((p) => p.teacher_id === x.id); return `<div class="panel"><h3>${M.esc(x.full_name)}</h3>
        <p>Perfil público: ${!pf ? '<span class="tag">Sin perfil</span>' : pf.published ? '<span class="tag r-approved">Publicado</span>' : '<span class="tag r-pending">Sin publicar</span>'}
        <button class="btn sm" data-tpedit="${x.id}">${pf ? "Editar perfil" : "Crear perfil"}</button></p>
        <label>Enlace fijo de Google Meet</label><div class="row"><input value="${M.esc(x.meet_url || "")}" data-meet="${x.id}" placeholder="https://meet.google.com/xxx-xxxx-xxx"><button class="btn" style="flex:0 0 auto" data-save="${x.id}">Guardar</button></div>
        <p class="muted small" style="margin-top:8px">Disponibilidad: ${(x.availability || []).map(([d, a, b]) => `${M.DOW[d]} ${a}:00–${b}:00`).join(" · ") || "sin registrar (se permite cualquier bloque del horario general)"}</p></div>`; }).join("");
      M.$$("[data-tpedit]").forEach((b) => (b.onclick = M.wrapErr(async () => { const x = t.find((y) => y.id === b.dataset.tpedit);
        M.perfil.editTeacher(x.id, x.full_name, { admin: true, onSaved: render }); })));
      M.$$("[data-save]").forEach((b) => (b.onclick = M.wrapErr(async () => {
        const v = M.$(`[data-meet="${b.dataset.save}"]`).value.trim();
        if (v && !/^https:\/\/meet\.google\.com\//.test(v)) throw new Error("El enlace debe empezar por https://meet.google.com/");
        await api.setTeacherMeet(b.dataset.save, v || null); M.toast("Enlace guardado");
      })));
    }
  };

  function newClass(slot, teachers, students) {
    M.modal(`<h2>Agendar clase</h2><p class="muted">${M.fmtDateTime(slot)}</p>
      <label>Estudiante</label><select id="ns">${students.map((s) => `<option value="${s.id}">${M.esc(s.full_name)} · próxima #${s.remaining.next_class_number}</option>`).join("")}</select>
      <label>Teacher</label><select id="nt">${teachers.map((t) => `<option value="${t.id}" ${t.id === teacherFilter ? "selected" : ""}>${M.esc(t.full_name)}</option>`).join("")}</select>
      <label>Tipo</label><select id="nk"><option value="program">Clase del programa (cuenta en las 160)</option><option value="extra">Sesión de refuerzo extra (fuera de las 160)</option></select>
      <label>Número de clase (1-160)</label><input id="nn" type="number" min="1" max="160">
      <p class="small muted" id="ninfo"></p>
      <label>Enlace Meet (opcional, si no: el fijo del teacher)</label><input id="nm" placeholder="https://meet.google.com/...">
      <p style="margin-top:16px"><button class="btn" id="ok">Agendar</button> <button class="btn ghost" onclick="MEC.closeModal()">Cancelar</button></p>`, () => {
      const sync = () => { const s = students.find((x) => x.id === M.$("#ns").value); if (s.teacher_id && !teacherFilter) M.$("#nt").value = s.teacher_id;
        if (!M.$("#nn").dataset.touched) M.$("#nn").value = s.remaining.next_class_number; info(); };
      const info = () => { const ex = M.$("#nk").value === "extra"; M.$("#nn").disabled = ex; const s = students.find((x) => x.id === M.$("#ns").value);
        M.$("#ninfo").textContent = ex ? "No suma al contador de 160 ni descuenta del paquete." : M.classInfo(+M.$("#nn").value, s.program).title || ""; };
      M.$("#ns").onchange = () => { delete M.$("#nn").dataset.touched; sync(); }; M.$("#nk").onchange = info; M.$("#nn").oninput = () => { M.$("#nn").dataset.touched = 1; info(); };
      sync();
      M.$("#ok").onclick = M.wrapErr(async () => {
        await api.createClass({ starts_at: slot, student_id: M.$("#ns").value, teacher_id: M.$("#nt").value, class_number: M.$("#nk").value === "extra" ? null : M.$("#nn").value, meet_url: M.$("#nm").value.trim() || null });
        M.closeModal(); M.toast("Clase agendada"); render();
      });
    });
  }
  function classDetail(c) {
    M.modal(`<h2>${M.esc(c.title)}</h2><p>${M.tagType(c.class_type)} ${M.tagStatus(c.status)}</p>
      <p><b>${M.esc(c.student_name)}</b> con ${M.esc(c.teacher_name)}<br>${M.fmtDateTime(c.starts_at)}<br>Meet: ${c.meet_url ? `<a href="${M.esc(c.meet_url)}" target="_blank" rel="noopener">${M.esc(c.meet_url)}</a>` : "—"}</p>
      ${c.sentences ? `<h3>My sentences today</h3><ul class="sentences">${c.sentences.map((s) => `<li>${M.esc(s)}</li>`).join("")}</ul>` : ""}
      <p style="margin-top:16px">${c.status === "scheduled" ? `<button class="btn ok" data-s="present">Presente</button> <button class="btn ghost" data-s="absent">No asistió</button> <button class="btn red" data-s="cancel">Cancelar clase</button>` : ""}
      <button class="btn ghost" onclick="MEC.closeModal()">Cerrar</button></p>`, (m) => {
      M.$$("[data-s]", m).forEach((b) => (b.onclick = M.wrapErr(async () => {
        if (b.dataset.s === "cancel") M.toast("Cancelada · " + M.PENALTY_LABEL[await api.cancelClass(c.id, null, true)]); else await api.markAttendance(c.id, b.dataset.s);
        M.closeModal(); M.toast("Guardado"); render();
      })));
    });
  }
  async function addPackage(s) {
    const cat = await api.listPackages(), today = new Date().toISOString().slice(0, 10);
    M.modal(`<h2>Nuevo paquete · ${M.esc(s.full_name)}</h2>
      <label>Paquete</label><select id="pc">${cat.map((p) => `<option value="${p.code}">${M.esc(p.name)} · ${M.cop(p.price_cop)}</option>`).join("")}</select>
      <div class="row"><div><label>Fecha de compra</label><input id="pd" type="date" value="${today}"></div><div><label>Vence</label><input id="pe" type="date"></div></div>
      <p class="muted small" id="pv"></p>
      <label>Estado de pago</label><select id="ps">${Object.entries(M.PAY_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <p class="muted small">La factura se emite en Zoho; aquí solo se registra el paquete y su estado.</p>
      <p><button class="btn" id="ok">Guardar</button> <button class="btn ghost" onclick="MEC.closeModal()">Cancelar</button></p>`, () => {
      const vig = () => { const pk = cat.find((p) => p.code === M.$("#pc").value), e = M.packageExpiry(M.$("#pd").value, pk);
        M.$("#pe").value = e || ""; M.$("#pv").textContent = pk ? `Vigencia ${pk.validity_months === 12 ? "1 año" : "6 meses"} (puedes ajustar la fecha).` : ""; };
      M.$("#pc").onchange = vig; M.$("#pd").onchange = vig; vig();
      M.$("#ok").onclick = M.wrapErr(async () => {
        await api.addStudentPackage({ student_id: s.id, package_code: M.$("#pc").value, purchase_date: M.$("#pd").value, expiry_date: M.$("#pe").value || null, payment_status: M.$("#ps").value });
        M.closeModal(); M.toast("Paquete registrado"); render();
      });
    });
  }
  render();
})();
