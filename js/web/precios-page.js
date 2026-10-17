(function () {
  const P = window.MEC_PRECIOS, $ = (s) => document.querySelector(s), L = P.lista, T = P.tasas;
  const n = (v) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cop = (v) => "$" + n(v) + " COP";
  const fx = (v) => { const u = v / T.copUsd, e = u * T.usdEur; return `≈ ${u.toFixed(2).replace(".", ",")} USD · ${e.toFixed(2).replace(".", ",")} EUR`; };
  const card = (k, titulo, cnt, clases, lista, top) => `<article class="pcard${top ? " top" : ""}">
    <div class="pdesc"><b>−${k.desc}%</b><small>Ahorro</small></div>
    <h3>${titulo}</h3><div class="pcnt">${cnt}</div>
    <div class="pantes"><s>${cop(lista)}</s></div><div class="pcop">${cop(k.cop)}</div>
    <div class="pxclase">${cop(k.cop / clases)} por clase</div>
    <div class="pfx" data-fx>${fx(k.cop)}</div></article>`;
  const pp = P.personalizadas.paquetes, gp = P.grupales.paquetes, cp = P.combinados.paquetes;
  $("#p-pers").innerHTML = pp.map((k, i) => card(k, "Paquete " + k.id, k.clases + " clases", k.clases, k.clases * L.pers, i === pp.length - 1)).join("");
  $("#p-grup").innerHTML = gp.map((k, i) => card(k, "Paquete " + k.id, k.clases + " clases", k.clases, k.clases * L.grup, i === gp.length - 1)).join("");
  $("#p-comb").innerHTML = cp.map((k, i) => card(k, "Combo " + String(k.id).replace(/^C/, ""), `${k.pers + k.grup} clases (${k.pers} personalizadas + ${k.grup} grupales)`, k.pers + k.grup, k.pers * L.pers + k.grup * L.grup, i === cp.length - 1)).join("");
  const ps = P.personalizadas.suelta;
  $("#s-pers").innerHTML = `Clase suelta personalizada: <s>${cop(ps.lista)}</s> <strong>${cop(ps.cop)}</strong> <span class="etq">Descuento especial ${ps.desc}%</span>`;
  $("#s-grup").innerHTML = `Clase suelta grupal: <strong>${cop(P.grupales.suelta.cop)}</strong>`;
  $("#nota").textContent = `Precios por estudiante, en pesos colombianos (COP), IVA incluido. Precio de lista por clase: personalizada ${cop(L.pers)}, grupal ${cop(L.grup)}. Conversión de referencia: 1 USD = ${n(T.copUsd)} COP · 1 USD = ${String(T.usdEur).replace(".", ",")} EUR.`;
  // Modal "Aprende más": <dialog> nativo (foco atrapado, Esc cierra); devuelve el foco al botón.
  const dlg = $("#politicas"), btn = $("#abrir-politicas");
  if (dlg && btn) {
    btn.addEventListener("click", () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); });
    dlg.querySelector("[data-cerrar]").addEventListener("click", () => dlg.close ? dlg.close() : dlg.removeAttribute("open"));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => btn.focus());
  }
})();
