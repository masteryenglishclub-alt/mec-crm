/* MEC CRM – portal Admin */
(async () => {
  const M = MEC, api = M.api, app = M.$("#app");
  const me = await M.requireRole("admin");
  let tab = "agenda", week = M.weekStart(new Date()), teacherFilter = "", reqStatus = "pending", estMode = "perfiles";
  if (location.hash === "#solicitudes") tab = "solicitudes";
  else if (["#noticias", "#moderacion"].includes(location.hash)) tab = location.hash.slice(1);
  M.header(me, [["agenda", "Agenda"], ["solicitudes", "Solicitud de clases"], ["estudiantes", "Estudiantes"], ["asistencia", "Asistencia"], ["paquetes", "Paquetes"], ["teachers", "Teachers"], ["noticias", "Noticias"], ["moderacion", "Moderación"], ["kids", "Material Kids"], ["cargar", "Cargar datos"]], (t) => { tab = t; render(); });
  const render = M.wrapErr(async () => { app.innerHTML = '<p class="muted">Cargando…</p>'; await views[tab](); });

  const views = {
    async kids() { await M.kidsMaterialView(app); },
    async noticias() { await M.noticias.admin(app); },
    async moderacion() { await M.espacio.adminModeration(app); },
    async cargar() { await cargarView(); },
    async agenda() {
      const to = new Date(week.getTime() + 7 * 864e5);
      const [cls, teachers, students, tps] = await Promise.all([api.listClasses({ from: week.toISOString(), to: to.toISOString() }), api.listTeachers(), api.listStudents(), api.listTeacherProfiles().catch(() => [])]);
      const colors = M.teacherColors(teachers, tps), esc = M.esc;
      const shown = cls.filter((c) => !teacherFilter || c.teacher_id === teacherFilter);
      const today = M.bog(new Date());
      const svg = M.agenda.svg;
      const prog = (c) => (students.find((x) => x.id === c.student_id) || {}).program;
      const kind = (c) => prog(c) === "kids" ? ["kids", "Kids", "star"] : c.class_type === "conversation_lab" ? ["conv", "Conversación", "conv"]
        : c.class_type === "extra_reinforcement" ? ["grp", "Refuerzo", "grp"] : ["gen", "Inglés General", "one"];
      const n = cls.filter((c) => { const q = M.bog(c.starts_at); return q.y === today.y && q.m === today.m && q.d === today.d && c.status !== "cancelled"; }).length;
      app.innerHTML = M.agenda.render({ week, teachers, colors, filter: teacherFilter,
        pergamino: n ? `Hoy: ${n} clase${n === 1 ? "" : "s"} agendada${n === 1 ? "" : "s"}` : "Hoy: sin clases agendadas",
        blocks: shown.map((c) => { const k = kind(c); return { id: c.id, starts_at: c.starts_at, kind: k[0], icon: k[2], title: k[1], status: c.status, teacher_id: c.teacher_id, teacher_name: c.teacher_name,
          sub: `(${c.class_type === "extra_reinforcement" ? "extra" : "1 a 1"}) · ${esc(c.student_name)}`, tip: `${k[1]} · ${c.student_name} · ${c.teacher_name || ""} · ${M.STATUS_LABEL[c.status] || ""}` }; }),
        help: "Clic en un bloque libre para agendar · clic en una clase para ver detalles · franjas rayadas: fuera del horario (L-V 6:00-18:00, sáb 10:00-16:00). El punto de color indica el teacher." });
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
      const isT = (p) => p.is_test || (st.find((s) => s.id === p.student_id) || {}).is_test, real = st.filter((s) => !s.is_test), pkR = pk.filter((p) => !isT(p)), nT = st.length - real.length;
      app.innerHTML = `<h1>Estudiantes y paquetes</h1>${sw}
        <div class="grid g4" style="margin-bottom:18px">
          <div class="panel kpi"><b>${real.length}</b><span>Estudiantes${nT ? ` <span class="muted small">(+${nT} de prueba, no cuentan)</span>` : ""}</span></div>
          <div class="panel kpi blue"><b>${real.reduce((a, s) => a + ((s.remaining || {}).classes_remaining || 0), 0)}</b><span>Clases por dictar (pagadas/vigentes)</span></div>
          <div class="panel kpi red"><b>${real.filter((s) => !s.teacher_id).length}</b><span>Sin teacher asignado</span></div>
          <div class="panel kpi"><b>${pkR.filter((p) => p.payment_status === "pending").length}</b><span>Paquetes sin pagar (bloqueados)</span></div></div>
        <div class="panel"><div class="table-wrap"><table><thead><tr><th>Estudiante</th><th>Programa</th><th>Nivel actual</th><th>Clases completadas</th><th>Teacher</th><th>Clases restantes</th><th></th></tr></thead><tbody>
        ${st.map((s) => `<tr><td><b>${M.esc(s.full_name)}</b>${M.testBadge(s)}<br><span class="muted small">${M.esc(s.email || "")}</span></td><td>${s.program}</td>
          <td>${s.level_name ? M.esc(s.level_name) + (s.current_sublevel ? "." + s.current_sublevel : " · Repaso") : '<span class="muted">Sin nivel</span>'}<br><span class="muted small">próxima: ${M.classLabel(s.remaining.next_class_number)}</span></td>
          <td style="min-width:120px">${(() => { const d = (s.start_class_number || 1) - 1 + (s.classes_completed || 0), k = d % 32 || (d ? 32 : 0); return `<div class="bar"><i style="width:${(k / 32) * 100}%"></i></div><span class="small muted">${k}/32 del curso</span>`; })()}</td>
          <td><select data-assign="${s.id}"><option value="">— sin asignar —</option>${teachers.map((t) => `<option value="${t.id}" ${t.id === s.teacher_id ? "selected" : ""}>${M.esc(t.full_name)}</option>`).join("")}</select></td>
          <td><b style="font-size:1.2rem">${s.remaining.classes_remaining}</b> <span class="muted small">de ${s.remaining.classes_purchased}</span></td>
          <td><button class="btn sm" data-pkg="${s.id}">+ Paquete</button></td></tr>`).join("")}</tbody></table></div></div>
        <h2>Paquetes comprados</h2>
        <div class="panel"><div class="table-wrap"><table><thead><tr><th>Estudiante</th><th>Paquete</th><th>Usadas</th><th>Restantes</th><th>Compra</th><th>Vence</th><th>Pago</th><th>Próx. cobro (Zoho)</th></tr></thead><tbody>
        ${pk.map((p) => `<tr><td>${M.esc((st.find((s) => s.id === p.student_id) || {}).full_name)}${isT(p) ? M.testBadge({ is_test: true }) : ""}</td><td>${M.esc(p.package_code)} · ${p.classes_total} clases${p.amount_cop ? `<br><span class="muted small">${M.cop(p.amount_cop)}</span>` : ""}</td><td>${p.classes_used}</td><td><b>${p.classes_remaining}</b></td>
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

  /* Cargar datos: CSV con validador o formulario manual. Todo pasa por MEC.importar.validate antes de guardarse. */
  let carEnt = "estudiantes";
  async function cargarView() {
    const I = M.importar, S = I.SCHEMAS, esc = M.esc, demo = api.mode === "demo";
    const ctx = {}; for (const k of Object.keys(I.REFKEY)) ctx[k] = (await api.listImports(k)).map((r) => r[I.REFKEY[k]]);
    try { if (demo) { ctx.teachers = ctx.teachers.concat((await api.listTeachers()).map((t) => (t.email || "").toLowerCase()).filter(Boolean));
      ctx.estudiantes = ctx.estudiantes.concat((await api.listStudents()).map((s) => (s.email || "").toLowerCase()).filter(Boolean)); } } catch (e) { /* sin listas */ }
    const staged = await api.listImports(carEnt), f = S[carEnt].fields;
    app.innerHTML = `<h1>Cargar datos</h1><p class="muted">Sube un CSV o agrega filas a mano. Nada se guarda si el validador encuentra errores.${demo ? " Modo demo: se guarda solo en la zona de carga local del navegador." : " <b>La carga a producción aún no está habilitada</b>: puedes validar y descargar el CSV limpio."}</p>
      <div class="panel"><label for="car-e">Tipo de datos</label><select id="car-e">${Object.entries(S).map(([k, v]) => `<option value="${k}" ${k === carEnt ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select>
        <p class="small">Columnas: <code>${f.map((x) => esc(x.key) + (x.req ? "*" : "")).join(", ")}</code> · <a href="#" id="car-tpl">Descargar plantilla CSV</a></p></div>
      <div class="panel"><h2>Desde CSV</h2><input type="file" id="car-f" accept=".csv,text/csv"><label for="car-t">…o pega el CSV</label><textarea id="car-t" rows="5" placeholder="${esc(I.template(carEnt).trim())}"></textarea>
        <p><button class="btn" id="car-v">Validar</button> <button class="btn ok" id="car-ok" disabled>Guardar filas válidas</button> <button class="btn ghost" id="car-dl" disabled>Descargar CSV validado</button></p><div id="car-r" aria-live="polite"></div></div>
      <div class="panel"><h2>Manual</h2><form id="car-m" novalidate><div class="row" style="flex-wrap:wrap">${f.map((x) => `<div style="flex:1 1 220px"><label for="cm-${x.key}">${esc(x.label)}${x.req ? " *" : ""}</label>${x.enum ? `<select id="cm-${x.key}" name="${x.key}"><option value="">—</option>${x.enum.map((o) => `<option>${esc(o)}</option>`).join("")}</select>` : `<input id="cm-${x.key}" name="${x.key}" ${x.type === "date" ? 'type="date"' : x.type === "int" ? 'inputmode="numeric"' : ""} ${x.max ? `maxlength="${x.max}"` : ""}>`}</div>`).join("")}</div>
        <p><button class="btn" type="submit">Validar y agregar</button></p><div id="car-mr" aria-live="polite"></div></form></div>
      <div class="panel"><h2>Zona de carga · ${esc(S[carEnt].label)} (${staged.length})</h2>${staged.length ? `<div class="sol-tw"><table class="tbl"><tr>${f.map((x) => `<th>${esc(x.key)}</th>`).join("")}</tr>${staged.map((r) => `<tr>${f.map((x) => `<td>${esc(r[x.key] == null ? "" : r[x.key])}</td>`).join("")}</tr>`).join("")}</table></div><p><button class="btn ghost" id="car-clr">Vaciar zona de carga</button></p>` : '<p class="muted">Sin filas cargadas.</p>'}</div>`;
    let last = null;
    const report = (el, v) => { el.innerHTML = v.errors.length ? `<div class="alert err"><b>${v.errors.length} error(es). No se guardó nada.</b><ul>${v.errors.slice(0, 50).map((e) => `<li>${e.row ? "Fila " + e.row : "Encabezado"}${e.field ? " · " + esc(e.field) : ""}: ${esc(e.msg)}</li>`).join("")}</ul></div>` : `<div class="alert ok">${v.rows.length} fila(s) válidas.</div>`; };
    const dl = (name, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\uFEFF" + text], { type: "text/csv" })); a.download = name; a.click(); };
    const toCsv = (rows) => I.template(carEnt) + rows.map((r) => f.map((x) => { const v = r[x.key] == null ? "" : String(r[x.key]); return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(",")).join("\n") + "\n";
    M.$("#car-e").onchange = (e) => { carEnt = e.target.value; render(); };
    M.$("#car-tpl").onclick = (e) => { e.preventDefault(); dl(`plantilla-${carEnt}.csv`, I.template(carEnt)); };
    M.$("#car-f").onchange = async (e) => { const file = e.target.files[0]; if (!file) return; if (file.size > 2e6) return M.toast("Archivo demasiado grande (máx. 2 MB)"); M.$("#car-t").value = await file.text(); };
    M.$("#car-v").onclick = () => { last = I.validate(carEnt, I.parseCSV(M.$("#car-t").value), ctx); report(M.$("#car-r"), last); M.$("#car-ok").disabled = !last.ok || !demo; M.$("#car-dl").disabled = !last.ok; };
    M.$("#car-dl").onclick = () => last && last.ok && dl(`${carEnt}-validado.csv`, toCsv(last.rows));
    M.$("#car-ok").onclick = M.wrapErr(async () => { if (!last || !last.ok) return; const n = await api.saveImport(carEnt, last.rows); M.toast(n + " fila(s) guardadas en la zona de carga"); render(); });
    M.$("#car-m").onsubmit = M.wrapErr(async (e) => { e.preventDefault(); const raw = {}; f.forEach((x) => (raw[x.key] = M.$("#cm-" + x.key).value));
      const v = I.validate(carEnt, [raw], ctx); report(M.$("#car-mr"), v); if (!v.ok) return; await api.saveImport(carEnt, v.rows); M.toast("Fila agregada"); render(); });
    const clr = M.$("#car-clr"); if (clr) clr.onclick = M.wrapErr(async () => { await api.clearImports(carEnt); render(); });
  }
  function newClass(slot, teachers, students) {
    M.modal(`<h2>Agendar clase</h2><p class="muted">${M.fmtDateTime(slot)}</p>
      <label>Estudiante</label><select id="ns">${students.map((s) => `<option value="${s.id}">${M.esc(s.full_name)} · próxima: ${M.classLabel(s.remaining.next_class_number)}</option>`).join("")}</select>
      <label>Teacher</label><select id="nt">${teachers.map((t) => `<option value="${t.id}" ${t.id === teacherFilter ? "selected" : ""}>${M.esc(t.full_name)}</option>`).join("")}</select>
      <label>Tipo</label><select id="nk"><option value="program">Clase del curso (cuenta en las 32 del nivel)</option><option value="extra">Sesión de refuerzo extra (no cuenta en el curso)</option></select>
      <label>Número interno de clase (1-160; se muestra como clase 1-32 del curso de nivel)</label><input id="nn" type="number" min="1" max="160">
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
