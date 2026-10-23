/* MEC CRM – tarjetas de tests para el ESTUDIANTE (Inicio y Mi espacio). Solo lenguaje neutro:
   nunca muestra nivel, puntajes ni rúbrica. «Mi punto de partida» solo dice en curso / en revisión / completado.
   El resultado por categoría solo aparece si coordinación enciende pm_student_ve_perfil (apagado por defecto). */
(function () {
  const M = window.MEC, esc = M.esc;
  const CAT = { listening: "Listening", reading: "Reading", use_of_english: "Use of English", vocabulary: "Vocabulary", writing: "Writing", speaking: "Speaking" };
  const ST = { en_curso: ["En curso", "Continuar"], en_revision: ["En revisión por tu teacher", null], completado: ["Completado", null] };
  async function load() {
    let fl = { pm: false, qt: false }; try { fl = await M.tests.flags(); } catch (e) {}
    if (!fl.pm && !fl.qt) return null;
    const o = { fl, pm: [], qt: null, list: [] };
    if (fl.pm) o.pm = await M.tests.pmMyAttempts().catch(() => []);
    if (fl.qt) { o.list = await M.tests.qtList().catch(() => []); if (o.list[0] && o.list[0].last_done) o.qt = await M.tests.qtMyResult(o.list[0].code).catch(() => null); }
    return o;
  }
  const neutralBars = (r) => M.tcharts.bars(r.bars.map((b) => ({ label: b.label, value: b.pct })), { numbers: false, colors: M.tcharts.COLORS, title: "Cómo prefieres aprender", labelW: 120 });
  const pmBox = (o) => { const a = o.pm[0], s = a ? ST[a.state] : null; let cats = "";
    if (a && a.cats) cats = M.tcharts.radar(Object.keys(CAT).map((k) => ({ label: CAT[k], value: a.cats[k] && a.cats[k].n ? (a.cats[k].c / a.cats[k].n) * 100 : null })), { title: "Tu resultado por categoría" });
    return `<div class="sp-card tst-ent" data-tst="pm"><h2>Mi punto de partida</h2><p>${a ? `Estado: <span class="tst-estado">${esc(s[0])}</span>` : "Un recorrido de unos 30 a 45 minutos para ubicarte en el mejor lugar para empezar."}</p>${cats}
      <p><a class="sp-btn oro" href="test-nivel.html" ${a && !s[1] ? 'aria-disabled="true" style="display:none"' : ""}>${a ? s[1] || "" : "Empezar"}</a></p></div>`; };
  const qtBox = (o) => { const t = o.list[0], r = o.qt;
    return `<div class="sp-card tst-ent" data-tst="qt"><h2>${esc(t ? t.name : "Test de estilo de aprendizaje")}</h2>${r ? `<p><b>${esc(r.title)}</b></p>${neutralBars(r)}` : "<p>36 preguntas cortas para descubrir cómo te gusta aprender y recibir ideas para estudiar inglés.</p>"}
      <p><a class="sp-btn oro" href="test-estilo.html">${t && t.in_progress ? "Continuar" : r ? "Hacerlo de nuevo" : "Empezar"}</a></p></div>`; };
  /* Tarjeta completa para Inicio (perfil) y versión compacta para Mi espacio */
  async function self() { const o = await load(); if (!o) return ""; return `<section class="sp-card ancho" id="tst-mis"><h2>Mis tests</h2><div class="tst-entrada">${o.fl.pm ? pmBox(o) : ""}${o.fl.qt ? qtBox(o) : ""}</div></section>`; }
  async function entry() { const o = await load(); if (!o) return ""; return `<section class="sp-card" id="tst-esp"><h2>Mis tests</h2>${o.fl.pm ? `<p><b>Mi punto de partida</b> · ${o.pm[0] ? esc(ST[o.pm[0].state][0]) : "aún no lo has hecho"} <a class="sp-btn" href="test-nivel.html">${o.pm[0] ? "Abrir" : "Empezar"}</a></p>` : ""}
      ${o.fl.qt ? `<p><b>${esc(o.list[0] ? o.list[0].name : "Test de estilo de aprendizaje")}</b> · ${o.qt ? esc(o.qt.title) : "aún no lo has hecho"} <a class="sp-btn" href="test-estilo.html">${o.qt ? "Ver / repetir" : "Empezar"}</a></p>` : ""}</section>`; }
  /* Para la tarjeta «Estilo de aprendizaje» del perfil propio: barras neutras sin números */
  async function estiloSelf(prof) {
    let r = null; try { const fl = await M.tests.flags(); if (fl.qt) { const l = await M.tests.qtList(); if (l[0] && l[0].last_done) r = await M.tests.qtMyResult(l[0].code); } } catch (e) {}
    const any = !!(r || (prof && prof.style_visual != null)); let fl2 = { qt: false }; try { fl2 = await M.tests.flags(); } catch (e) {}
    const bars = r ? neutralBars(r) : prof && prof.style_visual != null ? M.tcharts.bars([{ label: "Mirando", value: prof.style_visual }, { label: "Escuchando", value: prof.style_auditory }, { label: "Haciendo", value: prof.style_kinesthetic }], { numbers: false, colors: M.tcharts.COLORS, title: "Cómo prefieres aprender", labelW: 120 }) : "";
    return `${any ? (r ? `<p><b>${esc(r.title)}</b></p>` : "") + bars : '<p class="sp-pend">Aún no hay estilo de aprendizaje registrado.</p>'}${fl2.qt ? `<p><a class="sp-btn" href="test-estilo.html">${any ? "Hacer el test de nuevo" : "Hacer el test"}</a></p>` : '<p class="sp-small">El test llegará muy pronto.</p>'}`;
  }
  M.testsCards = { self, entry, estiloSelf };
})();
