/* MEC · Formulario PÚBLICO del evento de referidos (la persona referida, sin cuenta). Sin dependencias.
   Textos: js/promo-legal.js (generado de texto_aceptacion_y_avisos.md §3 y §8, sin ediciones). Reglas: las mismas de la propuesta SQL 20261023_aceptacion_promo
   (promo_publico_registrar / confirmar / reenviar, promo_derechos_solicitar). Dos modos:
     · DEMO (vista previa local, sin Supabase): todo se guarda SOLO en este navegador (localStorage); la «bandeja» de mensajes es simulada y no se envía nada.
     · REAL (con MEC_CRM_CONFIG.SUPABASE_URL): llama a la Edge Function «promo-publico» (captcha, límites, y desde allí las funciones SQL). El navegador nunca toca las tablas. */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY = "mec_crm_demo_promo_publico_v1", T = "terminos_y_condiciones_referidos.md", A = "texto_aceptacion_y_avisos.md", ID = "plan-de-referidos";
  const cfg = () => window.MEC_CRM_CONFIG || {}, L = () => window.MEC_PROMO_LEGAL;
  const isReal = () => !!(cfg().SUPABASE_URL && cfg().SUPABASE_ANON_KEY);
  const P = { now: () => Date.now(), CODIGO_MIN: 30, RETENCION_DIAS: 7, LIMITE_CONTACTO_DIA: 3, LIMITE_HORA: 60 };
  /* ---------- utilidades (iguales a las de SQL) ---------- */
  function norm(canal, c) {
    let t = String(c == null ? "" : c).trim();
    if (canal === "correo") { t = t.toLowerCase(); return t.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) ? t : null; }
    if (canal === "whatsapp") { let d = t.replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); if (d.length === 10 && d[0] === "3") d = "57" + d; return d.length >= 11 && d.length <= 15 ? d : null; }
    return null;
  }
  function bogota(ts) {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ts)), g = (t) => f.find((x) => x.type === t).value;
    return { fecha: `${g("year")}-${g("month")}-${g("day")}`, hora: `${g("hour")}:${g("minute")}`, zona: "America/Bogota" };
  }
  function diasHabiles(desde, n) { const b = bogota(desde).fecha.split("-").map(Number); let d = new Date(Date.UTC(b[0], b[1] - 1, b[2])), k = 0; while (k < n) { d = new Date(d.getTime() + 864e5); const w = d.getUTCDay(); if (w !== 0 && w !== 6) k++; } return d.toISOString().slice(0, 10); }
  const bad = (c, m) => { throw new Error(c + ": " + m); };
  const stripCode = (m) => String(m || "").replace(/^[a-z_]+:\s*/, "");
  const rnd = (n) => { let s = ""; const a = (window.crypto && window.crypto.getRandomValues) ? window.crypto.getRandomValues(new Uint8Array(n)) : Array.from({ length: n }, () => Math.floor(Math.random() * 256)); a.forEach((x) => (s += (x % 16).toString(16))); return s; };
  const codigo = () => String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
  /* ---------- «servidor» DEMO (espejo de las funciones SQL; solo en este navegador) ---------- */
  const mem = { v: null };
  const db = () => { if (mem.v) return mem.v; try { mem.v = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {} return (mem.v = mem.v || { pend: [], datos: [], pruebas: [], bajas: [], revocaciones: [], solic: [], outbox: [], bit: [] }); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem.v)); } catch (e) {} };
  const reset = () => { mem.v = null; try { localStorage.removeItem(KEY); } catch (e) {} };
  const cur = () => { const l = L(); if (!l) bad("promo_inactiva", "el registro de participación aún no está abierto");
    if (!(cfg().PREVIEW === true)) bad("promo_inactiva", "el registro de participación aún no está abierto");
    return { version: l.version, avisos_version: l.avisos_version, legal_sha256: l.sources[T], avisos_sha256: l.sources[A] }; };
  const msgVerif = (cod, tok) => `Mastery English Club: tu código de confirmación es ${cod}. También puedes confirmar aquí: ${(cfg().SITE_URL || "https://masteryenglishclub-alt.github.io/mec-crm/")}eventos.html?v=${tok}#terminos-plan-de-referidos. Vence en ${P.CODIGO_MIN} minutos. Si no fuiste tú, ignora este mensaje y no pasará nada.`;
  function purgar() { const d = db(), lim = P.now() - P.RETENCION_DIAS * 864e5, ids = d.pend.filter((x) => x.created_at < lim).map((x) => x.id);
    d.outbox = d.outbox.filter((o) => !(ids.includes(o.pendiente_id) && !o.aceptacion_id)); d.pend = d.pend.filter((x) => !ids.includes(x.id)); d.bit.push({ at: P.now(), accion: "purga_no_confirmados", n: ids.length }); save(); return { pendientes_borradas: ids.length }; }
  const demo = {
    registrar(p) {
      const c = cur(), d = db(), t = (x) => String(x == null ? "" : x).trim();
      if (p.edad === "menor") bad("menor_no_continua", "este formulario es solo para mayores de edad y para padres, madres o representantes legales");
      if (p.edad !== "adulto" && p.edad !== "acudiente") bad("edad_no_valida", "responde primero si eres mayor de edad o acudiente");
      if (p.version !== c.version || p.avisos_version !== c.avisos_version || p.legal_sha256 !== c.legal_sha256 || p.avisos_sha256 !== c.avisos_sha256) bad("version_desactualizada", "el texto cambió; recarga la página y vuelve a leerlo");
      if (p.terminos !== true) bad("falta_terminos", "marca la casilla (a) de términos y condiciones");
      if (p.datos !== true) bad("falta_datos", "marca la casilla (b) de autorización de datos");
      if (p.transferencia !== true) bad("falta_transferencia", "marca la casilla (c) de servidores en Estados Unidos o contáctanos por otro canal");
      if (p.edad === "acudiente" && p.acudiente !== true) bad("falta_acudiente", "marca la declaración del padre, madre o representante legal");
      if (p.edad === "adulto" && p.acudiente === true) bad("datos_sobran", "datos de más");
      const nom = t(p.nombre), ref = t(p.referidor), men = t(p.menor_nombre) || null, ctl = /[\u0000-\u001f\u007f@]/;
      if (nom.length < 2 || nom.length > 120 || ctl.test(nom) || /\d{6,}/.test(nom)) bad("dato_no_valido", "escribe solo tu nombre");
      if (!ref || ref.length > 120 || ctl.test(ref) || /\d{8,}/.test(ref)) bad("referidor_dato_ajeno", "escribe solo el nombre o código de quien te recomendó (sin teléfonos, correos ni documentos)");
      if (p.edad === "acudiente") { if (!men || men.length > 120 || ctl.test(men) || /\d{6,}/.test(men)) bad("falta_menor", "escribe solo el nombre del menor"); } else if (men) bad("datos_sobran", "datos de más");
      const n = norm(p.canal, p.contacto); if (!n) bad("contacto_no_valido", "escribe un solo medio de contacto válido (WhatsApp o correo)");
      const h = p.canal + ":" + n, ahora = P.now();
      if (d.pend.filter((x) => x.contacto_hash === h && x.created_at > ahora - 864e5).length + d.pruebas.filter((x) => x.contacto_hash === h && x.aceptado_at > ahora - 864e5).length >= P.LIMITE_CONTACTO_DIA) return { ok: true };
      if (d.pend.filter((x) => x.created_at > ahora - 36e5).length + d.pruebas.filter((x) => x.aceptado_at > ahora - 36e5).length >= P.LIMITE_HORA) bad("limite", "hay muchas solicitudes en este momento; intenta más tarde");
      const cod = codigo(), tok = rnd(64), id = "pp-" + rnd(8);
      d.pend.push({ id, created_at: ahora, edad: p.edad, nombre: nom, canal: p.canal, contacto: n, contacto_hash: h, referidor_texto: ref, menor_nombre: men, version: c.version, avisos_version: c.avisos_version, legal_sha256: c.legal_sha256, avisos_sha256: c.avisos_sha256,
        acepta_promociones: p.promociones === true, acepta_acudiente: p.edad === "acudiente", codigo: cod, token: tok, expira_at: ahora + P.CODIGO_MIN * 6e4, intentos: 0, envios: 1, ultimo_envio_at: ahora });
      d.outbox.push({ id: "ob-" + rnd(8), created_at: ahora, kind: "verificacion", canal: p.canal, destino: n, contacto_hash: h, cuerpo: msgVerif(cod, tok), estado: "simulado", pendiente_id: id });
      save(); return { ok: true };
    },
    reenviar(p) { cur(); const d = db(), n = norm(p.canal, p.contacto); if (!n) return { ok: true }; const h = p.canal + ":" + n, ahora = P.now();
      const r = d.pend.filter((x) => x.contacto_hash === h).sort((a, b) => b.created_at - a.created_at)[0];
      if (r && r.envios < 3 && r.ultimo_envio_at < ahora - 6e4 && r.created_at > ahora - P.RETENCION_DIAS * 864e5) { r.codigo = codigo(); r.token = rnd(64); r.expira_at = ahora + P.CODIGO_MIN * 6e4; r.envios++; r.ultimo_envio_at = ahora; r.intentos = 0;
        d.outbox.push({ id: "ob-" + rnd(8), created_at: ahora, kind: "verificacion", canal: p.canal, destino: n, contacto_hash: h, cuerpo: msgVerif(r.codigo, r.token), estado: "simulado", pendiente_id: r.id }); save(); }
      return { ok: true }; },
    confirmar(p) {
      const c = cur(), d = db(), NO = { ok: false, error: "codigo_invalido" }, ahora = P.now(); let r = null;
      if (p.token && /^[0-9a-f]{32,128}$/.test(p.token)) r = d.pend.find((x) => x.token === p.token) || null;
      else { const n = norm(p.canal, p.contacto); if (n && /^\d{6}$/.test(String(p.codigo || ""))) { const h = p.canal + ":" + n; r = d.pend.filter((x) => x.contacto_hash === h).sort((a, b) => b.created_at - a.created_at)[0] || null;
        if (r) { if (r.intentos >= 5) return NO; if (r.codigo !== String(p.codigo)) { r.intentos++; save(); return NO; } } } }
      if (!r || r.expira_at < ahora) return NO;
      if (r.version !== c.version || r.avisos_version !== c.avisos_version || r.legal_sha256 !== c.legal_sha256 || r.avisos_sha256 !== c.avisos_sha256) { d.pend = d.pend.filter((x) => x.id !== r.id); save(); return NO; }
      const did = "pd-" + rnd(8), pr = { id: "pr-" + rnd(8), aceptado_at: r.created_at, verificado_at: ahora, edad: r.edad, version: r.version, avisos_version: r.avisos_version, legal_sha256: r.legal_sha256, avisos_sha256: r.avisos_sha256,
        acepta_terminos: true, acepta_datos: true, acepta_transferencia: true, acepta_acudiente: r.acepta_acudiente, acepta_promociones: r.acepta_promociones, contacto_verificado: true, canal: r.canal, contacto_hash: r.contacto_hash, datos_id: did };
      d.datos.push({ id: did, created_at: r.created_at, edad: r.edad, nombre: r.nombre, canal: r.canal, contacto: r.contacto, contacto_hash: r.contacto_hash, referidor_texto: r.referidor_texto, menor_nombre: r.menor_nombre }); d.pruebas.push(pr);
      const b = bogota(pr.aceptado_at), sn = (x) => (x ? "sí" : "no");
      d.outbox.push({ id: "ob-" + rnd(8), created_at: ahora, kind: "copia", canal: r.canal, destino: r.contacto, contacto_hash: r.contacto_hash, aceptacion_id: pr.id, estado: "simulado",
        cuerpo: `Hola ${r.nombre}. Esta es la copia de lo que aceptaste en el formulario del Plan de referidos el ${b.fecha} a las ${b.hora} (hora de Bogotá), versión ${pr.version} de los términos (huella ${pr.legal_sha256.slice(0, 8)}) y versión ${pr.avisos_version} del aviso (huella ${pr.avisos_sha256.slice(0, 8)}): (a) términos y condiciones: sí; (b) autorización de datos: sí; (c) servidores en Estados Unidos (Zoho): sí;${pr.acepta_acudiente ? " declaración del padre, madre o representante legal: sí;" : ""} (d) promociones: ${sn(pr.acepta_promociones)}; Puedes revocar o darte de baja cuando quieras escribiendo «BAJA» o tu solicitud al correo o al WhatsApp de MEC.` });
      d.pend = d.pend.filter((x) => x.id !== r.id); save();
      return { ok: true, aceptacion: { id: pr.id, fecha: b.fecha, hora: b.hora, zona: b.zona, version: pr.version, avisos_version: pr.avisos_version, huella_terminos: pr.legal_sha256.slice(0, 12), huella_aviso: pr.avisos_sha256.slice(0, 12),
        terminos: true, datos: true, transferencia: true, acudiente: pr.acepta_acudiente, promociones: pr.acepta_promociones, contacto_verificado: true, referidor: r.referidor_texto } };
    },
    derechos(p) {
      cur(); const d = db(), tipo = p.tipo, n = norm(p.canal, p.contacto), det = String(p.detalle || "").trim() || null, ahora = P.now();
      if (!["acceso", "rectificacion", "supresion", "revocacion", "baja_publicidad"].includes(tipo)) bad("tipo_no_valido", "tipo no válido");
      if (!n) bad("contacto_no_valido", "escribe el medio de contacto con el que te inscribiste (WhatsApp o correo)");
      if (det && (det.length > 500 || /[\u0000-\u001f\u007f]/.test(det))) bad("texto_no_valido", "texto no válido");
      const h = p.canal + ":" + n;
      if (d.solic.filter((x) => x.contacto_hash === h && x.created_at > ahora - 864e5).length >= 5) return { ok: true };
      let vence = tipo === "baja_publicidad" ? bogota(ahora).fecha : diasHabiles(ahora, tipo === "acceso" ? 10 : 15);
      if (tipo === "baja_publicidad" || tipo === "revocacion") { d.bajas.push({ at: ahora, contacto_hash: h, fuente: "formulario" }); d.revocaciones.push({ at: ahora, contacto_hash: h, tipo, fuente: "formulario" });
        if (tipo === "revocacion") d.outbox.forEach((o) => { if (o.contacto_hash === h && o.kind === "copia" && o.estado === "pendiente") o.estado = "cancelado"; }); }
      d.solic.push({ id: "sd-" + rnd(8), created_at: ahora, tipo, canal: p.canal, contacto: n, contacto_hash: h, detalle: det, estado: tipo === "baja_publicidad" ? "resuelta" : "recibida", vence_at: vence });
      save(); return { ok: true, vence, tipo };
    },
  };
  /* ---------- modo REAL: Edge Function «promo-publico» ---------- */
  async function real(accion, body) {
    const c = cfg(), r = await fetch(c.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/promo-publico", { method: "POST", headers: { "Content-Type": "application/json", apikey: c.SUPABASE_ANON_KEY, Authorization: "Bearer " + c.SUPABASE_ANON_KEY },
      body: JSON.stringify(Object.assign({ accion }, body)) });
    const j = await r.json().catch(() => ({ ok: false, error: "respuesta_no_valida", message: "No se pudo completar. Intenta de nuevo." }));
    if (!r.ok && !(j && j.error === "codigo_invalido")) throw new Error((j.error || "error") + ": " + (j.message || "No se pudo completar. Intenta de nuevo."));
    return j;
  }
  const call = async (accion, body) => { if (isReal()) return real(accion, body); await Promise.resolve(); try { return demo[accion](body); } catch (e) { throw e; } };
  /* administración (DEMO): espejo de promo_admin_registrar_baja / promo_admin_resolver_solicitud y de las lecturas del admin */
  const admin = {
    resumen() { const d = db(); return { pruebas: d.pruebas.map((x) => Object.assign({}, x, (() => { const q = d.datos.find((y) => y.id === x.datos_id) || {}; return { nombre: q.nombre || null, contacto: q.contacto || null, referidor_texto: q.referidor_texto || null, menor_nombre: q.menor_nombre || null }; })(), bogota(x.aceptado_at))).sort((a, b) => b.aceptado_at - a.aceptado_at),
      solicitudes: d.solic.slice().sort((a, b) => String(a.vence_at).localeCompare(String(b.vence_at))), pendientes: d.pend.length, bajas: d.bajas.length, outbox: d.outbox.length }; },
    baja(canal, contacto, nota) { const d = db(), n = norm(canal, contacto); if (!n) bad("contacto_no_valido", "contacto no válido"); const h = canal + ":" + n, ahora = P.now();
      d.bajas.push({ at: ahora, contacto_hash: h, fuente: "whatsapp_baja" }); d.revocaciones.push({ at: ahora, contacto_hash: h, tipo: "baja_publicidad", fuente: "whatsapp_baja" });
      d.solic.push({ id: "sd-" + rnd(8), created_at: ahora, tipo: "baja_publicidad", canal, contacto: n, contacto_hash: h, detalle: nota || null, estado: "resuelta", vence_at: bogota(ahora).fecha, fuente: "whatsapp_baja" }); d.bit.push({ at: ahora, accion: "registrar_baja" }); save(); return true; },
    resolver(id, estado, nota, borrar) { const d = db(), s = d.solic.find((x) => x.id === id); if (!s) bad("solicitud_no_existe", "solicitud no existe");
      if (!["en_proceso", "resuelta", "rechazada"].includes(estado)) bad("estado_no_valido", "estado no válido");
      if (borrar) { if (!["supresion", "revocacion"].includes(s.tipo)) bad("solo_supresion_o_revocacion", "solo supresión o revocación pueden borrar datos"); d.datos = d.datos.filter((x) => x.contacto_hash !== s.contacto_hash); d.outbox = d.outbox.filter((x) => x.contacto_hash !== s.contacto_hash); d.pend = d.pend.filter((x) => x.contacto_hash !== s.contacto_hash); }
      s.estado = estado; s.respuesta_nota = nota || null; d.bit.push({ at: P.now(), accion: "resolver_solicitud" }); save(); return true; },
  };
  const api = { registrar: (p) => call("registrar", p), confirmar: (p) => call("confirmar", p), reenviar: (p) => call("reenviar", p), derechos: (p) => call("derechos", p),
    admin, demoBandeja: () => (isReal() ? [] : db().outbox.slice()), demoReset: reset, demoPurgar: () => purgar(), demoDb: () => db() };
  /* ---------- formulario (Paso 1–5 del texto legal) ---------- */
  const contactoLinks = (f) => { const c = f.contacto; return `<a class="pt-btn sm" href="https://wa.me/${esc(c.tel_digits)}" target="_blank" rel="noopener">WhatsApp ${esc(c.tel)}</a> <a class="pt-btn sm" href="mailto:${esc(c.email)}">Escribir a ${esc(c.email)}</a> <a class="pt-btn sm" href="tel:+${esc(c.tel_digits)}">Llamar</a>`; };
  function formHtml(F, ad) {
    const l = L(), f = l.form, real = isReal();
    const chk = (c, extra) => `<label class="pt-chk" data-key="${c.key}"${extra || ""}><input type="checkbox" data-pf-chk="${c.key}"><span>${F(c.html)}</span></label>`;
    const cas = f.casillas;
    const byKey = (k) => cas.find((c) => c.key === k);
    return `<div class="pt-form-wrap" data-pf-wrap>
      <form class="pt-form" data-pf novalidate autocomplete="off">
        <fieldset class="pt-q"><legend>${F(esc(f.pregunta.title))}</legend>
          ${f.pregunta.options.map((o) => `<label class="pt-radio"><input type="radio" name="pf-edad" value="${o.id}" data-pf-edad><span>${F(o.html)}</span></label>`).join("")}</fieldset>
        <div class="pt-menor" data-pf-menor hidden role="alert"><p><strong>${esc(f.pregunta.menor_msg)}</strong></p></div>
        <div data-pf-resto hidden>
          <div class="pt-aviso" data-pf-aviso aria-label="Aviso de datos">${F(f.aviso)}</div>
          <div class="pt-datos">
            <label class="pt-fld">Tu nombre<input type="text" maxlength="120" autocomplete="off" data-pf-f="nombre" required></label>
            <fieldset class="pt-canal"><legend>Un medio de contacto (solo uno)</legend>
              <label class="pt-radio"><input type="radio" name="pf-canal" value="whatsapp" data-pf-canal checked><span>WhatsApp</span></label><label class="pt-radio"><input type="radio" name="pf-canal" value="correo" data-pf-canal><span>Correo</span></label>
              <input type="text" maxlength="254" inputmode="email" autocomplete="off" data-pf-f="contacto" aria-label="Tu WhatsApp o correo" placeholder="Tu número de WhatsApp"></fieldset>
            <label class="pt-fld">Nombre o código de quien te recomendó<input type="text" maxlength="120" autocomplete="off" data-pf-f="referidor" required></label>
            <label class="pt-fld" data-pf-menorf hidden>Nombre del menor (solo el nombre)<input type="text" maxlength="120" autocomplete="off" data-pf-f="menor_nombre"></label>
            <p class="pt-nota"><strong>No escribas datos de otras personas ni datos de salud.</strong></p>
            <div class="pt-hp" aria-hidden="true"><label>No llenar este campo<input type="text" tabindex="-1" autocomplete="off" data-pf-hp></label></div>
          </div>
          <div class="pt-casillas">${["terminos", "datos", "transferencia"].map((k) => chk(byKey(k))).join("")}
            <div class="pt-sinc" data-pf-sinc hidden role="status"><p><strong>${esc(f.sin_c)}</strong></p><p class="pt-sinc-b">${contactoLinks(f)}</p></div>
            <label class="pt-chk" data-key="acudiente" data-pf-acu hidden><input type="checkbox" data-pf-chk="acudiente"><span>${F(f.acudiente.html)}</span></label>
            ${["promociones"].filter((k) => byKey(k)).map((k) => chk(byKey(k))).join("")}
            <p class="pt-sub">${F(f.nota_opcionales)}</p></div>
          <div class="pt-cap" data-pf-cap>${real && ad && ad.captchaSiteKey ? `<div class="cf-turnstile" data-sitekey="${esc(ad.captchaSiteKey)}" data-callback="MEC_PF_CAPTCHA"></div>` :
            real ? `<p class="pt-msg bad">El captcha todavía no está configurado: el formulario no puede enviarse.</p>` : `<label class="pt-chk pt-demo-cap"><input type="checkbox" data-pf-demo-cap><span>No soy un robot <em>(captcha de demostración; en producción es Cloudflare Turnstile)</em></span></label>`}</div>
          <p class="pt-accion"><button type="submit" class="pt-btn off" data-pf-enviar aria-disabled="true">Enviar</button> <span class="pt-hint" data-pf-hint role="status" aria-live="polite">Responde la pregunta de edad y marca (a), (b) y (c) para poder enviar.</span></p>
          <p class="pt-msg" data-pf-msg role="alert" aria-live="assertive" hidden></p>
          <p class="pt-revocar">${F(f.revocar)} · <a href="derechos.html" data-pf-derechos>Revocar, darme de baja o ejercer mis derechos</a></p>
        </div>
      </form>
      <div class="pt-verif" data-pf-verif hidden>
        <h4>${esc(f.despues_titulo)}</h4>
        <p>Enviamos un único mensaje a <strong data-pf-dest></strong>: trae un código de 6 dígitos y un enlace. ${F(f.despues_texto)}</p>
        <label class="pt-fld">Código de 6 dígitos<input type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" data-pf-codigo></label>
        <p class="pt-accion"><button type="button" class="pt-btn" data-pf-confirmar>Confirmar mi contacto</button> <button type="button" class="pt-btn ghost" data-pf-reenviar>Reenviar el mensaje</button> <button type="button" class="pt-btn ghost" data-pf-corregir>Corregir mis datos</button></p>
        <p class="pt-msg" data-pf-vmsg role="alert" aria-live="assertive" hidden></p>
      </div>
      <div class="pt-ok" data-pf-ok hidden role="status"></div>
      <div class="pt-demo-bandeja" data-pf-bandeja hidden></div></div>`;
  }
  function wireForm(root, ad) {
    const sec = root.querySelector("[data-pf-wrap]"); if (!sec) return;
    const $ = (s) => sec.querySelector(s), $$ = (s) => [...sec.querySelectorAll(s)], form = $("[data-pf]"), l = L(), f = l.form;
    let edad = "", canal = "whatsapp", pend = null, busy = false, captchaTok = "";
    window.MEC_PF_CAPTCHA = (t) => { captchaTok = t; upd(); };
    const val = (k) => String(($(`[data-pf-f="${k}"]`) || {}).value || "").trim(), on = (k) => !!(($(`[data-pf-chk="${k}"]`) || {}).checked);
    const say = (sel, t, bad) => { const m = $(sel); if (!m) return; m.hidden = !t; m.textContent = t || ""; m.className = "pt-msg" + (bad ? " bad" : " good"); };
    function bandeja() { const b = $("[data-pf-bandeja]"), rows = api.demoBandeja(); if (isReal() || !rows.length) { b.hidden = true; return; } b.hidden = false;
      b.innerHTML = `<h4>Bandeja simulada (solo vista previa)</h4><p class="pt-sub">En producción estos mensajes saldrían por WhatsApp o correo. Aquí NO se envía nada: se muestran para que puedas probar el flujo.</p>` +
        rows.slice(-4).map((o) => `<blockquote class="pt-q"><strong>${o.kind === "verificacion" ? "Mensaje de verificación" : "Copia de lo aceptado"}</strong> → ${esc(o.destino)}<br>${esc(o.cuerpo)}</blockquote>`).join(""); }
    function upd() {
      const sinc = $("[data-pf-sinc]"), a = on("terminos"), b = on("datos"), c = on("transferencia"), acuOk = edad !== "acudiente" || on("acudiente");
      if (sinc) sinc.hidden = !(edad && edad !== "menor" && !c && (a || b || sinc.dataset.touched === "1"));   // quien no marca (c) ve los canales directos
      const ok = (edad === "adulto" || edad === "acudiente") && a && b && c && acuOk && !busy;
      const btn = $("[data-pf-enviar]"); btn.setAttribute("aria-disabled", ok ? "false" : "true"); btn.classList.toggle("off", !ok);
      $("[data-pf-hint]").textContent = !edad ? "Responde la pregunta de edad para empezar." : edad === "menor" ? "" : ok ? "Listo: puedes enviar." : "Marca (a), (b) y (c)" + (edad === "acudiente" ? " y la declaración del padre, madre o representante legal" : "") + " para poder enviar. Ninguna casilla viene marcada.";
    }
    $$("[data-pf-edad]").forEach((r) => (r.onchange = () => { edad = r.value; const menor = edad === "menor";
      $("[data-pf-menor]").hidden = !menor; $("[data-pf-resto]").hidden = menor; $("[data-pf-menorf]").hidden = edad !== "acudiente"; $("[data-pf-acu]").hidden = edad !== "acudiente";
      if (menor) { $$("[data-pf-f]").forEach((x) => (x.value = "")); $$("[data-pf-chk]").forEach((x) => (x.checked = false)); }   // un menor no continúa y no se conserva nada
      upd(); }));
    $$("[data-pf-canal]").forEach((r) => (r.onchange = () => { canal = r.value; const i = $('[data-pf-f="contacto"]'); i.placeholder = canal === "whatsapp" ? "Tu número de WhatsApp" : "Tu correo"; i.inputMode = canal === "whatsapp" ? "tel" : "email"; }));
    sec.addEventListener("change", (e) => { if (e.target.dataset && e.target.dataset.pfChk === "transferencia") { const s = $("[data-pf-sinc]"); if (s) s.dataset.touched = "1"; } upd(); });
    const dc = $("[data-pf-demo-cap]"); if (dc) dc.onchange = () => { captchaTok = dc.checked ? "demo-ok" : ""; };
    form.addEventListener("submit", async (ev) => { ev.preventDefault(); const btn = $("[data-pf-enviar]"); say("[data-pf-msg]", "");
      if (btn.getAttribute("aria-disabled") === "true") { say("[data-pf-msg]", edad ? "Marca las casillas obligatorias (a), (b) y (c) para poder enviar." : "Responde primero la pregunta de edad.", true); return; }
      if ($("[data-pf-hp]").value) { show("ok-falso"); return; }   // trampa para robots: respuesta idéntica, no se envía nada
      if (!captchaTok) { say("[data-pf-msg]", "Completa la verificación «No soy un robot».", true); return; }
      const p = { edad, nombre: val("nombre"), canal, contacto: val("contacto"), referidor: val("referidor"), menor_nombre: edad === "acudiente" ? val("menor_nombre") : "", version: l.version, avisos_version: l.avisos_version, legal_sha256: l.sources["terminos_y_condiciones_referidos.md"],
        avisos_sha256: l.sources["texto_aceptacion_y_avisos.md"], terminos: on("terminos"), datos: on("datos"), transferencia: on("transferencia"), acudiente: edad === "acudiente" && on("acudiente"), promociones: on("promociones"), captcha: captchaTok };
      busy = true; upd();
      try { await api.registrar(p); pend = { canal, contacto: p.contacto }; show("verif"); $("[data-pf-dest]").textContent = canal === "correo" ? val("contacto").toLowerCase() : val("contacto"); bandeja(); }
      catch (e) { say("[data-pf-msg]", stripCode(e && e.message) || "No se pudo enviar. Intenta de nuevo.", true); }
      busy = false; upd(); });
    function show(w) { $("[data-pf]").hidden = w !== "form"; $("[data-pf-verif]").hidden = w !== "verif"; $("[data-pf-ok]").hidden = w !== "ok";
      if (w === "ok-falso") { $("[data-pf]").hidden = true; $("[data-pf-verif]").hidden = false; } }
    function comprobante(a) {
      const sn = (x) => (x ? "sí" : "no"), rows = [["(a) Términos y condiciones", a.terminos], ["(b) Autorización de datos", a.datos], ["(c) Servidores en Estados Unidos (Zoho)", a.transferencia]].concat(a.acudiente ? [["Declaración del padre, madre o representante legal", true]] : [])
        .concat([["(d) Promociones y novedades", a.promociones]]);
      const o = $("[data-pf-ok]"); show("ok");
      o.innerHTML = `<h4>¡Listo! Confirmamos tu contacto y registramos tu aceptación</h4><p>Esto es lo que quedó guardado como prueba (sin tu IP ni tu navegador):</p>
        <ul class="pt-comp"><li><strong>Fecha y hora:</strong> ${esc(a.fecha)} ${esc(a.hora)} (hora de Bogotá, ${esc(a.zona)})</li><li><strong>Versión:</strong> términos ${esc(a.version)} · aviso ${esc(a.avisos_version)} (huellas ${esc(a.huella_terminos)} · ${esc(a.huella_aviso)})</li>
        ${rows.map(([t, v]) => `<li>${esc(t)}: <strong>${sn(v)}</strong></li>`).join("")}<li>Contacto verificado: <strong>sí</strong></li></ul>
        <p>Te enviamos <strong>una copia</strong> de esto al medio de contacto que confirmaste. Puedes revocar o darte de baja cuando quieras escribiendo «BAJA», o desde <a href="derechos.html">esta página</a>.</p>`; bandeja(); o.scrollIntoView && o.scrollIntoView({ block: "nearest" });
    }
    $("[data-pf-confirmar]").onclick = async () => { say("[data-pf-vmsg]", ""); const cod = String($("[data-pf-codigo]").value || "").replace(/\D/g, ""); if (cod.length !== 6) { say("[data-pf-vmsg]", "Escribe los 6 dígitos del código.", true); return; }
      try { const r = await api.confirmar({ canal: pend && pend.canal, contacto: pend && pend.contacto, codigo: cod }); if (r && r.ok) comprobante(r.aceptacion); else say("[data-pf-vmsg]", "El código no es válido o venció. Puedes pedir un mensaje nuevo (máximo 3 envíos).", true); }
      catch (e) { say("[data-pf-vmsg]", stripCode(e && e.message) || "No se pudo confirmar.", true); } };
    $("[data-pf-reenviar]").onclick = async () => { try { await api.reenviar({ canal: pend.canal, contacto: pend.contacto, captcha: captchaTok }); say("[data-pf-vmsg]", "Si todavía hay un registro pendiente, te enviamos otro mensaje (máximo 3 y con 1 minuto entre uno y otro).", false); bandeja(); } catch (e) { say("[data-pf-vmsg]", stripCode(e && e.message), true); } };
    $("[data-pf-corregir]").onclick = () => { show("form"); say("[data-pf-msg]", ""); };
    // enlace del mensaje de verificación: eventos.html?v=TOKEN
    const m = /[?&]v=([0-9a-f]{32,128})\b/.exec(location.search || "");
    if (m) { show("verif"); $("[data-pf-dest]").textContent = "tu medio de contacto"; say("[data-pf-vmsg]", "Confirmando tu contacto…", false);
      api.confirmar({ token: m[1] }).then((r) => { if (r && r.ok) comprobante(r.aceptacion); else say("[data-pf-vmsg]", "El enlace no sirve o ya venció. Vuelve a llenar el formulario o pide otro mensaje.", true); }).catch((e) => say("[data-pf-vmsg]", stripCode(e && e.message), true));
      try { history.replaceState(null, "", location.pathname + (location.hash || "")); } catch (e) {} }
    upd(); bandeja();
    if (isReal() && ad && ad.captchaSiteKey && !document.getElementById("pf-turnstile")) { const s = document.createElement("script"); s.id = "pf-turnstile"; s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"; s.async = true; document.head.appendChild(s); }
  }
  window.MEC_PROMO_PUB = Object.assign(api, { P, norm, bogota, diasHabiles, formHtml, wireForm, isReal, stripCode, contactoLinks });
})();
