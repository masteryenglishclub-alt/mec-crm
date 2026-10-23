/* Datos del sitio público. PLACEHOLDER: los casos de éxito son EJEMPLOS inventados a pedido del dueño
   (ver PLACEHOLDERS_WEB.md). Reemplazar por testimonios reales con autorización. */
window.MEC_WEB = {
  whatsapp: "573157444674", // confirmado por el dueño (+57 315 744 4674)
  whatsappText: "Hola, quiero agendar una clase en Mastery English Club.",
  instagram: "https://www.instagram.com/masteryenglishclub/",
  facebook: "#", // PLACEHOLDER
  testimonios: [
    { placeholder: true, nombre: "Valentina", pais: "Colombia", nivel: "A2", avatar: { piel: "#c98d6b", pelo: "#3b2418", ropa: "#3aa0ff", peinado: "largo" },
      texto: "Antes me bloqueaba al hablar. Ahora converso en mis reuniones de trabajo con mucha más confianza." },
    { placeholder: true, nombre: "Diego", pais: "México", nivel: "B1", avatar: { piel: "#b97a56", pelo: "#1d1410", ropa: "#8e2b30", peinado: "corto" },
      texto: "Las clases 1 a 1 se adaptan a lo que me interesa. Hablo mucho más que en cualquier curso que había tomado." },
    { placeholder: true, nombre: "Camille", pais: "Francia", nivel: "A1", avatar: { piel: "#efc9a8", pelo: "#a8643a", ropa: "#3ccf8e", peinado: "moño" },
      texto: "Empecé desde cero y desde la primera clase ya estaba diciendo mis propias frases en inglés." }
  ],
  /* Eventos confirmados para la página pública (vacío = «Pronto»). Cada uno: { fecha: "2026-11-07T10:00:00-05:00", titulo, tema, texto, enlace? }
     No inventar fechas: agregar aquí solo eventos confirmados por MEC. */
  eventos: [],
  paises: [ // marcadores del globo [nombre, lat, lon]
    ["México", 23.6, -102.5], ["Panamá", 8.5, -80.8], ["Colombia", 4.6, -74.1], ["Chile", -33.4, -70.6],
    ["Argentina", -34.6, -58.4], ["España", 40.4, -3.7], ["Francia", 46.6, 2.3], ["China", 35.9, 104.2]
  ]
};
