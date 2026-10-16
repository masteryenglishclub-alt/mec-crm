/* MEC CRM – utilidades comunes: pensum, zona horaria Bogotá, UI */
(function () {
  const M = (window.MEC = window.MEC || {});
  M.TZ = "America/Bogota";
  M.LEVELS = ["A1", "A2", "B1", "B2", "C1"];
  M.LEVEL_NAMES = {
    adultos: ["A1", "A2", "B1", "B2", "C1"],
    kids: ["A1 Explorers", "A2 Adventurers", "B1 Discoverers", "B2 Inventors", "YL Young Leaders"]
  };
  // Tipos con nombre para la interfaz (el Conversation Lab es una conversación guiada)
  M.TYPE_LABEL = {
    content: "Clase", practice_studio: "Practice Studio", conversation_lab: "Conversation Lab",
    review: "Repaso", extra_reinforcement: "Sesión de refuerzo"
  };
  M.STATUS_LABEL = { scheduled: "Agendada", completed: "Completada", cancelled: "Cancelada", no_show: "No asistió" };
  M.REQ_LABEL = { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada", cancelled: "Retirada" };
  M.PENALTY_LABEL = { none: "Sin cargo", free_pass: "Usó un pase libre", class_deducted: "Clase descontada" };
  M.tagReq = (s) => `<span class="tag r-${s}">${M.REQ_LABEL[s] || s}</span>`;
  /** Bandeja de aprobación (teacher y admin): mismas reglas; la base vuelve a verificar todo al aprobar */
  M.requestsView = function (reqs, opts = {}) {
    const pend = reqs.filter((r) => r.status === "pending"), done = reqs.filter((r) => r.status !== "pending").slice().reverse().slice(0, 12);
    const row = (r) => `<div class="cls"><div><b>${M.esc(r.student_name)}</b> ${M.tagReq(r.status)}${opts.showTeacher ? ` <span class="muted small">· ${M.esc(r.teacher_name)}</span>` : ""}<br>
        <span>${M.fmtDateTime(r.starts_at)}</span>${r.next_class_number && r.status === "pending" ? ` <span class="muted small">· se agendará la clase #${r.next_class_number} (${M.esc(M.classInfo(r.next_class_number).title)})</span>` : ""}
        ${r.student_note ? `<br><span class="small">“${M.esc(r.student_note)}”</span>` : ""}
        ${r.competing ? `<br><span class="small" style="color:var(--warn)">⚑ ${r.competing} solicitud(es) más para este mismo bloque: al aprobar una, las otras se rechazan automáticamente.</span>` : ""}
        ${r.conflict ? `<br><span class="small" style="color:var(--red)">✖ El bloque ya está ocupado: no se puede aprobar.</span>` : ""}
        ${r.payment_blocked ? `<br><span class="small" style="color:var(--warn)">⚠ Paquete con pago pendiente: no se puede aprobar hasta confirmar el pago.</span>` : ""}
        ${r.decision_note && r.status !== "pending" ? `<br><span class="small muted">Nota: ${M.esc(r.decision_note)}</span>` : ""}</div>
      <div>${r.status === "pending" && !opts.readOnly ? `<button class="btn ok sm" data-ap="${r.id}" ${r.conflict || r.payment_blocked ? "disabled" : ""}>Aprobar</button> <button class="btn red sm" data-rj="${r.id}">Rechazar</button>` : ""}</div></div>`;
    return `<div class="panel rune"><h3>Pendientes de aprobación (${pend.length})</h3>${opts.readOnly ? '<p class="small muted">Solo lectura: el admin aprueba o rechaza las solicitudes.</p>' : ""}${pend.map(row).join("") || '<p class="muted">No hay solicitudes pendientes.</p>'}
      <p class="small muted">Al aprobar, la base de datos vuelve a verificar horario (L-V 6-18, sáb 10-16, Bogotá), disponibilidad, doble reserva y pago del paquete.</p></div>
      <div class="panel"><h3>Decididas recientemente</h3>${done.map(row).join("") || '<p class="muted">—</p>'}</div>`;
  };
  M.bindRequests = function (api, rerender) {
    M.$$("[data-ap]").forEach((b) => (b.onclick = M.wrapErr(async () => { await api.approveRequest(b.dataset.ap); M.toast("Solicitud aprobada: clase agendada"); rerender(); })));
    M.$$("[data-rj]").forEach((b) => (b.onclick = () => M.modal(`<h2>Rechazar solicitud</h2><label>Mensaje para el estudiante</label><textarea id="rjn" rows="2">Ese bloque no me queda posible; elige otro horario, por favor.</textarea>
      <p><button class="btn red" id="ok">Rechazar</button> <button class="btn ghost" onclick="MEC.closeModal()">Volver</button></p>`, () => {
      M.$("#ok").onclick = M.wrapErr(async () => { await api.rejectRequest(b.dataset.rj, M.$("#rjn").value.trim()); M.closeModal(); M.toast("Solicitud rechazada"); rerender(); }); })));
  };
  /** Contador visual de pases libres */
  M.passes = (b) => `<div class="passes" title="Pases libres">${Array.from({ length: b.passes_total }, (_, i) => `<span class="p ${i < b.passes_used ? "used" : ""}"></span>`).join("")}
    <b style="margin-left:6px">${b.passes_remaining}</b><span class="muted small">&nbsp;de ${b.passes_total} pases libres${b.passes_period_end ? ` · se renuevan el ${M.fmtDate(b.passes_period_end + "T12:00:00Z")}` : ""}</span></div>`;
  /** Aviso claro de pago pendiente (paquete no usable) */
  M.paymentBanner = (b) => b && b.payment_blocked ? `<div class="panel pay-block" role="alert"><h3>⚠ Pago pendiente: tu paquete aún no se puede usar</h3>
    <p>El paquete <b>${M.esc(b.pending_payment_codes || "")}</b> (${b.pending_payment_classes} clases) tiene el pago pendiente. Mientras no se confirme el pago <b>no puedes solicitar ni reservar clases</b>.</p>
    <p class="small muted">Si ya pagaste, envía el comprobante al equipo de MEC; el admin lo confirma y tu calendario se habilita de inmediato.</p></div>` : "";
  M.PAY_LABEL = { pending: "Pendiente", paid: "Pagado", partial: "Parcial", overdue: "Vencido", refunded: "Reembolsado", cancelled: "Anulado" };

  /** Información de una clase del programa (1-160) */
  M.classInfo = function (n, program) {
    if (!n) return { title: "Sesión de refuerzo", type: "extra_reinforcement" };
    const li = Math.floor((n - 1) / 32), p = ((n - 1) % 32) + 1;
    const lvl = M.LEVELS[li], name = M.LEVEL_NAMES[program || "adultos"][li];
    if (p > 30) return { level: li + 1, levelCode: lvl, levelName: name, sub: null, pos: p, type: "review", title: `Repaso ${lvl}-${p - 30}` };
    const sub = Math.floor((p - 1) / 6) + 1, k = ((p - 1) % 6) + 1;
    const type = k <= 4 ? "content" : k === 5 ? "practice_studio" : "conversation_lab";
    const title = `${lvl}.${sub} · ` + (k <= 4 ? `Clase ${k}` : k === 5 ? "Practice Studio" : "Conversation Lab");
    return { level: li + 1, levelCode: lvl, levelName: name, sub, pos: p, k, type, title };
  };

  // --- Zona horaria: Bogotá es UTC-5 fijo (sin horario de verano) ---
  const OFF = 5 * 3600e3;
  M.bog = function (d) { // partes de fecha en hora Bogotá
    const x = new Date(new Date(d).getTime() - OFF);
    return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), h: x.getUTCHours(), min: x.getUTCMinutes(), dow: x.getUTCDay() || 7 };
  };
  M.bogDate = (y, m, d, h = 0) => new Date(Date.UTC(y, m - 1, d, h + 5));
  M.weekStart = function (ref) { // lunes 00:00 Bogotá de la semana de ref
    const p = M.bog(ref || new Date());
    return new Date(M.bogDate(p.y, p.m, p.d).getTime() - (p.dow - 1) * 864e5);
  };
  M.isValidSlot = function (d) {
    const p = M.bog(d);
    if (p.min !== 0) return false;
    if (p.dow >= 1 && p.dow <= 5) return p.h >= 6 && p.h <= 17;
    if (p.dow === 6) return p.h >= 10 && p.h <= 15;
    return false;
  };
  const fmt = (o) => new Intl.DateTimeFormat("es-CO", Object.assign({ timeZone: M.TZ }, o));
  M.fmtDateTime = (d) => fmt({ weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d)) + " (Bogotá)";
  M.fmtDate = (d) => fmt({ day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
  M.fmtTime = (d) => fmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d));
  M.DOW = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Material Kids: tipos permitidos y límite (igual que la migración 000700)
  M.KIDS_TYPES = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
  M.KIDS_MAX = 20 * 1024 * 1024;
  M.checkKidsFile = (f) => { const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (!M.KIDS_TYPES[ext] || M.KIDS_TYPES[ext] !== f.type) throw new Error("Tipo de archivo no permitido. Usa PDF, PNG, JPG, WEBP, DOCX o PPTX.");
    if (f.size > M.KIDS_MAX) throw new Error("El archivo supera 20 MB."); if (!f.size) throw new Error("Archivo vacío."); };
  M.kidsPath = (f) => { const ext = f.name.split(".").pop().toLowerCase(), base = f.name.slice(0, -(ext.length + 1)).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "archivo"; return `${Date.now()}-${base}.${ext}`; };
  M.kidsMaterialView = async (app) => {
    const render = async () => {
      const list = await M.api.listKidsMaterials();
      app.innerHTML = `<div class="panel"><h2>Material didáctico Kids</h2><p class="muted small">Se publica en la página Mastery4Kids (lectura pública). Tipos: PDF, PNG, JPG, WEBP, DOCX, PPTX · máximo 20 MB.</p>
        <form id="kup" class="row" style="flex-wrap:wrap;gap:10px;align-items:flex-end">
          <label style="flex:1 1 200px">Título<input id="kt" required maxlength="200"></label>
          <label style="flex:2 1 260px">Descripción (opcional)<input id="kd" maxlength="1000"></label>
          <label style="flex:1 1 220px">Archivo<input id="kf" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx"></label>
          <button class="btn">Subir</button></form></div>
        <div class="panel"><h3>Publicado (${list.length})</h3>${list.length ? `<table><thead><tr><th>Título</th><th>Archivo</th><th>Tamaño</th><th>Fecha</th><th></th></tr></thead><tbody>${list.map((m) =>
          `<tr><td>${M.esc(m.title)}${m.description ? `<div class="muted small">${M.esc(m.description)}</div>` : ""}</td><td class="small">${M.esc(m.file_path.split(".").pop().toUpperCase())}</td>
          <td class="small">${(m.size_bytes / 1048576).toFixed(1)} MB</td><td class="small">${M.esc(m.created_at.slice(0, 10))}</td>
          <td><button class="btn ghost sm" data-del="${M.esc(m.id)}">Eliminar</button></td></tr>`).join("")}</tbody></table>` : '<p class="muted">Aún no hay material publicado.</p>'}</div>`;
      M.$("#kup").onsubmit = M.wrapErr(async (e) => { e.preventDefault(); const f = M.$("#kf").files[0]; if (!f) throw new Error("Elige un archivo.");
        await M.api.uploadKidsMaterial(f, M.$("#kt").value.trim(), M.$("#kd").value.trim()); M.toast("Material publicado"); render(); });
      M.$$("[data-del]").forEach((b) => (b.onclick = M.wrapErr(async () => { if (!confirm("¿Eliminar este material?")) return; await M.api.deleteKidsMaterial(b.dataset.del); M.toast("Material eliminado"); render(); })));
    };
    await render();
  };
  // --- UI ---
  M.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  M.$ = (s, r) => (r || document).querySelector(s);
  M.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  M.toast = function (msg, err) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.className = err ? "err" : ""; t.style.display = "block";
    clearTimeout(t._h); t._h = setTimeout(() => (t.style.display = "none"), err ? 5000 : 2600);
  };
  M.tagStatus = (s) => `<span class="tag t-${s}">${M.STATUS_LABEL[s] || s}</span>`;
  M.tagType = (t) => `<span class="tag ${t === "conversation_lab" ? "t-lab" : t === "extra_reinforcement" ? "t-extra" : ""}">${M.TYPE_LABEL[t] || t}</span>`;
  M.modal = function (html, onMount, wide) {
    let m = document.getElementById("modal");
    if (!m) { m = document.createElement("div"); m.id = "modal"; m.className = "modal"; document.body.appendChild(m);
      m.addEventListener("click", (e) => { if (e.target === m) M.closeModal(); }); }
    m.innerHTML = `<div class="panel${wide ? " wide" : ""}">${html}</div>`; m.classList.add("on");
    if (onMount) onMount(m);
  };
  M.closeModal = () => { const m = document.getElementById("modal"); if (m) m.classList.remove("on"); };
  M.wrapErr = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { M.toast(e.message || String(e), true); console.error(e); } };

  /** Cabecera con logo, pestañas (uppercase) y usuario */
  M.header = function (user, tabs, onTab) {
    const el = document.createElement("header");
    el.className = "top";
    el.innerHTML = `<div class="wrap">
      <a class="brand" href="login.html"><img src="img/mec-logo-escudo-96.webp" alt="MEC" width="40" height="40">
        <span>MASTERY ENGLISH CLUB<small>CRM INTERNO</small></span></a>
      <nav class="tabs">${tabs.map((t, i) => `<button data-tab="${t[0]}" class="${i ? "" : "on"}">${t[1]}</button>`).join("")}</nav>
      <div class="who">${M.api.mode === "demo" ? '<span class="demo-badge">MODO DEMO</span>' : ""}
        <span>${M.esc(user.full_name)}</span><button class="btn ghost sm" id="logout">Salir</button></div></div>`;
    document.body.prepend(el);
    el.querySelector("#logout").onclick = async () => { await M.api.signOut(); location.href = "login.html"; };
    M.$$("nav.tabs button", el).forEach((b) => (b.onclick = () => {
      M.$$("nav.tabs button", el).forEach((x) => x.classList.toggle("on", x === b)); onTab(b.dataset.tab);
    }));
  };
  /** Exige sesión con el rol indicado; si no, vuelve al login */
  M.requireRole = async function (role) {
    const u = await M.api.currentUser();
    if (!u || u.role !== role) { location.href = "login.html"; throw new Error("sin sesión"); }
    return u;
  };
})();
