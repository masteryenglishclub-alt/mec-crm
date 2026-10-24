/* Datos del sitio público. Casos de éxito: vacío (sin testimonios inventados).
   Agregar solo testimonios reales con autorización; mientras esté vacío, «Casos de éxito» no se muestra. */
window.MEC_WEB = {
  whatsapp: "573157444674", // confirmado por el dueño (+57 315 744 4674)
  whatsappText: "Hola, quiero agendar una clase en Mastery English Club.",
  instagram: "https://www.instagram.com/masteryenglishclub/",
  facebook: "#", // PLACEHOLDER
  testimonios: [], // 24-oct-2026: se quitaron los 3 testimonios de EJEMPLO; la sección se oculta sola si está vacía. Agregar aquí solo testimonios reales con autorización.
  /* Eventos confirmados para la página pública (vacío = «Pronto»). Cada uno: { fecha: "2026-11-07T10:00:00-05:00", titulo, tema, texto, enlace? }
     No inventar fechas: agregar aquí solo eventos confirmados por MEC. */
  eventos: [],
  paises: [ // marcadores del globo [nombre, lat, lon]
    ["México", 23.6, -102.5], ["Panamá", 8.5, -80.8], ["Colombia", 4.6, -74.1], ["Chile", -33.4, -70.6],
    ["Argentina", -34.6, -58.4], ["España", 40.4, -3.7], ["Francia", 46.6, 2.3], ["China", 35.9, 104.2]
  ]
};
