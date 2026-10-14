/* Precios MEC (datos de contabilidad, aprobados por el dueño). Valores literales; por estudiante.
   Tasas: 1 USD = 3.000 COP (definida por el dueño) · 1 USD = 0,89381 EUR (BCE, 13 oct 2026).
   eurCalc:true = EUR calculado aquí (USD × 0,89381, redondeado), no entregado por contabilidad. */
window.MEC_PRECIOS = {
  tasas: { copUsd: 3000, usdEur: 0.89381, fuenteEur: "BCE", fechaEur: "13 oct 2026" },
  personalizadas: {
    suelta: { cop: 90000, usd: 30.00, eur: 26.81, eurCalc: true },
    paquetes: [
      { id: "P1", clases: 4,  desc: 5,  cop: 342000,  usd: 114.00, eur: 101.89 },
      { id: "P2", clases: 8,  desc: 12, cop: 634000,  usd: 211.20, eur: 188.77 },
      { id: "P3", clases: 12, desc: 19, cop: 875000,  usd: 291.60, eur: 260.63 },
      { id: "P4", clases: 16, desc: 26, cop: 1066000, usd: 355.20, eur: 317.48 },
      { id: "P5", clases: 20, desc: 33, cop: 1206000, usd: 402.00, eur: 359.31 },
      { id: "P6", clases: 24, desc: 40, cop: 1296000, usd: 432.00, eur: 386.13 }
    ]
  },
  grupales: { // máx. 4 estudiantes, mínimo 2 para abrir grupo
    suelta: { cop: 49000, usd: 16.33, eur: 14.60, usdCalc: true, eurCalc: true },
    paquetes: [
      { id: "G1", clases: 4,  desc: 5,  cop: 185000, usd: 61.67,  eur: 55.12 },
      { id: "G2", clases: 8,  desc: 12, cop: 342000, usd: 114.00, eur: 101.89 },
      { id: "G3", clases: 12, desc: 19, cop: 472000, usd: 157.33, eur: 140.63 },
      { id: "G4", clases: 16, desc: 26, cop: 575000, usd: 191.67, eur: 171.31 },
      { id: "G5", clases: 20, desc: 33, cop: 651000, usd: 217.00, eur: 193.96 },
      { id: "G6", clases: 24, desc: 40, cop: 699000, usd: 233.00, eur: 208.26 }
    ]
  },
  combinados: { // v2 (/workspace/precios-mec/combinados-v2.md); grupales con mínimo 2 estudiantes
    paquetes: [
      { id: "C1", pers: 2,  grup: 4,  desc: 5,  lista: 376000,  cop: 357000,  usd: 119.00, eur: 106.36 },
      { id: "C2", pers: 4,  grup: 6,  desc: 12, lista: 654000,  cop: 576000,  usd: 192.00, eur: 171.61 },
      { id: "C3", pers: 6,  grup: 8,  desc: 19, lista: 932000,  cop: 755000,  usd: 251.67, eur: 224.94 },
      { id: "C4", pers: 8,  grup: 10, desc: 26, lista: 1210000, cop: 895000,  usd: 298.33, eur: 266.65 },
      { id: "C5", pers: 10, grup: 12, desc: 33, lista: 1488000, cop: 997000,  usd: 332.33, eur: 297.04 },
      { id: "C6", pers: 12, grup: 14, desc: 40, lista: 1766000, cop: 1060000, usd: 353.33, eur: 315.81 }
    ]
  }
};
