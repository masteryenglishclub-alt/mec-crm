/* MEC CRM – «Mi punto de partida» (página del estudiante). Todo el ruteo y la corrección ocurren en el servidor: aquí solo se muestra
   una pregunta a la vez y se envía la respuesta. El estudiante NUNCA ve resultado, puntaje ni nivel (README §5): solo «en curso / en revisión / completado». */
(async () => {
  const M = MEC, api = M.api, app = M.$("#app"), esc = M.esc, T = () => M.tests;
  const me = await M.requireRole("student");
  const BG = { intro: "intro", listening: "listening", reading: "reading", use_of_english: "grammar", vocabulary: "vocabulary", writing: "writing", speaking: "speaking", done: "resultado" };
  const setBg = (k) => { document.body.style.setProperty("--bg", "url(" + new URL("img/test-nivel/fondo-" + (BG[k] || "intro") + ".svg", location.href).href + ")"); document.body.dataset.sec = k; };
  const fail = (e) => { app.innerHTML = `<section class="tst-card"><h2>Algo no salió bien</h2><p>${esc(e && e.message ? e.message : e)}</p><p class="tst-row"><a class="tst-btn sec" href="student.html#espacio" style="text-decoration:none">Volver a mi portal</a> <button class="tst-btn" id="r">Reintentar</button></p></section>`; M.$("#r").onclick = () => location.reload(); };
  const go = (fn) => async (...a) => { try { await fn(...a); } catch (e) { fail(e); } };
  let intro, att = null, secs = {};
  const sec = (k) => secs[k] || {};
  const head = (k, n) => { const s = sec(k); return `<p class="tst-sec">${n ? "Parte " + n + " · " : ""}${esc(s.title_en || "")} <span class="muted">/ ${esc(s.title_es || "")}</span></p>`; };

  async function welcome() {
    setBg("intro"); const list = await T().pmMyAttempts().catch(() => []), cur = list.find((a) => a.state === "en_curso"), last = list.find((a) => a.state !== "en_curso");
    if (cur) { att = cur.id; app.innerHTML = `<section class="tst-card"><h1>${esc(intro.ui.name_es)}</h1><p>Tienes un intento en curso. Puedes continuar donde lo dejaste.</p><div class="tst-row"><button class="tst-btn" id="cont">Continuar</button></div></section>`; M.$("#cont").onclick = go(step); return; }
    if (last) { app.innerHTML = `<section class="tst-card"><h1>${esc(intro.ui.name_es)}</h1><p>${last.state === "en_revision" ? "Ya enviaste tu «Mi punto de partida». Tu teacher lo está revisando y el equipo de MEC se pondrá en contacto contigo." : "Ya completaste «Mi punto de partida». El equipo de MEC se pondrá en contacto contigo con tu grupo y tu horario."}</p><span class="tst-estado">${last.state === "en_revision" ? "En revisión" : "Completado"}</span></section>`; return; }
    app.innerHTML = `<section class="tst-card"><h1>${esc(intro.ui.name_en)}<br><small style="font-size:.6em;color:#b9c4d4">${esc(intro.ui.name_es)}</small></h1>
      <p class="tst-en">${esc(intro.ui.welcome_en)}</p><p class="tst-es">${esc(intro.ui.welcome_es)}</p>
      <ul class="tst-tips"><li>Busca un lugar tranquilo y usa audífonos si puedes.</li><li>Para la parte de hablar necesitarás un micrófono.</li><li>No hay respuestas buenas ni malas: si aún no sabes algo, elige «${esc(intro.ui.dont_know_es)}».</li></ul>
      <div class="tst-row"><button class="tst-btn" id="go">Empezar</button></div></section>`;
    M.$("#go").onclick = () => startQ();
  }
  function startQ() {
    let sel = null; app.innerHTML = `<section class="tst-card"><p class="tst-q">${esc(intro.ui.start_question_en)}</p><p class="tst-es">${esc(intro.ui.start_question_es)}</p>
      <ul class="tst-opts">${intro.ui.start_options.map((o) => `<li><button class="tst-opt" data-o="${esc(o.id)}" aria-pressed="false"><span>${esc(o.en)}<br><small class="tst-es">${esc(o.es)}</small></span></button></li>`).join("")}</ul>
      <div class="tst-row"><button class="tst-btn" id="ok" disabled>Continuar</button></div></section>`;
    M.$$(".tst-opt").forEach((b) => (b.onclick = () => { sel = b.dataset.o; M.$$(".tst-opt").forEach((x) => x.setAttribute("aria-pressed", x === b)); M.$("#ok").disabled = false; }));
    M.$("#ok").onclick = go(async () => { att = await T().pmStart(sel); await step(); });
  }
  async function step() {
    const r = await T().pmNext(att);
    if (r.kind === "item") return item(r);
    if (r.kind === "writing") return writing(r);
    if (r.kind === "speaking") return speaking(r);
    return done();
  }
  /* ---------- una pregunta ---------- */
  function item(r) {
    const it = r.item; setBg(it.section); const s = sec(it.section); let sel = null, busy = false;
    const opts = it.options || [], total = 60;
    app.innerHTML = `<section class="tst-card">${head(it.section, s.num)}<p class="tst-es">${esc(s.instr_en || "")} · ${esc(s.instr_es || "")}</p>
      <div class="tst-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${Math.min(total, r.answered + 1)}" aria-label="Avance"><i style="width:${Math.min(100, ((r.answered + 1) / total) * 100)}%"></i></div>
      ${it.passage ? `<div class="tst-pass"><h3>${esc(it.passage.title || "")}</h3>${esc(it.passage.body).replace(/\n/g, "<br>")}</div>` : ""}
      ${it.section === "listening" ? `<div class="tst-audio" id="au"></div>` : ""}
      <p class="tst-q">${esc(it.stem)}</p>
      <ul class="tst-opts">${opts.map((o) => `<li><button class="tst-opt" data-k="${esc(o.key)}" aria-pressed="false"><b>${esc(o.key)}</b><span>${esc(o.text)}</span></button></li>`).join("")}
        <li><button class="tst-opt dk" data-k="DK" aria-pressed="false">${esc(intro.ui.dont_know_en)} · ${esc(intro.ui.dont_know_es)}</button></li></ul>
      <div class="tst-row"><button class="tst-btn" id="nx" disabled>Siguiente</button></div></section>`;
    M.$$(".tst-opt").forEach((b) => (b.onclick = () => { sel = b.dataset.k; M.$$(".tst-opt").forEach((x) => x.setAttribute("aria-pressed", x === b)); M.$("#nx").disabled = false; }));
    M.$("#nx").onclick = go(async () => { if (busy) return; busy = true; await T().pmAnswer(att, it.id, sel, false); await step(); });
    if (it.section === "listening") audio(it, () => busy, (v) => (busy = v));
    scrollTo(0, 0);
  }
  /* Reproductor: 2 escuchas; si falta el audio o no carga, se explica y se puede seguir (el servidor pone otra pregunta del mismo nivel). */
  async function audio(it, getBusy, setBusy) {
    const box = M.$("#au"); let left = it.plays_left == null ? 2 : it.plays_left, url = null;
    const missing = (why) => { box.innerHTML = `<p class="tst-aviso">🔇 ${esc(why)}</p><div class="tst-row"><button class="tst-btn sec" id="skip">Continuar sin este audio</button></div>`; M.$("#nx").disabled = true; M.$$(".tst-opt").forEach((b) => (b.disabled = true));
      M.$("#skip").onclick = go(async () => { if (getBusy()) return; setBusy(true); await T().pmAnswer(att, it.id, null, true); await step(); }); };
    if (it.audio_missing || !it.audio_path) return missing("El audio de esta pregunta todavía no está disponible. No te preocupes: puedes continuar y te daremos otra pregunta.");
    url = await T().pmAudioUrl(it.audio_path).catch(() => null);
    if (!url) return missing("No pudimos cargar el audio. Puedes continuar y te daremos otra pregunta.");
    box.innerHTML = `<p><b>Audio</b> · <span id="left"></span></p><audio id="pl" preload="none" controlsList="nodownload noplaybackrate" src="${esc(url)}"></audio><div class="tst-row"><button class="tst-btn" id="pp">▶ Escuchar</button></div>`;
    const pl = M.$("#pl"), bt = M.$("#pp"), upd = () => { M.$("#left").textContent = left > 0 ? "Puedes escucharlo " + left + (left === 1 ? " vez más" : " veces") : "Ya usaste las escuchas de esta pregunta"; bt.disabled = left <= 0; };
    upd(); let playing = false;
    bt.onclick = async () => { if (playing || left <= 0) return; try { left = await T().pmPlay(att, it.id) ?? left - 1; } catch (e) { left = 0; upd(); return; } playing = true; bt.disabled = true; pl.currentTime = 0; pl.play().catch(() => { playing = false; left++; missing("No pudimos reproducir el audio en este navegador. Puedes continuar y te daremos otra pregunta."); }); };
    pl.onended = () => { playing = false; upd(); }; pl.onerror = () => { if (!playing) return; playing = false; missing("El audio se interrumpió. Puedes continuar y te daremos otra pregunta."); };
  }
  /* ---------- Writing ---------- */
  function writing(r) {
    setBg("writing"); const it = r.item; let timer;
    app.innerHTML = `<section class="tst-card">${head("writing", 5)}<p class="tst-q">${esc(it.stem)}</p><p class="tst-es">${esc(it.prompt_es || "")}</p>
      <textarea class="tst-write" id="tx" maxlength="4000" aria-label="Tu texto" placeholder="Write here…">${esc(r.draft || "")}</textarea>
      <p class="tst-h"><span id="cnt"></span><span>Tiempo sugerido: ${esc(it.time_minutes || 10)} min · se guarda como borrador mientras escribes</span><span id="sv"></span></p>
      <div class="tst-row"><button class="tst-btn" id="sd">Enviar texto</button> <button class="tst-btn sec" id="sk">Prefiero no escribir ahora</button></div></section>`;
    const tx = M.$("#tx"), cnt = () => (M.$("#cnt").textContent = (tx.value.trim() ? tx.value.trim().split(/\s+/).length : 0) + " palabras"); cnt();
    const save = async () => { try { await T().pmSaveWriting(att, tx.value, false, false); M.$("#sv").textContent = "Borrador guardado"; } catch (e) { M.$("#sv").textContent = ""; } };
    tx.oninput = () => { cnt(); clearTimeout(timer); timer = setTimeout(save, 1500); };
    M.$("#sd").onclick = go(async () => { clearTimeout(timer); if (!tx.value.trim()) return M.toast("Escribe tu texto o elige «Prefiero no escribir ahora»"); await T().pmSaveWriting(att, tx.value, true, false); await step(); });
    M.$("#sk").onclick = go(async () => { if (!confirm("¿Seguro? Tu teacher no tendrá tu texto para revisar.")) return; clearTimeout(timer); await T().pmSaveWriting(att, tx.value || null, true, true); await step(); });
  }
  /* ---------- Speaking (grabación de audio; la revisa un teacher en máx. 48 h hábiles) ---------- */
  function speaking(r) {
    setBg("speaking"); const it = r.item, qs = it.questions || [], rec = Object.assign({}, r.recordings || {}); let q = 1, stream = null, mr = null, chunks = [], tick = null, blob = null, secs = 0, micOk = false;
    const stop = () => { clearInterval(tick); try { if (mr && mr.state !== "inactive") mr.stop(); } catch (e) {} if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
    const pickType = () => (window.MediaRecorder && ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t))) || "";
    const canRec = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    const frame = (inner) => (app.innerHTML = `<section class="tst-card">${head("speaking", 6)}<p class="tst-es">${esc(intro.ui.speaking_record_en)} · ${esc(intro.ui.speaking_record_es)}</p>${inner}</section>`);
    const noMic = (msg) => { frame(`<p class="tst-aviso">🎙️ ${esc(msg)}</p><div class="tst-row"><button class="tst-btn" id="retry">Probar de nuevo</button> <button class="tst-btn sec" id="fin0">Terminar sin grabar</button></div>`);
      M.$("#retry").onclick = () => micTest(); M.$("#fin0").onclick = go(finish); };
    const finish = async () => { stop(); await T().pmFinish(att); done(); };
    function micTest() {
      if (!canRec()) return noMic("Este navegador no permite grabar audio. Abre el portal en Chrome, Edge o Safari actualizado, o termina sin grabar y avisa a tu teacher.");
      frame(`<h2>Prueba de micrófono</h2><p>Di una frase en voz alta y comprueba que la barra se mueve. Esta prueba no se guarda.</p><div class="tst-prog"><i id="lv" style="width:0"></i></div><div class="tst-row"><button class="tst-btn" id="mt">Activar micrófono</button></div>`);
      M.$("#mt").onclick = async () => { try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); micOk = true; } catch (e) { return noMic("No pudimos usar tu micrófono. Revisa el permiso del navegador (el candado junto a la dirección) y vuelve a intentar."); }
        try { const ac = new (window.AudioContext || window.webkitAudioContext)(), an = ac.createAnalyser(), src = ac.createMediaStreamSource(stream); src.connect(an); const buf = new Uint8Array(an.fftSize); tick = setInterval(() => { an.getByteTimeDomainData(buf); let m = 0; buf.forEach((v) => (m = Math.max(m, Math.abs(v - 128)))); const lv = M.$("#lv"); if (lv) lv.style.width = Math.min(100, m * 1.6) + "%"; }, 120); } catch (e) {}
        M.$("#mt").outerHTML = `<button class="tst-btn" id="mok">Se escucha bien, empezar</button>`; M.$("#mok").onclick = () => { stop(); question(); }; };
    }
    function question() {
      blob = null; const took = (rec[q] && rec[q].takes) || 0, saved = !!rec[q];
      frame(`<p class="tst-sec">Pregunta ${q} de ${qs.length}</p><p class="tst-q">${esc(qs[q - 1])}</p><div id="zone"></div>`);
      if (saved && took >= 2) return reviewSaved(); prep();
    }
    function prep() { let n = it.prep_seconds || 10; const z = M.$("#zone");
      z.innerHTML = `<p>Piensa tu respuesta: <b id="pn">${n}</b> s</p><div class="tst-row"><button class="tst-btn" id="rs">Grabar ya</button></div>`; const t = setInterval(() => { n--; const e = M.$("#pn"); if (!e) return clearInterval(t); e.textContent = n; if (n <= 0) { clearInterval(t); record(); } }, 1000);
      M.$("#rs").onclick = () => { clearInterval(t); record(); }; }
    async function record() { const z = M.$("#zone"), max = it.max_seconds || 60;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return noMic("No pudimos usar tu micrófono."); }
      const type = pickType(); chunks = []; mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined); mr.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
      mr.onstop = () => { clearInterval(tick); blob = new Blob(chunks, { type: mr.mimeType || type || "audio/webm" }); if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; review(); };
      secs = 0; mr.start(); z.innerHTML = `<div class="tst-rec on" role="timer" id="tm">● 0 s</div><div class="tst-prog"><i id="pg" style="width:0"></i></div><p class="tst-es">Máximo ${max} s. La grabación se detiene sola.</p><div class="tst-row"><button class="tst-btn" id="st">Terminar de hablar</button></div>`;
      const t0 = Date.now(); tick = setInterval(() => { secs = Math.round((Date.now() - t0) / 1000); const tm = M.$("#tm"); if (tm) { tm.textContent = "● " + secs + " s"; M.$("#pg").style.width = Math.min(100, (secs / max) * 100) + "%"; } if (secs >= max) { try { mr.stop(); } catch (e) {} } }, 250);
      M.$("#st").onclick = () => { try { mr.stop(); } catch (e) {} }; }
    function review() { const z = M.$("#zone"), took = (rec[q] && rec[q].takes) || 0, url = URL.createObjectURL(blob);
      z.innerHTML = `<p>Escucha tu grabación (${secs} s):</p><audio controls src="${url}" style="width:100%"></audio><div class="tst-row"><button class="tst-btn" id="sv">Guardar y seguir</button>${took < 1 ? ` <button class="tst-btn sec" id="again">Grabar de nuevo (solo una vez)</button>` : ""}</div>`;
      const ag = M.$("#again"); if (ag) ag.onclick = () => { URL.revokeObjectURL(url); prep(); };
      M.$("#sv").onclick = go(async () => { M.$("#sv").disabled = true; await T().pmSpeakSave(att, q, blob, secs, r.folder); rec[q] = { takes: took + 1, seconds: secs }; next(); }); }
    function reviewSaved() { const z = M.$("#zone"); z.innerHTML = `<p>Tu respuesta ya está guardada.</p><div class="tst-row"><button class="tst-btn" id="nx">Seguir</button></div>`; M.$("#nx").onclick = next; }
    function next() { if (q < qs.length) { q++; question(); } else { app.innerHTML = `<section class="tst-card"><h2>Listo para enviar</h2><p>Guardamos tus ${qs.length} respuestas. Cuando envíes, tu teacher las revisará.</p><div class="tst-row"><button class="tst-btn" id="fin">Enviar mi «Mi punto de partida»</button></div></section>`; M.$("#fin").onclick = go(finish); } }
    micTest();
  }
  function done() { setBg("done"); app.innerHTML = `<section class="tst-card"><h1>${esc(intro.ui.closing_en)}</h1><p class="tst-es">${esc(intro.ui.closing_es)}</p><p class="tst-estado">En revisión por tu teacher</p><div class="tst-row"><a class="tst-btn" href="student.html#espacio" style="text-decoration:none">Volver a mi portal</a></div></section>`; }

  try {
    intro = await T().pmIntro();
    if (!intro || !intro.enabled) { app.innerHTML = `<section class="tst-card"><h1>Mi punto de partida</h1><p>Estará disponible muy pronto. Te avisaremos cuando puedas hacerlo.</p><div class="tst-row"><a class="tst-btn" href="student.html#espacio" style="text-decoration:none">Volver a mi portal</a></div></section>`; return; }
    (intro.sections || []).forEach((s) => (secs[s.key] = s));
    await welcome();
  } catch (e) { app.innerHTML = `<section class="tst-card"><h1>Mi punto de partida</h1><p>Todavía no está disponible. Estará listo muy pronto.</p><div class="tst-row"><a class="tst-btn" href="student.html#espacio" style="text-decoration:none">Volver a mi portal</a></div></section>`; }
})();
