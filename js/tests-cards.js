/* MEC CRM – tarjetas de tests para el ESTUDIANTE (Inicio y Mi espacio).
   «Mi punto de partida»: en curso / en revisión / completado. Decisión del dueño (25-oct-2026): al quedar el resultado FINAL
   (cuando el teacher califica) el estudiante ve su nivel, su clase de inicio, el resultado por habilidad y por subnivel, y las notas del teacher.
   Nunca ve la rúbrica ni las respuestas correctas. */
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
  const neutralBars = (r) => M.tcharts.bars(r.bars.map((b) => ({ label: b.label, value: b.pct })), { numbers: false, colors: M.tcharts.COLORS, title: "Cómo prefieres aprender", labelW: 140 });
  const pct = (x) => (x && x.n ? Math.round((x.c / x.n) * 100) : null);
  /* Resultado completo de «Mi punto de partida» (solo cuando ya hay resultado final) */
  function pmResult(a, opts = {}) {
    const r = a && a.result; if (!r) return "";
    const n = r.start_class_number, code = n ? M.classCode(n) : "";
    const cats = a.cats ? Object.keys(CAT).filter((k) => a.cats[k] && a.cats[k].n) : [];
    const steps = {}; (Array.isArray(r.steps) ? r.steps : []).forEach((st) => { const b = st[0], c = Number(st[2]) || 0, t = Number(st[3]) || 0; if (!b || !t) return; steps[b] = steps[b] || { c: 0, n: 0 }; steps[b].c += c; steps[b].n += t; });
    const radar = opts.compact || cats.length < 3 ? "" : M.tcharts.radar(Object.keys(CAT).map((k) => ({ label: CAT[k], value: a.cats[k] && a.cats[k].n ? pct(a.cats[k]) : null })), { title: "Tu resultado por habilidad" });
    const agendar = r.placement === "omitido" ? '<p class="sp-small">Como ya tienes clases tomadas, MEC revisará contigo desde qué clase sigues.</p>'
      : n ? `<p><a class="sp-btn oro" href="#solicitar" data-tst-agendar>Agendar mi clase ${esc(code)}</a></p>` : "";
    return `<div class="tst-res">
      <p class="tst-nivel">Tu nivel: <b>${esc(r.level || "—")}</b> <span class="sp-small">(Marco Común Europeo)</span></p>
      ${n ? `<p class="tst-inicio">Tu clase de inicio: <b>${esc(code)}</b>${r.start_class_label ? ` <span class="sp-small">· ${esc(r.start_class_label)}</span>` : ""}</p>` : ""}${agendar}
      ${radar}
      ${cats.length ? `<h3>Por habilidad</h3><table class="tst-tabla"><thead><tr><th>Habilidad</th><th>Resultado</th><th></th></tr></thead><tbody>${cats.map((k) => { const v = pct(a.cats[k]);
        return `<tr><td>${esc(CAT[k])}</td><td>${a.cats[k].c} de ${a.cats[k].n}</td><td><span class="tst-barra" style="--v:${v}%"><i></i></span> ${v}%</td></tr>`; }).join("")}</tbody></table>` : ""}
      ${Object.keys(steps).length ? `<h3>Por subnivel</h3><table class="tst-tabla"><thead><tr><th>Subnivel</th><th>Aciertos</th><th></th></tr></thead><tbody>${Object.keys(steps).map((b) => { const v = pct(steps[b]);
        return `<tr><td>${esc(b)}</td><td>${steps[b].c} de ${steps[b].n}</td><td><span class="tst-barra" style="--v:${v}%"><i></i></span> ${v}%</td></tr>`; }).join("")}</tbody></table>` : ""}
      ${r.strengths ? `<h3>Tus fortalezas</h3><p>${esc(r.strengths)}</p>` : ""}${r.to_work_on ? `<h3>Para trabajar</h3><p>${esc(r.to_work_on)}</p>` : ""}</div>`;
  }
  const pmBox = (o) => { const a = o.pm[0], s = a ? ST[a.state] || ST.en_revision : null;
    return `<div class="sp-card tst-ent" data-tst="pm"><h2>Mi punto de partida</h2><p>${a ? `Estado: <span class="tst-estado">${esc(s[0])}</span>` : "Un recorrido de unos 30 a 45 minutos para ubicarte en el mejor lugar para empezar."}</p>${pmResult(a)}
      <p><a class="sp-btn oro" href="test-nivel.html" ${a && !s[1] ? 'aria-disabled="true" style="display:none"' : ""}>${a ? s[1] || "" : "Empezar"}</a></p></div>`; };
  /* Resultado completo del test de estilo (Mi espacio): el mismo contenido de la pantalla final del test */
  const qtResult = (r) => !r ? "" : `<div class="tst-res"><p class="tst-nivel"><b>${esc(r.title)}</b></p>${r.body ? `<p>${esc(r.body)}</p>` : ""}
      <h3>Tus tres formas de aprender</h3>${neutralBars(r)}${r.how_to_read ? `<p class="sp-small">${esc(r.how_to_read)}</p>` : ""}
      ${(r.tips || []).length ? `<h3>Ideas para empezar</h3><ul class="tst-tips">${r.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}${r.closing ? `<p><i>${esc(r.closing)}</i></p>` : ""}</div>`;
  const qtBox = (o) => { const t = o.list[0], r = o.qt;
    return `<div class="sp-card tst-ent" data-tst="qt"><h2>${esc(t ? t.name : "Test de estilo de aprendizaje")}</h2>${r ? `<p><b>${esc(r.title)}</b></p>${neutralBars(r)}` : "<p>36 preguntas cortas para descubrir cómo te gusta aprender y recibir ideas para estudiar inglés.</p>"}
      ${r && !(t && t.in_progress) ? "" : `<p><a class="sp-btn oro" href="test-estilo.html">${t && t.in_progress ? "Continuar" : "Empezar"}</a></p>`}</div>`; };
  /* Tarjeta completa para Inicio (perfil) y versión compacta para Mi espacio */
  async function self() { const o = await load(); if (!o) return ""; return `<section class="sp-card ancho" id="tst-mis"><h2>Mis tests</h2><div class="tst-entrada">${o.fl.pm ? pmBox(o) : ""}${o.fl.qt ? qtBox(o) : ""}</div></section>`; }
  async function entry() { const o = await load(); if (!o) return ""; return `<section class="sp-card" id="tst-esp"><h2>Mis tests</h2>${o.fl.pm ? `<p><b>Mi punto de partida</b> · ${o.pm[0] ? esc((ST[o.pm[0].state] || ST.en_revision)[0]) : "aún no lo has hecho"}${o.pm[0] && o.pm[0].result ? "" : ` <a class="sp-btn" href="test-nivel.html">${o.pm[0] ? "Abrir" : "Empezar"}</a>`}</p>${pmResult(o.pm[0])}` : ""}
      ${o.fl.qt ? `<p class="tst-sep"><b>${esc(o.list[0] ? o.list[0].name : "Test de estilo de aprendizaje")}</b>${o.qt ? "" : ` · ${o.list[0] && o.list[0].in_progress ? "en curso" : "aún no lo has hecho"} <a class="sp-btn" href="test-estilo.html">${o.list[0] && o.list[0].in_progress ? "Continuar" : "Empezar"}</a>`}</p>${qtResult(o.qt)}` : ""}</section>`; }
  /* Para la tarjeta «Estilo de aprendizaje» del perfil propio: barras neutras sin números */
  async function estiloSelf(prof) {
    let r = null; try { const fl = await M.tests.flags(); if (fl.qt) { const l = await M.tests.qtList(); if (l[0] && l[0].last_done) r = await M.tests.qtMyResult(l[0].code); } } catch (e) {}
    const any = !!(r || (prof && prof.style_visual != null)); let fl2 = { qt: false }; try { fl2 = await M.tests.flags(); } catch (e) {}
    const bars = r ? neutralBars(r) : prof && prof.style_visual != null ? M.tcharts.bars([{ label: "Mirando", value: prof.style_visual }, { label: "Escuchando", value: prof.style_auditory }, { label: "Haciendo", value: prof.style_kinesthetic }], { numbers: false, colors: M.tcharts.COLORS, title: "Cómo prefieres aprender", labelW: 120 }) : "";
    return `${any ? (r ? `<p><b>${esc(r.title)}</b></p>` : "") + bars : '<p class="sp-pend">Aún no hay estilo de aprendizaje registrado.</p>'}${fl2.qt ? (any ? "" : '<p><a class="sp-btn" href="test-estilo.html">Hacer el test</a></p>') : '<p class="sp-small">El test llegará muy pronto.</p>'}`;
  }
  M.testsCards = { self, entry, estiloSelf, pmResult };
})();
