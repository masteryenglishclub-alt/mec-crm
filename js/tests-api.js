/* MEC CRM – acceso a los tests («Mi punto de partida» y «Test de estilo de aprendizaje»).
   Producción: funciones SQL pm_* y qt_* (propuestas 20261023_punto_de_partida y 20261023_test_estilo_aprendizaje; hoy NO aplicadas).
   Demo/vista previa: js/demo-pm.js. La corrección y el ruteo viven SOLO en el servidor: este archivo nunca recibe ni guarda claves.
   Si la base aún no tiene las funciones, enabled() devuelve false y las pantallas muestran «Próximamente». */
(function () {
  const M = window.MEC, api = M.api;
  const q = async (p) => { const { data, error } = await p; if (error) throw new Error(error.message); return data; };
  const AUDIO = "pm-listening", SPEAK = "pm-speaking";
  function sb() {
    const c = () => api._client(), rpc = async (fn, args) => q((await c()).rpc(fn, args || {}));
    return {
      async enabled() { try { const r = await rpc("pm_intro"); const s = await rpc("qt_list"); return { pm: !!(r && r.enabled), qt: (s || []).length > 0 }; } catch (e) { return { pm: false, qt: false }; } },
      pmIntro: () => rpc("pm_intro"), pmStart: (o) => rpc("pm_start", { p_start: o }), pmNext: (a) => rpc("pm_next", { p_attempt: a }),
      pmAnswer: (a, i, k, f) => rpc("pm_answer", { p_attempt: a, p_item: i, p_key: k || null, p_audio_failed: !!f }), pmPlay: (a, i) => rpc("pm_register_play", { p_attempt: a, p_item: i }),
      async pmAudioUrl(path) { const { data, error } = await (await c()).storage.from(AUDIO).createSignedUrl(path, 120); if (error) return null; return data.signedUrl; },
      pmSaveWriting: (a, t, send, skip) => rpc("pm_save_writing", { p_attempt: a, p_text: t, p_send: !!send, p_skip: !!skip }),
      async pmSpeakSave(att, qn, blob, seconds, folder) { const ext = /mp4/.test(blob.type) ? "mp4" : /ogg/.test(blob.type) ? "ogg" : "webm", path = folder + "/q" + qn + "." + ext, cl = await c();
        const up = await cl.storage.from(SPEAK).upload(path, blob, { contentType: blob.type || "audio/webm", upsert: true }); if (up.error) throw new Error(up.error.message);
        return rpc("pm_speaking_register", { p_attempt: att, p_q: qn, p_path: path, p_duration: seconds }); },
      pmFinish: (a) => rpc("pm_finish", { p_attempt: a }), pmMyAttempts: () => rpc("pm_my_attempts"),
      async pmStaffAttempts(studentId) { const cl = await c(); let r = cl.from("pm_attempts").select("*").neq("status", "cancelled").order("started_at", { ascending: false }); if (studentId) r = r.eq("student_id", studentId);
        const rows = await q(r), all = await api.listStudents().catch(() => []), nm = {}; all.forEach((s) => (nm[s.id] = s.full_name)); return rows.map((a) => Object.assign(a, { student_name: nm[a.student_id] || "Estudiante" })); },
      async pmWriting(att) { const cl = await c(), a = (await q(cl.from("pm_attempts").select("writing_item, writing_text, writing_skipped").eq("id", att)))[0] || {}, it = a.writing_item ? (await q(cl.from("pm_items").select("stem").eq("id", a.writing_item)))[0] : null;
        return { prompt: it ? it.stem : null, text: a.writing_text || null, skipped: !!a.writing_skipped }; },
      async pmSpeakingInfo(att) { const cl = await c(), a = (await q(cl.from("pm_attempts").select("speaking_item").eq("id", att)))[0] || {}, it = a.speaking_item ? (await q(cl.from("pm_items").select("stem").eq("id", a.speaking_item)))[0] : null;
        const rec = await q(cl.from("pm_speaking").select("q_no, storage_path, takes, duration_s").eq("attempt_id", att)), o = {}; rec.forEach((r) => (o[r.q_no] = { path: r.storage_path, takes: r.takes, seconds: r.duration_s })); return { questions: it ? it.stem.split(" | ") : [], recordings: o }; },
      async pmSpeakUrl(path) { const { data, error } = await (await c()).storage.from(SPEAK).createSignedUrl(path, 300); if (error) throw new Error(error.message); return data.signedUrl; },
      pmDetail: (a) => rpc("pm_attempt_detail", { p_attempt: a }),
      async pmRubric() { const rows = await q((await c()).from("pm_rubric").select("*").order("ord")), o = { writing: [], speaking: [] }; rows.forEach((r) => o[r.kind].push([r.code, r.label, r.d3, r.d2, r.d1, r.d0])); return o; },
      pmGrade: (a, w, s, n) => rpc("pm_grade", { p_attempt: a, p_w: w || null, p_s: s || null, p_notes: n || {} }), pmApprove: (a, ok) => rpc("pm_approve", { p_attempt: a, p_approve: !!ok }),
      pmSetInterview: (a, o) => rpc("pm_set_interview", { p_attempt: a, p_outcome: o }), pmCancel: (a) => rpc("pm_cancel", { p_attempt: a }),
      async pmPending() { const rows = await rpc("pm_pending_speaking"), all = await api.listStudents().catch(() => []), nm = {}; all.forEach((s) => (nm[s.id] = s.full_name)); return rows.map((r) => Object.assign({}, r, { student_name: nm[r.student_id] || "Estudiante" })); },
      pmAudioStatus: () => rpc("pm_audio_status"),
      async pmAudioUpload(item, file) { if (!/\.(mp3|m4a|ogg|opus|wav)$/i.test(file.name || "")) throw new Error("Formato no permitido (mp3, m4a, ogg, opus o wav)"); if (file.size > 10 * 1048576) throw new Error("El archivo supera 10 MB");
        const ext = file.name.split(".").pop().toLowerCase(), path = "listening/" + item + "." + ext, cl = await c(); const up = await cl.storage.from(AUDIO).upload(path, file, { contentType: file.type || "audio/mpeg", upsert: true }); if (up.error) throw new Error(up.error.message);
        await rpc("pm_audio_register", { p_item: item, p_path: path }); },
      pmAudioScan: () => rpc("pm_audio_scan"),
      pmAudioRemove: (i) => rpc("pm_audio_remove", { p_item: i }),
      qtList: () => rpc("qt_list"), qtStart: (c2) => rpc("qt_start", { p_code: c2 }), qtContent: (a) => rpc("qt_content", { p_attempt: a }), qtSave: (a, qid, o) => rpc("qt_save", { p_attempt: a, p_qid: qid, p_opt: o }),
      qtSubmit: (a) => rpc("qt_submit", { p_attempt: a }), qtMyResult: (c2) => rpc("qt_my_result", { p_code: c2 }),
      async qtStaffAttempts(studentId) { const cl = await c(); let r = cl.from("qt_attempts").select("id, student_id, completed_at, counts, pct, result_code").eq("status", "done").order("completed_at", { ascending: false }); if (studentId) r = r.eq("student_id", studentId);
        const rows = await q(r), all = await api.listStudents().catch(() => []), nm = {}; all.forEach((s) => (nm[s.id] = s.full_name)); return rows.map((a) => Object.assign(a, { student_name: nm[a.student_id] })); }
    };
  }
  const demo = api.mode === "demo";
  M.tests = demo && M.demoTests ? M.demoTests(api) : sb();
  /* ¿Qué tests están abiertos? En demo (vista previa) ambos; en producción lo dicen las funciones SQL (apagadas por defecto). */
  M.tests.flags = async () => (demo ? (M.demoTests ? { pm: true, qt: true } : { pm: false, qt: false }) : sb().enabled());
})();
