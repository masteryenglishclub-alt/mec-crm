/* MEC CRM – Perfil público de un teacher (pestaña nueva desde la Agenda). Datos reales de teacher_public_profiles (RLS decide qué se ve).
   Secciones v3: reseñas, certificaciones y estudiantes por nivel. Nunca se inventan datos: si la tabla no existe o no hay filas → estado vacío. */
(async () => {
  const M = MEC, app = M.$("#app"), esc = M.esc;
  const me = await M.api.currentUser();
  if (!me) { location.href = "login.html"; return; }
  await M.passwordGate(me);
  const qs = new URLSearchParams(location.search), id = qs.get("id") || "";
  const back = { admin: "admin.html", teacher: "teacher.html", student: "student.html" }[me.role] || "login.html";
  const el = document.createElement("header"); el.className = "top";
  el.innerHTML = `<div class="wrap"><a class="brand" href="${back}"><img src="img/mec-logo-escudo-96.webp" alt="MEC" width="40" height="40"><span>MASTERY ENGLISH CLUB<small>CRM INTERNO</small></span></a>
    <div class="who" style="margin-left:auto">${M.api.mode === "demo" ? '<span class="demo-badge">MODO DEMO</span>' : ""}<span>${esc(me.full_name || "")}</span></div></div>`;
  document.body.prepend(el);
  const safe = async (fn) => { try { return (await fn()) || []; } catch (e) { return []; } };
  try {
    const t = id ? await M.api.getTeacherProfile(id) : null;
    document.title = (t ? t.display_name : "Perfil del teacher") + " · MEC CRM";
    let extra = "", about = "", canEdit = false, editMode = false;
    if (t) {
      const staff = M.prof3.canSeeReviews(me, id);  // reseñas internas: ni se piden ni se pintan para estudiantes
      const [rev, cert, lv] = await Promise.all([
        staff ? safe(() => M.api.listTeacherReviews(id)) : [],
        safe(() => M.api.listTeacherCertifications && M.api.listTeacherCertifications(id)),
        safe(() => M.api.teacherLevelCounts && M.api.teacherLevelCounts(id))]);
      extra = M.prof3.sections(me, id, { reviews: rev, certs: cert, levels: lv });
      canEdit = M.prof3.canEditPersonal(me, id); editMode = canEdit && qs.get("editar") === "1";
      about = editMode ? M.prof3.editor(t) : M.prof3.personal(t);
    }
    app.innerHTML = `<div class="gbg bg-prf"><div class="stt-in pf-page"><div class="pf-top"><h1>${editMode ? "Editar mi perfil" : "Perfil del teacher"}</h1><span class="pf-acc">${canEdit && !editMode ? `<a class="sp-btn" href="?id=${encodeURIComponent(id)}&amp;editar=1">✎ Editar mi perfil</a> ` : ""}<a class="sp-btn" href="${back}">‹ Volver al CRM</a></span></div>` +
      (t ? M.perfil.teachersView([t], { omitPersonal: true }).replace(/^<p class="sp-intro">.*?<\/p>/, "") + about + extra
         : `<section class="sp-card"><h2>Perfil no disponible</h2><p class="sp-pend">Este teacher aún no tiene un perfil público${me.role === "admin" ? ". Créalo en Admin › Teachers." : "."}</p></section>`) + `</div></div>`;
    if (editMode) bindEditor(t);
  } catch (e) { app.innerHTML = `<div class="alert err">No se pudo cargar el perfil: ${esc(e.message || String(e))}</div>`; }
  function bindEditor(t) {
    const f = M.$("#pf4-f"), msg = M.$("#pf4-msg"), P = M.prof3, bio = f.querySelector("#pf4-bio");
    bio.oninput = () => { M.$("#pf4-cnt").textContent = `${bio.value.length} / ${P.LIM.bio}`; };
    const show = (cls, html) => { msg.className = "pf4-msg " + cls; msg.innerHTML = html; msg.scrollIntoView({ block: "nearest" }); };
    f.onsubmit = async (e) => { e.preventDefault(); const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
      const inp = { bio: bio.value, topics: [...f.querySelectorAll("input[name=topics]:checked")].map((x) => x.value) };
      P.GUSTOS.forEach(([k]) => { inp[k] = f.querySelector(`#pf4-${k}`).value; });
      const { data, warnings } = P.normalizePersonal(inp, t.topics);
      try { const r = await M.api.saveTeacherPersonal(id, data); Object.assign(t, data);
        const lbl = Object.fromEntries(P.GUSTOS); lbl.bio = "Bio"; lbl.topics = "Temas de interés";
        const w = warnings.length ? `<br><small>${warnings.map(esc).join(" ")}</small>` : "";
        if (r.pending && r.pending.length) show("warn", `<b>Guardado en parte.</b> Se guardó: ${r.saved.map((k) => esc(lbl[k] || k)).join(", ")}.<br><b>Aún no se pudo guardar:</b> ${r.pending.map((k) => esc(lbl[k] || k)).join(", ")}. La base de datos todavía no tiene esos campos (cambio pendiente de aprobación). Lo que escribiste sigue en el formulario.${w}`);
        else show("ok", `<b>Cambios guardados.</b>${w}`);
      } catch (err) { show("err", `<b>No se pudo guardar.</b> ${esc(err.message || String(err))}. Lo que escribiste sigue en el formulario.`); }
      finally { btn.disabled = false; } };
  }
})();
