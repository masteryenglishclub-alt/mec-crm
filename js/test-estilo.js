/* MEC CRM – «Test de estilo de aprendizaje» (página del estudiante). Las claves de puntaje viven solo en el servidor;
   aquí las opciones llevan ids opacos. Etiquetas neutras y barras sin números. */
(async () => {
  const M = MEC, T = M.tests, app = M.$("#app"), esc = M.esc;
  await M.requireRole("student");
  const BGS = ["intro", "reading", "vocabulary", "grammar", "listening"], setBg = (k) => document.body.style.setProperty("--bg", "url(" + new URL("img/test-nivel/fondo-" + k + ".svg", location.href).href + ")");
  const back = `<a class="tst-btn" href="student.html#espacio" style="text-decoration:none">Volver a mi portal</a>`;
  const fail = (e) => { app.innerHTML = `<section class="tst-card"><h2>Algo no salió bien</h2><p>${esc(e && e.message ? e.message : e)}</p><div class="tst-row"><button class="tst-btn" id="r">Reintentar</button> ${back}</div></section>`; M.$("#r").onclick = () => location.reload(); };
  const go = (fn) => async (...a) => { try { await fn(...a); } catch (e) { fail(e); } };
  let code = null, att = null, content = null, saved = {}, idx = 0;
  function result(r) {
    setBg("resultado");
    app.innerHTML = `<section class="tst-card"><p class="tst-sec">${esc(r.name)}</p><h1>${esc(r.title)}</h1><p class="tst-en">${esc(r.body)}</p>
      <h2>Tus tres formas de aprender</h2><div class="tst-bars">${M.tcharts.bars(r.bars.map((b) => ({ label: b.label, value: b.pct })), { numbers: false, colors: M.tcharts.COLORS, title: "Cómo prefieres aprender", labelW: 130 })}</div>
      <p class="tst-es">${esc(r.how_to_read || "")}</p>
      <h2>Ideas para empezar</h2><ul class="tst-tips">${(r.tips || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul><p class="tst-en"><i>${esc(r.closing || "")}</i></p>
      <div class="tst-row">${back}</div></section>`;
  }
  function question() {
    const qs = content.questions, q = qs[idx], n = qs.length; setBg(BGS[Math.floor((idx / n) * BGS.length)]);
    app.innerHTML = `<section class="tst-card"><p class="tst-sec">Pregunta ${idx + 1} de ${n}</p><div class="tst-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${idx + 1}"><i style="width:${((idx + 1) / n) * 100}%"></i></div>
      <p class="tst-q">${esc(q.text)}</p><ul class="tst-opts">${q.options.map((o, k) => `<li><button class="tst-opt" data-o="${esc(o.id)}" aria-pressed="${saved[q.id] === o.id}"><b>${"abcdefg"[k] || k + 1}</b><span>${esc(o.text)}</span></button></li>`).join("")}</ul>
      <div class="tst-row">${idx ? `<button class="tst-btn sec" id="pv">Anterior</button>` : ""}<button class="tst-btn" id="nx" ${saved[q.id] ? "" : "disabled"}>${idx === n - 1 ? "Ver mi resultado" : "Siguiente"}</button></div></section>`;
    M.$$(".tst-opt").forEach((b) => (b.onclick = go(async () => { M.$$(".tst-opt").forEach((x) => x.setAttribute("aria-pressed", x === b)); await T.qtSave(att, q.id, b.dataset.o); saved[q.id] = b.dataset.o; M.$("#nx").disabled = false; })));
    const pv = M.$("#pv"); if (pv) pv.onclick = () => { idx--; question(); };
    M.$("#nx").onclick = go(async () => { if (idx < n - 1) { idx++; question(); } else result(await T.qtSubmit(att).then(() => T.qtMyResult(code))); });
    scrollTo(0, 0);
  }
  try {
    const list = await T.qtList();
    if (!list || !list.length) { app.innerHTML = `<section class="tst-card"><h1>Test de estilo de aprendizaje</h1><p>Estará disponible muy pronto.</p><div class="tst-row">${back}</div></section>`; return; }
    code = list[0].code; const t = list[0]; setBg("intro");
    const prev = t.last_done ? await T.qtMyResult(code).catch(() => null) : null;
    const welcome = (intro) => { app.innerHTML = `<section class="tst-card"><h1>${esc(t.name)}</h1><p class="tst-en">${esc(intro || "Contesta las preguntas eligiendo lo que más se parece a ti. No hay respuestas buenas ni malas.")}</p><p class="tst-es">Dura unos 10 minutos. Tus respuestas se guardan a medida que avanzas.</p>
      <div class="tst-row"><button class="tst-btn" id="go">${t.in_progress ? "Continuar" : prev ? "Hacerlo de nuevo" : "Empezar"}</button>${prev ? `<button class="tst-btn sec" id="ver">Ver mi último resultado</button>` : ""}</div></section>`;
      M.$("#go").onclick = go(async () => { att = await T.qtStart(code); content = await T.qtContent(att); saved = Object.assign({}, content.saved || {}); idx = Math.min(content.questions.length - 1, Object.keys(saved).length); question(); });
      const v = M.$("#ver"); if (v) v.onclick = () => result(prev); };
    welcome(null);
  } catch (e) { app.innerHTML = `<section class="tst-card"><h1>Test de estilo de aprendizaje</h1><p>Todavía no está disponible. Estará listo muy pronto.</p><div class="tst-row">${back}</div></section>`; }
})();
