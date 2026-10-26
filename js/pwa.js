/* MEC · app instalable (Android). Registra el service worker y, cuando Chrome lo permite, muestra el botón «Instalar app».
   No muestra nada si ya está instalada o si la persona lo cerró hace menos de 30 días. Sin dependencias. */
(function () {
  if (!("serviceWorker" in navigator)) return;
  addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const KEY = "mec_app_instalar_cerrado";
  const closedRecently = () => { try { const t = +localStorage.getItem(KEY) || 0; return Date.now() - t < 30 * 864e5; } catch (e) { return false; } };
  let evt = null;
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); evt = e;
    if (standalone() || closedRecently() || document.getElementById("mec-app")) return;
    const b = document.createElement("div"); b.id = "mec-app"; b.setAttribute("role", "region"); b.setAttribute("aria-label", "Instalar la app");
    b.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;display:flex;align-items:center;gap:10px;max-width:420px;margin:0 auto;padding:10px 12px;background:#0b1828;border:1px solid #d9ad5c;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.5);color:#e8edf3;font:15px system-ui,sans-serif";
    b.innerHTML = '<img src="img/app/icon-192.png" width="40" height="40" alt="" style="border-radius:50%"><span style="flex:1"><b style="color:#f0c46a">App de MEC</b><br><small>Tus clases a un toque, desde tu celular.</small></span>'
      + '<button type="button" id="mec-app-si" style="background:#f0c46a;color:#1b1204;border:0;border-radius:6px;padding:9px 12px;font-weight:700">Instalar</button>'
      + '<button type="button" id="mec-app-no" aria-label="Cerrar" style="background:none;border:0;color:#cfd8e4;font-size:22px;line-height:1;padding:4px">×</button>';
    document.body.appendChild(b);
    b.querySelector("#mec-app-si").onclick = async () => { b.remove(); if (!evt) return; evt.prompt(); try { await evt.userChoice; } catch (x) {} evt = null; };
    b.querySelector("#mec-app-no").onclick = () => { b.remove(); try { localStorage.setItem(KEY, String(Date.now())); } catch (x) {} };
  });
  addEventListener("appinstalled", () => { const b = document.getElementById("mec-app"); if (b) b.remove(); evt = null; });
})();
