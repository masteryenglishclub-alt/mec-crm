/* MEC CRM – portal Teacher */
(async () => {
  const M = MEC, api = M.api, app = M.$("#app");
  const me = await M.requireRole("teacher");
  let tab = "clases";
  if (location.hash === "#solicitudes") tab = "solicitudes";
  else if (location.hash === "#espacio") tab = "espacio";
  else if (location.hash === "#noticias") tab = "noticias";
  else if (location.hash === "#disponibilidad") tab = "disponibilidad";
  M.header(me, [["clases", "Mis clases"], ["disponibilidad", "Mi disponibilidad"], ["solicitudes", "Solicitudes"], ["noticias", "Noticias y eventos"], ["espacio", "Mi espacio"], ["estudiantes", "Estudiantes"], ["tests", "Tests"], ["progreso", "Progreso mensual"], ["miperfil", "Mi perfil"], ["perfil", "Mi Meet"], ["kids", "Material Kids"]], (t) => { tab = t; render(); });
  if (M.espacio && M.espacio.watch) M.espacio.watch();
  const render = M.wrapErr(async () => { app.innerHTML = '<p class="muted">Cargando…</p>'; await views[tab](); });
  // Regla de decisión oficial (Rúbrica Conversacional v2.1, sección 4) solo para la vista previa; la base de datos decide.
  const decide = (s, kind) => {
    const v = ["fluency", "vocabulary", "grammar", "pronunciation", "comprehension_interaction", "task_completion"].map((k) => +s[k]);
    const total = v.reduce((a, b) => a + b, 0), ones = v.filter((x) => x === 1).length;
    if (total <= 12 || ones >= 2) return "repite";
    if (kind === "mini_conversation_lab") return total >= 17 && ones === 0 ? "sube" : "repite";
    return total >= 17 && ones === 0 && +s.task_completion >= 3 ? "sube" : "refuerzo";
  };

  const card = (c) => `<div class="cls"><div>
      <b>${M.esc(c.student_name)}</b> · ${M.esc(c.title)} ${M.tagType(c.class_type)} ${M.tagStatus(c.status)}<br>
      <span class="muted small">${M.fmtDateTime(c.starts_at)}</span>
      ${c.meet_url ? ` · <a class="small" href="${M.esc(c.meet_url)}" target="_blank" rel="noopener">Abrir Meet</a>` : ""}
      ${c.sentences ? `<ul class="sentences small">${c.sentences.map((s) => `<li>${M.esc(s)}</li>`).join("")}</ul>` : ""}</div>
    <div>${c.status === "scheduled" ? `<button class="btn ok sm" data-att="present" data-id="${c.id}">Presente</button> <button class="btn ghost sm" data-att="late" data-id="${c.id}">Tarde</button> <button class="btn ghost sm" data-att="absent" data-id="${c.id}">No asistió</button> ` : ""}
      ${c.status === "completed" ? `<button class="btn sm" data-fb="${c.id}">${c.sentences ? "Editar" : "Escribir"} feedback</button> ` : ""}
      ${c.class_type === "conversation_lab" ? `<button class="btn red sm" data-lab="${c.id}">Rúbrica (solo teacher)</button>` : ""}
      ${c.class_type === "extra_reinforcement" && c.status === "completed" ? `<button class="btn red sm" data-lab="${c.id}">Mini Conversation Lab (solo teacher)</button>` : ""}
      ${c.late_penalty && c.late_penalty !== "none" ? `<br><span class="small muted">${M.PENALTY_LABEL[c.late_penalty]}</span>` : ""}</div></div>`;

  const views = {
    async kids() { await M.kidsMaterialView(app); },
    async tests() { await M.testsStaff.panel(app, "teacher"); },
    async disponibilidad() { await M.disponibilidad.view(app, { teacherId: me.id }); },
    async espacio() { await M.espacio.teacherView(app); },
    async noticias() { await M.noticias.student(app, { teacher: true }); },
    async clases() {
      const now = new Date(), cls = await api.listClasses({ from: new Date(now.getTime() - 21 * 864e5).toISOString() });
      const today = M.bog(now), isToday = (c) => { const p = M.bog(c.starts_at); return p.y === today.y && p.m === today.m && p.d === today.d; };
      const up = cls.filter((c) => c.status === "scheduled"), past = cls.filter((c) => c.status !== "scheduled").reverse();
      app.innerHTML = `<div class="tbg gbg"><div><h1>Mis clases</h1>
        <div class="grid g3" style="margin-bottom:18px"><div class="panel kpi blue"><b>${cls.filter(isToday).length}</b><span>Hoy</span></div>
        <div class="panel kpi"><b>${up.length}</b><span>Próximas agendadas</span></div><div class="panel kpi red"><b>${past.filter((c) => c.status === "completed" && !c.sentences && c.class_type !== "extra_reinforcement").length}</b><span>Feedback pendiente</span></div></div>
        <div class="panel rune"><h3>Próximas</h3>${up.map(card).join("") || '<p class="muted">Sin clases agendadas.</p>'}</div>
        <div class="panel"><h3>Recientes (21 días)</h3>${past.map(card).join("") || '<p class="muted">—</p>'}</div></div></div>`;
      M.$$("[data-att]").forEach((b) => (b.onclick = M.wrapErr(async () => { await api.markAttendance(b.dataset.id, b.dataset.att);
        const c = (await api.listClasses({ from: new Date(Date.now() - 22 * 864e5).toISOString() })).find((x) => x.id === b.dataset.id);
        M.toast("Asistencia guardada" + (c && c.status === "no_show" ? " · " + M.PENALTY_LABEL[c.late_penalty || "none"] : "")); render(); })));
      M.$$("[data-fb]").forEach((b) => (b.onclick = () => feedback(cls.find((c) => c.id === b.dataset.fb))));
      M.$$("[data-lab]").forEach((b) => (b.onclick = () => rubric(cls.find((c) => c.id === b.dataset.lab))));
    },
    async solicitudes() {
      const reqs = await api.listRequests();
      app.innerHTML = `<h1>Solicitudes de clase</h1><p class="muted">Tus estudiantes solicitan bloques libres de tu calendario. Solo el admin aprueba o rechaza; aquí ves su estado.</p>${M.requestsView(reqs, { readOnly: true })}`;
    },
    async estudiantes() { // RLS: el teacher solo recibe a sus propios estudiantes
      const st = await api.listStudents();
      app.innerHTML = `<div class="tbg2 gbg"><div><h1>Estudiantes</h1><p class="muted">Tus estudiantes asignados. Abre un perfil para ver paquete, clases, feedback, BIO, progreso y estilo de aprendizaje.</p><div id="pf-root"></div></div></div>`;
      await M.perfil.studentsBrowser(M.$("#pf-root"), { students: st, showTeacher: false });
    },
    async progreso() {
      const [st, pr] = await Promise.all([api.listStudents(), api.listProgress()]);
      const p0 = M.bog(new Date()), month = `${p0.y}-${String(p0.m).padStart(2, "0")}`;
      app.innerHTML = `<h1>Progreso mensual</h1><div class="grid g2"><div class="panel rune"><h3>Registrar mes</h3>
        <label>Estudiante</label><select id="ps">${st.map((s) => `<option value="${s.id}">${M.esc(s.full_name)}</option>`).join("")}</select>
        <div class="row"><div><label>Mes</label><input id="pm" type="month" value="${month}"></div><div><label>Minutos hablando</label><input id="pmin" type="number" min="0" value="0"></div></div>
        <div class="row"><div><label>% del tiempo hablando</label><input id="ppct" type="number" min="0" max="100"></div><div><label>Fluidez (1-5)</label><select id="pf">${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join("")}</select></div></div>
        <label>Vocabulario nuevo (separado por comas)</label><textarea id="pv" rows="3"></textarea>
        <p style="margin-top:12px"><button class="btn" id="psave">Guardar</button></p></div>
        <div class="panel"><h3>Registros</h3><div class="table-wrap"><table><thead><tr><th>Estudiante</th><th>Mes</th><th>Min</th><th>%</th><th>Fluidez</th><th>Vocabulario</th></tr></thead><tbody>
        ${pr.map((r) => `<tr><td>${M.esc((st.find((s) => s.id === r.student_id) || {}).full_name)}</td><td>${r.month.slice(0, 7)}</td><td>${r.speaking_minutes}</td><td>${r.speaking_pct ?? "—"}</td><td>${r.fluency ?? "—"}/5</td><td class="small">${M.esc((r.new_vocabulary || []).join(", "))}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">Sin registros</td></tr>'}
        </tbody></table></div><p class="muted small">El estudiante ve sus minutos, % hablado, fluidez y vocabulario.</p></div></div>`;
      M.$("#psave").onclick = M.wrapErr(async () => {
        await api.saveProgress({ student_id: M.$("#ps").value, month: M.$("#pm").value + "-01", speaking_minutes: +M.$("#pmin").value || 0, speaking_pct: M.$("#ppct").value === "" ? null : +M.$("#ppct").value,
          fluency: +M.$("#pf").value, new_vocabulary: M.$("#pv").value.split(",").map((x) => x.trim()).filter(Boolean) });
        M.toast("Progreso guardado"); render();
      });
    },
    async miperfil() {
      app.innerHTML = `<h1>Mi perfil</h1><p class="muted">Tu perfil público lo ven los estudiantes en «Teachers» cuando el admin lo publica.</p><div id="tp-root"></div>`;
      await M.perfil.teacherForm(M.$("#tp-root"), me.id, me.full_name, { admin: false });
    },
    async perfil() {
      const [t] = await api.listTeachers();
      app.innerHTML = `<h1>Mi enlace de Meet</h1><div class="panel"><p class="muted">Se usa en todas tus clases salvo que el admin ponga uno específico para una clase.</p>
        <div class="row"><input id="mu" value="${M.esc(t.meet_url || "")}"><button class="btn" id="ms" style="flex:0 0 auto">Guardar</button></div></div>`;
      M.$("#ms").onclick = M.wrapErr(async () => { const v = M.$("#mu").value.trim(); if (!/^https:\/\/meet\.google\.com\//.test(v)) throw new Error("Debe empezar por https://meet.google.com/"); await api.setTeacherMeet(me.id, v); M.toast("Guardado"); });
    }
  };

  function feedback(c) {
    const s = c.sentences || ["", "", ""];
    M.modal(`<h2>Feedback · ${M.esc(c.student_name)}</h2><p class="muted small">${M.esc(c.title)} · ${M.fmtDateTime(c.starts_at)} · <b>visible para el estudiante</b></p>
      <label>Nota del teacher</label><textarea id="fn" rows="3">${M.esc(c.teacher_note || "")}</textarea>
      <label>My sentences today (3 a 5 frases)</label><div id="fs">${[0, 1, 2, 3, 4].map((i) => `<input style="margin-bottom:6px" placeholder="Frase ${i + 1}${i > 2 ? " (opcional)" : ""}" value="${M.esc(s[i] || "")}">`).join("")}</div>
      <p><button class="btn" id="ok">Guardar</button> <button class="btn ghost" onclick="MEC.closeModal()">Cancelar</button></p>`, () => {
      M.$("#ok").onclick = M.wrapErr(async () => {
        const arr = M.$$("#fs input").map((i) => i.value.trim()).filter(Boolean);
        if (arr.length < 3) throw new Error("Escribe al menos 3 frases");
        await api.saveFeedback(c.id, M.$("#fn").value.trim(), arr); M.closeModal(); M.toast("Feedback guardado"); render();
      });
    });
  }
  async function rubric(c) {
    const [R, prev, st] = await Promise.all([api.getRubric(), api.getAssessment(c.id), api.listStudents()]);
    const a = prev || { scores: {}, evidence: {} }, kind = c.class_type === "extra_reinforcement" ? "mini_conversation_lab" : "conversation_lab";
    const s = st.find((x) => x.id === c.student_id) || {}, lvl = c.class_number ? Math.floor((c.class_number - 1) / 32) + 1 : s.current_level || 1;
    const L = R.levels[lvl] || { guide: {} }, F = c.class_number ? R.focus[c.class_number] : null, LBL = { 4: "Destacado", 3: "Logrado", 2: "En desarrollo", 1: "Inicial" };
    const crit = R.criteria.map(([k, name, d4, d3, d2, d1]) => { const d = { 4: d4, 3: d3, 2: d2, 1: d1 }, v = a.scores[k];
      return `<div class="crit" data-c="${k}"><b>${M.esc(name)}</b><div class="sc">${[4, 3, 2, 1].map((n) => `<label class="${v == n ? "on" : ""}" title="${M.esc(d[n])}"><input type="radio" name="${k}" value="${n}" ${v == n ? "checked" : ""}>${n} – ${LBL[n]}</label>`).join("")}</div>
        <div class="desc" data-d='${M.esc(JSON.stringify(d))}'>${v ? M.esc(d[v]) : '<span class="muted">Elige un puntaje.</span>'}</div>
        <div class="lg">“3 – Logrado” en ${M.LEVELS[lvl - 1]}: ${M.esc(L.guide[k] || "")}</div>
        <input class="ev" placeholder="Evidencia observada (ejemplo breve)" value="${M.esc((a.evidence || {})[k] || "")}" style="margin-top:6px"></div>`; }).join("");
    M.modal(`<div class="teacher-only" style="padding:14px;border-radius:8px"><h3>⚑ ${kind === "mini_conversation_lab" ? "Mini Conversation Lab" : "Rúbrica Conversacional · Clase 6 Conversation Lab"} · SOLO TEACHER / ADMIN</h3>
      <p class="small">Documento confidencial: no se muestra, envía ni comenta con estudiantes ni padres (protegido en la base de datos). Para el estudiante es una práctica conversacional; con él solo se comparte el feedback, sin puntajes.</p>
      <p><b>${M.esc(c.student_name)}</b> · ${M.esc(c.title)} · ${M.fmtDateTime(c.starts_at)}</p>
      ${F ? `<p class="small"><b>${M.esc(F[0])}</b> · escenario <b>${M.esc(F[1])}</b><br>Foco de evaluación: ${M.esc(F[2])}</p>` : ""}
      <p class="small muted">Condiciones de aplicación (${M.LEVELS[lvl - 1]}): ${M.esc(L.conditions || "")}</p>
      <div class="grid g2">${crit}</div>
      <div class="panel" style="margin:10px 0"><div class="row"><div><span class="muted small">TOTAL</span><div class="decision"><span id="rt">—</span>/24</div></div>
        <div><span class="muted small">DECISIÓN (regla oficial)</span><div class="decision" id="rr">—</div></div>
        <div style="flex:2 1 300px" class="small muted">${R.rules.map(([l, cnd]) => `<div><b>${M.esc(l)}</b>: ${M.esc(cnd)}</div>`).join("")}</div></div></div>
      <div class="grid g2"><div><label>Errores recurrentes (para el feedback)</label><textarea id="re" rows="2">${M.esc(a.recurring_errors || "")}</textarea></div>
        <div><label>Plan de refuerzo (si aplica)</label><textarea id="rp" rows="2">${M.esc(a.reinforcement_plan || "")}</textarea></div></div>
      <label>Comentario interno</label><textarea id="rc" rows="2">${M.esc(a.internal_comment || "")}</textarea>
      <div class="row"><div style="flex:0 0 220px"><label>Ajuste de decisión (opcional)</label><select id="pr"><option value="">— sin ajuste —</option>${["sube", "refuerzo", "repite"].map((x) => `<option ${a.proposed_result === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div><label>Justificación escrita (la aprueba coordinación)</label><input id="pj" value="${M.esc(a.proposal_justification || "")}" placeholder="p. ej. nerviosismo evidente en un día atípico"></div></div>
      ${a.proposal_status && a.proposal_status !== "none" ? `<p class="small">Estado del ajuste: <b>${a.proposal_status}</b> · resultado final: <b>${a.final_result}</b></p>` : ""}
      <details class="small" style="margin-top:8px"><summary>Frases recomendadas / a evitar durante el Lab</summary><table><tr><th>✔ Decir</th><th>✖ Evitar</th></tr>${R.phrases.map(([x, y]) => `<tr><td>${M.esc(x)}</td><td>${M.esc(y)}</td></tr>`).join("")}</table></details>
      <p style="margin-top:12px"><button class="btn red" id="ok">Guardar evaluación interna</button> <button class="btn ghost" onclick="MEC.closeModal()">Cerrar</button></p></div>`, () => {
      const read = () => { const sc = {}; M.$$(".crit").forEach((el) => { const r = M.$("input[type=radio]:checked", el); sc[el.dataset.c] = r ? +r.value : null; }); return sc; };
      const upd = () => { const sc = read(), ok = Object.values(sc).every(Boolean);
        M.$$(".crit").forEach((el) => { const d = JSON.parse(M.$(".desc", el).dataset.d), v = sc[el.dataset.c];
          M.$(".desc", el).innerHTML = v ? M.esc(d[v]) : '<span class="muted">Elige un puntaje.</span>'; M.$$(".sc label", el).forEach((l) => l.classList.toggle("on", M.$("input", l).checked)); });
        M.$("#rt").textContent = ok ? Object.values(sc).reduce((x, y) => x + y, 0) : "—";
        const r = ok ? decide(sc, kind) : "—"; M.$("#rr").textContent = r; M.$("#rr").className = "decision " + r; };
      M.$$(".crit input[type=radio]").forEach((i) => (i.onchange = upd)); upd();
      M.$("#ok").onclick = M.wrapErr(async () => {
        const sc = read(); if (!Object.values(sc).every(Boolean)) throw new Error("Puntúa los 6 criterios (1 a 4)");
        const ev = {}; M.$$(".crit").forEach((el) => { const v = M.$(".ev", el).value.trim(); if (v) ev[el.dataset.c] = v; });
        const r = await api.saveAssessment(c.id, { scores: sc, evidence: ev, recurring_errors: M.$("#re").value.trim(), reinforcement_plan: M.$("#rp").value.trim(),
          internal_comment: M.$("#rc").value.trim(), proposed_result: M.$("#pr").value || null, proposal_justification: M.$("#pj").value.trim() || null });
        M.$("#rr").textContent = r.result; M.toast("Evaluación interna guardada · decisión: " + r.result + (r.proposal_status === "pending" ? " (ajuste pendiente de coordinación)" : ""));
      });
    }, true);
  }
  async function extra(sid) {
    const st = (await api.listStudents()).find((s) => s.id === sid);
    M.modal(`<h2>Sesión de refuerzo · ${M.esc(st.full_name)}</h2><p class="muted small">No suma al contador del curso ni descuenta del paquete.</p>
      <label>Fecha y hora (Bogotá)</label><div class="row"><input id="ed" type="date"><select id="eh">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 6}">${String(i + 6).padStart(2, "0")}:00</option>`).join("")}</select></div>
      <p><button class="btn" id="ok">Agendar</button> <button class="btn ghost" onclick="MEC.closeModal()">Cancelar</button></p>`, () => {
      M.$("#ok").onclick = M.wrapErr(async () => {
        const [y, m, d] = M.$("#ed").value.split("-").map(Number); if (!y) throw new Error("Elige una fecha");
        await api.createClass({ starts_at: M.bogDate(y, m, d, +M.$("#eh").value).toISOString(), student_id: sid, teacher_id: me.id, class_number: null });
        M.closeModal(); M.toast("Sesión de refuerzo agendada");
      });
    });
  }
  render();
})();
