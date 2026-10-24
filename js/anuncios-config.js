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
   ESTADO ACTUAL (24-oct-2026): "plan-de-referidos" ACTIVO como anuncio INFORMATIVO (sin formulario ni T&C). Para el modo completo faltan URL de la política, captcha, revisión legal y los pendientes del texto legal. */
window.MEC_ANUNCIOS = [
  {
    id: "plan-de-referidos",
    /* 24-oct-2026 · Decisión del dueño: se publica como ANUNCIO INFORMATIVO (banner + condiciones del arte + WhatsApp).
       NO activa el registro de participación ni los T&C (siguen bloqueados en js/promo-terminos.js: el texto legal tiene pendientes
       y falta la revisión de la abogada). Para el modo completo: volver a requireLegal: true, link → formulario y legalUrl → T&C. */
    active: true,
    placements: ["portal-eventos", "eventos-publico"],
    kicker: "Evento · 1 nov. – 31 dic. 2026",
    title: "Evento de expansión: Plan de referidos",
    text: "Recomienda MEC y gana un 25 % de descuento en tu próxima renovación por cada referido. El referido debe adquirir un paquete mínimo de 8 clases. Válido del 1 de noviembre al 31 de diciembre de 2026.",
    image: "img/anuncios/plan-de-referidos.webp", imageMobile: "img/anuncios/plan-de-referidos-vertical.webp", wide: true,
    imageAlt: "Evento de expansión, Plan de referidos de Mastery English Club: 25 % de descuento en tu próxima renovación por cada referido; el referido debe adquirir un paquete mínimo de 8 clases; del 1 de noviembre al 31 de diciembre de 2026.",
    link: "https://wa.me/573157444674?text=Hola%2C%20quiero%20informaci%C3%B3n%20del%20Plan%20de%20referidos%20de%20MEC.", linkLabel: "Más información por WhatsApp",
    legalUrl: "", legalLabel: "Términos y condiciones: muy pronto",   // modo completo: "eventos.html#terminos-plan-de-referidos"
    legalUrlPublic: "https://masteryenglishclub-alt.github.io/mec-crm/eventos.html#terminos-plan-de-referidos",
    policyUrl: "",                     // ← URL de la Política de Tratamiento de Datos (pendiente)
    legalReviewed: false,              // ← true SOLO cuando un abogado humano aprobó el texto legal
    captchaSiteKey: "",                // ← clave PÚBLICA de Cloudflare Turnstile (pendiente)
    requireLegal: false,               // ← informativo: se muestra sin T&C. El formulario y los T&C NO se muestran mientras legalReviewed sea false
    starts: null, ends: "2026-12-31T23:59:59-05:00"
  }
];
window.MEC_ANUNCIOS_MUESTRA = null;
