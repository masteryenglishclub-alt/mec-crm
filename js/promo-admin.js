/* MEC · Administración del formulario público del evento de referidos (solo admin, pestaña Noticias y eventos). Sin dependencias.
   Muestra la prueba de aceptación (solo lectura: nadie la edita ni la borra), las solicitudes de derechos con su fecha límite, y permite registrar una BAJA recibida por WhatsApp
   y resolver solicitudes. Todo pasa por las funciones SQL de la propuesta 20261023_aceptacion_promo (con bitácora). */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TIPO = { acceso: "Acceso", rectificacion: "Rectificación", supresion: "Supresión", revocacion: "Revocación", baja_publicidad: "Baja" };
  const sn = (x) => (x ? "sí" : "no");
  const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  async function paint(el) {
    const api = window.MEC && window.MEC.api; let d;
    try { d = await api.promoAdminResumen(); } catch (e) { el.innerHTML = `<section class="pt"><div class="pt-card"><h3>Evento de referidos · formulario público</h3><p class="pt-sub">Todavía no está habilitado (falta aplicar la propuesta 20261023_aceptacion_promo). ${esc(String((e && e.message) || ""))}</p></div></section>`; return; }
    const venc = (s) => String(s.vence_at || "").slice(0, 10), h = hoy(), abiertas = d.solicitudes.filter((s) => s.estado === "recibida" || s.estado === "en_proceso");
    el.innerHTML = `<section class="pt" data-pa><div class="pt-card"><h3>Evento de referidos · formulario público</h3>
      <p class="pt-sub">Prueba de aceptación (solo lectura), solicitudes de derechos y bajas. ${d.pendientes == null ? "" : `Sin confirmar: <strong>${d.pendientes}</strong> (se borran a los 7 días). `}Bajas registradas: <strong>${d.bajas}</strong>.</p>
      <h4>Solicitudes de derechos abiertas (${abiertas.length})</h4>
      ${abiertas.length ? `<table><thead><tr><th>Tipo</th><th>Contacto</th><th>Vence</th><th>Detalle</th><th></th></tr></thead><tbody>${abiertas.map((s) => `<tr><td>${esc(TIPO[s.tipo] || s.tipo)}</td><td>${esc(s.contacto)}</td><td class="${venc(s) < h ? "pt-venc" : ""}">${esc(venc(s))}${venc(s) < h ? " · VENCIDA" : ""}</td><td>${esc(s.detalle || "")}</td>
        <td><button type="button" class="pt-btn sm" data-pa-res="${esc(s.id)}" data-tipo="${esc(s.tipo)}">Resolver</button></td></tr>`).join("")}</tbody></table>` : '<p class="pt-sub">No hay solicitudes abiertas.</p>'}
      <h4>Registrar una BAJA recibida por WhatsApp, correo o llamada</h4>
      <p class="pt-accion"><select data-pa-canal aria-label="Canal"><option value="whatsapp">WhatsApp</option><option value="correo">Correo</option></select> <input type="text" data-pa-contacto maxlength="254" aria-label="Contacto" placeholder="Número o correo"> <button type="button" class="pt-btn sm" data-pa-baja>Registrar BAJA</button></p>
      <p class="pt-msg" data-pa-msg role="status" aria-live="polite" hidden></p>
      <h4>Prueba de aceptación (${d.pruebas.length})</h4>
      ${d.pruebas.length ? `<table><thead><tr><th>Fecha y hora (Bogotá)</th><th>Edad</th><th>Nombre</th><th>Contacto</th><th>Versión</th><th>a</th><th>b</th><th>c</th><th>d</th></tr></thead><tbody>${d.pruebas.map((r) => `<tr><td>${esc(r.fecha || r.fecha_bogota)} ${esc(r.hora || r.hora_bogota)}</td><td>${esc(r.edad)}</td><td>${esc(r.nombre || "(borrado)")}</td><td>${esc(r.contacto || "(borrado)")}</td><td>${esc(r.version)} / ${esc(r.avisos_version)}</td>
        <td>${sn(r.acepta_terminos)}</td><td>${sn(r.acepta_datos)}</td><td>${sn(r.acepta_transferencia)}</td><td>${sn(r.acepta_promociones)}</td></tr>`).join("")}</tbody></table>` : '<p class="pt-sub">Aún no hay aceptaciones.</p>'}</div></section>`;
    const say = (t, bad) => { const m = el.querySelector("[data-pa-msg]"); m.hidden = !t; m.textContent = t; m.className = "pt-msg" + (bad ? " bad" : " good"); };
    el.querySelector("[data-pa-baja]").onclick = async () => { try { await api.promoAdminBaja(el.querySelector("[data-pa-canal]").value, el.querySelector("[data-pa-contacto]").value, "BAJA recibida"); await paint(el); say("BAJA registrada: esa persona sale de toda lista de publicidad.", false); } catch (e) { say(String((e && e.message) || e).replace(/^[a-z_]+:\s*/, ""), true); } };
    el.querySelectorAll("[data-pa-res]").forEach((b) => (b.onclick = async () => { const borrar = ["supresion", "revocacion"].includes(b.dataset.tipo) && window.confirm("¿Borrar también los datos personales de esta persona? La prueba mínima (fechas, versión, casillas) se conserva.");
      try { await api.promoAdminResolver(b.dataset.paRes, "resuelta", "Resuelta por el administrador", borrar); await paint(el); } catch (e) { say(String((e && e.message) || e).replace(/^[a-z_]+:\s*/, ""), true); } }));
  }
  function mount(root) { (root || document).querySelectorAll("[data-promo-admin]").forEach((el) => { const st = window.MEC_PROMO && window.MEC_PROMO.state(); if (!st) { el.hidden = true; el.innerHTML = ""; return; } el.hidden = false; paint(el); }); }
  window.MEC_PROMO_ADMIN = { mount, paint };
})();
