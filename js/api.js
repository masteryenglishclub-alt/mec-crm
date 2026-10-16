/* MEC CRM – capa de datos. Dos implementaciones con la misma interfaz:
   - "supabase": usa supabase-js (CDN) + RLS del servidor (la seguridad real está en la base de datos).
   - "demo": datos falsos en localStorage que imitan las mismas reglas (solo para previsualizar). */
(function () {
  const M = window.MEC, cfg = window.MEC_CRM_CONFIG || {};
  const useSb = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  /* ======================= MODO DEMO ======================= */
  function demoApi() {
    const KEY = "mec_crm_demo_v4", SKEY = "mec_crm_demo_session";
    let db = JSON.parse(localStorage.getItem(KEY) || "null");
    const save = () => localStorage.setItem(KEY, JSON.stringify(db));
    function me() { const id = sessionStorage.getItem(SKEY); return db.profiles.find((p) => p.id === id) || null; }
    const role = () => (me() || {}).role;
    const prof = (id) => db.profiles.find((p) => p.id === id) || {};
    const stu = (id) => db.students.find((s) => s.id === id);
    const teach = (id) => db.teachers.find((t) => t.id === id);
    const today = () => new Date().toISOString();
    const notExpired = (p) => !p.expiry_date || p.expiry_date.slice(0, 10) >= today().slice(0, 10);
    const usable = (p) => !["pending", "refunded", "cancelled"].includes(p.payment_status) && notExpired(p); // solo "pending" (paquete nuevo sin pagar) bloquea
    const pendPay = (p) => p.payment_status === "pending" && notExpired(p);
    // Pases POR ESTUDIANTE en periodos móviles de N meses desde el ancla (primer paquete; si no hay, fecha de inicio)
    const addM = (d, m) => { const x = new Date(d + "T12:00:00Z"); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };
    function passPeriod(sid, on) {
      const s = stu(sid), pk = db.student_packages.filter((p) => p.student_id === sid && !["refunded", "cancelled"].includes(p.payment_status)).map((p) => p.purchase_date.slice(0, 10)).sort();
      const a = s.pass_anchor_date || pk[0] || s.start_date.slice(0, 10), m = Math.max(1, set("pass_period_months")), d = on || today().slice(0, 10);
      let k = 0; while (addM(a, (k + 1) * m) <= d) k++;
      return { start: addM(a, k * m), end: addM(a, (k + 1) * m) };
    }
    const passesUsed = (sid, on, excl) => { const pp = passPeriod(sid, on);
      return db.classes.filter((c) => c.student_id === sid && c.late_penalty === "free_pass" && c.id !== excl && (() => { const p = M.bog(c.starts_at), d = `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; return d >= pp.start && d < pp.end; })()).length; };
    function activePkgs(sid) { return db.student_packages.filter((p) => p.student_id === sid && usable(p)); }
    const set = (k) => db.settings[k];
    // Igual que public.student_credits(): clases usables, reservadas, solicitudes, pases y pago pendiente
    function credits(sid) {
      const pk = db.student_packages.filter((p) => p.student_id === sid), sum = (a, f) => a.reduce((x, p) => x + f(p), 0);
      const live = pk.filter((p) => !["refunded", "cancelled"].includes(p.payment_status) && notExpired(p));
      const u = sum(pk.filter(usable), (p) => p.classes_total - p.classes_used);
      const reserved = db.classes.filter((c) => c.student_id === sid && c.status === "scheduled" && c.class_type !== "extra_reinforcement").length;
      const pending = db.requests.filter((r) => r.student_id === sid && r.status === "pending").length;
      const pend = pk.filter((p) => pendPay(p) && p.classes_used < p.classes_total);
      const pt = set("free_passes_per_period"), pu = passesUsed(sid), pp = passPeriod(sid);
      return { student_id: sid, usable_remaining: u, reserved, pending_requests: pending, available_to_request: Math.max(0, u - reserved - pending),
        pending_payment_classes: sum(pend, (p) => p.classes_total - p.classes_used), pending_payment_codes: pend.map((p) => p.package_code).join(", ") || null,
        passes_total: pt, passes_used: pu, passes_remaining: Math.max(0, pt - pu), payment_blocked: u === 0 && pend.length > 0, passes_period_start: pp.start, passes_period_end: pp.end,
        free_passes_per_period: set("free_passes_per_period"), pass_period_months: set("pass_period_months"), late_cancel_hours: set("late_cancel_hours"), min_request_hours: set("min_request_hours") };
    }
    function noCredit(sid, action) {
      const c = credits(sid);
      if (c.pending_payment_classes > 0) throw new Error(`PAGO PENDIENTE: el paquete ${c.pending_payment_codes} tiene el pago pendiente y no se puede usar. No es posible ${action} hasta que el admin confirme el pago.`);
      throw new Error(`Sin clases disponibles: no hay paquete pagado y vigente con clases libres para ${action}`);
    }
    // Política de cancelación tardía / inasistencia (igual que classes_before)
    function penalize(c) { // nunca hay deuda: pase del estudiante en el periodo de la clase; si no, se descuenta la clase
      c.late_penalty = "none"; c.penalty_package_id = null;
      if (c.class_type === "extra_reinforcement") return;
      const p = M.bog(c.starts_at), d = `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
      if (passesUsed(c.student_id, d, c.id) < set("free_passes_per_period")) { c.late_penalty = "free_pass"; return; }
      const pk = db.student_packages.filter((x) => x.student_id === c.student_id && x.classes_used < x.classes_total && !["refunded", "cancelled"].includes(x.payment_status))
        .sort((a, b) => (usable(b) - usable(a)) || a.purchase_date.localeCompare(b.purchase_date))[0];
      if (!pk) throw new Error("No hay clase que descontar: el estudiante no tiene saldo en ningún paquete (no se genera deuda)");
      pk.classes_used++; c.late_penalty = "class_deducted"; c.penalty_package_id = pk.id;
    }
    const busyAt = (list, t) => list.some((c) => c.status !== "cancelled" && Math.abs(new Date(c.starts_at) - t) < 3600e3);
    function checkAvail(tid, start, who) {
      const t = teach(tid), p = M.bog(start);
      if (t.availability.length && !t.availability.some(([d, a, b]) => d === p.dow && p.h >= a && p.h < b)) throw new Error(`${who} no tiene disponibilidad en ese bloque`);
    }
    function complete(c) {
      const s = stu(c.student_id), pointer = s.start_class_number - 1 + s.classes_completed;
      if (c.class_number && c.class_number !== pointer + 1) throw new Error(`La clase #${c.class_number} aún no está habilitada: falta completar la #${pointer + 1}`);
      if (c.class_type !== "extra_reinforcement") {
        const pk = c.student_package_id ? db.student_packages.find((p) => p.id === c.student_package_id)
          : activePkgs(c.student_id).filter((p) => p.classes_used < p.classes_total).sort((a, b) => a.purchase_date.localeCompare(b.purchase_date))[0];
        if (!pk) noCredit(c.student_id, "descontar la clase");
        pk.classes_used++; c.student_package_id = pk.id;
      }
      if (c.class_number) s.classes_completed++;
      c.status = "completed";
    }
    // "RLS" de demo: qué clases y estudiantes ve cada rol
    function visibleClasses() {
      const u = me(); if (!u) return [];
      if (u.role === "admin") return db.classes;
      if (u.role === "teacher") return db.classes.filter((c) => c.teacher_id === u.id);
      return db.classes.filter((c) => c.student_id === u.id);
    }
    function visibleStudents() {
      const u = me(); if (!u) return [];
      if (u.role === "admin") return db.students;
      if (u.role === "teacher") return db.students.filter((s) => s.teacher_id === u.id);
      return db.students.filter((s) => s.id === u.id);
    }
    function remaining(sid) {
      const s = stu(sid), pk = activePkgs(sid);
      const purchased = pk.reduce((a, p) => a + p.classes_total, 0), used = pk.reduce((a, p) => a + p.classes_used, 0);
      const cr = credits(sid);
      return { classes_purchased: purchased, classes_used: used, classes_remaining: purchased - used, program_completed: s.classes_completed,
        classes_payment_pending: cr.pending_payment_classes, free_passes_total: cr.passes_total, free_passes_used: cr.passes_used,
        program_remaining: 161 - s.start_class_number - s.classes_completed, next_class_number: Math.min(160, s.start_class_number + s.classes_completed) };
    }
    const decorate = (c) => {
      const s = stu(c.student_id), fb = db.feedback[c.id] || {};
      return Object.assign({}, c, { title: M.classInfo(c.class_number, s && s.program).title, meet_url: c.meet_url || (teach(c.teacher_id) || {}).meet_url,
        teacher_name: prof(c.teacher_id).full_name, student_name: prof(c.student_id).full_name, teacher_note: fb.teacher_note || null, sentences: fb.sentences || null,
        attendance: db.attendance[c.id] || null, late_penalty: c.late_penalty || "none" });
    };
    const need = (...roles) => { if (!roles.includes(role())) throw new Error("Permiso denegado"); };
    const canTeachClass = (c) => role() === "admin" || (role() === "teacher" && c.teacher_id === me().id);
    if (!db) { // primera carga: aplicar las completadas en orden (igual que el trigger)
      db = window.MEC_DEMO_SEED();
      const done = db.classes.filter((c) => c.status === "completed").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      db.classes.forEach((c) => { if (c.status === "completed") c.status = "scheduled"; });
      done.forEach((c) => complete(c));
      save();
    }
    return {
      mode: "demo",
      async sessionFromUrl() { return null; }, async updatePassword() {}, async resetPassword() { throw new Error("En modo demo no se envían correos."); },
      /* ---- Material Kids (demo: solo metadatos en localStorage) ---- */
      async listKidsMaterials() { return (db.kids_materials || []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)); },
      async uploadKidsMaterial(file, title, description) { need("admin", "teacher"); M.checkKidsFile(file);
        db.kids_materials = db.kids_materials || [];
        const r = { id: "km-" + Date.now(), title, description, file_path: M.kidsPath(file), mime_type: file.type, size_bytes: file.size, uploaded_by: me().id, created_at: new Date().toISOString(), url: "#" };
        db.kids_materials.push(r); save(); return r; },
      async deleteKidsMaterial(id) { need("admin", "teacher"); db.kids_materials = (db.kids_materials || []).filter((x) => x.id !== id); save(); },
      async currentUser() { return me(); },
      async demoLogin(r, uid) { const u = db.profiles.find((p) => (uid ? p.id === uid : p.role === r)); sessionStorage.setItem(SKEY, u.id); return u; },
      async signIn() { throw new Error("Modo demo: usa los botones de acceso demo (no hay Supabase configurado)."); },
      async signOut() { sessionStorage.removeItem(SKEY); },
      resetDemo() { localStorage.removeItem(KEY); },
      async listClasses(f = {}) {
        return visibleClasses().filter((c) => (!f.from || c.starts_at >= f.from) && (!f.to || c.starts_at < f.to) && (!f.studentId || c.student_id === f.studentId))
          .map(decorate).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      },
      async listStudents() {
        return visibleStudents().map((s) => Object.assign({}, s, { full_name: prof(s.id).full_name, email: prof(s.id).email, teacher_name: s.teacher_id ? prof(s.teacher_id).full_name : null,
          ...levelOf(s), remaining: remaining(s.id) }));
      },
      async listTeachers() {
        if (role() === "student") { const s = stu(me().id); const t = teach(s.teacher_id); return t ? [{ id: t.id, full_name: prof(t.id).full_name, meet_url: t.meet_url }] : []; }
        return db.teachers.filter((t) => role() === "admin" || t.id === me().id).map((t) => Object.assign({}, t, { full_name: prof(t.id).full_name }));
      },
      async listPackages() { return db.packages.filter((p) => p.active).sort((a, b) => a.sort_order - b.sort_order); },
      /* ---- Perfiles (migración 0900). Demo: sin BIO/estilo guardados -> la interfaz muestra estados vacíos. ---- */
      async getStudentProfile(sid) { const ok = visibleStudents().some((s) => s.id === sid); if (!ok) throw new Error("Permiso denegado"); return (db.student_profiles || {})[sid] || null; },
      async getInternalNote(sid) { need("admin", "teacher"); if (!visibleStudents().some((s) => s.id === sid)) return null; const n = db.notes && db.notes[sid]; return n ? { notes: n } : null; },
      async listTeacherProfiles() { const tp = db.teacher_profiles || {}; // demo: sin perfiles hasta que se editen (sin datos de ejemplo)
        return Object.values(tp).filter((t) => t.published || t.teacher_id === me().id || role() === "admin").map((t) => Object.assign({}, t)); },
      /* v3 perfil: reseñas/certificaciones aún no existen en la base; en DEMO solo hay datos si se carga js/demo-profesor.js (nunca se publica). */
      async listTeacherReviews(tid) { if (!(role() === "admin" || (role() === "teacher" && me().id === tid))) return []; const d = window.MEC_DEMO_PROFESOR; return (d && d.reviews && d.reviews[tid]) || []; },
      async listTeacherCertifications(tid) { const d = window.MEC_DEMO_PROFESOR; return (d && d.certifications && d.certifications[tid]) || []; },
      /* v3 perfil: niveles A1–C1 calculados de los estudiantes reales del teacher (solo staff; un estudiante solo vería su propia fila). */
      async teacherLevelCounts(tid) { const u = await this.currentUser(); if (!u || (u.role !== "admin" && !(u.role === "teacher" && u.id === tid))) return [];
        const m = {}; (await this.listStudents()).filter((s) => s.teacher_id === tid && s.active !== false).forEach((s) => { const n = Math.min(160, Math.max(1, (s.start_class_number || 1) - 1 + (s.classes_completed || 0))); const l = M.classInfo(n, s.program).levelCode; m[l] = (m[l] || 0) + 1; });
        return Object.keys(m).map((level) => ({ level, count: m[level] })); },
      /* Sobre mí (bio, gustos, temas): solo el propio teacher. Devuelve { saved: [...], pending: [...] } */
      async saveTeacherPersonal(tid, o) { if (!(role() === "teacher" && me().id === tid)) throw new Error("Solo el teacher puede editar su propio perfil.");
        const old = (db.teacher_profiles || {})[tid]; if (!old) throw new Error("Tu perfil público aún no existe: créalo primero en «Mi perfil» del CRM.");
        db.teacher_profiles[tid] = Object.assign({}, old, o, { teacher_id: tid, published: old.published }); save(); return { saved: Object.keys(o), pending: [] }; },
      async getTeacherProfile(tid) { const t = (db.teacher_profiles || {})[tid]; return t && (t.published || tid === me().id || role() === "admin") ? Object.assign({}, t) : null; },
      async saveTeacherProfile(tid, o) {
        need("admin", "teacher"); if (role() === "teacher" && tid !== me().id) throw new Error("Permiso denegado");
        db.teacher_profiles = db.teacher_profiles || {}; const old = db.teacher_profiles[tid] || { published: false };
        if (role() !== "admin" && "published" in o && o.published !== old.published) throw new Error("Solo un admin puede publicar perfiles de teachers");
        if (o.color && !/^#[0-9a-fA-F]{6}$/.test(o.color)) throw new Error("Color inválido");
        db.teacher_profiles[tid] = Object.assign({}, old, o, { teacher_id: tid }); save(); },
      async saveStudentProfile(sid, o) {
        need("admin", "teacher"); if (!visibleStudents().some((s) => s.id === sid)) throw new Error("Permiso denegado");
        const st = [o.style_visual, o.style_auditory, o.style_kinesthetic];
        if (st.some((v) => v != null) && (st.some((v) => v == null) || st.reduce((a, b) => a + b, 0) !== 100)) throw new Error("El estilo de aprendizaje debe sumar 100");
        db.student_profiles = db.student_profiles || {}; db.student_profiles[sid] = Object.assign({}, db.student_profiles[sid], o, { student_id: sid }); save(); },
      async listStudentPackages(sid) {
        const ok = visibleStudents().map((s) => s.id);
        return db.student_packages.filter((p) => ok.includes(p.student_id) && (!sid || p.student_id === sid)).map((p) => Object.assign({}, p, { classes_remaining: p.classes_total - p.classes_used, usable: usable(p) }));
      },
      async createClass(o) {
        need("admin", "teacher");
        if (role() === "teacher" && o.class_type !== "extra_reinforcement") throw new Error("Permiso denegado: solo el admin agenda clases del programa");
        const start = new Date(o.starts_at), iso = start.toISOString();
        if (!M.isValidSlot(start)) throw new Error("Fuera del horario de clases (L-V 6:00-18:00, sáb 10:00-16:00, hora Bogotá, en punto)");
        const t = teach(o.teacher_id), p = M.bog(start);
        if (t.availability.length && !t.availability.some(([d, a, b]) => d === p.dow && p.h >= a && p.h < b)) throw new Error("El teacher no tiene disponibilidad en ese bloque");
        const busy = (c) => c.status !== "cancelled" && Math.abs(new Date(c.starts_at) - start) < 3600e3;
        if (db.classes.some((c) => c.teacher_id === o.teacher_id && busy(c))) throw new Error("Doble reserva: el teacher ya tiene una clase en ese bloque");
        if (db.classes.some((c) => c.student_id === o.student_id && busy(c))) throw new Error("Doble reserva: el estudiante ya tiene una clase en ese bloque");
        const n = o.class_number ? +o.class_number : null, s = stu(o.student_id);
        if (n) { const cr = credits(o.student_id); if (cr.usable_remaining - cr.reserved < 1) noCredit(o.student_id, "agendar la clase"); }
        if (n && n <= s.start_class_number - 1 + s.classes_completed) throw new Error(`La clase #${n} ya fue completada`);
        if (n && db.classes.some((c) => c.student_id === s.id && c.class_number === n && ["scheduled", "completed"].includes(c.status))) throw new Error(`La clase #${n} ya está agendada`);
        const c = { id: "c-" + Date.now(), student_id: o.student_id, teacher_id: o.teacher_id, starts_at: iso, class_number: n,
          class_type: n ? M.classInfo(n).type : "extra_reinforcement", status: "scheduled", meet_url: o.meet_url || null };
        db.classes.push(c); save(); return c;
      },
      async setClassStatus(id, status) {
        const c = db.classes.find((x) => x.id === id); if (!c || !canTeachClass(c)) throw new Error("Permiso denegado");
        if (c.status === "completed" && status !== "completed") throw new Error("Revertir una clase completada solo se hace en la base de datos (admin)");
        if (status === "completed") complete(c); else if (status === "cancelled") return this.cancelClass(id, null, true); else c.status = status;
        save();
      },
      async markAttendance(id, st) {
        const c = db.classes.find((x) => x.id === id); if (!c || !canTeachClass(c)) throw new Error("Permiso denegado");
        if (st === "absent") { if (c.status === "scheduled") { c.status = "no_show"; penalize(c); } } else complete(c);
        db.attendance[id] = st; save();
      },
      async saveFeedback(id, note, sentences) {
        const c = db.classes.find((x) => x.id === id); if (!c || !canTeachClass(c)) throw new Error("Permiso denegado");
        if (sentences.length < 3 || sentences.length > 5) throw new Error("My sentences today: escribe entre 3 y 5 frases");
        db.feedback[id] = { teacher_note: note, sentences }; save();
      },
      async getAssessment(id) { need("admin", "teacher"); const c = db.classes.find((x) => x.id === id); if (!canTeachClass(c)) throw new Error("Permiso denegado"); return db.assessments[id] || null; },
      async getRubric() { // la rúbrica solo se descarga para teacher/admin (con Supabase: tablas con RLS solo staff)
        need("admin", "teacher");
        if (!window.MEC_DEMO_RUBRIC) await new Promise((ok, ko) => { const sc = document.createElement("script"); sc.src = "js/demo-rubric.js"; sc.onload = ok; sc.onerror = () => ko(new Error("No se pudo cargar la rúbrica")); document.head.appendChild(sc); });
        return window.MEC_DEMO_RUBRIC;
      },
      async saveAssessment(id, a) {
        need("admin", "teacher"); const c = db.classes.find((x) => x.id === id), R = await this.getRubric();
        const kind = c.class_type === "extra_reinforcement" ? "mini_conversation_lab" : "conversation_lab";
        if (!canTeachClass(c) || !["conversation_lab", "extra_reinforcement"].includes(c.class_type)) throw new Error("La rúbrica solo aplica a la Clase 6 (Conversation Lab) o al mini Conversation Lab");
        if (a.proposed_result && (a.proposal_justification || "").trim().length < 10) throw new Error("El ajuste de decisión exige una justificación escrita");
        const prev = db.assessments[id] || {}, sc = a.scores;
        const result = R.decide(sc, kind), total = Object.values(sc).reduce((x, y) => x + +y, 0);
        let status = a.proposed_result ? (prev.proposed_result === a.proposed_result ? prev.proposal_status || "pending" : "pending") : "none";
        if (a.proposal_status && a.proposal_status !== status) { if (role() !== "admin") throw new Error("Solo la coordinación académica (admin) aprueba o rechaza un ajuste"); status = a.proposal_status; }
        db.assessments[id] = Object.assign({}, a, { class_id: id, assessment_kind: kind, total_score: total, result, proposal_status: status,
          final_result: status === "approved" ? a.proposed_result : result }); save(); return db.assessments[id];
      },
      /* ---------- Solicitudes de clase y saldo ---------- */
      async bookingStatus(sid) { const u = me(); sid = sid || u.id; if (!visibleStudents().some((s) => s.id === sid)) throw new Error("Permiso denegado"); return credits(sid); },
      async settings() { return Object.assign({}, db.settings); },
      async setSetting(k, v) { need("admin"); db.settings[k] = +v; save(); },
      async teacherCalendar(tid, from, to) { // estudiante: solo bloques ocupados de SU teacher, sin nombres
        const u = me(); if (u.role === "student" && stu(u.id).teacher_id !== tid) return { availability: [], busy: [] };
        if (u.role === "teacher" && u.id !== tid) return { availability: [], busy: [] };
        const busy = db.classes.filter((c) => c.teacher_id === tid && c.status !== "cancelled" && c.starts_at >= from && c.starts_at < to).map((c) => c.starts_at);
        return { availability: teach(tid).availability, busy };
      },
      async listRequests(f = {}) {
        const u = me();
        return db.requests.filter((r) => u.role === "admin" || (u.role === "teacher" ? r.teacher_id === u.id : r.student_id === u.id))
          .filter((r) => !f.status || r.status === f.status)
          .map((r) => Object.assign({}, r, { student_name: prof(r.student_id).full_name, teacher_name: prof(r.teacher_id).full_name,
            next_class_number: (() => { const s = stu(r.student_id); let n = s.start_class_number + s.classes_completed;
              while (db.classes.some((c) => c.student_id === s.id && c.class_number === n && ["scheduled", "completed"].includes(c.status))) n++; return n; })(),
            competing: db.requests.filter((x) => x.id !== r.id && x.status === "pending" && x.teacher_id === r.teacher_id && x.starts_at === r.starts_at).length,
            conflict: r.status === "pending" && (busyAt(db.classes.filter((c) => c.teacher_id === r.teacher_id), new Date(r.starts_at)) || busyAt(db.classes.filter((c) => c.student_id === r.student_id), new Date(r.starts_at))),
            payment_blocked: credits(r.student_id).payment_blocked }))
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      },
      async createRequest(o) {
        need("student"); const u = me(), s = stu(u.id), start = new Date(o.starts_at), iso = start.toISOString();
        if (!s.teacher_id) throw new Error("Aún no tienes teacher asignado: el admin debe asignarlo antes de solicitar clases");
        if (!M.isValidSlot(start)) throw new Error("Fuera del horario de clases (L-V 6:00-18:00, sáb 10:00-16:00, hora Bogotá, bloques de 60 min)");
        if (start - Date.now() < set("min_request_hours") * 3600e3) throw new Error(`Las solicitudes se hacen con al menos ${set("min_request_hours")} horas de anticipación`);
        checkAvail(s.teacher_id, start, "Tu teacher");
        if (busyAt(db.classes.filter((c) => c.teacher_id === s.teacher_id), start)) throw new Error("Ese bloque ya está ocupado en el calendario de tu teacher");
        if (busyAt(db.classes.filter((c) => c.student_id === u.id), start)) throw new Error("Ya tienes una clase en ese bloque");
        if (db.requests.some((r) => r.student_id === u.id && r.status === "pending" && r.starts_at === iso)) throw new Error("Ya enviaste una solicitud para ese bloque");
        if (credits(u.id).available_to_request < 1) noCredit(u.id, "solicitar clases");
        const r = { id: "r-" + Date.now(), student_id: u.id, teacher_id: s.teacher_id, starts_at: iso, status: "pending", student_note: o.note || null, created_at: today() };
        db.requests.push(r); save(); return r;
      },
      async approveRequest(id, note) {
        const u = me(), r = db.requests.find((x) => x.id === id);
        if (!r || u.role !== "admin") throw new Error("Solo un admin puede aprobar solicitudes de clase");
        if (r.status !== "pending") throw new Error(`La solicitud ya no está pendiente (estado: ${r.status})`);
        const start = new Date(r.starts_at);
        if (start <= new Date()) throw new Error("La solicitud venció: el horario ya pasó");
        // se vuelve a verificar todo al aprobar
        if (busyAt(db.classes.filter((c) => c.teacher_id === r.teacher_id), start)) throw new Error("Conflicto: el teacher ya tiene una clase en ese bloque. Rechaza la solicitud o pide otro horario");
        if (busyAt(db.classes.filter((c) => c.student_id === r.student_id), start)) throw new Error("Conflicto: el estudiante ya tiene una clase en ese bloque");
        const cr = credits(r.student_id); if (cr.usable_remaining - cr.reserved < 1) noCredit(r.student_id, "agendar la clase");
        const s = stu(r.student_id); let n = s.start_class_number + s.classes_completed;
        while (db.classes.some((c) => c.student_id === s.id && c.class_number === n && ["scheduled", "completed"].includes(c.status))) n++;
        const c = { id: "c-" + Date.now(), student_id: r.student_id, teacher_id: r.teacher_id, starts_at: r.starts_at, class_number: n, class_type: M.classInfo(n).type,
          status: "scheduled", meet_url: null, request_id: r.id, late_penalty: "none" };
        db.classes.push(c);
        Object.assign(r, { status: "approved", class_id: c.id, decided_by: u.id, decided_at: today(), decision_note: note || null });
        db.requests.filter((x) => x.status === "pending" && x.teacher_id === r.teacher_id && x.starts_at === r.starts_at)
          .forEach((x) => Object.assign(x, { status: "rejected", decided_by: u.id, decided_at: today(), decision_note: "Ese bloque se asignó a otra solicitud. Elige otro horario, por favor." }));
        save(); return c.id;
      },
      async rejectRequest(id, note) {
        const u = me(), r = db.requests.find((x) => x.id === id);
        if (!r || u.role !== "admin") throw new Error("Solo un admin puede rechazar solicitudes de clase");
        if (r.status !== "pending") throw new Error(`La solicitud ya no está pendiente (estado: ${r.status})`);
        Object.assign(r, { status: "rejected", decided_by: u.id, decided_at: today(), decision_note: note || null }); save();
      },
      async cancelRequest(id) {
        const u = me(), r = db.requests.find((x) => x.id === id);
        if (!r || !(r.student_id === u.id || u.role === "admin")) throw new Error("Solicitud no encontrada");
        if (r.status !== "pending") throw new Error("Solo se puede retirar una solicitud pendiente");
        r.status = "cancelled"; save();
      },
      async cancelClass(id, reason, charge = true) {
        const u = me(), c = db.classes.find((x) => x.id === id);
        if (!c || !(u.role === "admin" || c.teacher_id === u.id || c.student_id === u.id)) throw new Error("Clase no encontrada");
        if (c.status !== "scheduled") throw new Error("Solo se puede cancelar una clase agendada");
        if (u.role === "student") charge = true;
        c.status = "cancelled"; c.cancel_reason = reason || null; c.cancelled_at = today();
        const late = new Date(c.starts_at) - Date.now() < set("late_cancel_hours") * 3600e3;
        if (charge && late) penalize(c); else { c.late_penalty = "none"; }
        save(); return c.late_penalty;
      },
      async listProgress(sid) { const ok = visibleStudents().map((s) => s.id); return db.progress.filter((p) => ok.includes(p.student_id) && (!sid || p.student_id === sid)); },
      async saveProgress(r) {
        need("admin", "teacher"); if (!visibleStudents().some((s) => s.id === r.student_id)) throw new Error("Permiso denegado");
        db.progress = db.progress.filter((p) => !(p.student_id === r.student_id && p.month === r.month)); db.progress.push(r); save();
      },
      async assignTeacher(sid, tid) { need("admin"); stu(sid).teacher_id = tid || null; save(); },
      async addStudentPackage(o) {
        need("admin"); const pk = db.packages.find((p) => p.code === o.package_code);
        if (!pk || !pk.active) throw new Error("El paquete está desactivado; usa uno del catálogo v3");
        db.student_packages.push({ id: "sp-" + Date.now(), student_id: o.student_id, package_code: pk.code, classes_total: pk.classes, classes_used: 0, amount_cop: pk.price_cop,
          personal_total: pk.personal_classes, group_total: pk.group_classes,
          purchase_date: o.purchase_date, expiry_date: o.expiry_date || M.packageExpiry(o.purchase_date, pk), payment_status: o.payment_status, next_billing_date: null }); save();
      },
      async setPaymentStatus(pid, st) { need("admin"); db.student_packages.find((p) => p.id === pid).payment_status = st; save();
      },
      async setTeacherMeet(tid, url) { if (!(role() === "admin" || me().id === tid)) throw new Error("Permiso denegado"); teach(tid).meet_url = url; save(); },
      async listBooks() {
        const r = role(), s = r === "student" ? stu(me().id) : null;
        return db.books.filter((b) => (r !== "student" || !b.teacher_only) && (!s || b.program === s.program || b.program === "ambos"));
      }
    };
    function levelOf(s) {
      const n = Math.min(160, s.start_class_number + s.classes_completed), i = M.classInfo(n, s.program);
      return { current_level: i.level, level_name: i.levelName, current_sublevel: i.sub };
    }
  }

  /* ======================= SUPABASE ======================= */
  function sbApi() {
    let sb = null, meCache = null;
    const client = async () => {
      if (sb) return sb;
      if (!window.supabase) await new Promise((ok, ko) => { const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"; s.onload = ok; s.onerror = () => ko(new Error("No se pudo cargar supabase-js")); document.head.appendChild(s); });
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, flowType: "implicit" } });
      return sb;
    };
    const q = async (p) => { const { data, error } = await p; if (error) throw new Error(error.message); return data; };
    return {
      mode: "supabase",
      async currentUser() {
        if (meCache) return meCache;
        const c = await client(); const { data } = await c.auth.getUser(); if (!data.user) return null;
        meCache = await q(c.from("profiles").select("id, role, full_name, email, program").eq("id", data.user.id).single());
        return meCache;
      },
      async signIn(email, password) { const c = await client(); const { error } = await c.auth.signInWithPassword({ email, password }); if (error) throw new Error(error.message); meCache = null; return this.currentUser(); },
      /* Enlaces de Supabase (invitación, recuperación, magic link): #access_token=… (implícito) o ?code=… (PKCE).
         supabase-js lee el hash al iniciar (detectSessionInUrl); aquí se espera a que termine y se canjea ?code si llega. */
      async sessionFromUrl(params) {
        const c = await client();
        if (params.get("code")) { const { error } = await c.auth.exchangeCodeForSession(params.get("code")); if (error) throw new Error(error.message); }
        const { data, error } = await c.auth.getSession(); if (error) throw new Error(error.message);
        meCache = null; return data.session;
      },
      async updatePassword(password) { const c = await client(); const { error } = await c.auth.updateUser({ password }); if (error) throw new Error(error.message); meCache = null; },
      async resetPassword(email, redirectTo) { const c = await client(); const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo }); if (error) throw new Error(error.message); },
      async listKidsMaterials() { const c = await client(); const rows = await q(c.from("kids_materials").select("*").order("created_at", { ascending: false }));
        return rows.map((r) => Object.assign(r, { url: c.storage.from("kids-material").getPublicUrl(r.file_path).data.publicUrl })); },
      async uploadKidsMaterial(file, title, description) { M.checkKidsFile(file); const c = await client(); const path = M.kidsPath(file);
        const up = await c.storage.from("kids-material").upload(path, file, { contentType: file.type, upsert: false }); if (up.error) throw new Error(up.error.message);
        const { data, error } = await c.from("kids_materials").insert({ title, description: description || null, file_path: path, mime_type: file.type, size_bytes: file.size }).select().single();
        if (error) { await c.storage.from("kids-material").remove([path]); throw new Error(error.message); } return data; },
      async deleteKidsMaterial(id) { const c = await client(); const r = await q(c.from("kids_materials").select("file_path").eq("id", id).single());
        await q(c.from("kids_materials").delete().eq("id", id)); await c.storage.from("kids-material").remove([r.file_path]); },
      async demoLogin() { throw new Error("Supabase configurado: el acceso demo está desactivado."); },
      async signOut() { const c = await client(); await c.auth.signOut(); meCache = null; },
      async listClasses(f = {}) {
        const c = await client(); let r = c.from("my_classes").select("*").order("starts_at");
        if (f.from) r = r.gte("starts_at", f.from); if (f.to) r = r.lt("starts_at", f.to); if (f.studentId) r = r.eq("student_id", f.studentId);
        return q(r);
      },
      async listStudents() {
        const c = await client();
        const [st, rem, pr] = await Promise.all([q(c.from("students").select("*")), q(c.from("student_remaining_classes").select("*")), q(c.from("student_progress").select("*"))]);
        const ids = [...new Set(st.map((s) => s.teacher_id).filter(Boolean))];
        const tp = ids.length ? await q(c.from("profiles").select("id, full_name").in("id", ids)) : [];
        return st.map((s) => { const p = pr.find((x) => x.student_id === s.id) || {};
          return Object.assign({}, s, { full_name: p.full_name, level_name: p.level_name, teacher_name: (tp.find((t) => t.id === s.teacher_id) || {}).full_name, remaining: rem.find((x) => x.student_id === s.id) }); });
      },
      async listTeachers() {
        const c = await client(); const ts = await q(c.from("teachers").select("id, meet_url, teacher_availability(weekday,start_hour,end_hour)"));
        const ps = ts.length ? await q(c.from("profiles").select("id, full_name").in("id", ts.map((t) => t.id))) : [];
        return ts.map((t) => Object.assign(t, { full_name: (ps.find((p) => p.id === t.id) || {}).full_name, availability: (t.teacher_availability || []).map((a) => [a.weekday, a.start_hour, a.end_hour]) }));
      },
      async listPackages() { const c = await client(); return q(c.from("packages").select("*").eq("active", true).order("sort_order")); },
      /* v3 perfil: tablas PROPUESTAS en supabase/proposed/ (no aplicadas). Mientras no existan, la consulta falla y la vista muestra estado vacío. */
      async listTeacherReviews(tid) { const u = await this.currentUser(); if (!u || !(u.role === "admin" || (u.role === "teacher" && u.id === tid))) return []; const c = await client(); return q(c.from("teacher_reviews").select("rating, comment, author_name, created_at").eq("teacher_id", tid).eq("published", true).order("created_at", { ascending: false }).limit(500)); },
      async listTeacherCertifications(tid) { const c = await client(); return q(c.from("teacher_certifications").select("title, issuer, year, kind").eq("teacher_id", tid).order("sort_order")); },
      /* v3 perfil: niveles A1–C1 calculados de los estudiantes reales del teacher (solo staff; un estudiante solo vería su propia fila). */
      async teacherLevelCounts(tid) { try { const c = await client(); return await q(c.rpc("teacher_level_counts", { p_teacher: tid })); } catch (e) { /* función propuesta aún no aplicada */ }
        const u = await this.currentUser(); if (!u || (u.role !== "admin" && !(u.role === "teacher" && u.id === tid))) return [];
        const m = {}; (await this.listStudents()).filter((s) => s.teacher_id === tid && s.active !== false).forEach((s) => { const n = Math.min(160, Math.max(1, (s.start_class_number || 1) - 1 + (s.classes_completed || 0))); const l = M.classInfo(n, s.program).levelCode; m[l] = (m[l] || 0) + 1; });
        return Object.keys(m).map((level) => ({ level, count: m[level] })); },
      /* Sobre mí: bio/hobbies/topics ya existen en teacher_public_profiles (RLS tpp_self_upd: solo su fila).
         favorite_* son columnas PROPUESTAS: si aún no existen se informa con claridad qué no se guardó. */
      async saveTeacherPersonal(tid, o) { const u = await this.currentUser(); if (!u || !(u.role === "teacher" && u.id === tid)) throw new Error("Solo el teacher puede editar su propio perfil.");
        const c = await client(), base = { bio: o.bio, hobbies: o.hobbies, topics: o.topics }, extra = {};
        ["favorite_foods", "favorite_countries", "favorite_books", "favorite_movies"].forEach((k) => { if (k in o) extra[k] = o[k]; });
        const r = await q(c.from("teacher_public_profiles").update(base).eq("teacher_id", tid).select("teacher_id"));
        if (!r.length) throw new Error("Tu perfil público aún no existe: créalo primero en «Mi perfil» del CRM.");
        const res = { saved: Object.keys(base), pending: [] };
        const hasExtra = Object.values(extra).some((v) => v && v.length);
        if (Object.keys(extra).length) { const { error } = await c.from("teacher_public_profiles").update(extra).eq("teacher_id", tid);
          if (error) { if (/column|schema cache|PGRST204|42703/i.test(`${error.code} ${error.message}`)) { if (hasExtra) res.pending = Object.keys(extra); } else throw new Error(error.message); }
          else res.saved.push(...Object.keys(extra)); }
        return res; },
      async getTeacherProfile(tid) { const c = await client(); const r = await q(c.from("teacher_public_profiles").select("*").eq("teacher_id", tid)); return r[0] || null; },
      async saveTeacherProfile(tid, o) { const c = await client(); await q(c.from("teacher_public_profiles").upsert(Object.assign({}, o, { teacher_id: tid }), { onConflict: "teacher_id" })); },
      async saveStudentProfile(sid, o) { const c = await client(); await q(c.from("student_profiles").upsert(Object.assign({}, o, { student_id: sid }), { onConflict: "student_id" })); },
      async getStudentProfile(sid) { const c = await client(); const r = await q(c.from("student_profiles").select("*").eq("student_id", sid)); return r[0] || null; },
      async getInternalNote(sid) { const c = await client(); const r = await q(c.from("student_internal_notes").select("notes, interests, learning_style, updated_at").eq("student_id", sid)); return r[0] || null; },
      async listTeacherProfiles() { const c = await client(); return q(c.from("teacher_public_profiles").select("*").order("display_name")); },
      async listStudentPackages(sid) { const c = await client(); let r = c.from("student_package_balance").select("*").order("purchase_date"); if (sid) r = r.eq("student_id", sid); return q(r); },
      async createClass(o) {
        const c = await client(); const n = o.class_number ? +o.class_number : null; const me = await this.currentUser();
        return q(c.from("classes").insert({ student_id: o.student_id, teacher_id: o.teacher_id, starts_at: new Date(o.starts_at).toISOString(), class_number: n,
          class_type: n ? M.classInfo(n).type : "extra_reinforcement", meet_url: o.meet_url || null, created_by: me.id }).select().single());
      },
      async setClassStatus(id, status) { if (status === "cancelled") return this.cancelClass(id, null, true); const c = await client(); const d = await q(c.from("classes").update({ status }).eq("id", id).select("id")); if (!d.length) throw new Error("Permiso denegado"); },
      async markAttendance(id, st) { const c = await client(); const me = await this.currentUser(); await q(c.from("attendance").upsert({ class_id: id, status: st, marked_by: me.id })); },
      async saveFeedback(id, note, sentences) { const c = await client(); const me = await this.currentUser(); await q(c.from("class_feedback").upsert({ class_id: id, teacher_note: note, sentences, created_by: me.id })); },
      async getAssessment(id) {
        const c = await client(); const r = await q(c.from("teacher_assessments").select("*").eq("class_id", id));
        if (!r[0]) return null; const a = r[0];
        return Object.assign({}, a, { scores: { fluency: a.score_fluency, vocabulary: a.score_vocabulary, grammar: a.score_grammar, pronunciation: a.score_pronunciation,
          comprehension_interaction: a.score_comprehension_interaction, task_completion: a.score_task_completion } });
      },
      async getRubric() { // tablas con RLS: solo teacher/admin
        const c = await client();
        const [scale, crit, rules, guide, cond, focus, phrases] = await Promise.all(["rubric_scale", "rubric_criteria", "rubric_decision_rules", "rubric_level_guide",
          "rubric_level_conditions", "rubric_sublevel_focus", "rubric_phrases"].map((t) => q(c.from(t).select("*"))));
        const levels = {}; cond.forEach((x) => (levels[x.level_index] = { conditions: x.conditions, guide: {} }));
        guide.forEach((g) => (levels[g.level_index].guide[g.criterion_code] = g.logrado));
        const fo = {}; focus.forEach((f) => (fo[f.class_number] = [f.sublevel_name, f.lab_name, f.focus]));
        return { scale: scale.sort((a, b) => b.score - a.score).map((x) => [String(x.score), x.label, x.meaning]),
          criteria: crit.sort((a, b) => a.position - b.position).map((x) => [x.code, x.name, x.desc_4, x.desc_3, x.desc_2, x.desc_1]),
          rules: rules.sort((a, b) => a.position - b.position).map((x) => [x.label, x.condition, x.action]), levels, focus: fo,
          phrases: phrases.map((x) => [x.say, x.avoid]), decide: null }; // el resultado oficial lo calcula la base (rubric_decision)
      },
      async saveAssessment(id, a) {
        const c = await client(); const cl = await q(c.from("classes").select("student_id, teacher_id, class_type").eq("id", id).single()); const s = a.scores;
        const row = { class_id: id, student_id: cl.student_id, teacher_id: cl.teacher_id, assessment_kind: cl.class_type === "extra_reinforcement" ? "mini_conversation_lab" : "conversation_lab",
          score_fluency: s.fluency, score_vocabulary: s.vocabulary, score_grammar: s.grammar, score_pronunciation: s.pronunciation,
          score_comprehension_interaction: s.comprehension_interaction, score_task_completion: s.task_completion, result: "repite",
          evidence: a.evidence || {}, recurring_errors: a.recurring_errors || null, reinforcement_plan: a.reinforcement_plan || null, internal_comment: a.internal_comment || null,
          proposed_result: a.proposed_result || null, proposal_justification: a.proposal_justification || null };
        if (a.proposal_status) row.proposal_status = a.proposal_status;
        await q(c.from("teacher_assessments").upsert(row));
        return this.getAssessment(id); // el resultado lo calcula la base de datos
      },
      async bookingStatus(sid) { const c = await client(); const me = await this.currentUser(); const r = await q(c.from("student_booking_status").select("*").eq("student_id", sid || me.id));
        const st = await this.settings(); return Object.assign({}, r[0], { free_passes_per_period: st.free_passes_per_period, pass_period_months: st.pass_period_months, late_cancel_hours: st.late_cancel_hours, min_request_hours: st.min_request_hours }); },
      async settings() { const c = await client(); const r = await q(c.from("app_settings").select("*")); const o = {}; r.forEach((x) => (o[x.key] = x.value_int)); return o; },
      async setSetting(k, v) { const c = await client(); await q(c.from("app_settings").update({ value_int: +v }).eq("key", k)); },
      async teacherCalendar(tid, from, to) {
        const c = await client();
        const [av, busy] = await Promise.all([q(c.from("teacher_availability").select("weekday,start_hour,end_hour").eq("teacher_id", tid)),
          q(c.rpc("teacher_busy_slots", { p_teacher: tid, p_from: from, p_to: to }))]);
        return { availability: av.map((a) => [a.weekday, a.start_hour, a.end_hour]), busy: busy.map((b) => new Date(b.starts_at).toISOString()) };
      },
      async listRequests(f = {}) {
        const c = await client(); let r = c.from("class_requests").select("*").order("starts_at"); if (f.status) r = r.eq("status", f.status);
        const rows = await q(r); const ids = [...new Set(rows.flatMap((x) => [x.student_id, x.teacher_id]))];
        const ps = ids.length ? await q(c.from("profiles").select("id, full_name").in("id", ids)) : [];
        const nm = (id) => (ps.find((p) => p.id === id) || {}).full_name;
        return rows.map((x) => Object.assign(x, { student_name: nm(x.student_id), teacher_name: nm(x.teacher_id),
          competing: rows.filter((y) => y.id !== x.id && y.status === "pending" && y.teacher_id === x.teacher_id && y.starts_at === x.starts_at).length }));
      },
      async createRequest(o) { const c = await client(); const me = await this.currentUser();
        return q(c.from("class_requests").insert({ student_id: me.id, starts_at: new Date(o.starts_at).toISOString(), student_note: o.note || null }).select().single()); },
      async approveRequest(id, note) { const c = await client(); return q(c.rpc("approve_class_request", { p_request: id, p_note: note || null })); },
      async rejectRequest(id, note) { const c = await client(); return q(c.rpc("reject_class_request", { p_request: id, p_note: note || null })); },
      async cancelRequest(id) { const c = await client(); return q(c.rpc("cancel_class_request", { p_request: id })); },
      async cancelClass(id, reason, charge = true) { const c = await client(); return q(c.rpc("cancel_class", { p_class: id, p_reason: reason || null, p_charge_student: charge })); },
      async setPaymentStatus(pid, st) { const c = await client(); await q(c.from("student_packages").update({ payment_status: st }).eq("id", pid)); },
      async listProgress(sid) { const c = await client(); let r = c.from("monthly_progress").select("*").order("month", { ascending: false }); if (sid) r = r.eq("student_id", sid); return q(r); },
      async saveProgress(r) { const c = await client(); const me = await this.currentUser(); await q(c.from("monthly_progress").upsert(Object.assign({ teacher_id: me.role === "teacher" ? me.id : null }, r), { onConflict: "student_id,month" })); },
      async assignTeacher(sid, tid) { const c = await client(); await q(c.from("students").update({ teacher_id: tid || null }).eq("id", sid)); },
      async addStudentPackage(o) {
        const c = await client(); const pk = await q(c.from("packages").select("*").eq("code", o.package_code).single());
        if (!pk.active) throw new Error("El paquete está desactivado; usa uno del catálogo v3");
        await q(c.from("student_packages").insert({ student_id: o.student_id, package_code: pk.code, classes_total: pk.classes, // amount_cop, desglose y vencimiento: los completa la base (trigger)
          purchase_date: o.purchase_date, expiry_date: o.expiry_date || null, payment_status: o.payment_status }));
      },
      async setTeacherMeet(tid, url) { const c = await client(); await q(c.from("teachers").update({ meet_url: url }).eq("id", tid)); },
      async listBooks() { const c = await client(); return q(c.from("books").select("*").order("level_index")); }
    };
  }
  M.api = useSb ? sbApi() : demoApi();
})();
