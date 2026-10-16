/* MEC CRM · Componentes de perfil sobre datos reales de Supabase (o demo local).
   «Mis clases» del estudiante, «Teachers» y el buscador «Estudiantes» del staff.
   Nunca muestra puntajes de rúbrica ni evaluaciones internas. */
(function () {
  const M = window.MEC, esc = M.esc;
  // Paquetes v3 (tabla oficial; COP). El Upgrade propone el siguiente del mismo tipo y lleva a precios.html.
  const V3 = { P: [["P1", 4], ["P2", 8], ["P3", 16], ["P4", 24]], G: [["G1", 8], ["G2", 16], ["G3", 24]], C: [["C1", 12, "4 personalizadas + 8 grupales"], ["C2", 20, "8 personalizadas + 12 grupales"], ["C3", 28, "12 personalizadas + 16 grupales"]] };
  const NAME = { SP: "Clase personalizada suelta", SG: "Clase grupal suelta" };
  const TIPO = { P: "Personalizadas 1 a 1", G: "Grupales", C: "Combinado" }, ANCLA = { P: "personalizadas", G: "grupales", C: "combinados" };
  const card = (t, body, cls = "") => `<section class="sp-card ${cls}"><h2>${t}</h2>${body}</section>`;
  const lista = (a, vacio = "Por completar") => a && a.length ? `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="sp-pend">${vacio}</p>`;
  const addMeses = (d, n) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString(); };
  const NIV = ["A1", "A2", "B1", "B2", "C1", "C2"];

  function mcer(done) { // % completado de cada nivel (32 clases por nivel; C2 fuera del programa actual)
    const o = {}; NIV.forEach((k, i) => { o[k] = i < 5 ? Math.round(Math.max(0, Math.min(32, done - i * 32)) / 32 * 100) : 0; }); return o;
  }
  function mcerSvg(m) {
    const ks = Object.keys(m), bw = 60, gap = 22, x0 = 30;
    const bars = ks.map((k, i) => { const x = x0 + i * (bw + gap), bh = (m[k] / 100) * 120, cur = m[k] > 0 && m[k] < 100;
      return `<rect x="${x}" y="20" width="${bw}" height="120" rx="6" fill="#132438" stroke="#2c4462"/><rect x="${x}" y="${140 - bh}" width="${bw}" height="${bh}" rx="6" fill="${cur ? "#3ccf8e" : "#2f7fe0"}"/>
        <text x="${x + bw / 2}" y="165" text-anchor="middle" fill="#f0c46a" font-weight="700" font-size="15">${k}</text><text x="${x + bw / 2}" y="${Math.min(134, 136 - bh) - 4}" text-anchor="middle" fill="#e8edf3" font-size="12">${m[k] ? m[k] + "%" : ""}</text>`; }).join("");
    return `<svg viewBox="0 0 520 190" class="sp-chart" role="img" aria-label="Progreso en el Marco Común Europeo: ${ks.map((k) => k + " " + m[k] + "%").join(", ")}">${bars}</svg>`;
  }
  function estiloSvg(e) {
    const ks = Object.keys(e), cols = ["#2f7fe0", "#c0862a", "#3ccf8e"], C = 2 * Math.PI * 50; let off = 0;
    const arcs = ks.map((k, i) => { const l = (e[k] / 100) * C, s = `<circle cx="70" cy="70" r="50" fill="none" stroke="${cols[i]}" stroke-width="22" stroke-dasharray="${l} ${C - l}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`; off += l; return s; }).join("");
    return `<div class="sp-estilo"><svg viewBox="0 0 140 140" class="sp-donut" role="img" aria-label="Estilo de aprendizaje: ${ks.map((k) => k + " " + e[k] + "%").join(", ")}">${arcs}</svg><ul class="sp-ley">${ks.map((k, i) => `<li><i style="background:${cols[i]}"></i>${k} · ${e[k]}%</li>`).join("")}</ul></div>`;
  }
  // Upgrade: siguiente paquete del MISMO tipo (P1→P2→P3→P4, G1→G2→G3, C1→C2→C3). En P4/G3/C3: sin botón.
  // Paquetes antiguos (P1-USD…P6-USD) o sueltas: primer personalizado v3 con MÁS clases que el actual.
  function upgrade(p) {
    const code = String(p.package_code || "").toUpperCase(), t = code[0], arr = /^[PGC]\d$/.test(code) ? V3[t] : null;
    let sig, tt = t;
    if (arr && arr.some((x) => x[0] === code)) sig = arr[arr.findIndex((x) => x[0] === code) + 1];
    else { tt = "P"; sig = V3.P.find((x) => x[1] > (p.classes_total || 0)); }
    return sig ? `<a class="sp-btn oro" href="precios.html#${ANCLA[tt]}">Upgrade · Pasa a ${sig[0]} · ${sig[2] ? sig[2] : sig[1] + " clases"}</a>` : `<p class="sp-small">Ya tienes el paquete más grande. <a href="precios.html">Ver precios</a></p>`;
  }


  /* ctx = { s: estudiante (listStudents), pkgs, classes, prof: student_profiles|null, note: (solo staff) objeto|null|undefined, agendar: href|null, self: bool } */
  function misClases(ctx) {
    const s = ctx.s, done = Math.max(0, (s.start_class_number || 1) - 1 + (s.classes_completed || 0)), now = new Date();
    const you = ctx.self ? "Aún no tienes" : "Aún no tiene";
    const cur = done > 0 ? M.classInfo(done, s.program) : null, next = done < 160 ? M.classInfo(done + 1, s.program) : null;
    const sched = ctx.classes.filter((c) => c.status === "scheduled" && new Date(c.starts_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    const past = ctx.classes.filter((c) => c.status === "completed").sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    const fbs = past.filter((c) => c.teacher_note || (c.sentences && c.sentences.length));
    const live = ctx.pkgs.filter((p) => !["refunded", "cancelled"].includes(p.payment_status)).sort((a, b) => String(b.purchase_date).localeCompare(String(a.purchase_date)));
    const p = live[0];
    let paq;
    if (!p) paq = `<p class="sp-pend">${you} un paquete activo.</p><a class="sp-btn oro" href="precios.html">Ver paquetes y precios</a>`;
    else {
      const tot = p.classes_total, used = p.classes_used, quedan = p.classes_remaining ?? tot - used, code = String(p.package_code || "").toUpperCase();
      const vence = p.expiry_date || addMeses(p.purchase_date, tot > 20 ? 12 : 6);
      const v3 = /^[PGC]\d$/.test(code) && V3[code[0]].find((x) => x[0] === code);
      paq = `<p class="sp-paq"><strong>${esc(NAME[code] || code || "Paquete")}</strong>${v3 ? " · " + TIPO[code[0]] + " · " + (v3[2] || tot + " clases") : ` · ${tot} clase${tot === 1 ? "" : "s"}`}${code.endsWith("-USD") ? " (catálogo anterior)" : ""}${p.payment_status === "pending" ? ' <span class="sp-tag">Pago pendiente</span>' : ""}</p>
        <div class="sp-cont"><div><b>${tot}</b><small>compradas</small></div><div><b>${used}</b><small>tomadas</small></div><div><b>${quedan}</b><small>${ctx.self ? "te quedan" : "quedan"}</small></div></div>
        <div class="sp-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${tot}" aria-valuenow="${used}" aria-label="Clases tomadas"><i style="width:${tot ? (used / tot) * 100 : 0}%"></i></div>
        <p class="sp-small">Comprado el ${M.fmtDate(p.purchase_date)} · <strong>Vence el ${M.fmtDate(vence)}</strong> (${tot > 20 ? "1 año: más de 20 clases" : "6 meses: 20 clases o menos"})</p>${ctx.self ? upgrade(p) : ""}`;
    }
    const pr = ctx.prof || {}, hasBio = [pr.goals, pr.likes, pr.personality].some((a) => a && a.length);
    const est = pr.style_visual != null ? { Visual: pr.style_visual, Auditivo: pr.style_auditory, "Kinestésico": pr.style_kinesthetic } : null;
    const lvl = cur || next;
    const nota = ctx.note === undefined ? "" : card(`Nota privada del profesor <span class="sp-tag">Solo staff</span>`, ctx.note && ctx.note.notes ? `<p>${esc(ctx.note.notes)}</p>` : `<p class="sp-pend">Aún no hay notas privadas.</p>`, "ancho st-nota");
    return `<div class="sp-grid">${nota}
      ${card("Datos", `<dl class="sp-dl"><dt>Estudiante</dt><dd>${esc(s.full_name || "—")}</dd><dt>En MEC desde</dt><dd>${s.start_date ? M.fmtDate(String(s.start_date).length === 10 ? s.start_date + "T12:00:00Z" : s.start_date) : "—"}</dd><dt>Programa</dt><dd>${s.program === "kids" ? "Kids" : "Adultos"}</dd><dt>Teacher</dt><dd>${esc(s.teacher_name || "Por asignar")}</dd>
        <dt>Nivel actual</dt><dd>${lvl ? `<span class="sp-nivel">${lvl.levelCode}</span> ${lvl.sub ? "Subnivel " + lvl.levelCode + "." + lvl.sub : "Repaso"} · ${esc(lvl.levelName || s.level_name || "")}` : "—"}</dd></dl>`)}
      ${card(ctx.self ? "Mi paquete" : "Paquete", paq)}
      ${card("Clases anteriores", past.length ? `<ol class="sp-hist">${past.slice(0, 12).map((c) => `<li><time datetime="${c.starts_at}">${M.fmtDate(c.starts_at)}</time><span>${esc(c.title || M.classInfo(c.class_number, s.program).title)}</span></li>`).join("")}</ol>${past.length > 12 ? `<p class="sp-small">… y ${past.length - 12} más.</p>` : ""}` : `<p class="sp-pend">Aún no hay clases anteriores.</p>`)}
      ${card("Clase actual", cur ? `<p class="sp-cod">${esc(cur.title)}</p><p class="sp-small">Clase ${done} de 160 del programa.</p>` : `<p class="sp-pend">Aún no hay clases completadas.</p>`)}
      ${card("Próxima clase", next ? `<p class="sp-cod">${esc(next.title)}</p>` + (sched ? `<div class="sp-variante ok"><span class="sp-tag ok">Agendada</span><span>${M.fmtDateTime(sched.starts_at)} · Teacher ${esc(sched.teacher_name || s.teacher_name || "")}</span></div>`
        : `<div class="sp-variante"><span class="sp-tag">Sin agendar</span>${ctx.agendar ? `<a class="sp-btn" href="${ctx.agendar}">Agendar</a>` : ""}</div>`) : `<p class="sp-pend">Programa completado.</p>`)}
      ${card(ctx.self ? "Mis feedbacks" : "Feedbacks", fbs.length ? `<ul class="sp-fb">${fbs.slice(0, 8).map((c) => `<li><div class="sp-fb-h"><strong>${esc(c.title || "")}</strong><time>${M.fmtDate(c.starts_at)}</time></div>${c.teacher_note ? `<p>${esc(c.teacher_note)}</p>` : ""}${c.sentences && c.sentences.length ? `<p class="sp-small">Frases: ${c.sentences.map(esc).join(" · ")}</p>` : ""}</li>`).join("")}</ul>` : `<p class="sp-pend">Aún no hay feedback.</p>`, "ancho")}
      ${card(`${ctx.self ? "Mi BIO" : "BIO"} ${pr.bio_status === "completa" ? '<span class="sp-tag ok">Completa</span>' : '<span class="sp-tag">En construcción</span>'}`, (ctx.self ? `<p class="sp-small">Tu teacher la va completando a medida que te conoce.</p>` : "") +
        (hasBio ? `<div class="sp-bio"><div><h3>Metas</h3>${lista(pr.goals)}</div><div><h3>Gustos</h3>${lista(pr.likes)}</div><div><h3>Personalidad</h3>${lista(pr.personality)}</div></div>` : `<p class="sp-pend">Aún no hay BIO.</p>`), "ancho")}
      ${card(`${ctx.self ? "Mi progreso" : "Progreso"} · Marco Común Europeo`, mcerSvg(mcer(done)) + `<p class="sp-small">Calculado con las clases completadas del programa (${done} de 160). Cada nivel tiene 5 subniveles.</p>`)}
      ${card("Estilo de aprendizaje", (est ? estiloSvg(est) : `<p class="sp-pend">Aún no hay estilo de aprendizaje registrado.</p>`) + (ctx.self ? `<p><button type="button" class="sp-btn" data-pf-test aria-describedby="pf-test-n">Hacer test</button> <span id="pf-test-n" class="sp-small" hidden>Próximamente</span></p>` : ""))}
    </div>`;
  }
  const bindTest = (r) => { const b = r.querySelector("[data-pf-test]"); if (b) b.onclick = () => { r.querySelector("#pf-test-n").hidden = false; }; };

  const avatar = (c) => `<svg viewBox="0 0 100 100" class="sp-av" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="#1b2a3c"/><path d="M14 100c2-20 18-30 36-30s34 10 36 30z" fill="${c}"/><circle cx="50" cy="44" r="21" fill="#4a5d75"/></svg>`;
  const ESTILO = { visual: "Visual", auditivo: "Auditivo", kinestesico: "Kinestésico" };
  /* opts = { myTeacherId, agendar: href } */
  function teachersView(list, opts = {}) {
    if (!list.length) return `<p class="sp-intro">Conoce a nuestros teachers.</p><div class="sp-card"><p class="sp-pend">Aún no hay perfiles de teachers publicados.</p></div>`;
    return `<p class="sp-intro">Conoce a nuestros teachers.</p><div class="sp-teachers">${list.map((t) => { const c = /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : "#2f7fe0", n = esc(t.display_name);
      const mine = t.teacher_id === opts.myTeacherId;
      return `<article class="sp-teacher" style="--c:${c}"><header>${t.photo_url ? `<img src="${esc(t.photo_url)}" width="114" height="133" alt="Foto de ${n}">` : avatar(c)}
        <div><h2>${n}</h2><p class="sp-rol">${esc(t.role_title || "Teacher")}</p>${mine ? '<span class="sp-tag ok">Tu teacher</span>' : ""}</div></header>
        <h3>BIO</h3>${t.bio ? `<p class="sp-bio-t">${esc(t.bio)}</p>` : '<p class="sp-pend">Por completar</p>'}
        <div class="sp-tcols"><div><h3>Experiencia</h3>${lista(t.experience)}</div><div><h3>Fortalezas</h3>${lista(t.strengths)}</div>
        <div><h3>Estilo de enseñanza preferido</h3>${t.teaching_style ? `<p>${ESTILO[t.teaching_style]}</p>` : '<p class="sp-pend">Por completar</p>'}</div>
        <div><h3>Hobbies y gustos</h3>${lista(t.hobbies)}</div><div><h3>Temas de interés</h3>${lista(t.topics)}</div></div>
        ${opts.agendar ? (mine ? `<p><a class="sp-btn tcolor" href="${opts.agendar}">Agendar con ${n}</a></p>` : `<p class="sp-small">Para tomar clases con ${n}, pide al admin un cambio de teacher.</p>`) : ""}</article>`; }).join("")}</div>`;
  }

  /* Buscador de estudiantes para staff. opts = { students, showTeacher, title, extra(s) → html, bindExtra(root) } */
  async function studentsBrowser(root, opts) {
    const api = M.api, st = opts.students.slice().sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), "es"));
    const lvl = (s) => M.classInfo(Math.min(160, Math.max(1, (s.start_class_number || 1) - 1 + (s.classes_completed || 0) || 1)), s.program).levelCode;
    const teachers = [...new Set(st.map((s) => s.teacher_name || "Por asignar"))].sort();
    root.innerHTML = `<div id="pf-lista"><div class="st-filtros" role="search">
        <label>Buscar<input id="pf-q" type="search" placeholder="Nombre del estudiante"></label>
        <label>Nivel<select id="pf-niv"><option value="">Todos</option>${M.LEVELS.map((l) => `<option>${l}</option>`).join("")}</select></label>
        ${opts.showTeacher ? `<label>Teacher<select id="pf-prof"><option value="">Todos</option>${teachers.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label>` : ""}</div>
      <p class="sp-small" id="pf-cuenta" aria-live="polite"></p><div class="st-grid" id="pf-grid"></div></div><div id="pf-perfil" hidden></div>`;
    const $ = (s) => root.querySelector(s);
    const draw = () => {
      const q = $("#pf-q").value.trim().toLowerCase(), nv = $("#pf-niv").value, pr = opts.showTeacher ? $("#pf-prof").value : "";
      const r = st.filter((s) => (!q || String(s.full_name || "").toLowerCase().includes(q)) && (!nv || lvl(s) === nv) && (!pr || (s.teacher_name || "Por asignar") === pr));
      $("#pf-cuenta").textContent = `${r.length} de ${st.length} estudiantes`;
      $("#pf-grid").innerHTML = r.map((s) => { const done = (s.start_class_number || 1) - 1 + (s.classes_completed || 0), i = M.classInfo(Math.max(1, done), s.program);
        return `<div class="st-item" style="--c:#2f7fe0"><button type="button" class="link" data-pf="${s.id}" style="all:unset;cursor:pointer"><strong>${esc(s.full_name || "—")}</strong></button>
        <span><span class="sp-nivel">${i.levelCode}</span> ${done ? esc(i.title) : "Sin clases aún"} · ${s.program === "kids" ? "Kids" : "Adultos"}</span>${opts.showTeacher ? `<small>Teacher: ${esc(s.teacher_name || "Por asignar")}</small>` : ""}
        ${opts.extra ? opts.extra(s) : ""}</div>`; }).join("") || `<p class="sp-pend">${st.length ? "Sin resultados." : "Aún no hay estudiantes."}</p>`;
      if (opts.bindExtra) opts.bindExtra($("#pf-grid"));
    };
    const open = M.wrapErr(async (id) => {
      const s = st.find((x) => x.id === id); if (!s) return;
      const v = $("#pf-perfil"); $("#pf-lista").hidden = true; v.hidden = false; v.innerHTML = '<p class="muted">Cargando…</p>';
      const [pkgs, classes, prof, note] = await Promise.all([api.listStudentPackages(id), api.listClasses({ studentId: id }), api.getStudentProfile(id), api.getInternalNote(id)]);
      v.innerHTML = `<p><button type="button" class="sp-btn" id="pf-volver">‹ Volver a la lista</button> <button type="button" class="sp-btn oro" id="pf-editar">Editar</button></p><h2 class="st-nombre" tabindex="-1">${esc(s.full_name || "—")}</h2>` + misClases({ s, pkgs, classes, prof, note: note || null, self: false });
      v.querySelector(".st-nombre").focus();
      $("#pf-editar").onclick = () => editStudent(s, prof, classes, () => open(id));
      $("#pf-volver").onclick = () => { v.hidden = true; $("#pf-lista").hidden = false; const b = root.querySelector(`[data-pf="${id}"]`); if (b) b.focus(); };
    });
    ["#pf-q", "#pf-niv", "#pf-prof"].forEach((s) => { const el = $(s); if (el) el.addEventListener("input", draw); });
    $("#pf-grid").addEventListener("click", (e) => { const b = e.target.closest("[data-pf]"); if (b) open(b.dataset.pf); });
    draw();
  }

  /* ---------- Edición (staff). La seguridad real está en RLS: el teacher solo guarda en sus estudiantes/clases. ---------- */
  const lines = (v) => v.split("\n").map((x) => x.trim()).filter(Boolean);
  const ta = (id, label, arr, help) => `<label for="${id}">${label}</label><textarea id="${id}" rows="3" aria-describedby="${id}-h">${esc((arr || []).join("\n"))}</textarea><p class="muted small" id="${id}-h">${help || "Una por línea."}</p>`;
  async function editStudent(s, prof, classes, done) {
    const me = await M.api.currentUser(), pr = prof || {};
    const fbCls = classes.filter((c) => c.status === "completed" && (me.role === "admin" || c.teacher_id === me.id)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    M.modal(`<h2>Editar · ${esc(s.full_name || "")}</h2>
      <fieldset class="pf-fs"><legend>BIO</legend>
        <label for="e-st">Estado</label><select id="e-st"><option value="en_construccion">En construcción</option><option value="completa" ${pr.bio_status === "completa" ? "selected" : ""}>Completa</option></select>
        ${ta("e-go", "Metas", pr.goals)}${ta("e-li", "Gustos", pr.likes)}${ta("e-pe", "Personalidad", pr.personality)}</fieldset>
      <fieldset class="pf-fs"><legend>Estilo de aprendizaje (suma 100)</legend><div class="row">
        <div><label for="e-v">Visual</label><input id="e-v" type="number" min="0" max="100" value="${pr.style_visual ?? ""}"></div>
        <div><label for="e-a">Auditivo</label><input id="e-a" type="number" min="0" max="100" value="${pr.style_auditory ?? ""}"></div>
        <div><label for="e-k">Kinestésico</label><input id="e-k" type="number" min="0" max="100" value="${pr.style_kinesthetic ?? ""}"></div></div>
        <p class="small" id="e-sum" aria-live="polite"></p><p class="muted small">Déjalos los tres vacíos si aún no lo conoces.</p></fieldset>
      <p><button class="btn" id="e-ok">Guardar BIO y estilo</button> <button class="btn ghost" onclick="MEC.closeModal()">Cerrar</button></p>
      <fieldset class="pf-fs"><legend>Feedback por clase</legend>${fbCls.length ? fbCls.slice(0, 20).map((c) => `<div class="cls"><div><b>${esc(c.title || "")}</b><br><span class="muted small">${M.fmtDateTime(c.starts_at)}${c.teacher_note || c.sentences ? " · con feedback" : " · sin feedback"}</span></div>
        <div><button class="btn ghost sm" data-efb="${c.id}">${c.teacher_note || c.sentences ? "Editar" : "Escribir"} feedback</button></div></div>`).join("") : '<p class="muted">Aún no hay clases completadas para dar feedback.</p>'}</fieldset>`, () => {
      const num = (id) => { const v = M.$(id).value.trim(); return v === "" ? null : Math.round(+v); };
      const sum = () => { const a = ["#e-v", "#e-a", "#e-k"].map(num); M.$("#e-sum").textContent = a.every((x) => x == null) ? "Sin estilo registrado." : `Suma: ${a.reduce((x, y) => x + (y || 0), 0)} de 100`; };
      ["#e-v", "#e-a", "#e-k"].forEach((i) => M.$(i).addEventListener("input", sum)); sum();
      M.$("#e-ok").onclick = M.wrapErr(async () => {
        const v = num("#e-v"), a = num("#e-a"), k = num("#e-k"), arr = [v, a, k];
        if (arr.some((x) => x != null) && (arr.some((x) => x == null || x < 0 || x > 100) || v + a + k !== 100)) throw new Error("El estilo de aprendizaje debe sumar 100 (o dejar los tres vacíos)");
        await M.api.saveStudentProfile(s.id, { bio_status: M.$("#e-st").value, goals: lines(M.$("#e-go").value), likes: lines(M.$("#e-li").value), personality: lines(M.$("#e-pe").value),
          style_visual: v, style_auditory: a, style_kinesthetic: k });
        M.closeModal(); M.toast("Perfil guardado"); done(); });
      M.$$("[data-efb]").forEach((b) => (b.onclick = () => editFeedback(fbCls.find((c) => c.id === b.dataset.efb), done)));
    });
  }
  function editFeedback(c, done) {
    const s = c.sentences || [];
    M.modal(`<h2>Feedback · ${esc(c.title || "")}</h2><p class="muted small">${M.fmtDateTime(c.starts_at)} · <b>visible para el estudiante</b></p>
      <label for="f-n">Nota del teacher</label><textarea id="f-n" rows="3">${esc(c.teacher_note || "")}</textarea>
      <label>My sentences today (3 a 5 frases)</label><div id="f-s">${[0, 1, 2, 3, 4].map((i) => `<input style="margin-bottom:6px" aria-label="Frase ${i + 1}" placeholder="Frase ${i + 1}${i > 2 ? " (opcional)" : ""}" value="${esc(s[i] || "")}">`).join("")}</div>
      <p><button class="btn" id="f-ok">Guardar</button> <button class="btn ghost" onclick="MEC.closeModal()">Cancelar</button></p>`, () => {
      M.$("#f-ok").onclick = M.wrapErr(async () => { const arr = M.$$("#f-s input").map((i) => i.value.trim()).filter(Boolean);
        if (arr.length < 3) throw new Error("Escribe al menos 3 frases");
        await M.api.saveFeedback(c.id, M.$("#f-n").value.trim(), arr); M.closeModal(); M.toast("Feedback guardado"); done(); });
    });
  }
  /* Formulario del perfil público del teacher (teacher: el suyo; admin: todos + «published») */
  async function teacherForm(root, tid, fullName, opts) {
    const t = (await M.api.getTeacherProfile(tid)) || { display_name: fullName, color: "#2f7fe0", published: false };
    root.innerHTML = `<form class="panel" id="tp-f" novalidate><div class="row">
        <div><label for="t-n">Nombre visible</label><input id="t-n" required value="${esc(t.display_name || fullName || "")}"></div>
        <div><label for="t-r">Cargo</label><input id="t-r" value="${esc(t.role_title || "")}" placeholder="Teacher"></div>
        <div style="flex:0 0 120px"><label for="t-c">Color</label><input id="t-c" type="color" value="${/^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : "#2f7fe0"}"></div></div>
      <label for="t-p">Foto (URL https:// o ruta img/…)</label><input id="t-p" value="${esc(t.photo_url || "")}">
      <label for="t-b">BIO</label><textarea id="t-b" rows="3">${esc(t.bio || "")}</textarea>
      ${ta("t-ex", "Experiencia", t.experience)}${ta("t-fo", "Fortalezas", t.strengths)}
      <label for="t-s">Estilo de enseñanza preferido</label><select id="t-s"><option value="">Por completar</option>${[["visual", "Visual"], ["auditivo", "Auditivo"], ["kinestesico", "Kinestésico"]].map(([k, n]) => `<option value="${k}" ${t.teaching_style === k ? "selected" : ""}>${n}</option>`).join("")}</select>
      ${ta("t-ho", "Hobbies y gustos", t.hobbies)}${ta("t-to", "Temas de interés", t.topics)}
      ${opts.admin ? `<label class="pf-check"><input type="checkbox" id="t-pub" ${t.published ? "checked" : ""}> Publicado (visible para los estudiantes en «Teachers»)</label>`
        : `<p class="small">Estado: ${t.published ? "<b>Publicado</b>" : "<b>Sin publicar</b>: el admin decide cuándo se publica."}</p>`}
      <p><button class="btn" type="submit">Guardar perfil</button>${opts.modal ? ' <button type="button" class="btn ghost" onclick="MEC.closeModal()">Cerrar</button>' : ""}</p></form>`;
    root.querySelector("#tp-f").onsubmit = M.wrapErr(async (e) => { e.preventDefault();
      const g = (i) => root.querySelector(i), photo = g("#t-p").value.trim();
      if (!g("#t-n").value.trim()) throw new Error("Escribe el nombre visible");
      if (photo && !/^(https:\/\/|img\/)/.test(photo)) throw new Error("La foto debe ser una URL https:// o una ruta img/…");
      const o = { display_name: g("#t-n").value.trim(), role_title: g("#t-r").value.trim() || null, color: g("#t-c").value, photo_url: photo || null, bio: g("#t-b").value.trim() || null,
        experience: lines(g("#t-ex").value), strengths: lines(g("#t-fo").value), teaching_style: g("#t-s").value || null, hobbies: lines(g("#t-ho").value), topics: lines(g("#t-to").value) };
      if (opts.admin) o.published = g("#t-pub").checked;
      await M.api.saveTeacherProfile(tid, o); M.toast("Perfil guardado"); if (opts.onSaved) { M.closeModal(); opts.onSaved(); } });
  }
  function editTeacher(tid, name, opts) {
    M.modal(`<h2>Perfil público · ${esc(name)}</h2><div id="tp-m"></div>`, () => teacherForm(M.$("#tp-m"), tid, name, Object.assign({ modal: true }, opts)));
  }
  M.perfil = { misClases, teachersView, studentsBrowser, bindTest, editStudent, teacherForm, editTeacher };
})();
