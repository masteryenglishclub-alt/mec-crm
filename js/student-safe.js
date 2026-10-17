/* MEC CRM – normalización del portal Estudiante para estudiantes sin paquete y/o sin nivel (evita "Cargando…" eterno). */
(function (root) {
  const SIN_PAQ = "Aún no tienes un paquete activo";
  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : (v != null && v !== "" && isFinite(+v) ? +v : d));
  function student(s) {
    s = Object.assign({}, s || {});
    s.program = s.program === "kids" ? "kids" : "adultos";
    s.start_class_number = Math.min(160, Math.max(1, num(s.start_class_number, 1)));
    s.classes_completed = Math.max(0, num(s.classes_completed, 0));
    s.full_name = s.full_name || "";
    const done = Math.min(160, s.start_class_number - 1 + s.classes_completed);
    const r = s.remaining || null;
    s.hasPackage = !!(r && num(r.classes_purchased, 0) > 0);
    s.remaining = Object.assign({ classes_purchased: 0, classes_used: 0, classes_remaining: 0 }, r || {});
    s.remaining.classes_remaining = num(s.remaining.classes_remaining, 0);
    s.remaining.next_class_number = num(s.remaining.next_class_number, Math.min(160, done + 1));
    s.hasLevel = num(s.current_level, 0) >= 1 && num(s.current_level, 0) <= 5;
    if (!s.hasLevel) s.current_level = Math.min(5, Math.floor(Math.min(159, done) / 32) + 1);
    s.done = done;
    return s;
  }
  function booking(b) {
    b = Object.assign({}, b || {});
    const d = { usable_remaining: 0, reserved: 0, pending_requests: 0, available_to_request: 0, passes_total: 0, passes_used: 0, passes_remaining: 0, late_cancel_hours: 24, min_request_hours: 24 };
    Object.keys(d).forEach((k) => (b[k] = num(b[k], d[k])));
    b.payment_blocked = !!b.payment_blocked;
    return b;
  }
  const counter = (done) => { done = Math.max(0, num(done, 0)); return done % 32 || (done ? 32 : 0); };
  const pkgKpi = (s, esc) => s.hasPackage ? `<b>${s.remaining.classes_remaining}</b><span>Clases disponibles en tu paquete</span>`
    : `<b style="font-size:1.05rem">${SIN_PAQ}</b><span><a href="precios.html">Ver paquetes y precios</a></span>`;
  const api = { student, booking, counter, pkgKpi, SIN_PAQ };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root.MEC) root.MEC.stSafe = api;
})(typeof window !== "undefined" ? window : globalThis);
