/* MEC CRM – portal Admin */
(async () => {
  const M = MEC, api = M.api, app = M.$("#app");
  const me = await M.requireRole("admin");
  let tab = "agenda", week = M.weekStart(new Date()), teacherFilter = "";
  if (location.hash === "#solicitudes") tab = "solicitudes";
  M.header(me, [["agenda", "Agenda"], ["solicitudes", "Solicitudes"], ["estudiantes", "Estudiantes"], ["asistencia", "Asistencia"], ["paquetes", "Paquetes"], ["teachers", "Teachers"]], (t) => { tab = t; render(); });
  const render = M.wrapErr(async () => { app.innerHTML = '<p class="muted">Cargando…</p>'; await views[tab](); });

  const views = {
    async agenda() {
      const to = new Date(week.getTime() + 7 * 864e5);
      const [cls, teachers, students] = await Promise.all([api.listClasses({ from: week.toISOString(), to: to.toISOString() }), api.listTeachers(), api.listStudents()]);
      const shown = cls.filter((c) => !teacherFilter || c.teacher_id === teacherFilter);
      const days = [1, 2, 3, 4, 5, 6].map((i) => new Date(week.getTime() + (i - 1) * 864e5));
      let g = '<div class="hd">Hora</div>' + days.map((d) => `<div class="hd">${M.DOW[M.bog(d).dow]} ${M.bog(d).d}/${M.bog(d).m}</div>`).join("");
      for (let h = 6; h < 18; h++) {
        g += `<div class="hr">${String(h).padStart(2, "0")}:00</div>`;
        days.forEach((d) => {
          const p = M.bog(d), slot = M.bogDate(p.y, p.m, p.d, h);
          const evs = shown.filter((c) => new Date(c.starts_at).getTime() === slot.getTime());
          const valid = M.isValidSlot(slot);
          g += `<div class="${valid ? "free" : "off"}" data-slot="${valid ? slot.toISOString() : ""}">` + evs.map((c) =>
            `<div class="ev ${c.status} ${c.class_type === "conversation_lab" ? "lab" : ""} ${c.class_type === "extra_reinforcement" ? "extra" : ""}" data-id="${c.id}">
              <b>${M.esc(c.student_name)}</b><br>${c.class_number ? "#" + c.class_number + " · " : ""}${M.esc(M.TYPE_LABEL[c.class_type])}<br><span class="muted">${M.esc((c.teacher_name || "").replace("Teacher Demo ", "T. "))}</span></div>`).join("") + "</div>";
        });
      }
      const wEnd = new Date(week.getTime() + 5 * 864e5);
      app.innerHTML = `<h1>Agenda semanal</h1>
        <div class="panel"><div class="row">
          <div style="flex:0 0 auto"><button class="btn ghost sm" id="prev">◀ Semana anterior</button> <button class="btn ghost sm" id="today">Hoy</button> <button class="btn ghost sm" id="next">Semana siguiente ▶</button></div>
          <div><b>${M.fmtDate(week)} – ${M.fmtDate(wEnd)}</b> <span class="muted small">· hora Bogotá (UTC-5) · bloques de 60 min (55 + 5)</span></div>
          <div style="flex:0 0 240px"><select id="tf"><option value="">Todos los teachers</option>${teachers.map((t) => `<option value="${t.id}" ${t.id === teacherFilter ? "selected" : ""}>${M.esc(t.full_name)}</option>`).join("")}</select></div>
        </div></div>
        <div class="table-wrap"><div class="sched">${g}</div></div>
        <p class="muted small">Clic en un bloque libre para agendar · clic en una clase para ver detalles. Franjas rayadas = fuera del horario (L-V 6:00-18:00, sáb 10:00-16:00).</p>`;
      M.$("#prev").onclick = () => { week = new Date(week.getTime() - 7 * 864e5); render(); };
      M.$("#next").onclick = () => { week = new Date(week.getTime() + 7 * 864e5); render(); };
      M.$("#today").onclick = () => { week = M.weekStart(new Date()); render(); };
      M.$("#tf").onchange = (e) => { teacherFilter = e.target.value; render(); };
      M.$$(".sched .free").forEach((cell) => (cell.onclick = (e) => { if (e.target.closest(".ev")) return; newClass(cell.dataset.slot, teachers, students); }));
      M.$$(".ev").forEach((el) => (el.onclick = () => classDetail(cls.find((c) => c.id === el.dataset.id))));
    },
    async solicitudes() {
      const [reqs, teachers] = await Promise.all([api.listRequests(), api.listTeachers()]);
      const shown = reqs.filter((r) => !teacherFilter || r.teacher_id === teacherFilter);
      app.innerHTML = `<h1>Solicitudes de clase</h1>
        <div class="panel"><div class="row"><div class="muted">Un calendario por teacher. Las solicitudes pendientes no bloquean el bloque; al aprobar se vuelve a verificar todo.</div>
        <div style="flex:0 0 240px"><select id="tf"><option value="">Todos los teachers</option>${teachers.map((t) => `<option value="${t.id}" ${t.id === teacherFilter ? "selected" : ""}>${M.esc(t.full_name)} (${reqs.filter((r) => r.teacher_id === t.id && r.status === "pending").length})</option>`).join("")}</select></div></div></div>
        ${M.requestsView(shown, { showTeacher: true })}`;
      M.$("#tf").onchange = (e) => { teacherFilter = e.target.value; render(); };
      M.bindRequests(api, render);
    },
    async estudiantes() {
      const [st, teachers, pk] = await Promise.all([api.listStudents(), api.listTeachers(), api.listStudentPackages()]);
      app.innerHTML = `<h1>Estudiantes y paquetes</h1>
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
        ${pk.map((p) => `<tr><td>${M.esc((st.find((s) => s.id === p.student_id) || {}).full_name)}</td><td>${p.package_code} · ${p.classes_total} clases</td><td>${p.classes_used}</td><td><b>${p.classes_remaining}</b></td>
          <td>${M.fmtDate(p.purchase_date)}</td><td>${p.expiry_date ? M.fmtDate(p.expiry_date) : "—"}</td><td><select data-pay="${p.id}" style="min-width:120px">${Object.entries(M.PAY_LABEL).map(([k, v]) => `<option value="${k}" ${k === p.payment_status ? "selected" : ""}>${v}</option>`).join("")}</select>
          ${p.usable ? "" : `<br><span class="small" style="color:var(--warn)">No usable: ${p.payment_status === "pending" ? "pago pendiente" : p.payment_status === "refunded" || p.payment_status === "cancelled" ? "anulado" : "vencido"}</span>`}</td>
          <td>${p.next_billing_date ? M.fmtDate(p.next_billing_date) : '<span class="muted">—</span>'}</td></tr>`).join("") || '<tr><td colspan="8" class="muted">Sin paquetes</td></tr>'}</tbody></table></div></div>`;
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
      app.innerHTML = `<h1>Catálogo de paquetes</h1><div class="panel"><div class="table-wrap"><table><thead><tr><th>Paquete</th><th>Clases</th><th>Lista (USD)</th><th>Descuento</th><th>Total (USD)</th><th>Por clase</th><th>Ahorro</th></tr></thead><tbody>
        ${p.map((x) => `<tr><td><b>${x.code}</b></td><td>${x.classes}</td><td>${(+x.list_usd).toFixed(2)}</td><td>${+x.discount_pct}%</td><td><b>${(+x.total_usd).toFixed(2)}</b></td><td>${(x.total_usd / x.classes).toFixed(2)}</td><td>${(x.list_usd - x.total_usd).toFixed(2)}</td></tr>`).join("")}
        </tbody></table></div><p class="muted small">Base 30 USD/clase. Escala aprobada 5/12/19/26/33/40 %. La facturación real vive en Zoho (ver ZOHO_SYNC.md).</p></div>
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
      const t = await api.listTeachers();
      app.innerHTML = `<h1>Teachers</h1>` + t.map((x) => `<div class="panel"><h3>${M.esc(x.full_name)}</h3>
        <label>Enlace fijo de Google Meet</label><div class="row"><input value="${M.esc(x.meet_url || "")}" data-meet="${x.id}" placeholder="https://meet.google.com/xxx-xxxx-xxx"><button class="btn" style="flex:0 0 auto" data-save="${x.id}">Guardar</button></div>
        <p class="muted small" style="margin-top:8px">Disponibilidad: ${(x.availability || []).map(([d, a, b]) => `${M.DOW[d]} ${a}:00–${b}:00`).join(" · ") || "sin registrar (se permite cualquier bloque del horario general)"}</p></div>`).join("");
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
      <label>Paquete</label><select id="pc">${cat.map((p) => `<option value="${p.code}">${p.code} · ${p.classes} clases · US$${(+p.total_usd).toFixed(2)}</option>`).join("")}</select>
      <div class="row"><div><label>Fecha de compra</label><input id="pd" type="date" value="${today}"></div><div><label>Vence</label><input id="pe" type="date"></div></div>
      <label>Estado de pago</label><select id="ps">${Object.entries(M.PAY_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <p class="muted small">La factura se emite en Zoho; aquí solo se registra el paquete y su estado.</p>
      <p><button class="btn" id="ok">Guardar</button> <button class="btn ghost" onclick="MEC.closeModal()">Cancelar</button></p>`, () => {
      M.$("#ok").onclick = M.wrapErr(async () => {
        await api.addStudentPackage({ student_id: s.id, package_code: M.$("#pc").value, purchase_date: M.$("#pd").value, expiry_date: M.$("#pe").value || null, payment_status: M.$("#ps").value });
        M.closeModal(); M.toast("Paquete registrado"); render();
      });
    });
  }
  render();
})();
