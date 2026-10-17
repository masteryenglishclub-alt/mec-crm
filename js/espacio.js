/* MEC CRM – Mi espacio (chat privado, entregas de ejercicios, comunidad), Moderación (admin) y Noticias y eventos.
   Datos: PROPUESTAS supabase/proposed/20261016_mi_espacio_PROPUESTA.sql y 20261016_noticias_PROPUESTA.sql
   (pendientes de la orden del owner/Lobo). Mientras no estén aplicadas, en producción se muestra "Próximamente".
   La seguridad real está en la base (RLS + bucket privado 'ejercicios' con URLs firmadas que expiran). */
(function () {
  const M = window.MEC, api = M.api, esc = (s) => M.esc(s == null ? "" : String(s));
  const MAX = 10 * 1024 * 1024, EXT = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  const first = (n) => String(n || "").trim().split(/\s+/)[0] || "Usuario";
  const labelOf = (u) => u.role === "admin" ? "Moderación MEC" : (u.role === "teacher" ? "Teacher " : "") + first(String(u.full_name || "").replace(/^Teacher\s+/i, "").replace(/^Demo\s+/i, ""));
  M.checkExerciseFile = (f) => {
    if (!f) throw new Error("Elige un archivo.");
    const ext = String(f.name || "").toLowerCase().split(".").pop();
    if (!EXT[ext]) throw new Error("Formato no permitido. Sube una imagen (JPG, PNG, WEBP), un PDF o un Word (.docx).");
    if (f.size > MAX) throw new Error("El archivo supera 10 MB.");
    if (f.size <= 0) throw new Error("El archivo está vacío.");
    return { ext, mime: EXT[ext], safe: Date.now() + "-" + (String(f.name).toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9._-]+/g, "-").replace(/^[^a-z0-9]+/, "").slice(0, 60) || "archivo") + "." + ext };
  };

  /* ======================= DATOS: MODO DEMO ======================= */
  function demoLayer() {
    const KEY = "mec_crm_demo_espacio_v1";
    const empty = () => ({ acceptances: [], guardians: [], threads: [], dms: [], subs: [], comments: [], community: [], reports: [], actions: [], sanctions: [], news: [], settings: { community_enabled: 1, kids_community_enabled: 0, space_rules_version: 1, exercise_max_bytes: MAX } });
    let st = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!st) st = Object.assign(empty(), window.MEC_DEMO_ESPACIO_SEED ? window.MEC_DEMO_ESPACIO_SEED() : {});
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { throw new Error("Modo demo: no hay espacio en el navegador para guardar esto."); } };
    const id = (p) => p + "-" + Math.random().toString(36).slice(2, 10);
    const now = () => new Date().toISOString();
    const me = () => api.currentUser();
    const meStudent = async () => { const u = await me(); if (u.role !== "student") return null; const [s] = await api.listStudents(); return s; };
    const isKid = async (sid) => { const all = await api.listStudents().catch(() => []); const s = all.find((x) => x.id === sid); return !!(s && s.program === "kids"); };
    const consentOk = async (sid) => !(await isKid(sid)) || st.guardians.some((g) => g.student_id === sid && g.consent_at);
    const blocked = (uid, kind) => st.sanctions.some((x) => x.user_id === uid && !x.lifted_at && (!x.until || x.until > now()) && (x.kind === "suspend" || (kind === "community" && x.kind === "mute")));
    const rulesOk = (uid) => st.acceptances.some((a) => a.user_id === uid && a.version === st.settings.space_rules_version);
    async function canThread(t) { const u = await me();
      if (u.role === "admin") return true;
      if (u.role === "student") return t.student_id === u.id && await consentOk(u.id);
      if (u.role === "teacher") return t.teacher_id === u.id;
      return false; }
    async function canSub(x) { const u = await me();
      if (u.role === "admin") return true; if (x.hidden_at) return false;
      if (u.role === "student") return x.student_id === u.id && await consentOk(u.id);
      if (u.role === "teacher") { if (x.teacher_id) return x.teacher_id === u.id; const all = await api.listStudents(); return all.some((s) => s.id === x.student_id); }
      return false; }
    const openRep = (type, tid) => st.reports.some((r) => r.target_type === type && r.target_id === tid && r.status === "open");
    return {
      async spState() { const u = await me(), s = await meStudent(), kid = !!(s && s.program === "kids");
        return { version: st.settings.space_rules_version, accepted: rulesOk(u.id), kid, consent: kid ? await consentOk(u.id) : true,
          community: st.settings.community_enabled === 1, kidsCommunity: st.settings.kids_community_enabled === 1, maxBytes: st.settings.exercise_max_bytes, role: u.role,
          muted: blocked(u.id, "community"), suspended: blocked(u.id, "dm") }; },
      async spAccept() { const u = await me(); if (!rulesOk(u.id)) st.acceptances.push({ user_id: u.id, version: st.settings.space_rules_version, accepted_at: now() }); save(); },
      async spThreads() { const u = await me(), out = [];
        if (u.role === "student") { const s = await meStudent();
          if (s && s.teacher_id && await consentOk(u.id) && !st.threads.some((t) => t.student_id === u.id && t.teacher_id === s.teacher_id))
            { st.threads.push({ id: id("th"), student_id: u.id, teacher_id: s.teacher_id, student_label: labelOf(u), teacher_label: "Teacher " + first(String(s.teacher_name || "").replace(/^Teacher\s+(Demo\s+)?/i, "")), created_at: now() }); save(); } }
        for (const t of st.threads) if (await canThread(t)) out.push(Object.assign({}, t, { last: st.dms.filter((m) => m.thread_id === t.id && (!m.hidden_at || u.role === "admin")).map((m) => m.created_at).sort().pop() || t.created_at }));
        return out.sort((a, b) => b.last.localeCompare(a.last)); },
      async spMessages(tid) { const u = await me(), t = st.threads.find((x) => x.id === tid); if (!t || !(await canThread(t))) return [];
        return st.dms.filter((m) => m.thread_id === tid && (!m.hidden_at || u.role === "admin")).sort((a, b) => a.created_at.localeCompare(b.created_at)); },
      async spSend(tid, body) { const u = await me(), t = st.threads.find((x) => x.id === tid); body = String(body || "").trim();
        if (!body || body.length > 2000) throw new Error("Escribe un mensaje (máximo 2000 caracteres).");
        if (!t || !(await canThread(t)) || !rulesOk(u.id) || blocked(u.id, "dm")) throw new Error("No puedes escribir en esta conversación.");
        st.dms.push({ id: id("dm"), thread_id: tid, sender_id: u.id, sender_label: labelOf(u), body, created_at: now() }); save(); },
      async spSubs(f = {}) { const out = [];
        for (const x of st.subs) if ((f.class_id === undefined || x.class_id === f.class_id) && await canSub(x)) out.push(Object.assign({}, x, { comments: st.comments.filter((c) => c.submission_id === x.id && !c.hidden_at).sort((a, b) => a.created_at.localeCompare(b.created_at)) }));
        return out.sort((a, b) => b.created_at.localeCompare(a.created_at)); },
      async spUpload(file, o = {}) { const u = await me(), chk = M.checkExerciseFile(file), s = await meStudent();
        if (!s || !(await consentOk(u.id)) || !rulesOk(u.id)) throw new Error("No puedes subir ejercicios todavía.");
        const title = String(o.title || "").trim() || file.name; let data = null;
        if (file.size <= 1.5e6 && typeof FileReader !== "undefined") data = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(file); });
        st.subs.push({ id: id("sub"), student_id: u.id, student_label: labelOf(u), teacher_id: o.teacher_id || s.teacher_id || null, class_id: o.class_id || null, title: title.slice(0, 200),
          file_name: file.name, storage_path: u.id + "/" + chk.safe, mime_type: chk.mime, size_bytes: file.size, status: "sent", created_at: now(), demo_data: data }); save(); },
      async spFileUrl(x) { const r = st.subs.find((y) => y.id === x.id); if (!r || !(await canSub(r))) throw new Error("Sin permiso.");
        if (!r.demo_data) throw new Error("Modo demo: este archivo de ejemplo no tiene contenido."); return r.demo_data; },
      async spComment(sid, body) { const u = await me(), x = st.subs.find((y) => y.id === sid); body = String(body || "").trim();
        if (!body) throw new Error("Escribe un comentario."); if (!x || !(await canSub(x)) || !rulesOk(u.id) || blocked(u.id, "dm")) throw new Error("Sin permiso.");
        st.comments.push({ id: id("cm"), submission_id: sid, author_id: u.id, author_label: labelOf(u), body, created_at: now() }); save(); },
      async spReview(sid) { const u = await me(), x = st.subs.find((y) => y.id === sid); if (u.role !== "teacher" || !x || !(await canSub(x))) throw new Error("Solo el teacher marca la entrega como revisada.");
        x.status = "reviewed"; x.reviewed_at = now(); save(); },
      async spCommunity(room = "adultos") { const u = await me(), s = await meStudent(), kid = !!(s && s.program === "kids");
        if (u.role !== "admin" && (room === "adultos" ? kid || st.settings.community_enabled !== 1 : st.settings.kids_community_enabled !== 1)) return [];
        return st.community.filter((m) => m.room === room && (u.role === "admin" || (!m.hidden_at && !m.deleted_at && (room !== "kids" || m.approved_at) && !openRep("community", m.id))))
          .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 80); },
      async spPost(body, room = "adultos") { const u = await me(), s = await meStudent(), kid = !!(s && s.program === "kids"); body = String(body || "").trim();
        if (!body || body.length > 1000) throw new Error("Escribe un mensaje (máximo 1000 caracteres).");
        if (!rulesOk(u.id) || blocked(u.id, "community") || (room === "adultos" && kid) || (room === "kids" && st.settings.kids_community_enabled !== 1)) throw new Error("No puedes publicar en esta sala.");
        st.community.push({ id: id("cm"), room, author_id: u.id, author_label: labelOf(u), body, created_at: now(), approved_at: room === "adultos" ? now() : null }); save(); },
      async spReport(type, tid, reason) { const u = await me(); if (st.reports.some((r) => r.target_type === type && r.target_id === tid && r.reporter_id === u.id && r.status === "open")) throw new Error("Ya reportaste este contenido.");
        let minor = false; const tgt = type === "community" ? st.community.find((x) => x.id === tid) : type === "dm" ? st.dms.find((x) => x.id === tid) : st.subs.find((x) => x.id === tid);
        if (tgt) { const sid = tgt.student_id || tgt.author_id || tgt.sender_id || (st.threads.find((t) => t.id === tgt.thread_id) || {}).student_id; minor = sid ? await isKid(sid) : false; }
        st.reports.push({ id: id("rep"), target_type: type, target_id: tid, reporter_id: u.id, reporter_label: labelOf(u), reason: String(reason || "").slice(0, 500), status: "open", involves_minor: minor, legal_hold: false, created_at: now() }); save(); },
      async spReports() { const u = await me(); if (u.role !== "admin") throw new Error("Solo el admin modera.");
        return st.reports.slice().sort((a, b) => (a.status === b.status ? b.created_at.localeCompare(a.created_at) : a.status === "open" ? -1 : 1)).map((r) => {
          const t = r.target_type === "community" ? st.community.find((x) => x.id === r.target_id) : r.target_type === "dm" ? st.dms.find((x) => x.id === r.target_id) : r.target_type === "comment" ? st.comments.find((x) => x.id === r.target_id) : st.subs.find((x) => x.id === r.target_id);
          return Object.assign({}, r, { target: t ? { body: t.body || t.title, author_id: t.author_id || t.sender_id || t.student_id, author_label: t.author_label || t.sender_label || t.student_label, hidden_at: t.hidden_at, deleted_at: t.deleted_at, room: t.room, created_at: t.created_at } : null }); }); },
      async spSanctions() { return st.sanctions.filter((x) => !x.lifted_at && (!x.until || x.until > now())); },
      async spModerate(action, type, tid, user, report, reason, until) { const u = await me(); if (u.role !== "admin") throw new Error("Solo el admin modera.");
        const tbl = { community: st.community, dm: st.dms, comment: st.comments, submission: st.subs }[type] || [], t = tbl.find((x) => x.id === tid);
        if (t && ["hide", "hide_submission"].includes(action)) t.hidden_at = now();
        if (t && action === "unhide") t.hidden_at = null;
        if (t && action === "delete") t.deleted_at = now();
        if (t && action === "approve") t.approved_at = now();
        if (["mute", "suspend"].includes(action)) st.sanctions.push({ id: id("san"), user_id: user, user_label: (t && (t.author_label || t.sender_label || t.student_label)) || "", kind: action, until: until || null, reason, created_at: now() });
        if (action === "lift") st.sanctions.filter((x) => x.user_id === user && !x.lifted_at).forEach((x) => (x.lifted_at = now()));
        if (report) { const r = st.reports.find((x) => x.id === report); if (r) { r.status = "closed"; r.closed_at = now(); r.resolution = reason || action; } }
        st.actions.push({ id: id("act"), action, target_type: type, target_id: tid, user_id: user, report_id: report, reason, created_at: now() }); save(); },
      /* Noticias y eventos */
      async newsList(all) { const u = await me(), s = await meStudent(), kid = !!(s && s.program === "kids");
        if (all && u.role !== "admin") throw new Error("Solo el admin.");
        return st.news.filter((n) => all || (n.published && (n.audience === "todos" || u.role !== "student" || (n.audience === "kids") === kid)))
          .sort((a, b) => String(b.event_at || b.published_at || b.created_at).localeCompare(String(a.event_at || a.published_at || a.created_at))); },
      async newsSave(o) { const u = await me(); if (u.role !== "admin") throw new Error("Solo el admin publica noticias.");
        if (!String(o.title || "").trim()) throw new Error("Escribe un título."); if (o.kind === "event" && !o.event_at) throw new Error("Un evento necesita fecha y hora.");
        let n = st.news.find((x) => x.id === o.id); if (!n) { n = { id: id("nw"), created_at: now() }; st.news.push(n); }
        const was = n.published; Object.assign(n, { kind: o.kind || "news", title: o.title.trim(), body: o.body || "", audience: o.audience || "todos", event_at: o.event_at || null, event_theme: o.event_theme || null, signup: !!o.signup, published: !!o.published, updated_at: now() });
        n.published_at = n.published ? (was ? n.published_at : now()) : null; save(); return n; },
      async newsDelete(nid) { const u = await me(); if (u.role !== "admin") throw new Error("Solo el admin."); st.news = st.news.filter((x) => x.id !== nid); save(); }
    };
  }

  /* ======================= DATOS: SUPABASE ======================= */
  function sbLayer() {
    const q = async (p) => { const { data, error } = await p; if (error) throw new Error(error.message); return data; };
    const cli = () => api._client(), me = () => api.currentUser();
    const BUCKET = "ejercicios";
    return {
      async spState() { const c = await cli(), u = await me(), set = await api.settings(), v = set.space_rules_version || 1;
        if (set.space_rules_version === undefined) throw new Error("NO_ACTIVO");  // la propuesta aún no está aplicada
        const acc = await q(c.from("space_rules_acceptances").select("version").eq("user_id", u.id).eq("version", v));
        let kid = false, consent = true;
        if (u.role === "student") { const [s] = await api.listStudents(); kid = !!(s && s.program === "kids"); if (kid) consent = await q(c.rpc("kid_consent_ok", { p_student: u.id })); }
        const [mut, sus] = await Promise.all([q(c.rpc("chat_blocked", { p_kind: "community" })), q(c.rpc("chat_blocked", { p_kind: "dm" }))]);
        return { version: v, accepted: acc.length > 0, kid, consent, community: (set.community_enabled ?? 1) === 1, kidsCommunity: set.kids_community_enabled === 1, maxBytes: set.exercise_max_bytes || MAX, role: u.role, muted: mut, suspended: sus }; },
      async spAccept() { const c = await cli(), u = await me(), set = await api.settings(); await q(c.from("space_rules_acceptances").upsert({ user_id: u.id, version: set.space_rules_version || 1 })); },
      async spThreads() { const c = await cli(), u = await me();
        if (u.role === "student") { const [s] = await api.listStudents(); if (s && s.teacher_id) await c.from("dm_threads").upsert({ student_id: u.id, teacher_id: s.teacher_id }, { onConflict: "student_id,teacher_id", ignoreDuplicates: true }); }
        const t = await q(c.from("dm_threads").select("*").order("created_at", { ascending: false })); return t.map((x) => Object.assign({ last: x.created_at }, x)); },
      async spMessages(tid) { const c = await cli(); return q(c.from("dm_messages").select("*").eq("thread_id", tid).order("created_at").limit(300)); },
      async spSend(tid, body) { const c = await cli(), u = await me(); await q(c.from("dm_messages").insert({ thread_id: tid, sender_id: u.id, body: String(body || "").trim() })); },
      async spSubs(f = {}) { const c = await cli(); let r = c.from("exercise_submissions").select("*, comments:submission_comments(*)").order("created_at", { ascending: false });
        if (f.class_id !== undefined) r = f.class_id ? r.eq("class_id", f.class_id) : r.is("class_id", null);
        const rows = await q(r); rows.forEach((x) => (x.comments = (x.comments || []).filter((y) => !y.hidden_at).sort((a, b) => a.created_at.localeCompare(b.created_at)))); return rows; },
      async spUpload(file, o = {}) { const c = await cli(), u = await me(), chk = M.checkExerciseFile(file), path = u.id + "/" + chk.safe;
        const [s] = await api.listStudents();
        const up = await c.storage.from(BUCKET).upload(path, file, { contentType: chk.mime, upsert: false }); if (up.error) throw new Error(up.error.message);
        const { error } = await c.from("exercise_submissions").insert({ student_id: u.id, teacher_id: o.teacher_id || (s && s.teacher_id) || null, class_id: o.class_id || null,
          title: (String(o.title || "").trim() || file.name).slice(0, 200), storage_path: path, mime_type: chk.mime, size_bytes: file.size });
        if (error) { await c.storage.from(BUCKET).remove([path]).catch(() => {}); throw new Error(error.message); } },
      async spFileUrl(x) { const c = await cli(); const { data, error } = await c.storage.from(BUCKET).createSignedUrl(x.storage_path, 300); if (error) throw new Error(error.message); return data.signedUrl; },  // expira en 5 min
      async spComment(sid, body) { const c = await cli(), u = await me(); await q(c.from("submission_comments").insert({ submission_id: sid, author_id: u.id, body: String(body || "").trim() })); },
      async spReview(sid) { const c = await cli(); await q(c.from("exercise_submissions").update({ status: "reviewed" }).eq("id", sid)); },
      async spCommunity(room = "adultos") { const c = await cli(); return q(c.from("community_messages").select("*").eq("room", room).order("created_at", { ascending: false }).limit(80)); },
      async spPost(body, room = "adultos") { const c = await cli(), u = await me(); await q(c.from("community_messages").insert({ room, author_id: u.id, body: String(body || "").trim() })); },
      async spReport(type, tid, reason) { const c = await cli(), u = await me(); await q(c.from("reports").insert({ target_type: type, target_id: tid, reporter_id: u.id, reason: String(reason || "").slice(0, 500) })); },
      async spReports() { const c = await cli(), reps = await q(c.from("reports").select("*").order("created_at", { ascending: false }).limit(200));
        const ids = (t) => reps.filter((r) => r.target_type === t).map((r) => r.target_id);
        const get = async (tbl, t) => ids(t).length ? q(c.from(tbl).select("*").in("id", ids(t))) : [];
        const [cm, dm, co, su] = await Promise.all([get("community_messages", "community"), get("dm_messages", "dm"), get("submission_comments", "comment"), get("exercise_submissions", "submission")]);
        const all = { community: cm, dm, comment: co, submission: su };
        return reps.sort((a, b) => (a.status === b.status ? 0 : a.status === "open" ? -1 : 1)).map((r) => { const t = (all[r.target_type] || []).find((x) => x.id === r.target_id);
          return Object.assign({}, r, { target: t ? { body: t.body || t.title, author_id: t.author_id || t.sender_id || t.student_id, author_label: t.author_label || t.sender_label || t.student_label, hidden_at: t.hidden_at, deleted_at: t.deleted_at, room: t.room, created_at: t.created_at } : null }); }); },
      async spSanctions() { const c = await cli(); return q(c.from("chat_sanctions").select("*").is("lifted_at", null).order("created_at", { ascending: false })); },
      async spModerate(action, type, tid, user, report, reason, until) { const c = await cli();
        await q(c.rpc("moderate", { p_action: action, p_target_type: type || null, p_target_id: tid || null, p_user: user || null, p_report: report || null, p_reason: reason || null, p_until: until || null })); },
      async newsList(all) { const c = await cli(); try { return await q(c.from("news_posts").select("*").order("created_at", { ascending: false }).limit(100)); } catch (e) { if (all) throw e; return []; } },
      async newsSave(o) { const c = await cli(), row = { kind: o.kind, title: o.title, body: o.body || "", audience: o.audience || "todos", event_at: o.event_at || null, event_theme: o.event_theme || null, signup: !!o.signup, published: !!o.published };
        return o.id ? q(c.from("news_posts").update(row).eq("id", o.id).select().single()) : q(c.from("news_posts").insert(row).select().single()); },
      async newsDelete(nid) { const c = await cli(); await q(c.from("news_posts").delete().eq("id", nid)); }
    };
  }
  Object.assign(api, api.mode === "supabase" ? sbLayer() : demoLayer());

  /* ======================= TEXTOS ======================= */
  const RULES = [
    "<b>Propósito educativo.</b> Mi espacio es para aprender inglés: hablar con tu teacher, enviar tus ejercicios y practicar con la comunidad de MEC.",
    "<b>Respeto.</b> No se permite el acoso, la discriminación, los insultos ni el contenido sexual o violento.",
    "<b>Tus datos son tuyos.</b> No compartas datos personales: ni teléfonos, ni direcciones, ni redes sociales (tuyos o de otras personas).",
    "<b>Todo dentro de la plataforma.</b> No propongas ni aceptes contacto fuera de MEC.",
    "<b>Moderación.</b> MEC modera Mi espacio: puede ocultar mensajes y suspender usuarios que no cumplan estas normas.",
    "<b>Botón Reportar.</b> Si ves algo que no está bien, usa «Reportar». El equipo de MEC lo revisa.",
    "<b>Tus mensajes se guardan.</b> Los mensajes y archivos quedan guardados y el equipo de moderación puede revisarlos.",
    "<b>Consecuencias.</b> Romper las normas puede llevar a ocultar tus mensajes, a silenciarte en la comunidad o a suspender tu acceso a Mi espacio."];
  const GUARD = `<div class="me-guard"><h3>Aviso para el acudiente</h3><p>Mi espacio de Mastery4Kids es un espacio educativo supervisado: el chat privado es solo entre tu hijo o hija, su teacher y tú como acudiente; los mensajes no se pueden borrar (solo MEC puede ocultarlos), no hay llamadas ni videollamadas y no hay comunidad abierta. El chat y la subida de ejercicios se activan cuando MEC registra tu autorización escrita.</p><p>Pide a tu hijo o hija que suba solo sus ejercicios, sin fotos de su cara, y que use «Reportar» si algo le incomoda.</p></div>`;
  const rulesHtml = () => `<ol class="me-normas">${RULES.map((r) => `<li>${r}</li>`).join("")}</ol>`;
  const when = (iso) => M.fmtDateTime(iso);
  const pend = (t) => `<p class="sp-pend">${t}</p>`;
  const fileIcon = (m) => /^image\//.test(m) ? "Imagen" : m === "application/pdf" ? "PDF" : "Word";
  const statusChip = (x) => x.status === "reviewed" ? '<span class="sp-tag ok">Revisado</span>' : '<span class="sp-tag">Enviado</span>';
  const kb = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";

  function reportModal(type, tid, after) {
    M.modal(`<h2>Reportar</h2><p>Cuéntanos qué pasa. El equipo de moderación de MEC lo revisa; mientras tanto el mensaje deja de verse en la comunidad.</p>
      <label for="me-rr">Motivo</label><select id="me-rr"><option>Falta de respeto o acoso</option><option>Comparte datos personales o redes sociales</option><option>Pide contacto fuera de la plataforma</option><option>Contenido sexual o violento</option><option>Spam</option><option>Otro</option></select>
      <label for="me-rd">Detalle (opcional)</label><textarea id="me-rd" rows="2" maxlength="400"></textarea>
      <p><button class="btn red" id="me-rok">Enviar reporte</button> <button class="btn ghost" onclick="MEC.closeModal()">Cancelar</button></p>`, () => {
      M.$("#me-rok").onclick = M.wrapErr(async () => { await api.spReport(type, tid, (M.$("#me-rr").value + ". " + M.$("#me-rd").value.trim()).trim()); M.closeModal(); M.toast("Gracias. Tu reporte fue enviado a moderación."); if (after) after(); });
    });
  }

  /* ---------- Componentes compartidos ---------- */
  function chatBox(root, threads, opts) {
    let cur = (threads.find((t) => t.id === opts.thread) || threads[0] || {}).id;
    const who = (t) => opts.role === "teacher" || opts.role === "admin" ? t.student_label : t.teacher_label;
    const paint = async () => {
      if (!threads.length) { root.innerHTML = pend(opts.empty || "Aún no tienes conversaciones."); return; }
      const msgs = await api.spMessages(cur), mine = opts.me.id;
      root.innerHTML = `${threads.length > 1 ? `<div class="me-hilos" role="tablist" aria-label="Conversaciones">${threads.map((t) => `<button type="button" role="tab" class="me-hilo${t.id === cur ? " on" : ""}" aria-selected="${t.id === cur}" data-th="${esc(t.id)}">${esc(who(t))}</button>`).join("")}</div>` : `<p class="me-con">Conversación con <b>${esc(who(threads[0]))}</b></p>`}
        <div class="me-msgs" aria-live="polite">${msgs.map((m) => `<div class="me-msg${m.sender_id === mine ? " yo" : ""}${m.hidden_at ? " oculto" : ""}"><div class="me-msg-h"><b>${esc(m.sender_id === mine ? "Tú" : m.sender_label)}</b><time datetime="${esc(m.created_at)}">${when(m.created_at)}</time></div><p>${esc(m.body)}</p>
          ${m.hidden_at ? '<span class="sp-tag">Oculto por moderación</span>' : m.sender_id !== mine && opts.role !== "admin" ? `<button type="button" class="me-rep" data-rep-dm="${esc(m.id)}">Reportar</button>` : ""}</div>`).join("") || pend("Escribe el primer mensaje.")}</div>
        ${opts.readonly ? "" : `<form class="me-form" id="me-dmf"><label class="sr" for="me-dmt">Mensaje</label><textarea id="me-dmt" rows="2" maxlength="2000" placeholder="Escribe tu mensaje…" required></textarea><button class="sp-btn oro" type="submit">Enviar</button></form>`}`;
      const box = root.querySelector(".me-msgs"); if (box) box.scrollTop = box.scrollHeight;
      root.querySelectorAll("[data-th]").forEach((b) => (b.onclick = () => { cur = b.dataset.th; paint(); }));
      root.querySelectorAll("[data-rep-dm]").forEach((b) => (b.onclick = () => reportModal("dm", b.dataset.repDm)));
      const f = root.querySelector("#me-dmf"); if (f) f.onsubmit = M.wrapErr(async (e) => { e.preventDefault(); await api.spSend(cur, root.querySelector("#me-dmt").value); await paint(); });
    };
    return M.wrapErr(paint)();
  }

  /* Entregas: lista + formulario. opts = { me, role, kid, class_id (undefined = todas), teacher_id, upload: bool, title } */
  async function subsBox(root, opts) {
    const paint = async () => {
      const list = await api.spSubs(opts.class_id === undefined ? {} : { class_id: opts.class_id });
      root.innerHTML = `${opts.upload ? `<form class="me-up" id="me-upf"><label for="me-upt">Título</label><input id="me-upt" maxlength="200" placeholder="${esc(opts.placeholder || "Ej.: Ejercicio de la clase")}">
          <label for="me-upa">Archivo (imagen, PDF o Word · máximo 10 MB)</label><input id="me-upa" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,application/pdf,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required>
          ${opts.kid ? '<p class="me-aviso-k">Sube solo tu ejercicio, sin fotos de tu cara.</p>' : ""}<p><button class="sp-btn oro" type="submit">Enviar ejercicio</button></p></form>` : ""}
        <ul class="me-subs">${list.map((x) => `<li class="me-sub${x.hidden_at ? " oculto" : ""}"><div class="me-sub-h"><b>${esc(x.title)}</b>${statusChip(x)}</div>
          <p class="sp-small">${opts.role === "student" ? "" : esc(x.student_label || "") + " · "}${fileIcon(x.mime_type)} · ${kb(x.size_bytes)} · ${when(x.created_at)}${x.hidden_at ? ' · <span class="sp-tag">Oculto por moderación</span>' : ""}</p>
          <p><button type="button" class="sp-btn" data-ver="${esc(x.id)}">Ver archivo</button>${opts.role === "teacher" && x.status !== "reviewed" ? ` <button type="button" class="sp-btn oro" data-rev="${esc(x.id)}">Marcar revisado</button>` : ""}${opts.role !== "admin" ? ` <button type="button" class="me-rep" data-rep-sub="${esc(x.id)}">Reportar</button>` : ""}</p>
          ${x.comments.length ? `<ul class="me-coms">${x.comments.map((c) => `<li><b>${esc(c.author_id === opts.me.id ? "Tú" : c.author_label)}</b> <time>${when(c.created_at)}</time><p>${esc(c.body)}</p></li>`).join("")}</ul>` : `<p class="sp-small">${opts.role === "student" ? "Tu teacher comentará esta entrega." : "Sin comentarios aún."}</p>`}
          ${opts.role === "admin" ? "" : `<form class="me-form me-cf" data-sub="${esc(x.id)}"><label class="sr" for="me-c-${esc(x.id)}">Comentario</label><input id="me-c-${esc(x.id)}" maxlength="2000" placeholder="${opts.role === "teacher" ? "Comentario para el estudiante…" : "Responder a tu teacher…"}" required><button class="sp-btn" type="submit">Comentar</button></form>`}</li>`).join("") || `<li>${pend(opts.empty || "Aún no has enviado ejercicios.")}</li>`}</ul>`;
      const f = root.querySelector("#me-upf"); if (f) f.onsubmit = M.wrapErr(async (e) => { e.preventDefault(); const file = root.querySelector("#me-upa").files[0];
        await api.spUpload(file, { title: root.querySelector("#me-upt").value, class_id: opts.class_id || null, teacher_id: opts.teacher_id }); M.toast("Ejercicio enviado a tu teacher"); await paint(); });
      root.querySelectorAll("[data-ver]").forEach((b) => (b.onclick = M.wrapErr(async () => { const x = list.find((y) => y.id === b.dataset.ver); const url = await api.spFileUrl(x);
        const w = window.open("about:blank", "_blank"); if (w) { w.opener = null; w.location = url; } })));
      root.querySelectorAll("[data-rev]").forEach((b) => (b.onclick = M.wrapErr(async () => { await api.spReview(b.dataset.rev); M.toast("Entrega marcada como revisada"); await paint(); })));
      root.querySelectorAll("[data-rep-sub]").forEach((b) => (b.onclick = () => reportModal("submission", b.dataset.repSub)));
      root.querySelectorAll(".me-cf").forEach((fm) => (fm.onsubmit = M.wrapErr(async (e) => { e.preventDefault(); await api.spComment(fm.dataset.sub, fm.querySelector("input").value); await paint(); })));
    };
    return M.wrapErr(paint)();
  }

  async function communityBox(root, opts) {
    const paint = async () => {
      const list = await api.spCommunity("adultos");
      root.innerHTML = `${opts.muted ? '<p class="sp-pend">Moderación te silenció temporalmente en la comunidad.</p>' : `<form class="me-form" id="me-cof"><label class="sr" for="me-cot">Mensaje para la comunidad</label><textarea id="me-cot" rows="2" maxlength="1000" placeholder="Escribe en inglés para practicar…" required></textarea><button class="sp-btn oro" type="submit">Publicar</button></form>`}
        <ul class="me-com">${list.map((m) => `<li><div class="me-msg-h"><b>${esc(m.author_id === opts.me.id ? "Tú" : m.author_label)}</b><time>${when(m.created_at)}</time></div><p>${esc(m.body)}</p>${m.author_id !== opts.me.id ? `<button type="button" class="me-rep" data-rep-cm="${esc(m.id)}">Reportar</button>` : ""}</li>`).join("") || `<li>${pend("Aún no hay mensajes. ¡Saluda a la comunidad!")}</li>`}</ul>`;
      const f = root.querySelector("#me-cof"); if (f) f.onsubmit = M.wrapErr(async (e) => { e.preventDefault(); await api.spPost(root.querySelector("#me-cot").value); await paint(); });
      root.querySelectorAll("[data-rep-cm]").forEach((b) => (b.onclick = () => reportModal("community", b.dataset.repCm, paint)));
    };
    return M.wrapErr(paint)();
  }

  const notActive = (app, cls, title) => { app.innerHTML = `<div class="smc ${cls}"><div class="stt-in"><h1>${title}</h1><div class="sp-card"><h2>Próximamente</h2><p>Estamos preparando esta sección. Muy pronto la verás aquí.</p></div></div></div>`; };
  async function safeState() { try { return await api.spState(); } catch (e) { console.warn("Mi espacio no disponible:", e.message); return null; } }

  /* ======================= ESTUDIANTE: Mi espacio ======================= */
  async function studentView(app, ctx) {
    const st = await safeState(); if (!st) return notActive(app, "mes", "Mi espacio");
    const me = await api.currentUser();
    if (!st.accepted) {
      app.innerHTML = `<div class="smc mes"><div class="stt-in"><h1>Mi espacio</h1><section class="sp-card me-gate"><h2>Normas de Mi espacio</h2><p>Antes de entrar por primera vez, lee y acepta las normas.</p>${rulesHtml()}${st.kid ? GUARD : ""}
        <p class="me-check"><label><input type="checkbox" id="me-acepto"> ${st.kid ? "Mi acudiente y yo leímos las normas y las aceptamos." : "Leí las normas de Mi espacio y las acepto."}</label></p>
        <p><button class="sp-btn oro" id="me-entrar" disabled>Entrar a Mi espacio</button></p></section></div></div>`;
      M.$("#me-acepto").onchange = (e) => (M.$("#me-entrar").disabled = !e.target.checked);
      M.$("#me-entrar").onclick = M.wrapErr(async () => { if (!M.$("#me-acepto").checked) return; await api.spAccept(); studentView(app, ctx); });
      return;
    }
    const s = ctx.s, threads = st.consent ? await api.spThreads() : [];
    const gate = st.kid && !st.consent ? `<div class="sp-card ancho me-consent"><h2>Falta la autorización de tu acudiente</h2><p>El chat con tu teacher y la subida de ejercicios se activan cuando MEC registre la autorización escrita de tu acudiente. Pídele que escriba a MEC.</p></div>` : "";
    app.innerHTML = `<div class="smc mes"><div class="stt-in"><h1>Mi espacio</h1><p class="mt-intro">Habla con tu teacher, envía tus ejercicios${st.kid ? "" : " y practica con la comunidad"}. <button type="button" class="me-link" id="me-vn">Ver normas</button></p>
      <div class="sp-grid me-grid">${gate}${M.perfil.currentCard(s)}
        <section class="sp-card ancho me-chat"><h2>Chat con tu teacher${st.kid ? ' <span class="sp-tag">Con tu acudiente</span>' : ""}</h2><div id="me-chat">${st.consent ? '<p class="muted">Cargando…</p>' : pend("Disponible cuando MEC registre la autorización de tu acudiente.")}</div></section>
        <section class="sp-card ancho me-ent"><h2>Mis ejercicios</h2><div id="me-subs">${st.consent ? '<p class="muted">Cargando…</p>' : pend("Disponible cuando MEC registre la autorización de tu acudiente.")}</div></section>
        <section class="sp-card ancho me-comu"><h2>Comunidad${st.kid ? "" : " MEC"}</h2><div id="me-comu">${st.kid ? `<p class="sp-pend">Próximamente</p><p class="sp-small">Estamos preparando un espacio solo para Mastery4Kids, moderado por el equipo de MEC.</p>` : !st.community ? pend("La comunidad está en pausa.") : '<p class="muted">Cargando…</p>'}</div></section>
      </div></div></div>`;
    M.$("#me-vn").onclick = () => M.modal(`<h2>Normas de Mi espacio</h2>${rulesHtml()}${st.kid ? GUARD : ""}<p><button class="btn" onclick="MEC.closeModal()">Cerrar</button></p>`, null, true);
    if (st.consent) {
      chatBox(M.$("#me-chat"), threads, { me, role: "student", readonly: st.suspended, empty: s.teacher_id ? "Aún no tienes conversaciones." : "Cuando tengas teacher asignado podrás escribirle aquí." });
      subsBox(M.$("#me-subs"), { me, role: "student", kid: st.kid, upload: !st.suspended, teacher_id: s.teacher_id });
    }
    if (!st.kid && st.community) communityBox(M.$("#me-comu"), { me, muted: st.muted || st.suspended });
  }

  /* ======================= TEACHER: Mi espacio ======================= */
  async function teacherView(app) {
    const st = await safeState(); if (!st) return notActive(app, "mes", "Mi espacio");
    const me = await api.currentUser();
    if (!st.accepted) { app.innerHTML = `<h1>Mi espacio</h1><section class="panel me-gate"><h2>Normas de Mi espacio</h2>${rulesHtml()}<p class="me-check"><label><input type="checkbox" id="me-acepto"> Leí las normas y las acepto.</label></p><p><button class="btn" id="me-entrar" disabled>Entrar</button></p></section>`;
      M.$("#me-acepto").onchange = (e) => (M.$("#me-entrar").disabled = !e.target.checked); M.$("#me-entrar").onclick = M.wrapErr(async () => { await api.spAccept(); teacherView(app); }); return; }
    const threads = await api.spThreads();
    app.innerHTML = `<h1>Mi espacio</h1><p class="muted">Chats con tus estudiantes y sus ejercicios. Los mensajes no se borran; si ves algo indebido usa «Reportar». En Kids el acudiente también ve el chat.</p>
      <div class="grid g2"><section class="panel me-chat"><h3>Chats</h3><div id="me-chat"></div></section><section class="panel me-ent"><h3>Ejercicios recibidos</h3><div id="me-subs"></div></section></div>
      <section class="panel me-comu"><h3>Comunidad MEC</h3><div id="me-comu"></div></section>`;
    chatBox(M.$("#me-chat"), threads, { me, role: "teacher", empty: "Aún no hay conversaciones con tus estudiantes." });
    subsBox(M.$("#me-subs"), { me, role: "teacher", empty: "Aún no hay ejercicios." });
    communityBox(M.$("#me-comu"), { me, muted: st.muted });
  }

  /* ======================= ADMIN: Moderación ======================= */
  const TT = { community: "Comunidad", dm: "Chat privado", submission: "Ejercicio", comment: "Comentario" };
  async function adminModeration(app) {
    let reps, sanc;
    try { [reps, sanc] = await Promise.all([api.spReports(), api.spSanctions()]); }
    catch (e) { app.innerHTML = `<h1>Moderación</h1><div class="panel"><p class="muted">Mi espacio aún no está activado (falta aplicar la propuesta 20261016_mi_espacio, pendiente de la orden de Lobo).</p></div>`; return; }
    const open = reps.filter((r) => r.status === "open"), closed = reps.filter((r) => r.status !== "open");
    const row = (r) => { const t = r.target || {};
      return `<article class="panel mod-rep${r.status === "open" ? " abierto" : ""}"><div class="mod-h"><span class="tag">${TT[r.target_type]}</span>${t.room === "kids" ? ' <span class="tag">Sala Kids</span>' : ""}${r.involves_minor ? ' <span class="tag red">Involucra a un menor</span>' : ""}${r.legal_hold ? ' <span class="tag">Retención legal</span>' : ""}
          <span class="small muted">Reportado ${when(r.created_at)}${r.reporter_label ? " por " + esc(r.reporter_label) : ""}</span></div>
        <blockquote class="mod-q">${esc(t.body || "(contenido no disponible)")}</blockquote>
        <p class="small">Autor: <b>${esc(t.author_label || "—")}</b>${t.created_at ? " · " + when(t.created_at) : ""}${t.hidden_at ? ' · <span class="tag">Oculto</span>' : ""}${t.deleted_at ? ' · <span class="tag">Eliminado</span>' : ""}</p>
        <p class="small">Motivo: ${esc(r.reason || "—")}</p>
        ${r.status === "open" ? `<p class="mod-acc">
          ${r.target_type === "submission" ? `<button class="btn sm" data-m="hide_submission" data-r="${esc(r.id)}">Ocultar archivo</button>` : `<button class="btn sm" data-m="hide" data-r="${esc(r.id)}">Ocultar</button>`}
          ${r.target_type === "community" ? `<button class="btn sm red" data-m="delete" data-r="${esc(r.id)}">Eliminar</button>` : ""}
          <button class="btn ghost sm" data-m="close_report" data-r="${esc(r.id)}">Cerrar sin acción</button>
          ${t.author_id ? `<button class="btn ghost sm" data-m="mute" data-r="${esc(r.id)}">Silenciar 7 días</button> <button class="btn ghost sm red" data-m="suspend" data-r="${esc(r.id)}">Suspender</button>` : ""}</p>`
          : `<p class="small muted">Cerrado ${r.closed_at ? when(r.closed_at) : ""} · ${esc(r.resolution || "")}</p>`}</article>`; };
    app.innerHTML = `<h1>Moderación · Mi espacio</h1><p class="muted">Reportes de la comunidad, chats y ejercicios. Un mensaje de la comunidad con reporte abierto queda oculto para los estudiantes hasta que lo revises. Los mensajes privados y archivos de Kids solo se muestran aquí a partir de un reporte.</p>
      <div class="grid g3"><div class="kpi"><b>${open.length}</b><span>reportes abiertos</span></div><div class="kpi"><b>${open.filter((r) => r.involves_minor).length}</b><span>con menores</span></div><div class="kpi"><b>${sanc.length}</b><span>sanciones activas</span></div></div>
      <h2>Abiertos</h2>${open.map(row).join("") || '<div class="panel muted">No hay reportes abiertos.</div>'}
      <h2>Sanciones activas</h2>${sanc.length ? `<div class="panel">${sanc.map((x) => `<div class="cls"><div><b>${esc(x.user_label || x.user_id)}</b> <span class="tag">${x.kind === "mute" ? "Silenciado" : "Suspendido"}</span><br><span class="small muted">${x.until ? "Hasta " + when(x.until) : "Indefinida"} · ${esc(x.reason || "")}</span></div><div><button class="btn ghost sm" data-lift="${esc(x.user_id)}">Levantar</button></div></div>`).join("")}</div>` : '<div class="panel muted">Sin sanciones activas.</div>'}
      <h2>Cerrados</h2>${closed.slice(0, 20).map(row).join("") || '<div class="panel muted">Aún no hay reportes cerrados.</div>'}`;
    M.$$("[data-m]").forEach((b) => (b.onclick = M.wrapErr(async () => { const r = reps.find((x) => x.id === b.dataset.r), a = b.dataset.m, t = r.target || {};
      if (a === "delete" && !confirm("¿Eliminar este mensaje de la comunidad?")) return;
      const reason = a === "close_report" ? "Revisado: sin acción" : prompt("Motivo (queda en el registro de moderación):", { hide: "Incumple las normas", hide_submission: "Archivo no permitido", delete: "Incumple las normas", mute: "Incumple las normas de la comunidad", suspend: "Falta grave a las normas" }[a]);
      if (reason === null) return;
      if (a === "mute" || a === "suspend") {
        await api.spModerate(a, r.target_type, r.target_id, t.author_id, null, reason, a === "mute" ? new Date(Date.now() + 7 * 864e5).toISOString() : null);
        await api.spModerate(r.target_type === "submission" ? "hide_submission" : "hide", r.target_type, r.target_id, null, r.id, reason);
      } else await api.spModerate(a, r.target_type, r.target_id, null, r.id, reason);
      M.toast("Acción registrada"); adminModeration(app); })));
    M.$$("[data-lift]").forEach((b) => (b.onclick = M.wrapErr(async () => { await api.spModerate("lift", null, null, b.dataset.lift, null, "Sanción levantada"); M.toast("Sanción levantada"); adminModeration(app); })));
  }

  /* ======================= NOTICIAS Y EVENTOS ======================= */
  const isSat = (iso) => M.bog(iso).dow === 6;
  async function newsStudent(app, opts = {}) {
    const list = await api.newsList(false).catch(() => []), now = new Date().toISOString();
    const ev = list.filter((n) => n.kind === "event" && n.event_at >= now).sort((a, b) => a.event_at.localeCompare(b.event_at));
    const nw = list.filter((n) => n.kind !== "event" || n.event_at < now);
    const card = (n) => `<article class="sp-card nev-item${n.kind === "event" ? " ev" : ""}"><div class="nev-h">${n.kind === "event" ? '<span class="sp-tag ok">Evento</span>' : '<span class="sp-tag">Noticia</span>'}<time>${n.kind === "event" ? when(n.event_at) : M.fmtDate(n.published_at || n.created_at)}</time></div>
      <h2>${esc(n.title)}</h2>${n.event_theme ? `<p class="nev-tema">Tema: <b>${esc(n.event_theme)}</b></p>` : ""}${n.body ? `<p>${esc(n.body).replace(/\n/g, "<br>")}</p>` : ""}
      ${n.kind === "event" && n.signup && n.event_at >= now ? `<p><button type="button" class="sp-btn oro" data-insc="${esc(n.event_at)}">Inscribirme</button> <span class="sp-small">Abre el Calendario en ${isSat(n.event_at) ? "ese sábado" : "esa fecha"} para agendar tu cupo.</span></p>` : ""}</article>`;
    app.innerHTML = `<div class="smc nev"><div class="stt-in"><h1>Noticias y eventos</h1><p class="mt-intro">Lo nuevo en MEC y los próximos eventos.</p>
      <section class="mt-sec"><h2 class="mt-h">Próximos eventos</h2>${ev.length ? `<div class="nev-grid">${ev.map(card).join("")}</div>` : '<div class="sp-card"><p class="sp-pend">No hay eventos próximos.</p></div>'}</section>
      <section class="mt-sec"><h2 class="mt-h">Noticias</h2>${nw.length ? `<div class="nev-grid">${nw.map(card).join("")}</div>` : '<div class="sp-card"><p class="sp-pend">Aún no hay noticias.</p></div>'}</section></div></div>`;
    M.$$("[data-insc]").forEach((b) => (b.onclick = () => opts.inscribir && opts.inscribir(b.dataset.insc)));
  }
  const toLocalInput = (iso) => { if (!iso) return ""; const p = M.bog(iso); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}T${String(p.h ?? new Date(iso).getHours()).padStart(2, "0")}:00`; };
  const fromLocalInput = (v) => { if (!v) return null; const [d, t] = v.split("T"), [y, m, dd] = d.split("-").map(Number), h = +(t || "0").split(":")[0]; return M.bogDate(y, m, dd, h).toISOString(); };
  async function newsAdmin(app) {
    let list; try { list = await api.newsList(true); } catch (e) { app.innerHTML = `<h1>Noticias y eventos</h1><div class="panel muted">Aún no está activado (falta aplicar la propuesta 20261016_noticias, pendiente de la orden de Lobo).</div>`; return; }
    const AUD = { todos: "Todos", adultos: "Adultos", kids: "Kids" };
    app.innerHTML = `<h1>Noticias y eventos</h1><p class="muted">Lo que publiques aquí lo ven los estudiantes en su pestaña «Noticias y eventos». Solo se muestran las entradas publicadas.</p>
      <p><button class="btn" id="nw-new">Nueva noticia o evento</button></p>
      <table class="tbl adm-news"><thead><tr><th>Título</th><th>Tipo</th><th>Fecha</th><th>Público</th><th>Estado</th><th></th></tr></thead><tbody>${list.map((n) => `<tr><td><b>${esc(n.title)}</b>${n.event_theme ? `<br><span class="small muted">Tema: ${esc(n.event_theme)}</span>` : ""}</td>
        <td>${n.kind === "event" ? "Evento" + (n.signup ? " · Inscripción" : "") : "Noticia"}</td><td class="small">${n.kind === "event" ? when(n.event_at) : M.fmtDate(n.published_at || n.created_at)}</td><td>${AUD[n.audience] || n.audience}</td>
        <td>${n.published ? '<span class="tag ok">Publicada</span>' : '<span class="tag">Borrador</span>'}</td>
        <td class="nowrap"><button class="btn ghost sm" data-ed="${esc(n.id)}">Editar</button> <button class="btn ghost sm" data-pub="${esc(n.id)}">${n.published ? "Despublicar" : "Publicar"}</button> <button class="btn ghost sm red" data-del="${esc(n.id)}">Eliminar</button></td></tr>`).join("") || '<tr><td colspan="6" class="muted">Aún no hay entradas.</td></tr>'}</tbody></table>`;
    const edit = (n = {}) => M.modal(`<h2>${n.id ? "Editar" : "Nueva"} entrada</h2>
      <label for="nw-k">Tipo</label><select id="nw-k"><option value="news">Noticia</option><option value="event" ${n.kind === "event" ? "selected" : ""}>Evento</option></select>
      <label for="nw-t">Título</label><input id="nw-t" maxlength="160" value="${esc(n.title || "")}">
      <label for="nw-b">Texto</label><textarea id="nw-b" rows="4" maxlength="4000">${esc(n.body || "")}</textarea>
      <div id="nw-ev"><label for="nw-d">Fecha y hora (Bogotá)</label><input id="nw-d" type="datetime-local" step="3600" value="${toLocalInput(n.event_at)}">
      <label for="nw-th">Tema (p. ej. tema del CLUB)</label><input id="nw-th" maxlength="160" value="${esc(n.event_theme || "")}">
      <label class="chk"><input type="checkbox" id="nw-s" ${n.signup ? "checked" : ""}> Mostrar «Inscribirme» (abre el Calendario en esa fecha)</label></div>
      <label for="nw-a">Público</label><select id="nw-a">${Object.entries(AUD).map(([k, v]) => `<option value="${k}" ${n.audience === k ? "selected" : ""}>${v}</option>`).join("")}</select>
      <label class="chk"><input type="checkbox" id="nw-p" ${n.published ? "checked" : ""}> Publicada</label>
      <p><button class="btn" id="nw-ok">Guardar</button> <button class="btn ghost" onclick="MEC.closeModal()">Cancelar</button></p>`, () => {
      const tog = () => (M.$("#nw-ev").hidden = M.$("#nw-k").value !== "event"); M.$("#nw-k").onchange = tog; tog();
      M.$("#nw-ok").onclick = M.wrapErr(async () => { const k = M.$("#nw-k").value;
        await api.newsSave({ id: n.id, kind: k, title: M.$("#nw-t").value, body: M.$("#nw-b").value, audience: M.$("#nw-a").value, published: M.$("#nw-p").checked,
          event_at: k === "event" ? fromLocalInput(M.$("#nw-d").value) : null, event_theme: k === "event" ? M.$("#nw-th").value.trim() : null, signup: k === "event" && M.$("#nw-s").checked });
        M.closeModal(); M.toast("Guardado"); newsAdmin(app); });
    }, true);
    M.$("#nw-new").onclick = () => edit({ kind: "news", audience: "todos" });
    M.$$("[data-ed]").forEach((b) => (b.onclick = () => edit(list.find((n) => n.id === b.dataset.ed))));
    M.$$("[data-pub]").forEach((b) => (b.onclick = M.wrapErr(async () => { const n = list.find((x) => x.id === b.dataset.pub); await api.newsSave(Object.assign({}, n, { published: !n.published })); M.toast(n.published ? "Despublicada" : "Publicada"); newsAdmin(app); })));
    M.$$("[data-del]").forEach((b) => (b.onclick = M.wrapErr(async () => { if (!confirm("¿Eliminar esta entrada?")) return; await api.newsDelete(b.dataset.del); M.toast("Eliminada"); newsAdmin(app); })));
  }

  M.espacio = { studentView, teacherView, adminModeration, subsBox, RULES };
  M.noticias = { student: newsStudent, admin: newsAdmin };
})();
