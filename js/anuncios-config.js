/* MEC · ANUNCIOS (espacio preparado). Edita SOLO este archivo para publicar un anuncio: no hace falta tocar código.
   Cómo funciona: js/anuncios.js lee MEC_ANUNCIOS y pinta el primer anuncio que cumpla TODO esto:
     active === true · está dentro de starts/ends (si se indican) · tiene title, text, link (https://… o página del sitio) y, si requireLegal
     es true, también legalUrl (enlace a los términos y condiciones), policyUrl y legalReviewed. Si falta algo, NO se muestra (nunca a medias).
   El promotor y responsable es siempre «Mastery English Club» (decisión del dueño, 23-oct-2026: sin razón social ni NIT): ya no es un dato que haya que llenar.
   Sitios (placements): "portal-eventos" (pestaña Noticias y eventos del portal) · "login" (parte superior de login.html)
                        "inicio" (parte superior de index.html) · "eventos-publico" (eventos.html).
   Imagen: ruta dentro del sitio (img/anuncios/…) o https://…; imageAlt = texto alternativo. Fechas: "2026-11-01T00:00:00-05:00" (hora Bogotá).
   TÉRMINOS Y CONDICIONES (decisión del dueño): el texto COMPLETO vive en eventos.html#terminos-plan-de-referidos (y en la pestaña Noticias y eventos del portal);
   las imágenes de WhatsApp y redes NO llevan T&C, solo el enlace de «legalUrlPublic». Texto legal: js/promo-legal.js (generado con tools/gen_promo_legal.py).
   PARA ACTIVAR: completa policyUrl, title, text, starts/ends y captchaSiteKey (formulario público); confirma con el abogado y pon legalReviewed: true; el texto legal ya no debe tener marcas de pendiente;
   luego active: true. «node tools/check_promo.js» (y la publicación en producción) BLOQUEAN la activación si queda algún dato pendiente.
   FORMULARIO PÚBLICO (referido sin cuenta): vive en eventos.html#participar-plan-de-referidos. Usa la Edge Function «promo-publico» (captcha Turnstile: captchaSiteKey es la clave PÚBLICA del sitio).
   ESTADO ACTUAL: "plan-de-referidos" está INACTIVO y vacío: faltan arte final (Embla), URL de la política, captcha, revisión final y los datos pendientes del texto legal. */
window.MEC_ANUNCIOS = [
  {
    id: "plan-de-referidos",
    active: false,                     // ← cambiar a true SOLO cuando todo lo de abajo esté completo y revisado
    placements: ["portal-eventos", "login", "inicio", "eventos-publico"],
    kicker: "Evento",
    title: "Evento de expansión: Plan de referidos",   // ← nombre oficial del evento (puedes afinar el título del banner)
    text: "",                          // ← texto final (corto)
    image: "", imageAlt: "",   // ← banner v4 (Embla). Pendiente de revisión: le faltan los elementos obligatorios de la §7.1 (tope 100 %, fechas de crédito, «no se paga en dinero»)
    link: "eventos.html#participar-plan-de-referidos", linkLabel: "Quiero participar",   // ← formulario público (ya fijo, vive en Eventos)
    legalUrl: "eventos.html#terminos-plan-de-referidos", legalLabel: "Términos y condiciones",   // ← T&C: ya fijo (ancla estable en Eventos)
    legalUrlPublic: "https://masteryenglishclub-alt.github.io/mec-crm/eventos.html#terminos-plan-de-referidos",   // ← URL completa para posts de redes/WhatsApp
    policyUrl: "",                     // ← URL de la Política de Tratamiento de Datos (pendiente)
    legalReviewed: false,              // ← true SOLO cuando un abogado humano aprobó el texto legal
    captchaSiteKey: "",                // ← clave PÚBLICA de Cloudflare Turnstile para el formulario público (pendiente; el secreto va solo en la Edge Function)
    requireLegal: true,                // ← true = no se muestra sin T&C, política y revisión legal
    starts: null, ends: null           // ← "2026-11-01T00:00:00-05:00"
  }
];
window.MEC_ANUNCIOS_MUESTRA = null;
