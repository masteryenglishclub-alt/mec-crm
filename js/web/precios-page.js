(function () {
  const P = window.MEC_PRECIOS.personalizadas, $ = (s) => document.querySelector(s);
  const n = (v) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cop = (v) => "$" + n(v) + " COP";
  const card = (k, top) => {
    const base = k.clases * P.suelta.cop, ahorro = base - k.cop;
    const porcentaje = (ahorro / base * 100).toFixed(1).replace(".", ",");
    const porClase = k.cop / k.clases, aprox = Number.isInteger(porClase) ? "" : "≈ ";
    return '<article class="pcard' + (top ? ' top' : '') + '" data-plan="' + k.id + '">'
      + '<div class="pdesc"><b>−' + porcentaje + ' %</b><small>Ahorro</small></div>'
      + '<h3>' + k.clases + ' clases</h3><div class="pcnt">Individuales · 60 minutos</div>'
      + '<div class="pantes"><span>En clases sueltas: </span><s>' + cop(base) + '</s></div>'
      + '<div class="pcop">' + cop(k.cop) + '</div>'
      + '<div class="pxclase">' + aprox + cop(porClase) + ' por clase</div>'
      + '<p class="pahorro">Ahorras <strong>' + cop(ahorro) + '</strong></p></article>';
  };
  const paquetes = P.paquetes;
  $("#p-pers").innerHTML = paquetes.map((k, i) => card(k, i === paquetes.length - 1)).join("");
  $("#s-pers").innerHTML = "1 clase suelta individual: <strong>" + cop(P.suelta.cop) + "</strong> · 60 minutos.";
  $("#nota").textContent = "Precios por estudiante en pesos colombianos (COP), IVA incluido. Materiales originales de MEC y feedback personalizado después de cada clase incluidos. Ahorros frente a clases sueltas de $79.000. Porcentajes redondeados; ≈ indica un valor por clase aproximado.";
  // Modal "Aprende más": <dialog> nativo; devuelve el foco al botón al cerrar.
  const dlg = $("#politicas"), btn = $("#abrir-politicas");
  if (dlg && btn) {
    btn.addEventListener("click", () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); });
    dlg.querySelector("[data-cerrar]").addEventListener("click", () => dlg.close ? dlg.close() : dlg.removeAttribute("open"));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => btn.focus());
  }
})();
