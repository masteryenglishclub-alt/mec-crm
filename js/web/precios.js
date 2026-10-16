/* Precios MEC · tabla oficial v3 (aprobada por Lobo el 16 oct 2026). Por estudiante, COP, IVA incluido.
   Precio de lista por clase: personalizada 72.100 COP, grupal 49.000 COP.
   Conversión opcional de referencia (calculada aquí): 1 USD = 3.000 COP · 1 USD = 0,89381 EUR. */
window.MEC_PRECIOS = {
  tasas: { copUsd: 3000, usdEur: 0.89381 },
  lista: { pers: 72100, grup: 49000 },
  personalizadas: {
    suelta: { lista: 90000, cop: 79000, desc: 12 },
    paquetes: [
      { id: "P1", clases: 4,  desc: 5,  cop: 274000 },
      { id: "P2", clases: 8,  desc: 12, cop: 507000 },
      { id: "P3", clases: 16, desc: 17, cop: 958000 },
      { id: "P4", clases: 24, desc: 25, cop: 1298000 }
    ]
  },
  grupales: { // 2 a 4 estudiantes
    suelta: { cop: 49000 },
    paquetes: [
      { id: "G1", clases: 8,  desc: 20, cop: 314000 },
      { id: "G2", clases: 16, desc: 25, cop: 588000 },
      { id: "G3", clases: 24, desc: 30, cop: 823000 }
    ]
  },
  combinados: {
    paquetes: [
      { id: "C1", pers: 4,  grup: 8,  desc: 20, cop: 544000 },
      { id: "C2", pers: 8,  grup: 12, desc: 25, cop: 874000 },
      { id: "C3", pers: 12, grup: 16, desc: 30, cop: 1154000 }
    ]
  }
};
