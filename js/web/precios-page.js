(function () {
  const P = window.MEC_PRECIOS, $ = (s) => document.querySelector(s);
  const cop = (n) => n.toLocaleString("es-CO", { maximumFractionDigits: 0 }).replace(/,/g, ".") + " COP";
  const dec = (n, c) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }) + " " + c;
  const card = (k, titulo, cnt, lista) => `<article class="card plan${k.desc === 40 ? " top" : ""}">
    <div class="badge">−${k.desc}%<small>DESCUENTO</small></div>
    <h3>${titulo}</h3><div class="cnt">${cnt}</div>
    <div class="antes">Antes ${cop(lista)}</div><div class="cop">${cop(k.cop)}</div>
    <div class="otras">${dec(k.usd, "USD")} · ${dec(k.eur, "EUR")}</div>
    <div class="xclase">${cop(Math.round(k.cop / (k.clases || k.pers + k.grup)))} por clase</div></article>`;
  const ps = P.personalizadas.suelta.cop, gs = P.grupales.suelta.cop;
  $("#p-pers").innerHTML = P.personalizadas.paquetes.map((k) => card(k, "Paquete " + k.id, k.clases + " clases 1 a 1", k.clases * ps)).join("");
  $("#p-grup").innerHTML = P.grupales.paquetes.map((k) => card(k, "Paquete " + k.id, k.clases + " clases grupales", k.clases * gs)).join("");
  $("#p-comb").innerHTML = P.combinados.paquetes.map((k) => card(k, "Paquete " + k.id, `${k.pers} personalizadas + ${k.grup} grupales`, k.lista)).join("");
  const s = (o) => `${cop(o.cop)} · ${dec(o.usd, "USD")}${o.usdCalc ? "*" : ""} · ${dec(o.eur, "EUR")}${o.eurCalc ? "*" : ""}`;
  $("#s-pers").textContent = "Clase suelta: " + s(P.personalizadas.suelta);
  $("#s-grup").textContent = "Clase suelta: " + s(P.grupales.suelta);
  const t = P.tasas;
  $("#nota").textContent = `Precios por estudiante. Tasas de referencia: 1 USD = ${t.copUsd.toLocaleString("es-CO").replace(/,/g, ".")} COP · 1 USD = ${String(t.usdEur).replace(".", ",")} EUR (${t.fuenteEur}, ${t.fechaEur}). Los valores en USD y EUR son de referencia. * Calculado con estas tasas.`;
})();
