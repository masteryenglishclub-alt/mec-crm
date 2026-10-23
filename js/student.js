/* MEC CRM – portal Estudiante (nunca muestra evaluaciones internas) */
(async () => {
  const M = MEC, api = M.api, app = M.$("#app");
  const me = await M.requireRole("student");
  let tab = "inicio", calFocus = null, fbSelect = null;
  let week = M.weekStart(new Date(Date.now() + 864e5 * 7)), calFilter = "";  // semana siguiente por defecto
  const TABS = [["inicio", "Inicio"], ["solicitar", "Calendario"], ["noticias", "Noticias y eventos"], ["espacio", "Mi espacio"], ["teachers", "Teachers"], ["feedback", "Feedback"], ["material", "Material"]];
  const fromHash = () => { const h = location.hash.slice(1), t = h.split("/")[0]; return TABS.some((x) => x[0] === t) ? t : null; };
  tab = fromHash() || "inicio";
  const goTab = (t) => { tab = t; M.$$("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === t)); render(); };
  window.addEventListener("hashchange", () => { const t = fromHash(); if (!t) return;
    if (t === "feedback" && tab === "feedback" && fbSelect) { const id = decodeURIComponent(location.hash.split("/")[1] || ""); if (id) return fbSelect(id); }
    if (t !== tab) goTab(t); });
  M.header(me, TABS, (t) => { tab = t; if (location.hash) history.replaceState(null, "", location.pathname + location.search); render(); });
  if (M.espacio && M.espacio.watch) M.espacio.watch();
  M.$$("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  const render = M.wrapErr(async () => { fbSelect = null; app.innerHTML = '<p class="muted">Cargando…</p>'; await views[tab](); });
  const S = M.stSafe, data = async () => { const [s] = await api.listStudents(); return S.student(s); };
  const bstat = async () => S.booking(await api.bookingStatus().catch(() => null));
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
    async inicio() { // Inicio = vista completa de "Mis clases" (fondo del salón vikingo) + saludo, estado de pago, pases libres y "Tu mes"
      const [s, cls, b, pkgs, hist] = await Promise.all([data(), api.listClasses(), bstat(), api.listStudentPackages().catch(() => []), (api.classHistory ? api.classHistory().catch(() => null) : null)]);
      const prof = await api.getStudentProfile(s.id).catch(() => null), estiloHtml = M.testsCards ? await M.testsCards.estiloSelf(prof).catch(() => "") : "", testsHtml = M.testsCards ? await M.testsCards.self().catch(() => "") : "", pr = ((await api.listProgress().catch(() => [])) || [])[0], now = new Date().toISOString();
      const up = cls.filter((c) => c.status === "scheduled" && c.starts_at >= now);
      const mes = `<div class="sp-mes"><h3>Tu mes</h3>${pr ? `<div class="grid g3"><div class="kpi"><b>${pr.speaking_minutes}</b><span>min hablando</span></div><div class="kpi"><b>${pr.speaking_pct ?? "—"}%</b><span>del tiempo</span></div><div class="kpi"><b>${pr.fluency ?? "—"}/5</b><span>fluidez</span></div></div>
          ${(pr.new_vocabulary || []).length ? `<p class="sp-small">Vocabulario nuevo:</p><div class="chips">${pr.new_vocabulary.map((w) => `<span class="chip">${M.esc(w)}</span>`).join("")}</div>` : ""}` : '<p class="sp-pend">Tu teacher registrará tu progreso de este mes.</p>'}</div>`;
      app.innerHTML = `<div class="smc"><div class="stt-in"><h1>Hola, ${M.esc((s.full_name || "").split(" ")[0])}</h1>${M.paymentBanner(b)}
        ${M.perfil.misClases({ s, pkgs: pkgs || [], classes: cls, history: hist, prof, self: true, estiloHtml, testsHtml, agendar: "#solicitar", passes: M.passes(b), mes, fbLink: true })}
        <div class="panel rune pf-sec"><h3>Próximas clases agendadas</h3>${up.map(clsRow).join("") || '<p class="muted">Sin clases agendadas.</p>'}
        <p><a class="btn sm" href="#solicitar" id="goreq">${b.payment_blocked ? "Ver estado de mi paquete" : "Solicitar una clase"}</a></p>
        <p class="small muted">Horario en hora de Bogotá. El enlace de Google Meet se activa a la hora de tu clase. Cancelación sin cargo hasta ${b.late_cancel_hours} h antes · pases libres: ${b.passes_remaining} de ${b.passes_total}.</p></div></div></div>`;
      M.$("#goreq").onclick = (e) => { e.preventDefault(); M.$('nav.tabs [data-tab="solicitar"]').click(); };
      M.perfil.bindTest(app); bindCancel(b);
    },
    async solicitar() { // "Calendario": la misma agenda semanal del admin (js/agenda-view.js). Otros estudiantes = "Ocupado" (sin identidad; la RPC no la envía).
      const to = new Date(week.getTime() + 7 * 864e5);
      const [s, b, reqs, mine, teachers, busy, tps, tc] = await Promise.all([data(), bstat(), api.listRequests(), api.listClasses(), api.calendarTeachers(),
        api.calendarBusy(week.toISOString(), to.toISOString()), api.listTeacherProfiles().catch(() => []), api.creditsByType().catch(() => null)]);
      const colors = M.teacherColors(teachers, tps), esc = M.esc, hh = M.agenda.hh, tname = (id) => (teachers.find((t) => t.id === id) || {}).full_name || "";
      const minT = Date.now() + b.min_request_hours * 3600e3, locked = b.payment_blocked || b.available_to_request < 1;
      const shownT = teachers.filter((t) => !calFilter || t.id === calFilter);
      const pend = reqs.filter((r) => r.status === "pending"), own = mine.filter((c) => c.status !== "cancelled");
      const avail = (t, p) => (t.availability || []).some(([d, a, z]) => d === p.dow && p.h >= a && p.h < z);
      const at = (iso) => ({ own: own.find((c) => c.starts_at === iso), req: pend.find((r) => r.starts_at === iso), busy: busy.filter((x) => x.starts_at === iso && !x.mine) });
      const freeAt = (slot) => { const iso = slot.toISOString(), p = M.bog(slot), a = at(iso);
        if (a.own || a.req || slot.getTime() < minT) return [];
        return shownT.filter((t) => avail(t, p) && !a.busy.some((x) => x.teacher_id === t.id)); };
      const blocks = [];
      own.forEach((c) => { const k = M.classKind(c); blocks.push({ id: "own:" + c.id, starts_at: c.starts_at, kind: "own", icon: k === "grupal" ? "grp" : k === "club" ? "conv" : "one", status: c.status,
        title: "Tu clase", sub: `${esc(c.class_number ? M.classCodeTopic(c.class_number, s.program) : (c.title || "Refuerzo"))} · ${esc(M.KIND_LABEL[k])} · ${esc(c.teacher_name || tname(c.teacher_id))}`,
        teacher_id: c.teacher_id, teacher_name: c.teacher_name, tip: `Tu clase · ${M.STATUS_LABEL[c.status] || ""}` }); });
      pend.forEach((r) => { if (own.some((c) => c.starts_at === r.starts_at)) return;
        blocks.push({ id: "req:" + r.id, starts_at: r.starts_at, kind: "pend", icon: "hour", title: "Tu solicitud", sub: `Pendiente de aprobación · ${esc(r.modality === "group" ? "Grupal" : "Personalizada")} · ${esc(tname(r.teacher_id))}`, teacher_id: r.teacher_id, teacher_name: tname(r.teacher_id), tip: "Solicitud pendiente" }); });
      const seen = new Set();
      busy.filter((x) => !x.mine && (!calFilter || x.teacher_id === calFilter)).forEach((x) => { const iso = x.starts_at; if (seen.has(iso) || own.some((c) => c.starts_at === iso) || pend.some((r) => r.starts_at === iso)) return; seen.add(iso);
        const slot = new Date(iso), libres = freeAt(slot).length;
        blocks.push({ id: "busy:" + iso, starts_at: iso, kind: "busy", icon: "lock", title: "Ocupado", sub: libres ? `${libres} teacher${libres === 1 ? "" : "s"} libre${libres === 1 ? "" : "s"} · clic para agendar` : "", teacher_id: calFilter || null, tip: "Ocupado" }); });
      const cell = (slot, valid, p, h) => { if (!valid) return { cls: "off" }; const f = freeAt(slot);
        return f.length ? { cls: "free", attrs: `data-slot="${slot.toISOString()}" tabindex="0" role="button" aria-label="Agendar ${M.DOW[p.dow]} ${hh(h)}" title="Agendar ${M.DOW[p.dow]} ${hh(h)}"` } : { cls: "off" }; };
      const today = M.bog(new Date()), hoy = own.filter((c) => { const q = M.bog(c.starts_at); return q.y === today.y && q.m === today.m && q.d === today.d; }).length;
      const left = tc ? `${tc.personal_left} personalizada${tc.personal_left === 1 ? "" : "s"} · ${tc.group_left} grupal${tc.group_left === 1 ? "" : "es"}` : `${b.available_to_request} clase${b.available_to_request === 1 ? "" : "s"}`;
      app.innerHTML = M.agenda.render({ week, teachers, colors, filter: calFilter, cls: "agv-est", bands: shownT, cell, title: "Calendario", tag: "Tu agenda de clases",
        pergamino: hoy ? `Hoy: ${hoy} clase${hoy === 1 ? "" : "s"} tuya${hoy === 1 ? "" : "s"}` : `Puedes agendar: ${left}`,
        above: `<div class="agv-avisos">${M.paymentBanner(b)}${s.hasPackage ? "" : `<div class="panel"><p class="sp-pend">${S.SIN_PAQ}. Cuando tengas uno podrás agendar clases.</p><a class="btn sm" href="precios.html">Ver paquetes y precios</a></div>`}</div>`,
        legend: `<div class="agv-ley"><span><i class="lf"></i>Libre · clic para agendar</span><span><i class="lo"></i>Tu clase</span><span><i class="lp"></i>Tu solicitud pendiente</span><span><i class="lb"></i>Ocupado</span><span><i class="lx"></i>No disponible</span><span class="agv-saldo">Te quedan: <b>${left}</b></span></div>`,
        blocks, help: `Clic en un bloque libre para agendar con el teacher que prefieras. Tu solicitud queda pendiente hasta que el admin la apruebe; se pide con al menos ${b.min_request_hours} h de anticipación. Cancelación sin cargo hasta ${b.late_cancel_hours} h antes; después se usa un pase libre y, sin pases, se descuenta la clase.`,
        below: `<div class="agv-wrap agv-wrap1"><section class="agv-main"><h2 class="agv-h2">Mis solicitudes</h2>${reqs.slice().reverse().map((r) => `<div class="cls"><div><b>${M.fmtDateTime(r.starts_at)}</b> ${M.tagReq(r.status)} <span class="small muted">· ${esc(tname(r.teacher_id))} · ${r.modality === "group" ? "Grupal" : "Personalizada"}</span>
          ${r.student_note ? `<br><span class="small muted">Tu nota: ${esc(r.student_note)}</span>` : ""}${r.decision_note ? `<br><span class="small">Respuesta: ${esc(r.decision_note)}</span>` : ""}</div>
          <div>${r.status === "pending" ? `<button class="btn ghost sm" data-wd="${r.id}">Retirar</button>` : ""}</div></div>`).join("") || '<p class="muted">Aún no has enviado solicitudes.</p>'}</section></div>` });
      M.$("#prev").onclick = () => { week = new Date(week.getTime() - 7 * 864e5); render(); };
      M.$("#next").onclick = () => { week = new Date(week.getTime() + 7 * 864e5); render(); };
      M.$("#today").onclick = () => { week = M.weekStart(new Date()); render(); };
      M.$("#tf").onchange = (e) => { calFilter = e.target.value; render(); };
      const agendar = (iso) => {
        if (b.payment_blocked) return M.toast("Pago pendiente: no puedes agendar clases hasta que el admin confirme el pago de tu paquete.", true);
        if (locked) return M.toast("No te quedan clases disponibles para agendar en tu paquete.", true);
        const f = freeAt(new Date(iso)); if (!f.length) return M.toast("Ese bloque ya no tiene teachers libres.", true);
        const pre = f.find((t) => t.id === calFilter) || f.find((t) => t.id === s.teacher_id) || f[0], pl = tc ? tc.personal_left : b.available_to_request;
        M.modal(`<h2>Agendar clase</h2><p><b>${M.fmtDateTime(iso)}</b> · 60 min · hora Bogotá</p>
          <label for="rt">Teacher</label><select id="rt">${f.map((t) => `<option value="${t.id}" ${t.id === pre.id ? "selected" : ""}>${esc(t.full_name)}</option>`).join("")}</select>
          <label for="rm">Tipo de clase</label><select id="rm"><option value="individual">Personalizada (1 a 1) · te quedan ${pl}</option><option value="group" disabled>Grupal · se agenda en un grupo abierto${tc ? ` (te quedan ${tc.group_left})` : ""}</option></select>
          <label for="rn">Nota para tu teacher (opcional)</label><textarea id="rn" rows="2" maxlength="500"></textarea>
          <p class="small muted">Se descuenta de tus clases <b>personalizadas</b>. La clase se confirma cuando el admin apruebe la solicitud y se descuenta del paquete al dictarse (o por cancelación tardía sin pases libres).</p>
          <p><button class="btn" id="ok" ${pl < 1 ? "disabled" : ""}>Agendar</button> <button class="btn ghost" onclick="MEC.closeModal()">Cancelar</button></p>`, () => {
          M.$("#ok").onclick = M.wrapErr(async () => { await api.createRequest({ starts_at: iso, teacher_id: M.$("#rt").value, modality: M.$("#rm").value, note: M.$("#rn").value.trim() }); M.closeModal(); M.toast("Solicitud enviada: queda pendiente de aprobación"); render(); });
        });
      };
      M.$$(".agv-celda.free").forEach((el) => { el.onclick = () => agendar(el.dataset.slot); el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); agendar(el.dataset.slot); } }; });
      M.$$(".agv-b").forEach((el) => (el.onclick = () => { const [t, id] = [el.dataset.id.slice(0, el.dataset.id.indexOf(":")), el.dataset.id.slice(el.dataset.id.indexOf(":") + 1)];
        if (t === "busy") return freeAt(new Date(id)).length ? agendar(id) : M.toast("Bloque ocupado");
        if (t === "own") { const c = own.find((x) => x.id === id); return M.modal(`<h2>Tu clase</h2><p><b>${M.fmtDateTime(c.starts_at)}</b> · ${esc(c.teacher_name || tname(c.teacher_id))}</p><p>${M.kindChip(c)} ${esc(c.class_number ? M.classCodeTopic(c.class_number, s.program) : (c.title || "Refuerzo"))}</p><p>${M.tagStatus(c.status)}</p>
          ${c.status === "scheduled" && c.meet_url ? `<p><a class="btn sm" href="${esc(c.meet_url)}" target="_blank" rel="noopener">Entrar a Google Meet</a></p>` : ""}<p><button class="btn ghost" onclick="MEC.closeModal()">Cerrar</button></p>`); }
        if (t === "req") M.toast("Solicitud pendiente de aprobación. Puedes retirarla abajo, en «Mis solicitudes».");
      }));
      M.$("#agv-cta").onclick = () => { const f = M.$(".agv-celda.free"); if (f) agendar(f.dataset.slot); else M.toast("No hay bloques libres esta semana", true); };
      M.$$("[data-wd]").forEach((el) => (el.onclick = M.wrapErr(async () => { await api.cancelRequest(el.dataset.wd); M.toast("Solicitud retirada"); render(); })));
      if (calFocus) { // viene de "Inscribirme" (Noticias y eventos): resalta el bloque del evento
        const f = calFocus; calFocus = null; const el = M.$(`[data-slot="${f}"]`) || M.$$(".agv-b").find((x) => x.dataset.id === "busy:" + f);
        const d = M.bog(f), hdr = `${M.DOW[d.dow]} ${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")} ${M.agenda.hh(d.h)}`;
        if (el) { el.classList.add("agv-focus"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
        M.toast(el ? `Evento: ${hdr}. Haz clic en el bloque resaltado para agendar tu cupo.` : `Evento: ${hdr}. Ese bloque no tiene teachers libres; elige otro horario o escribe a MEC.`, !el);
      }
    },
    async noticias() { await M.noticias.student(app, { inscribir: (iso) => { week = M.weekStart(new Date(iso)); calFocus = iso; calFilter = ""; history.replaceState(null, "", "#solicitar"); goTab("solicitar"); } }); },
    async espacio() { const [s, cls] = await Promise.all([data(), api.listClasses()]); await M.espacio.studentView(app, { s, cls }); },
    async teachers() {
      const [s, list] = await Promise.all([data(), api.listTeacherProfiles()]);
      app.innerHTML = `<div class="stt"><div class="stt-in"><h1>Teachers</h1>${M.perfil.teachersView(list, { myTeacherId: s.teacher_id, agendar: "#solicitar" })}</div></div>`;
    },
    async feedback() { // Visor grande arriba + lista; #feedback/<id> abre uno concreto (desde las tarjetas de Inicio)
      const [s, cls] = await Promise.all([data(), api.listClasses()]), esc = M.esc;
      const fbs = cls.filter((c) => c.status === "completed" && (c.teacher_note || (c.sentences && c.sentences.length))).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
      const want = decodeURIComponent((location.hash.match(/^#feedback\/(.+)$/) || [])[1] || "");
      let sel = fbs.find((c) => c.id === want) || fbs[0];
      const code = (c) => c.class_number ? M.classCodeTopic(c.class_number, s.program) : (c.title || "Sesión de refuerzo");
      const viewer = (c) => !c ? '<h2>Feedback</h2><p class="sp-pend">Aún no hay feedback. Después de cada clase tu teacher te deja aquí sus notas y tus frases.</p>' : `
        <div class="fb-v-h">${M.kindChip(c)}<span class="fb-cod">${esc(c.class_number ? M.classCode(c.class_number) : "Refuerzo")}</span><time datetime="${c.starts_at}">${M.fmtDateTime(c.starts_at)}</time></div>
        <h2>${esc(code(c))}</h2><p class="sp-small">Teacher ${esc(String(c.teacher_name || "").replace(/^Teacher\s+/i, ""))}</p>
        <div class="fb-v-cols"><div><h3>Notas del teacher</h3>${c.teacher_note ? `<p class="fb-nota">${esc(c.teacher_note)}</p>` : '<p class="sp-pend">Sin notas en esta clase.</p>'}</div>
        <div><h3>My sentences today</h3>${c.sentences && c.sentences.length ? `<ol class="fb-frases">${c.sentences.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : '<p class="sp-pend">Sin frases en esta clase.</p>'}</div></div>`;
      const item = (c) => `<button type="button" class="fb-item${c === sel ? " on" : ""}" data-fb="${esc(c.id)}" aria-pressed="${c === sel}"><span class="fb-item-h">${M.kindChip(c)}<time>${M.fmtDate(c.starts_at)}</time></span><b>${esc(code(c))}</b>
        <span class="sp-small">${esc(String(c.teacher_note || (c.sentences || [])[0] || "").slice(0, 90))}${String(c.teacher_note || "").length > 90 ? "…" : ""}</span></button>`;
      const st = await api.spState().catch(() => null);
      app.innerHTML = `<div class="smc fbk"><div class="stt-in"><h1>Feedback</h1>
        <section class="sp-card fb-viewer" id="fb-v" tabindex="-1" aria-live="polite">${viewer(sel)}</section>
        ${fbs.length ? `<section class="mt-sec"><h2 class="mt-h">Todos tus feedbacks</h2><div class="fb-lista">${fbs.map(item).join("")}</div></section>` : ""}
        <div class="sp-grid fb-cards">${M.perfil.currentCard(s)}${M.perfil.nextCard(s, cls, "#solicitar", { cta: "Agendar mi siguiente clase" })}${M.perfil.historyCard(s, cls, "Clases tomadas")}
          <section class="sp-card ancho fb-up"><h2>Sube tu ejercicio</h2><p class="sp-small" id="fb-up-n"></p><div id="fb-subs"></div></section></div></div></div>`;
      const paintUp = () => { const box = M.$("#fb-subs"), n = M.$("#fb-up-n");
        if (!st) { n.textContent = ""; box.innerHTML = '<p class="sp-pend">Próximamente podrás subir aquí tus ejercicios.</p>'; return; }
        if (!st.accepted) { n.textContent = ""; box.innerHTML = '<p class="sp-pend">Para subir ejercicios, primero acepta las normas en Mi espacio.</p><p><a class="sp-btn oro" href="#espacio">Ir a Mi espacio</a></p>'; return; }
        if (st.kid && !st.consent) { n.textContent = ""; box.innerHTML = '<p class="sp-pend">Disponible cuando MEC registre la autorización de tu acudiente.</p>'; return; }
        n.textContent = sel ? `Entregas de la clase ${sel.class_number ? M.classCode(sel.class_number) : "de refuerzo"} (se guardan también en Mi espacio).` : "Tus entregas (se guardan también en Mi espacio).";
        M.espacio.subsBox(box, { me, role: "student", kid: st.kid, upload: !st.suspended, class_id: sel ? sel.id : null, teacher_id: sel ? sel.teacher_id : s.teacher_id, empty: "Aún no enviaste ejercicios para esta clase." }); };
      paintUp();
      fbSelect = (id) => { const c = fbs.find((x) => x.id === id); if (!c) return; sel = c; M.$("#fb-v").innerHTML = viewer(c);
        M.$$(".fb-item").forEach((b) => { const on = b.dataset.fb === id; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
        if (location.hash !== "#feedback/" + encodeURIComponent(id)) history.replaceState(null, "", "#feedback/" + encodeURIComponent(id));
        paintUp(); if (window.matchMedia("(max-width: 760px)").matches) M.$("#fb-v").scrollIntoView({ behavior: "smooth", block: "start" }); M.$("#fb-v").focus({ preventScroll: true }); };
      M.$$(".fb-item").forEach((b) => (b.onclick = () => fbSelect(b.dataset.fb)));
      if (want && sel && sel.id === want) M.$("#fb-v").focus({ preventScroll: true });
    },
    async material() { // Material: solo los libros del nivel y la sección del estudiante (la base lo impone con RLS books_read y el bucket privado 'materiales')
      const s = await data(), li = s.current_level, lvl = M.LEVELS[li - 1] || "", kids = s.program === "kids";
      const CAT = [ // portadas reales (img/web/libros) · se emparejan con la tabla books por slug o por carpeta del PDF
        { key: "a1/student-book", slug: "a1-students-book", level: 1, title: "A1 Student's Book", cover: "a1-students-book", desc: "Libro principal del curso A1: las unidades de cada subnivel." },
        { key: "a1/practice-book", slug: "a1-practice-book", level: 1, title: "A1 Practice Book", cover: "a1-practice-book", desc: "Ejercicios para practicar después de cada clase." },
        { key: "a1/speak-up", slug: "a1-speak-up", level: 1, title: "Speak Up A1", cover: "a1-speak-up", desc: "Conversación guiada para ganar fluidez." },
        { key: "a2/practice-book", slug: "a2-practice-book", level: 2, title: "A2 Practice Book", cover: "a2-practice-book", desc: "Ejercicios para practicar el curso A2." }];
      const rows = kids ? [] : (await api.listBooks()).filter((x) => !x.teacher_only && x.level_index === li && (x.program === s.program || x.program === "ambos"));
      const units = rows.length ? await (api.listBookUnits ? api.listBookUnits().catch(() => []) : []) : [];
      const match = (c) => rows.find((x) => x.slug === c.slug || String(x.storage_path || "").startsWith(c.key + "/"));
      const mine = kids ? [] : CAT.filter((c) => c.level === li).map((c) => Object.assign({}, c, { row: match(c) })).filter((c) => c.row);
      const card = (c) => { const x = c.row, u = units.filter((y) => y.book_slug && y.book_slug === x.slug).sort((p, q) => p.sort_order - q.sort_order);
        return `<article class="sp-card mt-libro"><picture><source srcset="img/web/libros/${c.cover}-thumb-600x800.webp?v=20261016t" type="image/webp"><img src="img/web/libros/${c.cover}-thumb-600x800.jpg?v=20261016t" width="600" height="800" alt="Portada de ${M.esc(c.title)}" decoding="async"></picture>
          <div class="mt-info"><h2>${M.esc(c.title)}</h2><p class="sp-small">${M.esc(c.desc)}</p>
          ${x.storage_path ? `<p><button class="sp-btn oro" data-pdf="${M.esc(x.storage_path)}">Abrir PDF</button></p>${u.length ? `<p class="sp-small">Ir a la unidad: ${u.map((y) => `<button class="sp-btn" data-pdf="${M.esc(x.storage_path)}" data-page="${+y.page_start}">${M.esc(y.label)}</button>`).join(" ")}</p>` : ""}`
            : x.url ? `<a class="sp-btn oro" href="${M.esc(x.url)}" target="_blank" rel="noopener">Abrir</a>` : '<p class="sp-pend">Próximamente</p>'}</div></article>`; };
      const sec = kids
        ? `<section class="mt-sec" aria-labelledby="mt-k"><h2 id="mt-k" class="mt-h">Mastery4Kids</h2><div class="sp-card mt-pronto"><h2>Próximamente</h2><p>Estamos preparando los libros de Mastery4Kids. Muy pronto los verás aquí.</p></div></section>`
        : `<section class="mt-sec" aria-labelledby="mt-a"><h2 id="mt-a" class="mt-h">Estudiantes${lvl ? ` · curso ${M.esc(lvl)}` : ""}</h2>
            ${mine.length ? `<div class="mt-grid">${mine.map(card).join("")}</div>` : `<div class="sp-card mt-pronto"><h2>Próximamente</h2><p>Aún no hay material publicado para ${lvl ? "tu curso " + M.esc(lvl) : "tu curso"}.</p></div>`}</section>`;
      app.innerHTML = `<div class="smc mtb"><div class="stt-in"><h1>Material</h1><p class="mt-intro">Aquí ves el material de tu curso actual.${s.hasPackage ? "" : " " + S.SIN_PAQ + "."}</p>${sec}</div></div>`;
      M.$$("[data-pdf]").forEach((el) => (el.onclick = M.wrapErr(async () => { const w = window.open("about:blank", "_blank"); if (w) w.opener = null;
        try { const url = await api.bookFileUrl(el.dataset.pdf); const full = url + (el.dataset.page ? "#page=" + el.dataset.page : "");
          if (w) w.location = full; else location.href = full; } catch (e) { if (w) w.close(); throw e; } })));
    }
  };
  render();
})();
