/* MEC CRM – Carga de datos (admin): CSV o formulario manual, con validador. Módulo puro (testeable en Node).
   No inventa datos: solo valida lo que el admin pega/sube. La carga real a producción queda pendiente (ver admin › Cargar datos). */
(function (root) {
  const DATE = /^\d{4}-\d{2}-\d{2}$/, EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
  const CODES = ["P1", "P2", "P3", "P4", "G1", "G2", "G3", "C1", "C2", "C3", "SP", "SG", "ESP-9"];  // ESP-9: paquete especial único (no público)
  const realDate = (v) => DATE.test(v) && !isNaN(Date.parse(v + "T12:00:00Z")) && new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v;
  const F = (key, label, o = {}) => Object.assign({ key, label }, o);
  const SCHEMAS = {
    teachers: { label: "Teachers", fields: [F("full_name", "Nombre completo", { req: true, max: 120 }), F("email", "Correo", { req: true, type: "email", unique: true }),
      F("meet_url", "Enlace Meet", { pattern: /^https:\/\/meet\.google\.com\/[a-z0-9-]+$/i, hint: "https://meet.google.com/…" })] },
    estudiantes: { label: "Estudiantes", fields: [F("full_name", "Nombre completo", { req: true, max: 120 }), F("email", "Correo", { req: true, type: "email", unique: true }),
      F("program", "Programa", { req: true, enum: ["adultos", "kids"] }), F("teacher_email", "Correo del teacher", { type: "email", ref: "teachers" }),
      F("start_date", "Fecha de inicio", { type: "date" }), F("start_class_number", "Clase inicial (1-160)", { type: "int", min: 1, max: 160 })] },
    clases: { label: "Clases", fields: [F("student_email", "Correo del estudiante", { req: true, type: "email", ref: "estudiantes" }), F("teacher_email", "Correo del teacher", { req: true, type: "email", ref: "teachers" }),
      F("starts_at", "Inicio (AAAA-MM-DD HH:00, Bogotá)", { req: true, type: "slot" }), F("class_number", "Nº de clase (vacío = refuerzo extra)", { type: "int", min: 1, max: 160 }),
      F("meet_url", "Enlace Meet", { pattern: /^https:\/\/meet\.google\.com\/[a-z0-9-]+$/i })] },
    paquetes: { label: "Paquetes de estudiantes", fields: [F("student_email", "Correo del estudiante", { req: true, type: "email", ref: "estudiantes" }),
      F("package_code", "Paquete", { req: true, enum: CODES }), F("paid_on", "Fecha de pago", { type: "date" }),
      F("payment_status", "Estado de pago", { req: true, enum: ["pending", "paid", "partial", "overdue", "refunded", "cancelled"] })] },
    cobros: { label: "Cuentas de cobro", fields: [F("number", "Número (CC-000001)", { req: true, pattern: /^CC-\d{6}$/, unique: true }), F("payer_name", "Pagador", { req: true, min: 3, max: 120 }),
      F("payer_email", "Correo del pagador", { type: "email" }), F("package_code", "Paquete", { enum: CODES }), F("amount_cop", "Monto COP", { req: true, type: "int", min: 1, max: 50000000 }),
      F("status", "Estado", { req: true, enum: ["draft", "sent", "partial", "paid", "void"] }), F("issued_date", "Fecha de emisión", { type: "date" }), F("notes", "Notas", { max: 1000 })] },
    pagos: { label: "Pagos", fields: [F("invoice_number", "Cuenta de cobro", { req: true, pattern: /^CC-\d{6}$/, ref: "cobros" }), F("amount_cop", "Monto COP", { req: true, type: "int", min: 1, max: 50000000 }),
      F("paid_on", "Fecha de pago", { req: true, type: "date" }), F("method", "Medio", { req: true, enum: ["transferencia", "nequi", "daviplata", "efectivo", "tarjeta", "otro"] }), F("reference", "Referencia", { max: 120 })] }
  };
  const REFKEY = { teachers: "email", estudiantes: "email", cobros: "number" };
  /* CSV: separador , o ; (detectado), comillas dobles, BOM, CRLF. Devuelve { header, rows } */
  function parseCSV(text) {
    const t = String(text || "").replace(/^\uFEFF/, ""), first = t.split(/\r?\n/)[0] || "";
    const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
    const out = []; let row = [], cur = "", q = false;
    for (let i = 0; i < t.length; i++) { const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true; else if (c === sep) { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cur); out.push(row); row = []; cur = ""; }
      else cur += c; }
    if (cur !== "" || row.length) { row.push(cur); out.push(row); }
    const rows = out.filter((r) => r.some((x) => String(x).trim() !== ""));
    const header = (rows.shift() || []).map((h) => h.trim().toLowerCase());
    return { header, rows: rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] == null ? "" : r[i]]))) };
  }
  const clean = (v) => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E]/g, " ").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  /* Valida filas. ctx = { teachers:[emails], estudiantes:[emails], cobros:[numbers] } ya existentes. Devuelve { rows, errors:[{row, field, msg}], ok } */
  function validate(entity, input, ctx = {}) {
    const S = SCHEMAS[entity]; if (!S) throw new Error("Tipo de carga desconocido: " + entity);
    const errors = [], seen = {}, rows = [];
    if (Array.isArray(input.header)) { const miss = S.fields.filter((f) => f.req && !input.header.includes(f.key)).map((f) => f.key);
      const extra = input.header.filter((h) => !S.fields.some((f) => f.key === h));
      if (miss.length) errors.push({ row: 0, field: miss.join(", "), msg: "Faltan columnas obligatorias" });
      if (extra.length) errors.push({ row: 0, field: extra.join(", "), msg: "Columnas desconocidas" }); }
    const list = input.rows || input;
    if (list.length > 2000) errors.push({ row: 0, field: "", msg: "Máximo 2000 filas por carga" });
    list.slice(0, 2000).forEach((raw, i) => { const n = i + 1, o = {};
      S.fields.forEach((f) => { let v = clean(raw[f.key]); const e = (msg) => errors.push({ row: n, field: f.key, msg });
        if (!v) { if (f.req) e("Obligatorio"); o[f.key] = null; return; }
        if (f.type === "email") { v = v.toLowerCase(); if (!EMAIL.test(v)) return e("Correo inválido"); }
        if (f.type === "int") { if (!/^\d+$/.test(v.replace(/\./g, ""))) return e("Debe ser un número entero"); v = +v.replace(/\./g, "");
          if (f.min != null && v < f.min || f.max != null && v > f.max) return e(`Fuera de rango (${f.min}–${f.max})`); }
        if (f.type === "date" && !realDate(v)) return e("Fecha inválida (AAAA-MM-DD)");
        if (f.type === "slot") { const m = v.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})$/); if (!m || !realDate(m[1]) || +m[2] > 23) return e("Fecha y hora inválidas (AAAA-MM-DD HH:00)");
          if (m[3] !== "00") return e("Las clases empiezan en punto (HH:00)"); v = `${m[1]}T${m[2]}:00:00-05:00`; }
        if (f.enum && !f.enum.includes(v)) { const hit = f.enum.find((x) => x.toLowerCase() === v.toLowerCase()); if (!hit) return e("Valor no permitido: use " + f.enum.join(", ")); v = hit; }
        if (f.pattern && !f.pattern.test(v)) return e("Formato inválido" + (f.hint ? ` (${f.hint})` : ""));
        if (typeof v === "string" && f.max && v.length > f.max) return e(`Máximo ${f.max} caracteres`);
        if (typeof v === "string" && f.min && v.length < f.min) return e(`Mínimo ${f.min} caracteres`);
        if (f.unique) { const k = String(v).toLowerCase(); if (seen[f.key + k]) return e(`Duplicado en el archivo (fila ${seen[f.key + k]})`); seen[f.key + k] = n;
          if ((ctx[entity] || []).map((x) => String(x).toLowerCase()).includes(k)) return e("Ya existe en el CRM"); }
        if (f.ref && ctx[f.ref] && !ctx[f.ref].map((x) => String(x).toLowerCase()).includes(String(v).toLowerCase())) return e(`No existe en ${SCHEMAS[f.ref].label}`);
        o[f.key] = v; });
      if (entity === "cobros" && o.status === "draft" && raw.sent_at) errors.push({ row: n, field: "status", msg: "Un borrador no puede tener fecha de envío" });
      if (entity === "clases" && o.class_number == null && raw.class_number && String(raw.class_number).trim()) { /* ya reportado */ }
      rows.push(o); });
    return { rows, errors, ok: errors.length === 0 && rows.length > 0 };
  }
  const template = (entity) => SCHEMAS[entity].fields.map((f) => f.key).join(",") + "\n";
  const api = { SCHEMAS, CODES, REFKEY, parseCSV, validate, template, clean };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root.MEC) root.MEC.importar = api;
})(typeof window !== "undefined" ? window : globalThis);
