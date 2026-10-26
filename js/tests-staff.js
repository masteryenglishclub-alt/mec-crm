/* MEC CRM – tests: vista de teacher y admin (resultados, gráficas, calificación con la rúbrica solo-docente, aprobación, audios de Listening).
   Aquí SÍ aparecen el nivel de inicio y los nombres de los estilos. Este archivo solo se carga en teacher.html y admin.html (nunca en las páginas del estudiante).
   La base de datos decide quién ve qué (RLS): el teacher solo ve a sus estudiantes; la aprobación final es solo del admin. */
(function () {
  const M = window.MEC, esc = M.esc, T = () => M.tests;
  const CATS = [["listening", "Listening"], ["reading", "Reading"], ["use_of_english", "Use of English"], ["vocabulary", "Vocabulary"], ["writing", "Writing"], ["speaking", "Speaking"]];
  const BANDS = ["A1", "A2", "B1", "B2"].flatMap((l) => [1, 2, 3, 4, 5].map((n) => l + "." + n));
  const bandPct = (c) => { const i = BANDS.indexOf(c); return i < 0 ? null : (i / (BANDS.length - 1)) * 100; };
  const STATE = { auto: "En curso · preguntas", writing: "En curso · Writing", speaking: "En curso · Speaking", submitted: "Esperando revisión del teacher", graded: "Calificado", cancelled: "Cancelado" };
  const stateOf = (a) => (a.status === "graded" ? (a.result_final ? "Aprobado" : "Esperando aprobación de coordinación") : STATE[a.status] || a.status);
  const STYLE = { V: "Visual", A: "Auditivo", K: "Kinestésico", VA: "Visual + Auditivo", VK: "Visual + Kinestésico", AK: "Auditivo + Kinestésico", EQ: "Equilibrado (sin dominante)" };
  const catVals = (a) => CATS.map(([k, n]) => { let v = null; if (k === "writing") v = a.w_score == null ? null : (a.w_score / 12) * 100; else if (k === "speaking") v = a.s_score == null ? null : (a.s_score / 15) * 100; else { const c = a.cat_scores && a.cat_scores[k]; v = c && c.n ? (c.c / c.n) * 100 : null; } return { label: n, value: v }; });
  const notEnabled = (e) => `<p class="sp-pend">Los tests todavía no están activados en la base de datos (${esc(e && e.message ? e.message : "sin datos")}). Cuando se aprueben las migraciones de tests, aparecerán aquí.</p>`;

  /* ---------- tarjetas dentro del perfil del estudiante (admin / teacher) ---------- */
  async function profileCards(studentId) {
    let pm = [], qt = [];
    try { pm = await T().pmStaffAttempts(studentId); } catch (e) { pm = null; }
    try { qt = await T().qtStaffAttempts(studentId); } catch (e) { qt = null; }
    if (pm === null && qt === null) return `<section class="sp-card ancho"><h2>Tests <span class="sp-tag">Solo staff</span></h2>${notEnabled()}</section>`;
    return pmCard(pm || []) + qtCard(qt || []);
  }
  function pmCard(rows) {
    const a = rows[0], head = `<h2>Mi punto de partida · resultado <span class="sp-tag">Solo staff</span></h2>`;
    if (!a) return `<section class="sp-card ancho" data-tst="pm">${head}<p class="sp-pend">Aún no hay intentos de «Mi punto de partida».</p></section>`;
    const hist = rows.filter((x) => x.result_final || x.result_auto).slice().reverse().map((x) => ({ label: M.fmtDate(x.started_at).replace(/\.$/, ""), value: bandPct(x.result_final || x.result_auto) })).filter((x) => x.value != null);
    const lvl = a.result_final ? `<b>${esc(a.result_final)}</b>` : a.result_auto ? `${esc(a.result_auto)} <span class="sp-small">(provisional, falta Writing/Speaking)</span>` : "—";
    return `<section class="sp-card ancho tst-staff" data-tst="pm" data-att="${esc(a.id)}">${head}
      <div class="tst-g2"><div><dl class="sp-dl"><dt>Estado</dt><dd><span class="tag">${esc(stateOf(a))}</span>${a.needs_coordination_review ? ' <span class="tag">Revisión de coordinación</span>' : ""}${a.teacher_interview_required ? ' <span class="tag">Entrevista de confirmación</span>' : ""}</dd>
        <dt>Resultado</dt><dd>${lvl}</dd><dt>Nivel de inicio</dt><dd>${a.start_band ? `<b>${esc(a.start_band)}</b> · ${esc(a.start_class_label || "")}` : "— (se calcula al aprobar)"}</dd>
        <dt>Intento</dt><dd>${esc(M.fmtDateTime(a.started_at))}${a.submitted_at ? " · enviado " + esc(M.fmtDateTime(a.submitted_at)) : ""}</dd>
        ${a.status === "submitted" && a.speaking_due_at ? `<dt>Speaking, límite</dt><dd>${esc(M.fmtDateTime(a.speaking_due_at))} <span class="sp-small">(48 h hábiles)</span></dd>` : ""}
        ${a.strengths || a.to_work_on ? `<dt>Notas</dt><dd>${a.strengths ? "Fortalezas: " + esc(a.strengths) + "<br>" : ""}${a.to_work_on ? "Por trabajar: " + esc(a.to_work_on) : ""}</dd>` : ""}</dl>
        <p class="tst-btns">${["submitted", "graded"].includes(a.status) ? `<button class="btn sm" data-tst-grade="${esc(a.id)}">${a.status === "graded" ? "Ver / recalificar" : "Calificar Writing y Speaking"}</button>` : ""}
        <button class="btn sm ghost" data-tst-detail="${esc(a.id)}">Ver respuestas</button>
        ${a.status === "graded" && !a.result_final ? `<button class="btn sm ok" data-tst-approve="${esc(a.id)}">Aprobar resultado (admin)</button>` : ""}
        ${a.teacher_interview_required && a.interview_done == null && a.status === "graded" ? `<button class="btn sm" data-tst-interview="${esc(a.id)}">Registrar entrevista</button>` : ""}
        ${!["cancelled"].includes(a.status) ? `<button class="btn sm ghost" data-tst-cancel="${esc(a.id)}">Cancelar intento</button>` : ""}</p></div>
        <div>${M.tcharts.radar(catVals(a), { title: "Resultado por categoría" })}<p class="sp-small">Porcentaje de aciertos por categoría; Writing sobre 12 y Speaking sobre 15 (cuando ya están calificados).</p></div></div>
      ${rows.length > 1 ? `<h3>Historial de intentos</h3>${hist.length > 1 ? M.tcharts.line(hist, { title: "Evolución del resultado" }) : ""}<table><thead><tr><th>Fecha</th><th>Estado</th><th>Resultado</th><th>Nivel de inicio</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${esc(M.fmtDate(x.started_at))}</td><td>${esc(stateOf(x))}</td><td>${esc(x.result_final || x.result_auto || "—")}</td><td>${esc(x.start_band || "—")}</td></tr>`).join("")}</tbody></table>` : ""}</section>`;
  }
  function qtCard(rows) {
    const a = rows[0], head = `<h2>Test de estilo de aprendizaje · resultado <span class="sp-tag">Solo staff</span></h2>`;
    if (!a) return `<section class="sp-card ancho" data-tst="qt">${head}<p class="sp-pend">Aún no hay resultado del test de estilo.</p></section>`;
    const bars = ["V", "A", "K"].map((k) => ({ label: STYLE[k], value: (a.pct || {})[k] || 0 }));
    return `<section class="sp-card ancho tst-staff" data-tst="qt">${head}<div class="tst-g2"><div><p><b>${esc(STYLE[a.result_code] || a.result_code)}</b></p><p class="sp-small">Respuestas: ${["V", "A", "K"].map((k) => STYLE[k] + " " + ((a.counts || {})[k] ?? 0)).join(" · ")} (de 36). Hecho el ${esc(M.fmtDate(a.completed_at))}. El estudiante ve solo el texto y barras con etiquetas neutras.</p>
      ${rows.length > 1 ? `<p class="sp-small">Intentos anteriores: ${rows.slice(1).map((x) => esc(M.fmtDate(x.completed_at) + " · " + (STYLE[x.result_code] || x.result_code))).join("; ")}</p>` : ""}</div>
      <div>${M.tcharts.bars(bars, { title: "Estilo de aprendizaje", colors: M.tcharts.COLORS, labelW: 118 })}</div></div></section>`;
  }
  function bindCards(root, reload) {
    const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => (b.onclick = M.wrapErr(() => fn(b))));
    on("[data-tst-grade]", (b) => gradeModal(b.dataset.tstGrade, reload)); on("[data-tst-detail]", (b) => detailModal(b.dataset.tstDetail));
    on("[data-tst-approve]", async (b) => approveModal(b.dataset.tstApprove, reload));
    on("[data-tst-cancel]", async (b) => { if (!confirm("¿Cancelar este intento? El estudiante podrá empezar otro.")) return; await T().pmCancel(b.dataset.tstCancel); M.toast("Intento cancelado"); reload(); });
    on("[data-tst-interview]", async (b) => { const ok = confirm("¿La entrevista CONFIRMA el resultado?\nAceptar = confirma · Cancelar = hay que revisar"); await T().pmSetInterview(b.dataset.tstInterview, ok ? "confirma" : "revisar"); M.toast("Entrevista registrada"); reload(); });
  }
  async function approveModal(id, reload) {
    const prop = (await T().pmStaffAttempts()).find((x) => x.id === id) || {}, p = prop.ws_proposal || 0;
    M.modal(`<h2>Aprobar resultado</h2><p>Resultado automático: <b>${esc(prop.result_auto || "—")}</b>. Writing/Speaking proponen: <b>${p > 0 ? "subir un subnivel" : p < 0 ? "bajar un subnivel" : "mantener"}</b>.</p>
      <p class="sp-small">Solo coordinación (admin) aprueba. Al aprobar se guarda el nivel de inicio y se le aplica al estudiante (si aún no tiene clases tomadas); el estudiante ve su resultado.</p>
      <p><button class="btn ok" id="ap1">${p ? "Aprobar la propuesta" : "Aprobar"}</button> ${p ? '<button class="btn" id="ap0">Mantener el automático</button> ' : ""}<button class="btn ghost" onclick="MEC.closeModal()">Cerrar</button></p>`, () => {
      const go = (ok) => M.wrapErr(async () => { const r = await T().pmApprove(id, ok); M.closeModal(); M.toast("Resultado aprobado: " + (r || "")); reload(); });
      M.$("#ap1").onclick = go(true); const z = M.$("#ap0"); if (z) z.onclick = go(false); });
  }
  async function detailModal(id) { // test completo para teacher y admin: pregunta, opciones, elegida y correcta
    const rows = await T().pmDetail(id), by = {}; rows.forEach((r) => { (by[r.section] = by[r.section] || []).push(r); });
    const opt = (r, k) => { const o = (Array.isArray(r.options) ? r.options : []).find((x) => x.key === k); return k ? `<b>${esc(k)}</b>${o ? " · " + esc(o.text) : ""}` : "—"; };
    const opts = (r) => Array.isArray(r.options) && r.options.length ? `<div class="sp-small">${r.options.map((o) => `${esc(o.key)}) ${esc(o.text)}`).join(" · ")}</div>` : "";
    M.modal(`<h2>Test completo</h2><p class="sp-small">Cada pregunta con sus opciones, lo que eligió el estudiante y la respuesta correcta.</p>${rows.length ? Object.keys(by).map((s) => `<h3>${esc(s)}</h3><table><thead><tr><th>#</th><th>Paso</th><th>Pregunta</th><th>Eligió</th><th>Correcta</th><th></th></tr></thead><tbody>${by[s].map((r) => `<tr><td>${r.seq}</td><td>${esc(r.step || "")}</td><td>${esc(r.stem || "")}${opts(r)}</td><td>${opt(r, r.chosen_key)}</td><td>${r.correct_key ? opt(r, r.correct_key) : esc(r.correct_text || "—")}</td><td>${r.audio_failed ? "audio falló" : r.is_correct == null ? "" : r.is_correct ? '<span class="tst-ok">✔</span>' : '<span class="tst-mal">✘</span>'}</td></tr>`).join("")}</tbody></table>`).join("") : "<p>Sin respuestas.</p>"}
      <p><button class="btn ghost" onclick="MEC.closeModal()">Cerrar</button></p>`, null, true);
  }
  /* ---------- calificar con la rúbrica (solo docente) ---------- */
  async function gradeModal(id, reload) {
    const [rub, wr, sp, a] = await Promise.all([T().pmRubric(), T().pmWriting(id), T().pmSpeakingInfo(id), T().pmStaffAttempts().then((r) => r.find((x) => x.id === id) || {})]);
    const old = { w: a.w_detail || {}, s: a.s_detail || {} };
    const crit = (kind, rows) => rows.map(([code, label, d3, d2, d1, d0]) => `<fieldset class="tst-crit"><legend>${esc(label)}</legend><div class="tst-pts" role="radiogroup" aria-label="${esc(label)}">${[3, 2, 1, 0].map((v) => `<label title="${esc([d0, d1, d2, d3][v])}"><input type="radio" name="${kind}-${code}" value="${v}" ${old[kind[0]][code] === v ? "checked" : ""}> ${v}</label>`).join("")}</div><p class="sp-small">3 = ${esc(d3)} · 0 = ${esc(d0)}</p></fieldset>`).join("");
    const recs = Object.keys(sp.recordings || {}).sort();
    M.modal(`<h2>Calificar · ${esc(a.student_name || "Estudiante")}</h2><p class="sp-small">La rúbrica es solo para el equipo docente: el estudiante nunca la ve. Nivel automático: <b>${esc(a.result_auto || "—")}</b>.</p>
      <h3>Writing (máx. 12)</h3><div class="tst-pass"><b>Consigna:</b> ${esc(wr.prompt || "—")}<br><br>${wr.skipped ? "<i>El estudiante decidió no escribir.</i>" : wr.text ? esc(wr.text).replace(/\n/g, "<br>") : "<i>Sin texto.</i>"}</div>${wr.text ? crit("writing", rub.writing) : ""}<p><b id="wt"></b></p>
      <h3>Speaking (máx. 15)</h3>${(sp.questions || []).map((q, i) => `<div class="tst-pass"><b>Pregunta ${i + 1}:</b> ${esc(q)}<br>${sp.recordings && sp.recordings[i + 1] ? `<button class="btn sm ghost" data-play="${i + 1}">▶ Escuchar grabación (${esc(sp.recordings[i + 1].seconds || "?")} s)</button> <span class="sp-small" id="pl${i + 1}"></span>` : "<i>Sin grabación.</i>"}</div>`).join("")}
      ${recs.length ? crit("speaking", rub.speaking) : ""}<p><b id="st"></b></p>
      <label for="g-f">Fortalezas</label><textarea id="g-f" rows="2">${esc(a.strengths || "")}</textarea><label for="g-t">Por trabajar</label><textarea id="g-t" rows="2">${esc(a.to_work_on || "")}</textarea><label for="g-i">Intereses (para sus clases)</label><textarea id="g-i" rows="2">${esc(a.interests || "")}</textarea>
      <p style="margin-top:12px"><button class="btn" id="g-ok">Guardar calificación</button> <button class="btn ghost" onclick="MEC.closeModal()">Cerrar</button></p><p class="sp-small" id="g-res"></p>`, () => {
      const read = (kind, rows) => { const o = {}; for (const r of rows) { const c = document.querySelector(`input[name="${kind}-${r[0]}"]:checked`); if (!c) return null; o[r[0]] = Number(c.value); } return o; };
      const upd = () => { const w = [...document.querySelectorAll('input[name^="writing-"]:checked')].reduce((s, x) => s + Number(x.value), 0), s = [...document.querySelectorAll('input[name^="speaking-"]:checked')].reduce((x, y) => x + Number(y.value), 0);
        if (M.$("#wt")) M.$("#wt").textContent = wr.text ? "Writing: " + w + " / 12" : ""; if (M.$("#st")) M.$("#st").textContent = recs.length ? "Speaking: " + s + " / 15" : ""; };
      document.querySelectorAll(".tst-crit input").forEach((i) => i.addEventListener("change", upd)); upd();
      document.querySelectorAll("[data-play]").forEach((b) => (b.onclick = M.wrapErr(async () => { const r = sp.recordings[b.dataset.play], url = await T().pmSpeakUrl(r.path || r.storage_path || ""); const t = M.$("#pl" + b.dataset.play);
        if (!url) return (t.textContent = "(En la vista previa no se guardan las grabaciones; en producción se reproducen aquí.)"); t.innerHTML = `<audio controls autoplay src="${esc(url)}"></audio>`; })));
      M.$("#g-ok").onclick = M.wrapErr(async () => { const w = wr.text ? read("writing", rub.writing) : null, s = recs.length ? read("speaking", rub.speaking) : null;
        if (wr.text && !w) throw new Error("Falta un criterio de Writing"); if (recs.length && !s) throw new Error("Falta un criterio de Speaking"); if (!w && !s) throw new Error("No hay nada que calificar todavía");
        const r = await T().pmGrade(id, w, s, { strengths: M.$("#g-f").value.trim() || null, to_work_on: M.$("#g-t").value.trim() || null, interests: M.$("#g-i").value.trim() || null });
        M.$("#g-res").textContent = r.pending_coordination ? "Guardado. Writing/Speaking proponen un ajuste de ±1 subnivel o el caso requiere revisión: coordinación (admin) debe aprobar." : "Guardado. El nivel de inicio quedó calculado."; M.toast("Calificación guardada"); reload && reload(); });
    }, true);
  }
  /* ---------- pestaña «Tests» (teacher y admin) ---------- */
  async function panel(app, role) {
    const adm = role === "admin"; let pm = [], qt = [], err = null;
    try { pm = await T().pmStaffAttempts(); } catch (e) { err = e; } try { qt = await T().qtStaffAttempts(); } catch (e) { err = err || e; }
    const todo = pm.filter((a) => a.status === "submitted").sort((x, y) => String(x.speaking_due_at).localeCompare(String(y.speaking_due_at)));
    const pend = {}; try { (await T().pmPending()).forEach((p) => (pend[p.attempt_id] = p)); } catch (e) {}
    const approve = pm.filter((a) => a.status === "graded" && !a.result_final), ini = pm.filter((a) => a.teacher_interview_required && a.status === "graded" && a.interview_done == null);
    const row = (a, btn) => { const p = pend[a.id] || {}; return `<tr><td>${esc(a.student_name)}</td><td>${a.submitted_at ? esc(M.fmtDateTime(a.submitted_at)) : "—"}</td><td>${a.speaking_due_at ? esc(M.fmtDateTime(a.speaking_due_at)) : "—"} ${p.overdue ? '<span class="tag" style="color:#ff9a8a">Vencido</span>' : p.alert ? '<span class="tag" style="color:#f0c46a">Alerta 36 h</span>' : ""}</td><td>${btn}</td></tr>`; };
    app.innerHTML = `<div class="stt"><div class="stt-in"><h1>Tests</h1><p class="sp-small">«Mi punto de partida» y «Test de estilo de aprendizaje». Aquí calificas Writing y Speaking con la rúbrica docente y ves los resultados. Cuando el resultado queda final, el estudiante ve su nivel, su clase de inicio y su resultado por habilidad (nunca la rúbrica ni las respuestas correctas). Todos los teachers ven el test completo de cualquier estudiante.</p>
      ${err ? notEnabled(err) : ""}
      <section class="sp-card ancho"><h2>Por revisar (Writing y Speaking) <span class="sp-tag">${todo.length}</span></h2>${todo.length ? `<table><thead><tr><th>Estudiante</th><th>Enviado</th><th>Límite (48 h hábiles)</th><th></th></tr></thead><tbody>${todo.map((a) => row(a, `<button class="btn sm" data-tst-grade="${esc(a.id)}">Calificar</button> <button class="btn sm ghost" data-tst-detail="${esc(a.id)}">Respuestas</button>`)).join("")}</tbody></table>` : '<p class="sp-pend">Nada pendiente.</p>'}</section>
      ${adm ? `<section class="sp-card ancho"><h2>Por aprobar (coordinación) <span class="sp-tag">${approve.length}</span></h2>${approve.length ? `<table><thead><tr><th>Estudiante</th><th>Automático</th><th>Propuesta Writing/Speaking</th><th></th></tr></thead><tbody>${approve.map((a) => `<tr><td>${esc(a.student_name)}</td><td>${esc(a.result_auto || "—")}${a.needs_coordination_review ? ' <span class="tag">Revisión</span>' : ""}</td><td>${a.ws_proposal > 0 ? "+1 subnivel" : a.ws_proposal < 0 ? "−1 subnivel" : "Sin cambio"}</td><td><button class="btn sm ok" data-tst-approve="${esc(a.id)}">Aprobar</button> <button class="btn sm ghost" data-tst-grade="${esc(a.id)}">Revisar</button></td></tr>`).join("")}</tbody></table>` : '<p class="sp-pend">Nada por aprobar.</p>'}</section>` : ""}
      ${ini.length ? `<section class="sp-card ancho"><h2>Entrevistas de confirmación (B2.5) <span class="sp-tag">${ini.length}</span></h2><table><tbody>${ini.map((a) => `<tr><td>${esc(a.student_name)}</td><td><button class="btn sm" data-tst-interview="${esc(a.id)}">Registrar entrevista</button></td></tr>`).join("")}</tbody></table></section>` : ""}
      <section class="sp-card ancho"><h2>Todos los intentos de nivel <span class="sp-tag">${pm.length}</span></h2>${pm.length ? `<table><thead><tr><th>Estudiante</th><th>Fecha</th><th>Estado</th><th>Resultado</th><th>Inicio</th></tr></thead><tbody>${pm.map((a) => `<tr><td>${esc(a.student_name)}</td><td>${esc(M.fmtDate(a.started_at))}</td><td>${esc(stateOf(a))}</td><td>${esc(a.result_final || a.result_auto || "—")}</td><td>${esc(a.start_band || "—")}</td></tr>`).join("")}</tbody></table>` : '<p class="sp-pend">Todavía no hay intentos.</p>'}</section>
      <section class="sp-card ancho"><h2>Resultados del test de estilo <span class="sp-tag">${qt.length}</span></h2>${qt.length ? `<table><thead><tr><th>Estudiante</th><th>Fecha</th><th>Resultado</th><th>Visual / Auditivo / Kinestésico</th></tr></thead><tbody>${qt.map((a) => `<tr><td>${esc(a.student_name)}</td><td>${esc(M.fmtDate(a.completed_at))}</td><td>${esc(STYLE[a.result_code] || a.result_code)}</td><td>${["V", "A", "K"].map((k) => ((a.pct || {})[k] ?? 0) + "%").join(" / ")}</td></tr>`).join("")}</tbody></table>` : '<p class="sp-pend">Todavía no hay resultados.</p>'}</section>
      ${adm ? '<div id="tst-audio"></div>' : ""}</div></div>`;
    bindCards(app, () => panel(app, role)); if (adm) await audioPanel(M.$("#tst-audio"));
  }
  /* ---------- admin: audios de Listening ---------- */
  async function audioPanel(box) {
    let rows = []; try { rows = await T().pmAudioStatus(); } catch (e) { box.innerHTML = ""; return; }
    const up = rows.filter((r) => r.uploaded).length;
    box.innerHTML = `<section class="sp-card ancho"><h2>Audios de Listening <span class="sp-tag">${up} de ${rows.length} cargados</span></h2>
      <p class="sp-small">Cada pregunta de Listening necesita un archivo con el guion que aparece abajo. Se guarda en el almacenamiento privado <b>pm-listening</b> con el nombre <b>listening/&lt;id&gt;.mp3</b> (mp3, m4a, ogg, opus o wav, máx. 10 MB). También puedes subirlos desde el panel de Supabase y pulsar «Detectar archivos subidos». Mientras falte un audio, el estudiante ve un aviso amable y recibe otra pregunta del mismo nivel.</p>
      <p><button class="btn sm ghost" id="au-scan">Detectar archivos subidos</button></p>
      <table><thead><tr><th>Id</th><th>Nivel</th><th>Guion (lo que dice el audio)</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr><td><code>${esc(r.item_id)}</code><br><span class="sp-small">${esc(r.expected_path)}</span></td><td>${esc(r.step || r.cefr || "")}</td><td><details><summary>Ver guion</summary><p>${esc(r.script || "—")}</p></details></td><td>${r.uploaded ? '<span class="tag" style="color:#9be28f">Cargado</span>' : '<span class="tag">Falta</span>'}</td>
        <td><label class="btn sm ghost" style="cursor:pointer">${r.uploaded ? "Reemplazar" : "Subir"}<input type="file" accept="audio/*" data-au="${esc(r.item_id)}" hidden></label>${r.uploaded ? ` <button class="btn sm ghost" data-aurm="${esc(r.item_id)}">Quitar</button>` : ""}</td></tr>`).join("")}</tbody></table></section>`;
    const again = () => audioPanel(box);
    box.querySelectorAll("[data-au]").forEach((i) => (i.onchange = M.wrapErr(async () => { if (!i.files[0]) return; await T().pmAudioUpload(i.dataset.au, i.files[0]); M.toast("Audio cargado"); again(); })));
    box.querySelectorAll("[data-aurm]").forEach((b) => (b.onclick = M.wrapErr(async () => { if (!confirm("¿Quitar este audio?")) return; await T().pmAudioRemove(b.dataset.aurm); M.toast("Audio quitado"); again(); })));
    M.$("#au-scan").onclick = M.wrapErr(async () => { await T().pmAudioScan(); M.toast("Listo"); again(); });
  }
  M.testsStaff = { profileCards, bindCards, panel, audioPanel, catVals, bandPct, BANDS, STYLE, stateOf };
})();
